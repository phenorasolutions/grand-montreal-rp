const siteHeader = document.querySelector("#siteHeader");
const menuToggle = document.querySelector("#menuToggle");
const mainNav = document.querySelector("#mainNav");
const navLinks = [...document.querySelectorAll(".main-nav a")];
const sections = [...document.querySelectorAll("main section[id]")];
const cursorGlow = document.querySelector("#cursorGlow");

function updateHeader() {
  siteHeader.classList.toggle("scrolled", window.scrollY > 20);
}

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

menuToggle.addEventListener("click", () => {
  const open = menuToggle.classList.toggle("active");
  mainNav.classList.toggle("open", open);
  document.body.classList.toggle("menu-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    menuToggle.classList.remove("active");
    mainNav.classList.remove("open");
    document.body.classList.remove("menu-open");
    menuToggle.setAttribute("aria-expanded", "false");
  });
});

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;

    navLinks.forEach((link) => {
      link.classList.toggle(
        "active",
        link.getAttribute("href") === `#${entry.target.id}`
      );
    });
  });
}, {
  rootMargin: "-38% 0px -54% 0px",
  threshold: 0
});

sections.forEach((section) => sectionObserver.observe(section));

const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("visible");
    observer.unobserve(entry.target);
  });
}, { threshold: .12 });

document.querySelectorAll(".reveal").forEach((element, index) => {
  element.style.transitionDelay = `${Math.min(index % 4, 3) * 65}ms`;
  revealObserver.observe(element);
});

document.querySelector("#year").textContent = new Date().getFullYear();

if (window.matchMedia("(pointer: fine)").matches) {
  window.addEventListener("mousemove", (event) => {
    cursorGlow.style.left = `${event.clientX}px`;
    cursorGlow.style.top = `${event.clientY}px`;
    cursorGlow.style.opacity = "1";
  }, { passive: true });

  document.addEventListener("mouseleave", () => {
    cursorGlow.style.opacity = "0";
  });
}

async function fetchServerStatus() {
  const state = document.querySelector("#serverState");
  const name = document.querySelector("#serverName");
  const players = document.querySelector("#playerCount");
  const capacity = document.querySelector("#serverCapacity");
  const dot = document.querySelector("#liveDot");

  const endpoints = [
    "https://frontend.cfx-services.net/api/servers/single/k7oxyd",
    "https://servers-frontend.fivem.net/api/servers/single/k7oxyd"
  ];

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(endpoint, {
        signal: controller.signal,
        headers: { "Accept": "application/json" }
      });

      clearTimeout(timeout);

      if (!response.ok) continue;

      const payload = await response.json();
      const data = payload?.Data;

      if (!data) continue;

      const currentPlayers =
        data.clients ??
        data.selfReportedClients ??
        (Array.isArray(data.players) ? data.players.length : null);

      const maxPlayers =
        data.sv_maxclients ??
        data.vars?.sv_maxClients ??
        data.vars?.sv_maxclients ??
        null;

      state.textContent = "Serveur en ligne";
      name.textContent =
        data.vars?.sv_projectName ||
        data.hostname ||
        "Grand Montréal RP";

      players.textContent = currentPlayers ?? "—";
      capacity.textContent = maxPlayers ?? "—";
      dot.classList.remove("offline");
      dot.classList.add("online");
      return;
    } catch (error) {
      // Essaie l'endpoint suivant.
    }
  }

  state.textContent = "Statut indisponible";
  name.textContent = "Le bouton Jouer reste fonctionnel";
  players.textContent = "—";
  capacity.textContent = "—";
  dot.classList.remove("online");
  dot.classList.add("offline");
}

fetchServerStatus();
setInterval(fetchServerStatus, 60000);
