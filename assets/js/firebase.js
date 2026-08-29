import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getDatabase, ref, get, set
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const cfg = window.EV_FIREBASE_CONFIG || {};
const configured = Boolean(
  cfg.apiKey && !String(cfg.apiKey).startsWith("YOUR_") &&
  cfg.authDomain && cfg.projectId && cfg.appId
);

if (!configured) {
  window.EVFirebase = { configured:false, ready:Promise.resolve(null) };
} else {
  const app = initializeApp(cfg);
  const auth = getAuth(app);
  const database = getDatabase(app);

  async function loadCloud(uid) {
    const snap = await get(ref(database, `users/${uid}`));
    return snap.exists() ? snap.val() : null;
  }

  async function saveCloud(uid, data) {
    const clean = JSON.parse(JSON.stringify(data));
    await set(ref(database, `users/${uid}`), clean);
  }

  window.EVFirebase = {
    configured: true,
    auth,
    database,
    ready: new Promise(resolve => onAuthStateChanged(auth, resolve)),
    onAuthStateChanged: cb => onAuthStateChanged(auth, cb),
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    resetPassword: email => sendPasswordResetEmail(auth, email),
    signOut: () => signOut(auth),
    loadCloud,
    saveCloud
  };
}
