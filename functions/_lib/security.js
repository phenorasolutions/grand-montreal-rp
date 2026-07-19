const encoder = new TextEncoder();

export const SESSION_COOKIE = "gmrp_session";
export const SESSION_DURATION_SECONDS = 24 * 60 * 60;

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function randomBytes(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function randomToken(length = 32) {
  return bytesToBase64(randomBytes(length))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(value)
  );

  return bytesToBase64(new Uint8Array(digest));
}

export async function hashPassword(password, iterations = 100000, saltBase64 = null) {
  const salt = saltBase64
    ? base64ToBytes(saltBase64)
    : randomBytes(16);

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
  const candidate = await hashPassword(
    password,
    Number(user.password_iterations),
    user.password_salt
  );

  return constantTimeEqual(candidate.hash, user.password_hash);
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

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

export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

export function assertSameOrigin(request) {
  const origin = request.headers.get("Origin");

  if (!origin) {
    return;
  }

  const expectedOrigin = new URL(request.url).origin;

  if (origin !== expectedOrigin) {
    throw json(
      {
        success: false,
        error: "Origine de requête refusée."
      },
      403
    );
  }
}

export function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";

  for (const item of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = item.trim().split("=");

    if (cookieName === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

export function createSessionCookie(rawToken) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(rawToken)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${SESSION_DURATION_SECONDS}`
  ].join("; ");
}

export function clearSessionCookie() {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Max-Age=0"
  ].join("; ");
}

export async function createSession(db, request, userId) {
  const rawToken = randomToken(32);
  const tokenHash = await sha256(rawToken);
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_SECONDS * 1000
  ).toISOString();

  await db.prepare(
    `INSERT INTO sessions (
      token_hash,
      user_id,
      csrf_token,
      expires_at,
      ip_address,
      user_agent
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  ).bind(
    tokenHash,
    userId,
    randomToken(24),
    expiresAt,
    getClientIp(request),
    String(request.headers.get("User-Agent") || "").slice(0, 500)
  ).run();

  return {
    rawToken,
    cookie: createSessionCookie(rawToken)
  };
}

export async function getSessionUser(db, request) {
  const rawToken = getCookie(request, SESSION_COOKIE);

  if (!rawToken) {
    return null;
  }

  const tokenHash = await sha256(rawToken);

  const row = await db.prepare(
    `SELECT
      s.token_hash,
      s.expires_at,
      u.id,
      u.username,
      u.display_name,
      u.role,
      u.active
    FROM sessions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?1
      AND s.expires_at > CURRENT_TIMESTAMP
      AND u.active = 1
    LIMIT 1`
  ).bind(tokenHash).first();

  if (!row) {
    return null;
  }

  return {
    tokenHash: row.token_hash,
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: Number(row.role)
  };
}

export async function deleteCurrentSession(db, request) {
  const rawToken = getCookie(request, SESSION_COOKIE);

  if (!rawToken) {
    return;
  }

  const tokenHash = await sha256(rawToken);

  await db.prepare(
    "DELETE FROM sessions WHERE token_hash = ?1"
  ).bind(tokenHash).run();
}

export async function requireSession(db, request, minimumRole = 20) {
  const user = await getSessionUser(db, request);

  if (!user) {
    throw json(
      {
        success: false,
        error: "Session requise."
      },
      401
    );
  }

  if (user.role < minimumRole) {
    throw json(
      {
        success: false,
        error: "Permission insuffisante."
      },
      403
    );
  }

  return user;
}

export async function logActivity(db, {
  userId = null,
  action,
  category,
  details = null,
  ipAddress = null
}) {
  await db.prepare(
    `INSERT INTO activity_logs (
      user_id,
      action,
      category,
      details,
      ip_address
    ) VALUES (?1, ?2, ?3, ?4, ?5)`
  ).bind(
    userId,
    action,
    category,
    details ? JSON.stringify(details) : null,
    ipAddress
  ).run();
}
