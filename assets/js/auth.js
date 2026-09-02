import {
  browserLocalPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { auth, database } from "./firebase-init.js";
import { ADMIN_EMAIL, STUDENT_EMAIL_DOMAIN } from "./constants.js";

export { ADMIN_EMAIL, STUDENT_EMAIL_DOMAIN };

export async function configureAuthPersistence() {
  await setPersistence(auth, browserLocalPersistence);
}

export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

function withTimeout(promise, ms = 20000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("AUTH_TIMEOUT")), ms)),
  ]);
}

export async function loginWithEmailAndPassword(email, password) {
  return withTimeout(signInWithEmailAndPassword(auth, email, password));
}

export async function loginWithStudentId(studentId, password) {
  const id = normaliseStudentId(studentId);
  if (!id) throw new Error("INVALID_STUDENT_ID");
  return withTimeout(
    signInWithEmailAndPassword(
      auth,
      `${id.toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`,
      password
    )
  );
}

export async function sendResetEmail(email) {
  return sendPasswordResetEmail(auth, email);
}

export async function logout() {
  await signOut(auth);
}

export async function loadStudentProfile(uid) {
  if (!uid) return null;
  const snapshot = await get(ref(database, `users/${uid}`));
  return snapshot.exists() ? snapshot.val() : null;
}

export function normaliseStudentId(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 40);
}

export function getFriendlyAuthError(error) {
  const code = error?.code || "";
  const messages = {
    "auth/invalid-credential": "Student ID or password is incorrect.",
    "auth/invalid-email": "Please enter a valid Student ID.",
    "auth/too-many-requests": "Too many attempts. Please wait a little and try again.",
    "auth/network-request-failed": "Network error. Please check your connection.",
    "auth/user-disabled": "This student account is disabled. Contact EZEE VISION CHAMPUA.",
    "auth/user-not-found": "Student ID or password is incorrect.",
    "auth/wrong-password": "Student ID or password is incorrect.",
    "auth/operation-not-allowed": "Email/Password sign-in is not enabled in Firebase.",
  };

  switch (error?.message) {
    case "INVALID_STUDENT_ID":
      return "Enter your Student ID.";
    case "AUTH_TIMEOUT":
      return "Login is taking too long. Check your connection and try again.";
    default:
      return messages[code] || "Something went wrong. Please try again.";
  }
}
