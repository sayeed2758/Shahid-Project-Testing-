import { auth, database, storage, firebaseApp } from "./firebase-init.js";
import { firebaseConfig } from "./firebase-config.js";
import {
  configureAuthPersistence,
  loginWithEmailAndPassword,
  sendResetEmail,
  logout,
  observeAuth,
  ADMIN_EMAIL,
} from "./auth.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as secondarySignOut,
  deleteUser,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  get,
  ref,
  update,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import {
  deleteObject,
  updateMetadata,
  uploadBytesResumable,
  ref as storageRef,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const STUDENT_EMAIL_DOMAIN = "students.ezeevisionchampua.com";

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

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("NETWORK_TIMEOUT")), ms));
}

async function withTimeout(promise, ms = 20000) {
  return Promise.race([promise, timeout(ms)]);
}

function normaliseStudentId(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 40);
}

function studentEmailFromId(studentId) {
  return `${normaliseStudentId(studentId).toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
}

function userRecordFromAuth(user, studentId, displayName, classNumber) {
  const now = Date.now();
  return {
    displayName,
    studentId,
    email: studentEmailFromId(studentId),
    role: "student",
    class: classNumber,
    active: true,
    createdAt: now,
    updatedAt: now,
    lastSignInTime: null,
  };
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

  const secondaryApp = initializeApp(
    firebaseConfig,
    `student-creator-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const secondaryAuth = getAuth(secondaryApp);
  const email = studentEmailFromId(id);
  let createdUser = null;

  try {
    const credential = await withTimeout(
      createUserWithEmailAndPassword(secondaryAuth, email, passwordText),
      20000
    );
    createdUser = credential.user;
    await withTimeout(updateProfile(createdUser, { displayName: name }), 12000);

    const record = userRecordFromAuth(createdUser, id, name, cls);

    try {
      await withTimeout(
        update(ref(database), {
          [`users/${createdUser.uid}`]: record,
          [`studentIndex/${id}`]: createdUser.uid,
        }),
        12000
      );
    } catch (databaseError) {
      // The secondary auth instance is currently signed in as the newly
      // created student, so Firebase allows us to delete that just-created
      // account and avoid an orphan Auth record.
      try { await deleteUser(createdUser); } catch (cleanupError) {
        console.error("Student Auth cleanup failed:", cleanupError);
      }
      throw new Error("STUDENT_SYNC_FAILED");
    }

    return { success: true, uid: createdUser.uid, studentId: id, classNumber: cls };
  } catch (error) {
    if (error?.code === "auth/email-already-in-use") throw new Error("STUDENT_ID_EXISTS");
    throw error;
  } finally {
    try { await secondarySignOut(secondaryAuth); } catch {}
    try { await deleteApp(secondaryApp); } catch {}
  }
}

export async function listStudents() {
  const snapshot = await withTimeout(get(ref(database, "users")), 15000);
  const root = snapshot.val() || {};

  const students = Object.entries(root)
    .filter(([, user]) => user && user.role === "student")
    .map(([uid, user]) => ({
      uid,
      email: user.email || "",
      studentId: user.studentId || String(user.email || "").split("@")[0].toUpperCase(),
      displayName: user.displayName || "",
      class: Number(user.class) || null,
      active: user.active !== false,
      disabled: user.active === false,
      createdAt: user.createdAt || null,
      lastSignInTime: user.lastSignInTime || null,
      provider: ["password"],
    }))
    .sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)));

  return { students, pageToken: "" };
}

export async function updateStudent({ uid, displayName, classNumber }) {
  const cls = Number(classNumber);
  const name = String(displayName ?? "").trim();
  if (!uid || name.length < 2 || name.length > 60 || !CLASSES.includes(cls)) {
    throw new Error("INVALID_STUDENT_DATA");
  }

  const snapshot = await withTimeout(get(ref(database, `users/${uid}`)), 12000);
  const current = snapshot.val();
  if (!current || current.role !== "student") throw new Error("STUDENT_NOT_FOUND");

  await withTimeout(
    update(ref(database, `users/${uid}`), {
      displayName: name,
      class: cls,
      updatedAt: Date.now(),
    }),
    12000
  );

  return { success: true, uid, studentId: current.studentId || "", classNumber: cls };
}

export async function setStudentActive({ uid, active }) {
  const snapshot = await withTimeout(get(ref(database, `users/${uid}`)), 12000);
  const current = snapshot.val();
  if (!current || current.role !== "student") throw new Error("STUDENT_NOT_FOUND");

  await withTimeout(
    update(ref(database, `users/${uid}`), {
      active: Boolean(active),
      updatedAt: Date.now(),
    }),
    12000
  );

  return { success: true, active: Boolean(active) };
}

