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
  uploadMaterial,
  replaceMaterial,
  deleteMaterial,
  publishMaterial,
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
};

const el = {
  authView: $("#adminAuthView"),
  panel: $("#adminPanelView"),
  loginForm: $("#adminLoginForm"),
  email: $("#adminEmail"),
  password: $("#adminPassword"),
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
  uploadFile: $("#uploadFile"),
  chooseFile: $("#chooseUploadFileBtn"),
  uploadFileName: $("#uploadFileName"),
  uploadFileMeta: $("#uploadFileMeta"),
  publishOnUpload: $("#publishOnUpload"),
  uploadProgressWrap: $("#uploadProgressWrap"),
  uploadProgressLabel: $("#uploadProgressLabel"),
  uploadProgressPercent: $("#uploadProgressPercent"),
  uploadProgressBar: $("#uploadProgressBar"),
  uploadMessage: $("#uploadMessage"),
  uploadBtn: $("#uploadBtn"),

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
  target.textContent = text;
  target.className = `inline-message ${type}`.trim();
}

function status(text = "") {
  el.globalStatus.textContent = text;
  el.globalStatus.hidden = !text;
}

function clearStatus(ms = 2200) {
  window.setTimeout(() => status(""), ms);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDateTime(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function friendlyError(error) {
  const messageText = String(error?.message || "");
  const code = String(error?.code || "");
  const map = {
    INVALID_NAME: "Enter a student name (2–60 characters).",
    INVALID_STUDENT_ID: "Use a valid Student ID, e.g. EV001.",
    INVALID_PASSWORD: "Password must be 6–100 characters.",
    INVALID_CLASS: "Choose Class 6–10.",
    STUDENT_ID_EXISTS: "That Student ID is already in use.",
    STUDENT_NOT_FOUND: "Student account not found.",
    INVALID_STUDENT_DATA: "Please check the student details.",
    STUDENT_SYNC_FAILED: "Account creation reached Authentication but database sync failed. Do not give these credentials to the student; check Firebase and retry.",
    FILE_REQUIRED: "Choose a PDF file.",
    PDF_ONLY: "Only PDF files are allowed.",
    FILE_EMPTY: "The selected PDF is empty.",
    FILE_TOO_LARGE: "PDF must be 100 MB or smaller.",
    UPLOAD_TIMEOUT: "Upload stalled for too long. Check your connection and retry.",
    NETWORK_TIMEOUT: "The request timed out. Please check your connection and retry.",
    "auth/invalid-credential": "Admin email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/network-request-failed": "Network error. Please check your connection.",
    "auth/user-disabled": "This admin account is disabled.",
    "auth/operation-not-allowed": "Email/Password sign-in is not enabled in Firebase.",
  };
  return map[messageText] || map[code] || "Something went wrong. Please try again.";
}

function showAuth() {
  el.authView.hidden = false;
  el.panel.hidden = true;
}

function showPanel() {
  el.authView.hidden = true;
  el.panel.hidden = false;
}

function tab(name) {
  el.tabs.forEach((button) => {
    const active = button.dataset.adminTab === name;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });

  el.panels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== name;
  });

  if (name === "students") loadStudents();
  if (name === "materials") loadMaterials();
}

function renderStats() {
  const materials = state.materials;
  el.statStudents.textContent = String(state.students.length);
  el.statMaterials.textContent = String(materials.length);
  el.statNotes.textContent = String(materials.filter((x) => x.section !== "worksheet").length);
  el.statWorksheets.textContent = String(materials.filter((x) => x.section === "worksheet").length);
  el.statPublished.textContent = String(materials.filter((x) => x.active).length);

  const bytes = materials.reduce((sum, item) => sum + Number(item.fileSize || 0), 0);
  el.statStorage.textContent = bytes ? fmtSize(bytes) : "0 KB";

  const latest = materials.slice(0, 6);
  el.overviewRecentMaterials.innerHTML = latest.length
    ? latest.map((item) => `
        <div class="mini-list-row">
          <span>
            <strong>${escapeHtml(item.title || "Untitled")}</strong>
            <small>Class ${Number(item.class)} • ${escapeHtml(item.subject)} • ${escapeHtml(item.section)}</small>
          </span>
          <b>${item.active ? "Published" : "Unpublished"}</b>
        </div>
      `).join("")
    : `<div class="table-empty">No materials uploaded yet.</div>`;
}

