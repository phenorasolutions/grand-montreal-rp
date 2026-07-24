const app=document.querySelector("#app"),list=document.querySelector("#postList"),dialog=document.querySelector("#editorDialog"),form=document.querySelector("#editorForm");
let posts=[],user=null;

async function api(path,options={}){
  const r=await fetch(path,{credentials:"same-origin",headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  const d=await r.json().catch(()=>({}));
  if(r.status===401){location.href="login.html";throw new Error("Session requise.");}
  if(!r.ok)throw new Error(d.error||"Une erreur est survenue.");
  return d;
}
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const typeName=t=>({news:"Actualité",announcement:"Annonce",changelog:"Changelog"}[t]||t);
const roleName=r=>({100:"Fondateur",80:"Administrateur",60:"Marketplace",40:"Communication",20:"Lecture seule"}[r]||`Rôle ${r}`);
const fmt=v=>v?new Intl.DateTimeFormat("fr-CA",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Toronto"}).format(new Date(v.replace(" ","T")+"Z")):"Jamais";

function render(){
  const term=document.querySelector("#searchInput").value.trim().toLowerCase();
  const type=document.querySelector("#typeFilter").value;
  const status=document.querySelector("#statusFilter").value;
  const filtered=posts.filter(p=>(!type||p.type===type)&&(!status||p.status===status)&&(!term||p.title.toLowerCase().includes(term)||p.summary.toLowerCase().includes(term)));
  list.innerHTML=filtered.length?filtered.map(p=>`
    <article class="post-row">
      <div><h3>${esc(p.title)}</h3><p>${esc(p.summary||"Aucun résumé")}</p></div>
      <span>${esc(typeName(p.type))}</span>
      <span class="pill ${p.status}">${p.status==="published"?"Publié":"Brouillon"}</span>
      <span>${esc(fmt(p.updatedAt))}</span>
      <div class="row-actions"><button data-edit="${p.id}">Modifier</button>${user.role>=80?`<button data-delete="${p.id}">Supprimer</button>`:""}</div>
    </article>`).join(""):'<div class="empty-state">Aucune publication.</div>';
}

function openNew(){
  form.reset();form.id.value="";form.sortOrder.value=0;form.status.value="draft";document.querySelector("#dialogTitle").textContent="Nouvelle publication";document.querySelector("#formMessage").textContent="";dialog.showModal();
}
function openEdit(id){
  const p=posts.find(x=>x.id===id);if(!p)return;
  form.id.value=p.id;form.type.value=p.type;form.status.value=p.status;form.title.value=p.title;form.slug.value=p.slug;form.category.value=p.category;form.version.value=p.version;form.summary.value=p.summary;form.content.value=p.content;form.imageUrl.value=p.imageUrl;form.sortOrder.value=p.sortOrder;form.bannerLevel.value=p.bannerLevel;form.featured.checked=p.featured;form.bannerEnabled.checked=p.bannerEnabled;
  document.querySelector("#dialogTitle").textContent=p.title;document.querySelector("#formMessage").textContent="";dialog.showModal();
}

async function loadPosts(){posts=(await api("/api/communication")).posts;render();}

list.addEventListener("click",async e=>{
  const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]");
  if(edit)openEdit(Number(edit.dataset.edit));
  if(del){
    const p=posts.find(x=>x.id===Number(del.dataset.delete));
    if(!p||!confirm(`Supprimer « ${p.title} »?`))return;
    try{await api(`/api/communication/${p.id}`,{method:"DELETE"});await loadPosts();}catch(err){alert(err.message);}
  }
});

form.addEventListener("submit",async e=>{
  e.preventDefault();
  const id=Number(form.id.value);
  const payload={type:form.type.value,status:form.status.value,title:form.title.value.trim(),slug:form.slug.value.trim(),category:form.category.value.trim(),version:form.version.value.trim(),summary:form.summary.value.trim(),content:form.content.value.trim(),imageUrl:form.imageUrl.value.trim(),sortOrder:Number(form.sortOrder.value||0),bannerLevel:form.bannerLevel.value,featured:form.featured.checked,bannerEnabled:form.bannerEnabled.checked};
  try{
    await api(id?`/api/communication/${id}`:"/api/communication",{method:id?"PUT":"POST",body:JSON.stringify(payload)});
    dialog.close();await loadPosts();
  }catch(err){document.querySelector("#formMessage").textContent=err.message;}
});

document.querySelector("#newButton").onclick=openNew;
document.querySelector("#closeDialog").onclick=document.querySelector("#cancelButton").onclick=()=>dialog.close();
["#typeFilter","#statusFilter"].forEach(s=>document.querySelector(s).onchange=render);
document.querySelector("#searchInput").oninput=render;
document.querySelector("#logoutButton").onclick=async()=>{try{await api("/api/auth/logout",{method:"POST",body:"{}"});}finally{location.href="login.html";}};

(async()=>{
  user=(await api("/api/auth/session")).user;
  document.querySelector("#staffName").textContent=user.displayName;
  document.querySelector("#staffRole").textContent=roleName(user.role);
  document.querySelector("#profileAvatar").textContent=user.displayName.charAt(0).toUpperCase();
  await loadPosts();app.classList.remove("hidden");
})().catch(console.error);
