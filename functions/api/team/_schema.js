export async function ensureTeamSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL,
      role_title TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT 'Direction',
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      discord_name TEXT NOT NULL DEFAULT '',
      social_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','hidden')),
      featured INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER,
      updated_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_team_members_public
    ON team_members(status, department, sort_order, id)
  `).run();
}

export function clean(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

export function mapMember(row) {
  return {
    id: Number(row.id),
    displayName: row.display_name,
    roleTitle: row.role_title,
    department: row.department,
    description: row.description || "",
    imageUrl: row.image_url || "",
    discordName: row.discord_name || "",
    socialUrl: row.social_url || "",
    status: row.status,
    featured: Number(row.featured) === 1,
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by_name || "Système"
  };
}
