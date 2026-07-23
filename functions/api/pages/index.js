import {
  assertSameOrigin,
  getClientIp,
  json,
  logActivity,
  requireSession
} from "../../_lib/security.js";

import {
  cleanText,
  ensurePagesSchema,
  pageSnapshot,
  seedDefaultPages
} from "./_schema.js";

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);

    const user = await requireSession(db, context.request, 40);
    await ensurePagesSchema(db);
    await seedDefaultPages(db, user.id);

    const result = await db.prepare(
      `SELECT
         p.*,
         u.display_name AS updated_by_name,
         (
           SELECT COUNT(*)
           FROM cms_page_revisions r
           WHERE r.page_id = p.id
         ) AS revision_count
       FROM cms_pages p
       LEFT JOIN users u ON u.id = p.updated_by
       ORDER BY p.id ASC`
    ).all();

    return json({
      success: true,
      pages: (result.results || []).map((row) => ({
        id: Number(row.id),
        ...pageSnapshot(row),
        updatedAt: row.updated_at,
        publishedAt: row.published_at,
        updatedBy: row.updated_by_name || "Système",
        revisionCount: Number(row.revision_count || 0)
      }))
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de charger les pages." }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    assertSameOrigin(context.request);

    const db = context.env.DB;
    if (!db) return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);

    const user = await requireSession(db, context.request, 80);
    await ensurePagesSchema(db);

    const body = await context.request.json();
    const slug = cleanText(body.slug, 80)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const title = cleanText(body.title, 120);

    if (!slug || title.length < 2) {
      return json({ success: false, error: "Slug ou titre invalide." }, 400);
    }

    const existing = await db.prepare(
      "SELECT id FROM cms_pages WHERE slug = ?1 LIMIT 1"
    ).bind(slug).first();

    if (existing) {
      return json({ success: false, error: "Cette page existe déjà." }, 409);
    }

    const result = await db.prepare(
      `INSERT INTO cms_pages (
        slug, title, seo_title, seo_description,
        hero_kicker, hero_title, hero_subtitle,
        content_json, status, created_by, updated_by
      ) VALUES (?1, ?2, ?2, '', '', ?2, '', '[]', 'draft', ?3, ?3)`
    ).bind(slug, title, user.id).run();

    const id = result.meta.last_row_id;

    await logActivity(db, {
      userId: user.id,
      action: "page_create",
      category: "content",
      details: { id, slug, title },
      ipAddress: getClientIp(context.request)
    });

    return json({ success: true, created: true, page: { id, slug, title } }, 201);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de créer la page." }, 500);
  }
}
