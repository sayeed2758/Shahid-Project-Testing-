(function(){
  "use strict";
  const cfg=window.EV_FIREBASE_CONFIG||{};
  const fail=(message)=>{
    console.error(message);
    window.EVFirebase={
      configured:false,error:message,currentUser:()=>null,
      onAuthStateChanged:cb=>cb(null),
      loadProfile:async()=>null,loadCatalog:async()=>null,
      readPdf:async()=>{throw Error(message)},logout:async()=>{},
      signIn:async()=>{throw Error(message)},googleSignIn:async()=>{throw Error(message)},
      resetPassword:async()=>{throw Error(message)}
    };
  };
  if(!window.firebase)return fail("Firebase SDK failed to load.");
  try{
    const app=window.firebase.apps.length?window.firebase.app():window.firebase.initializeApp(cfg);
    const auth=window.firebase.auth(app);
    let db=null,storage=null;
    try{db=window.firebase.database(app)}catch(e){console.warn("Database unavailable",e)}
    try{storage=window.firebase.storage(app)}catch(e){console.warn("Storage unavailable",e)}
    const google=new window.firebase.auth.GoogleAuthProvider();
    google.setCustomParameters({prompt:"select_account"});

    const requireDb=()=>{if(!db)throw Error("Firebase Realtime Database is unavailable.");return db};
    const requireStorage=()=>{if(!storage)throw Error("Firebase Cloud Storage is unavailable.");return storage};

    window.EVFirebase={
      configured:true,
      currentUser:()=>auth.currentUser,
      onAuthStateChanged:fn=>auth.onAuthStateChanged(fn),
      signIn:(email,password)=>auth.signInWithEmailAndPassword(email,password),
      googleSignIn:async()=>{
        try{return await auth.signInWithPopup(google)}
        catch(e){
          if(["auth/popup-blocked","auth/operation-not-supported-in-this-environment"].includes(e?.code)){
            await auth.signInWithRedirect(google);return null;
          }
          throw e;
        }
      },
      resetPassword:email=>auth.sendPasswordResetEmail(email),
      logout:()=>auth.signOut(),
      updateProfile:(u,d)=>u?.updateProfile?u.updateProfile(d):Promise.resolve(),
      loadProfile:async uid=>{const d=requireDb();const s=await d.ref(`users/${uid}/profile`).once("value");return s.exists()?s.val():null},
      saveProfile:async(uid,p)=>requireDb().ref(`users/${uid}/profile`).update(p),
      loadCatalog:async()=>{const d=requireDb();const s=await d.ref("catalog").once("value");return s.exists()?s.val():null},
      readPdf:async path=>{
        if(!path)throw Error("Document is not published yet.");
        if(/^(assets\/|https?:)/.test(path)){
          const r=await fetch(path,{cache:"no-store"});
          if(!r.ok)throw Error(`Document could not be opened (${r.status}).`);
          return r.blob();
        }
        const st=requireStorage();
        const url=await st.ref(path).getDownloadURL();
        const r=await fetch(url,{credentials:"omit",cache:"no-store"});
        if(!r.ok)throw Error(`Document could not be opened (${r.status}).`);
        return r.blob();
      },

      // Admin operations. Firebase Security Rules enforce the real authorization.
      adminCatalog:async()=>{const d=requireDb();const s=await d.ref("catalog").once("value");return s.exists()?s.val():{}},
      adminUploadPdf:(path,file,onProgress)=>new Promise((resolve,reject)=>{
        try{
          const task=requireStorage().ref(path).put(file,{contentType:"application/pdf",cacheControl:"private,max-age=0"});
          task.on("state_changed",
            snap=>onProgress?.(snap.totalBytes?Math.round((snap.bytesTransferred/snap.totalBytes)*100):0,snap),
            reject,
            async()=>{try{resolve(await task.snapshot.ref.getDownloadURL())}catch(e){reject(e)}}
          );
        }catch(e){reject(e)}
      }),
      adminDeleteFile:async path=>requireStorage().ref(path).delete(),
      adminSaveItem:async(c,s,sec,id,item)=>requireDb().ref(`catalog/${c}/${s}/${sec}/${id}`).set(item),
      adminDeleteItem:async(c,s,sec,id)=>requireDb().ref(`catalog/${c}/${s}/${sec}/${id}`).remove(),
      adminRemoveSectionIfEmpty:async()=>Promise.resolve()
    };
  }catch(e){fail("Firebase initialization failed: "+(e?.message||"Unknown error"))}
})();
