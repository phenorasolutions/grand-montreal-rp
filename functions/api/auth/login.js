import {
  assertSameOrigin,
  createSession,
  ensureSchema,
  getClientIp,
  json,
  logActivity,
  verifyPassword
} from "../../_lib/auth.js";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export async function onRequestPost(context) {
  try {
    assertSameOrigin(context.request);
    await ensureSchema(context.env.DB);

    const body = await context.request.json();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const ip = getClientIp(context.request);

    if (!username || !password) {
      return json({ error: "Identifiant et mot de passe requis." }, 400);
    }

    const attempts = await context.env.DB.prepare(
      `SELECT COUNT(*) AS total
       FROM login_attempts
       WHERE successful = 0
         AND created_at >= datetime('now', '-${WINDOW_MINUTES} minutes')
         AND (username = ?1 OR ip_address = ?2)`
    ).bind(username, ip).first();

    if (Number(attempts?.total || 0) >= MAX_ATTEMPTS) {
      return json({
        error: "Trop de tentatives. Réessaie dans quelques minutes."
      }, 429);
    }

    const user = await context.env.DB.prepare(
      `SELECT
         id, username, password_hash, password_salt,
         password_iterations, display_name, role, active
       FROM users
       WHERE username = ?1
       LIMIT 1`
    ).bind(username).first();

    const valid = user && user.active === 1
      ? await verifyPassword(password, user)
      : false;

    await context.env.DB.prepare(
      `INSERT INTO login_attempts
        (username, ip_address, successful)
       VALUES (?1, ?2, ?3)`
    ).bind(username, ip, valid ? 1 : 0).run();

    if (!valid) {
      await logActivity(context.env.DB, {
        userId: user?.id || null,
        action: "login_failed",
        category: "auth",
        details: { username },
        ipAddress: ip
      });

      return json({ error: "Identifiant ou mot de passe incorrect." }, 401);
    }

    await context.env.DB.prepare(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?1"
    ).bind(user.id).run();

    const session = await createSession(context.env.DB, context.request, user.id);

    await logActivity(context.env.DB, {
      userId: user.id,
      action: "login_success",
      category: "auth",
      details: { username: user.username },
      ipAddress: ip
    });

    return json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role
      },
      csrfToken: session.csrfToken
    }, 200, {
      "Set-Cookie": session.cookie
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ error: "Impossible de se connecter." }, 500);
  }
}