function studentFiltered() {
  const query = el.studentSearch.value.trim().toLowerCase();
  const classFilter = el.studentClassFilter.value;
  const statusFilter = el.studentStatusFilter.value;

  return state.students.filter((student) => {
    const matchesQuery =
      !query ||
      [student.displayName, student.studentId, student.uid]
        .join(" ")
        .toLowerCase()
        .includes(query);

    const matchesClass =
      classFilter === "all" || String(student.class || "") === classFilter;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && !student.disabled) ||
      (statusFilter === "disabled" && student.disabled);

    return matchesQuery && matchesClass && matchesStatus;
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
    return `
      <tr>
        <td>
          <div class="student-cell">
            <span class="table-avatar">${escapeHtml(initial)}</span>
            <div>
              <strong>${escapeHtml(student.displayName || "Unnamed")}</strong>
              <small>ID: ${escapeHtml(student.studentId)}</small>
            </div>
          </div>
        </td>
        <td>Class ${Number(student.class) || "—"}</td>
        <td><span class="status-pill ${student.disabled ? "disabled" : "active"}">${student.disabled ? "Disabled" : "Active"}</span></td>
        <td>${escapeHtml(fmtDateTime(student.lastSignInTime))}</td>
        <td>
          <div class="row-actions">
            <button class="mini-action" data-student-action="edit" data-uid="${escapeHtml(student.uid)}" type="button">Edit</button>
            <button class="mini-action ${student.disabled ? "success" : "danger"}"
              data-student-action="toggle" data-uid="${escapeHtml(student.uid)}" type="button">
              ${student.disabled ? "Enable" : "Disable"}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function materialFiltered() {
  const query = el.materialSearch.value.trim().toLowerCase();
  const classFilter = el.materialClassFilter.value;
  const subjectFilter = el.materialSubjectFilter.value;
  const sectionFilter = el.materialSectionFilter.value;

  return state.materials.filter((material) => {
    const queryOk =
      !query ||
      [material.title, material.chapter, material.fileName, material.subject, material.section]
        .join(" ")
        .toLowerCase()
        .includes(query);

    return queryOk &&
      (classFilter === "all" || String(material.class) === classFilter) &&
      (subjectFilter === "all" || material.subject === subjectFilter) &&
      (sectionFilter === "all" || material.section === sectionFilter);
  });
}

function renderMaterials() {
  const rows = materialFiltered();

  if (!rows.length) {
    el.materialsBody.innerHTML = `<tr><td colspan="6"><div class="table-empty">No materials match this filter.</div></td></tr>`;
    return;
  }

  const subjectLabels = Object.fromEntries(SUBJECTS.map((x) => [x.id, x.label]));
  const sectionLabels = Object.fromEntries(SECTIONS.map((x) => [x.id, x.label]));

  el.materialsBody.innerHTML = rows.map((material) => `
    <tr>
      <td>
        <div>
          <strong>${escapeHtml(material.title || "Untitled")}</strong>
          <small>${escapeHtml(material.fileName || "PDF")}${material.chapter ? ` • ${escapeHtml(material.chapter)}` : ""}</small>
        </div>
      </td>
      <td>Class ${Number(material.class)}</td>
      <td>${escapeHtml(sectionLabels[material.section] || material.section)}<small>${escapeHtml(subjectLabels[material.subject] || material.subject)}</small></td>
      <td>${escapeHtml(fmtSize(material.fileSize))}</td>
      <td><span class="status-pill ${material.active ? "active" : "disabled"}">${material.active ? "Published" : "Unpublished"}</span></td>
      <td>
        <div class="row-actions">
          <button class="mini-action" data-material-action="toggle" data-id="${escapeHtml(material.id)}" type="button">${material.active ? "Unpublish" : "Publish"}</button>
          <button class="mini-action" data-material-action="replace" data-id="${escapeHtml(material.id)}" type="button">Replace</button>
          <button class="mini-action danger" data-material-action="delete" data-id="${escapeHtml(material.id)}" type="button">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
}

async function loadStudents() {
  message(el.studentsMessage, "Loading students…", "loading");
  try {
    const result = await listStudents();
    state.students = result.students || [];
    renderStudents();
    renderStats();
    message(el.studentsMessage, `${state.students.length} student${state.students.length === 1 ? "" : "s"} loaded.`, "success");
  } catch (error) {
    console.error(error);
    message(el.studentsMessage, friendlyError(error), "error");
  }
}

async function loadMaterials() {
  message(el.materialsMessage, "Loading catalog…", "loading");
  try {
    state.materials = await loadAllCatalog();
    renderMaterials();
    renderStats();
    message(el.materialsMessage, `${state.materials.length} material${state.materials.length === 1 ? "" : "s"} loaded.`, "success");
  } catch (error) {
    console.error(error);
    message(el.materialsMessage, friendlyError(error), "error");
  }
}

function openCredentialsDialog({ studentId, password, classNumber }) {
  el.createdStudentId.textContent = studentId;
  el.createdStudentPassword.textContent = password;
  el.createdStudentClass.textContent = `Class ${classNumber}`;
  message(el.credentialsMessage, "");
  if (typeof el.credentialsDialog.showModal === "function") el.credentialsDialog.showModal();
  else el.credentialsDialog.hidden = false;
}

async function copyCredentials() {
  const text = [
    "EZEE VISION CHAMPUA — Student Login",
    `Student ID: ${el.createdStudentId.textContent}`,
    `Password: ${el.createdStudentPassword.textContent}`,
    `Class: ${el.createdStudentClass.textContent}`,
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    message(el.credentialsMessage, "Credentials copied to clipboard.", "success");
  } catch (error) {
    console.error(error);
    message(el.credentialsMessage, "Clipboard permission was unavailable. Copy the details manually.", "error");
  }
}

function resetStudentDialog() {
  el.studentForm.reset();
  el.studentUid.value = "";
  state.studentMode = "create";
  state.selectedStudent = null;
  el.studentDialogTitle.textContent = "Add Student";
  el.studentDialogEyebrow.textContent = "NEW STUDENT";
  el.studentId.readOnly = false;
  el.studentPassword.required = true;
  el.studentPassword.placeholder = "Minimum 6 characters";
  el.studentDialogSubmit.textContent = "Create Student";
  el.studentDialogHelp.innerHTML = `
    <strong>Simple student login</strong>
    <span>Give the student only the Student ID and password. No Google account or email is needed.</span>
  `;
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
    el.studentPassword.placeholder = "Password changes are not available in client-only mode";
    el.studentClass.value = String(student.class || "");
    el.studentDialogTitle.textContent = "Edit Student";
    el.studentDialogEyebrow.textContent = "STUDENT ACCOUNT";
    el.studentDialogSubmit.textContent = "Save Changes";
    el.studentDialogHelp.innerHTML = `
      <strong>Account management</strong>
      <span>Change the student's name or assigned class. Existing password is preserved.</span>
    `;
  }

  if (typeof el.studentDialog.showModal === "function") el.studentDialog.showModal();
  else el.studentDialog.hidden = false;
}

