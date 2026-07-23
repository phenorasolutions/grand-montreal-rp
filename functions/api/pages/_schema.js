export async function ensurePagesSchema(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS cms_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
      title TEXT NOT NULL,
      seo_title TEXT,
      seo_description TEXT,
      hero_image TEXT,
      hero_kicker TEXT,
      hero_title TEXT,
      hero_subtitle TEXT,
      content_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
      created_by INTEGER,
      updated_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      published_at TEXT,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    )`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS cms_page_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (page_id) REFERENCES cms_pages(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_cms_pages_status
     ON cms_pages(status, updated_at)`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_cms_page_revisions_page
     ON cms_page_revisions(page_id, id DESC)`
  ).run();
}

export async function seedDefaultPages(db, userId = null) {
  const pages = [
    ["accueil", "Accueil"],
    ["vision", "Vision"],
    ["services", "Services"],
    ["economie", "Économie"],
    ["faq", "FAQ"]
  ];

  for (const [slug, title] of pages) {
    await db.prepare(
      `INSERT OR IGNORE INTO cms_pages (
        slug, title, seo_title, seo_description,
        hero_kicker, hero_title, hero_subtitle,
        content_json, status, created_by, updated_by
      ) VALUES (?1, ?2, ?2, '', '', ?2, '', '[]', 'draft', ?3, ?3)`
    ).bind(slug, title, userId).run();
  }
}

export function parseBlocks(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function cleanText(value, maxLength = 5000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function normalizeBlocks(input) {
  if (!Array.isArray(input)) return [];

  const blocks = [];
  const allowed = new Set([
    "heading",
    "paragraph",
    "quote",
    "list",
    "image",
    "button",
    "divider"
  ]);

  for (const raw of input.slice(0, 80)) {
    if (!raw || !allowed.has(raw.type)) continue;

    const block = {
      id: cleanText(raw.id || crypto.randomUUID(), 80),
      type: raw.type
    };

    if (raw.type === "heading") {
      block.level = [2, 3, 4].includes(Number(raw.level)) ? Number(raw.level) : 2;
      block.text = cleanText(raw.text, 300);
    }

    if (raw.type === "paragraph" || raw.type === "quote") {
      block.text = cleanText(raw.text, 5000);
    }

    if (raw.type === "list") {
      block.ordered = Boolean(raw.ordered);
      block.items = Array.isArray(raw.items)
        ? raw.items.map((item) => cleanText(item, 500)).filter(Boolean).slice(0, 30)
        : [];
    }

    if (raw.type === "image") {
      const url = cleanText(raw.url, 1000);
      if (!/^https?:\/\//i.test(url)) continue;
      block.url = url;
      block.alt = cleanText(raw.alt, 250);
      block.caption = cleanText(raw.caption, 500);
    }

    if (raw.type === "button") {
      const url = cleanText(raw.url, 1000);
      if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) continue;
      block.label = cleanText(raw.label, 80);
      block.url = url;
      block.style = raw.style === "secondary" ? "secondary" : "primary";
    }

    blocks.push(block);
  }

  return blocks;
}

export function pageSnapshot(row) {
  return {
    slug: row.slug,
    title: row.title,
    seoTitle: row.seo_title || "",
    seoDescription: row.seo_description || "",
    heroImage: row.hero_image || "",
    heroKicker: row.hero_kicker || "",
    heroTitle: row.hero_title || "",
    heroSubtitle: row.hero_subtitle || "",
    blocks: parseBlocks(row.content_json),
    status: row.status
  };
}
