import {
  assertSameOrigin,
  createSession,
  ensureSchema,
  getClientIp,
  hashPassword,
  json,
  logActivity
} from "../../_lib/auth.js";

export async function onRequestPost(context) {
  try {
    assertSameOrigin(context.request);
    await ensureSchema(context.env.DB);

    if (!context.env.CMS_SETUP_KEY) {
      return json({
        error: "La variable secrète CMS_SETUP_KEY n'est pas configurée dans Cloudflare."
      }, 503);
    }

    const body = await context.request.json();
    const setupKey = String(body.setupKey || "");
    const username = String(body.username || "").trim().toLowerCase();
    const displayName = String(body.displayName || "").trim();
    const password = String(body.password || "");

    if (setupKey !== context.env.CMS_SETUP_KEY) {
      return json({ error: "Clé d'installation invalide." }, 403);
    }

    const count = await context.env.DB
      .prepare("SELECT COUNT(*) AS total FROM users")
      .first();

    if (Number(count?.total || 0) > 0) {
      return json({ error: "Le compte fondateur existe déjà." }, 409);
    }

    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      return json({
        error: "L'identifiant doit contenir 3 à 40 caractères : lettres, chiffres, point, tiret ou soulignement."
      }, 400);
    }

    if (displayName.length < 2 || displayName.length > 60) {
      return json({ error: "Le nom affiché doit contenir 2 à 60 caractères." }, 400);
    }

    if (password.length < 12 || password.length > 200) {
      return json({ error: "Le mot de passe doit contenir au moins 12 caractères." }, 400);
    }

    const passwordData = await hashPassword(password);

    const result = await context.env.DB.prepare(
      `INSERT INTO users
        (username, password_hash, password_salt, password_iterations, display_name, role, active)
       VALUES (?1, ?2, ?3, ?4, ?5, 100, 1)`
    ).bind(
      username,
      passwordData.hash,
      passwordData.salt,
      passwordData.iterations,
      displayName
    ).run();

    const userId = result.meta.last_row_id;
    const session = await createSession(context.env.DB, context.request, userId);

    await logActivity(context.env.DB, {
      userId,
      action: "founder_created",
      category: "auth",
      details: { username, displayName, role: 100 },
      ipAddress: getClientIp(context.request)
    });

    return json({
      success: true,
      user: { id: userId, username, displayName, role: 100 }
    }, 201, {
      "Set-Cookie": session.cookie
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);

    if (String(error?.message || "").includes("UNIQUE")) {
      return json({ error: "Cet identifiant est déjà utilisé." }, 409);
    }

    return json({ error: "Impossible de créer le compte fondateur." }, 500);
  }
}
