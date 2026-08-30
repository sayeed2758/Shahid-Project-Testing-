import {
  SUBJECTS,
  SECTIONS,
  CLASSES,
  ADMIN_EMAIL,
  configureAuthPersistence,
  loginWithEmailAndPassword,
  sendResetEmail,
  logout,
  observeAuth,
  createStudent,
  listStudents,
  updateStudent,
  setStudentActive,
  getAdminIdentity,
  loadAllCatalog,
  verifyDriveLink,
  uploadMaterial,
  replaceMaterial,
  deleteMaterial,
  publishMaterial,
  extractDriveFileId,
  getDriveGatewayStatus,
} from "./admin-client.js";

const $ = (selector) => document.querySelector(selector);

const state = {
  user: null,
  admin: false,
  students: [],
  materials: [],
  studentMode: "create",
  selectedStudent: null,
  replacingMaterial: null,
  verifiedDriveId: "",
  gatewayHealthy: false,
  busy: false,
};

const el = {
  authView: $("#adminAuthView"),
  panel: $("#adminPanelView"),
  loginForm: $("#adminLoginForm"),
  email: $("#adminEmail"),
  password: $("#adminPassword"),
  togglePasswordBtn: $("#toggleAdminPasswordBtn"),
  loginBtn: $("#adminLoginBtn"),
  forgotPasswordBtn: $("#adminForgotPasswordBtn"),
  authMessage: $("#adminAuthMessage"),
  logoutBtn: $("#adminLogoutBtn"),
  refreshBtn: $("#adminRefreshBtn"),
  tabs: [...document.querySelectorAll(".admin-tab")],
  panels: [...document.querySelectorAll(".admin-tab-panel")],
  statStudents: $("#statStudents"),
  statMaterials: $("#statMaterials"),
  statNotes: $("#statNotes"),
  statWorksheets: $("#statWorksheets"),
  statPublished: $("#statPublished"),
  statStorage: $("#statStorage"),
  overviewRecentMaterials: $("#overviewRecentMaterials"),
  overviewMaterialsBtn: $("#overviewMaterialsBtn"),
  studentsMessage: $("#studentsMessage"),
  studentSearch: $("#studentSearch"),
  studentClassFilter: $("#studentClassFilter"),
  studentStatusFilter: $("#studentStatusFilter"),
  studentsBody: $("#studentsTableBody"),
  addStudentBtn: $("#addStudentBtn"),
  materialsMessage: $("#materialsMessage"),
  materialSearch: $("#materialSearch"),
  materialClassFilter: $("#materialClassFilter"),
  materialSubjectFilter: $("#materialSubjectFilter"),
  materialSectionFilter: $("#materialSectionFilter"),
  materialsBody: $("#materialsTableBody"),
  refreshMaterialsBtn: $("#refreshMaterialsBtn"),
  uploadForm: $("#uploadForm"),
  uploadClass: $("#uploadClass"),
  uploadSubject: $("#uploadSubject"),
  uploadSection: $("#uploadSection"),
  uploadTitle: $("#uploadTitle"),
  uploadChapter: $("#uploadChapter"),
  uploadDriveLink: $("#uploadDriveLink"),
  verifyDriveBtn: $("#verifyDriveBtn"),
  driveFileStatus: $("#driveFileStatus"),
  publishOnUpload: $("#publishOnUpload"),
  uploadMessage: $("#uploadMessage"),
  uploadBtn: $("#uploadBtn"),
  uploadModeLabel: $("#uploadModeLabel"),
  gatewayHealth: $("#gatewayHealth"),
  studentDialog: $("#studentDialog"),
  studentForm: $("#studentForm"),
  studentDialogTitle: $("#studentDialogTitle"),
  studentDialogEyebrow: $("#studentDialogEyebrow"),
  studentDialogClose: $("#studentDialogClose"),
  studentDialogCancel: $("#studentDialogCancel"),
  studentName: $("#studentName"),
  studentId: $("#studentId"),
  studentPassword: $("#studentPassword"),
  studentClass: $("#studentClass"),
  studentUid: $("#studentUid"),
  studentDialogHelp: $("#studentDialogHelp"),
  studentDialogMessage: $("#studentDialogMessage"),
  studentDialogSubmit: $("#studentDialogSubmit"),
  globalStatus: $("#adminGlobalStatus"),
  sessionEmail: $("#adminSessionEmail"),
  credentialsDialog: $("#credentialsDialog"),
  createdStudentId: $("#createdStudentId"),
  createdStudentPassword: $("#createdStudentPassword"),
  createdStudentClass: $("#createdStudentClass"),
  copyCredentialsBtn: $("#copyCredentialsBtn"),
  credentialsCloseBtn: $("#credentialsCloseBtn"),
  credentialsDoneBtn: $("#credentialsDoneBtn"),
  credentialsMessage: $("#credentialsMessage"),
};

