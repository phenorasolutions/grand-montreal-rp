export async function ensureMarketplaceProSchema(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS marketplace_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      marketplace_item_id INTEGER NOT NULL,
      media_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (marketplace_item_id) REFERENCES marketplace_items(id) ON DELETE CASCADE
    )`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_marketplace_media_item
     ON marketplace_media(marketplace_item_id, sort_order)`
  ).run();
}

export function parseMetadata(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function normalizeGallery(gallery) {
  if (!Array.isArray(gallery)) return [];

  const seen = new Set();
  const result = [];

  for (const entry of gallery) {
    const url = String(
      typeof entry === "string" ? entry : entry?.url || ""
    ).trim();

    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) continue;

    seen.add(url);
    result.push(url.slice(0, 1000));

    if (result.length >= 12) break;
  }

  return result;
}

export async function replaceGallery(db, itemId, gallery) {
  await db.prepare(
    "DELETE FROM marketplace_media WHERE marketplace_item_id = ?1"
  ).bind(itemId).run();

  for (let index = 0; index < gallery.length; index += 1) {
    await db.prepare(
      `INSERT INTO marketplace_media (
        marketplace_item_id,
        media_url,
        sort_order
      ) VALUES (?1, ?2, ?3)`
    ).bind(itemId, gallery[index], index).run();
  }
}

export async function getGallery(db, itemId) {
  const result = await db.prepare(
    `SELECT media_url
     FROM marketplace_media
     WHERE marketplace_item_id = ?1
     ORDER BY sort_order ASC, id ASC`
  ).bind(itemId).all();

  return (result.results || []).map((row) => row.media_url);
}
