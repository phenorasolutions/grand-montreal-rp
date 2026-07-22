const app=document.querySelector("#logsApp");
const list=document.querySelector("#logsList");
const categoryFilter=document.querySelector("#categoryFilter");
const search=document.querySelector("#logSearch");
let logs=[];

async function request(path,options={}){
  const response=await fetch(path,{credentials:"same-origin",headers:{"Content-Type":"application/json"},...options});
  const data=await response.json().catch(()=>({}));
  if(response.status===401){window.location.replace("login.html");throw new Error("Session requise.");}
  if(!response.ok)throw new Error(data.error||"Une erreur est survenue.");
  return data;
}
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const roleName=r=>({100:"Fondateur",80:"Administrateur",60:"Marketplace",40:"Communication",20:"Lecture seule"}[r]||`Rôle ${r}`);
const actionLabel=a=>({founder_created:"Création du fondateur",login_success:"Connexion",login_failed:"Connexion refusée",logout:"Déconnexion",marketplace_create:"Ajout Marketplace",marketplace_update:"Modification Marketplace",marketplace_delete:"Suppression Marketplace",media_upload:"Téléversement média",media_delete:"Suppression média",user_create:"Création utilisateur",user_update:"Modification utilisateur",user_disable:"Désactivation utilisateur"}[a]||a.replaceAll("_"," "));
const fmt=v=>new Intl.DateTimeFormat("fr-CA",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Toronto"}).format(new Date(v.replace(" ","T")+"Z"));
const details=d=>{if(!d)return"";if(typeof d==="string")return d;return Object.entries(d).slice(0,5).map(([k,v])=>`${k}: ${String(v)}`).join(" · ");};

function render(){
  const term=search.value.trim().toLowerCase();
  const category=categoryFilter.value;
  const filtered=logs.filter(log=>(!category||log.category===category)&&(!term||actionLabel(log.action).toLowerCase().includes(term)||log.actor.displayName.toLowerCase().includes(term)||details(log.details).toLowerCase().includes(term)));

  if(!filtered.length){list.innerHTML='<div class="empty-state">Aucun journal trouvé.</div>';return;}
  list.innerHTML=filtered.map(log=>`
    <article class="log-row">
      <div class="log-icon">•</div>
      <div class="log-content">
        <strong>${esc(actionLabel(log.action))}</strong>
        <p>${esc(log.actor.displayName)} · ${esc(log.category)}${details(log.details)?` · ${esc(details(log.details))}`:""}</p>
      </div>
      <time class="log-time">${esc(fmt(log.createdAt))}</time>
    </article>`).join("");
}

async function load(){
  const [session,data]=await Promise.all([request("/api/auth/session"),request("/api/logs")]);
  const user=session.user;logs=data.logs;
  document.querySelector("#staffName").textContent=user.displayName;
  document.querySelector("#staffRole").textContent=roleName(user.role);
  document.querySelector("#profileAvatar").textContent=user.displayName.charAt(0).toUpperCase();
  categoryFilter.innerHTML='<option value="">Toutes les catégories</option>'+data.categories.map(c=>`<option value="${esc(c.name)}">${esc(c.name)} (${c.total})</option>`).join("");
  render();app.classList.remove("hidden");
}

categoryFilter.addEventListener("change",render);search.addEventListener("input",render);
document.querySelector("#logoutButton").addEventListener("click",async()=>{
  try{await request("/api/auth/logout",{method:"POST",body:"{}"});}
  finally{window.location.replace("login.html");}
});
load().catch(error=>{console.error(error);list.innerHTML=`<div class="empty-state">${esc(error.message)}</div>`;});
