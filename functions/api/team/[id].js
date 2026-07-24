import {
  assertSameOrigin,
  getClientIp,
  json,
  logActivity,
  requireSession
} from "../../_lib/security.js";
import { clean, ensureTeamSchema } from "./_schema.js";

function parseId(context) {
  const id = Number(context.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function onRequestPut(context) {
  try {
    assertSameOrigin(context.request);

    const db = context.env.DB;
    const user = await requireSession(db, context.request, 40);
    await ensureTeamSchema(db);

    const id = parseId(context);
    const current = await db.prepare(
      "SELECT * FROM team_members WHERE id=?1 LIMIT 1"
    ).bind(id).first();

    if (!current) return json({ success: false, error: "Membre introuvable." }, 404);

    const body = await context.request.json();

    const displayName = clean(body.displayName, 120);
    const roleTitle = clean(body.roleTitle, 120);
    const department = clean(body.department, 100) || "Direction";
    const imageUrl = clean(body.imageUrl, 1000);
    const socialUrl = clean(body.socialUrl, 1000);

    if (displayName.length < 2 || roleTitle.length < 2) {
      return json({ success: false, error: "Le nom et le rôle sont obligatoires." }, 400);
    }

    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      return json({ success: false, error: "L'URL de l'image est invalide." }, 400);
    }

    if (socialUrl && !/^https?:\/\//i.test(socialUrl)) {
      return json({ success: false, error: "Le lien social est invalide." }, 400);
    }

    await db.prepare(`
      UPDATE team_members SET
        display_name=?1,
        role_title=?2,
        department=?3,
        description=?4,
        image_url=?5,
        discord_name=?6,
        social_url=?7,
        status=?8,
        featured=?9,
        sort_order=?10,
        updated_by=?11,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?12
    `).bind(
      displayName,
      roleTitle,
      department,
      clean(body.description, 2000),
      imageUrl,
      clean(body.discordName, 120),
      socialUrl,
      body.status === "hidden" ? "hidden" : "visible",
      body.featured ? 1 : 0,
      Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
      user.id,
      id
    ).run();

    await logActivity(db, {
      userId: user.id,
      action: "team_member_update",
      category: "team",
      details: { id, displayName, roleTitle, department },
      ipAddress: getClientIp(context.request)
    });

    return json({ success: true, updated: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de modifier le membre." }, 500);
  }
}

export async function onRequestDelete(context) {
  try {
    assertSameOrigin(context.request);

    const db = context.env.DB;
    const user = await requireSession(db, context.request, 80);
    await ensureTeamSchema(db);

    const id = parseId(context);
    const current = await db.prepare(
      "SELECT id,display_name,role_title FROM team_members WHERE id=?1"
    ).bind(id).first();

    if (!current) return json({ success: false, error: "Membre introuvable." }, 404);

    await db.prepare("DELETE FROM team_members WHERE id=?1").bind(id).run();

    await logActivity(db, {
      userId: user.id,
      action: "team_member_delete",
      category: "team",
      details: {
        id,
        displayName: current.display_name,
        roleTitle: current.role_title
      },
      ipAddress: getClientIp(context.request)
    });

    return json({ success: true, deleted: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de supprimer le membre." }, 500);
  }
}