// Password management is intentionally delegated to Firebase's reset email in
// the simplified client-only architecture; because students use synthetic
// addresses they do not have mailbox access, so the Admin UI does not expose
// a misleading password button.
export async function setStudentPassword() {
  throw new Error("PASSWORD_MANAGEMENT_UNAVAILABLE");
}

export async function getAdminIdentity() {
  const user = auth.currentUser;
  if (!user) return { user: null, admin: false, token: null };

  const admin = String(user.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();
  return {
    user,
    admin,
    token: { admin, role: admin ? "admin" : "" },
  };
}

export async function loadAllCatalog() {
  const snapshot = await withTimeout(get(ref(database, "catalog")), 15000);
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
  const updates = {};
  updates[path] = publish ? { ...material, active: true } : null;
  await withTimeout(update(ref(database), updates), 15000);
}

export async function syncStorageActive(storagePath, active) {
  await withTimeout(
    updateMetadata(storageRef(storage, storagePath), {
      customMetadata: { active: active ? "true" : "false" },
    }),
    30000
  );
}

function validatePdfFile(file) {
  if (!(file instanceof File)) throw new Error("FILE_REQUIRED");
  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("PDF_ONLY");
  }
  if (file.size <= 0) throw new Error("FILE_EMPTY");
  if (file.size > MAX_FILE_BYTES) throw new Error("FILE_TOO_LARGE");
}

export async function uploadMaterial({ file, metadata, publish, onProgress }) {
  validatePdfFile(file);

  const objectRef = storageRef(storage, metadata.storagePath);
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
    let watchdog = null;
    const resetWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        try { uploadTask.cancel(); } catch {}
        reject(new Error("UPLOAD_TIMEOUT"));
      }, 45000);
    };

    resetWatchdog();

    uploadTask.on(
      "state_changed",
      (progress) => {
        resetWatchdog();
        onProgress?.({
          loaded: progress.bytesTransferred,
          total: progress.totalBytes,
          percent: progress.totalBytes
            ? Math.round(progress.bytesTransferred / progress.totalBytes * 100)
            : 0,
        });
      },
      (error) => {
        clearTimeout(watchdog);
        reject(error);
      },
      () => {
        clearTimeout(watchdog);
        resolve(uploadTask.snapshot);
      }
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
    await withTimeout(
      update(ref(database, `catalog/class-${record.class}/${record.id}`), record),
      15000
    );

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
  validatePdfFile(file);

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
    let watchdog = null;
    const resetWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        try { task.cancel(); } catch {}
        reject(new Error("UPLOAD_TIMEOUT"));
      }, 45000);
    };

    resetWatchdog();

    task.on(
      "state_changed",
      (progress) => {
        resetWatchdog();
        onProgress?.({
          loaded: progress.bytesTransferred,
          total: progress.totalBytes,
          percent: progress.totalBytes
            ? Math.round(progress.bytesTransferred / progress.totalBytes * 100)
            : 0,
        });
      },
      (error) => {
        clearTimeout(watchdog);
        reject(error);
      },
      () => {
        clearTimeout(watchdog);
        resolve(task.snapshot);
      }
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
    await withTimeout(
      update(ref(database, `catalog/class-${updated.class}/${updated.id}`), updated),
      15000
    );
    await syncStorageActive(updated.storagePath, Boolean(publishState));
    await writePublished(updated, Boolean(publishState));

    if (material.storagePath && material.storagePath !== newPath) {
      try { await deleteObject(storageRef(storage, material.storagePath)); } catch {}
    }

    return updated;
  } catch (error) {
    try { await deleteObject(newRef); } catch {}
    throw error;
  }
}

export async function deleteMaterial(material) {
  if (material.storagePath) {
    try {
      await withTimeout(
        deleteObject(storageRef(storage, material.storagePath)),
        30000
      );
    } catch (error) {
      if (!String(error?.code || "").includes("storage/object-not-found")) throw error;
    }
  }

  const updates = {};
  updates[`catalog/class-${material.class}/${material.id}`] = null;
  updates[`publishedCatalog/class-${material.class}/${material.id}`] = null;

  await withTimeout(update(ref(database), updates), 15000);
}

export async function publishMaterial(material, publish) {
  const updated = {
    ...material,
    active: Boolean(publish),
    updatedAt: Date.now(),
  };

  await withTimeout(
    update(ref(database, `catalog/class-${material.class}/${material.id}`), updated),
    15000
  );

  try {
    await syncStorageActive(updated.storagePath, publish);
    await writePublished(updated, publish);
  } catch (error) {
    await update(
      ref(database, `catalog/class-${material.class}/${material.id}`),
      material
    ).catch(() => {});
    throw error;
  }

  return updated;
}

export {
  configureAuthPersistence,
  loginWithEmailAndPassword,
  sendResetEmail,
  logout,
  observeAuth,
  auth,
};
