const app = document.querySelector("#marketplaceApp");
const list = document.querySelector("#marketplaceList");
const itemDialog = document.querySelector("#itemDialog");
const mediaDialog = document.querySelector("#mediaPickerDialog");
const form = document.querySelector("#itemForm");
const formMessage = document.querySelector("#formMessage");
const selectedMedia = document.querySelector("#selectedMedia");
const galleryList = document.querySelector("#galleryList");
const mediaPickerGrid = document.querySelector("#mediaPickerGrid");
const mediaPickerSearch = document.querySelector("#mediaPickerSearch");
const searchInput = document.querySelector("#searchInput");

let items = [];
let mediaAssets = [];
let currentFilter = "all";
let gallery = [];
let pickerMode = "main";

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    window.location.replace("login.html");
    throw new Error("Session requise.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Une erreur est survenue.");
  }

  return data;
}

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const roleName = (role) => ({
  100: "Fondateur",
  80: "Administrateur",
  60: "Gestionnaire Marketplace",
  40: "Communication",
  20: "Lecture seule"
}[role] || `Rôle ${role}`);

const typeLabel = (type) => ({
  vehicle: "Véhicule",
  house: "Maison",
  vip: "VIP"
}[type] || type);

function visibleItems() {
  const term = searchInput.value.trim().toLowerCase();

  return items.filter((item) => {
    const typeMatch = currentFilter === "all" || item.type === currentFilter;
    const searchMatch = !term ||
      item.name.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      String(item.metadata?.brand || "").toLowerCase().includes(term) ||
      String(item.metadata?.district || "").toLowerCase().includes(term);

    return typeMatch && searchMatch;
  });
}

function renderItems() {
  const filtered = visibleItems();

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">Aucun élément trouvé.</div>';
    return;
  }

  list.innerHTML = filtered.map((item) => {
    const meta = item.metadata || {};
    const detail = item.type === "vehicle"
      ? [meta.brand, meta.model, meta.year].filter(Boolean).join(" · ")
      : item.type === "house"
        ? [meta.district, meta.style].filter(Boolean).join(" · ")
        : `${(meta.benefits || []).length} avantage(s)`;

    return `
      <article class="marketplace-item">
        ${item.imageUrl
          ? `<img class="item-image" src="${escapeHtml(item.imageUrl)}" alt="">`
          : '<div class="item-image"></div>'}

        <div class="item-content">
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(typeLabel(item.type))}${detail ? ` · ${escapeHtml(detail)}` : ""}</p>
          <div class="item-flags">
            ${meta.featured ? '<span class="flag featured">Vedette</span>' : ""}
            <span class="flag ${item.published ? "published" : ""}">
              ${item.published ? "Publié" : "Brouillon"}
            </span>
            ${item.gallery.length ? `<span class="flag">${item.gallery.length} photo(s)</span>` : ""}
          </div>
        </div>

        <div class="item-meta">
          <strong>${escapeHtml(item.priceLabel || "Sur demande")}</strong>
          <small>Ordre ${Number(meta.sortOrder || 0)}</small>
        </div>

        <div class="item-actions">
          <button data-edit="${item.id}">Modifier</button>
          <button data-delete="${item.id}">Supprimer</button>
        </div>
      </article>
    `;
  }).join("");
}

function switchConditionalFields(type) {
  document.querySelector("#vehicleFields").classList.toggle("hidden", type !== "vehicle");
  document.querySelector("#houseFields").classList.toggle("hidden", type !== "house");
  document.querySelector("#vipFields").classList.toggle("hidden", type !== "vip");
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === name);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === name);
  });
}

function renderMainMedia() {
  const url = form.imageUrl.value.trim();

  selectedMedia.innerHTML = url
    ? `<img src="${escapeHtml(url)}" alt="">`
    : "<span>Aucune image</span>";
}

function renderGallery() {
  if (!gallery.length) {
    galleryList.innerHTML = '<div class="empty-state">Aucune image dans la galerie.</div>';
    return;
  }

  galleryList.innerHTML = gallery.map((url, index) => `
    <article class="gallery-card">
      <img src="${escapeHtml(url)}" alt="">
      <footer>
        <button type="button" data-gallery-up="${index}" ${index === 0 ? "disabled" : ""}>↑</button>
        <button type="button" data-gallery-down="${index}" ${index === gallery.length - 1 ? "disabled" : ""}>↓</button>
        <button type="button" data-gallery-remove="${index}">×</button>
      </footer>
    </article>
  `).join("");
}

