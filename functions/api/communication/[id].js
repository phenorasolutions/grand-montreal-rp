import {
  assertSameOrigin,
  getClientIp,
  json,
  logActivity,
  requireSession
} from "../../_lib/security.js";
import { clean, ensureCommunicationSchema, slugify } from "./_schema.js";

const TYPES = new Set(["news", "announcement", "changelog"]);
const LEVELS = new Set(["info", "success", "warning", "danger"]);

function idFrom(context) {
  const id = Number(context.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function onRequestPut(context) {
  try {
    assertSameOrigin(context.request);
    const db = context.env.DB;
    const user = await requireSession(db, context.request, 40);
    await ensureCommunicationSchema(db);

    const id = idFrom(context);
    const current = await db.prepare("SELECT * FROM communication_posts WHERE id=?1").bind(id).first();
    if (!current) return json({ success: false, error: "Publication introuvable." }, 404);

    const body = await context.request.json();
    const type = TYPES.has(body.type) ? body.type : current.type;
    const title = clean(body.title, 160);
    const slug = slugify(body.slug || title);
    const status = body.status === "published" ? "published" : "draft";
    const level = LEVELS.has(body.bannerLevel) ? body.bannerLevel : "info";

    const duplicate = await db.prepare(
      "SELECT id FROM communication_posts WHERE slug=?1 AND id!=?2 LIMIT 1"
    ).bind(slug, id).first();
    if (duplicate) return json({ success: false, error: "Ce slug existe déjà." }, 409);

    await db.prepare(`
      UPDATE communication_posts SET
        type=?1, title=?2, slug=?3, summary=?4, content=?5, image_url=?6,
        category=?7, version=?8, status=?9, featured=?10,
        banner_enabled=?11, banner_level=?12, sort_order=?13,
        published_at=CASE
          WHEN ?9='published' THEN COALESCE(published_at,CURRENT_TIMESTAMP)
          ELSE published_at
        END,
        updated_by=?14, updated_at=CURRENT_TIMESTAMP
      WHERE id=?15
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
      user.id,
      id
    ).run();

    await logActivity(db, {
      userId: user.id,
      action: "communication_update",
      category: "communication",
      details: { id, type, title, status },
      ipAddress: getClientIp(context.request)
    });

    return json({ success: true, updated: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de modifier la publication." }, 500);
  }
}

export async function onRequestDelete(context) {
  try {
    assertSameOrigin(context.request);
    const db = context.env.DB;
    const user = await requireSession(db, context.request, 80);
    await ensureCommunicationSchema(db);

    const id = idFrom(context);
    const current = await db.prepare(
      "SELECT id,type,title FROM communication_posts WHERE id=?1"
    ).bind(id).first();

    if (!current) return json({ success: false, error: "Publication introuvable." }, 404);

    await db.prepare("DELETE FROM communication_posts WHERE id=?1").bind(id).run();

    await logActivity(db, {
      userId: user.id,
      action: "communication_delete",
      category: "communication",
      details: { id, type: current.type, title: current.title },
      ipAddress: getClientIp(context.request)
    });

    return json({ success: true, deleted: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de supprimer la publication." }, 500);
  }
}
