import { json } from "../../_lib/security.js";
import { ensureCommunicationSchema, mapPost } from "./_schema.js";

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ success: false, error: "Binding D1 DB introuvable." }, 500);

    await ensureCommunicationSchema(db);

    const url = new URL(context.request.url);
    const type = String(url.searchParams.get("type") || "").trim();
    const slug = String(url.searchParams.get("slug") || "").trim();
    const featured = url.searchParams.get("featured") === "1";
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));

    const clauses = ["p.status='published'"];
    const values = [];

    if (type) {
      clauses.push(`p.type=?${values.length + 1}`);
      values.push(type);
    }

    if (slug) {
      clauses.push(`p.slug=?${values.length + 1}`);
      values.push(slug);
    }

    if (featured) clauses.push("p.featured=1");

    let stmt = db.prepare(`
      SELECT p.*, u.display_name AS author_name
      FROM communication_posts p
      LEFT JOIN users u ON u.id = p.updated_by
      WHERE ${clauses.join(" AND ")}
      ORDER BY p.sort_order ASC, COALESCE(p.published_at,p.created_at) DESC
      LIMIT ${limit}
    `);

    if (values.length) stmt = stmt.bind(...values);
    const result = await stmt.all();

    return json({ success: true, posts: (result.results || []).map(mapPost) });
  } catch (error) {
    console.error(error);
    return json({ success: false, error: "Impossible de charger les publications." }, 500);
  }
}
