const shopTabs=[...document.querySelectorAll(".shop-tab")];
const shopSections=[...document.querySelectorAll(".shop-section")];

function activateTab(target){
  shopTabs.forEach(tab=>tab.classList.toggle("active",tab.dataset.target===target));
  shopSections.forEach(section=>section.classList.toggle("active",section.id===target));
}
shopTabs.forEach(tab=>tab.addEventListener("click",()=>{
  activateTab(tab.dataset.target);
  window.history.replaceState(null,"",`#${tab.dataset.target}`);
}));
const requested=window.location.hash.replace("#","");
if(["imports","houses","vip"].includes(requested))activateTab(requested);

const escapeHtml=(v)=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const feature=(label,value)=>value?`<div><strong>${escapeHtml(value)}</strong><small>${escapeHtml(label)}</small></div>`:"";
const progress=(label,value)=>Number(value)>0?`<div class="pro-stat"><span>${escapeHtml(label)}</span><i><b style="width:${Math.min(100,Number(value))}%"></b></i></div>`:"";

function vehicleCard(item){
  const m=item.metadata||{};
  return `<article class="product-card pro-card ${m.featured?"is-featured":""}">
    <div class="product-visual pro-visual" style="${item.imageUrl?`background-image:linear-gradient(0deg,rgba(7,9,13,.65),rgba(7,9,13,.08)),url('${item.imageUrl.replaceAll("'","%27")}')`:""}">
      ${item.badge?`<span class="product-badge">${escapeHtml(item.badge)}</span>`:""}
      ${m.featured?'<span class="featured-badge">Vedette</span>':""}
    </div>
    <div class="product-body">
      <p>${escapeHtml([m.brand,m.model,m.year].filter(Boolean).join(" · ")||"VÉHICULE IMPORTÉ")}</p>
      <h3>${escapeHtml(item.name)}</h3>
      <span>${escapeHtml(item.description||"Consulte le Discord pour obtenir tous les détails.")}</span>
      <div class="pro-specs">
        ${feature("Catégorie",m.category)}
        ${feature("Motricité",m.drivetrain)}
        ${feature("Places",m.seats)}
        ${feature("Vitesse",m.topSpeed)}
      </div>
      <div class="pro-performance">
        ${progress("Accélération",m.acceleration)}
        ${progress("Freinage",m.braking)}
        ${progress("Traction",m.traction)}
      </div>
      ${item.gallery?.length?`<div class="pro-gallery">${item.gallery.slice(0,4).map(url=>`<img src="${escapeHtml(url)}" alt="">`).join("")}</div>`:""}
      <div class="product-footer"><strong>${escapeHtml(item.priceLabel||"Sur demande")}</strong><a href="https://discord.gg/GWDxdWCDM" target="_blank" rel="noopener">Ouvrir un ticket</a></div>
    </div>
  </article>`;
}

function houseCard(item){
  const m=item.metadata||{};
  const amenities=[m.pool&&"Piscine",m.garden&&"Jardin",m.helipad&&"Héliport"].filter(Boolean);
  return `<article class="house-card pro-card ${m.featured?"is-featured":""}">
    <div class="house-visual pro-visual" style="${item.imageUrl?`background-image:linear-gradient(0deg,rgba(7,9,13,.65),rgba(7,9,13,.08)),url('${item.imageUrl.replaceAll("'","%27")}')`:""}">
      ${item.badge?`<span class="product-badge">${escapeHtml(item.badge)}</span>`:""}
      <div class="house-location">${escapeHtml(m.district||"Propriété importée")}</div>
    </div>
    <div class="house-body">
      <p>${escapeHtml(m.style||"MAISON IMPORTÉE")}</p>
      <h3>${escapeHtml(item.name)}</h3>
      <span>${escapeHtml(item.description||"Consulte le Discord pour obtenir tous les détails.")}</span>
      <div class="house-specs">
        ${feature("Chambres",m.bedrooms)}
        ${feature("Salles de bain",m.bathrooms)}
        ${feature("Garage",m.garage)}
      </div>
      ${amenities.length?`<ul class="house-features">${amenities.map(x=>`<li>${escapeHtml(x)}</li>`).join("")}</ul>`:""}
      ${item.gallery?.length?`<div class="pro-gallery">${item.gallery.slice(0,4).map(url=>`<img src="${escapeHtml(url)}" alt="">`).join("")}</div>`:""}
      <div class="product-footer"><strong>${escapeHtml(item.priceLabel||"Sur demande")}</strong><a href="https://discord.gg/GWDxdWCDM" target="_blank" rel="noopener">Ouvrir un ticket</a></div>
    </div>
  </article>`;
}

function vipCard(item,index){
  const m=item.metadata||{};
  const benefits=Array.isArray(m.benefits)?m.benefits:[];
  return `<article class="vip-card ${m.featured?"featured":""}">
    ${item.badge?`<div class="vip-ribbon">${escapeHtml(item.badge)}</div>`:""}
    <div class="vip-level">${String(index+1).padStart(2,"0")}</div>
    <p>FORMULE VIP</p>
    <h3>${escapeHtml(item.name)}</h3>
    <div class="vip-price"><strong>${escapeHtml(item.priceLabel||"Sur demande")}</strong></div>
    <ul>${benefits.map(b=>`<li>${escapeHtml(b)}</li>`).join("")}</ul>
    <p class="vip-description">${escapeHtml(item.description||"Consulte le Discord pour connaître les avantages.")}</p>
    <a class="button ${m.featured?"button-primary":"button-secondary"}" href="https://discord.gg/GWDxdWCDM" target="_blank" rel="noopener">Ouvrir un ticket</a>
  </article>`;
}

function render(items){
  const vehicles=items.filter(x=>x.type==="vehicle");
  const houses=items.filter(x=>x.type==="house");
  const vip=items.filter(x=>x.type==="vip");

  const vehicleGrid=document.querySelector("#imports .product-grid");
  const houseGrid=document.querySelector("#houses .house-grid");
  const vipGrid=document.querySelector("#vip .vip-grid");

  if(vehicleGrid)vehicleGrid.innerHTML=vehicles.length?vehicles.map(vehicleCard).join(""):'<div class="catalog-empty">Aucun véhicule publié.</div>';
  if(houseGrid)houseGrid.innerHTML=houses.length?houses.map(houseCard).join(""):'<div class="catalog-empty">Aucune maison publiée.</div>';
  if(vipGrid)vipGrid.innerHTML=vip.length?vip.map(vipCard).join(""):'<div class="catalog-empty">Aucune formule VIP publiée.</div>';
}

fetch("/api/marketplace/public",{headers:{Accept:"application/json"}})
  .then(async response=>{
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||"Impossible de charger le catalogue.");
    render(data.items||[]);
  })
  .catch(error=>{
    console.error(error);
    document.querySelectorAll(".product-grid,.house-grid,.vip-grid").forEach(grid=>{
      grid.innerHTML=`<div class="catalog-empty">${escapeHtml(error.message)}</div>`;
    });
  });
