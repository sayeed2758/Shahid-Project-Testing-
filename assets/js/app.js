const classes = [6, 7, 8, 9, 10];

const routes = {
  home: renderHome,
  classes: renderClasses,
  search: renderSearch,
  recent: renderRecent,
  profile: renderProfile
};

const view = document.querySelector("#view");
const navItems = [...document.querySelectorAll("[data-route]")];

function navigate(route) {
  const renderer = routes[route] || routes.home;
  renderer();
  navItems.forEach(item => item.classList.toggle("is-active", item.dataset.route === route));
  history.pushState({ route }, "", `#${route}`);
  view.focus({ preventScroll: true });
}

function classCard(classNo) {
  return `
    <button class="class-card" type="button" data-class="${classNo}" aria-label="Open Class ${classNo}">
      <div class="class-number">${classNo}</div>
      <div class="class-caption">Explore subjects</div>
    </button>
  `;
}

function renderHome() {
  view.innerHTML = `
    <div class="view-stack">
      <section class="hero">
        <span class="hero-label">WELCOME BACK</span>
        <h1>Knowledge starts here. 👋</h1>
        <p>Your learning space for Classes 6–10.</p>
      </section>

      <section class="stats-grid" aria-label="Portal statistics">
        <article class="stat-card"><div class="stat-number">5</div><div class="stat-label">Classes</div></article>
        <article class="stat-card"><div class="stat-number">4</div><div class="stat-label">Subjects</div></article>
        <article class="stat-card"><div class="stat-number">—</div><div class="stat-label">Protected Notes</div></article>
        <article class="stat-card"><div class="stat-number">—</div><div class="stat-label">Worksheets</div></article>
      </section>

      <div class="section-heading">
        <h2>Choose Your Class</h2>
        <button type="button" data-action="all-classes">View All</button>
      </div>

      <section class="class-grid" aria-label="Classes 6 to 10">
        ${classes.map(classCard).join("")}
      </section>

      <section class="subject-note">
        <strong>Premium learning experience</strong>
        <p>Firebase-powered materials, protected notes and downloadable worksheets will be connected in the next phases.</p>
      </section>
    </div>
  `;
}

function renderClasses() {
  view.innerHTML = `
    <div class="view-stack">
      <div>
        <h1 class="page-title">Classes</h1>
        <p class="page-subtitle">Choose your assigned class to continue.</p>
      </div>
      <section class="class-grid">
        ${classes.map(classCard).join("")}
      </section>
    </div>
  `;
}

function renderSearch() {
  view.innerHTML = `
    <div class="view-stack">
      <div>
        <h1 class="page-title">Search</h1>
        <p class="page-subtitle">Search materials by title, chapter, subject or class.</p>
      </div>
      <label class="search-box">
        <span aria-hidden="true">⌕</span>
        <input id="searchInput" type="search" placeholder="Search study material..." autocomplete="off">
        <button id="clearSearch" type="button" aria-label="Clear search">Clear</button>
      </label>
      <div class="empty-state">
        <strong>Materials will appear here</strong>
        <p>Search will be connected to the Firebase catalog in Phase 9.</p>
      </div>
    </div>
  `;
  document.querySelector("#clearSearch").addEventListener("click", () => {
    document.querySelector("#searchInput").value = "";
    document.querySelector("#searchInput").focus();
  });
}

function renderRecent() {
  view.innerHTML = `
    <div class="view-stack">
      <div>
        <h1 class="page-title">Recent</h1>
        <p class="page-subtitle">Your recently opened study materials.</p>
      </div>
      <div class="empty-state">
        <strong>No recent materials</strong>
        <p>Your last opened materials will appear here after Firebase is connected.</p>
      </div>
    </div>
  `;
}

function renderProfile() {
  view.innerHTML = `
    <div class="view-stack">
      <div>
        <h1 class="page-title">Profile</h1>
        <p class="page-subtitle">Student account details.</p>
      </div>
      <section class="profile-card">
        <div class="avatar" aria-hidden="true">EV</div>
        <div class="meta">
          <strong>Authenticated Student</strong>
          <span>Your Firebase session is active.</span>
        </div>
      </section>
      <button class="auth-button primary" type="button" data-auth-action="logout">Logout</button>
    </div>
  `;
}

document.addEventListener("click", event => {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) {
    navigate(routeButton.dataset.route);
    return;
  }

  const classButton = event.target.closest("[data-class]");
  if (classButton) {
    // Phase 5 will replace this with the real class/subject route.
    // For Phase 1, the only implemented action is navigation to Classes.
    navigate("classes");
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "profile") navigate("profile");
  if (action === "all-classes") navigate("classes");
});

window.addEventListener("popstate", () => {
  const route = location.hash.replace("#", "") || "home";
  (routes[route] || routes.home)();
  navItems.forEach(item => item.classList.toggle("is-active", item.dataset.route === route));
});

const initialRoute = location.hash.replace("#", "") || "home";
(routes[initialRoute] || routes.home)();
navItems.forEach(item => item.classList.toggle("is-active", item.dataset.route === initialRoute));
