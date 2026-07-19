import {
  json,
  requireSession
} from "../_lib/security.js";

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

    const user = await requireSession(db, context.request, 20);

    const [users, vehicles, houses, vip] = await Promise.all([
      db.prepare(
        "SELECT COUNT(*) AS total FROM users WHERE active = 1"
      ).first(),
      db.prepare(
        "SELECT COUNT(*) AS total FROM marketplace_items WHERE type = 'vehicle'"
      ).first(),
      db.prepare(
        "SELECT COUNT(*) AS total FROM marketplace_items WHERE type = 'house'"
      ).first(),
      db.prepare(
        "SELECT COUNT(*) AS total FROM marketplace_items WHERE type = 'vip'"
      ).first()
    ]);

    return json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role
      },
      counts: {
        users: Number(users?.total || 0),
        vehicles: Number(vehicles?.total || 0),
        houses: Number(houses?.total || 0),
        vip: Number(vip?.total || 0)
      }
    });
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
          : "Impossible de charger le tableau de bord."
      },
      500
    );
  }
}
