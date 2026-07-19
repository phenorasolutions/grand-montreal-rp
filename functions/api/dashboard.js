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

    const [
      users,
      vehicles,
      houses,
      vip,
      published,
      recentActions,
      currentUser
    ] = await Promise.all([
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
      ).first(),

      db.prepare(
        "SELECT COUNT(*) AS total FROM marketplace_items WHERE published = 1"
      ).first(),

      db.prepare(
        `SELECT
          l.id,
          l.action,
          l.category,
          l.details,
          l.created_at,
          u.display_name,
          u.username
        FROM activity_logs l
        LEFT JOIN users u ON u.id = l.user_id
        ORDER BY l.id DESC
        LIMIT 8`
      ).all(),

      db.prepare(
        `SELECT
          created_at,
          last_login
        FROM users
        WHERE id = ?1
        LIMIT 1`
      ).bind(user.id).first()
    ]);

    const actions = (recentActions.results || []).map((row) => {
      let details = null;

      if (row.details) {
        try {
          details = JSON.parse(row.details);
        } catch {
          details = row.details;
        }
      }

      return {
        id: row.id,
        action: row.action,
        category: row.category,
        details,
        createdAt: row.created_at,
        actor: {
          displayName: row.display_name || "Système",
          username: row.username || null
        }
      };
    });

    return json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        createdAt: currentUser?.created_at || null,
        lastLogin: currentUser?.last_login || null
      },
      counts: {
        users: Number(users?.total || 0),
        vehicles: Number(vehicles?.total || 0),
        houses: Number(houses?.total || 0),
        vip: Number(vip?.total || 0),
        published: Number(published?.total || 0)
      },
      recentActions: actions
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
