import { assertSameOrigin, getClientIp, json, logActivity, requireSession } from "../../_lib/security.js";

const TYPES = ["vehicle", "house", "vip"];
const clean = (v, n=5000) => String(v ?? "").trim().slice(0,n);
const validType = (v) => TYPES.includes(String(v||"").toLowerCase()) ? String(v).toLowerCase() : null;
const slugify = (v) => clean(v,120).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90);

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) return json({success:false,error:"Le binding D1 DB est introuvable."},500);
    await requireSession(db, context.request, 20);

    const type = validType(new URL(context.request.url).searchParams.get("type"));
    const query = type
      ? db.prepare("SELECT * FROM marketplace_items WHERE type=?1 ORDER BY updated_at DESC,id DESC").bind(type)
      : db.prepare("SELECT * FROM marketplace_items ORDER BY updated_at DESC,id DESC");
    const result = await query.all();

    return json({success:true,items:(result.results||[]).map(row=>({
      id:row.id,type:row.type,name:row.name,slug:row.slug,
      description:row.description||"",priceLabel:row.price_label||"",
      imageUrl:row.image_url||"",badge:row.badge||"",
      metadata:row.metadata_json?JSON.parse(row.metadata_json):{},
      published:Number(row.published)===1,
      createdAt:row.created_at,updatedAt:row.updated_at
    }))});
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({success:false,error:"Impossible de charger le Marketplace."},500);
  }
}

export async function onRequestPost(context) {
  try {
    assertSameOrigin(context.request);
    const db = context.env.DB;
    if (!db) return json({success:false,error:"Le binding D1 DB est introuvable."},500);
    const user = await requireSession(db, context.request, 60);
    const body = await context.request.json();

    const type = validType(body.type);
    const name = clean(body.name,120);
    const description = clean(body.description);
    const priceLabel = clean(body.priceLabel,80);
    const imageUrl = clean(body.imageUrl,1000);
    const badge = clean(body.badge,40);
    const published = body.published === false ? 0 : 1;
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

    if (!type) return json({success:false,error:"Catégorie invalide."},400);
    if (name.length < 2) return json({success:false,error:"Le nom doit contenir au moins 2 caractères."},400);
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) return json({success:false,error:"L'image doit être une URL HTTP ou HTTPS."},400);

    const base = slugify(name) || `item-${Date.now()}`;
    let slug = base, suffix = 2;
    while (await db.prepare("SELECT id FROM marketplace_items WHERE slug=?1 LIMIT 1").bind(slug).first()) {
      slug = `${base}-${suffix++}`;
    }

    const result = await db.prepare(
      `INSERT INTO marketplace_items
      (type,name,slug,description,price_label,image_url,badge,metadata_json,published,created_by,updated_by)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10)`
    ).bind(type,name,slug,description,priceLabel,imageUrl,badge,JSON.stringify(metadata),published,user.id).run();

    const id = result.meta.last_row_id;
    await logActivity(db,{
      userId:user.id,action:"marketplace_create",category:"marketplace",
      details:{id,type,name,published:Boolean(published)},ipAddress:getClientIp(context.request)
    });

    return json({success:true,created:true,item:{id,type,name,slug,description,priceLabel,imageUrl,badge,metadata,published:Boolean(published)}},201);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({success:false,error:"Impossible d'ajouter l'élément."},500);
  }
}