async function submitStudent(event) {
  event.preventDefault();

  const name = el.studentName.value.trim();
  const studentId = el.studentId.value.trim().toUpperCase();
  const password = el.studentPassword.value;
  const classNumber = Number(el.studentClass.value);

  if (name.length < 2 || name.length > 60) {
    message(el.studentDialogMessage, "Name must contain 2–60 characters.", "error");
    return;
  }
  if (!/^[A-Z0-9_-]{2,40}$/.test(studentId)) {
    message(el.studentDialogMessage, "Use 2–40 letters/numbers, '-' or '_'.", "error");
    return;
  }
  if (!Number.isInteger(classNumber) || !CLASSES.includes(classNumber)) {
    message(el.studentDialogMessage, "Choose Class 6–10.", "error");
    return;
  }

  if (state.studentMode === "create" && (password.length < 6 || password.length > 100)) {
    message(el.studentDialogMessage, "Password must be 6–100 characters.", "error");
    return;
  }

  el.studentDialogSubmit.disabled = true;
  message(
    el.studentDialogMessage,
    state.studentMode === "create" ? "Creating student…" : "Saving student…",
    "loading"
  );

  try {
    if (state.studentMode === "create") {
      const result = await createStudent({
        displayName: name,
        studentId,
        password,
        classNumber,
      });

      await loadStudents();
      el.studentDialog.close();
      openCredentialsDialog({
        studentId: result.studentId,
        password,
        classNumber,
      });
      status(`Student created: ${result.studentId}`);
      clearStatus(3500);
    } else {
      const result = await updateStudent({
        uid: el.studentUid.value,
        displayName: name,
        classNumber,
      });

      await loadStudents();
      el.studentDialog.close();
      status(`Student ${result.studentId || studentId} updated.`);
      clearStatus(2800);
    }
  } catch (error) {
    console.error(error);
    message(el.studentDialogMessage, friendlyError(error), "error");
  } finally {
    el.studentDialogSubmit.disabled = false;
  }
}