function clearForm() {
  form.reset();
  form.id.value = "";
  form.imageUrl.value = "";
  gallery = [];
  form.sortOrder.value = "0";
  form.availability.value = "available";
  form.published.checked = true;
  switchConditionalFields("vehicle");
  switchTab("general");
  renderMainMedia();
  renderGallery();
  formMessage.textContent = "";
}

function fillForm(item) {
  clearForm();

  const meta = item.metadata || {};

  form.id.value = item.id;
  form.type.value = item.type;
  form.name.value = item.name;
  form.priceLabel.value = item.priceLabel;
  form.badge.value = item.badge;
  form.description.value = item.description;
  form.imageUrl.value = item.imageUrl;
  form.sortOrder.value = Number(meta.sortOrder || 0);
  form.availability.value = meta.availability || "available";
  form.featured.checked = Boolean(meta.featured);
  form.published.checked = item.published;
  form.tags.value = Array.isArray(meta.tags) ? meta.tags.join(", ") : "";

  form.brand.value = meta.brand || "";
  form.model.value = meta.model || "";
  form.year.value = meta.year || "";
  form.vehicleCategory.value = meta.category || "";
  form.transmission.value = meta.transmission || "";
  form.drivetrain.value = meta.drivetrain || "";
  form.seats.value = meta.seats || "";
  form.topSpeed.value = meta.topSpeed || "";
  form.acceleration.value = meta.acceleration || "";
  form.braking.value = meta.braking || "";
  form.traction.value = meta.traction || "";

  form.district.value = meta.district || "";
  form.houseStyle.value = meta.style || "";
  form.bedrooms.value = meta.bedrooms || "";
  form.bathrooms.value = meta.bathrooms || "";
  form.garage.value = meta.garage || "";
  form.pool.checked = Boolean(meta.pool);
  form.garden.checked = Boolean(meta.garden);
  form.helipad.checked = Boolean(meta.helipad);

  form.benefits.value = Array.isArray(meta.benefits) ? meta.benefits.join("\n") : "";
  form.accent.value = meta.accent || "";

  gallery = Array.isArray(item.gallery) ? [...item.gallery] : [];

  switchConditionalFields(item.type);
  renderMainMedia();
  renderGallery();
}

function buildMetadata() {
  const common = {
    featured: form.featured.checked,
    sortOrder: Number(form.sortOrder.value || 0),
    availability: form.availability.value,
    tags: form.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean)
  };

  if (form.type.value === "vehicle") {
    return {
      ...common,
      brand: form.brand.value.trim(),
      model: form.model.value.trim(),
      year: form.year.value.trim(),
      category: form.vehicleCategory.value.trim(),
      transmission: form.transmission.value.trim(),
      drivetrain: form.drivetrain.value.trim(),
      seats: Number(form.seats.value || 0),
      topSpeed: form.topSpeed.value.trim(),
      acceleration: Number(form.acceleration.value || 0),
      braking: Number(form.braking.value || 0),
      traction: Number(form.traction.value || 0)
    };
  }

  if (form.type.value === "house") {
    return {
      ...common,
      district: form.district.value.trim(),
      style: form.houseStyle.value.trim(),
      bedrooms: Number(form.bedrooms.value || 0),
      bathrooms: Number(form.bathrooms.value || 0),
      garage: Number(form.garage.value || 0),
      pool: form.pool.checked,
      garden: form.garden.checked,
      helipad: form.helipad.checked
    };
  }

  return {
    ...common,
    benefits: form.benefits.value.split("\n").map((line) => line.trim()).filter(Boolean),
    accent: form.accent.value.trim()
  };
}

function openNew() {
  clearForm();
  document.querySelector("#dialogTitle").textContent = "Ajouter un élément";
  itemDialog.showModal();
}

function openEdit(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  fillForm(item);
  document.querySelector("#dialogTitle").textContent = "Modifier l'élément";
  itemDialog.showModal();
}

function renderMediaPicker() {
  const term = mediaPickerSearch.value.trim().toLowerCase();
  const filtered = mediaAssets.filter((asset) => {
    return !term ||
      asset.originalName.toLowerCase().includes(term) ||
      asset.altText.toLowerCase().includes(term);
  });

  if (!filtered.length) {
    mediaPickerGrid.innerHTML = '<div class="empty-state">Aucune image trouvée.</div>';
    return;
  }

  mediaPickerGrid.innerHTML = filtered.map((asset) => `
    <button type="button" class="media-picker-card" data-media-url="${escapeHtml(asset.url)}">
      <img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.altText)}">
      <div><strong>${escapeHtml(asset.originalName)}</strong></div>
    </button>
  `).join("");
}

