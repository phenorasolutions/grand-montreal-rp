import { json } from "../../_lib/security.js";

export async function onRequestGet(context) {
  try {
    const db=context.env.DB;
    if (!db) return json({success:false,error:"Le binding D1 DB est introuvable."},500);

    const type=new URL(context.request.url).searchParams.get("type");
    const allowed=["vehicle","house","vip"];
    const query=allowed.includes(type)
      ? db.prepare(`SELECT id,type,name,slug,description,price_label,image_url,badge,metadata_json,updated_at
                    FROM marketplace_items WHERE published=1 AND type=?1 ORDER BY updated_at DESC,id DESC`).bind(type)
      : db.prepare(`SELECT id,type,name,slug,description,price_label,image_url,badge,metadata_json,updated_at
                    FROM marketplace_items WHERE published=1 ORDER BY updated_at DESC,id DESC`);
    const result=await query.all();

    return json({success:true,items:(result.results||[]).map(row=>({
      id:row.id,type:row.type,name:row.name,slug:row.slug,description:row.description||"",
      priceLabel:row.price_label||"",imageUrl:row.image_url||"",badge:row.badge||"",
      metadata:row.metadata_json?JSON.parse(row.metadata_json):{},updatedAt:row.updated_at
    }))});
  } catch (error) {
    console.error(error);
    return json({success:false,error:"Impossible de charger le catalogue."},500);
  }
}