async function toggleStudent(student) {
  if (!student) return;

  const makeActive = student.disabled;
  const question = makeActive
    ? `Enable ${student.displayName || student.studentId}?`
    : `Disable ${student.displayName || student.studentId}?`;

  if (!window.confirm(question)) return;

  status(makeActive ? "Enabling student…" : "Disabling student…");

  try {
    await setStudentActive({ uid: student.uid, active: makeActive });
    await loadStudents();
    status(makeActive ? "Student enabled." : "Student disabled.");
    clearStatus();
  } catch (error) {
    console.error(error);
    status(friendlyError(error));
    clearStatus(3200);
  }
}

async function materialAction(action, id) {
  const material = state.materials.find((item) => item.id === id);
  if (!material) return;

  if (action === "toggle") {
    const target = !material.active;
    if (!window.confirm(`${target ? "Publish" : "Unpublish"} “${material.title}”?`)) return;

    status(target ? "Publishing material…" : "Unpublishing material…");

    try {
      const updated = await publishMaterial(material, target);
      Object.assign(material, updated);
      renderMaterials();
      renderStats();
      status(target ? "Material published." : "Material unpublished.");
      clearStatus();
    } catch (error) {
      console.error(error);
      status(friendlyError(error));
      clearStatus(3200);
    }
    return;
  }

  if (action === "delete") {
    if (!window.confirm(`Delete “${material.title}” permanently?`)) return;

    status("Deleting material…");
    try {
      await deleteMaterial(material);
      state.materials = state.materials.filter((item) => item.id !== material.id);
      renderMaterials();
      renderStats();
      status("Material deleted successfully.");
      clearStatus(3000);
    } catch (error) {
      console.error(error);
      status(friendlyError(error));
      clearStatus(3200);
    }
    return;
  }

  if (action === "replace") {
    state.replacingMaterial = material;
    replacementInput.value = "";
    replacementInput.click();
  }
}

const replacementInput = document.createElement("input");
replacementInput.type = "file";
replacementInput.accept = "application/pdf,.pdf";
replacementInput.hidden = true;
document.body.appendChild(replacementInput);

replacementInput.addEventListener("change", async () => {
  const file = replacementInput.files?.[0];
  const material = state.replacingMaterial;
  replacementInput.value = "";

  if (!file || !material) {
    state.replacingMaterial = null;
    return;
  }

  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
    status("Only PDF files are allowed.");
    clearStatus(2500);
    state.replacingMaterial = null;
    return;
  }

  if (file.size <= 0 || file.size > 100 * 1024 * 1024) {
    status("PDF must be larger than 0 and no more than 100 MB.");
    clearStatus(2500);
    state.replacingMaterial = null;
    return;
  }

  status("Replacing PDF… 0%");

  try {
    const updated = await replaceMaterial(
      material,
      file,
      material.active,
      (progress) => status(`Replacing PDF… ${progress.percent}%`)
    );

    state.materials = state.materials.map((item) =>
      item.id === updated.id ? updated : item
    );
    renderMaterials();
    renderStats();
    status("PDF replaced successfully.");
    clearStatus(3000);
  } catch (error) {
    console.error(error);
    status(friendlyError(error));
    clearStatus(3200);
  } finally {
    state.replacingMaterial = null;
  }
});

