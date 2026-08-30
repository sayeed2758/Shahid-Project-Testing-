import {
  auth,
  database,
} from "./firebase-init.js";
import {
  configureAuthPersistence,
  observeAuth,
  loginWithPassword,
  loginWithGoogle,
  sendResetEmail,
  logout,
  loadStudentProfile,
  getFriendlyAuthError,
} from "./auth.js";
import { ref, update } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const CLASSES = [
  { id: "class-6", label: "Class 6", number: 6 },
  { id: "class-7", label: "Class 7", number: 7 },
  { id: "class-8", label: "Class 8", number: 8 },
  { id: "class-9", label: "Class 9", number: 9 },
  { id: "class-10", label: "Class 10", number: 10 },
];

const state = {
  user: null,
  profile: null,
  assignedClass: null,
  isBusy: false,
  authResolved: false,
};

const $ = (selector) => document.querySelector(selector);

const elements = {
  authView: $("#authView"),
  appView: $("#appView"),
  loginForm: $("#loginForm"),
  emailInput: $("#emailInput"),
  passwordInput: $("#passwordInput"),
  togglePasswordBtn: $("#togglePasswordBtn"),
  loginBtn: $("#loginBtn"),
  googleBtn: $("#googleBtn"),
  forgotBtn: $("#forgotBtn"),
  authMessage: $("#authMessage"),
  welcomeHeading: $("#welcomeHeading"),
  dateLine: $("#dateLine"),
  classStatus: $("#classStatus"),
  homeClassGrid: $("#homeClassGrid"),
  classesGrid: $("#classesGrid"),
  classesNotice: $("#classesNotice"),
  viewClassesBtn: $("#viewClassesBtn"),
  classesBackBtn: $("#classesBackBtn"),
  classSelectedBackBtn: $("#classSelectedBackBtn"),
  selectedClassTitle: $("#selectedClassTitle"),
  selectedClassHomeBtn: $("#selectedClassHomeBtn"),
  fallbackHomeBtn: $("#fallbackHomeBtn"),
  logoutTopBtn: $("#logoutTopBtn"),
  mainContent: $("#mainContent"),
  bottomNav: $("#bottomNav"),
  globalStatus: $("#globalStatus"),
  routes: [...document.querySelectorAll(".route")],
  navItems: [...document.querySelectorAll(".nav-item")],
};

function setAuthMessage(message = "", type = "") {
  elements.authMessage.textContent = message;
  elements.authMessage.className = `inline-message ${type}`.trim();
}

function setGlobalStatus(message = "") {
  elements.globalStatus.textContent = message;
  elements.globalStatus.hidden = !message;
}

function setButtonBusy(button, busy, labelWhenBusy) {
  if (!button) return;
  button.disabled = busy;
  if (busy && labelWhenBusy) {
    button.dataset.defaultLabel = button.textContent.trim();
    button.querySelector(".button-label")?.replaceChildren(document.createTextNode(labelWhenBusy));
  } else if (!busy && button.dataset.defaultLabel) {
    button.querySelector(".button-label")?.replaceChildren(document.createTextNode(button.dataset.defaultLabel));
    delete button.dataset.defaultLabel;
  }
}

function setAuthControlsDisabled(disabled) {
  [elements.emailInput, elements.passwordInput, elements.loginBtn, elements.googleBtn, elements.forgotBtn].forEach((el) => {
    el.disabled = disabled;
  });
}