async function openMediaPicker(mode) {
  pickerMode = mode;
  mediaPickerSearch.value = "";
  mediaPickerGrid.innerHTML = '<div class="empty-state">Chargement…</div>';
  mediaDialog.showModal();

  try {
    mediaAssets = (await request("/api/media")).assets || [];
    renderMediaPicker();
  } catch (error) {
    mediaPickerGrid.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

async function load() {
  const [session, marketplace] = await Promise.all([
    request("/api/auth/session"),
    request("/api/marketplace")
  ]);

  const user = session.user;
  document.querySelector("#staffName").textContent = user.displayName;
  document.querySelector("#staffRole").textContent = roleName(user.role);
  document.querySelector("#profileAvatar").textContent =
    user.displayName.trim().charAt(0).toUpperCase() || "?";

  items = marketplace.items || [];
  renderItems();
  app.classList.remove("hidden");
}

document.querySelector("#newItemButton").addEventListener("click", openNew);
document.querySelector("#closeDialog").addEventListener("click", () => itemDialog.close());
document.querySelector("#cancelButton").addEventListener("click", () => itemDialog.close());
document.querySelector("#closeMediaPicker").addEventListener("click", () => mediaDialog.close());
document.querySelector("#chooseMainMedia").addEventListener("click", () => openMediaPicker("main"));
document.querySelector("#addGalleryMedia").addEventListener("click", () => openMediaPicker("gallery"));

form.type.addEventListener("change", () => switchConditionalFields(form.type.value));
searchInput.addEventListener("input", renderItems);
mediaPickerSearch.addEventListener("input", renderMediaPicker);

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((entry) => entry.classList.remove("active"));
    button.classList.add("active");
    currentFilter = button.dataset.filter;
    renderItems();
  });
});

mediaPickerGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-media-url]");
  if (!card) return;

  const url = card.dataset.mediaUrl;

  if (pickerMode === "main") {
    form.imageUrl.value = url;
    renderMainMedia();
  } else if (!gallery.includes(url) && gallery.length < 12) {
    gallery.push(url);
    renderGallery();
  }

  mediaDialog.close();
});

galleryList.addEventListener("click", (event) => {
  const up = event.target.closest("[data-gallery-up]");
  const down = event.target.closest("[data-gallery-down]");
  const remove = event.target.closest("[data-gallery-remove]");

  if (up) {
    const index = Number(up.dataset.galleryUp);
    [gallery[index - 1], gallery[index]] = [gallery[index], gallery[index - 1]];
  }

  if (down) {
    const index = Number(down.dataset.galleryDown);
    [gallery[index + 1], gallery[index]] = [gallery[index], gallery[index + 1]];
  }

  if (remove) {
    gallery.splice(Number(remove.dataset.galleryRemove), 1);
  }

  renderGallery();
});

list.addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit]");
  const remove = event.target.closest("[data-delete]");

  if (edit) {
    openEdit(Number(edit.dataset.edit));
    return;
  }

  if (remove) {
    const id = Number(remove.dataset.delete);
    const item = items.find((entry) => entry.id === id);

    if (!item || !window.confirm(`Supprimer « ${item.name} »?`)) return;

    try {
      await request(`/api/marketplace/${id}`, { method: "DELETE" });
      items = items.filter((entry) => entry.id !== id);
      renderItems();
    } catch (error) {
      window.alert(error.message);
    }
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const saveButton = document.querySelector("#saveButton");
  saveButton.disabled = true;
  formMessage.textContent = "";

  const payload = {
    type: form.type.value,
    name: form.name.value.trim(),
    priceLabel: form.priceLabel.value.trim(),
    badge: form.badge.value.trim(),
    description: form.description.value.trim(),
    imageUrl: form.imageUrl.value.trim(),
    gallery,
    published: form.published.checked,
    metadata: buildMetadata()
  };

  try {
    const id = Number(form.id.value);

    await request(id ? `/api/marketplace/${id}` : "/api/marketplace", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });

    itemDialog.close();
    items = (await request("/api/marketplace")).items || [];
    renderItems();
  } catch (error) {
    formMessage.textContent = error.message;
  } finally {
    saveButton.disabled = false;
  }
});

document.querySelector("#logoutButton").addEventListener("click", async () => {
  try {
    await request("/api/auth/logout", { method: "POST", body: "{}" });
  } finally {
    window.location.replace("login.html");
  }
});

load().catch((error) => {
  console.error(error);
  list.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
