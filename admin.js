const dashboard = document.querySelector("#dashboard");
const logoutButton = document.querySelector("#logoutButton");

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
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
  const roles = {
    100: "Fondateur",
    80: "Administrateur",
    60: "Gestionnaire Marketplace",
    40: "Communication",
    20: "Lecture seule"
  };

  return roles[role] || `Rôle ${role}`;
}

function formatDate(value) {
  if (!value) {
    return "Jamais";
  }

  const date = new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"));

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto"
  }).format(date);
}

function relativeTime(value) {
  if (!value) {
    return "Date inconnue";
  }

  const date = new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"));
  const difference = date.getTime() - Date.now();
  const absolute = Math.abs(difference);

  const formatter = new Intl.RelativeTimeFormat("fr", {
    numeric: "auto"
  });

  if (absolute < 60_000) {
    return formatter.format(Math.round(difference / 1000), "second");
  }

  if (absolute < 3_600_000) {
    return formatter.format(Math.round(difference / 60_000), "minute");
  }

  if (absolute < 86_400_000) {
    return formatter.format(Math.round(difference / 3_600_000), "hour");
  }

  return formatter.format(Math.round(difference / 86_400_000), "day");
}

function actionLabel(action) {
  const labels = {
    founder_created: "Création du compte fondateur",
    login_success: "Connexion réussie",
    login_failed: "Tentative de connexion refusée",
    logout: "Déconnexion"
  };

  return labels[action] || action.replaceAll("_", " ");
}

function actionIcon(action) {
  if (action.includes("login")) return "↪";
  if (action.includes("logout")) return "↩";
  if (action.includes("created")) return "+";
  if (action.includes("delete")) return "−";
  return "•";
}

function actionDetails(item) {
  const username = item.details?.username;
  const displayName = item.details?.displayName;

  if (displayName && username) {
    return `${displayName} — ${username}`;
  }

  if (username) {
    return username;
  }

  return item.category || "Système";
}

function renderActivity(actions) {
  const list = document.querySelector("#activityList");
  const count = document.querySelector("#activityCount");

  count.textContent = `${actions.length} action${actions.length > 1 ? "s" : ""}`;

  if (!actions.length) {
    list.innerHTML = '<div class="empty-state">Aucune activité enregistrée.</div>';
    return;
  }

  list.innerHTML = actions.map((item) => `
    <article class="activity-item">
      <div class="activity-icon">${actionIcon(item.action)}</div>
      <div class="activity-content">
        <strong>${escapeHtml(actionLabel(item.action))}</strong>
        <p>${escapeHtml(item.actor.displayName)} · ${escapeHtml(actionDetails(item))}</p>
      </div>
      <time class="activity-time" title="${escapeHtml(formatDate(item.createdAt))}">
        ${escapeHtml(relativeTime(item.createdAt))}
      </time>
    </article>
  `).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadDashboard() {
  const data = await request("/api/dashboard");
  const role = roleName(data.user.role);
  const initial = data.user.displayName.trim().charAt(0).toUpperCase() || "?";

  document.querySelector("#welcomeName").textContent = data.user.displayName;
  document.querySelector("#staffName").textContent = data.user.displayName;
  document.querySelector("#staffRole").textContent = role;
  document.querySelector("#profileAvatar").textContent = initial;

  document.querySelector("#vehicles").textContent = data.counts.vehicles;
  document.querySelector("#houses").textContent = data.counts.houses;
  document.querySelector("#vip").textContent = data.counts.vip;
  document.querySelector("#users").textContent = data.counts.users;

  document.querySelector("#accountName").textContent = data.user.displayName;
  document.querySelector("#accountRole").textContent = role;
  document.querySelector("#lastLogin").textContent = formatDate(data.user.lastLogin);
  document.querySelector("#createdAt").textContent = formatDate(data.user.createdAt);

  renderActivity(data.recentActions || []);
  dashboard.classList.remove("hidden");
}

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;

  try {
    await request("/api/auth/logout", {
      method: "POST",
      body: "{}"
    });
  } finally {
    window.location.replace("login.html");
  }
});

loadDashboard().catch((error) => {
  console.error(error);
});
