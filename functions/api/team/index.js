import {
  assertSameOrigin,
  getClientIp,
  json,
  logActivity,
  requireSession
} from "../../_lib/security.js";
import { clean, ensureTeamSchema, mapMember } from "./_schema.js";

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({ success: false, error: "Binding D1 DB introuvable." }, 500);

    await requireSession(db, context.request, 40);
    await ensureTeamSchema(db);

    const result = await db.prepare(`
      SELECT t.*, u.display_name AS updated_by_name
      FROM team_members t
      LEFT JOIN users u ON u.id = t.updated_by
      ORDER BY t.department ASC, t.sort_order ASC, t.id ASC
    `).all();

    return json({ success: true, members: (result.results || []).map(mapMember) });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de charger l'équipe." }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    assertSameOrigin(context.request);

    const db = context.env.DB;
    if (!db) return json({ success: false, error: "Binding D1 DB introuvable." }, 500);

    const user = await requireSession(db, context.request, 40);
    await ensureTeamSchema(db);

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

    const result = await db.prepare(`
      INSERT INTO team_members (
        display_name, role_title, department, description, image_url,
        discord_name, social_url, status, featured, sort_order,
        created_by, updated_by
      ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11)
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
      user.id
    ).run();

    const id = result.meta.last_row_id;

    await logActivity(db, {
      userId: user.id,
      action: "team_member_create",
      category: "team",
      details: { id, displayName, roleTitle, department },
      ipAddress: getClientIp(context.request)
    });

    return json({ success: true, created: true, id }, 201);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ success: false, error: "Impossible de créer le membre." }, 500);
  }
}
