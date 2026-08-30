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

export async function configureAuthPersistence() { await setPersistence(auth, browserLocalPersistence); }
export function observeAuth(callback) { return onAuthStateChanged(auth, callback); }
export async function loginWithEmailAndPassword(email, password) { return signInWithEmailAndPassword(auth, email, password); }
export async function sendResetEmail(email) { return sendPasswordResetEmail(auth, email); }
export async function logout() { await signOut(auth); }
export async function loadStudentProfile(uid) { const snapshot = await get(ref(database, `users/${uid}`)); return snapshot.exists() ? snapshot.val() : null; }

export function getFriendlyAuthError(error) {
  const code = error?.code || "";
  const messages = {
    "auth/invalid-credential": "ID/email or password is incorrect.",
    "auth/invalid-email": "Please enter a valid Student ID or email.",
    "auth/too-many-requests": "Too many attempts. Please wait a little and try again.",
    "auth/network-request-failed": "Network error. Please check your internet connection.",
    "auth/user-disabled": "This account has been disabled. Please contact the institute.",
    "auth/user-not-found": "No authorised account was found.",
    "auth/wrong-password": "ID/email or password is incorrect.",
    "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase yet.",
  };
  return messages[code] || "Something went wrong. Please try again.";
}

export const loginWithPassword = loginWithEmailAndPassword;
