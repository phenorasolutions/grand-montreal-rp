import { json } from "../../_lib/security.js";

import {
  ensureMarketplaceProSchema,
  getGallery,
  parseMetadata
} from "./_schema.js";

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;

    if (!db) {
      return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);
    }

    await ensureMarketplaceProSchema(db);

    const type = new URL(context.request.url).searchParams.get("type");
    const allowed = ["vehicle", "house", "vip"];

    const result = allowed.includes(type)
      ? await db.prepare(
          `SELECT *
           FROM marketplace_items
           WHERE published = 1 AND type = ?1
           ORDER BY
             json_extract(metadata_json, '$.featured') DESC,
             CAST(json_extract(metadata_json, '$.sortOrder') AS INTEGER) ASC,
             updated_at DESC,
             id DESC`
        ).bind(type).all()
      : await db.prepare(
          `SELECT *
           FROM marketplace_items
           WHERE published = 1
           ORDER BY
             type ASC,
             json_extract(metadata_json, '$.featured') DESC,
             CAST(json_extract(metadata_json, '$.sortOrder') AS INTEGER) ASC,
             updated_at DESC,
             id DESC`
        ).all();

    const items = [];

    for (const row of result.results || []) {
      items.push({
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
        updatedAt: row.updated_at
      });
    }

    return json({ success: true, items });
  } catch (error) {
    console.error(error);
    return json({
      success: false,
      error: "Impossible de charger le catalogue."
    }, 500);
  }
}