function message(target, text = "", type = "") {
  if (!target) return;
  target.textContent = text;
  target.dataset.type = type;
}

function status(text = "", type = "") {
  if (!el.globalStatus) return;
  el.globalStatus.textContent = text;
  el.globalStatus.dataset.type = type;
  el.globalStatus.hidden = !text;
}

function clearStatus(ms = 2400) {
  window.setTimeout(() => status(""), ms);
}

function friendly(error) {
  const code = error?.code || error?.message || "";
  const map = {
    "auth/invalid-credential": "Incorrect admin email or password.",
    "auth/invalid-login-credentials": "Incorrect admin email or password.",
    "auth/wrong-password": "Incorrect admin password.",
    "auth/user-not-found": "Admin account was not found.",
    "auth/user-disabled": "This admin account is disabled.",
    "auth/network-request-failed": "Network error. Check your connection and retry.",
    "auth/too-many-requests": "Too many attempts. Please wait and retry.",
    "auth/operation-not-allowed": "Firebase Email/Password sign-in is disabled.",
    "auth/invalid-email": "The configured admin email is invalid.",
    "auth/weak-password": "Password must contain at least 6 characters.",
    "auth/email-already-in-use": "That account already exists.",
    STUDENT_ID_EXISTS: "That Student ID already exists.",
    INVALID_NAME: "Enter a valid student name.",
    INVALID_STUDENT_ID: "Enter a valid Student ID.",
    INVALID_PASSWORD: "Password must be at least 6 characters.",
    INVALID_CLASS: "Choose Class 6–10.",
    INVALID_STUDENT_DATA: "Enter valid student details.",
    STUDENT_NOT_FOUND: "The student could not be found.",
    STUDENT_SYNC_FAILED: "Student account could not be synchronized. Nothing incomplete was kept.",
    DRIVE_GATEWAY_NOT_CONFIGURED: "Drive Gateway is not configured yet. Add its Worker URL in drive-config.js.",
    INVALID_DRIVE_LINK: "Paste a valid Google Drive PDF link.",
    DRIVE_CONFIG_MISSING: "Drive Gateway is missing its Google service-account configuration.",
    DRIVE_AUTH_FAILED: "Drive Gateway could not authenticate with Google Drive.",
    DRIVE_FILE_ERROR: "Google Drive could not read this file. Check the file permission.",
    DRIVE_NOT_PDF: "The selected Drive file must be a non-trashed PDF.",
    GATEWAY_ERROR: "Drive Gateway rejected the request. Check its configuration.",
    AUTH_REQUIRED: "Please sign in again.",
    PASSWORD_MANAGEMENT_UNAVAILABLE: "Student password editing is not available in this browser-only build.",
  };
  return map[code] || error?.message || "Something went wrong. Please retry.";
}

function showAuth() {
  el.authView.hidden = false;
  el.panel.hidden = true;
}

function showPanel() {
  el.authView.hidden = true;
  el.panel.hidden = false;
}

function setButtonBusy(button, busy, busyLabel) {
  if (!button) return;
  if (busy) {
    if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent;
    button.disabled = true;
    if (busyLabel) button.textContent = busyLabel;
  } else {
    button.disabled = false;
    if (button.dataset.defaultLabel) button.textContent = button.dataset.defaultLabel;
  }
}

