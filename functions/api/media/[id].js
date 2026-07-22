import {
  assertSameOrigin,
  getClientIp,
  json,
  logActivity,
  requireSession
} from "../../_lib/security.js";

import { ensureMediaSchema } from "./_schema.js";

export async function onRequestDelete(context) {
  try {
    assertSameOrigin(context.request);

    const db = context.env.DB;
    const bucket = context.env.MEDIA;

    if (!db) {
      return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);
    }

    if (!bucket) {
      return json({ success: false, error: "Le binding R2 MEDIA est introuvable." }, 500);
    }

    const user = await requireSession(db, context.request, 60);
    await ensureMediaSchema(db);

    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return json({ success: false, error: "Identifiant invalide." }, 400);
    }

    const asset = await db.prepare(
      `SELECT id, object_key, original_name
       FROM media_assets
       WHERE id = ?1
       LIMIT 1`
    ).bind(id).first();

    if (!asset) {
      return json({ success: false, error: "Image introuvable." }, 404);
    }

    await bucket.delete(asset.object_key);
    await db.prepare("DELETE FROM media_assets WHERE id = ?1").bind(id).run();

    await logActivity(db, {
      userId: user.id,
      action: "media_delete",
      category: "media",
      details: {
        id,
        objectKey: asset.object_key,
        originalName: asset.original_name
      },
      ipAddress: getClientIp(context.request)
    });

    return json({ success: true, deleted: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de supprimer l'image." }, 500);
  }
}
