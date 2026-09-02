import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  browserLocalPersistence,
  EmailAuthProvider,
  GoogleAuthProvider,
  getAuth,
  linkWithCredential,
  setPersistence,
  signInWithPopup,
  signOut,
  unlink,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
import { ADMIN_EMAIL } from "./constants.js";
const app = initializeApp(firebaseConfig, "admin-migration");
const auth = getAuth(app);
const $ = (selector) => document.querySelector(selector);
const email = $("#migrationEmail");
const password = $("#migrationPassword");
const confirm = $("#migrationPasswordConfirm");
const button = $("#migrationBtn");
const message = $("#migrationMessage");
const done = $("#migrationDone");

function show(text, type = "") {
  message.textContent = text;
  message.className = `inline-message ${type}`.trim();
}

function friendly(error) {
  const code = error?.code || "";
  const map = {
    "auth/popup-blocked": "The Google sign-in popup was blocked. Allow popups and try again.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/cancelled-popup-request": "Another sign-in popup is already open.",
    "auth/operation-not-allowed": "Temporarily enable Google Sign-In in Firebase Authentication, then retry.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/provider-already-linked": "Email/Password is already linked. You can disable Google now.",
    "auth/email-already-in-use": "That email/password credential is already linked to another Firebase account.",
    "auth/credential-already-in-use": "That credential is already used by another Firebase account. Do not delete anything; contact the project administrator.",
    "auth/requires-recent-login": "Please sign in with Google again and retry the migration.",
  };
  return map[code] || error?.message || "Migration failed. Please try again.";
}

async function migrate() {
  if (email.value.trim().toLowerCase() !== ADMIN_EMAIL) {
    show("The authorised admin email is fixed for this project.", "error");
    return;
  }
  if (password.value.length < 6) {
    show("Password must be at least 6 characters.", "error");
    password.focus();
    return;
  }
  if (password.value !== confirm.value) {
    show("Passwords do not match.", "error");
    confirm.focus();
    return;
  }

  button.disabled = true;
  show("Opening secure Google verification…", "loading");

  try {
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    if (String(user.email || "").toLowerCase() !== ADMIN_EMAIL) {
      await signOut(auth).catch(() => {});
      throw new Error("The Google account does not match the configured admin email.");
    }

    show("Google verified. Linking Email/Password to the same Firebase account…", "loading");
    const credential = EmailAuthProvider.credential(ADMIN_EMAIL, password.value);
    await linkWithCredential(user, credential);

    // The password credential is now attached to the same UID. Google is no
    // longer needed for production login, so remove it when Firebase allows it.
    try {
      await unlink(user, "google.com");
    } catch (unlinkError) {
      console.warn("Google provider could not be unlinked automatically:", unlinkError);
    }

    await signOut(auth).catch(() => {});
    done.hidden = false;
    show("Admin Email/Password access is ready. Disable Google Sign-In in Firebase now.", "success");
    button.textContent = "Migration Complete";
  } catch (error) {
    console.error(error);
    show(friendly(error), "error");
    button.disabled = false;
  }
}

button.addEventListener("click", migrate);
