import {
  assertSameOrigin,
  deleteSession,
  ensureSchema,
  getClientIp,
  getSessionUser,
  json,
  logActivity,
  sessionCookie
} from "../../_lib/auth.js";

export async function onRequestPost(context) {
  try {
    assertSameOrigin(context.request);
    await ensureSchema(context.env.DB);

    const user = await getSessionUser(context.env.DB, context.request);

    if (user) {
      await logActivity(context.env.DB, {
        userId: user.id,
        action: "logout",
        category: "auth",
        details: { username: user.username },
        ipAddress: getClientIp(context.request)
      });
    }

    await deleteSession(context.env.DB, context.request);

    return json({ success: true }, 200, {
      "Set-Cookie": sessionCookie("", 0)
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ error: "Impossible de se déconnecter." }, 500);
  }
}
