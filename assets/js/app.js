import { database } from "./firebase-init.js";
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
import {
  SUBJECTS,
  SECTIONS,
  loadClassCatalog,
  getCatalogSummary,
  getMaterial,
  getSubject,
  getSection,
  formatFileSize,
  formatMaterialDate,
} from "./catalog.js";
import { loadRecent, saveRecent } from "./recent.js";
import { searchMaterials, debounce } from "./search.js";
import { ref, update } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const CLASSES = [
  { id: "class-6", label: "Class 6", number: 6 },
  { id: "class-7", label: "Class 7", number: 7 },
  { id: "class-8", label: "Class 8", number: 8 },
  { id: "class-9", label: "Class 9", number: 9 },
  { id: "class-10", label: "Class 10", number: 10 },
];

const SUBJECT_BY_ID = Object.fromEntries(SUBJECTS.map((item) => [item.id, item]));
const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((item) => [item.id, item]));

const state = {
  user: null,
  profile: null,
  assignedClass: null,
  catalog: [],
  catalogLoadedFor: null,
  recent: [],
  isBusy: false,
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
  protectedNotesCount: $("#protectedNotesCount"),
  worksheetsCount: $("#worksheetsCount"),
  totalMaterialsCount: $("#totalMaterialsCount"),
  homeClassGrid: $("#homeClassGrid"),

  homeRoute: $("#homeRoute"),
  classesRoute: $("#classesRoute"),
  subjectsRoute: $("#subjectsRoute"),
  sectionsRoute: $("#sectionsRoute"),
  materialsRoute: $("#materialsRoute"),
  materialDetailRoute: $("#materialDetailRoute"),
  searchRoute: $("#searchRoute"),
  recentRoute: $("#recentRoute"),
  notFoundRoute: $("#notFoundRoute"),

  classesGrid: $("#classesGrid"),
  subjectsGrid: $("#subjectsGrid"),
  sectionsGrid: $("#sectionsGrid"),
  materialsList: $("#materialsList"),
  selectedClassTitle: $("#selectedClassTitle"),
  selectedSubjectTitle: $("#selectedSubjectTitle"),
  selectedSectionTitle: $("#selectedSectionTitle"),
  selectedMaterialTitle: $("#selectedMaterialTitle"),

  classesNotice: $("#classesNotice"),
  subjectsNotice: $("#subjectsNotice"),
  sectionsNotice: $("#sectionsNotice"),
  materialsNotice: $("#materialsNotice"),
  searchNotice: $("#searchNotice"),
  recentNotice: $("#recentNotice"),

  materialDetailMeta: $("#materialDetailMeta"),
  materialDetailBody: $("#materialDetailBody"),
  materialsSubjectTitle: $("#materialsSubjectTitle"),

  searchInput: $("#searchInput"),
  searchClearBtn: $("#searchClearBtn"),
  searchResults: $("#searchResults"),
  searchSummary: $("#searchSummary"),

  recentList: $("#recentList"),

  viewClassesBtn: $("#viewClassesBtn"),
  classesBackBtn: $("#classesBackBtn"),
  subjectsBackBtn: $("#subjectsBackBtn"),
  sectionsBackBtn: $("#sectionsBackBtn"),
  materialsBackBtn: $("#materialsBackBtn"),
  materialDetailBackBtn: $("#materialDetailBackBtn"),
  searchBackBtn: $("#searchBackBtn"),
  recentBackBtn: $("#recentBackBtn"),

  materialDetailHomeBtn: $("#materialDetailHomeBtn"),
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

function setButtonBusy(button, busy, busyLabel) {
  if (!button) return;
  button.disabled = busy;

  const label = button.querySelector(".button-label");
  if (!label) return;

  if (busy) {
    button.dataset.defaultLabel = label.textContent;
    label.textContent = busyLabel || "Working…";
  } else if (button.dataset.defaultLabel) {
    label.textContent = button.dataset.defaultLabel;
    delete button.dataset.defaultLabel;
  }
}

function setAuthControlsDisabled(disabled) {
  [elements.emailInput, elements.passwordInput, elements.loginBtn, elements.googleBtn, elements.forgotBtn]
    .forEach((el) => { el.disabled = disabled; });
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
  const number = Number.parseInt(String(value ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isInteger(number) && number >= 6 && number <= 10 ? number : null;
}

function getDisplayName(user, profile) {
  return String(profile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Student").trim();
}

function setRouteVisibility(target) {
  elements.routes.forEach((section) => {
    section.hidden = section.dataset.route !== target;
  });

  const navRoute = ["home", "classes", "search", "recent"].includes(target)
    ? target
    : target === "not-found"
      ? "home"
      : "classes";

  elements.navItems.forEach((button) => {
    const active = button.dataset.nav === navRoute;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
}

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, "").trim();
  if (!raw || raw === "home") return { name: "home" };

  const [pathPart, queryPart = ""] = raw.split("?");
  const parts = pathPart.split("/").filter(Boolean).map((part) => {
    try { return decodeURIComponent(part); } catch { return part; }
  });
  const params = new URLSearchParams(queryPart);

  if (parts[0] === "classes") return { name: "classes" };
  if (parts[0] === "class" && parts[1]) return { name: "subjects", classNumber: Number(parts[1]) };
  if (parts[0] === "subject" && parts[1] && parts[2]) {
    return { name: "sections", classNumber: Number(parts[1]), subjectId: parts[2] };
  }
  if (parts[0] === "section" && parts[1] && parts[2] && parts[3]) {
    return {
      name: "materials",
      classNumber: Number(parts[1]),
      subjectId: parts[2],
      sectionId: parts[3],
    };
  }
  if (parts[0] === "material" && parts[1] && parts[2] && parts[3] && parts[4]) {
    return {
      name: "material-detail",
      classNumber: Number(parts[1]),
      subjectId: parts[2],
      sectionId: parts[3],
      materialId: parts.slice(4).join("/"),
    };
  }
  if (parts[0] === "search") return { name: "search", query: params.get("q") || "" };
  if (parts[0] === "recent") return { name: "recent" };

  return { name: "not-found" };
}

function navigate(route, options = {}) {
  const hash = `#${route}`;
  if (location.hash !== hash) {
    if (options.replace) history.replaceState(null, "", `${location.pathname}${location.search}${hash}`);
    else location.hash = hash;
    return;
  }
  renderRoute(parseRoute());
}

function redirectTo(route) {
  navigate(route);
}

function showView(mode) {
  const isAuth = mode === "auth";
  elements.authView.hidden = !isAuth;
  elements.appView.hidden = isAuth;
}

function showRouteShell() {
  elements.routes.forEach((section) => { section.hidden = true; });
}

function makeLoadingState(message = "Loading…") {
  return `
    <div class="state-card">
      <div class="loading-spinner" aria-hidden="true"></div>
      <strong>${escapeHtml(message)}</strong>
      <span>Please wait a moment.</span>
    </div>
  `;
}

function makeEmptyState(title, detail) {
  return `
    <div class="state-card">
      <div class="empty-icon" aria-hidden="true">∅</div>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
  `;
}

function makeErrorState(message, retryAction) {
  return `
    <div class="state-card">
      <div class="empty-icon error-icon" aria-hidden="true">!</div>
      <strong>Something went wrong</strong>
      <span>${escapeHtml(message)}</span>
      <button class="secondary-button retry-button" type="button" data-retry="${escapeHtml(retryAction)}">Retry</button>
    </div>
  `;
}

function createClassCard(classItem, compact = false) {
  const assigned = state.assignedClass === classItem.number;

  if (!assigned) {
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
    <button class="class-card is-assigned ${compact ? "is-compact" : ""}"
      type="button" data-action="open-class" data-class-number="${classItem.number}">
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
  elements.homeClassGrid.innerHTML = CLASSES.map((item) => createClassCard(item, true)).join("");
  elements.classesGrid.innerHTML = CLASSES.map((item) => createClassCard(item, false)).join("");
}

function createSubjectCard(subject, classNumber) {
  const counts = state.catalog.reduce((acc, material) => {
    if (material.subject === subject.id) acc.total += 1;
    return acc;
  }, { total: 0 });

  return `
    <button class="subject-card" type="button"
      data-action="open-subject"
      data-class-number="${classNumber}"
      data-subject-id="${subject.id}">
      <span class="subject-icon" aria-hidden="true">${subject.icon}</span>
      <span class="subject-card-copy">
        <strong>${escapeHtml(subject.label)}</strong>
        <span>${escapeHtml(subject.description)}</span>
        <small>${counts.total} material${counts.total === 1 ? "" : "s"}</small>
      </span>
      <span class="class-arrow" aria-hidden="true">→</span>
    </button>
  `;
}

function renderSubjects(classNumber) {
  elements.subjectsGrid.innerHTML = SUBJECTS.map((subject) => createSubjectCard(subject, classNumber)).join("");
}

function createSectionCard(section, classNumber, subjectId) {
  const count = state.catalog.filter(
    (material) => material.subject === subjectId && material.section === section.id
  ).length;

  const isNotes = section.id !== "worksheet";

  return `
    <button class="section-card ${isNotes ? "section-notes" : "section-worksheet"}" type="button"
      data-action="open-section"
      data-class-number="${classNumber}"
      data-subject-id="${subjectId}"
      data-section-id="${section.id}">
      <span class="section-icon" aria-hidden="true">${section.icon}</span>
      <span class="section-copy">
        <strong>${escapeHtml(section.label)}</strong>
        <span>${isNotes ? "Read-only study material" : "Practice material"}</span>
        <small>${count} file${count === 1 ? "" : "s"}</small>
      </span>
      <span class="class-arrow" aria-hidden="true">→</span>
    </button>
  `;
}

function renderSections(classNumber, subjectId) {
  elements.sectionsGrid.innerHTML = SECTIONS.map((section) =>
    createSectionCard(section, classNumber, subjectId)
  ).join("");
}

function createMaterialCard(material) {
  const section = SECTION_BY_ID[material.section];
  const subject = SUBJECT_BY_ID[material.subject];

  return `
    <button class="material-card" type="button"
      data-action="open-material"
      data-class-number="${material.class}"
      data-subject-id="${escapeHtml(material.subject)}"
      data-section-id="${escapeHtml(material.section)}"
      data-material-id="${escapeHtml(material.id)}">
      <span class="material-icon ${section?.tone === "worksheet" ? "worksheet" : "notes"}" aria-hidden="true">
        ${section?.tone === "worksheet" ? "⇩" : "▤"}
      </span>
      <span class="material-copy">
        <strong>${escapeHtml(material.title)}</strong>
        ${material.chapter ? `<span>${escapeHtml(material.chapter)}</span>` : ""}
        <small>
          ${escapeHtml(subject?.label || material.subject)} •
          ${escapeHtml(section?.label || material.section)} •
          ${escapeHtml(formatFileSize(material.fileSize))}
        </small>
      </span>
      <span class="material-arrow" aria-hidden="true">→</span>
    </button>
  `;
}

function renderMaterials(classNumber, subjectId, sectionId) {
  const materials = state.catalog.filter(
    (material) =>
      material.class === classNumber &&
      material.subject === subjectId &&
      material.section === sectionId
  );

  if (!materials.length) {
    elements.materialsList.innerHTML = makeEmptyState(
      "No materials available yet",
      "This section is ready. Published materials will appear here automatically."
    );
    return;
  }

  elements.materialsList.innerHTML = materials.map(createMaterialCard).join("");
}

function createRecentCard(item) {
  const subject = SUBJECT_BY_ID[item.subject];
  const section = SECTION_BY_ID[item.section];

  return `
    <button class="material-card recent-card" type="button"
      data-action="open-recent"
      data-class-number="${Number(item.class)}"
      data-subject-id="${escapeHtml(item.subject || "")}"
      data-section-id="${escapeHtml(item.section || "")}"
      data-material-id="${escapeHtml(item.id)}">
      <span class="material-icon ${section?.tone === "worksheet" ? "worksheet" : "notes"}" aria-hidden="true">◷</span>
      <span class="material-copy">
        <strong>${escapeHtml(item.title || "Untitled Material")}</strong>
        ${item.chapter ? `<span>${escapeHtml(item.chapter)}</span>` : ""}
        <small>
          Class ${Number(item.class)} •
          ${escapeHtml(subject?.label || item.subject || "")} •
          ${escapeHtml(section?.label || item.section || "")}
        </small>
      </span>
      <span class="material-arrow" aria-hidden="true">→</span>
    </button>
  `;
}

function ensureAssignedClass(classNumber) {
  const numeric = normaliseClassValue(classNumber);
  return numeric && numeric === state.assignedClass;
}

async function ensureCatalog(classNumber, { force = false, targetNotice = null } = {}) {
  if (!ensureAssignedClass(classNumber)) throw new Error("CLASS_NOT_ALLOWED");

  if (!force && state.catalogLoadedFor === classNumber) return state.catalog;

  if (targetNotice) targetNotice.hidden = true;

  try {
    state.catalog = await loadClassCatalog(classNumber, { force });
    state.catalogLoadedFor = classNumber;
    return state.catalog;
  } catch (error) {
    const message = error?.message === "NETWORK_TIMEOUT"
      ? "The connection is taking too long. Check your internet connection and retry."
      : "We could not load your class catalogue.";
    if (targetNotice) {
      targetNotice.hidden = false;
      targetNotice.textContent = message;
      targetNotice.dataset.retry = "catalog";
    }
    throw error;
  }
}

async function renderHomeData() {
  elements.welcomeHeading.innerHTML = `${escapeHtml(getDisplayName(state.user, state.profile))} <span aria-hidden="true">👋</span>`;
  elements.dateLine.textContent = formatToday();
  elements.classStatus.textContent = state.assignedClass
    ? `Your assigned class: Class ${state.assignedClass}`
    : "Your class assignment is not available.";

  renderClassCards();

  elements.protectedNotesCount.textContent = "…";
  elements.worksheetsCount.textContent = "…";
  elements.totalMaterialsCount.textContent = "…";

  try {
    const summary = await getCatalogSummary(state.assignedClass);
    elements.protectedNotesCount.textContent = String(summary.protectedNotes);
    elements.worksheetsCount.textContent = String(summary.worksheets);
    elements.totalMaterialsCount.textContent = String(summary.total);
  } catch (error) {
    console.error(error);
    elements.protectedNotesCount.textContent = "—";
    elements.worksheetsCount.textContent = "—";
    elements.totalMaterialsCount.textContent = "—";
  }
}

function prepareSubjectsRoute(route) {
  if (!ensureAssignedClass(route.classNumber)) {
    redirectTo(`class/${state.assignedClass}`);
    return false;
  }

  const item = CLASSES.find((entry) => entry.number === state.assignedClass);
  elements.selectedClassTitle.textContent = item?.label || `Class ${state.assignedClass}`;
  return true;
}

async function renderRoute(route) {
  if (!state.user || !state.assignedClass) return;

  showRouteShell();

  try {
    switch (route.name) {
      case "home":
        setRouteVisibility("home");
        await renderHomeData();
        break;

      case "classes":
        setRouteVisibility("classes");
        renderClassCards();
        break;

      case "subjects":
        if (!prepareSubjectsRoute(route)) return;
        setRouteVisibility("subjects");
        elements.subjectsGrid.innerHTML = makeLoadingState("Loading subjects…");
        try {
          await ensureCatalog(state.assignedClass, { targetNotice: elements.subjectsNotice });
          renderSubjects(state.assignedClass);
        } catch {
          elements.subjectsGrid.innerHTML = makeErrorState(
            "Your class catalogue could not be loaded.",
            "subjects"
          );
        }
        break;

      case "sections": {
        if (!prepareSubjectsRoute(route)) return;
        const subject = getSubject(route.subjectId);
        if (!subject) {
          redirectTo(`class/${state.assignedClass}`);
          return;
        }

        setRouteVisibility("sections");
        elements.selectedSubjectTitle.textContent = `${subject.icon} ${subject.label}`;
        elements.sectionsGrid.innerHTML = makeLoadingState("Loading sections…");
        try {
          await ensureCatalog(state.assignedClass, { targetNotice: elements.sectionsNotice });
          renderSections(state.assignedClass, subject.id);
        } catch {
          elements.sectionsGrid.innerHTML = makeErrorState(
            "Your material catalogue could not be loaded.",
            "sections"
          );
        }
        break;
      }

      case "materials": {
        if (!prepareSubjectsRoute(route)) return;
        const subject = getSubject(route.subjectId);
        const section = getSection(route.sectionId);
        if (!subject || !section) {
          redirectTo(`class/${state.assignedClass}`);
          return;
        }

        setRouteVisibility("materials");
        elements.materialsSubjectTitle.textContent = `${subject.icon} ${subject.label}`;
        elements.selectedSectionTitle.textContent = section.label;
        elements.materialsList.innerHTML = makeLoadingState("Loading materials…");

        try {
          await ensureCatalog(state.assignedClass, { targetNotice: elements.materialsNotice });
          renderMaterials(state.assignedClass, subject.id, section.id);
        } catch {
          elements.materialsList.innerHTML = makeErrorState(
            "Could not load materials. Check your connection and retry.",
            "materials"
          );
        }
        break;
      }

      case "material-detail": {
        if (!prepareSubjectsRoute(route)) return;
        const subject = getSubject(route.subjectId);
        const section = getSection(route.sectionId);
        if (!subject || !section) {
          redirectTo(`class/${state.assignedClass}`);
          return;
        }

        setRouteVisibility("material-detail");
        elements.selectedMaterialTitle.textContent = "Loading material…";
        elements.materialDetailBody.innerHTML = makeLoadingState("Loading material details…");

        try {
          await ensureCatalog(state.assignedClass, { targetNotice: elements.materialDetailRoute });
          const material = await getMaterial(state.assignedClass, route.materialId);

          if (!material) {
            elements.materialDetailBody.innerHTML = makeErrorState(
              "That material is unavailable or has been unpublished.",
              "material-detail"
            );
            return;
          }

          elements.selectedMaterialTitle.textContent = material.title;
          elements.materialDetailMeta.textContent =
            `Class ${material.class} • ${subject.label} • ${section.label}`;

          elements.materialDetailBody.innerHTML = `
            <div class="material-detail-card card">
              <div class="detail-icon ${section.tone === "worksheet" ? "worksheet" : "notes"}">
                ${section.tone === "worksheet" ? "⇩" : "▤"}
              </div>
              <p class="eyebrow">${escapeHtml(section.label)}</p>
              <h2>${escapeHtml(material.title)}</h2>
              ${material.chapter ? `<p class="detail-chapter">${escapeHtml(material.chapter)}</p>` : ""}
              <div class="detail-grid">
                <div><span>Subject</span><strong>${escapeHtml(subject.label)}</strong></div>
                <div><span>Class</span><strong>Class ${material.class}</strong></div>
                <div><span>File</span><strong>${escapeHtml(material.fileName || "PDF")}</strong></div>
                <div><span>Size</span><strong>${escapeHtml(formatFileSize(material.fileSize))}</strong></div>
                <div><span>Updated</span><strong>${escapeHtml(formatMaterialDate(material.updatedAt))}</strong></div>
              </div>
              <div class="detail-info">
                <strong>Material selected successfully.</strong>
                <span>
                  The protected reader and worksheet download actions are intentionally connected
                  in Phases 12–13. This page confirms the correct Firebase catalog item without
                  exposing a public PDF URL.
                </span>
              </div>
            </div>
          `;

          // Recent means the student actually opened a material detail entry.
          saveRecent(state.user.uid, material).catch((error) => console.warn("Recent save failed:", error));
        } catch (error) {
          console.error(error);
          elements.materialDetailBody.innerHTML = makeErrorState(
            "Could not load this material. Please retry.",
            "material-detail"
          );
        }
        break;
      }

      case "search":
        await renderSearch(route.query || "");
        break;

      case "recent":
        await renderRecent();
        break;

      default:
        setRouteVisibility("not-found");
    }
  } catch (error) {
    console.error("Route error:", error);
    setRouteVisibility("not-found");
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function renderSearch(query) {
  setRouteVisibility("search");
  elements.searchInput.value = query;
  elements.searchSummary.textContent = "";

  if (!state.catalogLoadedFor || state.catalogLoadedFor !== state.assignedClass) {
    elements.searchResults.innerHTML = makeLoadingState("Preparing search…");
    try {
      await ensureCatalog(state.assignedClass, { targetNotice: elements.searchNotice });
    } catch {
      elements.searchResults.innerHTML = makeErrorState(
        "Search could not load your class catalogue.",
        "search"
      );
      return;
    }
  }

  const results = searchMaterials(state.catalog, query);

  if (!query.trim()) {
    elements.searchSummary.textContent = "Search your class materials by chapter, title, subject or file.";
    elements.searchResults.innerHTML = makeEmptyState(
      "Start searching",
      "Try a chapter name, material title, subject, or file name."
    );
    return;
  }

  elements.searchSummary.textContent = `${results.length} result${results.length === 1 ? "" : "s"} found`;

  if (!results.length) {
    elements.searchResults.innerHTML = makeEmptyState(
      "No results found",
      "Try a different title, chapter name, subject or keyword."
    );
    return;
  }

  elements.searchResults.innerHTML = results.map(createMaterialCard).join("");
}

async function renderRecent() {
  setRouteVisibility("recent");
  elements.recentList.innerHTML = makeLoadingState("Loading recent materials…");

  try {
    state.recent = await loadRecent(state.user.uid);

    if (!state.recent.length) {
      elements.recentList.innerHTML = makeEmptyState(
        "No recent materials",
        "Materials you open will appear here for quick access."
      );
      return;
    }

    elements.recentList.innerHTML = state.recent.map(createRecentCard).join("");
  } catch (error) {
    console.error(error);
    elements.recentList.innerHTML = makeErrorState(
      error?.message === "NETWORK_TIMEOUT"
        ? "The request took too long. Please retry."
        : "We could not load your recent materials.",
      "recent"
    );
  }
}

async function openRecentItem(item) {
  if (!ensureAssignedClass(item.class)) {
    setGlobalStatus("This recent item is outside your assigned class.");
    setTimeout(() => setGlobalStatus(""), 1800);
    return;
  }

  redirectTo(
    `material/${item.class}/${encodeURIComponent(item.subject)}/${encodeURIComponent(item.section)}/${encodeURIComponent(item.id)}`
  );
}

function bindDelegatedActions() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;

    const action = button.dataset.action;

    if (action === "open-class") {
      const classNumber = Number(button.dataset.classNumber);
      if (ensureAssignedClass(classNumber)) redirectTo(`class/${classNumber}`);
      return;
    }

    if (action === "open-subject") {
      const classNumber = Number(button.dataset.classNumber);
      if (ensureAssignedClass(classNumber)) {
        redirectTo(`subject/${classNumber}/${encodeURIComponent(button.dataset.subjectId)}`);
      }
      return;
    }

    if (action === "open-section") {
      const classNumber = Number(button.dataset.classNumber);
      if (ensureAssignedClass(classNumber)) {
        redirectTo(
          `section/${classNumber}/${encodeURIComponent(button.dataset.subjectId)}/${encodeURIComponent(button.dataset.sectionId)}`
        );
      }
      return;
    }

    if (action === "open-material") {
      const classNumber = Number(button.dataset.classNumber);
      if (ensureAssignedClass(classNumber)) {
        redirectTo(
          `material/${classNumber}/${encodeURIComponent(button.dataset.subjectId)}/${encodeURIComponent(button.dataset.sectionId)}/${encodeURIComponent(button.dataset.materialId)}`
        );
      }
      return;
    }

    if (action === "open-recent") {
      const item = state.recent.find((entry) => entry.id === button.dataset.materialId);
      if (item) await openRecentItem(item);
      return;
    }

    if (button.dataset.retry) {
      const retry = button.dataset.retry;
      if (retry === "subjects") await renderRoute({ name: "subjects", classNumber: state.assignedClass });
      else if (retry === "sections") {
        const parsed = parseRoute();
        await renderRoute(parsed);
      } else if (retry === "materials" || retry === "material-detail") {
        await renderRoute(parseRoute());
      } else if (retry === "search") await renderSearch(elements.searchInput.value.trim());
      else if (retry === "recent") await renderRecent();
    }
  });
}

function syncSearchHash() {
  const query = elements.searchInput.value.trim();
  const encoded = encodeURIComponent(query);
  const target = query ? `search?q=${encoded}` : "search";
  if (location.hash !== `#${target}`) {
    history.replaceState(null, "", `${location.pathname}${location.search}#${target}`);
  }
}

const onSearchInput = debounce(() => {
  syncSearchHash();
  renderSearch(elements.searchInput.value.trim());
}, 220);

function onSearchClear() {
  elements.searchInput.value = "";
  syncSearchHash();
  renderSearch("");
  elements.searchInput.focus();
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

async function handleAuthenticatedUser(user) {
  state.user = user;

  try {
    const profile = await loadStudentProfile(user.uid);
    const assigned = normaliseClassValue(profile?.class);

    if (!profile || !assigned) {
      await logout().catch(() => {});
      showView("auth");
      setAuthMessage(
        "Your student account has not been assigned to a class yet. Please contact EZEE VISION CHAMPUA.",
        "error"
      );
      return;
    }

    state.profile = profile;
    state.assignedClass = assigned;
    state.catalog = [];
    state.catalogLoadedFor = null;

    showView("app");
    renderClassCards();

    const current = parseRoute();
    const safeRoute = ["home", "classes", "search", "recent"].includes(current.name)
      ? current
      : current.name === "subjects" || current.name === "sections" || current.name === "materials" || current.name === "material-detail"
        ? current
        : { name: "home" };

    if (location.hash === "") {
      history.replaceState(null, "", `${location.pathname}${location.search}#home`);
    }

    await renderRoute(safeRoute);
  } catch (error) {
    console.error(error);
    await logout().catch(() => {});
    showView("auth");
    setAuthMessage(
      error?.message === "NETWORK_TIMEOUT"
        ? "Network is slow right now. Please sign in again."
        : "We could not load your student profile. Please try again.",
      "error"
    );
  }
}

function handleLoggedOut() {
  state.user = null;
  state.profile = null;
  state.assignedClass = null;
  state.catalog = [];
  state.catalogLoadedFor = null;
  state.recent = [];
  showView("auth");
  setAuthControlsDisabled(false);
  setButtonBusy(elements.loginBtn, false);
  setAuthMessage("");
  history.replaceState(null, "", `${location.pathname}${location.search}`);
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

  elements.viewClassesBtn.addEventListener("click", () => redirectTo("classes"));
  elements.classesBackBtn.addEventListener("click", () => redirectTo("home"));
  elements.subjectsBackBtn.addEventListener("click", () => redirectTo("classes"));
  elements.sectionsBackBtn.addEventListener("click", () => {
    const parsed = parseRoute();
    redirectTo(`class/${parsed.classNumber || state.assignedClass}`);
  });
  elements.materialsBackBtn.addEventListener("click", () => {
    const parsed = parseRoute();
    redirectTo(`subject/${parsed.classNumber || state.assignedClass}/${parsed.subjectId}`);
  });
  elements.materialDetailBackBtn.addEventListener("click", () => {
    const parsed = parseRoute();
    redirectTo(`section/${parsed.classNumber || state.assignedClass}/${parsed.subjectId}/${parsed.sectionId}`);
  });
  elements.searchBackBtn.addEventListener("click", () => redirectTo("home"));
  elements.recentBackBtn.addEventListener("click", () => redirectTo("home"));

  elements.materialDetailHomeBtn.addEventListener("click", () => redirectTo("home"));
  elements.fallbackHomeBtn.addEventListener("click", () => redirectTo("home"));

  elements.searchInput.addEventListener("input", onSearchInput);
  elements.searchClearBtn.addEventListener("click", onSearchClear);

  elements.navItems.forEach((button) => {
    button.addEventListener("click", () => redirectTo(button.dataset.nav));
  });

  bindDelegatedActions();

  window.addEventListener("hashchange", () => {
    if (state.user && state.assignedClass) renderRoute(parseRoute());
  });

  window.addEventListener("online", () => {
    setGlobalStatus("Back online.");
    setTimeout(() => setGlobalStatus(""), 1600);
  });

  window.addEventListener("offline", () => {
    setGlobalStatus("You’re offline. Firebase-backed data may not load.");
  });
}

async function bootstrap() {
  bindEvents();

  try {
    await configureAuthPersistence();
  } catch (error) {
    console.warn("Could not configure auth persistence:", error);
  }

  observeAuth(async (user) => {
    if (user) await handleAuthenticatedUser(user);
    else handleLoggedOut();
  });

  // Register the PWA shell after the page is ready. Errors are non-fatal.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  }
}

bootstrap().catch((error) => {
  console.error(error);
  showView("auth");
  setAuthMessage("Application failed to initialise. Refresh and try again.", "error");
});
