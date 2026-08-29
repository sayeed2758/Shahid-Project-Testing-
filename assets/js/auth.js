import {
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import { auth } from "./firebase-config.js";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

let persistenceReady = null;
let authObserverStarted = false;
let authObserverUnsubscribe = null;

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
  ]);
}

function ensurePersistence() {
  if (!persistenceReady) {
    persistenceReady = withTimeout(
      setPersistence(auth, browserLocalPersistence),
      10000,
      "Firebase session setup timed out. Please check your connection and retry."
    ).catch(error => {
      persistenceReady = null;
      throw error;
    });
  }
  return persistenceReady;
}

function friendlyAuthError(error) {
  const code = error?.code || "";
  if (error?.message && !code) return error.message;

  const messages = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/user-disabled": "This account has been disabled. Contact the administrator.",
    "auth/too-many-requests": "Too many attempts. Please wait a little and try again.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/popup-blocked": "Google sign-in popup was blocked. Please allow popups and try again.",
    "auth/network-request-failed": "Network error. Check your internet connection and try again.",
    "auth/operation-not-allowed": "This sign-in method is not enabled in Firebase.",
    "auth/user-not-found": "No account was found for this email.",
    "auth/wrong-password": "Email or password is incorrect."
  };

  return messages[code] || "Something went wrong. Please try again.";
}

async function loginWithEmail(email, password) {
  await ensurePersistence();
  const result = await withTimeout(
    signInWithEmailAndPassword(auth, email.trim(), password),
    20000,
    "Login timed out. Please check your internet connection and try again."
  );
  return result.user;
}

async function loginWithGoogle() {
  await ensurePersistence();
  const result = await withTimeout(
    signInWithPopup(auth, googleProvider),
    30000,
    "Google sign-in timed out. Please try again."
  );
  return result.user;
}

async function resetPassword(email) {
  await ensurePersistence();
  await withTimeout(
    sendPasswordResetEmail(auth, email.trim()),
    20000,
    "Password reset request timed out. Please check your connection and try again."
  );
}

async function logout() {
  await withTimeout(signOut(auth), 10000, "Logout timed out. Please try again.");
}

async function updateStudentDisplayName(displayName) {
  const user = auth.currentUser;
  if (!user) throw new Error("You are not signed in.");

  const cleanName = displayName.trim();
  if (!cleanName) throw new Error("Please enter your name.");

  await withTimeout(updateProfile(user, { displayName: cleanName }), 10000, "Profile update timed out. Please try again.");
}

function startAuthObserver(callback) {
  if (authObserverStarted) return authObserverUnsubscribe;

  authObserverStarted = true;
  authObserverUnsubscribe = onAuthStateChanged(auth, callback);
  return authObserverUnsubscribe;
}

function getCurrentUser() {
  return auth.currentUser;
}

export {
  ensurePersistence,
  friendlyAuthError,
  getCurrentUser,
  loginWithEmail,
  loginWithGoogle,
  logout,
  resetPassword,
  startAuthObserver,
  updateStudentDisplayName
};
