const app=document.querySelector("#pagesApp"),list=document.querySelector("#pageList"),editor=document.querySelector("#editorDialog"),form=document.querySelector("#pageForm"),blocksList=document.querySelector("#blocksList"),mediaDialog=document.querySelector("#mediaDialog"),mediaGrid=document.querySelector("#mediaGrid"),mediaSearch=document.querySelector("#mediaSearch");
let pages=[],blocks=[],mediaAssets=[],dirty=false,currentPage=null,pickerTarget="hero";

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
const id=()=>crypto.randomUUID();

function setDirty(value=true){dirty=value;document.querySelector("#saveState").textContent=value?"Modifications non enregistrées":"Enregistré";}
function renderPages(){
  if(!pages.length){list.innerHTML='<div class="empty-state">Aucune page.</div>';return;}
  list.innerHTML=pages.map(p=>`<article class="page-card"><div><h3>${esc(p.title)}</h3><p>/${esc(p.slug)}</p></div><span class="page-status ${p.status==="published"?"published":""}">${p.status==="published"?"Publié":"Brouillon"}</span><span>Modifié ${esc(fmt(p.updatedAt))}<br>par ${esc(p.updatedBy)}</span><div class="page-actions"><button data-edit="${p.id}">Modifier</button></div></article>`).join("");
}
function blockTemplate(block,index){
  const controls=`<div class="block-head"><strong>${esc(block.type)}</strong><div class="block-actions"><button type="button" data-up="${index}">↑</button><button type="button" data-down="${index}">↓</button><button type="button" data-remove="${index}">×</button></div></div>`;
  let body="";
  if(block.type==="heading") body=`<div class="block-body"><div class="block-row"><select data-field="level" data-index="${index}"><option value="2" ${block.level===2?"selected":""}>H2</option><option value="3" ${block.level===3?"selected":""}>H3</option><option value="4" ${block.level===4?"selected":""}>H4</option></select><input data-field="text" data-index="${index}" value="${esc(block.text||"")}" placeholder="Titre"></div></div>`;
  if(block.type==="paragraph"||block.type==="quote") body=`<div class="block-body"><textarea rows="5" data-field="text" data-index="${index}" placeholder="Texte">${esc(block.text||"")}</textarea></div>`;
  if(block.type==="list") body=`<div class="block-body"><label><input type="checkbox" data-field="ordered" data-index="${index}" ${block.ordered?"checked":""}> Liste numérotée</label><textarea rows="6" data-field="items" data-index="${index}" placeholder="Un élément par ligne">${esc((block.items||[]).join("\n"))}</textarea></div>`;
  if(block.type==="image") body=`<div class="block-body"><input data-field="url" data-index="${index}" value="${esc(block.url||"")}" placeholder="URL image"><input data-field="alt" data-index="${index}" value="${esc(block.alt||"")}" placeholder="Texte alternatif"><input data-field="caption" data-index="${index}" value="${esc(block.caption||"")}" placeholder="Légende"><button type="button" data-pick-image="${index}">Choisir dans la médiathèque</button></div>`;
  if(block.type==="button") body=`<div class="block-body"><input data-field="label" data-index="${index}" value="${esc(block.label||"")}" placeholder="Libellé"><input data-field="url" data-index="${index}" value="${esc(block.url||"")}" placeholder="Lien"><select data-field="style" data-index="${index}"><option value="primary" ${block.style!=="secondary"?"selected":""}>Principal</option><option value="secondary" ${block.style==="secondary"?"selected":""}>Secondaire</option></select></div>`;
  if(block.type==="divider") body='<div class="block-body"><hr></div>';
  return `<article class="content-block">${controls}${body}</article>`;
}
function renderBlocks(){blocksList.innerHTML=blocks.length?blocks.map(blockTemplate).join(""):'<div class="empty-state">Ajoute ton premier bloc.</div>';}
function addBlock(type){
  const base={id:id(),type};
  if(type==="heading")Object.assign(base,{level:2,text:""});
  if(type==="paragraph"||type==="quote")base.text="";
  if(type==="list")Object.assign(base,{ordered:false,items:[]});
  if(type==="image")Object.assign(base,{url:"",alt:"",caption:""});
  if(type==="button")Object.assign(base,{label:"",url:"",style:"primary"});
  blocks.push(base);renderBlocks();setDirty();
}
function heroPreview(){
  const box=document.querySelector("#heroPreview"),url=form.heroImage.value.trim();
  box.textContent=url?"":"Aucune image";
  box.style.backgroundImage=url?`linear-gradient(rgba(0,0,0,.25),rgba(0,0,0,.25)),url('${url.replaceAll("'","%27")}')`:"none";
}
function switchTab(name){document.querySelectorAll(".editor-tab").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));document.querySelectorAll(".editor-panel").forEach(x=>x.classList.toggle("active",x.dataset.panel===name));}
async function openEditor(pageId){
  const data=await request(`/api/pages/${pageId}`);currentPage=data.page;blocks=[...(data.page.blocks||[])];
  form.id.value=data.page.id;form.title.value=data.page.title;form.status.value=data.page.status;form.seoTitle.value=data.page.seoTitle;form.seoDescription.value=data.page.seoDescription;form.heroImage.value=data.page.heroImage;form.heroKicker.value=data.page.heroKicker;form.heroTitle.value=data.page.heroTitle;form.heroSubtitle.value=data.page.heroSubtitle;
  document.querySelector("#editorTitle").textContent=data.page.title;document.querySelector("#revisionsList").innerHTML=data.revisions.length?data.revisions.map(r=>`<div class="revision-row"><strong>Version #${r.id}</strong><span>${esc(fmt(r.createdAt))} · ${esc(r.createdBy)}</span></div>`).join(""):'<div class="empty-state">Aucune version précédente.</div>';
  renderBlocks();heroPreview();switchTab("content");setDirty(false);editor.showModal();
}
function preview(){
  const hero=form.heroImage.value?`style="background-image:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.55)),url('${form.heroImage.value.replaceAll("'","%27")}')"`:"";
  const html=blocks.map(b=>b.type==="heading"?`<h${b.level}>${esc(b.text)}</h${b.level}>`:b.type==="paragraph"?`<p>${esc(b.text)}</p>`:b.type==="quote"?`<blockquote>${esc(b.text)}</blockquote>`:b.type==="list"?`<${b.ordered?"ol":"ul"}>${(b.items||[]).map(i=>`<li>${esc(i)}</li>`).join("")}</${b.ordered?"ol":"ul"}>`:b.type==="image"?`<figure><img src="${esc(b.url)}" alt="${esc(b.alt)}"><figcaption>${esc(b.caption)}</figcaption></figure>`:b.type==="button"?`<p><a class="button" href="${esc(b.url)}">${esc(b.label)}</a></p>`:b.type==="divider"?"<hr>":"").join("");
  document.querySelector("#previewContent").innerHTML=`<section class="preview-hero" ${hero}><div class="preview-hero-content"><small>${esc(form.heroKicker.value)}</small><h1>${esc(form.heroTitle.value||form.title.value)}</h1><p>${esc(form.heroSubtitle.value)}</p></div></section><section class="preview-blocks">${html}</section>`;
  document.querySelector("#previewDialog").showModal();
}
async function openMedia(target){pickerTarget=target;mediaDialog.showModal();mediaGrid.innerHTML='<div class="empty-state">Chargement…</div>';mediaAssets=(await request("/api/media")).assets||[];renderMedia();}
function renderMedia(){const term=mediaSearch.value.trim().toLowerCase(),filtered=mediaAssets.filter(a=>!term||a.originalName.toLowerCase().includes(term)||a.altText.toLowerCase().includes(term));mediaGrid.innerHTML=filtered.length?filtered.map(a=>`<button class="media-card-picker" type="button" data-url="${esc(a.url)}"><img src="${esc(a.url)}" alt=""><span>${esc(a.originalName)}</span></button>`).join(""):'<div class="empty-state">Aucune image.</div>';}

