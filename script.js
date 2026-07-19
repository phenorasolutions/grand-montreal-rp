const topbar = document.querySelector("#topbar");
const menuButton = document.querySelector("#menuButton");
const nav = document.querySelector("#mainNav");
const navLinks = [...document.querySelectorAll(".nav a")];
const sections = [...document.querySelectorAll("main section[id]")];

function updateHeader() {
  topbar.classList.toggle("scrolled", window.scrollY > 20);
}

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

menuButton.addEventListener("click", () => {
  const open = menuButton.classList.toggle("active");
  nav.classList.toggle("open", open);
  document.body.classList.toggle("menu-open", open);
  menuButton.setAttribute("aria-expanded", String(open));
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    menuButton.classList.remove("active");
    nav.classList.remove("open");
    document.body.classList.remove("menu-open");
    menuButton.setAttribute("aria-expanded", "false");
  });
});

const navObserver = new IntersectionObserver((entries) => {
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

sections.forEach((section) => navObserver.observe(section));

const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("visible");
    observer.unobserve(entry.target);
  });
}, {
  threshold: .12
});

document.querySelectorAll(".reveal").forEach((element, index) => {
  element.style.transitionDelay = `${Math.min(index % 4, 3) * 65}ms`;
  revealObserver.observe(element);
});

document.querySelector("#year").textContent = new Date().getFullYear();