function formatToday() {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normaliseClassValue(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim().toLowerCase().replace(/^class[\s-]*/, "");
  const numeric = Number.parseInt(raw, 10);
  return Number.isInteger(numeric) && numeric >= 6 && numeric <= 10 ? numeric : null;
}

function getDisplayName(user, profile) {
  const profileName = String(profile?.displayName || "").trim();
  const authName = String(user?.displayName || "").trim();
  const emailName = String(user?.email || "").split("@")[0].trim();
  return profileName || authName || emailName || "Student";
}

function showView(mode) {
  const isAuth = mode === "auth";
  elements.authView.hidden = !isAuth;
  elements.appView.hidden = isAuth;
  if (!isAuth) {
    setTimeout(() => elements.mainContent.focus({ preventScroll: true }), 0);
  }
}

function routeNameFromHash() {
  const raw = location.hash.replace(/^#\/?/, "").trim();
  return raw || "home";
}

function navigate(route, options = {}) {
  const target = ["home", "classes", "class-selected"].includes(route) ? route : "home";
  if (location.hash !== `#${target}` && !options.replace) {
    location.hash = `#${target}`;
    return;
  }
  renderRoute(target);
}

function renderRoute(route) {
  const target = ["home", "classes", "class-selected"].includes(route) ? route : "home";

  elements.routes.forEach((section) => {
    section.hidden = section.dataset.route !== target;
  });

  elements.navItems.forEach((button) => {
    const isActive = button.dataset.nav === (target === "class-selected" ? "classes" : target);
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  });

  if (target === "class-selected") {
    elements.classSelectedBackBtn.focus({ preventScroll: true });
  }
}

function createClassCard(classItem, { compact = false } = {}) {
  const isAssigned = state.assignedClass === classItem.number;

  if (!isAssigned) {
    return `
      <article class="class-card class-card-locked ${compact ? "is-compact" : ""}">
        <div class="class-number">${classItem.number}</div>
        <div class="class-content">
          <strong>${escapeHtml(classItem.label)}</strong>
          <span>Not assigned</span>
        </div>
        <div class="class-lock" aria-label="Locked">🔒</div>
      </article>
    `;
  }

  return `
    <button
      class="class-card ${compact ? "is-compact" : ""} is-assigned"
      type="button"
      data-class-number="${classItem.number}"
      aria-label="Open ${escapeHtml(classItem.label)}"
    >
      <div class="class-number">${classItem.number}</div>
      <div class="class-content">
        <strong>${escapeHtml(classItem.label)}</strong>
        <span>Your assigned class</span>
      </div>
      <div class="class-arrow" aria-hidden="true">→</div>
    </button>
  `;
}

function renderClassCards() {
  elements.homeClassGrid.innerHTML = CLASSES.map((item) => createClassCard(item, { compact: true })).join("");
  elements.classesGrid.innerHTML = CLASSES.map((item) => createClassCard(item)).join("");

  elements.homeClassGrid.querySelectorAll("[data-class-number]").forEach((button) => {
    button.addEventListener("click", () => openAssignedClass(Number(button.dataset.classNumber)));
  });

  elements.classesGrid.querySelectorAll("[data-class-number]").forEach((button) => {
    button.addEventListener("click", () => openAssignedClass(Number(button.dataset.classNumber)));
  });
}

function openAssignedClass(classNumber) {
  if (classNumber !== state.assignedClass) {
    setGlobalStatus("That class is not assigned to your account.");
    window.setTimeout(() => setGlobalStatus(""), 2200);
    return;
  }

  const item = CLASSES.find((entry) => entry.number === classNumber);
  elements.selectedClassTitle.textContent = item ? item.label : `Class ${classNumber}`;
  navigate("class-selected");
}

function populateHome() {
  const name = getDisplayName(state.user, state.profile);
  elements.welcomeHeading.innerHTML = `${escapeHtml(name)} <span aria-hidden="true">👋</span>`;
  elements.dateLine.textContent = formatToday();

  if (state.assignedClass) {
    elements.classStatus.textContent = `Your assigned class: Class ${state.assignedClass}`;
  } else {
    elements.classStatus.textContent = "Your class assignment is not available yet.";
  }

  renderClassCards();
}

async function saveUserProfileIfMissing(user, profile) {
  if (profile) return profile;

  // Phase 2-5 support: create the minimum profile record so an authorised
  // account can be recognised once an admin assigns the class later.
  const defaultProfile = {
    displayName: user.displayName || "",
    email: user.email || "",
    createdAt: Date.now(),
    lastLogin: Date.now(),
  };

  await update(ref(database, `users/${user.uid}`), defaultProfile);
  return { ...defaultProfile };
}

async function resolveAuthorisedStudent(user) {
  const profile = await loadStudentProfile(user.uid);

  // Because accounts are admin-created and must have an assigned class,
  // an absent profile or class assignment is treated as unauthorised.
  if (!profile) {
    return { authorised: false, reason: "Your account is not assigned by the institute yet." };
  }

  const assigned = normaliseClassValue(profile.class);
  if (!assigned) {
    return { authorised: false, reason: "Your class has not been assigned yet. Please contact the institute." };
  }

  return { authorised: true, profile, assignedClass: assigned };
}

async function handleAuthenticatedUser(user) {
  state.user = user;

  try {
    const result = await resolveAuthorisedStudent(user);

    if (!result.authorised) {
      await logout().catch(() => {});
      showView("auth");
      setAuthMessage(result.reason, "error");
      return;
    }

    state.profile = result.profile;
    state.assignedClass = result.assignedClass;
    showView("app");
    populateHome();
    const route = routeNameFromHash();
    renderRoute(route);
  } catch (error) {
    console.error(error);
    await logout().catch(() => {});
    showView("auth");
    setAuthMessage("We could not load your student profile. Please try again.", "error");
  }
}

function handleLoggedOut() {
  state.user = null;
  state.profile = null;
  state.assignedClass = null;
  showView("auth");
  setAuthControlsDisabled(false);
  setAuthMessage("");
  navigateAuthHash();
}

function navigateAuthHash() {
  if (location.hash) history.replaceState(null, "", `${location.pathname}${location.search}`);
}

async function onLoginSubmit(event) {
  event.preventDefault();
  if (state.isBusy) return;

  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;

  if (!email || !elements.emailInput.validity.valid) {
    setAuthMessage("Please enter a valid email address.", "error");
    elements.emailInput.focus();
    return;
  }

  if (!password || password.length < 6) {
    setAuthMessage("Please enter your password.", "error");
    elements.passwordInput.focus();
    return;
  }

  state.isBusy = true;
  setAuthControlsDisabled(true);
  setButtonBusy(elements.loginBtn, true, "Signing in…");
  setAuthMessage("Signing in…", "loading");

  try {
    await loginWithPassword(email, password);
    // Do not manually navigate. The single auth observer handles the transition.
  } catch (error) {
    console.error(error);
    setAuthMessage(getFriendlyAuthError(error), "error");
    setAuthControlsDisabled(false);
    setButtonBusy(elements.loginBtn, false);
    state.isBusy = false;
  }
}

async function onGoogleLogin() {
  if (state.isBusy) return;
  state.isBusy = true;
  setAuthControlsDisabled(true);
  setAuthMessage("Opening Google sign-in…", "loading");

  try {
    await loginWithGoogle();
  } catch (error) {
    console.error(error);
    setAuthMessage(getFriendlyAuthError(error), "error");
    setAuthControlsDisabled(false);
    state.isBusy = false;
  }
}

async function onForgotPassword() {
  if (state.isBusy) return;

  const email = elements.emailInput.value.trim();
  if (!email || !elements.emailInput.validity.valid) {
    setAuthMessage("Enter your email first, then tap Forgot Password.", "error");
    elements.emailInput.focus();
    return;
  }

  state.isBusy = true;
  setAuthControlsDisabled(true);
  setAuthMessage("Sending password reset email…", "loading");

  try {
    await sendResetEmail(email);
    setAuthMessage("Password reset email sent. Check your inbox.", "success");
  } catch (error) {
    console.error(error);
    setAuthMessage(getFriendlyAuthError(error), "error");
  } finally {
    setAuthControlsDisabled(false);
    state.isBusy = false;
  }
}

async function onLogout() {
  if (state.isBusy) return;
  state.isBusy = true;
  elements.logoutTopBtn.disabled = true;
  setGlobalStatus("Signing out…");

  try {
    await logout();
  } catch (error) {
    console.error(error);
    setGlobalStatus("Could not sign out. Please try again.");
  } finally {
    elements.logoutTopBtn.disabled = false;
    state.isBusy = false;
    setTimeout(() => setGlobalStatus(""), 1800);
  }
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", onLoginSubmit);
  elements.googleBtn.addEventListener("click", onGoogleLogin);
  elements.forgotBtn.addEventListener("click", onForgotPassword);
  elements.logoutTopBtn.addEventListener("click", onLogout);

  elements.togglePasswordBtn.addEventListener("click", () => {
    const visible = elements.passwordInput.type === "text";
    elements.passwordInput.type = visible ? "password" : "text";
    elements.togglePasswordBtn.setAttribute("aria-label", visible ? "Show password" : "Hide password");
    elements.togglePasswordBtn.textContent = visible ? "◉" : "◌";
  });

  elements.viewClassesBtn.addEventListener("click", () => navigate("classes"));
  elements.classesBackBtn.addEventListener("click", () => navigate("home"));
  elements.classSelectedBackBtn.addEventListener("click", () => navigate("classes"));
  elements.selectedClassHomeBtn.addEventListener("click", () => navigate("home"));
  elements.fallbackHomeBtn.addEventListener("click", () => navigate("home"));

  elements.navItems.forEach((button) => {
    button.addEventListener("click", () => {
      navigate(button.dataset.nav);
    });
  });

  window.addEventListener("hashchange", () => {
    if (state.user && state.assignedClass) {
      renderRoute(routeNameFromHash());
    }
  });

  window.addEventListener("online", () => {
    setGlobalStatus("Back online.");
    setTimeout(() => setGlobalStatus(""), 1600);
  });

  window.addEventListener("offline", () => {
    setGlobalStatus("You’re offline. Some Firebase features may not work.");
  });
}

async function bootstrap() {
  bindEvents();

  // Phase 2: keep login persistence and one auth observer in a single place.
  try {
    await configureAuthPersistence();
  } catch (error) {
    console.warn("Could not configure auth persistence:", error);
  }

  observeAuth(async (user) => {
    state.authResolved = true;
    state.isBusy = false;

    if (user) {
      await handleAuthenticatedUser(user);
    } else {
      handleLoggedOut();
    }
  });
}

bootstrap().catch((error) => {
  console.error(error);
  showView("auth");
  setAuthMessage("Application failed to initialise. Refresh and try again.", "error");
});
