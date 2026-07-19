import {
  ensureSchema,
  json,
  requireUser
} from "../_lib/auth.js";

export async function onRequestGet(context) {
  try {
    await ensureSchema(context.env.DB);
    const user = await requireUser(context.env.DB, context.request, 20);

    const [users, vehicles, houses, vip] = await Promise.all([
      context.env.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE active = 1").first(),
      context.env.DB.prepare("SELECT COUNT(*) AS total FROM marketplace_items WHERE type = 'vehicle'").first(),
      context.env.DB.prepare("SELECT COUNT(*) AS total FROM marketplace_items WHERE type = 'house'").first(),
      context.env.DB.prepare("SELECT COUNT(*) AS total FROM marketplace_items WHERE type = 'vip'").first()
    ]);

    return json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role
      },
      counts: {
        users: Number(users?.total || 0),
        vehicles: Number(vehicles?.total || 0),
        houses: Number(houses?.total || 0),
        vip: Number(vip?.total || 0)
      }
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ error: "Impossible de charger le dashboard." }, 500);
  }
}
