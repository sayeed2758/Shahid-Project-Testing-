import { database } from "./firebase-init.js";
import {
  configureAuthPersistence,
  observeAuth,
  loginWithStudentId,
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
import { updateStudentDisplayName, getFriendlyProfileError, refreshStudentProfile, deleteStudentAccount, uploadStudentPhoto } from "./profile.js";
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
  features: null,
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
  homeAnnouncements: $("#homeAnnouncements"),
  homeNotifications: $("#homeNotifications"),
  homeFeatureActions: $("#homeFeatureActions"),

  homeRoute: $("#homeRoute"),
  classesRoute: $("#classesRoute"),
  subjectsRoute: $("#subjectsRoute"),
  sectionsRoute: $("#sectionsRoute"),
  materialsRoute: $("#materialsRoute"),
  materialDetailRoute: $("#materialDetailRoute"),
  searchRoute: $("#searchRoute"),
  recentRoute: $("#recentRoute"),
  notificationsRoute: $("#notificationsRoute"),
  practiceRoute: $("#practiceRoute"),
  practiceTestRoute: $("#practiceTestRoute"),
  performanceRoute: $("#performanceRoute"),
  plannerRoute: $("#plannerRoute"),
  contactRoute: $("#contactRoute"),
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
  practiceShortcut: $("#practiceShortcut"),
  practicePageTitle: $("#practicePageTitle"),
  notificationsContent: $("#notificationsContent"),
  practiceContent: $("#practiceContent"),
  practiceTestContent: $("#practiceTestContent"),
  performanceContent: $("#performanceContent"),
  plannerContent: $("#plannerContent"),

  searchInput: $("#searchInput"),
  searchClearBtn: $("#searchClearBtn"),
  searchResults: $("#searchResults"),
  searchSummary: $("#searchSummary"),

  recentList: $("#recentList"),
  profileForm: $("#profileForm"),
  profileNameInput: $("#profileNameInput"),
  profileStudentIdInput: $("#profileStudentIdInput"),
  profileClassInput: $("#profileClassInput"),
  profileAvatar: $("#profileAvatar"),
  profilePhotoInput: $("#profilePhotoInput"),
  profilePhotoBtn: $("#profilePhotoBtn"),
  profileMessage: $("#profileMessage"),
  profileSaveBtn: $("#profileSaveBtn"),
  profileRefreshBtn: $("#profileRefreshBtn"),
  profileDeleteBtn: $("#profileDeleteBtn"),

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
  notificationsBackBtn: $("#notificationsBackBtn"),
  practiceBackBtn: $("#practiceBackBtn"),
  practiceTestBackBtn: $("#practiceTestBackBtn"),
  performanceBackBtn: $("#performanceBackBtn"),
  plannerBackBtn: $("#plannerBackBtn"),
  contactBackBtn: $("#contactBackBtn"),

  menuOpenBtn: $("#menuOpenBtn"),
  menuCloseBtn: $("#menuCloseBtn"),
  menuBackdrop: $("#menuBackdrop"),
  appMenu: $("#appMenu"),
  menuItems: [...document.querySelectorAll("[data-menu-nav]")],

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
    : "home";

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
  if (/^(notifications?|announc(e)?ments?|announcement-view|notice|notices)$/i.test(parts[0] || "")) {
    const announcementId = parts[1] || params.get("id") || params.get("announcementId") || "";
    return { name: "notifications", announcementId };
  }
  if (parts[0] === "practice" && parts[1] && parts[2]) return { name: "practice", classNumber: Number(parts[1]), subjectId: parts[2] };
  if (parts[0] === "practice-test" && parts[1] && parts[2] && parts[3]) return { name: "practice-test", classNumber: Number(parts[1]), subjectId: parts[2], testId: parts.slice(3).join("/") };
  if (parts[0] === "performance") return { name: "performance" };
  if (parts[0] === "planner") return { name: "planner" };
  if (parts[0] === "contact") return { name: "contact" };
  if (parts[0] === "profile") return { name: "profile" };

  return { name: "not-found" };
}