function tab(name) {
  el.tabs.forEach((button) => button.classList.toggle("is-active", button.dataset.adminTab === name));
  el.panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== name; });
  if (name === "students") void loadStudents();
  if (name === "materials") void loadMaterials(true);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function fmtSize(value) {
  const bytes = Number(value) || 0;
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

async function loadStudents() {
  message(el.studentsMessage, "Loading students…", "loading");
  try {
    const result = await listStudents();
    state.students = result.students || [];
    renderStudents();
    message(el.studentsMessage, `${state.students.length} student${state.students.length === 1 ? "" : "s"} loaded.`, "success");
    renderStats();
    return true;
  } catch (error) {
    console.error(error);
    message(el.studentsMessage, friendly(error), "error");
    return false;
  }
}

async function loadMaterials(showMessage = false) {
  if (showMessage) message(el.materialsMessage, "Refreshing materials…", "loading");
  try {
    state.materials = await loadAllCatalog();
    renderMaterials();
    renderStats();
    message(el.materialsMessage, `${state.materials.length} material${state.materials.length === 1 ? "" : "s"} loaded.`, "success");
    return true;
  } catch (error) {
    console.error(error);
    message(el.materialsMessage, friendly(error), "error");
    return false;
  }
}

function renderStats() {
  const materials = state.materials;
  el.statMaterials.textContent = String(materials.length);
  el.statNotes.textContent = String(materials.filter((item) => item.section !== "worksheet").length);
  el.statWorksheets.textContent = String(materials.filter((item) => item.section === "worksheet").length);
  el.statPublished.textContent = String(materials.filter((item) => item.active).length);
  el.statStorage.textContent = fmtSize(materials.reduce((total, item) => total + Number(item.fileSize || 0), 0));
  el.statStudents.textContent = String(state.students.length);

  const latest = materials.slice(0, 6);
  el.overviewRecentMaterials.innerHTML = latest.length
    ? latest.map((item) => `<div class="mini-list-row"><span><strong>${escapeHtml(item.title || "Untitled")}</strong><small>Class ${Number(item.class)} • ${escapeHtml(item.subject || "")} • ${escapeHtml(item.section || "")}</small></span><b>${item.active ? "Published" : "Unpublished"}</b></div>`).join("")
    : `<div class="table-empty">No materials uploaded yet.</div>`;
}

function studentFiltered() {
  const query = el.studentSearch.value.trim().toLowerCase();
  const classFilter = el.studentClassFilter.value;
  const statusFilter = el.studentStatusFilter.value;
  return state.students.filter((student) => {
    const searchable = [student.displayName, student.studentId, student.uid].join(" ").toLowerCase();
    return (!query || searchable.includes(query))
      && (classFilter === "all" || String(student.class || "") === classFilter)
      && (statusFilter === "all" || (statusFilter === "active" ? !student.disabled : student.disabled));
  });
}

function renderStudents() {
  const rows = studentFiltered();
  if (!rows.length) {
    el.studentsBody.innerHTML = `<tr><td colspan="5"><div class="table-empty">No students match this filter.</div></td></tr>`;
    return;
  }
  el.studentsBody.innerHTML = rows.map((student) => {
    const initial = (student.displayName || student.studentId || "S").trim().charAt(0).toUpperCase();
    return `<tr>
      <td><div class="student-cell"><span class="table-avatar">${escapeHtml(initial)}</span><div><strong>${escapeHtml(student.displayName || "Unnamed")}</strong><small>${escapeHtml(student.studentId || "—")}</small></div></div></td>
      <td>Class ${Number(student.class) || "—"}</td>
      <td><span class="status-pill ${student.disabled ? "disabled" : "active"}">${student.disabled ? "Disabled" : "Active"}</span></td>
      <td>${escapeHtml(fmtDate(student.lastSignInTime))}</td>
      <td><div class="row-actions">
        <button class="mini-action" data-student-action="edit" data-uid="${escapeHtml(student.uid)}" type="button">Edit</button>
        <button class="mini-action ${student.disabled ? "success" : "danger"}" data-student-action="toggle" data-uid="${escapeHtml(student.uid)}" type="button">${student.disabled ? "Enable" : "Disable"}</button>
      </div></td>
    </tr>`;
  }).join("");
}

function materialFiltered() {
  const query = el.materialSearch.value.trim().toLowerCase();
  const classFilter = el.materialClassFilter.value;
  const subjectFilter = el.materialSubjectFilter.value;
  const sectionFilter = el.materialSectionFilter.value;
  return state.materials.filter((material) => {
    const searchable = [material.title, material.chapter, material.fileName, material.subject, material.section].join(" ").toLowerCase();
    return (!query || searchable.includes(query))
      && (classFilter === "all" || String(material.class) === classFilter)
      && (subjectFilter === "all" || material.subject === subjectFilter)
      && (sectionFilter === "all" || material.section === sectionFilter);
  });
}

function renderMaterials() {
  const rows = materialFiltered();
  if (!rows.length) {
    el.materialsBody.innerHTML = `<tr><td colspan="6"><div class="table-empty">No materials match this filter.</div></td></tr>`;
    return;
  }
  const subjectLabel = Object.fromEntries(SUBJECTS.map((item) => [item.id, item.label]));
  const sectionLabel = Object.fromEntries(SECTIONS.map((item) => [item.id, item.label]));
  el.materialsBody.innerHTML = rows.map((material) => `<tr>
    <td><div><strong>${escapeHtml(material.title || "Untitled")}</strong><small>${escapeHtml(material.fileName || "PDF")}${material.chapter ? ` • ${escapeHtml(material.chapter)}` : ""}</small></div></td>
    <td>Class ${Number(material.class)}</td>
    <td>${escapeHtml(sectionLabel[material.section] || material.section)}<small>${escapeHtml(subjectLabel[material.subject] || material.subject)}</small></td>
    <td>${escapeHtml(fmtSize(material.fileSize))}</td>
    <td><span class="status-pill ${material.active ? "active" : "disabled"}">${material.active ? "Published" : "Unpublished"}</span></td>
    <td><div class="row-actions">
      <button class="mini-action" data-material-action="toggle" data-id="${escapeHtml(material.id)}" type="button">${material.active ? "Unpublish" : "Publish"}</button>
      <button class="mini-action" data-material-action="replace" data-id="${escapeHtml(material.id)}" type="button">Replace</button>
      <button class="mini-action danger" data-material-action="delete" data-id="${escapeHtml(material.id)}" type="button">Remove</button>
    </div></td>
  </tr>`).join("");
}

function resetStudentDialog() {
  el.studentForm.reset();
  el.studentUid.value = "";
  state.studentMode = "create";
  state.selectedStudent = null;
  el.studentId.readOnly = false;
  el.studentPassword.required = true;
  el.studentPassword.placeholder = "Minimum 6 characters";
  el.studentDialogTitle.textContent = "Add Student";
  el.studentDialogEyebrow.textContent = "NEW STUDENT";
  el.studentDialogSubmit.textContent = "Create Student";
  el.studentDialogHelp.innerHTML = "<strong>Simple student login</strong><span>Give the student the Student ID and password. No Google account is needed.</span>";
  message(el.studentDialogMessage, "");
}

function openStudentDialog(student = null) {
  resetStudentDialog();
  if (student) {
    state.studentMode = "edit";
    state.selectedStudent = student;
    el.studentUid.value = student.uid;
    el.studentName.value = student.displayName || "";
    el.studentId.value = student.studentId || "";
    el.studentId.readOnly = true;
    el.studentPassword.required = false;
    el.studentPassword.placeholder = "Password changes are not available here";
    el.studentClass.value = String(student.class || "");
    el.studentDialogTitle.textContent = "Edit Student";
    el.studentDialogEyebrow.textContent = "STUDENT ACCOUNT";
    el.studentDialogSubmit.textContent = "Save Changes";
    el.studentDialogHelp.innerHTML = "<strong>Account management</strong><span>Change name or assigned class. Existing login credentials remain unchanged.</span>";
  }
  el.studentDialog.showModal();
}

async function submitStudent(event) {
  event.preventDefault();
  const name = el.studentName.value.trim();
  const id = el.studentId.value.trim();
  const password = el.studentPassword.value;
  const classNumber = Number(el.studentClass.value);

  if (name.length < 2) return message(el.studentDialogMessage, "Enter a valid student name.", "error");
  if (id.length < 2) return message(el.studentDialogMessage, "Enter a valid Student ID.", "error");
  if (!CLASSES.includes(classNumber)) return message(el.studentDialogMessage, "Choose Class 6–10.", "error");
  if (state.studentMode === "create" && password.length < 6) return message(el.studentDialogMessage, "Password must be at least 6 characters.", "error");

  setButtonBusy(el.studentDialogSubmit, true, state.studentMode === "create" ? "Creating…" : "Saving…");
  message(el.studentDialogMessage, state.studentMode === "create" ? "Creating student account…" : "Saving student details…", "loading");

  try {
    if (state.studentMode === "create") {
      const result = await createStudent({ displayName: name, studentId: id, password, classNumber });
      el.createdStudentId.textContent = result.studentId;
      el.createdStudentPassword.textContent = password;
      el.createdStudentClass.textContent = `Class ${classNumber}`;
      el.studentDialog.close();
      el.credentialsDialog.showModal();
    } else {
      await updateStudent({ uid: el.studentUid.value, displayName: name, classNumber });
      el.studentDialog.close();
      status(`Student ${id} updated successfully.`, "success");
      clearStatus();
    }
    await loadStudents();
  } catch (error) {
    console.error(error);
    message(el.studentDialogMessage, friendly(error), "error");
  } finally {
    setButtonBusy(el.studentDialogSubmit, false);
  }
}

async function toggleStudent(student) {
  if (!student) return;
  const nextActive = student.disabled;
  const action = nextActive ? "Enable" : "Disable";
  if (!window.confirm(`${action} ${student.displayName || student.studentId}?`)) return;
  status(`${action === "Enable" ? "Enabling" : "Disabling"} student…`, "loading");
  try {
    await setStudentActive({ uid: student.uid, active: nextActive });
    await loadStudents();
    status(`Student ${nextActive ? "enabled" : "disabled"}.`, "success");
    clearStatus();
  } catch (error) {
    console.error(error);
    status(friendly(error), "error");
    clearStatus(3500);
  }
}

function resetUploadForm() {
  el.uploadForm.reset();
  state.replacingMaterial = null;
  state.verifiedDriveId = "";
  el.uploadModeLabel.textContent = "ADD MATERIAL";
  el.uploadBtn.textContent = "Save Material";
  el.publishOnUpload.checked = true;
  el.driveFileStatus.textContent = state.gatewayHealthy
    ? "Paste a private Google Drive PDF link, then verify it."
    : "Drive Gateway is not connected yet.";
  el.driveFileStatus.dataset.type = state.gatewayHealthy ? "" : "error";
  updateDriveActionState();
}

function updateDriveActionState() {
  const configured = getDriveGatewayStatus();
  const valid = Boolean(state.verifiedDriveId);
  el.verifyDriveBtn.disabled = !configured;
  el.uploadBtn.disabled = !configured || !valid;
  if (!configured) {
    el.verifyDriveBtn.title = "Configure DRIVE_GATEWAY_URL first.";
    el.uploadBtn.title = "Configure DRIVE_GATEWAY_URL first.";
  } else {
    el.verifyDriveBtn.title = "Verify the selected Drive PDF";
    el.uploadBtn.title = valid ? "Save the verified material" : "Verify the Drive file first";
  }
}

function openReplace(material) {
  state.replacingMaterial = material;
  state.verifiedDriveId = "";
  tab("upload");
  el.uploadClass.value = String(material.class);
  el.uploadSubject.value = material.subject;
  el.uploadSection.value = material.section;
  el.uploadTitle.value = material.title || "";
  el.uploadChapter.value = material.chapter || "";
  el.uploadDriveLink.value = "";
  el.publishOnUpload.checked = Boolean(material.active);
  el.uploadModeLabel.textContent = "REPLACE MATERIAL";
  el.uploadBtn.textContent = "Save Replacement";
  message(el.uploadMessage, `Replacing “${material.title}”. Paste and verify the new Drive PDF.`, "loading");
  updateDriveActionState();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function materialAction(action, id) {
  const material = state.materials.find((item) => item.id === id);
  if (!material) return;

  if (action === "toggle") {
    const target = !material.active;
    if (!window.confirm(`${target ? "Publish" : "Unpublish"} “${material.title}”?`)) return;
    status(`${target ? "Publishing" : "Unpublishing"}…`, "loading");
    try {
      Object.assign(material, await publishMaterial(material, target));
      renderMaterials();
      renderStats();
      status(`Material ${target ? "published" : "unpublished"}.`, "success");
      clearStatus();
    } catch (error) {
      console.error(error);
      status(friendly(error), "error");
      clearStatus(3500);
    }
    return;
  }

  if (action === "delete") {
    if (!window.confirm(`Remove “${material.title}” from the portal? The original Google Drive file will NOT be deleted.`)) return;
    status("Removing portal record…", "loading");
    try {
      await deleteMaterial(material);
      state.materials = state.materials.filter((item) => item.id !== material.id);
      renderMaterials();
      renderStats();
      status("Material removed from the portal.", "success");
      clearStatus();
    } catch (error) {
      console.error(error);
      status(friendly(error), "error");
      clearStatus(3500);
    }
    return;
  }

  if (action === "replace") openReplace(material);
}

async function verifyDrive() {
  const link = el.uploadDriveLink.value.trim();
  const driveFileId = extractDriveFileId(link);
  state.verifiedDriveId = "";
  if (!driveFileId) {
    el.driveFileStatus.textContent = "Invalid Google Drive link.";
    el.driveFileStatus.dataset.type = "error";
    updateDriveActionState();
    return;
  }

  setButtonBusy(el.verifyDriveBtn, true, "Checking…");
  el.driveFileStatus.textContent = "Checking Drive file permissions…";
  el.driveFileStatus.dataset.type = "loading";
  try {
    const meta = await verifyDriveLink(link);
    state.verifiedDriveId = meta.driveFileId || driveFileId;
    el.driveFileStatus.textContent = `✓ ${meta.name || "PDF"} • ${fmtSize(meta.size)} • Verified`;
    el.driveFileStatus.dataset.type = "success";
    if (!el.uploadTitle.value.trim() && meta.name) el.uploadTitle.value = meta.name.replace(/\.pdf$/i, "");
  } catch (error) {
    console.error(error);
    el.driveFileStatus.textContent = friendly(error);
    el.driveFileStatus.dataset.type = "error";
  } finally {
    setButtonBusy(el.verifyDriveBtn, false);
    updateDriveActionState();
  }
}

async function submitUpload(event) {
  event.preventDefault();
  const classNumber = Number(el.uploadClass.value);
  const subject = el.uploadSubject.value;
  const section = el.uploadSection.value;
  const title = el.uploadTitle.value.trim();
  const chapter = el.uploadChapter.value.trim();
  const driveUrl = el.uploadDriveLink.value.trim();

  if (!getDriveGatewayStatus()) return message(el.uploadMessage, "Drive Gateway is not configured. Add its Worker URL in drive-config.js.", "error");
  if (!CLASSES.includes(classNumber)) return message(el.uploadMessage, "Choose Class 6–10.", "error");
  if (!SUBJECTS.some((item) => item.id === subject) || !SECTIONS.some((item) => item.id === section)) return message(el.uploadMessage, "Choose subject and section.", "error");
  if (title.length < 2) return message(el.uploadMessage, "Enter a material title.", "error");
  if (!extractDriveFileId(driveUrl)) return message(el.uploadMessage, "Paste a valid Google Drive PDF link.", "error");
  if (!state.verifiedDriveId || state.verifiedDriveId !== extractDriveFileId(driveUrl)) {
    return message(el.uploadMessage, "Verify the current Drive file before saving.", "error");
  }

  setButtonBusy(el.uploadBtn, true, state.replacingMaterial ? "Saving…" : "Saving…");
  el.verifyDriveBtn.disabled = true;
  message(el.uploadMessage, state.replacingMaterial ? "Saving replacement…" : "Saving material…", "loading");

  try {
    const metadata = {
      id: state.replacingMaterial?.id || `m-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      chapter,
      class: classNumber,
      subject,
      section,
      driveUrl,
    };
    const result = state.replacingMaterial
      ? await replaceMaterial(state.replacingMaterial, metadata, el.publishOnUpload.checked)
      : await uploadMaterial({ metadata, publish: el.publishOnUpload.checked });

    state.materials = state.materials.filter((item) => item.id !== result.id);
    state.materials.unshift(result);
    renderMaterials();
    renderStats();
    message(el.uploadMessage, "Material saved successfully.", "success");
    status("Material saved successfully.", "success");
    clearStatus();
    resetUploadForm();
    tab("materials");
  } catch (error) {
    console.error(error);
    message(el.uploadMessage, friendly(error), "error");
  } finally {
    setButtonBusy(el.uploadBtn, false);
    el.verifyDriveBtn.disabled = false;
    updateDriveActionState();
  }
}

async function login(event) {
  event.preventDefault();
  const email = el.email.value.trim().toLowerCase();
  const password = el.password.value;
  if (email !== ADMIN_EMAIL.toLowerCase()) return message(el.authMessage, "Use the configured admin email.", "error");
  if (password.length < 6) return message(el.authMessage, "Enter your password.", "error");

  setButtonBusy(el.loginBtn, true, "Signing in…");
  el.forgotPasswordBtn.disabled = true;
  message(el.authMessage, "Signing in securely…", "loading");
  try {
    await loginWithEmailAndPassword(email, password);
    // Authentication observer completes the actual panel transition.
  } catch (error) {
    console.error(error);
    message(el.authMessage, friendly(error), "error");
  } finally {
    setButtonBusy(el.loginBtn, false);
    el.forgotPasswordBtn.disabled = false;
  }
}

async function forgot() {
  const email = el.email.value.trim().toLowerCase();
  if (!email || email !== ADMIN_EMAIL.toLowerCase()) return message(el.authMessage, "Enter the configured admin email first.", "error");
  el.forgotPasswordBtn.disabled = true;
  el.loginBtn.disabled = true;
  message(el.authMessage, "Sending password reset email…", "loading");
  try {
    await sendResetEmail(email);
    message(el.authMessage, "Reset email sent. Check Inbox, Spam and Promotions.", "success");
  } catch (error) {
    console.error(error);
    message(el.authMessage, friendly(error), "error");
  } finally {
    el.forgotPasswordBtn.disabled = false;
    el.loginBtn.disabled = false;
  }
}

function toggleAdminPassword() {
  const hidden = el.password.type === "password";
  el.password.type = hidden ? "text" : "password";
  el.togglePasswordBtn.setAttribute("aria-pressed", String(hidden));
  el.togglePasswordBtn.textContent = hidden ? "Hide" : "Show";
}

async function processAuth(user) {
  state.user = user;
  if (!user) {
    state.admin = false;
    showAuth();
    return;
  }

  try {
    const identity = await getAdminIdentity();
    if (!identity.admin) {
      await logout().catch(() => {});
      state.admin = false;
      showAuth();
      message(el.authMessage, "This account is not authorised for the Admin Panel.", "error");
      return;
    }

    state.admin = true;
    el.sessionEmail.textContent = user.email || ADMIN_EMAIL;
    showPanel();
    await refreshAll({ silent: true });
  } catch (error) {
    console.error(error);
    await logout().catch(() => {});
    state.admin = false;
    showAuth();
    message(el.authMessage, friendly(error), "error");
  }
}

async function refreshAll({ silent = false } = {}) {
  if (!state.admin || state.busy) return;
  state.busy = true;
  setButtonBusy(el.refreshBtn, true, "Refreshing…");
  if (!silent) status("Refreshing dashboard…", "loading");

  try {
    const [studentsOk, materialsOk] = await Promise.all([loadStudents(), loadMaterials(true)]);
    if (studentsOk && materialsOk) {
      if (!silent) {
        status("Dashboard refreshed.", "success");
        clearStatus();
      }
    } else if (!silent) {
      status("Refresh completed with an error. Check the affected section.", "error");
      clearStatus(3500);
    }
  } finally {
    state.busy = false;
    setButtonBusy(el.refreshBtn, false);
  }
}

async function checkGatewayHealth() {
  if (!getDriveGatewayStatus()) {
    state.gatewayHealthy = false;
    el.gatewayHealth.textContent = "Gateway not configured";
    el.gatewayHealth.dataset.type = "error";
    updateDriveActionState();
    return;
  }

  try {
    const base = window.__EVC_DRIVE_GATEWAY_URL__ || "";
    const response = await fetch(`${base.replace(/\/$/, "")}/health/`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    state.gatewayHealthy = response.ok && data.ok === true;
    el.gatewayHealth.textContent = state.gatewayHealthy ? "Gateway online" : "Gateway unavailable";
    el.gatewayHealth.dataset.type = state.gatewayHealthy ? "success" : "error";
  } catch (error) {
    console.warn("Drive gateway health check failed", error);
    state.gatewayHealthy = false;
    el.gatewayHealth.textContent = "Gateway unavailable";
    el.gatewayHealth.dataset.type = "error";
  }
  updateDriveActionState();
}

function bind() {
  el.loginForm.addEventListener("submit", login);
  el.forgotPasswordBtn.addEventListener("click", forgot);
  el.togglePasswordBtn.addEventListener("click", toggleAdminPassword);
  el.logoutBtn.addEventListener("click", async () => {
    setButtonBusy(el.logoutBtn, true, "Logging out…");
    try { await logout(); } catch (error) { console.error(error); } finally { setButtonBusy(el.logoutBtn, false); }
  });
  el.refreshBtn.addEventListener("click", () => refreshAll());
  el.tabs.forEach((button) => button.addEventListener("click", () => tab(button.dataset.adminTab)));
  el.overviewMaterialsBtn.addEventListener("click", () => tab("materials"));

  el.addStudentBtn.addEventListener("click", () => openStudentDialog());
  el.studentForm.addEventListener("submit", submitStudent);
  el.studentDialogClose.addEventListener("click", () => el.studentDialog.close());
  el.studentDialogCancel.addEventListener("click", () => el.studentDialog.close());
  [el.studentSearch, el.studentClassFilter, el.studentStatusFilter].forEach((input) => input.addEventListener("input", renderStudents));
  el.studentsBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-student-action]");
    if (!button) return;
    const student = state.students.find((item) => item.uid === button.dataset.uid);
    if (!student) return;
    if (button.dataset.studentAction === "edit") openStudentDialog(student);
    if (button.dataset.studentAction === "toggle") void toggleStudent(student);
  });

  el.materialSearch.addEventListener("input", renderMaterials);
  el.materialClassFilter.addEventListener("change", renderMaterials);
  el.materialSubjectFilter.addEventListener("change", renderMaterials);
  el.materialSectionFilter.addEventListener("change", renderMaterials);
  el.refreshMaterialsBtn.addEventListener("click", () => loadMaterials(true));
  el.verifyDriveBtn.addEventListener("click", verifyDrive);
  el.uploadDriveLink.addEventListener("input", () => {
    state.verifiedDriveId = "";
    el.driveFileStatus.textContent = "Link changed. Verify the new Drive file before saving.";
    el.driveFileStatus.dataset.type = "";
    updateDriveActionState();
  });
  el.uploadForm.addEventListener("submit", submitUpload);
  el.materialsBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-material-action]");
    if (button) void materialAction(button.dataset.materialAction, button.dataset.id);
  });

  el.copyCredentialsBtn.addEventListener("click", async () => {
    const text = `EZEE VISION CHAMPUA\nStudent ID: ${el.createdStudentId.textContent}\nPassword: ${el.createdStudentPassword.textContent}\nClass: ${el.createdStudentClass.textContent}`;
    try {
      await navigator.clipboard.writeText(text);
      message(el.credentialsMessage, "Credentials copied.", "success");
    } catch {
      message(el.credentialsMessage, "Copy failed. Select and copy manually.", "error");
    }
  });
  el.credentialsCloseBtn.addEventListener("click", () => el.credentialsDialog.close());
  el.credentialsDoneBtn.addEventListener("click", () => el.credentialsDialog.close());
}

// Expose only the non-secret gateway URL to the health-check helper. The actual value
// is still imported from drive-config.js in admin-client.js and never contains credentials.
(async () => {
  bind();
  showAuth();
  el.email.value = ADMIN_EMAIL;
  await configureAuthPersistence().catch((error) => console.warn("Auth persistence setup failed", error));
  observeAuth((user) => { void processAuth(user); });
  // Avoid a fake working upload button: it stays disabled until a real Worker URL is configured.
  try {
    const configModule = await import("./drive-config.js");
    window.__EVC_DRIVE_GATEWAY_URL__ = configModule.DRIVE_GATEWAY_URL || "";
  } catch (error) {
    console.warn("Drive config could not load", error);
  }
  await checkGatewayHealth();
  updateDriveActionState();
})();
