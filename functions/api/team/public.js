import { json } from "../../_lib/security.js";
import { ensureTeamSchema, mapMember } from "./_schema.js";

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ success: false, error: "Binding D1 DB introuvable." }, 500);

    await ensureTeamSchema(db);

    const result = await db.prepare(`
      SELECT t.*, u.display_name AS updated_by_name
      FROM team_members t
      LEFT JOIN users u ON u.id = t.updated_by
      WHERE t.status='visible'
      ORDER BY
        t.featured DESC,
        t.department ASC,
        t.sort_order ASC,
        t.id ASC
    `).all();

    return json({
      success: true,
      members: (result.results || []).map(mapMember)
    });
  } catch (error) {
    console.error(error);
    return json({ success: false, error: "Impossible de charger l'équipe." }, 500);
  }
}
