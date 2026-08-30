import { auth, database } from "./firebase-init.js";
import {
  configureAuthPersistence,
  loginWithEmailAndPassword,
  sendResetEmail,
  logout,
  observeAuth,
  ADMIN_EMAIL,
} from "./auth.js";
import { get, ref, update } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { DRIVE_GATEWAY_URL } from "./drive-config.js";

const MAX_LINK_LENGTH = 2048;
const SUBJECTS = [
  { id: "sst", label: "SST", icon: "🌍" },
  { id: "science", label: "Science", icon: "🔬" },
  { id: "math", label: "Math", icon: "🧮" },
  { id: "english", label: "English", icon: "📚" },
];
const SECTIONS = [
  { id: "detailed", label: "Detailed Notes" },
  { id: "short", label: "Short Notes" },
  { id: "worksheet", label: "Worksheet" },
];
const CLASSES = [6, 7, 8, 9, 10];
export { SUBJECTS, SECTIONS, CLASSES, ADMIN_EMAIL };

function timeout(ms, code = "NETWORK_TIMEOUT") {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(code)), ms));
}
async function withTimeout(promise, ms = 15000) { return Promise.race([promise, timeout(ms)]); }
function normaliseStudentId(value) { return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40); }
function studentEmailFromId(studentId) { return `${normaliseStudentId(studentId).toLowerCase()}@students.ezeevisionchampua.com`; }
function cleanDriveId(value) { return String(value ?? "").trim(); }
export function extractDriveFileId(input) {
  const value = String(input ?? "").trim();
  if (!value) return "";
  if (/^[A-Za-z0-9_-]{10,200}$/.test(value)) return value;
  const patterns = [
    /\/file\/d\/([A-Za-z0-9_-]+)/i,
    /[?&]id=([A-Za-z0-9_-]+)/i,
    /\/d\/([A-Za-z0-9_-]+)/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return cleanDriveId(match[1]);
  }
  return "";
}
function requireGateway() { if (!DRIVE_GATEWAY_URL) throw new Error("DRIVE_GATEWAY_NOT_CONFIGURED"); }
function gatewayUrl(path, params = {}) {
  requireGateway();
  const url = new URL(path.replace(/^\//, ""), `${DRIVE_GATEWAY_URL.replace(/\/$/, "")}/`);
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v)); });
  return url;
}
async function firebaseToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("AUTH_REQUIRED");
  return user.getIdToken(true);
}
async function gatewayFetch(path, options = {}, timeoutMs = 30000) {
  const token = await firebaseToken();
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  const response = await withTimeout(fetch(gatewayUrl(path), { ...options, headers }), timeoutMs);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    const error = new Error(data?.message || `Gateway request failed (${response.status})`);
    error.status = response.status;
    error.code = data?.code || "GATEWAY_ERROR";
    throw error;
  }
  return data;
}

export function getDriveGatewayStatus() { return Boolean(DRIVE_GATEWAY_URL); }

function userRecordFromAuth(user, studentId, displayName, classNumber) {
  const now = Date.now();
  return { displayName, studentId, email: user.email || studentEmailFromId(studentId), role: "student", class: classNumber, active: true, createdAt: now, updatedAt: now, lastSignInTime: null };
}

