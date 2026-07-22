const shopTabs = [...document.querySelectorAll(".shop-tab")];
const shopSections = [...document.querySelectorAll(".shop-section")];

function activateTab(target) {
  shopTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.target === target);
  });

  shopSections.forEach((section) => {
    section.classList.toggle("active", section.id === target);
  });
}

shopTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.target;
    activateTab(target);
    window.history.replaceState(null, "", `#${target}`);
  });
});

const requestedTab = window.location.hash.replace("#", "");
if (["imports", "houses", "vip"].includes(requestedTab)) {
  activateTab(requestedTab);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function imageStyle(url) {
  if (!url) return "";
  const safeUrl = String(url).replaceAll('"', "%22");
  return `style="background-image:linear-gradient(0deg,rgba(7,9,13,.58),rgba(7,9,13,.08)),url('${safeUrl}');background-size:cover;background-position:center;"`;
}

function renderVehicles(items) {
  const grid = document.querySelector("#imports .product-grid");
  if (!grid) return;

  if (!items.length) {
    grid.innerHTML = '<div class="catalog-empty">Aucun véhicule importé n’est publié pour le moment.</div>';
    return;
  }

  grid.innerHTML = items.map((item) => `
    <article class="product-card reveal visible">
      <div class="product-visual" ${imageStyle(item.imageUrl)}>
        ${item.badge ? `<span class="product-badge">${escapeHtml(item.badge)}</span>` : ""}
      </div>
      <div class="product-body">
        <p>VÉHICULE IMPORTÉ</p>
        <h3>${escapeHtml(item.name)}</h3>
        <span>${escapeHtml(item.description || "Consulte le Discord pour obtenir les détails de cet import.")}</span>
        <div class="product-footer">
          <strong>${escapeHtml(item.priceLabel || "Sur demande")}</strong>
          <a href="https://discord.gg/GWDxdWCDM" target="_blank" rel="noopener">Ouvrir un ticket</a>
        </div>
      </div>
    </article>
  `).join("");
}

function renderHouses(items) {
  const grid = document.querySelector("#houses .house-grid");
  if (!grid) return;

  if (!items.length) {
    grid.innerHTML = '<div class="catalog-empty">Aucune maison importée n’est publiée pour le moment.</div>';
    return;
  }

  grid.innerHTML = items.map((item) => `
    <article class="house-card reveal visible">
      <div class="house-visual" ${imageStyle(item.imageUrl)}>
        ${item.badge ? `<span class="product-badge">${escapeHtml(item.badge)}</span>` : ""}
        <div class="house-location">Propriété importée</div>
      </div>
      <div class="house-body">
        <p>MAISON IMPORTÉE</p>
        <h3>${escapeHtml(item.name)}</h3>
        <span>${escapeHtml(item.description || "Consulte le Discord pour obtenir les détails de cette propriété.")}</span>
        <div class="product-footer">
          <strong>${escapeHtml(item.priceLabel || "Sur demande")}</strong>
          <a href="https://discord.gg/GWDxdWCDM" target="_blank" rel="noopener">Ouvrir un ticket</a>
        </div>
      </div>
    </article>
  `).join("");
}

function renderVip(items) {
  const grid = document.querySelector("#vip .vip-grid");
  if (!grid) return;

  if (!items.length) {
    grid.innerHTML = '<div class="catalog-empty">Aucune formule VIP n’est publiée pour le moment.</div>';
    return;
  }

  grid.innerHTML = items.map((item, index) => `
    <article class="vip-card reveal visible ${index === 1 ? "featured" : ""}">
      ${item.badge ? `<div class="vip-ribbon">${escapeHtml(item.badge)}</div>` : ""}
      <div class="vip-level">${String(index + 1).padStart(2, "0")}</div>
      <p>FORMULE VIP</p>
      <h3>${escapeHtml(item.name)}</h3>
      <div class="vip-price">
        <strong>${escapeHtml(item.priceLabel || "Sur demande")}</strong>
      </div>
      <p class="vip-description">${escapeHtml(item.description || "Consulte le Discord pour connaître les avantages de cette formule.")}</p>
      <a class="button ${index === 1 ? "button-primary" : "button-secondary"}"
         href="https://discord.gg/GWDxdWCDM"
         target="_blank"
         rel="noopener">
        Ouvrir un ticket
      </a>
    </article>
  `).join("");
}

async function loadPublicMarketplace() {
  const response = await fetch("/api/marketplace/public", {
    headers: { "Accept": "application/json" }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Impossible de charger le catalogue.");
  }

  const items = Array.isArray(data.items) ? data.items : [];

  renderVehicles(items.filter((item) => item.type === "vehicle"));
  renderHouses(items.filter((item) => item.type === "house"));
  renderVip(items.filter((item) => item.type === "vip"));
}

loadPublicMarketplace().catch((error) => {
  console.error(error);

  document.querySelectorAll(".product-grid, .house-grid, .vip-grid").forEach((grid) => {
    grid.innerHTML = `<div class="catalog-empty">${escapeHtml(error.message)}</div>`;
  });
});
