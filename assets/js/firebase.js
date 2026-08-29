(function(){
  const cfg=window.EV_FIREBASE_CONFIG||{};
  const fail=(message)=>{console.error(message);window.EVFirebase={configured:false,error:message,currentUser:()=>null,onAuthStateChanged:(cb)=>cb(null),loadProfile:async()=>null,loadCatalog:async()=>null};};
  if(!window.firebase) return fail("Firebase SDK failed to load.");
  try{
    const app=window.firebase.apps.length?window.firebase.app():window.firebase.initializeApp(cfg);
    const auth=window.firebase.auth(app);
    let db=null,storage=null;
    try{db=window.firebase.database(app)}catch(e){console.warn("Database unavailable",e)}
    try{storage=window.firebase.storage(app)}catch(e){console.warn("Storage unavailable",e)}
    const google=new window.firebase.auth.GoogleAuthProvider();
    google.setCustomParameters({prompt:"select_account"});
    window.EVFirebase={
      configured:true,
      currentUser:()=>auth.currentUser,
      onAuthStateChanged:fn=>auth.onAuthStateChanged(fn),
      signIn:(email,password)=>auth.signInWithEmailAndPassword(email,password),
      googleSignIn:async()=>{try{return await auth.signInWithPopup(google)}catch(e){if(["auth/popup-blocked","auth/operation-not-supported-in-this-environment"].includes(e?.code)){await auth.signInWithRedirect(google);return null}throw e}},
      resetPassword:email=>auth.sendPasswordResetEmail(email),
      logout:()=>auth.signOut(),
      updateProfile:(u,d)=>u?.updateProfile?u.updateProfile(d):Promise.resolve(),
      loadProfile:async uid=>{if(!db)return null;const s=await db.ref(`users/${uid}/profile`).once("value");return s.exists()?s.val():null},
      saveProfile:async(uid,p)=>{if(!db)throw Error("Realtime Database unavailable.");return db.ref(`users/${uid}/profile`).update(p)},
      loadCatalog:async()=>{if(!db)return null;const s=await db.ref("catalog").once("value");return s.exists()?s.val():null},
      readPdf:async path=>{
        if(!path) throw Error("Document is not published yet.");
        if(/^(assets\/|https?:)/.test(path)){const r=await fetch(path);if(!r.ok)throw Error(`Document could not be opened (${r.status}).`);return r.blob()}
        if(!storage)throw Error("Firebase Storage is unavailable.");
        const url=await storage.ref(path).getDownloadURL();
        const r=await fetch(url,{credentials:"omit"});if(!r.ok)throw Error(`Document could not be opened (${r.status}).`);return r.blob();
      }
    };
  }catch(e){fail("Firebase initialization failed: "+(e?.message||"Unknown error"))}
})();
