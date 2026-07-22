import {
  assertSameOrigin,
  getClientIp,
  json,
  logActivity,
  requireSession
} from "../../_lib/security.js";

import {
  ensureMarketplaceProSchema,
  normalizeGallery,
  replaceGallery
} from "./_schema.js";

const TYPES = ["vehicle", "house", "vip"];

function clean(value, maxLength = 5000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function validType(value) {
  const type = String(value || "").toLowerCase();
  return TYPES.includes(type) ? type : null;
}

function parseId(context) {
  const id = Number(context.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeMetadata(type, input = {}) {
  const metadata = input && typeof input === "object" ? input : {};

  const common = {
    featured: Boolean(metadata.featured),
    sortOrder: Math.max(0, Math.min(9999, Number(metadata.sortOrder) || 0)),
    availability: clean(metadata.availability || "available", 30),
    tags: Array.isArray(metadata.tags)
      ? metadata.tags.map((tag) => clean(tag, 30)).filter(Boolean).slice(0, 12)
      : []
  };

  if (type === "vehicle") {
    return {
      ...common,
      brand: clean(metadata.brand, 60),
      model: clean(metadata.model, 60),
      year: clean(metadata.year, 10),
      category: clean(metadata.category, 50),
      transmission: clean(metadata.transmission, 30),
      drivetrain: clean(metadata.drivetrain, 30),
      seats: Math.max(0, Math.min(20, Number(metadata.seats) || 0)),
      topSpeed: clean(metadata.topSpeed, 30),
      acceleration: Math.max(0, Math.min(100, Number(metadata.acceleration) || 0)),
      braking: Math.max(0, Math.min(100, Number(metadata.braking) || 0)),
      traction: Math.max(0, Math.min(100, Number(metadata.traction) || 0))
    };
  }

  if (type === "house") {
    return {
      ...common,
      district: clean(metadata.district, 80),
      bedrooms: Math.max(0, Math.min(50, Number(metadata.bedrooms) || 0)),
      bathrooms: Math.max(0, Math.min(50, Number(metadata.bathrooms) || 0)),
      garage: Math.max(0, Math.min(100, Number(metadata.garage) || 0)),
      pool: Boolean(metadata.pool),
      garden: Boolean(metadata.garden),
      helipad: Boolean(metadata.helipad),
      style: clean(metadata.style, 50)
    };
  }

  return {
    ...common,
    benefits: Array.isArray(metadata.benefits)
      ? metadata.benefits.map((benefit) => clean(benefit, 140)).filter(Boolean).slice(0, 20)
      : [],
    accent: clean(metadata.accent, 20)
  };
}

export async function onRequestPut(context) {
  try {
    assertSameOrigin(context.request);

    const db = context.env.DB;
    if (!db) {
      return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);
    }

    const user = await requireSession(db, context.request, 60);
    await ensureMarketplaceProSchema(db);

    const id = parseId(context);
    if (!id) {
      return json({ success: false, error: "Identifiant invalide." }, 400);
    }

    const existing = await db.prepare(
      "SELECT id, type, name FROM marketplace_items WHERE id = ?1 LIMIT 1"
    ).bind(id).first();

    if (!existing) {
      return json({ success: false, error: "Élément introuvable." }, 404);
    }

    const body = await context.request.json();
    const type = validType(body.type);
    const name = clean(body.name, 120);
    const description = clean(body.description, 5000);
    const priceLabel = clean(body.priceLabel, 80);
    const imageUrl = clean(body.imageUrl, 1000);
    const badge = clean(body.badge, 40);
    const published = body.published === false ? 0 : 1;
    const metadata = normalizeMetadata(type, body.metadata);
    const gallery = normalizeGallery(body.gallery);

    if (!type || name.length < 2) {
      return json({ success: false, error: "Catégorie ou nom invalide." }, 400);
    }

    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      return json({ success: false, error: "L'image principale doit être une URL HTTP ou HTTPS." }, 400);
    }

    await db.prepare(
      `UPDATE marketplace_items
       SET type = ?1,
           name = ?2,
           description = ?3,
           price_label = ?4,
           image_url = ?5,
           badge = ?6,
           metadata_json = ?7,
           published = ?8,
           updated_by = ?9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?10`
    ).bind(
      type,
      name,
      description,
      priceLabel,
      imageUrl,
      badge,
      JSON.stringify(metadata),
      published,
      user.id,
      id
    ).run();

    await replaceGallery(db, id, gallery);

    await logActivity(db, {
      userId: user.id,
      action: "marketplace_update",
      category: "marketplace",
      details: {
        id,
        previousName: existing.name,
        type,
        name,
        featured: metadata.featured,
        galleryCount: gallery.length,
        published: Boolean(published)
      },
      ipAddress: getClientIp(context.request)
    });

    return json({ success: true, updated: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Impossible de modifier l'élément."
    }, 500);
  }
}

export async function onRequestDelete(context) {
  try {
    assertSameOrigin(context.request);

    const db = context.env.DB;
    if (!db) {
      return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);
    }

    const user = await requireSession(db, context.request, 60);
    await ensureMarketplaceProSchema(db);

    const id = parseId(context);
    if (!id) {
      return json({ success: false, error: "Identifiant invalide." }, 400);
    }

    const existing = await db.prepare(
      "SELECT id, type, name FROM marketplace_items WHERE id = ?1 LIMIT 1"
    ).bind(id).first();

    if (!existing) {
      return json({ success: false, error: "Élément introuvable." }, 404);
    }

    await db.prepare(
      "DELETE FROM marketplace_media WHERE marketplace_item_id = ?1"
    ).bind(id).run();

    await db.prepare(
      "DELETE FROM marketplace_items WHERE id = ?1"
    ).bind(id).run();

    await logActivity(db, {
      userId: user.id,
      action: "marketplace_delete",
      category: "marketplace",
      details: {
        id,
        type: existing.type,
        name: existing.name
      },
      ipAddress: getClientIp(context.request)
    });

    return json({ success: true, deleted: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de supprimer l'élément." }, 500);
  }
}
