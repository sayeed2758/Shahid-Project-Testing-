import { auth, database } from "./firebase-init.js";
import { updateProfile as updateFirebaseProfile } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { ref, update, get } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

function withTimeout(promise, ms = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("NETWORK_TIMEOUT")), ms);
    }),
  ]);
}

export async function updateStudentDisplayName(uid, displayName) {
  const cleanName = String(displayName || "").trim();

  if (!uid || !auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("PROFILE_AUTH_REQUIRED");
  }
  if (cleanName.length < 2) throw new Error("PROFILE_NAME_TOO_SHORT");
  if (cleanName.length > 60) throw new Error("PROFILE_NAME_TOO_LONG");

  await withTimeout(
    updateFirebaseProfile(auth.currentUser, { displayName: cleanName })
  );

  await withTimeout(
    update(ref(database, `users/${uid}`), {
      displayName: cleanName,
      updatedAt: Date.now(),
    })
  );

  return cleanName;
}

export async function refreshStudentProfile(uid) {
  if (!uid) return null;
  const snapshot = await withTimeout(get(ref(database, `users/${uid}`)));
  return snapshot.exists() ? snapshot.val() : null;
}

export function getFriendlyProfileError(error) {
  switch (error?.message) {
    case "PROFILE_AUTH_REQUIRED":
      return "Your session is no longer valid. Please sign in again.";
    case "PROFILE_NAME_TOO_SHORT":
      return "Name must contain at least 2 characters.";
    case "PROFILE_NAME_TOO_LONG":
      return "Name must be 60 characters or fewer.";
    case "NETWORK_TIMEOUT":
      return "The request took too long. Please check your connection and retry.";
    default:
      return "Profile could not be saved. Please try again.";
  }
}
