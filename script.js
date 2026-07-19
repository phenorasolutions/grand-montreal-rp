const header = document.querySelector(".site-header");
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".main-nav");
const navLinks = [...document.querySelectorAll(".main-nav a")];

function setHeaderState() {
  header.classList.toggle("scrolled", window.scrollY > 20);
}

setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });

menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.classList.toggle("active");
  nav.classList.toggle("open", isOpen);
  document.body.classList.toggle("menu-open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    menuToggle.classList.remove("active");
    nav.classList.remove("open");
    document.body.classList.remove("menu-open");
    menuToggle.setAttribute("aria-expanded", "false");
  });
});

const sections = [...document.querySelectorAll("main section[id]")];

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;

    navLinks.forEach((link) => {
      const target = link.getAttribute("href");
      link.classList.toggle("active", target === `#${entry.target.id}`);
    });
  });
}, {
  rootMargin: "-35% 0px -55% 0px",
  threshold: 0
});

sections.forEach((section) => sectionObserver.observe(section));

const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("visible");
    observer.unobserve(entry.target);
  });
}, {
  threshold: 0.12
});

document.querySelectorAll(".reveal").forEach((element, index) => {
  element.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
  revealObserver.observe(element);
});

document.querySelector("#year").textContent = new Date().getFullYear();

/*
  Compteur FiveM :
  remplace TONCODE par ton code cfx.re, puis décommente ce bloc.
  Attention : l'API publique peut parfois refuser les requêtes selon sa configuration.

async function loadPlayerCount() {
  try {
    const response = await fetch("https://servers-frontend.fivem.net/api/servers/single/TONCODE");
    if (!response.ok) throw new Error("Serveur introuvable");
    const data = await response.json();
    document.querySelector("#player-count").textContent =
      `${data.Data.clients}/${data.Data.sv_maxclients}`;
  } catch (error) {
    document.querySelector("#player-count").textContent = "Hors ligne";
  }
}

loadPlayerCount();
*/
