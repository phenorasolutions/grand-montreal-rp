const dashboard = document.querySelector("#dashboard");
const logoutButton = document.querySelector("#logoutButton");

async function api(path, options = {}) {
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
    throw new Error("Session expirée.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Une erreur est survenue.");
  }

  return data;
}

function roleLabel(role) {
  const labels = {
    100: "Fondateur",
    80: "Administrateur",
    60: "Gestionnaire Marketplace",
    40: "Communication",
    20: "Lecture seule"
  };
  return labels[role] || `Rôle ${role}`;
}

async function loadDashboard() {
  try {
    const data = await api("/api/dashboard");

    document.querySelector("#welcomeName").textContent = data.user.displayName;
    document.querySelector("#sidebarName").textContent = data.user.displayName;
    document.querySelector("#sidebarRole").textContent = roleLabel(data.user.role);

    document.querySelector("#vehicleCount").textContent = data.counts.vehicles;
    document.querySelector("#houseCount").textContent = data.counts.houses;
    document.querySelector("#vipCount").textContent = data.counts.vip;
    document.querySelector("#userCount").textContent = data.counts.users;

    dashboard.classList.remove("hidden");
  } catch (error) {
    console.error(error);
  }
}

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;

  try {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
  } finally {
    window.location.replace("login.html");
  }
});

loadDashboard();