export async function createStudent({ displayName, studentId, password, classNumber }) {
  const name = String(displayName ?? "").trim();
  const id = normaliseStudentId(studentId);
  const passwordText = String(password ?? "");
  const cls = Number(classNumber);
  if (name.length < 2 || name.length > 60) throw new Error("INVALID_NAME");
  if (!id || id.length < 2) throw new Error("INVALID_STUDENT_ID");
  if (passwordText.length < 6 || passwordText.length > 100) throw new Error("INVALID_PASSWORD");
  if (!CLASSES.includes(cls)) throw new Error("INVALID_CLASS");
  const existing = await withTimeout(get(ref(database, `studentIndex/${id}`)), 12000);
  if (existing.exists()) throw new Error("STUDENT_ID_EXISTS");

  // A secondary Firebase app keeps the admin session intact while creating a student.
  const { initializeApp, deleteApp } = await import("https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js");
  const { getAuth, createUserWithEmailAndPassword, updateProfile, signOut, deleteUser } = await import("https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js");
  const { firebaseConfig } = await import("./firebase-config.js");
  const secondaryApp = initializeApp(firebaseConfig, `student-creator-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const secondaryAuth = getAuth(secondaryApp);
  let createdUser = null;
  const email = studentEmailFromId(id);
  try {
    const credential = await withTimeout(createUserWithEmailAndPassword(secondaryAuth, email, passwordText), 20000);
    createdUser = credential.user;
    await withTimeout(updateProfile(createdUser, { displayName: name }), 12000);
    const record = userRecordFromAuth(createdUser, id, name, cls);
    try {
      await withTimeout(update(ref(database), { [`users/${createdUser.uid}`]: record, [`studentIndex/${id}`]: createdUser.uid }), 12000);
    } catch (dbError) {
      try { await deleteUser(createdUser); } catch (cleanupError) { console.error(cleanupError); }
      throw new Error("STUDENT_SYNC_FAILED");
    }
    return { success: true, uid: createdUser.uid, studentId: id, classNumber: cls, email };
  } catch (error) {
    if (error?.code === "auth/email-already-in-use") throw new Error("STUDENT_ID_EXISTS");
    throw error;
  } finally {
    try { await signOut(secondaryAuth); } catch {}
    try { await deleteApp(secondaryApp); } catch {}
  }
}

export async function listStudents() {
  const snapshot = await withTimeout(get(ref(database, "users")), 15000);
  const root = snapshot.val() || {};
  const students = Object.entries(root).filter(([, user]) => user?.role === "student").map(([uid, user]) => ({
    uid, email: user.email || "", studentId: user.studentId || String(user.email || "").split("@")[0].toUpperCase(),
    displayName: user.displayName || "", class: Number(user.class) || null, active: user.active !== false,
    disabled: user.active === false, createdAt: user.createdAt || null, lastSignInTime: user.lastSignInTime || null, provider: ["password"],
  })).sort((a,b) => String(a.studentId).localeCompare(String(b.studentId)));
  return { students, pageToken: "" };
}
export async function updateStudent({ uid, displayName, classNumber }) {
  const cls = Number(classNumber), name = String(displayName ?? "").trim();
  if (!uid || name.length < 2 || name.length > 60 || !CLASSES.includes(cls)) throw new Error("INVALID_STUDENT_DATA");
  const snapshot = await withTimeout(get(ref(database, `users/${uid}`)), 12000);
  const current = snapshot.val();
  if (!current || current.role !== "student") throw new Error("STUDENT_NOT_FOUND");
  await withTimeout(update(ref(database, `users/${uid}`), { displayName: name, class: cls, updatedAt: Date.now() }), 12000);
  return { success: true, uid, studentId: current.studentId || "", classNumber: cls };
}
export async function setStudentActive({ uid, active }) {
  const snapshot = await withTimeout(get(ref(database, `users/${uid}`)), 12000);
  const current = snapshot.val();
  if (!current || current.role !== "student") throw new Error("STUDENT_NOT_FOUND");
  await withTimeout(update(ref(database, `users/${uid}`), { active: Boolean(active), updatedAt: Date.now() }), 12000);
  return { success: true, active: Boolean(active) };
}
export async function setStudentPassword() { throw new Error("PASSWORD_MANAGEMENT_UNAVAILABLE"); }

export async function getAdminIdentity() {
  const user = auth.currentUser;
  if (!user) return { user: null, admin: false };
  return { user, admin: String(user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase() };
}

export async function loadAllCatalog() {
  const snapshot = await withTimeout(get(ref(database, "catalog")), 15000);
  const root = snapshot.val() || {};
  const materials = [];
  Object.entries(root).forEach(([classKey, node]) => Object.entries(node || {}).forEach(([id, raw]) => {
    if (!raw) return;
    const classNumber = Number(raw.class || String(classKey).replace("class-", ""));
    if (!CLASSES.includes(classNumber)) return;
    materials.push({ id, ...raw, class: classNumber, active: raw.active !== false, driveFileId: cleanDriveId(raw.driveFileId || extractDriveFileId(raw.driveUrl || "")) });
  }));
  materials.sort((a,b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  return materials;
}
export async function writePublished(material, publish) {
  const path = `publishedCatalog/class-${material.class}/${material.id}`;
  const updates = {};
  updates[path] = publish ? { ...material, active: true } : null;
  await withTimeout(update(ref(database), updates), 15000);
}

function validateMaterialMetadata(metadata) {
  const cls = Number(metadata.class);
  if (!CLASSES.includes(cls)) throw new Error("INVALID_CLASS");
  if (!SUBJECTS.some(x => x.id === metadata.subject)) throw new Error("INVALID_SUBJECT");
  if (!SECTIONS.some(x => x.id === metadata.section)) throw new Error("INVALID_SECTION");
  if (String(metadata.title || "").trim().length < 2) throw new Error("INVALID_TITLE");
  const driveFileId = extractDriveFileId(metadata.driveUrl || metadata.driveFileId);
  if (!driveFileId) throw new Error("INVALID_DRIVE_LINK");
  if (String(metadata.driveUrl || "").length > MAX_LINK_LENGTH) throw new Error("INVALID_DRIVE_LINK");
  return driveFileId;
}
export async function verifyDriveLink(driveUrl) {
  const driveFileId = extractDriveFileId(driveUrl);
  if (!driveFileId) throw new Error("INVALID_DRIVE_LINK");
  return {
    driveFileId,
    name: "Google Drive PDF",
    size: 0,
    mimeType: "application/pdf",
    verified: true,
  };
}
export async function uploadMaterial({ metadata, publish }) {
  const driveFileId = validateMaterialMetadata(metadata);
  const checked = await verifyDriveLink(metadata.driveUrl || driveFileId);
  const record = {
    id: metadata.id, title: String(metadata.title).trim(), chapter: String(metadata.chapter || "").trim(), class: Number(metadata.class), subject: metadata.subject, section: metadata.section,
    storageType: "google-drive", driveFileId, driveName: checked.name || "Google Drive PDF", fileName: checked.name || metadata.fileName || "Google Drive PDF", fileSize: Number(checked.size || 0), type: "pdf", active: Boolean(publish),
    createdAt: Number(metadata.createdAt || Date.now()), updatedAt: Date.now(),
  };
  await withTimeout(update(ref(database), { [`catalog/class-${record.class}/${record.id}`]: record }), 15000);
  if (publish) await writePublished(record, true);
  return record;
}
export async function replaceMaterial(material, metadata, publish) {
  const driveFileId = validateMaterialMetadata(metadata);
  const checked = await verifyDriveLink(metadata.driveUrl || driveFileId);
  const updated = {
    ...material, title: String(metadata.title).trim(), chapter: String(metadata.chapter || "").trim(), class: Number(metadata.class), subject: metadata.subject, section: metadata.section,
    storageType: "google-drive", driveFileId, driveName: checked.name || "Google Drive PDF", fileName: checked.name || "Google Drive PDF", fileSize: Number(checked.size || 0), active: Boolean(publish), updatedAt: Date.now(),
  };
  const updates = { [`catalog/class-${updated.class}/${updated.id}`]: updated, [`publishedCatalog/class-${updated.class}/${updated.id}`]: publish ? updated : null };
  if (material.class !== updated.class) {
    updates[`catalog/class-${material.class}/${material.id}`] = null;
    updates[`publishedCatalog/class-${material.class}/${material.id}`] = null;
  }
  await withTimeout(update(ref(database), updates), 15000);
  return updated;
}
export async function deleteMaterial(material) {
  // Deliberately removes the portal record only; the original Drive file remains safe in the owner's Drive.
  const updates = { [`catalog/class-${material.class}/${material.id}`]: null, [`publishedCatalog/class-${material.class}/${material.id}`]: null };
  await withTimeout(update(ref(database), updates), 15000);
}
export async function publishMaterial(material, publish) {
  const updated = { ...material, active: Boolean(publish), updatedAt: Date.now() };
  await withTimeout(update(ref(database), {
    [`catalog/class-${material.class}/${material.id}`]: updated,
    [`publishedCatalog/class-${material.class}/${material.id}`]: publish ? updated : null,
  }), 15000);
  return updated;
}

export { configureAuthPersistence, loginWithEmailAndPassword, sendResetEmail, logout, observeAuth, auth };
