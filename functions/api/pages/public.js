import { json } from "../../_lib/security.js";
import { ensurePagesSchema, pageSnapshot } from "./_schema.js";

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);

    await ensurePagesSchema(db);

    const slug = String(new URL(context.request.url).searchParams.get("slug") || "").trim().toLowerCase();

    if (!slug) return json({ success: false, error: "Slug requis." }, 400);

    const row = await db.prepare(
      `SELECT * FROM cms_pages
       WHERE slug = ?1 AND status = 'published'
       LIMIT 1`
    ).bind(slug).first();

    if (!row) return json({ success: false, error: "Page non publiée." }, 404);

    return json({
      success: true,
      page: {
        id: Number(row.id),
        ...pageSnapshot(row),
        updatedAt: row.updated_at,
        publishedAt: row.published_at
      }
    });
  } catch (error) {
    console.error(error);
    return json({ success: false, error: "Impossible de charger la page." }, 500);
  }
}
