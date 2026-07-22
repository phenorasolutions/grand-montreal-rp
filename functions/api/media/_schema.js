export async function ensureMediaSchema(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS media_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      object_key TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      alt_text TEXT,
      uploaded_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    )`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_media_assets_created_at
     ON media_assets(created_at)`
  ).run();
}
