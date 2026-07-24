const app=document.querySelector("#app"),list=document.querySelector("#memberList"),dialog=document.querySelector("#editorDialog"),form=document.querySelector("#editorForm");
let members=[],user=null;

async function api(path,options={}){
  const r=await fetch(path,{credentials:"same-origin",headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  const d=await r.json().catch(()=>({}));
  if(r.status===401){location.href="login.html";throw new Error("Session requise.");}
  if(!r.ok)throw new Error(d.error||"Une erreur est survenue.");
  return d;
}

const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const roleName=r=>({100:"Fondateur",80:"Administrateur",60:"Marketplace",40:"Communication",20:"Lecture seule"}[r]||`Rôle ${r}`);
const fmt=v=>v?new Intl.DateTimeFormat("fr-CA",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Toronto"}).format(new Date(v.replace(" ","T")+"Z")):"Jamais";

function updateDepartmentOptions(){
  const select=document.querySelector("#departmentFilter");
  const current=select.value;
  const departments=[...new Set(members.map(m=>m.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr"));
  select.innerHTML='<option value="">Tous les départements</option>'+departments.map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join("");
  select.value=departments.includes(current)?current:"";
}

function render(){
  const term=document.querySelector("#searchInput").value.trim().toLowerCase();
  const department=document.querySelector("#departmentFilter").value;
  const status=document.querySelector("#statusFilter").value;

  const filtered=members.filter(m=>
    (!department||m.department===department)&&
    (!status||m.status===status)&&
    (!term||m.displayName.toLowerCase().includes(term)||m.roleTitle.toLowerCase().includes(term)||m.department.toLowerCase().includes(term))
  );

  list.innerHTML=filtered.length?filtered.map(m=>`
    <article class="member-row">
      <div class="member-avatar">${m.imageUrl?`<img src="${esc(m.imageUrl)}" alt="">`:""}</div>
      <div><h3>${esc(m.displayName)}</h3><p>${esc(m.roleTitle)}</p></div>
      <span>${esc(m.department)}</span>
      <span class="pill ${m.status}">${m.status==="visible"?"Visible":"Masqué"}</span>
      <span>${esc(fmt(m.updatedAt))}</span>
      <div class="row-actions">
        <button data-edit="${m.id}">Modifier</button>
        ${user.role>=80?`<button data-delete="${m.id}">Supprimer</button>`:""}
      </div>
    </article>`).join(""):'<div class="empty-state">Aucun membre.</div>';
}

function openNew(){
  form.reset();
  form.id.value="";
  form.department.value="Direction";
  form.status.value="visible";
  form.sortOrder.value=0;
  document.querySelector("#dialogTitle").textContent="Ajouter un membre";
  document.querySelector("#formMessage").textContent="";
  dialog.showModal();
}

function openEdit(id){
  const m=members.find(x=>x.id===id);
  if(!m)return;

  form.id.value=m.id;
  form.displayName.value=m.displayName;
  form.roleTitle.value=m.roleTitle;
  form.department.value=m.department;
  form.status.value=m.status;
  form.description.value=m.description;
  form.imageUrl.value=m.imageUrl;
  form.discordName.value=m.discordName;
  form.socialUrl.value=m.socialUrl;
  form.sortOrder.value=m.sortOrder;
  form.featured.checked=m.featured;

  document.querySelector("#dialogTitle").textContent=m.displayName;
  document.querySelector("#formMessage").textContent="";
  dialog.showModal();
}

async function loadMembers(){
  members=(await api("/api/team")).members;
  updateDepartmentOptions();
  render();
}

list.addEventListener("click",async e=>{
  const edit=e.target.closest("[data-edit]");
  const del=e.target.closest("[data-delete]");

  if(edit)openEdit(Number(edit.dataset.edit));

  if(del){
    const m=members.find(x=>x.id===Number(del.dataset.delete));
    if(!m||!confirm(`Supprimer « ${m.displayName} »?`))return;

    try{
      await api(`/api/team/${m.id}`,{method:"DELETE"});
      await loadMembers();
    }catch(err){
      alert(err.message);
    }
  }
});

form.addEventListener("submit",async e=>{
  e.preventDefault();

  const id=Number(form.id.value);
  const payload={
    displayName:form.displayName.value.trim(),
    roleTitle:form.roleTitle.value.trim(),
    department:form.department.value.trim(),
    status:form.status.value,
    description:form.description.value.trim(),
    imageUrl:form.imageUrl.value.trim(),
    discordName:form.discordName.value.trim(),
    socialUrl:form.socialUrl.value.trim(),
    sortOrder:Number(form.sortOrder.value||0),
    featured:form.featured.checked
  };

  try{
    await api(id?`/api/team/${id}`:"/api/team",{
      method:id?"PUT":"POST",
      body:JSON.stringify(payload)
    });
    dialog.close();
    await loadMembers();
  }catch(err){
    document.querySelector("#formMessage").textContent=err.message;
  }
});

document.querySelector("#newButton").onclick=openNew;
document.querySelector("#closeDialog").onclick=document.querySelector("#cancelButton").onclick=()=>dialog.close();
document.querySelector("#departmentFilter").onchange=render;
document.querySelector("#statusFilter").onchange=render;
document.querySelector("#searchInput").oninput=render;
document.querySelector("#logoutButton").onclick=async()=>{
  try{await api("/api/auth/logout",{method:"POST",body:"{}"});}
  finally{location.href="login.html";}
};

(async()=>{
  user=(await api("/api/auth/session")).user;
  document.querySelector("#staffName").textContent=user.displayName;
  document.querySelector("#staffRole").textContent=roleName(user.role);
  document.querySelector("#profileAvatar").textContent=user.displayName.charAt(0).toUpperCase();
  await loadMembers();
  app.classList.remove("hidden");
})().catch(console.error);