function fileSelected() {
  const file = el.uploadFile.files?.[0];

  if (!file) {
    el.uploadFileName.textContent = "Choose PDF file";
    el.uploadFileMeta.textContent = "Maximum 100 MB • PDF only";
    return;
  }

  el.uploadFileName.textContent = file.name;
  el.uploadFileMeta.textContent = `${fmtSize(file.size)} • PDF`;

  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
    message(el.uploadMessage, "Please select a PDF file.", "error");
  } else if (file.size <= 0 || file.size > 100 * 1024 * 1024) {
    message(el.uploadMessage, "PDF must be larger than 0 and no more than 100 MB.", "error");
  } else {
    message(el.uploadMessage, "File ready to upload.", "success");
  }
}

async function submitUpload(event) {
  event.preventDefault();

  const file = el.uploadFile.files?.[0];
  const classNumber = Number(el.uploadClass.value);
  const subject = el.uploadSubject.value;
  const section = el.uploadSection.value;
  const title = el.uploadTitle.value.trim();
  const chapter = el.uploadChapter.value.trim();

  if (!CLASSES.includes(classNumber) || !SUBJECTS.some((x) => x.id === subject) || !SECTIONS.some((x) => x.id === section)) {
    message(el.uploadMessage, "Choose class, subject and section.", "error");
    return;
  }

  if (title.length < 2 || title.length > 120) {
    message(el.uploadMessage, "Enter a title between 2 and 120 characters.", "error");
    return;
  }

  if (!file || file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
    message(el.uploadMessage, "Choose a valid PDF.", "error");
    return;
  }

  if (file.size <= 0 || file.size > 100 * 1024 * 1024) {
    message(el.uploadMessage, "PDF must be larger than 0 and no more than 100 MB.", "error");
    return;
  }

  const id = crypto.randomUUID
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const cleanFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-160);
  const storagePath = `study-materials/class-${classNumber}/${subject}/${section}/${id}.pdf`;

  const metadata = {
    id,
    title,
    chapter,
    class: classNumber,
    subject,
    section,
    storagePath,
    fileName: cleanFilename,
    type: "pdf",
    active: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  el.uploadBtn.disabled = true;
  el.chooseFile.disabled = true;
  el.uploadProgressWrap.hidden = false;
  el.uploadProgressBar.style.width = "0%";
  el.uploadProgressLabel.textContent = "Uploading PDF…";
  el.uploadProgressPercent.textContent = "0%";
  message(el.uploadMessage, "Starting upload…", "loading");

  try {
    const record = await uploadMaterial({
      file,
      metadata,
      publish: el.publishOnUpload.checked,
      onProgress: (progress) => {
        el.uploadProgressBar.style.width = `${progress.percent}%`;
        el.uploadProgressLabel.textContent = "Uploading PDF…";
        el.uploadProgressPercent.textContent = `${progress.percent}%`;
      },
    });

    state.materials.unshift(record);
    renderMaterials();
    renderStats();
    message(
      el.uploadMessage,
      record.active ? "Upload + publish complete." : "Upload complete; material remains unpublished.",
      "success"
    );

    el.uploadForm.reset();
    el.uploadFileName.textContent = "Choose PDF file";
    el.uploadFileMeta.textContent = "Maximum 100 MB • PDF only";
    window.setTimeout(() => tab("materials"), 700);
  } catch (error) {
    console.error(error);
    message(el.uploadMessage, friendlyError(error), "error");
  } finally {
    el.uploadBtn.disabled = false;
    el.chooseFile.disabled = false;
    window.setTimeout(() => { el.uploadProgressWrap.hidden = true; }, 1000);
  }
}

async function forgotPassword() {
  const email = el.email.value.trim().toLowerCase();
  if (email !== ADMIN_EMAIL.toLowerCase()) {
    message(el.authMessage, "Enter the authorised admin email.", "error");
    return;
  }

  el.forgotPasswordBtn.disabled = true;
  message(el.authMessage, "Sending password reset email…", "loading");
  try {
    await sendResetEmail(email);
    message(el.authMessage, "Password reset email sent. Check Inbox, Spam and Promotions.", "success");
  } catch (error) {
    console.error(error);
    message(el.authMessage, friendlyError(error), "error");
  } finally {
    el.forgotPasswordBtn.disabled = false;
  }
}

