import { auth, database } from "./firebase-init.js";
import { updateProfile as updateFirebaseProfile } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { ref, update, get } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { STUDENT_EMAIL_DOMAIN, normaliseStudentId } from "./auth.js";
import { DRIVE_GATEWAY_URL } from "./drive-config.js";

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


export async function deleteStudentAccount(password) {
  const user = auth.currentUser;
  if (!user) throw new Error("PROFILE_AUTH_REQUIRED");
  const profile = await refreshStudentProfile(user.uid);
  if (!profile || String(profile.role || "student").toLowerCase() !== "student") {
    throw new Error("ACCOUNT_DELETE_NOT_ALLOWED");
  }
  const studentId = normaliseStudentId(profile.studentId || "");
  if (!studentId) throw new Error("ACCOUNT_DELETE_PROFILE_MISSING");
  if (!password || String(password).length < 6) throw new Error("ACCOUNT_DELETE_PASSWORD_REQUIRED");

  const credential = EmailAuthProvider.credential(
    `${studentId.toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`,
    String(password)
  );
  await withTimeout(reauthenticateWithCredential(user, credential), 15000);

  const idToken = await user.getIdToken(true);
  const response = await fetch(`${DRIVE_GATEWAY_URL.replace(/\/$/, "")}/account/delete/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ confirm: true })
  });
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok || !data?.success) {
    const error = new Error(data?.message || "Account deletion failed. Please try again.");
    error.code = data?.code || `ACCOUNT_DELETE_HTTP_${response.status}`;
    throw error;
  }
  return data;
}
