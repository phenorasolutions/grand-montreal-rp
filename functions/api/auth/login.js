import {
  assertSameOrigin,
  createSession,
  getClientIp,
  json,
  logActivity,
  normalizeUsername,
  verifyPassword
} from "../../_lib/security.js";

const MAX_FAILED_ATTEMPTS = 5;

export async function onRequestPost(context) {
  try {
    assertSameOrigin(context.request);

    const db = context.env.DB;

    if (!db) {
      return json(
        {
          success: false,
          error: "Le binding D1 DB est introuvable."
        },
        500
      );
    }

    const body = await context.request.json();
    const username = normalizeUsername(body.username);
    const password = String(body.password || "");
    const ipAddress = getClientIp(context.request);

    if (!username || !password) {
      return json(
        {
          success: false,
          error: "Identifiant et mot de passe requis."
        },
        400
      );
    }

    const attemptCount = await db.prepare(
      `SELECT COUNT(*) AS total
       FROM activity_logs
       WHERE category = 'auth'
         AND action = 'login_failed'
         AND ip_address = ?1
         AND created_at >= datetime('now', '-15 minutes')`
    ).bind(ipAddress).first();

    if (Number(attemptCount?.total || 0) >= MAX_FAILED_ATTEMPTS) {
      return json(
        {
          success: false,
          error: "Trop de tentatives. Réessaie dans 15 minutes."
        },
        429
      );
    }

    const user = await db.prepare(
      `SELECT
        id,
        username,
        password_hash,
        password_salt,
        password_iterations,
        display_name,
        role,
        active
      FROM users
      WHERE username = ?1
      LIMIT 1`
    ).bind(username).first();

    const validPassword = user && Number(user.active) === 1
      ? await verifyPassword(password, user)
      : false;

    if (!validPassword) {
      await logActivity(db, {
        userId: user?.id || null,
        action: "login_failed",
        category: "auth",
        details: { username },
        ipAddress
      });

      return json(
        {
          success: false,
          error: "Identifiant ou mot de passe incorrect."
        },
        401
      );
    }

    await db.prepare(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?1"
    ).bind(user.id).run();

    await db.prepare(
      "DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP"
    ).run();

    const session = await createSession(db, context.request, user.id);

    await logActivity(db, {
      userId: user.id,
      action: "login_success",
      category: "auth",
      details: { username: user.username },
      ipAddress
    });

    return json(
      {
        success: true,
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          role: Number(user.role)
        }
      },
      200,
      {
        "Set-Cookie": session.cookie
      }
    );
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error(error);

    return json(
      {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Impossible de se connecter."
      },
      500
    );
  }
}
