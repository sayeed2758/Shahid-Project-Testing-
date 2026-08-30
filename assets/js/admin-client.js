import { auth, database, firebaseApp } from "./firebase-init.js";
import {
  configureAuthPersistence,
  observeAuth,
  loginWithEmailAndPassword,
  loginWithGoogle,
  sendResetEmail,
  logout,
} from "./auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";
import { get, ref, update } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import {
  deleteObject,
  getMetadata,
  ref as storageRef,
  updateMetadata,
  uploadBytesResumable,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";

const FUNCTIONS_REGION = "asia-southeast1";
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const functions = getFunctions(firebaseApp, FUNCTIONS_REGION);

const call = (name) => httpsCallable(functions, name);

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
const BOOTSTRAP_EMAIL = "creativesayeedd@gmail.com";

export { SUBJECTS, SECTIONS, CLASSES, BOOTSTRAP_EMAIL };

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("NETWORK_TIMEOUT")), ms));
}

async function withTimeout(promise, ms = 20000) {
  return Promise.race([promise, timeout(ms)]);
}

export async function adminBootstrap() {
  return call("bootstrapAdmin")({});
}

export async function createStudent(payload) {
  return call("createStudent")(payload);
}

export async function listStudents(pageToken = "") {
  const result = await call("listStudents")({ pageToken, pageSize: 200 });
  return result.data;
}

export async function updateStudent(payload) {
  return call("updateStudent")(payload);
}

export async function setStudentActive(payload) {
  return call("setStudentActive")(payload);
}

export async function setStudentPassword(payload) {
  return call("setStudentPassword")(payload);
}

export async function getAdminIdentity(forceRefresh = true) {
  const user = auth.currentUser;
  if (!user) return { user: null, admin: false, token: null };
  const tokenResult = await user.getIdTokenResult(forceRefresh);
  return { user, admin: tokenResult.claims.admin === true, token: tokenResult.claims };
}

export async function loadAllCatalog() {
  const snapshot = await withTimeout(get(ref(database, "catalog")), 20000);
  const rootValue = snapshot.val() || {};
  const materials = [];

  Object.entries(rootValue).forEach(([classKey, node]) => {
    Object.entries(node || {}).forEach(([id, raw]) => {
      if (!raw) return;
      const classNumber = Number(raw.class || String(classKey).replace("class-", ""));
      if (!CLASSES.includes(classNumber)) return;
      materials.push({
        id,
        ...raw,
        class: classNumber,
        active: raw.active !== false,
      });
    });
  });

  materials.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  return materials;
}

export async function writePublished(material, publish) {
  const path = `publishedCatalog/class-${material.class}/${material.id}`;
  const databaseUpdates = {};

  if (publish) {
    databaseUpdates[path] = { ...material, active: true };
  } else {
    databaseUpdates[path] = null;
  }

  await withTimeout(update(ref(database), databaseUpdates), 20000);
}

export async function syncStorageActive(storagePath, active) {
  const fileRef = storageRef((await import("./firebase-init.js")).storage, storagePath);
  await withTimeout(updateMetadata(fileRef, {
    customMetadata: {
      active: active ? "true" : "false",
    },
  }), 30000);
}

export async function uploadMaterial({ file, metadata, publish, onProgress }) {
  if (!(file instanceof File)) throw new Error("FILE_REQUIRED");
  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("PDF_ONLY");
  }
  if (file.size <= 0) throw new Error("FILE_EMPTY");
  if (file.size > MAX_FILE_BYTES) throw new Error("FILE_TOO_LARGE");

  const { storage } = await import("./firebase-init.js");
  const objectRef = storageRef(storage, metadata.storagePath);

  // Upload disabled/private first. If database sync fails, the object is removed.
  const uploadTask = uploadBytesResumable(objectRef, file, {
    contentType: "application/pdf",
    customMetadata: {
      active: "false",
      title: metadata.title,
      class: String(metadata.class),
      subject: metadata.subject,
      section: metadata.section,
    },
  });

  const snapshot = await new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (progress) => onProgress?.({
        loaded: progress.bytesTransferred,
        total: progress.totalBytes,
        percent: progress.totalBytes ? Math.round((progress.bytesTransferred / progress.totalBytes) * 100) : 0,
      }),
      reject,
      () => resolve(uploadTask.snapshot)
    );
  });

  const record = {
    ...metadata,
    fileSize: snapshot.totalBytes,
    type: "pdf",
    active: Boolean(publish),
    createdAt: metadata.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  try {
    await withTimeout(update(ref(database, `catalog/class-${record.class}/${record.id}`), record), 20000);
    if (publish) {
      await syncStorageActive(record.storagePath, true);
      await writePublished(record, true);
    }
    return record;
  } catch (error) {
    try { await deleteObject(objectRef); } catch {}
    throw error;
  }
}

