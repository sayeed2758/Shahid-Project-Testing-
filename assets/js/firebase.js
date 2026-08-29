import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult, updateProfile
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getDatabase, ref, get, set, update
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import {
  getStorage, ref as storageRef, getBlob
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";

const cfg = window.EV_FIREBASE_CONFIG || {};
const configured = Boolean(cfg.apiKey && cfg.authDomain && cfg.databaseURL && cfg.projectId && cfg.appId);

if (!configured) {
  window.EVFirebase = { configured: false };
} else {
  const app = initializeApp(cfg);
  const auth = getAuth(app);
  const db = getDatabase(app);
  const storage = getStorage(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const api = {
    configured: true,
    currentUser: () => auth.currentUser,
    onAuthStateChanged: (cb) => onAuthStateChanged(auth, cb),
    async signIn(email, password) {
      return signInWithEmailAndPassword(auth, email, password);
    },
    async googleSignIn() {
      try {
        return await signInWithPopup(auth, provider);
      } catch (e) {
        const redirectCodes = new Set([
          "auth/popup-blocked",
          "auth/cancelled-popup-request",
          "auth/operation-not-supported-in-this-environment"
        ]);
        if (redirectCodes.has(e?.code)) {
          await signInWithRedirect(auth, provider);
          return null;
        }
        throw e;
      }
    },
    async finishRedirect() {
      return getRedirectResult(auth);
    },
    async resetPassword(email) {
      return sendPasswordResetEmail(auth, email);
    },
    async logout() {
      return signOut(auth);
    },
    async loadProfile(uid) {
      const snap = await get(ref(db, `users/${uid}/profile`));
      return snap.exists() ? snap.val() : null;
    },
    async saveProfile(uid, profile) {
      await update(ref(db, `users/${uid}/profile`), profile);
    },
    async loadCatalog() {
      const snap = await get(ref(db, "catalog"));
      return snap.exists() ? snap.val() : null;
    },
    async readProtectedPdf(path) {
      if (!path) throw new Error("This PDF is not published yet.");
      const blob = await getBlob(storageRef(storage, path));
      return blob;
    }
  };

  window.EVFirebase = api;
}
window.dispatchEvent(new CustomEvent("ev-firebase-ready"));
