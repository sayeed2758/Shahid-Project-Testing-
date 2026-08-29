import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const cfg = window.EV_FIREBASE_CONFIG || {};
const configured = Boolean(
  cfg.apiKey &&
  cfg.authDomain &&
  cfg.projectId &&
  cfg.appId &&
  cfg.databaseURL
);

function expose(value) {
  window.EVFirebase = value;
  window.dispatchEvent(new CustomEvent("ev-firebase-ready"));
}

if (!configured) {
  expose({ configured: false, ready: Promise.resolve(null) });
} else {
  const app = initializeApp(cfg);
  const auth = getAuth(app);
  const database = getDatabase(app);
  const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: "select_account" });

  async function loadCloud(uid) {
    const snap = await get(ref(database, `users/${uid}`));
    return snap.exists() ? snap.val() : null;
  }

  async function saveCloud(uid, data) {
    const clean = JSON.parse(JSON.stringify(data));
    delete clean.loggedIn;
    await set(ref(database, `users/${uid}`), clean);
  }

  const ready = new Promise(resolve => {
    onAuthStateChanged(auth, resolve);
  });

  expose({
    configured: true,
    auth,
    database,
    ready,
    onAuthStateChanged: cb => onAuthStateChanged(auth, cb),
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signInWithGoogle: async () => {
      try {
        return await signInWithPopup(auth, googleProvider);
      } catch (err) {
        if (err?.code === "auth/popup-blocked" || err?.code === "auth/popup-cancelled") {
          await signInWithRedirect(auth, googleProvider);
          return null;
        }
        throw err;
      }
    },
    getRedirectResult: () => getRedirectResult(auth),
    resetPassword: email => sendPasswordResetEmail(auth, email),
    signOut: () => signOut(auth),
    loadCloud,
    saveCloud
  });

  getRedirectResult(auth).catch(err => {
    if (err?.code) console.warn("Google redirect sign-in:", err);
  });
}
