import {
  getSessionUser,
  json
} from "../../_lib/security.js";

export async function onRequestGet(context) {
  try {
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

    if (!user) {
      return json(
        {
          success: true,
          authenticated: false,
          user: null
        }
      );
    }

    return json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);

    return json(
      {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Impossible de vérifier la session."
      },
      500
    );
  }
}
