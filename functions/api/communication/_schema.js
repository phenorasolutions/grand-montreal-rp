export async function ensureCommunicationSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS communication_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('news','announcement','changelog')),
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
      summary TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
      featured INTEGER NOT NULL DEFAULT 0,
      banner_enabled INTEGER NOT NULL DEFAULT 0,
      banner_level TEXT NOT NULL DEFAULT 'info' CHECK(banner_level IN ('info','success','warning','danger')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      published_at TEXT,
      created_by INTEGER,
      updated_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_communication_posts_public
    ON communication_posts(status, type, featured, sort_order, published_at)
  `).run();
}

export function clean(value, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

export function slugify(value) {
  return clean(value, 120)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function mapPost(row) {
  return {
    id: Number(row.id),
    type: row.type,
    title: row.title,
    slug: row.slug,
    summary: row.summary || "",
    content: row.content || "",
    imageUrl: row.image_url || "",
    category: row.category || "",
    version: row.version || "",
    status: row.status,
    featured: Number(row.featured) === 1,
    bannerEnabled: Number(row.banner_enabled) === 1,
    bannerLevel: row.banner_level || "info",
    sortOrder: Number(row.sort_order || 0),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: row.author_name || "Grand Montréal RP"
  };
}
