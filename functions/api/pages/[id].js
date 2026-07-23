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
  normalizeBlocks,
  pageSnapshot
} from "./_schema.js";

function parseId(context) {
  const id = Number(context.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);

    await requireSession(db, context.request, 40);
    await ensurePagesSchema(db);

    const id = parseId(context);
    const row = await db.prepare("SELECT * FROM cms_pages WHERE id = ?1 LIMIT 1").bind(id).first();

    if (!row) return json({ success: false, error: "Page introuvable." }, 404);

    const revisions = await db.prepare(
      `SELECT r.id, r.created_at, u.display_name
       FROM cms_page_revisions r
       LEFT JOIN users u ON u.id = r.created_by
       WHERE r.page_id = ?1
       ORDER BY r.id DESC
       LIMIT 20`
    ).bind(id).all();

    return json({
      success: true,
      page: {
        id: Number(row.id),
        ...pageSnapshot(row),
        updatedAt: row.updated_at,
        publishedAt: row.published_at
      },
      revisions: (revisions.results || []).map((revision) => ({
        id: Number(revision.id),
        createdAt: revision.created_at,
        createdBy: revision.display_name || "Système"
      }))
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de charger la page." }, 500);
  }
}

export async function onRequestPut(context) {
  try {
    assertSameOrigin(context.request);

    const db = context.env.DB;
    if (!db) return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);

    const user = await requireSession(db, context.request, 40);
    await ensurePagesSchema(db);

    const id = parseId(context);
    const existing = await db.prepare("SELECT * FROM cms_pages WHERE id = ?1 LIMIT 1").bind(id).first();

    if (!existing) return json({ success: false, error: "Page introuvable." }, 404);

    const body = await context.request.json();
    const title = cleanText(body.title, 120);
    const seoTitle = cleanText(body.seoTitle, 120);
    const seoDescription = cleanText(body.seoDescription, 240);
    const heroImage = cleanText(body.heroImage, 1000);
    const heroKicker = cleanText(body.heroKicker, 100);
    const heroTitle = cleanText(body.heroTitle, 180);
    const heroSubtitle = cleanText(body.heroSubtitle, 400);
    const blocks = normalizeBlocks(body.blocks);
    const status = body.status === "published" ? "published" : "draft";

    if (title.length < 2) {
      return json({ success: false, error: "Le titre est trop court." }, 400);
    }

    if (heroImage && !/^https?:\/\//i.test(heroImage)) {
      return json({ success: false, error: "L'image héro doit être une URL valide." }, 400);
    }

    const snapshot = pageSnapshot(existing);

    await db.prepare(
      `INSERT INTO cms_page_revisions (
        page_id, snapshot_json, created_by
      ) VALUES (?1, ?2, ?3)`
    ).bind(id, JSON.stringify(snapshot), user.id).run();

    await db.prepare(
      `UPDATE cms_pages
       SET title = ?1,
           seo_title = ?2,
           seo_description = ?3,
           hero_image = ?4,
           hero_kicker = ?5,
           hero_title = ?6,
           hero_subtitle = ?7,
           content_json = ?8,
           status = ?9,
           updated_by = ?10,
           updated_at = CURRENT_TIMESTAMP,
           published_at = CASE
             WHEN ?9 = 'published' THEN COALESCE(published_at, CURRENT_TIMESTAMP)
             ELSE published_at
           END
       WHERE id = ?11`
    ).bind(
      title,
      seoTitle,
      seoDescription,
      heroImage,
      heroKicker,
      heroTitle,
      heroSubtitle,
      JSON.stringify(blocks),
      status,
      user.id,
      id
    ).run();

    await db.prepare(
      `DELETE FROM cms_page_revisions
       WHERE page_id = ?1
         AND id NOT IN (
           SELECT id FROM cms_page_revisions
           WHERE page_id = ?1
           ORDER BY id DESC
           LIMIT 30
         )`
    ).bind(id).run();

    await logActivity(db, {
      userId: user.id,
      action: "page_update",
      category: "content",
      details: {
        id,
        slug: existing.slug,
        title,
        status,
        blockCount: blocks.length
      },
      ipAddress: getClientIp(context.request)
    });

    return json({ success: true, updated: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible d'enregistrer la page." }, 500);
  }
}
