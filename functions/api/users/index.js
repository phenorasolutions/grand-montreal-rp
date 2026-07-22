import {
  assertSameOrigin,
  getClientIp,
  hashPassword,
  json,
  logActivity,
  normalizeUsername,
  requireSession
} from "../../_lib/security.js";

const ALLOWED_ROLES = new Set([20, 40, 60, 80, 100]);

function clean(value, maxLength = 120) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function validUsername(username) {
  return /^[a-z0-9._-]{3,40}$/.test(username);
}

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);

    await requireSession(db, context.request, 80);

    const result = await db.prepare(
      `SELECT id, username, display_name, role, active, created_at, last_login
       FROM users
       ORDER BY role DESC, active DESC, display_name COLLATE NOCASE ASC`
    ).all();

    return json({
      success: true,
      users: (result.results || []).map((row) => ({
        id: Number(row.id),
        username: row.username,
        displayName: row.display_name,
        role: Number(row.role),
        active: Number(row.active) === 1,
        createdAt: row.created_at,
        lastLogin: row.last_login
      }))
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de charger les utilisateurs." }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    assertSameOrigin(context.request);

    const db = context.env.DB;
    if (!db) return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);

    const actor = await requireSession(db, context.request, 80);
    const body = await context.request.json();

    const username = normalizeUsername(body.username);
    const displayName = clean(body.displayName, 60);
    const password = String(body.password || "");
    const role = Number(body.role);

    if (!validUsername(username)) {
      return json({ success: false, error: "Identifiant invalide." }, 400);
    }

    if (displayName.length < 2) {
      return json({ success: false, error: "Le nom affiché doit contenir au moins 2 caractères." }, 400);
    }

    if (password.length < 12 || password.length > 200) {
      return json({ success: false, error: "Le mot de passe doit contenir au moins 12 caractères." }, 400);
    }

    if (!ALLOWED_ROLES.has(role)) {
      return json({ success: false, error: "Rôle invalide." }, 400);
    }

    if (role > actor.role || (role === 100 && actor.role !== 100)) {
      return json({ success: false, error: "Tu ne peux pas attribuer ce rôle." }, 403);
    }

    const existing = await db.prepare(
      "SELECT id FROM users WHERE username = ?1 LIMIT 1"
    ).bind(username).first();

    if (existing) {
      return json({ success: false, error: "Cet identifiant existe déjà." }, 409);
    }

    const passwordData = await hashPassword(password);

    const result = await db.prepare(
      `INSERT INTO users (
        username, password_hash, password_salt, password_iterations,
        display_name, role, active
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)`
    ).bind(
      username,
      passwordData.hash,
      passwordData.salt,
      passwordData.iterations,
      displayName,
      role
    ).run();

    const id = result.meta.last_row_id;

    await logActivity(db, {
      userId: actor.id,
      action: "user_create",
      category: "users",
      details: { id, username, displayName, role },
      ipAddress: getClientIp(context.request)
    });

    return json({
      success: true,
      created: true,
      user: { id, username, displayName, role, active: true }
    }, 201);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de créer l'utilisateur." }, 500);
  }
}
