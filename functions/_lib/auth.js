const encoder = new TextEncoder();
const SESSION_COOKIE = "gmrp_session";
const SESSION_HOURS = 24;
const PBKDF2_ITERATIONS = 310000;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

export async function ensureSchema(db) {
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
    `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,
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
    `CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      ip_address TEXT,
      successful INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup
      ON login_attempts(username, ip_address, created_at)`,
    `CREATE TABLE IF NOT EXISTS marketplace_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('vehicle','house','vip')),
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
    )`,
    `CREATE INDEX IF NOT EXISTS idx_marketplace_type_published
      ON marketplace_items(type, published)`
  ];

  for (const sql of statements) {
    await db.prepare(sql).run();
  }
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

export async function hashPassword(password, saltBase64 = null, iterations = PBKDF2_ITERATIONS) {
  const salt = saltBase64 ? base64ToBytes(saltBase64) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations
    },
    keyMaterial,
    256
  );

  return {
    hash: bytesToBase64(new Uint8Array(bits)),
    salt: bytesToBase64(salt),
    iterations
  };
}

export async function verifyPassword(password, user) {
  const result = await hashPassword(
    password,
    user.password_salt,
    user.password_iterations
  );
  return crypto.subtle.timingSafeEqual
    ? crypto.subtle.timingSafeEqual(
        base64ToBytes(result.hash),
        base64ToBytes(user.password_hash)
      )
    : constantTimeEqual(result.hash, user.password_hash);
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index++) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

export function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const values = cookie.split(";").map((part) => part.trim());
  const found = values.find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

export function sessionCookie(token, maxAgeSeconds) {
  const secure = `Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSeconds}`;
  return token
    ? `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${secure}`
    : `${SESSION_COOKIE}=; ${secure}`;
}

export function assertSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return;

  const requestOrigin = new URL(request.url).origin;
  if (origin !== requestOrigin) {
    throw new Response("Forbidden", { status: 403 });
  }
}

export async function createSession(db, request, userId) {
  const rawToken = randomToken(32);
  const tokenHash = await sha256(rawToken);
  const csrfToken = randomToken(24);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();

  await db.prepare(
    `INSERT INTO sessions
      (token_hash, user_id, csrf_token, expires_at, ip_address, user_agent)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  ).bind(
    tokenHash,
    userId,
    csrfToken,
    expiresAt,
    getClientIp(request),
    (request.headers.get("User-Agent") || "").slice(0, 500)
  ).run();

  return {
    rawToken,
    csrfToken,
    cookie: sessionCookie(rawToken, SESSION_HOURS * 60 * 60)
  };
}

export async function deleteSession(db, request) {
  const rawToken = getCookie(request, SESSION_COOKIE);
  if (!rawToken) return;

  const tokenHash = await sha256(rawToken);
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?1")
    .bind(tokenHash)
    .run();
}

export async function getSessionUser(db, request) {
  const rawToken = getCookie(request, SESSION_COOKIE);
  if (!rawToken) return null;

  const tokenHash = await sha256(rawToken);
  const row = await db.prepare(
    `SELECT
       s.token_hash,
       s.csrf_token,
       s.expires_at,
       u.id,
       u.username,
       u.display_name,
       u.role,
       u.active
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?1
       AND s.expires_at > CURRENT_TIMESTAMP
       AND u.active = 1
     LIMIT 1`
  ).bind(tokenHash).first();

  if (!row) return null;

  return {
    sessionTokenHash: row.token_hash,
    csrfToken: row.csrf_token,
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role
  };
}

export async function requireUser(db, request, minimumRole = 20) {
  const user = await getSessionUser(db, request);
  if (!user) {
    throw json({ error: "Session requise." }, 401);
  }
  if (user.role < minimumRole) {
    throw json({ error: "Permission insuffisante." }, 403);
  }
  return user;
}

export async function cleanupExpiredSessions(db) {
  await db.prepare("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP").run();
}

export async function logActivity(db, {
  userId = null,
  action,
  category,
  details = null,
  ipAddress = null
}) {
  await db.prepare(
    `INSERT INTO activity_logs
      (user_id, action, category, details, ip_address)
     VALUES (?1, ?2, ?3, ?4, ?5)`
  ).bind(
    userId,
    action,
    category,
    details ? JSON.stringify(details) : null,
    ipAddress
  ).run();
}
