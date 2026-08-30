import { database } from "./firebase-init.js";
import {
  configureAuthPersistence,
  observeAuth,
  loginWithPassword,
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
import { updateStudentDisplayName, getFriendlyProfileError, refreshStudentProfile } from "./profile.js";
import { createProtectedReaderController } from "./pdf-reader.js";
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
  profileForm: $("#profileForm"),
  profileNameInput: $("#profileNameInput"),
  profileEmailInput: $("#profileEmailInput"),
  profileClassInput: $("#profileClassInput"),
  profileAvatar: $("#profileAvatar"),
  profileMessage: $("#profileMessage"),
  profileSaveBtn: $("#profileSaveBtn"),
  profileRefreshBtn: $("#profileRefreshBtn"),

  readerModal: $("#readerModal"),
  readerTitle: $("#readerTitle"),
  readerStatus: $("#readerStatus"),
  readerCanvas: $("#readerCanvas"),
  readerWatermark: $("#readerWatermark"),
  readerPage: $("#readerPage"),
  readerZoomLabel: $("#readerZoomLabel"),
  readerPrev: $("#readerPrev"),
  readerNext: $("#readerNext"),
  readerZoomOut: $("#readerZoomOut"),
  readerZoomIn: $("#readerZoomIn"),
  readerClose: $("#readerClose"),
  readerRetry: $("#readerRetry"),
  
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
  topbarAvatar: $("#topbarAvatar"),
  profileBackBtn: $("#profileBackBtn"),
  profileLogoutBtn: $("#profileLogoutBtn"),
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
  [elements.emailInput, elements.passwordInput, elements.loginBtn]
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
      : target === "profile"
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
  if (parts[0] === "profile") return { name: "profile" };

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


let readerController = null;
let readerBusy = false;

function getStudentWatermark() {
  const name = getDisplayName(state.user, state.profile);
  const email = state.user?.email || state.profile?.email || "";
  return `EZEE VISION CHAMPUA (Shahid Sir) • ${name}${email ? ` • ${email}` : ""}`;
}

function setReaderBusy(busy) {
  readerBusy = Boolean(busy);
  elements.readerRetry.disabled = busy;
  elements.readerClose.disabled = busy;
}

function setProfileMessage(message = "", type = "") {
  elements.profileMessage.textContent = message;
  elements.profileMessage.className = `inline-message ${type}`.trim();
}

function populateProfileForm() {
  const name = getDisplayName(state.user, state.profile);
  elements.profileNameInput.value = name === "Student" ? "" : name;
  elements.profileEmailInput.value = state.user?.email || state.profile?.email || "";
  elements.profileClassInput.value = state.assignedClass ? `Class ${state.assignedClass}` : "Not assigned";
  const initial = name.trim().charAt(0).toUpperCase() || "S";
  elements.profileAvatar.textContent = initial;
}

async function refreshProfileView() {
  if (!state.user) return;
  elements.profileRefreshBtn.disabled = true;
  setProfileMessage("Refreshing profile…", "loading");
  try {
    const fresh = await refreshStudentProfile(state.user.uid);
    const assigned = normaliseClassValue(fresh?.class);

    if (!fresh || !assigned) {
      throw new Error("PROFILE_NOT_AVAILABLE");
    }

    state.profile = fresh;
    state.assignedClass = assigned;
    populateProfileForm();
    setProfileMessage("Profile refreshed.", "success");
  } catch (error) {
    console.error(error);
    setProfileMessage(
      error?.message === "NETWORK_TIMEOUT"
        ? "Refresh timed out. Please retry."
        : "Profile could not be refreshed.",
      "error"
    );
  } finally {
    elements.profileRefreshBtn.disabled = false;
  }
}

async function saveProfile(event) {
  event.preventDefault();
  if (!state.user || state.isBusy) return;

  const name = elements.profileNameInput.value.trim();
  if (name.length < 2) {
    setProfileMessage("Name must contain at least 2 characters.", "error");
    elements.profileNameInput.focus();
    return;
  }
  if (name.length > 60) {
    setProfileMessage("Name must be 60 characters or fewer.", "error");
    elements.profileNameInput.focus();
    return;
  }

  state.isBusy = true;
  elements.profileSaveBtn.disabled = true;
  elements.profileRefreshBtn.disabled = true;
  setProfileMessage("Saving profile…", "loading");

  try {
    const savedName = await updateStudentDisplayName(state.user.uid, name);
    state.profile = { ...(state.profile || {}), displayName: savedName, updatedAt: Date.now() };
    populateHome();
    populateProfileForm();
    setProfileMessage("Profile saved successfully.", "success");
  } catch (error) {
    console.error(error);
    setProfileMessage(getFriendlyProfileError(error), "error");
  } finally {
    elements.profileSaveBtn.disabled = false;
    elements.profileRefreshBtn.disabled = false;
    state.isBusy = false;
  }
}

async function openMaterialAction(material) {
  if (!material?.storagePath) {
    setGlobalStatus("This material is missing its storage path.");
    setTimeout(() => setGlobalStatus(""), 2200);
    return;
  }

  try {
    if (material.section === "worksheet") {
      setGlobalStatus("Preparing worksheet download…");
      await readerController.downloadWorksheet(material);
      setGlobalStatus("Worksheet download started.");
    } else {
      await readerController.open(material, getStudentWatermark());
    }
  } catch (error) {
    console.error(error);
    const message = String(error?.code || "").includes("storage/unauthorized")
      ? "You are not authorised to access this material."
      : "The material could not be opened. Please retry.";
    setGlobalStatus(message);
  } finally {
    setTimeout(() => setGlobalStatus(""), 2600);
  }
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
  const displayName = getDisplayName(state.user, state.profile);
  elements.welcomeHeading.innerHTML = `${escapeHtml(displayName)} <span aria-hidden="true">👋</span>`;
  elements.topbarAvatar.textContent = displayName.trim().charAt(0).toUpperCase() || "S";
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
                <strong>${section.id === "worksheet" ? "Worksheet download" : "Protected Notes Reader"}</strong>
                <span>
                  ${section.id === "worksheet"
                    ? "Worksheets are downloadable study resources."
                    : "Detailed and short notes open inside the protected in-app reader. The PDF is fetched as bytes and rendered in the application instead of exposing a direct PDF link."}
                </span>
              </div>

              <div class="material-action-row">
                <button class="primary-button material-action-button" id="openMaterialNowBtn" type="button">
                  ${section.id === "worksheet" ? "Download Worksheet" : "Open Protected Reader"}
                </button>
              </div>
            </div>
          `;

          const openMaterialNowBtn = document.querySelector("#openMaterialNowBtn");
          openMaterialNowBtn.addEventListener("click", async () => {
            openMaterialNowBtn.disabled = true;
            openMaterialNowBtn.textContent = section.id === "worksheet" ? "Preparing…" : "Opening…";
            try {
              await openMaterialAction(material);
              saveRecent(state.user.uid, material).catch((error) => console.warn("Recent save failed:", error));
            } finally {
              openMaterialNowBtn.disabled = false;
              openMaterialNowBtn.textContent = section.id === "worksheet" ? "Download Worksheet" : "Open Protected Reader";
            }
          });
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

      case "profile":
        setRouteVisibility("profile");
        populateProfileForm();
        setProfileMessage("");
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

  if (!email) {
    setAuthMessage("Enter your Student ID.", "error");
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
    const loginId = email.includes("@") ? email : `${email.toLowerCase()}@students.ezeevisionchampua.com`;
    await loginWithPassword(loginId, password);
  } catch (error) {
    console.error(error);
    setAuthMessage(getFriendlyAuthError(error), "error");
    setAuthControlsDisabled(false);
    setButtonBusy(elements.loginBtn, false);
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
  try { await user.getIdToken(true); } catch (tokenError) { console.warn("Could not refresh auth token:", tokenError); }

  try {
    const profile = await loadStudentProfile(user.uid);
    const tokenResult = await user.getIdTokenResult(true);
    const assigned = normaliseClassValue(profile?.class);
    const role = String(profile?.role || tokenResult.claims?.role || "student").toLowerCase();
    const claimActive = tokenResult.claims?.active !== false;

    if (!profile || !assigned || profile.active === false || !claimActive || role !== "student") {
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
    const safeRoute = ["home", "classes", "search", "recent", "profile"].includes(current.name)
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

  elements.profileForm.addEventListener("submit", saveProfile);
  elements.profileRefreshBtn.addEventListener("click", refreshProfileView);
  elements.profileBackBtn.addEventListener("click", () => redirectTo("home"));
  elements.profileLogoutBtn.addEventListener("click", onLogout);

  // Profile is an explicit app-area action, not a duplicate page.
  const profileOpenBtn = document.querySelector("#profileOpenBtn");
  profileOpenBtn.addEventListener("click", () => redirectTo("profile"));

  // One reader controller for the entire SPA.
  readerController = createProtectedReaderController(
    {
      readerModal: elements.readerModal,
      readerTitle: elements.readerTitle,
      readerStatus: elements.readerStatus,
      readerCanvas: elements.readerCanvas,
      readerWatermark: elements.readerWatermark,
      readerPage: elements.readerPage,
      readerZoomLabel: elements.readerZoomLabel,
      readerPrev: elements.readerPrev,
      readerNext: elements.readerNext,
      readerZoomOut: elements.readerZoomOut,
      readerZoomIn: elements.readerZoomIn,
      readerClose: elements.readerClose,
      readerRetry: elements.readerRetry,
    },
    { onBusyChange: setReaderBusy }
  );
  readerController.bind();

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
  // Bind first so every visible control has a handler even before Firebase state resolves.
  bindEvents();
  showView("auth");
  setAuthMessage("Connecting securely…", "loading");

  try {
    await configureAuthPersistence();
  } catch (error) {
    console.warn("Auth persistence configuration failed:", error);
    // Persistence is a preference; Firebase can still authenticate with its default.
  }

  try {
    observeAuth(async (user) => {
      try {
        if (user) await handleAuthenticatedUser(user);
        else handleLoggedOut();
      } catch (error) {
        console.error("Auth observer error:", error);
        state.isBusy = false;
        showView("auth");
        setAuthControlsDisabled(false);
        setAuthMessage("We could not restore your session. Please sign in again.", "error");
      }
    });
  } catch (error) {
    console.error("Auth observer could not start:", error);
    showView("auth");
    setAuthControlsDisabled(false);
    setAuthMessage("Authentication could not start. Check Firebase configuration and refresh.", "error");
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  }
}

bootstrap().catch((error) => {
  console.error("Startup error:", error);
  showView("auth");
  setAuthControlsDisabled(false);
  setAuthMessage(
    "Startup could not be completed. Check your network/Firebase configuration and retry.",
    "error"
  );
});
