const app=document.querySelector("#mediaApp");
const grid=document.querySelector("#mediaGrid");
const form=document.querySelector("#uploadForm");
const fileInput=document.querySelector("#fileInput");
const dropZone=document.querySelector("#dropZone");
const message=document.querySelector("#uploadMessage");
const search=document.querySelector("#mediaSearch");
let assets=[];

async function request(path,options={}){
  const response=await fetch(path,{credentials:"same-origin",...options});
  const data=await response.json().catch(()=>({}));
  if(response.status===401){window.location.replace("login.html");throw new Error("Session requise.");}
  if(!response.ok)throw new Error(data.error||"Une erreur est survenue.");
  return data;
}
const escapeHtml=(v)=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const roleName=(r)=>({100:"Fondateur",80:"Administrateur",60:"Gestionnaire Marketplace",40:"Communication",20:"Lecture seule"}[r]||`Rôle ${r}`);
const formatBytes=(n)=>n<1024?`${n} o`:n<1048576?`${(n/1024).toFixed(1)} Ko`:`${(n/1048576).toFixed(1)} Mo`;

function render(){
  const term=search.value.trim().toLowerCase();
  const filtered=assets.filter(a=>!term||a.originalName.toLowerCase().includes(term)||a.altText.toLowerCase().includes(term));
  document.querySelector("#assetCount").textContent=`${assets.length} image${assets.length>1?"s":""}`;

  if(!filtered.length){
    grid.innerHTML='<div class="empty-state">Aucune image trouvée.</div>';
    return;
  }

  grid.innerHTML=filtered.map(asset=>`
    <article class="media-card">
      <img class="media-preview" src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.altText)}">
      <div class="media-body">
        <h3 title="${escapeHtml(asset.originalName)}">${escapeHtml(asset.originalName)}</h3>
        <p>${escapeHtml(asset.altText||"Aucun texte alternatif")}</p>
        <div class="media-meta">
          <span>${escapeHtml(formatBytes(asset.sizeBytes))}</span>
          <span>${escapeHtml(asset.uploadedBy)}</span>
        </div>
        <div class="media-actions">
          <button data-copy="${escapeHtml(asset.url)}">Copier le lien</button>
          <button class="delete" data-delete="${asset.id}">Supprimer</button>
        </div>
      </div>
    </article>`).join("");
}

async function load(){
  const [session,media]=await Promise.all([
    request("/api/auth/session"),
    request("/api/media")
  ]);
  const user=session.user;
  document.querySelector("#staffName").textContent=user.displayName;
  document.querySelector("#staffRole").textContent=roleName(user.role);
  document.querySelector("#profileAvatar").textContent=user.displayName.trim().charAt(0).toUpperCase()||"?";
  assets=media.assets;render();app.classList.remove("hidden");
}

form.addEventListener("submit",async(event)=>{
  event.preventDefault();
  const file=fileInput.files[0];
  if(!file){message.textContent="Choisis une image.";return;}

  const button=document.querySelector("#uploadButton");
  const data=new FormData();
  data.append("file",file);
  data.append("altText",form.altText.value.trim());

  button.disabled=true;message.textContent="Téléversement en cours…";message.classList.remove("success");
  try{
    await request("/api/media",{method:"POST",body:data});
    form.reset();
    message.textContent="Image téléversée avec succès.";
    message.classList.add("success");
    assets=(await request("/api/media")).assets;
    render();
  }catch(error){message.textContent=error.message;}
  finally{button.disabled=false;}
});

["dragenter","dragover"].forEach(name=>dropZone.addEventListener(name,event=>{
  event.preventDefault();dropZone.classList.add("dragging");
}));
["dragleave","drop"].forEach(name=>dropZone.addEventListener(name,event=>{
  event.preventDefault();dropZone.classList.remove("dragging");
}));
dropZone.addEventListener("drop",event=>{
  const file=event.dataTransfer.files[0];
  if(file)fileInput.files=event.dataTransfer.files;
});

search.addEventListener("input",render);

grid.addEventListener("click",async(event)=>{
  const copy=event.target.closest("[data-copy]");
  const remove=event.target.closest("[data-delete]");

  if(copy){
    await navigator.clipboard.writeText(copy.dataset.copy);
    const previous=copy.textContent;copy.textContent="Lien copié";
    setTimeout(()=>copy.textContent=previous,1200);
  }

  if(remove){
    const id=Number(remove.dataset.delete);
    const asset=assets.find(a=>a.id===id);
    if(!asset||!window.confirm(`Supprimer « ${asset.originalName} »?`))return;
    try{
      await request(`/api/media/${id}`,{method:"DELETE"});
      assets=assets.filter(a=>a.id!==id);render();
    }catch(error){window.alert(error.message);}
  }
});

document.querySelector("#logoutButton").addEventListener("click",async()=>{
  try{await request("/api/auth/logout",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});}
  finally{window.location.replace("login.html");}
});

load().catch(error=>{
  console.error(error);
  grid.innerHTML=`<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
