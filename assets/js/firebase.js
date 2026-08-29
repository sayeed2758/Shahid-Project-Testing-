/* EZEE VISION Firebase bridge — Auth-first, GitHub Pages safe. */
(function () {
  const cfg = window.EV_FIREBASE_CONFIG || {};
  const required = ["apiKey", "authDomain", "projectId", "appId"];
  const configured = required.every(k => !!cfg[k]);

  function fail(message, error) {
    console.error("[EVFirebase]", message, error || "");
    window.EVFirebase = {
      configured: false,
      error: message,
      currentUser: () => null
    };
    window.dispatchEvent(new CustomEvent("ev-firebase-ready"));
  }

  if (!configured) return fail("Firebase configuration is missing.");
  if (!window.firebase) return fail("Firebase SDK failed to load. Check your internet connection and Firebase CDN access.");

  try {
    const app = window.firebase.apps && window.firebase.apps.length
      ? window.firebase.app()
      : window.firebase.initializeApp(cfg);

    // Auth is the critical dependency. Do not let optional Database/Storage setup kill login.
    const auth = window.firebase.auth(app);
    let db = null;
    let storage = null;
    try { db = window.firebase.database(app); } catch (e) { console.warn("Realtime Database unavailable:", e); }
    try { storage = window.firebase.storage(app); } catch (e) { console.warn("Storage unavailable:", e); }

    const provider = new window.firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    window.EVFirebase = {
      configured: true,
      currentUser: () => auth.currentUser,
      onAuthStateChanged: cb => auth.onAuthStateChanged(cb),
      async signIn(email, password) {
        if (!email || !password) throw Object.assign(new Error("Email and password are required."), {code:"auth/missing-credentials"});
        return auth.signInWithEmailAndPassword(email, password);
      },
      async googleSignIn() {
        try {
          return await auth.signInWithPopup(provider);
        } catch (e) {
          const redirectCodes = new Set([
            "auth/popup-blocked",
            "auth/cancelled-popup-request",
            "auth/operation-not-supported-in-this-environment"
          ]);
          if (redirectCodes.has(e && e.code)) {
            await auth.signInWithRedirect(provider);
            return null;
          }
          throw e;
        }
      },
      async finishRedirect() { return auth.getRedirectResult(); },
      async resetPassword(email) {
        if (!email) throw Object.assign(new Error("Enter your email first."), {code:"auth/invalid-email"});
        return auth.sendPasswordResetEmail(email);
      },
      async logout() { return auth.signOut(); },
      async loadProfile(uid) {
        if (!db) return null;
        const snap = await db.ref(`users/${uid}/profile`).once("value");
        return snap.exists() ? snap.val() : null;
      },
      async saveProfile(uid, profile) {
        if (!db) throw new Error("Realtime Database is not available.");
        return db.ref(`users/${uid}/profile`).update(profile);
      },
      async loadCatalog() {
        if (!db) return null;
        const snap = await db.ref("catalog").once("value");
        return snap.exists() ? snap.val() : null;
      },
      async readProtectedPdf(path) {
        if (!storage) throw new Error("Firebase Storage is not available.");
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
    console.info("[EVFirebase] initialized", {projectId: cfg.projectId, authReady: true});
    window.dispatchEvent(new CustomEvent("ev-firebase-ready"));
  } catch (e) {
    fail("Firebase Authentication could not be initialized: " + (e && e.message ? e.message : "Unknown error"), e);
  }
})();
