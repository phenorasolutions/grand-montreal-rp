import {
  assertSameOrigin,
  getClientIp,
  json,
  logActivity,
  requireSession
} from "../../_lib/security.js";

import { ensureMediaSchema } from "./_schema.js";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

function extensionFor(type) {
  return {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif"
  }[type] || "bin";
}

function cleanText(value, maxLength = 250) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function publicUrl(request, objectKey) {
  const origin = new URL(request.url).origin;
  return `${origin}/api/media/file/${encodeURIComponent(objectKey)}`;
}

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);
    }

    await requireSession(db, context.request, 20);
    await ensureMediaSchema(db);

    const result = await db.prepare(
      `SELECT
         m.id,
         m.object_key,
         m.original_name,
         m.content_type,
         m.size_bytes,
         m.alt_text,
         m.created_at,
         u.display_name AS uploaded_by_name
       FROM media_assets m
       LEFT JOIN users u ON u.id = m.uploaded_by
       ORDER BY m.id DESC`
    ).all();

    const assets = [];

    for (const row of result.results || []) {
      const url = publicUrl(context.request, row.object_key);

      const usage = await db.prepare(
        `SELECT COUNT(*) AS total
         FROM marketplace_items
         WHERE image_url = ?1`
      ).bind(url).first();

      assets.push({
        id: row.id,
        objectKey: row.object_key,
        originalName: row.original_name,
        contentType: row.content_type,
        sizeBytes: Number(row.size_bytes),
        altText: row.alt_text || "",
        uploadedBy: row.uploaded_by_name || "Système",
        createdAt: row.created_at,
        url,
        usedByCount: Number(usage?.total || 0)
      });
    }

    return json({
      success: true,
      assets
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de charger la médiathèque." }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    assertSameOrigin(context.request);

    const db = context.env.DB;
    const bucket = context.env.MEDIA;

    if (!db) {
      return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);
    }

    if (!bucket) {
      return json({
        success: false,
        error: "Le binding R2 MEDIA est introuvable."
      }, 500);
    }

    const user = await requireSession(db, context.request, 60);
    await ensureMediaSchema(db);

    const form = await context.request.formData();
    const file = form.get("file");
    const altText = cleanText(form.get("altText"), 250);

    if (!(file instanceof File)) {
      return json({ success: false, error: "Aucun fichier reçu." }, 400);
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return json({
        success: false,
        error: "Format refusé. Utilise JPG, PNG, WEBP ou GIF."
      }, 400);
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return json({
        success: false,
        error: "L'image doit peser au maximum 8 Mo."
      }, 400);
    }

    const objectKey = `${crypto.randomUUID()}.${extensionFor(file.type)}`;

    await bucket.put(objectKey, file.stream(), {
      httpMetadata: {
        contentType: file.type,
        cacheControl: "public, max-age=31536000, immutable"
      },
      customMetadata: {
        originalName: cleanText(file.name, 200),
        uploadedBy: String(user.id)
      }
    });

    const result = await db.prepare(
      `INSERT INTO media_assets (
         object_key,
         original_name,
         content_type,
         size_bytes,
         alt_text,
         uploaded_by
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    ).bind(
      objectKey,
      cleanText(file.name, 200),
      file.type,
      file.size,
      altText,
      user.id
    ).run();

    const id = result.meta.last_row_id;

    await logActivity(db, {
      userId: user.id,
      action: "media_upload",
      category: "media",
      details: {
        id,
        objectKey,
        originalName: file.name,
        contentType: file.type,
        sizeBytes: file.size
      },
      ipAddress: getClientIp(context.request)
    });

    return json({
      success: true,
      uploaded: true,
      asset: {
        id,
        objectKey,
        originalName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        altText,
        url: publicUrl(context.request, objectKey),
        usedByCount: 0
      }
    }, 201);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Impossible d'envoyer l'image."
    }, 500);
  }
}
