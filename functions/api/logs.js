import { json, requireSession } from "../_lib/security.js";

function clean(value, maxLength = 80) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);

    await requireSession(db, context.request, 80);

    const url = new URL(context.request.url);
    const category = clean(url.searchParams.get("category"));
    const action = clean(url.searchParams.get("action"));
    const userId = Number(url.searchParams.get("userId") || 0);
    const limit = Math.min(200, Math.max(10, Number(url.searchParams.get("limit") || 100)));

    const clauses = [];
    const values = [];

    if (category) {
      clauses.push(`l.category = ?${values.length + 1}`);
      values.push(category);
    }

    if (action) {
      clauses.push(`l.action = ?${values.length + 1}`);
      values.push(action);
    }

    if (Number.isInteger(userId) && userId > 0) {
      clauses.push(`l.user_id = ?${values.length + 1}`);
      values.push(userId);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    let statement = db.prepare(
      `SELECT
         l.id,
         l.user_id,
         l.action,
         l.category,
         l.details,
         l.ip_address,
         l.created_at,
         u.display_name,
         u.username
       FROM activity_logs l
       LEFT JOIN users u ON u.id = l.user_id
       ${where}
       ORDER BY l.id DESC
       LIMIT ${limit}`
    );

    if (values.length) statement = statement.bind(...values);

    const result = await statement.all();

    const categories = await db.prepare(
      `SELECT category, COUNT(*) AS total
       FROM activity_logs
       GROUP BY category
       ORDER BY total DESC`
    ).all();

    return json({
      success: true,
      logs: (result.results || []).map((row) => {
        let details = null;
        try {
          details = row.details ? JSON.parse(row.details) : null;
        } catch {
          details = row.details;
        }

        return {
          id: Number(row.id),
          userId: row.user_id ? Number(row.user_id) : null,
          action: row.action,
          category: row.category,
          details,
          ipAddress: row.ip_address || "",
          createdAt: row.created_at,
          actor: {
            displayName: row.display_name || "Système",
            username: row.username || null
          }
        };
      }),
      categories: (categories.results || []).map((row) => ({
        name: row.category,
        total: Number(row.total)
      }))
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de charger les journaux." }, 500);
  }
}
