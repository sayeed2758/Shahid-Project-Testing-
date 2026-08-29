import { getRoute, navigate, startRouter } from "./router.js";

const classes = [6, 7, 8, 9, 10];
const view = document.querySelector("#view");
const navItems = [...document.querySelectorAll("[data-route]")];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}

function classCard(classNo) {
  return `
    <button class="class-card" type="button" data-class="${classNo}" aria-label="Open Class ${classNo}">
      <span class="class-badge">CLASS</span>
      <span class="class-number">${classNo}</span>
      <span class="class-caption">Open learning space</span>
      <span class="card-arrow" aria-hidden="true">→</span>
    </button>`;
}

function renderHome() {
  view.innerHTML = `
    <div class="view-stack">
      <section class="hero">
        <span class="hero-label">WELCOME BACK</span>
        <h1>Knowledge starts here. 👋</h1>
        <p>Your learning space for Classes 6–10.</p>
        <button class="hero-action" type="button" data-route="classes">Browse Classes <span>→</span></button>
      </section>
      <section class="stats-grid" aria-label="Portal statistics">
        <article class="stat-card"><div class="stat-icon">▦</div><div class="stat-number">5</div><div class="stat-label">Classes</div></article>
        <article class="stat-card"><div class="stat-icon">✦</div><div class="stat-number">4</div><div class="stat-label">Subjects</div></article>
        <article class="stat-card"><div class="stat-icon">▤</div><div class="stat-number">—</div><div class="stat-label">Protected Notes</div></article>
        <article class="stat-card"><div class="stat-icon">↓</div><div class="stat-number">—</div><div class="stat-label">Worksheets</div></article>
      </section>
      <div class="section-heading">
        <h2>Choose Your Class</h2>
        <button type="button" data-route="classes">View All</button>
      </div>
      <section class="class-grid" aria-label="Classes 6 to 10">${classes.map(classCard).join("")}</section>
      <section class="subject-note">
        <strong>One clean learning space</strong>
        <p>Your account, navigation and application views now run inside one consistent shell. Study materials will be connected from Firebase in the upcoming phases.</p>
      </section>
    </div>`;
}

function renderClasses() {
  view.innerHTML = `
    <div class="view-stack">
      <div class="page-heading-row">
        <div><h1 class="page-title">Classes</h1><p class="page-subtitle">Choose your class to continue learning.</p></div>
      </div>
      <section class="class-grid">${classes.map(classCard).join("")}</section>
    </div>`;
}

function renderClass(classId) {
  const subjects = ["SST", "SCIENCE", "MATH", "ENGLISH"];
  view.innerHTML = `
    <div class="view-stack">
      <button class="back-button" type="button" data-back>← Back to Classes</button>
      <div><span class="eyebrow">CLASS ${escapeHtml(classId)}</span><h1 class="page-title">Choose a Subject</h1><p class="page-subtitle">Your learning materials for Class ${escapeHtml(classId)} will appear here.</p></div>
      <section class="subject-grid">
        ${subjects.map(subject => `<button class="subject-card" type="button" data-subject="${subject}"><span class="subject-icon">${subject === "SST" ? "🌍" : subject === "SCIENCE" ? "🔬" : subject === "MATH" ? "🧮" : "📚"}</span><span><strong>${subject}</strong><small>Materials coming in Phase 6</small></span><span class="card-arrow">→</span></button>`).join("")}
      </section>
    </div>`;
}

function renderSearch() {
  view.innerHTML = `
    <div class="view-stack">
      <div><h1 class="page-title">Search</h1><p class="page-subtitle">Find chapters and study materials quickly.</p></div>
      <label class="search-box"><span aria-hidden="true">⌕</span><input id="searchInput" type="search" placeholder="Search study material..." autocomplete="off"><button id="clearSearch" type="button" aria-label="Clear search">Clear</button></label>
      <div class="empty-state"><div class="empty-icon">⌕</div><strong>Material search is ready for Firebase</strong><p>The search interface is connected to the application shell. Catalog search will be enabled in Phase 9.</p></div>
    </div>`;
  const input = document.querySelector("#searchInput");
  document.querySelector("#clearSearch").addEventListener("click", () => { input.value = ""; input.focus(); });
}

function renderRecent() {
  view.innerHTML = `<div class="view-stack"><div><h1 class="page-title">Recent</h1><p class="page-subtitle">Pick up where you left off.</p></div><div class="empty-state"><div class="empty-icon">◷</div><strong>No recent materials yet</strong><p>Your recent study materials will appear here after the catalog and reader are connected.</p></div></div>`;
}

function renderProfile() {
  view.innerHTML = `<div class="view-stack"><div><h1 class="page-title">Profile</h1><p class="page-subtitle">Your student account.</p></div><section class="profile-card"><div class="avatar">EV</div><div class="meta"><strong>Authenticated Student</strong><span>Firebase session is active.</span></div></section><button class="logout-button" type="button" data-auth-action="logout">Logout</button></div>`;
}

function render(route) {
  switch (route.name) {
    case "classes": renderClasses(); break;
    case "search": renderSearch(); break;
    case "recent": renderRecent(); break;
    case "profile": renderProfile(); break;
    case "class": renderClass(route.params.classId); break;
    default: renderHome();
  }
  updateNavigation(route);
  view.scrollTo({ top: 0, behavior: "instant" });
}

function updateNavigation(route) {
  const active = route.name === "class" ? "classes" : route.name;
  navItems.forEach(item => item.classList.toggle("is-active", item.dataset.route === active));
}

document.addEventListener("click", event => {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) { navigate(routeButton.dataset.route); return; }
  const classButton = event.target.closest("[data-class]");
  if (classButton) { navigate("class", { classId: classButton.dataset.class }); return; }
  const backButton = event.target.closest("[data-back]");
  if (backButton) { navigate("classes"); return; }
});

startRouter(render);
