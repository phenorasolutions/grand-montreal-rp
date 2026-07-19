export async function onRequestGet(context) {
  try {
    const db = context.env.DB;

    if (!db) {
      return Response.json(
        {
          success: false,
          error: "Le binding D1 DB est introuvable."
        },
        { status: 500 }
      );
    }

    const statements = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_iterations INTEGER NOT NULL,
        display_name TEXT NOT NULL,
        role INTEGER NOT NULL DEFAULT 20,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        csrf_token TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        category TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )`,

      `CREATE TABLE IF NOT EXISTS marketplace_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('vehicle', 'house', 'vip')),
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        price_label TEXT,
        image_url TEXT,
        badge TEXT,
        metadata_json TEXT,
        published INTEGER NOT NULL DEFAULT 1,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      )`
    ];

    for (const statement of statements) {
      await db.prepare(statement).run();
    }

    const tables = await db.prepare(
      `SELECT name
       FROM sqlite_schema
       WHERE type = 'table'
         AND name IN ('users', 'sessions', 'activity_logs', 'marketplace_items')
       ORDER BY name`
    ).all();

    return Response.json({
      success: true,
      installed: true,
      message: "Les tables du CMS ont été créées.",
      tables: tables.results.map((row) => row.name)
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        installed: false,
        error: error instanceof Error ? error.message : "Erreur inconnue"
      },
      { status: 500 }
    );
  }
}
