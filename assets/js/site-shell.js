const GMRP_NAV_ITEMS = [
  ["Accueil", "index.html"],
  ["Vision", "vision.html"],
  ["Univers RP", "univers.html"],
  ["Économie", "economie.html"],
  ["Marketplace", "boutique.html"],
  ["Actualités", "actualites.html"],
  ["Équipe", "equipe.html"],
  ["Règlements", "reglements.html"],
  ["Nous rejoindre", "rejoindre.html"]
];

function currentPageName() {
  const file = window.location.pathname.split("/").pop();
  return file || "index.html";
}

function navMarkup() {
  const current = currentPageName();

  return GMRP_NAV_ITEMS.map(([label, href]) => {
    const active = current === href;
    return `<a ${active ? 'class="active" aria-current="page"' : ""} href="${href}">${label}</a>`;
  }).join("");
}

function headerMarkup() {
  return `
    <header class="site-header scrolled" id="siteHeader">
      <a class="brand" href="index.html" aria-label="Grand Montréal RP">
        <img src="assets/logo.png" alt="Logo Grand Montréal RP">
        <div>
          <strong>GRAND MONTRÉAL <span>RP</span></strong>
          <small>REMASTERED</small>
        </div>
      </a>

      <button class="menu-toggle" id="menuToggle" type="button"
              aria-label="Ouvrir le menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>

      <nav class="main-nav" id="mainNav" aria-label="Navigation principale">
        ${navMarkup()}
      </nav>

      <div class="header-live" data-live-root>
        <span class="header-live-dot" data-live-dot></span>
        <div>
          <strong data-live-state>Vérification</strong>
          <small><span data-live-players>—</span>/<span data-live-capacity>—</span> joueurs</small>
        </div>
      </div>

      <div class="header-actions">
        <a class="account-button" href="login.html" aria-label="Compte staff" title="Compte staff">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5Z"/>
          </svg>
        </a>
        <a class="header-link" href="https://discord.gg/GWDxdWCDM" target="_blank" rel="noopener">Discord</a>
        <a class="header-button" href="https://cfx.re/join/k7oxyd" target="_blank" rel="noopener">Jouer</a>
      </div>
    </header>
  `;
}

function footerMarkup() {
  return `
    <footer class="site-footer">
      <div class="footer-brand">
        <img src="assets/logo.png" alt="">
        <div>
          <strong>GRAND MONTRÉAL RP</strong>
          <span>REMASTERED</span>
        </div>
      </div>

      <nav aria-label="Navigation de pied de page">
        ${GMRP_NAV_ITEMS.slice(0, 8).map(([label, href]) => `<a href="${href}">${label}</a>`).join("")}
        <a href="https://discord.gg/GWDxdWCDM" target="_blank" rel="noopener">Discord</a>
      </nav>

      <p>© <span data-current-year></span> Grand Montréal RP. Projet FiveM indépendant.</p>
    </footer>
  `;
}

function initializeShell() {
  const headerTarget = document.querySelector("[data-site-header]");
  const footerTarget = document.querySelector("[data-site-footer]");

  if (headerTarget) headerTarget.innerHTML = headerMarkup();
  if (footerTarget) footerTarget.innerHTML = footerMarkup();

  const year = document.querySelector("[data-current-year]");
  if (year) year.textContent = new Date().getFullYear();

  const menuToggle = document.querySelector("#menuToggle");
  const mainNav = document.querySelector("#mainNav");

  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      const open = menuToggle.classList.toggle("active");
      mainNav.classList.toggle("open", open);
      document.body.classList.toggle("menu-open", open);
      menuToggle.setAttribute("aria-expanded", String(open));
    });

    mainNav.addEventListener("click", (event) => {
      if (!event.target.closest("a")) return;
      menuToggle.classList.remove("active");
      mainNav.classList.remove("open");
      document.body.classList.remove("menu-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  }
}

initializeShell();