document.querySelector("#newPageButton").onclick=()=>document.querySelector("#newPageDialog").showModal();
document.querySelector("#closeNewPage").onclick=document.querySelector("#cancelNewPage").onclick=()=>document.querySelector("#newPageDialog").close();
document.querySelector("#closeEditor").onclick=()=>{if(!dirty||confirm("Quitter sans enregistrer?"))editor.close();};
document.querySelector("#previewButton").onclick=preview;document.querySelector("#closePreview").onclick=()=>document.querySelector("#previewDialog").close();
document.querySelector("#chooseHeroImage").onclick=()=>openMedia("hero");document.querySelector("#clearHeroImage").onclick=()=>{form.heroImage.value="";heroPreview();setDirty();};
document.querySelector("#closeMediaDialog").onclick=()=>mediaDialog.close();mediaSearch.oninput=renderMedia;
document.querySelectorAll(".editor-tab").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
document.querySelectorAll("[data-add-block]").forEach(b=>b.onclick=()=>addBlock(b.dataset.addBlock));
form.addEventListener("input",()=>setDirty());form.addEventListener("change",()=>setDirty());

blocksList.addEventListener("input",e=>{const i=Number(e.target.dataset.index);if(!Number.isInteger(i)||!blocks[i])return;const f=e.target.dataset.field;if(f==="items")blocks[i][f]=e.target.value.split("\n").map(x=>x.trim()).filter(Boolean);else if(f==="ordered")blocks[i][f]=e.target.checked;else if(f==="level")blocks[i][f]=Number(e.target.value);else blocks[i][f]=e.target.value;setDirty();});
blocksList.addEventListener("click",e=>{const up=e.target.closest("[data-up]"),down=e.target.closest("[data-down]"),remove=e.target.closest("[data-remove]"),pick=e.target.closest("[data-pick-image]");if(up){const i=Number(up.dataset.up);if(i>0)[blocks[i-1],blocks[i]]=[blocks[i],blocks[i-1]];}if(down){const i=Number(down.dataset.down);if(i<blocks.length-1)[blocks[i+1],blocks[i]]=[blocks[i],blocks[i+1]];}if(remove)blocks.splice(Number(remove.dataset.remove),1);if(pick)openMedia(`block:${pick.dataset.pickImage}`);if(up||down||remove){renderBlocks();setDirty();}});
mediaGrid.addEventListener("click",e=>{const card=e.target.closest("[data-url]");if(!card)return;if(pickerTarget==="hero"){form.heroImage.value=card.dataset.url;heroPreview();}else if(pickerTarget.startsWith("block:")){const i=Number(pickerTarget.split(":")[1]);blocks[i].url=card.dataset.url;renderBlocks();}mediaDialog.close();setDirty();});
list.addEventListener("click",e=>{const b=e.target.closest("[data-edit]");if(b)openEditor(Number(b.dataset.edit));});
document.querySelector("#newPageForm").onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,m=document.querySelector("#newPageMessage");try{await request("/api/pages",{method:"POST",body:JSON.stringify({title:f.title.value.trim(),slug:f.slug.value.trim()})});document.querySelector("#newPageDialog").close();await loadPages();f.reset();m.textContent="";}catch(err){m.textContent=err.message;}};
form.onsubmit=async e=>{e.preventDefault();const button=document.querySelector("#savePageButton");button.disabled=true;try{await request(`/api/pages/${form.id.value}`,{method:"PUT",body:JSON.stringify({title:form.title.value.trim(),status:form.status.value,seoTitle:form.seoTitle.value.trim(),seoDescription:form.seoDescription.value.trim(),heroImage:form.heroImage.value.trim(),heroKicker:form.heroKicker.value.trim(),heroTitle:form.heroTitle.value.trim(),heroSubtitle:form.heroSubtitle.value.trim(),blocks})});setDirty(false);document.querySelector("#formMessage").textContent="Page enregistrée.";await loadPages();}catch(err){document.querySelector("#formMessage").textContent=err.message;}finally{button.disabled=false;}};
window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue="";}});
window.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"&&editor.open){e.preventDefault();form.requestSubmit();}});
document.querySelector("#logoutButton").onclick=async()=>{try{await request("/api/auth/logout",{method:"POST",body:"{}"});}finally{location.href="login.html";}};

async function loadPages(){const data=await request("/api/pages");pages=data.pages;renderPages();}
(async()=>{const session=await request("/api/auth/session"),u=session.user;document.querySelector("#staffName").textContent=u.displayName;document.querySelector("#staffRole").textContent=roleName(u.role);document.querySelector("#profileAvatar").textContent=u.displayName.charAt(0).toUpperCase();await loadPages();app.classList.remove("hidden");})().catch(err=>{console.error(err);list.innerHTML=`<div class="empty-state">${esc(err.message)}</div>`;});
