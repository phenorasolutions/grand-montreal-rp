const loadingView = document.querySelector("#loadingView");
const loginView = document.querySelector("#loginView");
const setupView = document.querySelector("#setupView");
const loginForm = document.querySelector("#loginForm");
const setupForm = document.querySelector("#setupForm");
const authMessage = document.querySelector("#authMessage");

function show(view) {
  [loadingView, loginView, setupView].forEach((item) => item.classList.add("hidden"));
  view.classList.remove("hidden");
}

function setMessage(message, success = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("success", success);
}

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
  if (!response.ok) {
    throw new Error(data.error || "Une erreur est survenue.");
  }
  return data;
}

async function initialize() {
  try {
    const status = await api("/api/auth/status");

    if (status.authenticated) {
      window.location.replace("admin.html");
      return;
    }

    show(status.initialized ? loginView : setupView);
  } catch (error) {
    show(loginView);
    setMessage(error.message);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");

  const button = loginForm.querySelector("button");
  button.disabled = true;

  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: loginForm.username.value.trim(),
        password: loginForm.password.value
      })
    });

    window.location.replace("admin.html");
  } catch (error) {
    setMessage(error.message);
    button.disabled = false;
  }
});

setupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");

  const button = setupForm.querySelector("button");
  button.disabled = true;

  try {
    await api("/api/auth/setup", {
      method: "POST",
      body: JSON.stringify({
        setupKey: setupForm.setupKey.value,
        displayName: setupForm.displayName.value.trim(),
        username: setupForm.username.value.trim(),
        password: setupForm.password.value
      })
    });

    setMessage("Compte fondateur créé. Ouverture du tableau de bord…", true);
    window.setTimeout(() => window.location.replace("admin.html"), 550);
  } catch (error) {
    setMessage(error.message);
    button.disabled = false;
  }
});

initialize();
