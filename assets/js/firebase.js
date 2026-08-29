import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail,
  signOut, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getDatabase, ref as dbRef, get, set, update, onValue
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import {
  getStorage, ref as storageRef, getBlob
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";

const cfg = window.EV_FIREBASE_CONFIG || {};
const configured = Boolean(cfg.apiKey && cfg.authDomain && cfg.databaseURL && cfg.projectId && cfg.appId);

if (!configured) {
  window.EVFirebase = { configured:false };
  window.dispatchEvent(new CustomEvent("ev-firebase-ready"));
} else {
  const app = initializeApp(cfg);
  const auth = getAuth(app);
  const database = getDatabase(app);
  const storage = getStorage(app);
  const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt:"select_account" });

  async function loadUserProfile(uid){
    const snap = await get(dbRef(database, `users/${uid}/profile`));
    return snap.exists() ? snap.val() : null;
  }
  async function saveUserProfile(uid, data){
    await update(dbRef(database, `users/${uid}/profile`), data);
  }
  async function loadCatalog(){
    const snap = await get(dbRef(database, "catalog"));
    return snap.exists() ? snap.val() : null;
  }
  async function readBlob(path){
    if (!path) throw new Error("This material is not published yet.");
    return getBlob(storageRef(storage, path));
  }

  window.EVFirebase = {
    configured:true, auth, database, storage,
    signIn:(email,password)=>signInWithEmailAndPassword(auth,email,password),
    signInWithGoogle:async()=>{
      try{return await signInWithPopup(auth,googleProvider)}
      catch(e){
        if(e?.code === "auth/popup-blocked" || e?.code === "auth/popup-cancelled"){
          await signInWithRedirect(auth,googleProvider); return null;
        }
        throw e;
      }
    },
    getRedirectResult:()=>getRedirectResult(auth),
    resetPassword:(email)=>sendPasswordResetEmail(auth,email),
    signOut:()=>signOut(auth),
    currentUser:()=>auth.currentUser,
    onAuthStateChanged:(cb)=>onAuthStateChanged(auth,cb),
    updateDisplayName:(name)=>auth.currentUser ? updateProfile(auth.currentUser,{displayName:name}) : Promise.resolve(),
    loadUserProfile, saveUserProfile, loadCatalog, readBlob
  };
  window.dispatchEvent(new CustomEvent("ev-firebase-ready"));
  getRedirectResult(auth).catch(()=>{});
}
