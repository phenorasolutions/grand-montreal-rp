import {
  ensureSchema,
  getSessionUser,
  json
} from "../../_lib/auth.js";

export async function onRequestGet(context) {
  try {
    await ensureSchema(context.env.DB);
    const user = await getSessionUser(context.env.DB, context.request);

    if (!user) {
      return json({ error: "Session requise." }, 401);
    }

    return json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role
      },
      csrfToken: user.csrfToken
    });
  } catch (error) {
    console.error(error);
    return json({ error: "Impossible de vérifier la session." }, 500);
  }
}
