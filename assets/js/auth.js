import {
  GoogleAuthProvider,
  browserLocalPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { auth, database } from "./firebase-init.js";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function configureAuthPersistence() {
  await setPersistence(auth, browserLocalPersistence);
}

export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function loginWithPassword(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function loginWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function sendResetEmail(email) {
  return sendPasswordResetEmail(auth, email);
}

export async function logout() {
  await signOut(auth);
}

export async function loadStudentProfile(uid) {
  const snapshot = await get(ref(database, `users/${uid}`));
  return snapshot.exists() ? snapshot.val() : null;
}

export function getFriendlyAuthError(error) {
  const code = error?.code || "";
  const messages = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Please wait a little and try again.",
    "auth/popup-closed-by-user": "Google sign-in was closed before it finished.",
    "auth/popup-blocked": "Your browser blocked the Google sign-in window.",
    "auth/network-request-failed": "Network error. Please check your internet connection.",
    "auth/user-disabled": "This account has been disabled. Please contact the institute.",
    "auth/user-not-found": "No authorised account was found for this email.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/operation-not-allowed": "This sign-in method is not enabled in Firebase yet.",
    "auth/requires-recent-login": "Please sign in again before continuing.",
  };
  return messages[code] || "Something went wrong. Please try again.";
}
