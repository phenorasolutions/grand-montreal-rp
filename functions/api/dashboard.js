import { json, requireSession } from "../_lib/security.js";

async function tableExists(db, tableName) {
  const row = await db.prepare(
    `SELECT name FROM sqlite_schema
     WHERE type = 'table' AND name = ?1
     LIMIT 1`
  ).bind(tableName).first();

  return Boolean(row);
}

async function scalar(db, sql) {
  const row = await db.prepare(sql).first();
  return Number(row?.total || 0);
}

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);

    const user = await requireSession(db, context.request, 20);

    const mediaExists = await tableExists(db, "media_assets");

    const [
      users,
      vehicles,
      houses,
      vip,
      published,
      drafts,
      featured,
      media,
      recentActions,
      currentUser
    ] = await Promise.all([
      scalar(db, "SELECT COUNT(*) AS total FROM users WHERE active = 1"),
      scalar(db, "SELECT COUNT(*) AS total FROM marketplace_items WHERE type = 'vehicle'"),
      scalar(db, "SELECT COUNT(*) AS total FROM marketplace_items WHERE type = 'house'"),
      scalar(db, "SELECT COUNT(*) AS total FROM marketplace_items WHERE type = 'vip'"),
      scalar(db, "SELECT COUNT(*) AS total FROM marketplace_items WHERE published = 1"),
      scalar(db, "SELECT COUNT(*) AS total FROM marketplace_items WHERE published = 0"),
      scalar(db, `SELECT COUNT(*) AS total FROM marketplace_items
                  WHERE json_extract(metadata_json, '$.featured') = 1`),
      mediaExists ? scalar(db, "SELECT COUNT(*) AS total FROM media_assets") : Promise.resolve(0),
      db.prepare(
        `SELECT
           l.id, l.action, l.category, l.details, l.created_at,
           u.display_name, u.username
         FROM activity_logs l
         LEFT JOIN users u ON u.id = l.user_id
         ORDER BY l.id DESC
         LIMIT 10`
      ).all(),
      db.prepare(
        `SELECT created_at, last_login
         FROM users WHERE id = ?1 LIMIT 1`
      ).bind(user.id).first()
    ]);

    const actions = (recentActions.results || []).map((row) => {
      let details = null;
      try {
        details = row.details ? JSON.parse(row.details) : null;
      } catch {
        details = row.details;
      }

      return {
        id: Number(row.id),
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
        users,
        vehicles,
        houses,
        vip,
        published,
        drafts,
        featured,
        media
      },
      recentActions: actions
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de charger le tableau de bord." }, 500);
  }
}
