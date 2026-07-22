import {
  assertSameOrigin,
  getClientIp,
  hashPassword,
  json,
  logActivity,
  requireSession
} from "../../_lib/security.js";

const ALLOWED_ROLES = new Set([20, 40, 60, 80, 100]);

function clean(value, maxLength = 120) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function parseId(context) {
  const id = Number(context.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function onRequestPut(context) {
  try {
    assertSameOrigin(context.request);

    const db = context.env.DB;
    if (!db) return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);

    const actor = await requireSession(db, context.request, 80);
    const id = parseId(context);
    if (!id) return json({ success: false, error: "Identifiant invalide." }, 400);

    const target = await db.prepare(
      `SELECT id, username, display_name, role, active
       FROM users WHERE id = ?1 LIMIT 1`
    ).bind(id).first();

    if (!target) return json({ success: false, error: "Utilisateur introuvable." }, 404);

    const body = await context.request.json();
    const displayName = clean(body.displayName, 60);
    const role = Number(body.role);
    const active = body.active === false ? 0 : 1;
    const newPassword = String(body.newPassword || "");

    if (displayName.length < 2) {
      return json({ success: false, error: "Nom affiché invalide." }, 400);
    }

    if (!ALLOWED_ROLES.has(role)) {
      return json({ success: false, error: "Rôle invalide." }, 400);
    }

    if (Number(target.role) > actor.role || role > actor.role) {
      return json({ success: false, error: "Tu ne peux pas modifier ce compte." }, 403);
    }

    if ((Number(target.role) === 100 || role === 100) && actor.role !== 100) {
      return json({ success: false, error: "Seul le Fondateur peut gérer un compte Fondateur." }, 403);
    }

    if (id === actor.id && (!active || role < actor.role)) {
      return json({ success: false, error: "Tu ne peux pas retirer tes propres accès." }, 400);
    }

    await db.prepare(
      `UPDATE users
       SET display_name = ?1, role = ?2, active = ?3
       WHERE id = ?4`
    ).bind(displayName, role, active, id).run();

    if (newPassword) {
      if (newPassword.length < 12 || newPassword.length > 200) {
        return json({ success: false, error: "Le nouveau mot de passe doit contenir au moins 12 caractères." }, 400);
      }

      const passwordData = await hashPassword(newPassword);

      await db.prepare(
        `UPDATE users
         SET password_hash = ?1,
             password_salt = ?2,
             password_iterations = ?3
         WHERE id = ?4`
      ).bind(
        passwordData.hash,
        passwordData.salt,
        passwordData.iterations,
        id
      ).run();

      await db.prepare("DELETE FROM sessions WHERE user_id = ?1 AND user_id != ?2")
        .bind(id, actor.id)
        .run();
    }

    if (!active) {
      await db.prepare("DELETE FROM sessions WHERE user_id = ?1")
        .bind(id)
        .run();
    }

    await logActivity(db, {
      userId: actor.id,
      action: "user_update",
      category: "users",
      details: {
        id,
        username: target.username,
        displayName,
        role,
        active: Boolean(active),
        passwordReset: Boolean(newPassword)
      },
      ipAddress: getClientIp(context.request)
    });

    return json({ success: true, updated: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de modifier l'utilisateur." }, 500);
  }
}

export async function onRequestDelete(context) {
  try {
    assertSameOrigin(context.request);

    const db = context.env.DB;
    if (!db) return json({ success: false, error: "Le binding D1 DB est introuvable." }, 500);

    const actor = await requireSession(db, context.request, 100);
    const id = parseId(context);

    if (!id) return json({ success: false, error: "Identifiant invalide." }, 400);
    if (id === actor.id) return json({ success: false, error: "Tu ne peux pas désactiver ton propre compte." }, 400);

    const target = await db.prepare(
      "SELECT id, username, display_name, role FROM users WHERE id = ?1 LIMIT 1"
    ).bind(id).first();

    if (!target) return json({ success: false, error: "Utilisateur introuvable." }, 404);
    if (Number(target.role) === 100) {
      return json({ success: false, error: "Un compte Fondateur ne peut pas être désactivé ici." }, 403);
    }

    await db.prepare("UPDATE users SET active = 0 WHERE id = ?1").bind(id).run();
    await db.prepare("DELETE FROM sessions WHERE user_id = ?1").bind(id).run();

    await logActivity(db, {
      userId: actor.id,
      action: "user_disable",
      category: "users",
      details: {
        id,
        username: target.username,
        displayName: target.display_name,
        role: Number(target.role)
      },
      ipAddress: getClientIp(context.request)
    });

    return json({ success: true, disabled: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de désactiver l'utilisateur." }, 500);
  }
}
