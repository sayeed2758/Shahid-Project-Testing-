/* EZEE VISION Firebase bridge — classic/compat build for reliable GitHub Pages loading. */
(function () {
  const cfg = window.EV_FIREBASE_CONFIG || {};
  const required = ["apiKey", "authDomain", "projectId", "appId"];
  const configured = required.every(k => !!cfg[k]);

  if (!configured || !window.firebase) {
    window.EVFirebase = {
      configured: false,
      error: !window.firebase ? "Firebase SDK could not be loaded." : "Firebase configuration is missing."
    };
    window.dispatchEvent(new CustomEvent("ev-firebase-ready"));
    return;
  }

  try {
    const app = window.firebase.apps && window.firebase.apps.length
      ? window.firebase.app()
      : window.firebase.initializeApp(cfg);
    const auth = window.firebase.auth();
    const db = window.firebase.database();
    const storage = window.firebase.storage();
    const provider = new window.firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    window.EVFirebase = {
      configured: true,
      currentUser: () => auth.currentUser,
      onAuthStateChanged: cb => auth.onAuthStateChanged(cb),
      async signIn(email, password) {
        return auth.signInWithEmailAndPassword(email, password);
      },
      async googleSignIn() {
        try {
          return await auth.signInWithPopup(provider);
        } catch (e) {
          const redirectCodes = new Set([
            "auth/popup-blocked",
            "auth/cancelled-popup-request",
            "auth/operation-not-supported-in-this-environment",
            "auth/popup-closed-by-user"
          ]);
          if (redirectCodes.has(e && e.code)) {
            await auth.signInWithRedirect(provider);
            return null;
          }
          throw e;
        }
      },
      async finishRedirect() {
        return auth.getRedirectResult();
      },
      async resetPassword(email) {
        return auth.sendPasswordResetEmail(email);
      },
      async logout() {
        return auth.signOut();
      },
      async loadProfile(uid) {
        const snap = await db.ref(`users/${uid}/profile`).once("value");
        return snap.exists() ? snap.val() : null;
      },
      async saveProfile(uid, profile) {
        return db.ref(`users/${uid}/profile`).update(profile);
      },
      async loadCatalog() {
        const snap = await db.ref("catalog").once("value");
        return snap.exists() ? snap.val() : null;
      },
      async readProtectedPdf(path) {
        if (!path) throw new Error("This PDF is not published yet.");
        const url = await storage.ref(path).getDownloadURL();
        const response = await fetch(url, { credentials: "omit" });
        if (!response.ok) throw new Error(`PDF could not be opened (${response.status}).`);
        return response.blob();
      },
      updateProfile(user, data) {
        return user && user.updateProfile ? user.updateProfile(data) : Promise.resolve();
      }
    };
  } catch (e) {
    console.error("Firebase initialization failed:", e);
    window.EVFirebase = { configured: false, error: e && e.message ? e.message : "Firebase initialization failed." };
  }
  window.dispatchEvent(new CustomEvent("ev-firebase-ready"));
})();