async function login(event) {
  event.preventDefault();

  const email = el.email.value.trim().toLowerCase();
  const password = el.password.value;

  if (email !== ADMIN_EMAIL.toLowerCase()) {
    message(el.authMessage, "This Admin Panel is reserved for the authorised admin account.", "error");
    return;
  }

  if (password.length < 6) {
    message(el.authMessage, "Enter the admin password.", "error");
    return;
  }

  el.loginBtn.disabled = true;
  message(el.authMessage, "Signing in securely…", "loading");

  try {
    await loginWithEmailAndPassword(email, password);
  } catch (error) {
    console.error(error);
    message(el.authMessage, friendlyError(error), "error");
  } finally {
    el.loginBtn.disabled = false;
  }
}

async function processAuthUser(user) {
  state.user = user;

  if (!user) {
    state.admin = false;
    showAuth();
    return;
  }

  if (String(user.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    await logout().catch(() => {});
    showAuth();
    message(el.authMessage, "This account is not authorised for the Admin Panel.", "error");
    return;
  }

  state.admin = true;
  el.sessionEmail.textContent = ADMIN_EMAIL;
  showPanel();
  await loadDashboard();
}

async function loadDashboard() {
  message(el.studentsMessage, "");
  message(el.materialsMessage, "");
  await Promise.allSettled([loadStudents(), loadMaterials()]);
  renderStats();
}

function bind() {
  el.loginForm.addEventListener("submit", login);
  el.forgotPasswordBtn.addEventListener("click", forgotPassword);
  el.logoutBtn.addEventListener("click", () => logout().catch((error) => {
    console.error(error);
    message(el.authMessage, friendlyError(error), "error");
  }));
  el.refreshBtn.addEventListener("click", loadDashboard);

  el.tabs.forEach((button) => {
    button.addEventListener("click", () => tab(button.dataset.adminTab));
  });

  el.overviewMaterialsBtn.addEventListener("click", () => tab("materials"));
  el.addStudentBtn.addEventListener("click", () => openStudentDialog());

  el.studentForm.addEventListener("submit", submitStudent);
  el.studentDialogClose.addEventListener("click", () => el.studentDialog.close());
  el.studentDialogCancel.addEventListener("click", () => el.studentDialog.close());

  el.credentialsCloseBtn.addEventListener("click", () => el.credentialsDialog.close());
  el.credentialsDoneBtn.addEventListener("click", () => el.credentialsDialog.close());
  el.copyCredentialsBtn.addEventListener("click", copyCredentials);

  [el.studentSearch, el.studentClassFilter, el.studentStatusFilter]
    .forEach((control) => control.addEventListener("input", renderStudents));

  [el.materialSearch, el.materialClassFilter, el.materialSubjectFilter, el.materialSectionFilter]
    .forEach((control) => control.addEventListener("input", renderMaterials));

  el.refreshMaterialsBtn.addEventListener("click", loadMaterials);

  el.chooseFile.addEventListener("click", () => el.uploadFile.click());
  el.uploadFile.addEventListener("change", fileSelected);
  el.uploadForm.addEventListener("submit", submitUpload);

  el.studentsBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-student-action]");
    if (!button) return;

    const student = state.students.find((item) => item.uid === button.dataset.uid);
    if (!student) return;

    if (button.dataset.studentAction === "edit") openStudentDialog(student);
    if (button.dataset.studentAction === "toggle") toggleStudent(student);
  });

  el.materialsBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-material-action]");
    if (!button) return;
    materialAction(button.dataset.materialAction, button.dataset.id);
  });

  observeAuth(processAuthUser);
}

async function bootstrap() {
  showAuth();
  el.email.value = ADMIN_EMAIL;

  try {
    await configureAuthPersistence();
    bind();
  } catch (error) {
    console.error(error);
    message(el.authMessage, "Admin application could not initialise. Check Firebase configuration.", "error");
  }
}

bootstrap().catch((error) => {
  console.error(error);
  showAuth();
  message(el.authMessage, "Admin application failed to initialise. Refresh and try again.", "error");
});
