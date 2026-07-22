const app=document.querySelector("#marketplaceApp");
const list=document.querySelector("#marketplaceList");
const dialog=document.querySelector("#itemDialog");
const form=document.querySelector("#itemForm");
const formMessage=document.querySelector("#formMessage");
const searchInput=document.querySelector("#searchInput");
let items=[],currentFilter="all";

async function request(path,options={}){
  const response=await fetch(path,{credentials:"same-origin",headers:{"Content-Type":"application/json"},...options});
  const data=await response.json().catch(()=>({}));
  if(response.status===401){window.location.replace("login.html");throw new Error("Session requise.");}
  if(!response.ok)throw new Error(data.error||"Une erreur est survenue.");
  return data;
}
const roleName=(r)=>({100:"Fondateur",80:"Administrateur",60:"Gestionnaire Marketplace",40:"Communication",20:"Lecture seule"}[r]||`Rôle ${r}`);
const typeLabel=(t)=>({vehicle:"Véhicule",house:"Maison",vip:"VIP"}[t]||t);
const escapeHtml=(v)=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

function visibleItems(){
  const search=searchInput.value.trim().toLowerCase();
  return items.filter(item=>(currentFilter==="all"||item.type===currentFilter)&&(!search||item.name.toLowerCase().includes(search)||item.description.toLowerCase().includes(search)));
}
function render(){
  const filtered=visibleItems();
  if(!filtered.length){list.innerHTML='<div class="empty-state">Aucun élément trouvé.</div>';return;}
  list.innerHTML=filtered.map(item=>`
    <article class="marketplace-item">
      ${item.imageUrl?`<img class="item-image" src="${escapeHtml(item.imageUrl)}" alt="">`:'<div class="item-image"></div>'}
      <div class="item-content">
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(typeLabel(item.type))} · ${escapeHtml(item.description||"Aucune description")}</p>
      </div>
      <div class="item-meta">
        <strong>${escapeHtml(item.priceLabel||"Sur demande")}</strong>
        <span class="status ${item.published?"published":"draft"}">${item.published?"Publié":"Brouillon"}</span>
      </div>
      <div class="item-actions">
        <button data-edit="${item.id}">Modifier</button>
        <button class="danger" data-delete="${item.id}">Supprimer</button>
      </div>
    </article>`).join("");
}
function openNew(){
  form.reset();form.id.value="";form.published.checked=true;
  document.querySelector("#dialogTitle").textContent="Ajouter un élément";
  formMessage.textContent="";dialog.showModal();
}
function openEdit(id){
  const item=items.find(x=>x.id===id);if(!item)return;
  form.id.value=item.id;form.type.value=item.type;form.name.value=item.name;
  form.priceLabel.value=item.priceLabel;form.badge.value=item.badge;
  form.imageUrl.value=item.imageUrl;form.description.value=item.description;
  form.published.checked=item.published;
  document.querySelector("#dialogTitle").textContent="Modifier l'élément";
  formMessage.textContent="";dialog.showModal();
}
async function load(){
  const [session,marketplace]=await Promise.all([request("/api/auth/session"),request("/api/marketplace")]);
  const user=session.user;
  document.querySelector("#staffName").textContent=user.displayName;
  document.querySelector("#staffRole").textContent=roleName(user.role);
  document.querySelector("#profileAvatar").textContent=user.displayName.trim().charAt(0).toUpperCase()||"?";
  items=marketplace.items;render();app.classList.remove("hidden");
}

document.querySelector("#newItemButton").addEventListener("click",openNew);
document.querySelector("#closeDialog").addEventListener("click",()=>dialog.close());
document.querySelector("#cancelButton").addEventListener("click",()=>dialog.close());
searchInput.addEventListener("input",render);

document.querySelectorAll(".filter").forEach(button=>button.addEventListener("click",()=>{
  document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));
  button.classList.add("active");currentFilter=button.dataset.filter;render();
}));

list.addEventListener("click",async(event)=>{
  const edit=event.target.closest("[data-edit]");
  const remove=event.target.closest("[data-delete]");
  if(edit){openEdit(Number(edit.dataset.edit));return;}
  if(remove){
    const id=Number(remove.dataset.delete);
    const item=items.find(x=>x.id===id);if(!item)return;
    if(!window.confirm(`Supprimer « ${item.name} »?`))return;
    try{
      await request(`/api/marketplace/${id}`,{method:"DELETE"});
      items=items.filter(x=>x.id!==id);render();
    }catch(error){window.alert(error.message);}
  }
});

form.addEventListener("submit",async(event)=>{
  event.preventDefault();
  const save=document.querySelector("#saveButton");
  save.disabled=true;formMessage.textContent="";
  const payload={
    type:form.type.value,name:form.name.value.trim(),
    priceLabel:form.priceLabel.value.trim(),badge:form.badge.value.trim(),
    imageUrl:form.imageUrl.value.trim(),description:form.description.value.trim(),
    published:form.published.checked,metadata:{}
  };
  try{
    const id=Number(form.id.value);
    await request(id?`/api/marketplace/${id}`:"/api/marketplace",{
      method:id?"PUT":"POST",body:JSON.stringify(payload)
    });
    dialog.close();
    items=(await request("/api/marketplace")).items;render();
  }catch(error){formMessage.textContent=error.message;}
  finally{save.disabled=false;}
});

document.querySelector("#logoutButton").addEventListener("click",async()=>{
  try{await request("/api/auth/logout",{method:"POST",body:"{}"});}
  finally{window.location.replace("login.html");}
});

load().catch(error=>{
  console.error(error);
  list.innerHTML=`<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