export async function replaceMaterial(material, file, publishState, onProgress) {
  if (!(file instanceof File)) throw new Error("FILE_REQUIRED");
  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) throw new Error("PDF_ONLY");
  if (file.size <= 0) throw new Error("FILE_EMPTY");
  if (file.size > MAX_FILE_BYTES) throw new Error("FILE_TOO_LARGE");

  const { storage } = await import("./firebase-init.js");
  const stamp = Date.now();
  const newPath = `study-materials/class-${material.class}/${material.subject}/${material.section}/${material.id}-${stamp}.pdf`;
  const newRef = storageRef(storage, newPath);

  const task = uploadBytesResumable(newRef, file, {
    contentType: "application/pdf",
    customMetadata: {
      active: "false",
      title: String(material.title || ""),
      class: String(material.class),
      subject: String(material.subject),
      section: String(material.section),
    },
  });

  const snapshot = await new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (progress) => onProgress?.({ loaded: progress.bytesTransferred, total: progress.totalBytes, percent: progress.totalBytes ? Math.round(progress.bytesTransferred / progress.totalBytes * 100) : 0 }),
      reject,
      () => resolve(task.snapshot)
    );
  });

  const updated = {
    ...material,
    fileName: file.name,
    fileSize: snapshot.totalBytes,
    storagePath: newPath,
    type: "pdf",
    active: Boolean(publishState),
    updatedAt: Date.now(),
  };

  try {
    await withTimeout(update(ref(database, `catalog/class-${updated.class}/${updated.id}`), updated), 20000);
    if (publishState) {
      await syncStorageActive(updated.storagePath, true);
      await writePublished(updated, true);
    } else {
      await syncStorageActive(updated.storagePath, false);
      await writePublished(updated, false);
    }

    // New record is now authoritative. Old file can be removed safely.
    if (material.storagePath && material.storagePath !== newPath) {
      try {
        await deleteObject(storageRef(storage, material.storagePath));
      } catch (cleanupError) {
        console.warn("Old file cleanup failed after successful replacement.", cleanupError);
      }
    }
    return updated;
  } catch (error) {
    try { await deleteObject(newRef); } catch {}
    throw error;
  }
}

export async function deleteMaterial(material) {
  const { storage } = await import("./firebase-init.js");

  if (material.storagePath) {
    try {
      await withTimeout(deleteObject(storageRef(storage, material.storagePath)), 30000);
    } catch (error) {
      if (String(error?.code || "") !== "storage/object-not-found") throw error;
    }
  }

  const updates = {};
  updates[`catalog/class-${material.class}/${material.id}`] = null;
  updates[`publishedCatalog/class-${material.class}/${material.id}`] = null;
  await withTimeout(update(ref(database), updates), 20000);
}

export async function publishMaterial(material, publish) {
  const updates = {};
  const updated = { ...material, active: Boolean(publish), updatedAt: Date.now() };
  updates[`catalog/class-${material.class}/${material.id}`] = updated;
  await withTimeout(update(ref(database), updates), 20000);
  try {
    await syncStorageActive(updated.storagePath, publish);
    await writePublished(updated, publish);
  } catch (error) {
    // Roll database master record back if storage/publish mirror failed.
    const rollback = { ...material };
    await update(ref(database, `catalog/class-${material.class}/${material.id}`), rollback).catch(() => {});
    throw error;
  }
  return updated;
}

export function listenForAuth(callback) {
  return observeAuth(callback);
}

export { configureAuthPersistence, loginWithEmailAndPassword, loginWithGoogle, sendResetEmail, logout, auth };
