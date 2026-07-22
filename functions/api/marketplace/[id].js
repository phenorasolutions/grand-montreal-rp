import { assertSameOrigin, getClientIp, json, logActivity, requireSession } from "../../_lib/security.js";

const TYPES = ["vehicle","house","vip"];
const clean = (v,n=5000)=>String(v??"").trim().slice(0,n);
const validType = (v)=>TYPES.includes(String(v||"").toLowerCase())?String(v).toLowerCase():null;
const itemId = (context)=>{const id=Number(context.params.id);return Number.isInteger(id)&&id>0?id:null;};

export async function onRequestPut(context) {
  try {
    assertSameOrigin(context.request);
    const db=context.env.DB;
    if (!db) return json({success:false,error:"Le binding D1 DB est introuvable."},500);
    const user=await requireSession(db,context.request,60);
    const id=itemId(context);
    if (!id) return json({success:false,error:"Identifiant invalide."},400);

    const existing=await db.prepare("SELECT id,type,name FROM marketplace_items WHERE id=?1 LIMIT 1").bind(id).first();
    if (!existing) return json({success:false,error:"Élément introuvable."},404);

    const body=await context.request.json();
    const type=validType(body.type), name=clean(body.name,120);
    const description=clean(body.description), priceLabel=clean(body.priceLabel,80);
    const imageUrl=clean(body.imageUrl,1000), badge=clean(body.badge,40);
    const published=body.published===false?0:1;
    const metadata=body.metadata&&typeof body.metadata==="object"?body.metadata:{};

    if (!type||name.length<2) return json({success:false,error:"Catégorie ou nom invalide."},400);
    if (imageUrl&&!/^https?:\/\//i.test(imageUrl)) return json({success:false,error:"L'image doit être une URL HTTP ou HTTPS."},400);

    await db.prepare(
      `UPDATE marketplace_items SET type=?1,name=?2,description=?3,price_label=?4,image_url=?5,
       badge=?6,metadata_json=?7,published=?8,updated_by=?9,updated_at=CURRENT_TIMESTAMP WHERE id=?10`
    ).bind(type,name,description,priceLabel,imageUrl,badge,JSON.stringify(metadata),published,user.id,id).run();

    await logActivity(db,{userId:user.id,action:"marketplace_update",category:"marketplace",
      details:{id,previousName:existing.name,type,name,published:Boolean(published)},ipAddress:getClientIp(context.request)});

    return json({success:true,updated:true});
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({success:false,error:"Impossible de modifier l'élément."},500);
  }
}

export async function onRequestDelete(context) {
  try {
    assertSameOrigin(context.request);
    const db=context.env.DB;
    if (!db) return json({success:false,error:"Le binding D1 DB est introuvable."},500);
    const user=await requireSession(db,context.request,60);
    const id=itemId(context);
    if (!id) return json({success:false,error:"Identifiant invalide."},400);

    const existing=await db.prepare("SELECT id,type,name FROM marketplace_items WHERE id=?1 LIMIT 1").bind(id).first();
    if (!existing) return json({success:false,error:"Élément introuvable."},404);

    await db.prepare("DELETE FROM marketplace_items WHERE id=?1").bind(id).run();
    await logActivity(db,{userId:user.id,action:"marketplace_delete",category:"marketplace",
      details:{id,type:existing.type,name:existing.name},ipAddress:getClientIp(context.request)});

    return json({success:true,deleted:true});
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({success:false,error:"Impossible de supprimer l'élément."},500);
  }
}
