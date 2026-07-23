async function loadLiveStatus() {
  const roots = [...document.querySelectorAll("[data-live-root]")];
  if (!roots.length) return;

  const update = (payload) => {
    roots.forEach((root) => {
      const state = root.querySelector("[data-live-state]");
      const players = root.querySelector("[data-live-players]");
      const capacity = root.querySelector("[data-live-capacity]");
      const dot = root.querySelector("[data-live-dot]");
      const serverName = root.querySelector("[data-live-name]");

      if (state) state.textContent = payload.online ? "Serveur en ligne" : "Serveur hors ligne";
      if (players) players.textContent = payload.players ?? "—";
      if (capacity) capacity.textContent = payload.capacity ?? "—";
      if (serverName) serverName.textContent = payload.name || "Grand Montréal RP";

      if (dot) {
        dot.classList.toggle("online", Boolean(payload.online));
        dot.classList.toggle("offline", !payload.online);
      }

      root.classList.toggle("is-online", Boolean(payload.online));
      root.classList.toggle("is-offline", !payload.online);
    });
  };

  try {
    const response = await fetch("/api/live-status", {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || "Statut indisponible");
    }

    update(payload);
  } catch (error) {
    console.error(error);
    update({
      online: false,
      players: null,
      capacity: null,
      name: "Grand Montréal RP"
    });
  }
}

loadLiveStatus();
setInterval(loadLiveStatus, 60000);