function setMenuOpen(open) {
  elements.appMenu.classList.toggle("is-open", open);
  elements.menuBackdrop.hidden = !open;
  elements.menuOpenBtn.setAttribute("aria-expanded", open ? "true" : "false");
  elements.appMenu.setAttribute("aria-hidden", open ? "false" : "true");
  document.body.classList.toggle("menu-is-open", open);
}

function closeMenu() {
  setMenuOpen(false);
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

  const isDownloadable = Boolean(section.downloadable);

  return `
    <button class="section-card ${isDownloadable ? "section-worksheet" : "section-notes"}" type="button"
      data-action="open-section"
      data-class-number="${classNumber}"
      data-subject-id="${subjectId}"
      data-section-id="${section.id}">
      <span class="section-icon" aria-hidden="true">${section.icon}</span>
      <span class="section-copy">
        <strong>${escapeHtml(section.label)}</strong>
        <span>${isDownloadable ? "Downloadable practice paper" : "Read-only study material"}</span>
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
  if (elements.practiceShortcut) {
    elements.practiceShortcut.innerHTML = `
      <button class="practice-shortcut card" type="button" data-action="open-practice" data-class-number="${classNumber}" data-subject-id="${escapeHtml(subjectId)}">
        <span class="practice-shortcut-icon">📝</span>
        <span><strong>Practice</strong><small>MCQ • Fill in the Blanks • True / False • Timed</small></span>
        <b>→</b>
      </button>`;
  }
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
      <span class="material-icon ${section?.downloadable ? "worksheet" : "notes"}" aria-hidden="true">
        ${section?.icon || (section?.downloadable ? "⇩" : "▤")}
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

function profilePhotoStorageKey() {
  return state.user?.uid ? `ezee_profile_photo_${state.user.uid}` : "";
}

function getStoredProfilePhoto() {
  const key = profilePhotoStorageKey();
  if (!key) return "";
  try { return String(localStorage.getItem(key) || "").trim(); } catch { return ""; }
}

function renderTopbarAvatar(photoURL, initial) {
  const remote = String(photoURL || "").trim();
  const fallback = getStoredProfilePhoto();
  const source = remote || fallback;

  if (!source) {
    elements.topbarAvatar.textContent = initial;
    elements.topbarAvatar.classList.remove("has-photo");
    return;
  }

  elements.topbarAvatar.innerHTML = `<img src="${escapeHtml(source)}" alt="Student photo" loading="eager" decoding="async">`;
  elements.topbarAvatar.classList.add("has-photo");

  const img = elements.topbarAvatar.querySelector("img");
  img?.addEventListener("error", () => {
    const safeFallback = getStoredProfilePhoto();
    if (safeFallback && img.getAttribute("src") !== safeFallback) {
      img.src = safeFallback;
    } else {
      elements.topbarAvatar.textContent = initial;
      elements.topbarAvatar.classList.remove("has-photo");
    }
  }, { once: true });
}

function renderProfilePhoto(photoURL, initial) {
  const remote = String(photoURL || "").trim();
  const fallback = getStoredProfilePhoto();
  const source = remote || fallback;

  renderTopbarAvatar(remote, initial);

  if (!source) {
    elements.profileAvatar.textContent = initial;
    elements.profileAvatar.classList.remove("has-photo");
    return;
  }
  elements.profileAvatar.innerHTML = `<img src="${escapeHtml(source)}" alt="Student photo" loading="eager" decoding="async">`;
  elements.profileAvatar.classList.add("has-photo");
  const img = elements.profileAvatar.querySelector("img");
  img?.addEventListener("error", () => {
    const safeFallback = getStoredProfilePhoto();
    if (safeFallback && img.getAttribute("src") !== safeFallback) {
      img.src = safeFallback;
    } else {
      elements.profileAvatar.textContent = initial;
      elements.profileAvatar.classList.remove("has-photo");
    }
  }, { once: true });
}

function populateProfileForm() {
  const name = getDisplayName(state.user, state.profile);
  elements.profileNameInput.value = name === "Student" ? "" : name;
  elements.profileStudentIdInput.value = state.profile?.studentId || "";
  elements.profileClassInput.value = state.assignedClass ? `Class ${state.assignedClass}` : "Not assigned";
  const initial = name.trim().charAt(0).toUpperCase() || "S";
  const photoURL = String(state.profile?.photoURL || state.user?.photoURL || "").trim();
  renderProfilePhoto(photoURL, initial);
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

async function changeProfilePhoto() {
  if (!state.user || state.isBusy || !elements.profilePhotoInput) return;
  elements.profilePhotoInput.click();
}

async function onProfilePhotoSelected(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file || !state.user || state.isBusy) return;
  state.isBusy = true;
  elements.profilePhotoBtn.disabled = true;
  elements.profileSaveBtn.disabled = true;
  elements.profileRefreshBtn.disabled = true;
  setProfileMessage("Uploading photo…", "loading");
  let previewURL = "";
  try {
    previewURL = URL.createObjectURL(file);
    const previewReader = new FileReader();
    previewReader.onload = () => {
      const value = String(previewReader.result || "");
      if (!value) return;
      const key = profilePhotoStorageKey();
      if (key) {
        try { localStorage.setItem(key, value); } catch { /* local fallback is best-effort */ }
      }
      const name = getDisplayName(state.user, state.profile);
      renderProfilePhoto(value, name.trim().charAt(0).toUpperCase() || "S");
    };
    previewReader.readAsDataURL(file);

    const photoURL = await uploadStudentPhoto(state.user.uid, file);
    state.profile = { ...(state.profile || {}), photoURL, updatedAt: Date.now() };
    renderTopbarAvatar(photoURL, getDisplayName(state.user, state.profile).trim().charAt(0).toUpperCase() || "S");
    try {
      const key = profilePhotoStorageKey();
      if (key) localStorage.removeItem(key);
    } catch { /* best-effort cleanup */ }
    populateProfileForm();
    setProfileMessage("Profile photo saved successfully.", "success");
  } catch (error) {
    console.error(error);
    const messages = {
      PROFILE_PHOTO_TYPE: "Please choose an image file.",
      PROFILE_PHOTO_TOO_LARGE: "Photo is too large. Please choose an image under 8 MB.",
      PROFILE_PHOTO_INVALID: "This photo could not be processed. Please choose another image.",
      PROFILE_AUTH_REQUIRED: "Your session is no longer valid. Please sign in again.",
    };
    setProfileMessage(messages[error?.message] || "Photo could not be saved. Please try again.", "error");
  } finally {
    if (previewURL) URL.revokeObjectURL(previewURL);
    elements.profilePhotoBtn.disabled = false;
    elements.profileSaveBtn.disabled = false;
    elements.profileRefreshBtn.disabled = false;
    state.isBusy = false;
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

function downloadMaterial(material) {
  const driveFileId = String(material?.driveFileId || "").trim();
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(driveFileId)) {
    setGlobalStatus("This material has no valid download source.");
    setTimeout(() => setGlobalStatus(""), 2200);
    return;
  }

  const safeName = String(material?.title || "learning-material")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\\s+/g, " ")
    .trim()
    .slice(0, 120) || "learning-material";

  const url = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`;
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.download = `${safeName}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function openMaterialAction(material) {
  if (!material?.driveFileId && !material?.storagePath) {
    setGlobalStatus("This material has no readable source file.");
    setTimeout(() => setGlobalStatus(""), 2200);
    return;
  }

  try {
    setGlobalStatus(material.section === "worksheet" ? "Opening worksheet in app…" : "Opening PDF in app…");
    await readerController.open(material, getStudentWatermark());
  } catch (error) {
    console.error(error);
    const message = error?.code === "PDF_ACCESS_DENIED" ? "You are not authorised to access this material." : error?.message === "DRIVE_GATEWAY_NOT_CONFIGURED" ? "This material is not configured for the app viewer yet." : "The material could not be opened. Please retry.";
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
  const initial = displayName.trim().charAt(0).toUpperCase() || "S";
  const photoURL = String(state.profile?.photoURL || state.user?.photoURL || "").trim();
  elements.welcomeHeading.innerHTML = `${escapeHtml(displayName)} <span aria-hidden="true">👋</span>`;
  renderTopbarAvatar(photoURL, initial);
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

  if (state.features) {
    try {
      await state.features.loadNotifications();
      await state.features.renderAnnouncements(elements.homeAnnouncements);
      state.features.renderHomeWidgets({
        announcementsEl: elements.homeAnnouncements,
        notificationsEl: elements.homeNotifications,
        homeActionsEl: elements.homeFeatureActions,
      });
    } catch (error) {
      console.warn("Student feature home widgets failed:", error);
    }
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
                <strong>Google Drive PDF Viewer</strong>
                <span>
                  ${section.downloadable
                    ? "This paper opens inside the app and also has a download option."
                    : "This study material opens inside the app. Download and print remain controlled by the Drive sharing settings."}
                </span>
              </div>

              <div class="material-action-row ${section.downloadable ? "has-download" : ""}">
                <button class="primary-button material-action-button" id="openMaterialNowBtn" type="button">
                  Open PDF in App
                </button>
                ${section.downloadable
                  ? `<button class="secondary-button material-action-button" id="downloadMaterialBtn" type="button">Download PDF</button>`
                  : ""}
              </div>
              <a class="whatsapp-material-help" href="https://wa.me/919124478453?text=${encodeURIComponent(`Sir, I need help with ${material.title} on EZEE VISION CHAMPUA application.`)}" target="_blank" rel="noopener noreferrer">
                <span>💬</span><span><strong>Ask Teacher on WhatsApp</strong><small>Get help with this material</small></span><b>→</b>
              </a>
            </div>
          `;

          const openMaterialNowBtn = document.querySelector("#openMaterialNowBtn");
          openMaterialNowBtn.addEventListener("click", async () => {
            openMaterialNowBtn.disabled = true;
            openMaterialNowBtn.textContent = "Opening…";
            try {
              await openMaterialAction(material);
              saveRecent(state.user.uid, material).catch((error) => console.warn("Recent save failed:", error));
            } finally {
              openMaterialNowBtn.disabled = false;
              openMaterialNowBtn.textContent = "Open PDF in App";
            }
          });

          if (section.downloadable) {
            const downloadMaterialBtn = document.querySelector("#downloadMaterialBtn");
            downloadMaterialBtn?.addEventListener("click", () => {
              downloadMaterial(material);
            });
          }
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

      case "notifications":
        if (!elements.notificationsRoute || !elements.notificationsContent) {
          setRouteVisibility("not-found");
          break;
        }
        setRouteVisibility("notifications");
        if (!state.features) {
          elements.notificationsContent.innerHTML = makeErrorState("Notifications are still loading. Please retry.", "notifications");
        } else {
          await state.features.renderNotificationsRoute({ rootEl: elements.notificationsContent, announcementId: route.announcementId || "" });
        }
        break;

      case "practice": {
        if (!elements.practiceRoute || !elements.practiceContent) {
          setRouteVisibility("not-found");
          break;
        }
        if (!prepareSubjectsRoute(route)) return;
        const subject = getSubject(route.subjectId);
        if (!subject) { redirectTo(`class/${state.assignedClass}`); return; }
        setRouteVisibility("practice");
        if (elements.practicePageTitle) elements.practicePageTitle.textContent = `${subject.label} Practice`;
        if (!state.features) {
          elements.practiceContent.innerHTML = makeErrorState("Practice is still loading. Please retry.", "practice");
        } else {
          await state.features.renderPracticeList({
            rootEl: elements.practiceContent,
            classNumber: route.classNumber,
            subjectId: route.subjectId,
          });
        }
        break;
      }

      case "practice-test":
        if (!elements.practiceTestRoute || !elements.practiceTestContent) {
          setRouteVisibility("not-found");
          break;
        }
        if (!prepareSubjectsRoute(route)) return;
        setRouteVisibility("practice-test");
        if (!state.features) {
          elements.practiceTestContent.innerHTML = makeErrorState("Practice is still loading. Please retry.", "practice-test");
        } else {
          await state.features.renderPracticeTest({
            rootEl: elements.practiceTestContent,
            classNumber: route.classNumber,
            subjectId: route.subjectId,
            testId: route.testId,
            goBack: () => redirectTo(`practice/${route.classNumber}/${route.subjectId}`),
          });
        }
        break;

      case "performance":
        if (!elements.performanceRoute || !elements.performanceContent) {
          setRouteVisibility("not-found");
          break;
        }
        setRouteVisibility("performance");
        if (!state.features) elements.performanceContent.innerHTML = makeErrorState("Performance is still loading. Please retry.", "performance");
        else await state.features.renderPerformance({ rootEl: elements.performanceContent });
        break;

      case "planner":
        if (!elements.plannerRoute || !elements.plannerContent) {
          setRouteVisibility("not-found");
          break;
        }
        setRouteVisibility("planner");
        if (!state.features) elements.plannerContent.innerHTML = makeErrorState("Study Planner is still loading. Please retry.", "planner");
        else await state.features.renderPlanner({ rootEl: elements.plannerContent });
        break;

      case "contact":
        setRouteVisibility("contact");
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

    if (action === "open-practice") {
      const cls = Number(button.dataset.classNumber);
      const subject = button.dataset.subjectId;
      if (ensureAssignedClass(cls) && subject) redirectTo(`practice/${cls}/${encodeURIComponent(subject)}`);
      return;
    }

    if (action === "open-practice-test") {
      const cls = Number(button.dataset.classNumber);
      const subject = button.dataset.subjectId;
      const id = button.dataset.testId;
      if (ensureAssignedClass(cls) && subject && id) redirectTo(`practice-test/${cls}/${encodeURIComponent(subject)}/${encodeURIComponent(id)}`);
      return;
    }

    if (action === "open-announcement") {
      const id = button.dataset.announcementId;
      if (id) redirectTo(`announcement/${encodeURIComponent(id)}`);
      return;
    }

    if (action === "open-notifications") {
      redirectTo("notifications");
      return;
    }

    if (action === "open-performance") { redirectTo("performance"); return; }
    if (action === "open-planner") { redirectTo("planner"); return; }

    if (button.dataset.featureAction) {
      const featureAction = button.dataset.featureAction;
      try {
        if (featureAction === "read-notification" && state.features) {
          await state.features.markNotificationRead(button.dataset.id);
          const currentRoute = parseRoute();
          if (currentRoute.name === "notifications") {
            await state.features.renderNotificationsRoute({ rootEl: elements.notificationsContent, announcementId: currentRoute.announcementId || "" });
          } else {
            await renderHomeData();
          }
        } else if (featureAction === "mark-all-read" && state.features) {
          await state.features.markAllNotificationsRead();
          const currentRoute = parseRoute();
          await state.features.renderNotificationsRoute({ rootEl: elements.notificationsContent, announcementId: currentRoute.announcementId || "" });
        } else if (featureAction === "enable-notifications" && state.features) {
          try { await state.features.enableNotifications(); alert("Notifications enabled for this device."); }
          catch { alert("Notification permission was not granted."); }
        }
      } catch (error) {
        console.error("Feature action failed:", error);
      }
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

  const studentId = elements.emailInput.value.trim().toUpperCase();
  const password = elements.passwordInput.value;

  if (!studentId) {
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
    await loginWithStudentId(studentId, password);
  } catch (error) {
    console.error(error);
    setAuthMessage(getFriendlyAuthError(error), "error");
    setAuthControlsDisabled(false);
    setButtonBusy(elements.loginBtn, false);
    state.isBusy = false;
  }
}

async function onDeleteAccount() {
  if (state.isBusy || !state.user) return;
  const first = window.confirm(
    "Delete your student account permanently?\n\nYour profile and recent-material history will be deleted. This action cannot be undone."
  );
  if (!first) return;

  const password = window.prompt("For security, enter your Student ID password to confirm account deletion:");
  if (password === null) return;
  if (!password) {
    setProfileMessage("Password is required to delete your account.", "error");
    return;
  }

  state.isBusy = true;
  elements.profileDeleteBtn.disabled = true;
  elements.profileSaveBtn.disabled = true;
  elements.profileRefreshBtn.disabled = true;
  setProfileMessage("Deleting your account…", "loading");

  try {
    await deleteStudentAccount(password);
    setProfileMessage("Account deleted successfully.", "success");
    await new Promise((resolve) => setTimeout(resolve, 900));
    await logout().catch(() => {});
    state.user = null;
    state.profile = null;
    state.assignedClass = null;
    showView("auth");
    setAuthMessage("Your account and associated personal data have been deleted.", "success");
  } catch (error) {
    console.error(error);
    const messages = {
      "auth/wrong-password": "The password is incorrect.",
      "auth/invalid-credential": "The password is incorrect.",
      "auth/requires-recent-login": "Please sign in again and retry account deletion.",
      "ACCOUNT_DELETE_PASSWORD_REQUIRED": "Password is required to delete your account.",
      "ACCOUNT_DELETE_PROFILE_MISSING": "Your student profile is incomplete. Please contact EZEE VISION CHAMPUA.",
      "ACCOUNT_DELETE_NOT_ALLOWED": "Only student accounts can be deleted here.",
    };
    setProfileMessage(messages[error?.code] || error?.message || "Account deletion failed. Please try again.", "error");
  } finally {
    elements.profileDeleteBtn.disabled = false;
    elements.profileSaveBtn.disabled = false;
    elements.profileRefreshBtn.disabled = false;
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
    const role = String(profile?.role || "student").toLowerCase();

    if (!profile || !assigned || profile.active === false || role !== "student") {
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
    renderTopbarAvatar(
      String(profile?.photoURL || user?.photoURL || "").trim(),
      getDisplayName(user, profile).trim().charAt(0).toUpperCase() || "S"
    );
    state.catalog = [];
    state.catalogLoadedFor = null;
    if (state.features) {
      await Promise.allSettled([
        state.features.loadMaterialSeen(),
        state.features.loadNotifications(),
      ]);
      state.features.watchNotifications?.(user.uid);
    }

    showView("app");
    renderClassCards();

    const current = parseRoute();
    const safeRoute = ["home", "classes", "search", "recent", "notifications", "performance", "planner", "practice", "practice-test", "contact", "profile"].includes(current.name)
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
  closeMenu();
  state.user = null;
  state.profile = null;
  state.assignedClass = null;
  state.catalog = [];
  state.catalogLoadedFor = null;
  state.recent = [];
  state.features?.stopNotificationWatch?.();
  showView("auth");
  setAuthControlsDisabled(false);
  setButtonBusy(elements.loginBtn, false);
  setAuthMessage("");
  history.replaceState(null, "", `${location.pathname}${location.search}`);
}

function bindEvents() {
  // Some optional feature routes are intentionally absent from the baseline HTML.
  // Bind only when an element exists so a missing optional control can never
  // abort application startup (and incorrectly surface as a Firebase error).
  const on = (element, event, handler, options) => {
    if (element && typeof element.addEventListener === "function") {
      element.addEventListener(event, handler, options);
    }
  };

  on(elements.loginForm, "submit", onLoginSubmit);
  on(elements.logoutTopBtn, "click", onLogout);

  on(elements.togglePasswordBtn, "click", () => {
    const visible = elements.passwordInput.type === "text";
    elements.passwordInput.type = visible ? "password" : "text";
    elements.togglePasswordBtn.setAttribute("aria-label", visible ? "Show password" : "Hide password");
    elements.togglePasswordBtn.textContent = visible ? "◉" : "◌";
  });

  on(elements.viewClassesBtn, "click", () => redirectTo("classes"));
  on(elements.classesBackBtn, "click", () => redirectTo("home"));
  on(elements.subjectsBackBtn, "click", () => redirectTo("classes"));
  on(elements.sectionsBackBtn, "click", () => {
    const parsed = parseRoute();
    redirectTo(`class/${parsed.classNumber || state.assignedClass}`);
  });
  on(elements.materialsBackBtn, "click", () => {
    const parsed = parseRoute();
    redirectTo(`subject/${parsed.classNumber || state.assignedClass}/${parsed.subjectId}`);
  });
  on(elements.materialDetailBackBtn, "click", () => {
    const parsed = parseRoute();
    redirectTo(`section/${parsed.classNumber || state.assignedClass}/${parsed.subjectId}/${parsed.sectionId}`);
  });
  on(elements.searchBackBtn, "click", () => redirectTo("home"));
  on(elements.recentBackBtn, "click", () => redirectTo("home"));
  on(elements.notificationsBackBtn, "click", () => redirectTo("home"));
  on(elements.practiceBackBtn, "click", () => {
    const parsed = parseRoute();
    redirectTo(`subject/${parsed.classNumber || state.assignedClass}/${parsed.subjectId || ""}`);
  });
  on(elements.practiceTestBackBtn, "click", () => {
    const parsed = parseRoute();
    redirectTo(`practice/${parsed.classNumber || state.assignedClass}/${parsed.subjectId || ""}`);
  });
  on(elements.performanceBackBtn, "click", () => redirectTo("home"));
  on(elements.plannerBackBtn, "click", () => redirectTo("home"));

  on(elements.materialDetailHomeBtn, "click", () => redirectTo("home"));
  on(elements.fallbackHomeBtn, "click", () => redirectTo("home"));

  on(elements.searchInput, "input", onSearchInput);
  on(elements.searchClearBtn, "click", onSearchClear);

  on(elements.contactBackBtn, "click", () => redirectTo("home"));

  on(elements.menuOpenBtn, "click", () => setMenuOpen(true));
  on(elements.menuCloseBtn, "click", closeMenu);
  on(elements.menuBackdrop, "click", closeMenu);
  elements.menuItems.forEach((button) => {
    on(button, "click", () => {
      closeMenu();
      redirectTo(button.dataset.menuNav);
    });
  });

  on(elements.profileForm, "submit", saveProfile);
  on(elements.profilePhotoInput, "change", onProfilePhotoSelected);
  on(elements.profileRefreshBtn, "click", refreshProfileView);
  on(elements.profileDeleteBtn, "click", onDeleteAccount);
  on(elements.profileBackBtn, "click", () => redirectTo("home"));
  on(elements.profileLogoutBtn, "click", onLogout);

  // Profile is an explicit app-area action, not a duplicate page.
  const profileOpenBtn = document.querySelector("#profileOpenBtn");
  on(profileOpenBtn, "click", () => redirectTo("profile"));

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
    on(button, "click", () => redirectTo(button.dataset.nav));
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

  window.addEventListener("evc-notifications-updated", () => {
    if (!state.user || parseRoute().name !== "home") return;
    void renderHomeData();
  });
}

async function bootstrap() {
  // Bind first so every visible control has a handler even before Firebase state resolves.
  bindEvents();
  showView("auth");
  setAuthMessage("Connecting securely…", "loading");

  try {
    const featureModule = await import("./student-features.js");
    featureModule.init(() => state);
    state.features = featureModule;
    await featureModule.loadMaterialSeen().catch(() => {});
  } catch (error) {
    console.warn("Student feature module could not load; core app will continue:", error);
  }

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
