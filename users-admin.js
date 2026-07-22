const app=document.querySelector("#usersApp");
const table=document.querySelector("#usersTable");
const dialog=document.querySelector("#userDialog");
const form=document.querySelector("#userForm");
const message=document.querySelector("#userFormMessage");
const search=document.querySelector("#userSearch");
const roleFilter=document.querySelector("#roleFilter");
let users=[],currentUser=null;

async function request(path,options={}){
  const response=await fetch(path,{credentials:"same-origin",headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  const data=await response.json().catch(()=>({}));
  if(response.status===401){window.location.replace("login.html");throw new Error("Session requise.");}
  if(!response.ok)throw new Error(data.error||"Une erreur est survenue.");
  return data;
}
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const roleName=r=>({100:"Fondateur",80:"Administrateur",60:"Marketplace",40:"Communication",20:"Lecture seule"}[r]||`Rôle ${r}`);
const fmt=v=>v?new Intl.DateTimeFormat("fr-CA",{dateStyle:"medium",timeStyle:"short",timeZone:"America/Toronto"}).format(new Date(v.replace(" ","T")+"Z")):"Jamais";

function render(){
  const term=search.value.trim().toLowerCase();
  const filter=roleFilter.value;
  const filtered=users.filter(u=>(filter==="all"||String(u.role)===filter)&&(!term||u.displayName.toLowerCase().includes(term)||u.username.toLowerCase().includes(term)));

  if(!filtered.length){table.innerHTML='<div class="empty-state">Aucun utilisateur trouvé.</div>';return;}

  table.innerHTML=filtered.map(u=>`
    <article class="user-row">
      <div class="user-main">
        <div class="user-avatar">${esc(u.displayName.charAt(0).toUpperCase()||"?")}</div>
        <div><strong>${esc(u.displayName)}</strong><span>${esc(u.username)}</span></div>
      </div>
      <div class="user-meta"><span class="role-pill">${esc(roleName(u.role))}</span></div>
      <div class="user-meta"><span class="state-pill ${u.active?"active":"inactive"}">${u.active?"Actif":"Désactivé"}</span><span>Dernière connexion : ${esc(fmt(u.lastLogin))}</span></div>
      <div class="row-actions">
        <button data-edit="${u.id}">Modifier</button>
        ${u.id!==currentUser.id&&u.role!==100?`<button data-disable="${u.id}">Désactiver</button>`:""}
      </div>
    </article>`).join("");
}

function openNew(){
  form.reset();form.id.value="";form.active.checked=true;
  form.username.disabled=false;
  document.querySelector("#passwordField").classList.remove("hidden");
  document.querySelector("#newPasswordField").classList.add("hidden");
  document.querySelector("#userDialogTitle").textContent="Ajouter un utilisateur";
  message.textContent="";dialog.showModal();
}

function openEdit(id){
  const user=users.find(x=>x.id===id);if(!user)return;
  form.reset();form.id.value=user.id;form.displayName.value=user.displayName;
  form.username.value=user.username;form.username.disabled=true;
  form.role.value=String(user.role);form.active.checked=user.active;
  document.querySelector("#passwordField").classList.add("hidden");
  document.querySelector("#newPasswordField").classList.remove("hidden");
  document.querySelector("#userDialogTitle").textContent="Modifier l'utilisateur";
  message.textContent="";dialog.showModal();
}

async function load(){
  const [session,data]=await Promise.all([request("/api/auth/session"),request("/api/users")]);
  currentUser=session.user;users=data.users;
  document.querySelector("#staffName").textContent=currentUser.displayName;
  document.querySelector("#staffRole").textContent=roleName(currentUser.role);
  document.querySelector("#profileAvatar").textContent=currentUser.displayName.charAt(0).toUpperCase();
  render();app.classList.remove("hidden");
}

document.querySelector("#newUserButton").addEventListener("click",openNew);
document.querySelector("#closeUserDialog").addEventListener("click",()=>dialog.close());
document.querySelector("#cancelUserButton").addEventListener("click",()=>dialog.close());
search.addEventListener("input",render);roleFilter.addEventListener("change",render);

table.addEventListener("click",async event=>{
  const edit=event.target.closest("[data-edit]");
  const disable=event.target.closest("[data-disable]");
  if(edit){openEdit(Number(edit.dataset.edit));return;}
  if(disable){
    const id=Number(disable.dataset.disable);
    const user=users.find(x=>x.id===id);
    if(!user||!window.confirm(`Désactiver le compte de ${user.displayName}?`))return;
    try{
      await request(`/api/users/${id}`,{method:"DELETE"});
      users=(await request("/api/users")).users;render();
    }catch(error){window.alert(error.message);}
  }
});

form.addEventListener("submit",async event=>{
  event.preventDefault();
  const id=Number(form.id.value);
  const button=document.querySelector("#saveUserButton");
  button.disabled=true;message.textContent="";
  try{
    if(id){
      await request(`/api/users/${id}`,{method:"PUT",body:JSON.stringify({
        displayName:form.displayName.value.trim(),role:Number(form.role.value),
        active:form.active.checked,newPassword:form.newPassword.value
      })});
    }else{
      await request("/api/users",{method:"POST",body:JSON.stringify({
        displayName:form.displayName.value.trim(),username:form.username.value.trim(),
        role:Number(form.role.value),password:form.password.value
      })});
    }
    dialog.close();users=(await request("/api/users")).users;render();
  }catch(error){message.textContent=error.message;}
  finally{button.disabled=false;}
});

document.querySelector("#logoutButton").addEventListener("click",async()=>{
  try{await request("/api/auth/logout",{method:"POST",body:"{}"});}
  finally{window.location.replace("login.html");}
});

load().catch(error=>{console.error(error);table.innerHTML=`<div class="empty-state">${esc(error.message)}</div>`;});
