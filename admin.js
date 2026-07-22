const dashboard=document.querySelector("#dashboard");
async function request(path,options={}){
  const response=await fetch(path,{credentials:"same-origin",headers:{"Content-Type":"application/json"},...options});
  const data=await response.json().catch(()=>({}));
  if(response.status===401){window.location.replace("login.html");throw new Error("Session requise.");}
  if(!response.ok)throw new Error(data.error||"Une erreur est survenue.");
  return data;
}
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const roleName=r=>({100:"Fondateur",80:"Administrateur",60:"Gestionnaire Marketplace",40:"Communication",20:"Lecture seule"}[r]||`Rôle ${r}`);
const fmt=v=>v?new Intl.DateTimeFormat("fr-CA",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Toronto"}).format(new Date(v.replace(" ","T")+"Z")):"Jamais";
const label=a=>({founder_created:"Création du fondateur",login_success:"Connexion réussie",login_failed:"Connexion refusée",logout:"Déconnexion",marketplace_create:"Ajout Marketplace",marketplace_update:"Modification Marketplace",marketplace_delete:"Suppression Marketplace",media_upload:"Téléversement média",media_delete:"Suppression média",user_create:"Création utilisateur",user_update:"Modification utilisateur",user_disable:"Désactivation utilisateur"}[a]||a.replaceAll("_"," "));

function renderActivity(actions){
  const list=document.querySelector("#activityList");
  document.querySelector("#activityCount").textContent=`${actions.length} action${actions.length>1?"s":""}`;
  if(!actions.length){list.innerHTML='<div class="empty-state">Aucune activité.</div>';return;}
  list.innerHTML=actions.map(item=>`
    <article class="activity-item">
      <div class="activity-icon">•</div>
      <div class="activity-content"><strong>${esc(label(item.action))}</strong><p>${esc(item.actor.displayName)} · ${esc(item.category)}</p></div>
      <time class="activity-time">${esc(fmt(item.createdAt))}</time>
    </article>`).join("");
}

async function load(){
  const data=await request("/api/dashboard");
  const user=data.user,role=roleName(user.role);
  document.querySelector("#welcomeName").textContent=user.displayName;
  document.querySelector("#staffName").textContent=user.displayName;
  document.querySelector("#staffRole").textContent=role;
  document.querySelector("#profileAvatar").textContent=user.displayName.charAt(0).toUpperCase();
  ["vehicles","houses","vip","users","published","drafts","featured","media"].forEach(key=>document.querySelector(`#${key}`).textContent=data.counts[key]);
  document.querySelector("#accountName").textContent=user.displayName;
  document.querySelector("#accountRole").textContent=role;
  document.querySelector("#lastLogin").textContent=fmt(user.lastLogin);
  document.querySelector("#createdAt").textContent=fmt(user.createdAt);
  renderActivity(data.recentActions||[]);
  dashboard.classList.remove("hidden");
}
document.querySelector("#logoutButton").addEventListener("click",async()=>{
  try{await request("/api/auth/logout",{method:"POST",body:"{}"});}
  finally{window.location.replace("login.html");}
});
load().catch(console.error);
