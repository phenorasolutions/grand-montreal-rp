const app = document.querySelector("#marketplaceApp");
const list = document.querySelector("#marketplaceList");
const dialog = document.querySelector("#itemDialog");
const form = document.querySelector("#itemForm");
const formMessage = document.querySelector("#formMessage");
const searchInput = document.querySelector("#searchInput");

const mediaPickerDialog = document.querySelector("#mediaPickerDialog");
const mediaPickerGrid = document.querySelector("#mediaPickerGrid");
const mediaPickerSearch = document.querySelector("#mediaPickerSearch");
const selectedMedia = document.querySelector("#selectedMedia");

let items = [];
let mediaAssets = [];
let currentFilter = "all";

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

function roleName(role) {
  return {
    100: "Fondateur",
    80: "Administrateur",
    60: "Gestionnaire Marketplace",
    40: "Communication",
    20: "Lecture seule"
  }[role] || `Rôle ${role}`;
}

function typeLabel(type) {
  return {
    vehicle: "Véhicule",
    house: "Maison",
    vip: "VIP"
  }[type] || type;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function visibleItems() {
  const search = searchInput.value.trim().toLowerCase();

  return items.filter((item) => {
    const filterMatch = currentFilter === "all" || item.type === currentFilter;
    const searchMatch = !search ||
      item.name.toLowerCase().includes(search) ||
      item.description.toLowerCase().includes(search);

    return filterMatch && searchMatch;
  });
}

function renderItems() {
  const filtered = visibleItems();

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">Aucun élément trouvé.</div>';
    return;
  }

  list.innerHTML = filtered.map((item) => `
    <article class="marketplace-item">
      ${
        item.imageUrl
          ? `<img class="item-image" src="${escapeHtml(item.imageUrl)}" alt="">`
          : '<div class="item-image"></div>'
      }

      <div class="item-content">
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(typeLabel(item.type))} · ${escapeHtml(item.description || "Aucune description")}</p>
      </div>

      <div class="item-meta">
        <strong>${escapeHtml(item.priceLabel || "Sur demande")}</strong>
        <span class="status ${item.published ? "published" : "draft"}">
          ${item.published ? "Publié" : "Brouillon"}
        </span>
      </div>

      <div class="item-actions">
        <button data-edit="${item.id}">Modifier</button>
        <button class="danger" data-delete="${item.id}">Supprimer</button>
      </div>
    </article>
  `).join("");
}

function updateSelectedMedia() {
  const url = form.imageUrl.value.trim();

  if (!url) {
    selectedMedia.innerHTML = '<div class="selected-media-empty">Aucune image sélectionnée</div>';
    return;
  }

  const asset = mediaAssets.find((entry) => entry.url === url);
  const title = asset?.originalName || "Image sélectionnée";

  selectedMedia.innerHTML = `
    <img src="${escapeHtml(url)}" alt="${escapeHtml(title)}">
  `;
}

function openNewDialog() {
  form.reset();
  form.id.value = "";
  form.imageUrl.value = "";
  form.published.checked = true;
  document.querySelector("#dialogTitle").textContent = "Ajouter un élément";
  formMessage.textContent = "";
  updateSelectedMedia();
  dialog.showModal();
}

function openEditDialog(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  form.id.value = item.id;
  form.type.value = item.type;
  form.name.value = item.name;
  form.priceLabel.value = item.priceLabel;
  form.badge.value = item.badge;
  form.imageUrl.value = item.imageUrl;
  form.description.value = item.description;
  form.published.checked = item.published;

  document.querySelector("#dialogTitle").textContent = "Modifier l'élément";
  formMessage.textContent = "";
  updateSelectedMedia();
  dialog.showModal();
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
    <button class="media-picker-card ${asset.usedByCount > 0 ? "in-use" : ""}"
            type="button"
            data-media-url="${escapeHtml(asset.url)}">
      <img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.altText)}">
      <div>
        <strong title="${escapeHtml(asset.originalName)}">${escapeHtml(asset.originalName)}</strong>
        <span>
          ${asset.usedByCount > 0
            ? `Utilisée par ${asset.usedByCount} fiche${asset.usedByCount > 1 ? "s" : ""}`
            : "Disponible"}
        </span>
      </div>
    </button>
  `).join("");
}

async function openMediaPicker() {
  mediaPickerSearch.value = "";
  mediaPickerGrid.innerHTML = '<div class="empty-state">Chargement de la médiathèque…</div>';
  mediaPickerDialog.showModal();

  try {
    mediaAssets = (await request("/api/media")).assets || [];
    renderMediaPicker();
  } catch (error) {
    mediaPickerGrid.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

async function load() {
  const [session, marketplace, media] = await Promise.all([
    request("/api/auth/session"),
    request("/api/marketplace"),
    request("/api/media")
  ]);

  const user = session.user;

  document.querySelector("#staffName").textContent = user.displayName;
  document.querySelector("#staffRole").textContent = roleName(user.role);
  document.querySelector("#profileAvatar").textContent =
    user.displayName.trim().charAt(0).toUpperCase() || "?";

  items = marketplace.items || [];
  mediaAssets = media.assets || [];

  renderItems();
  app.classList.remove("hidden");
}

document.querySelector("#newItemButton").addEventListener("click", openNewDialog);
document.querySelector("#closeDialog").addEventListener("click", () => dialog.close());
document.querySelector("#cancelButton").addEventListener("click", () => dialog.close());

document.querySelector("#chooseMediaButton").addEventListener("click", openMediaPicker);

document.querySelector("#clearMediaButton").addEventListener("click", () => {
  form.imageUrl.value = "";
  updateSelectedMedia();
});

document.querySelector("#closeMediaPicker").addEventListener("click", () => {
  mediaPickerDialog.close();
});

mediaPickerSearch.addEventListener("input", renderMediaPicker);
searchInput.addEventListener("input", renderItems);

mediaPickerGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-media-url]");
  if (!card) return;

  form.imageUrl.value = card.dataset.mediaUrl;
  updateSelectedMedia();
  mediaPickerDialog.close();
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((entry) => entry.classList.remove("active"));
    button.classList.add("active");
    currentFilter = button.dataset.filter;
    renderItems();
  });
});

list.addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit]");
  const remove = event.target.closest("[data-delete]");

  if (edit) {
    openEditDialog(Number(edit.dataset.edit));
    return;
  }

  if (remove) {
    const id = Number(remove.dataset.delete);
    const item = items.find((entry) => entry.id === id);

    if (!item || !window.confirm(`Supprimer « ${item.name} »?`)) {
      return;
    }

    try {
      await request(`/api/marketplace/${id}`, {
        method: "DELETE"
      });

      items = items.filter((entry) => entry.id !== id);
      renderItems();

      mediaAssets = (await request("/api/media")).assets || [];
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
    imageUrl: form.imageUrl.value.trim(),
    description: form.description.value.trim(),
    published: form.published.checked,
    metadata: {}
  };

  try {
    const id = Number(form.id.value);

    await request(id ? `/api/marketplace/${id}` : "/api/marketplace", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });

    dialog.close();

    items = (await request("/api/marketplace")).items || [];
    mediaAssets = (await request("/api/media")).assets || [];

    renderItems();
  } catch (error) {
    formMessage.textContent = error.message;
  } finally {
    saveButton.disabled = false;
  }
});

document.querySelector("#logoutButton").addEventListener("click", async () => {
  try {
    await request("/api/auth/logout", {
      method: "POST",
      body: "{}"
    });
  } finally {
    window.location.replace("login.html");
  }
});

load().catch((error) => {
  console.error(error);
  list.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
