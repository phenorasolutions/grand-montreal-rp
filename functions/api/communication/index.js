import {
  assertSameOrigin,
  getClientIp,
  json,
  logActivity,
  requireSession
} from "../../_lib/security.js";
import { clean, ensureCommunicationSchema, mapPost, slugify } from "./_schema.js";

const TYPES = new Set(["news", "announcement", "changelog"]);
const LEVELS = new Set(["info", "success", "warning", "danger"]);

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ success: false, error: "Binding D1 DB introuvable." }, 500);

    await requireSession(db, context.request, 40);
    await ensureCommunicationSchema(db);

    const result = await db.prepare(`
      SELECT p.*, u.display_name AS author_name
      FROM communication_posts p
      LEFT JOIN users u ON u.id = p.updated_by
      ORDER BY p.sort_order ASC, p.id DESC
    `).all();

    return json({ success: true, posts: (result.results || []).map(mapPost) });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de charger les publications." }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    assertSameOrigin(context.request);
    const db = context.env.DB;
    if (!db) return json({ success: false, error: "Binding D1 DB introuvable." }, 500);

    const user = await requireSession(db, context.request, 40);
    await ensureCommunicationSchema(db);

    const body = await context.request.json();
    const type = TYPES.has(body.type) ? body.type : "news";
    const title = clean(body.title, 160);
    const slug = slugify(body.slug || title);
    const status = body.status === "published" ? "published" : "draft";
    const level = LEVELS.has(body.bannerLevel) ? body.bannerLevel : "info";

    if (title.length < 3 || !slug) {
      return json({ success: false, error: "Titre ou slug invalide." }, 400);
    }

    const existing = await db.prepare(
      "SELECT id FROM communication_posts WHERE slug = ?1 LIMIT 1"
    ).bind(slug).first();
    if (existing) return json({ success: false, error: "Ce slug existe déjà." }, 409);

    const result = await db.prepare(`
      INSERT INTO communication_posts (
        type, title, slug, summary, content, image_url, category, version,
        status, featured, banner_enabled, banner_level, sort_order,
        published_at, created_by, updated_by
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
        ?9, ?10, ?11, ?12, ?13,
        CASE WHEN ?9 = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END,
        ?14, ?14
      )
    `).bind(
      type, title, slug,
      clean(body.summary, 500),
      clean(body.content, 12000),
      clean(body.imageUrl, 1000),
      clean(body.category, 80),
      clean(body.version, 40),
      status,
      body.featured ? 1 : 0,
      body.bannerEnabled && type === "announcement" ? 1 : 0,
      level,
      Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
      user.id
    ).run();

    const id = result.meta.last_row_id;

    await logActivity(db, {
      userId: user.id,
      action: "communication_create",
      category: "communication",
      details: { id, type, title, status },
      ipAddress: getClientIp(context.request)
    });

    return json({ success: true, created: true, id }, 201);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de créer la publication." }, 500);
  }
}
