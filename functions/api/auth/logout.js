import {
  assertSameOrigin,
  clearSessionCookie,
  deleteCurrentSession,
  getClientIp,
  getSessionUser,
  json,
  logActivity
} from "../../_lib/security.js";

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

    const user = await getSessionUser(db, context.request);

    if (user) {
      await logActivity(db, {
        userId: user.id,
        action: "logout",
        category: "auth",
        details: { username: user.username },
        ipAddress: getClientIp(context.request)
      });
    }

    await deleteCurrentSession(db, context.request);

    return json(
      {
        success: true,
        authenticated: false
      },
      200,
      {
        "Set-Cookie": clearSessionCookie()
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
          : "Impossible de se déconnecter."
      },
      500
    );
  }
}
