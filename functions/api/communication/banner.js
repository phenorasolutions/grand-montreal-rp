import { json } from "../../_lib/security.js";
import { ensureCommunicationSchema, mapPost } from "./_schema.js";

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    await ensureCommunicationSchema(db);

    const row = await db.prepare(`
      SELECT p.*, u.display_name AS author_name
      FROM communication_posts p
      LEFT JOIN users u ON u.id=p.updated_by
      WHERE p.status='published'
        AND p.type='announcement'
        AND p.banner_enabled=1
      ORDER BY p.sort_order ASC, p.id DESC
      LIMIT 1
    `).first();

    return json({ success: true, banner: row ? mapPost(row) : null });
  } catch (error) {
    console.error(error);
    return json({ success: false, banner: null }, 500);
  }
}
