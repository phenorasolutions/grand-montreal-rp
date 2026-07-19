import {
  ensureSchema,
  getSessionUser,
  json,
  cleanupExpiredSessions
} from "../../_lib/auth.js";

export async function onRequestGet(context) {
  try {
    await ensureSchema(context.env.DB);
    await cleanupExpiredSessions(context.env.DB);

    const count = await context.env.DB
      .prepare("SELECT COUNT(*) AS total FROM users")
      .first();

    const user = await getSessionUser(context.env.DB, context.request);

    return json({
      initialized: Number(count?.total || 0) > 0,
      authenticated: Boolean(user),
      user: user ? {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role
      } : null
    });
  } catch (error) {
    console.error(error);
    return json({ error: "Impossible d'initialiser le portail." }, 500);
  }
}
