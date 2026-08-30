import { database } from "./firebase-init.js";
import {
  get,
  ref,
  update,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const RECENT_LIMIT = 15;

function withTimeout(promise, ms = 9000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("NETWORK_TIMEOUT")), ms)
    ),
  ]);
}

export async function loadRecent(uid) {
  if (!uid) return [];
  const snapshot = await withTimeout(get(ref(database, `recent/${uid}`)));
  const value = snapshot.val() || {};

  return Object.entries(value)
    .map(([id, item]) => ({ id, ...item }))
    .filter((item) => item && item.active !== false && Number(item.lastOpened) > 0)
    .sort((a, b) => Number(b.lastOpened) - Number(a.lastOpened))
    .slice(0, RECENT_LIMIT);
}

export async function saveRecent(uid, material) {
  if (!uid || !material?.id) return;

  const now = Date.now();
  const payload = {
    title: material.title || "Untitled Material",
    chapter: material.chapter || "",
    class: Number(material.class),
    subject: material.subject,
    section: material.section,
    fileName: material.fileName || "",
    lastOpened: now,
    active: true,
  };

  await withTimeout(
    update(ref(database, `recent/${uid}/${material.id}`), payload)
  );

  // Efficient pruning: only runs after a successful write and only reads
  // the student's small recent node. It never touches PDFs.
  const current = await withTimeout(get(ref(database, `recent/${uid}`)));
  const entries = Object.entries(current.val() || {})
    .map(([id, item]) => ({ id, ...item }))
    .sort((a, b) => Number(b.lastOpened || 0) - Number(a.lastOpened || 0));

  const staleIds = entries.slice(RECENT_LIMIT).map((entry) => entry.id);
  if (staleIds.length) {
    const removals = {};
    staleIds.forEach((id) => {
      removals[`recent/${uid}/${id}`] = null;
    });
    await withTimeout(update(ref(database), removals));
  }
}

export function clearRecentCache() {
  // Intentionally empty: recent is server-backed and loaded fresh when opened.
}
