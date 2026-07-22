import {
  assertSameOrigin,
  getClientIp,
  json,
  logActivity,
  requireSession
} from "../../_lib/security.js";

import {
  ensureMarketplaceProSchema,
  getGallery,
  normalizeGallery,
  parseMetadata,
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

function slugify(value) {
  return clean(value, 120)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
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

async function mapRow(db, row) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    slug: row.slug,
    description: row.description || "",
    priceLabel: row.price_label || "",
    imageUrl: row.image_url || "",
    badge: row.badge || "",
    metadata: parseMetadata(row.metadata_json),
    gallery: await getGallery(db, row.id),
    published: Number(row.published) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);
    }

    await requireSession(db, context.request, 20);
    await ensureMarketplaceProSchema(db);

    const requestedType = new URL(context.request.url).searchParams.get("type");
    const type = requestedType ? validType(requestedType) : null;

    const result = type
      ? await db.prepare(
          `SELECT * FROM marketplace_items
           WHERE type = ?1
           ORDER BY
             json_extract(metadata_json, '$.featured') DESC,
             CAST(json_extract(metadata_json, '$.sortOrder') AS INTEGER) ASC,
             updated_at DESC,
             id DESC`
        ).bind(type).all()
      : await db.prepare(
          `SELECT * FROM marketplace_items
           ORDER BY
             json_extract(metadata_json, '$.featured') DESC,
             CAST(json_extract(metadata_json, '$.sortOrder') AS INTEGER) ASC,
             updated_at DESC,
             id DESC`
        ).all();

    const items = [];
    for (const row of result.results || []) {
      items.push(await mapRow(db, row));
    }

    return json({ success: true, items });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de charger le Marketplace." }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    assertSameOrigin(context.request);

    const db = context.env.DB;
    if (!db) {
      return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);
    }

    const user = await requireSession(db, context.request, 60);
    await ensureMarketplaceProSchema(db);

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

    if (!type) {
      return json({ success: false, error: "Catégorie invalide." }, 400);
    }

    if (name.length < 2) {
      return json({ success: false, error: "Le nom doit contenir au moins 2 caractères." }, 400);
    }

    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      return json({ success: false, error: "L'image principale doit être une URL HTTP ou HTTPS." }, 400);
    }

    const baseSlug = slugify(name) || `item-${Date.now()}`;
    let slug = baseSlug;
    let suffix = 2;

    while (
      await db.prepare("SELECT id FROM marketplace_items WHERE slug = ?1 LIMIT 1")
        .bind(slug)
        .first()
    ) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const result = await db.prepare(
      `INSERT INTO marketplace_items (
        type, name, slug, description, price_label, image_url,
        badge, metadata_json, published, created_by, updated_by
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)`
    ).bind(
      type,
      name,
      slug,
      description,
      priceLabel,
      imageUrl,
      badge,
      JSON.stringify(metadata),
      published,
      user.id
    ).run();

    const id = result.meta.last_row_id;
    await replaceGallery(db, id, gallery);

    await logActivity(db, {
      userId: user.id,
      action: "marketplace_create",
      category: "marketplace",
      details: {
        id,
        type,
        name,
        featured: metadata.featured,
        galleryCount: gallery.length,
        published: Boolean(published)
      },
      ipAddress: getClientIp(context.request)
    });

    const row = await db.prepare(
      "SELECT * FROM marketplace_items WHERE id = ?1 LIMIT 1"
    ).bind(id).first();

    return json({
      success: true,
      created: true,
      item: await mapRow(db, row)
    }, 201);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Impossible d'ajouter l'élément."
    }, 500);
  }
}
