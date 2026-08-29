import { CLASSES, SUBJECTS, SECTIONS, DEMO_CATALOG, normalizeCatalog, allItems } from "./catalog.js";

const firebase = await new Promise(resolve => {
  if (window.EVFirebase) return resolve(window.EVFirebase);
  const done = () => resolve(window.EVFirebase || { configured:false, error:"Firebase failed to initialize." });
  window.addEventListener("ev-firebase-ready", done, { once:true });
  setTimeout(done, 8000);
});

const state = {
  route: "home", classId:null, subjectId:null, sectionId:null, itemId:null,
  catalog: normalizeCatalog(DEMO_CATALOG), profile:{}, recent:[], search:"", busy:false
};

const $ = (id) => document.getElementById(id);
const el = {
  loginView:$("loginView"), appView:$("appView"), loginForm:$("loginForm"),
  email:$("loginEmail"), password:$("loginPassword"), loginBtn:$("loginBtn"),
  google:$("googleBtn"), forgot:$("forgotBtn"), hint:$("authHint"),
  content:$("content"), title:$("pageTitle"), date:$("pageDate"),
  toast:$("toast"), profile:$("profileBtn")
};

const RECENT_KEY = "ezee_student_recent_v2";

const esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const classLabel = c => `Class ${c}`;
const subj = id => SUBJECTS.find(x=>x.id===id);
const sec = id => SECTIONS.find(x=>x.id===id);
const items = () => state.catalog?.[state.classId]?.[state.subjectId]?.[state.sectionId] || [];
const itemKey = x => `${x.classId}|${x.subjectId}|${x.sectionId}|${x.id}`;

function toast(msg){
  el.toast.textContent = msg;
  el.toast.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(()=>el.toast.classList.remove("show"),2600);
}
function authMessage(e){
  const m = {
    "auth/invalid-credential":"Email or password is incorrect.",
    "auth/invalid-email":"Please enter a valid email.",
    "auth/user-not-found":"Account not found.",
    "auth/wrong-password":"Password is incorrect.",
    "auth/too-many-requests":"Too many attempts. Try again later.",
    "auth/popup-closed-by-user":"Google sign-in was cancelled.",
    "auth/popup-blocked":"Popup was blocked. Please allow popups and try again."
  };
  return m[e?.code] || e?.message || "Something went wrong.";
}
function dateText(){return new Intl.DateTimeFormat("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function currentUid(){return firebase?.currentUser?.()?.uid || "local";}

function loadRecent(){
  try { state.recent = JSON.parse(localStorage.getItem(RECENT_KEY+"_"+currentUid()) || "[]"); }
  catch { state.recent=[]; }
}
function saveRecent(){localStorage.setItem(RECENT_KEY+"_"+currentUid(),JSON.stringify(state.recent.slice(0,20)))}

function navigate(route, params={}){
  Object.assign(state, params, {route});
  render();
  window.scrollTo({top:0,behavior:"smooth"});
}

function setBusy(button, busy, text){
  if(!button) return;
  button.disabled=busy;
  button.dataset.original=text || button.textContent;
  button.textContent=busy ? "PLEASE WAIT…" : button.dataset.original;
}

function render(){
  el.date.textContent = dateText();
  const titles={home:"Home",classes:"Classes",subject:"Subjects",section:"Materials",viewer:"Reader",search:"Search",recent:"Recent",profile:"Profile"};
  el.title.textContent=titles[state.route]||"Home";
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.route===state.route));
  const views={home:viewHome,classes:viewClasses,subject:viewSubject,section:viewSection,viewer:viewViewer,search:viewSearch,recent:viewRecent,profile:viewProfile};
  el.content.innerHTML=(views[state.route]||viewHome)();
}

function classCards(){
  return CLASSES.map(c=>`<button type="button" class="class-card" data-class="${c}">
    <span class="class-badge">${c}</span><strong>${classLabel(c)}</strong><small>4 Subjects</small>
  </button>`).join("");
}

function viewHome(){
  const total=allItems(state.catalog).length;
  const protectedCount=allItems(state.catalog).filter(x=>x.sectionId!=="worksheet").length;
  const worksheetCount=total-protectedCount;
  return `<section class="hero-card">
    <div><p class="hero-kicker">WELCOME BACK</p><h3>${esc(state.profile.name || firebase.currentUser()?.displayName || "Student")} 👋</h3>
    <p>Classes 6–10 • ${total} material entries</p></div>
    <button type="button" class="hero-link" data-go="classes">Browse Classes →</button>
  </section>
  <div class="home-grid">
    <div class="stat-card"><span>🎓</span><small>Classes</small><strong>5</strong></div>
    <div class="stat-card"><span>📚</span><small>Subjects</small><strong>4</strong></div>
    <div class="stat-card"><span>🔒</span><small>Protected Notes</small><strong>${protectedCount}</strong></div>
    <div class="stat-card"><span>📄</span><small>Worksheets</small><strong>${worksheetCount}</strong></div>
  </div>
  <div class="section-heading"><h3>Choose your class</h3><button type="button" class="text-btn" data-go="classes">View all</button></div>
  <div class="class-grid">${classCards()}</div>
  <div class="section-heading"><h3>Continue reading</h3><button type="button" class="text-btn" data-go="recent">View recent</button></div>
  ${state.recent.length ? renderRecentCards(3) : `<div class="empty-card"><div>📖</div><strong>No recent material</strong><p>Open a note or worksheet and it will appear here.</p></div>`}`;
}

function viewClasses(){return `<div class="page-intro"><h3>Select a class</h3><p>Choose Class 6 to Class 10 to explore subjects.</p></div><div class="class-grid large">${classCards()}</div>`}

function viewSubject(){
  const c=state.classId;
  return `<button type="button" class="back-btn" data-go="classes">← Back to Classes</button>
  <div class="title-block"><p>${classLabel(c)}</p><h3>Choose a subject</h3></div>
  <div class="subject-grid">${SUBJECTS.map(s=>`<button type="button" class="subject-card" data-subject="${s.id}">
    <span class="subject-icon">${s.icon}</span><strong>${esc(s.name)}</strong><small>3 sections</small></button>`).join("")}</div>`;
}

function viewSection(){
  const s=subj(state.subjectId);
  return `<button type="button" class="back-btn" data-go="subject">← Back to Subjects</button>
  <div class="title-block"><p>${classLabel(state.classId)} • ${esc(s?.name||"")}</p><h3>Choose material type</h3></div>
  <div class="section-grid">${SECTIONS.map(x=>`<button type="button" class="section-card" data-section="${x.id}">
    <span class="section-icon">${x.icon}</span><strong>${x.name}</strong><small>${x.protected?"Read-only • Protected":"Download available"}</small></button>`).join("")}</div>`;
}

function materialCards(){
  const section=sec(state.sectionId);
  return items().sort((a,b)=>(a.order||0)-(b.order||0)).map(item=>`<button type="button" class="material-card" data-item="${esc(item.id)}">
    <span class="material-icon">${section.icon}</span>
    <span class="material-body"><strong>${esc(item.title)}</strong><small>${section.protected?"Open in protected reader":"Open and download worksheet"}</small></span>
    <span class="material-arrow">›</span>
  </button>`).join("");
}

function viewSection(){
  const s=subj(state.subjectId), x=sec(state.sectionId);
  return `<button type="button" class="back-btn" data-go="subject">← Back to Subjects</button>
  <div class="title-block"><p>${classLabel(state.classId)} • ${esc(s?.name||"")}</p><h3>${x?.name||"Materials"}</h3>
  <span class="section-note">${x?.protected?"🔒 Read-only content • Download and Print disabled":"📥 Worksheets can be downloaded"}</span></div>
  <div class="materials-list">${materialCards() || `<div class="empty-card"><div>${x?.icon||"📚"}</div><strong>No material yet</strong><p>Materials will appear here after publication.</p></div>`}</div>`;
}

function renderRecentCards(limit=20){
  const rs=state.recent.slice(0,limit).map(r=>{
    const item=state.catalog?.[r.classId]?.[r.subjectId]?.[r.sectionId]?.find(x=>x.id===r.itemId);
    if(!item) return "";
    return `<button type="button" class="recent-card" data-recent="${esc(r.itemId)}" data-class="${esc(r.classId)}" data-subject="${esc(r.subjectId)}" data-section="${esc(r.sectionId)}">
      <span>${sec(r.sectionId)?.icon||"📖"}</span><span><strong>${esc(item.title)}</strong><small>${classLabel(r.classId)} • ${esc(subj(r.subjectId)?.name||"")}</small></span></button>`;
  }).join("");
  return rs || `<div class="empty-card"><strong>No recent material</strong></div>`;
}

function viewRecent(){return `<div class="page-intro"><h3>Recently opened</h3><p>Your recent notes and worksheets are saved on this device.</p></div>${state.recent.length?`<div class="recent-list">${renderRecentCards(20)}</div>`:`<div class="empty-card"><div>◷</div><strong>No recent material</strong><p>Open something from Classes to build your recent list.</p></div>`}`}

function viewSearch(){
  const q=state.search.trim().toLowerCase();
  const rows=q?allItems(state.catalog).filter(x=>`${x.title} ${x.classId} ${subj(x.subjectId)?.name||""} ${sec(x.sectionId)?.name||""}`.toLowerCase().includes(q)).slice(0,50):[];
  return `<div class="page-intro"><h3>Search material</h3><p>Search chapters, worksheets, subjects or class numbers.</p></div>
  <input id="searchInput" class="search-input" type="search" value="${esc(state.search)}" placeholder="🔎 Search e.g. Class 10, Light, Algebra…">
  <div class="search-results">${q?(rows.length?rows.map(x=>`<button type="button" class="result-card" data-search-item="${esc(x.id)}" data-class="${x.classId}" data-subject="${x.subjectId}" data-section="${x.sectionId}"><span>${sec(x.sectionId).icon}</span><span><strong>${esc(x.title)}</strong><small>${classLabel(x.classId)} • ${esc(subj(x.subjectId).name)} • ${esc(sec(x.sectionId).name)}</small></span>›</button>`).join(""):`<div class="empty-card"><strong>No results found</strong><p>Try another keyword.</p></div>`):`<div class="empty-card"><div>🔎</div><strong>Start searching</strong><p>Search across all Class 6–10 material.</p></div>`}</div>`;
}

function viewerItem(){
  return items().find(x=>x.id===state.itemId);
}

function viewViewer(){
  const item=viewerItem(), section=sec(state.sectionId);
  if(!item) return `<div class="empty-card"><strong>Material not found</strong><button class="primary-btn" data-go="section">Go back</button></div>`;
  return `<button type="button" class="back-btn" data-go="section">← Back to ${section?.name||"Materials"}</button>
  <section class="reader-card">
    <div class="reader-head"><div><p>${classLabel(item.classId||state.classId)} • ${esc(subj(state.subjectId)?.name||"")}</p><h3>${esc(item.title)}</h3></div>
      <span class="access-pill ${section?.protected?"protected":"download"}">${section?.protected?"PROTECTED":"WORKSHEET"}</span>
    </div>
    ${section?.protected ? `<div class="reader-shell protected-reader" id="readerShell">
      <div id="pdfStatus" class="reader-status"><div class="spinner"></div><strong>Loading protected note…</strong><p>The document stays inside this reader. Download and Print are disabled.</p></div>
      <canvas id="pdfCanvas" class="pdf-canvas" aria-label="Protected PDF page"></canvas>
      <div id="pdfToolbar" class="pdf-toolbar hidden">
        <button type="button" id="prevPage" class="mini-btn">‹</button>
        <span id="pageInfo">Page 1 / 1</span>
        <button type="button" id="nextPage" class="mini-btn">›</button>
        <button type="button" id="zoomOut" class="mini-btn">−</button>
        <button type="button" id="zoomIn" class="mini-btn">+</button>
        <button type="button" id="fullscreenBtn" class="mini-btn">⛶</button>
      </div>
    </div>` : `<div class="worksheet-box"><div class="big-icon">📄</div><h3>Worksheet</h3><p>Open the worksheet here, then download it to your device.</p><div class="reader-actions"><button id="previewWorksheet" class="secondary-btn" type="button">Preview</button><button id="downloadWorksheet" class="primary-btn" type="button">DOWNLOAD</button></div></div>`}
  </section>`;
}

function viewProfile(){
  const u=firebase.currentUser?.();
  return `<div class="profile-card panel"><div class="profile-avatar">${esc((state.profile.name||u?.displayName||"S")[0]).toUpperCase()}</div>
    <h3>${esc(state.profile.name||u?.displayName||"Student")}</h3><p>${esc(state.profile.email||u?.email||"")}</p>
    <button type="button" class="primary-btn" id="saveProfile">SAVE PROFILE</button>
    <label class="profile-label" for="profileName">Display name</label><input id="profileName" class="search-input" value="${esc(state.profile.name||u?.displayName||"")}">
    <button type="button" class="danger-btn" id="logoutBtn">LOG OUT</button>
  </div>`;
}

function touchRecent(item){
  const row={classId:state.classId,subjectId:state.subjectId,sectionId:state.sectionId,itemId:item.id,title:item.title};
  state.recent=[row,...state.recent.filter(r=>itemKey({...r})!==itemKey(row))].slice(0,20);
  saveRecent();
}

async function loadPdf(){
  const item=viewerItem(), status=$("pdfStatus"), canvas=$("pdfCanvas");
  if(!item||!status||!canvas) return;
  touchRecent(item);
  if(!item.filePath){
    status.innerHTML=`<div class="empty-reader"><div>📖</div><strong>Protected note not published yet</strong><p>Upload the PDF to Firebase Storage and add its Storage path in the catalog.</p></div>`;
    return;
  }
  try{
    const blob=await firebase.readProtectedPdf(item.filePath);
    const pdfjs=await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
    const pdf=await pdfjs.getDocument({data:await blob.arrayBuffer()}).promise;
    window.EVReader={pdf,page:1,scale:1.1};
    status.classList.add("hidden");
    $("pdfToolbar").classList.remove("hidden");
    await paintPage();
  }catch(e){
    status.innerHTML=`<div class="empty-reader"><div>⚠️</div><strong>Could not open this note</strong><p>${esc(e?.message||"Access denied or file unavailable.")}</p></div>`;
  }
}

async function paintPage(){
  const r=window.EVReader, canvas=$("pdfCanvas");
  if(!r?.pdf||!canvas) return;
  const page=await r.pdf.getPage(r.page);
  const vp=page.getViewport({scale:r.scale});
  canvas.width=vp.width;canvas.height=vp.height;
  await page.render({canvasContext:canvas.getContext("2d"),viewport:vp}).promise;
  $("pageInfo").textContent=`Page ${r.page} / ${r.pdf.numPages}`;
}

async function downloadWorksheet(){
  const item=viewerItem();
  if(!item?.filePath){toast("Worksheet PDF is not published yet.");return}
  try{
    const blob=await firebase.readProtectedPdf(item.filePath);
    const url=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url;a.download=(item.title||"worksheet").replace(/[^a-z0-9 _-]/gi,"")+".pdf";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);toast("Worksheet downloaded");
  }catch(e){toast("Worksheet download failed: "+(e?.message||"Access denied"))}
}

async function previewWorksheet(){
  const item=viewerItem();
  if(!item?.filePath){toast("Worksheet PDF is not published yet.");return}
  try{
    const blob=await firebase.readProtectedPdf(item.filePath);
    const url=URL.createObjectURL(blob);
    const w=window.open("about:blank","_blank","noopener,noreferrer");
    if(!w){toast("Allow pop-ups to preview worksheet.");URL.revokeObjectURL(url);return}
    w.document.write(`<html><head><title>${esc(item.title)}</title></head><body style="margin:0;background:#111"><iframe title="Worksheet Preview" src="${url}" style="width:100%;height:100vh;border:0"></iframe></body></html>`);
    w.document.close();
    setTimeout(()=>URL.revokeObjectURL(url),120000);
  }catch(e){toast("Preview failed")}
}

function bindDynamic(){
  el.content.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>navigate(b.dataset.go));
  el.content.querySelectorAll("[data-class]").forEach(b=>b.onclick=()=>navigate("subject",{classId:b.dataset.class}));
  el.content.querySelectorAll("[data-subject]").forEach(b=>b.onclick=()=>navigate("section",{subjectId:b.dataset.subject}));
  el.content.querySelectorAll("[data-section]").forEach(b=>b.onclick=()=>navigate("sectionList",{sectionId:b.dataset.section}));
  el.content.querySelectorAll("[data-item]").forEach(b=>b.onclick=()=>navigate("viewer",{itemId:b.dataset.item}));
  el.content.querySelectorAll("[data-recent]").forEach(b=>b.onclick=()=>navigate("viewer",{classId:b.dataset.class,subjectId:b.dataset.subject,sectionId:b.dataset.section,itemId:b.dataset.recent}));
  el.content.querySelectorAll("[data-search-item]").forEach(b=>b.onclick=()=>navigate("viewer",{classId:b.dataset.class,subjectId:b.dataset.subject,sectionId:b.dataset.section,itemId:b.dataset.searchItem}));

  const search=$("searchInput");
  if(search){
    search.oninput=()=>{state.search=search.value;render();const i=$("searchInput");i?.focus();i?.setSelectionRange(state.search.length,state.search.length)}
  }

  $("pdfToolbar")?.querySelector("#prevPage")?.addEventListener("click",()=>{if(window.EVReader?.page>1){window.EVReader.page--;paintPage()}});
  $("pdfToolbar")?.querySelector("#nextPage")?.addEventListener("click",()=>{if(window.EVReader?.page<window.EVReader?.pdf?.numPages){window.EVReader.page++;paintPage()}});
  $("pdfToolbar")?.querySelector("#zoomOut")?.addEventListener("click",()=>{window.EVReader.scale=Math.max(.7,window.EVReader.scale-.1);paintPage()});
  $("pdfToolbar")?.querySelector("#zoomIn")?.addEventListener("click",()=>{window.EVReader.scale=Math.min(2.2,window.EVReader.scale+.1);paintPage()});
  $("pdfToolbar")?.querySelector("#fullscreenBtn")?.addEventListener("click",()=>{$("readerShell")?.requestFullscreen?.()});
  $("downloadWorksheet")?.addEventListener("click",downloadWorksheet);
  $("previewWorksheet")?.addEventListener("click",previewWorksheet);

  $("saveProfile")?.addEventListener("click",async()=>{
    const name=$("profileName").value.trim();
    if(!name){toast("Enter your name.");return}
    try{
      const uid=currentUid();
      state.profile={...state.profile,name,email:firebase.currentUser()?.email||""};
      await firebase.saveProfile(uid,state.profile);
      if(firebase.currentUser()?.uid && firebase.updateProfile) await firebase.updateProfile(firebase.currentUser(),{displayName:name});
      toast("Profile saved");render();
    }catch(e){toast(e?.message||"Could not save profile")}
  });
  $("logoutBtn")?.addEventListener("click",async()=>{
    try{await firebase.logout()}catch(e){toast("Could not log out")}
  });

  if(state.route==="viewer" && sec(state.sectionId)?.protected) loadPdf();
  else if(state.route==="viewer") touchRecent(viewerItem()||{});
}

function renderPatched(){
  const original=state.route;
  if(original==="sectionList") state.route="section";
  render();
  state.route=original;
  bindDynamic();
}

function render(){
  el.date.textContent = dateText();
  const titles={home:"Home",classes:"Classes",subject:"Subjects",section:"Materials",sectionList:"Materials",viewer:"Reader",search:"Search",recent:"Recent",profile:"Profile"};
  el.title.textContent=titles[state.route]||"Home";
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.route===state.route));
  const views={home:viewHome,classes:viewClasses,subject:viewSubject,section:viewSection,sectionList:viewSection,viewer:viewViewer,search:viewSearch,recent:viewRecent,profile:viewProfile};
  el.content.innerHTML=(views[state.route]||viewHome)();
  bindDynamic();
}

async function start(){
  loadRecent();
  if(!firebase?.configured){
    el.hint.textContent = firebase?.error || "Firebase could not be initialized. Please refresh the page.";
    el.loginBtn.disabled = false;
    return;
  }
  firebase.onAuthStateChanged(async user=>{
    if(!user){
      el.appView.classList.add("hidden");el.loginView.classList.remove("hidden");
      setBusy(el.loginBtn,false,"LOGIN");
      setBusy(el.google,false,"Continue with Google");
      return;
    }
    el.loginView.classList.add("hidden");el.appView.classList.remove("hidden");
    setBusy(el.loginBtn,false,"LOGIN");
    setBusy(el.google,false,"Continue with Google");
    try{state.profile=await firebase.loadProfile(user.uid)||{name:user.displayName||"Student",email:user.email||""}}catch{state.profile={name:user.displayName||"Student",email:user.email||""}}
    try{state.catalog=normalizeCatalog(await firebase.loadCatalog())}catch{state.catalog=normalizeCatalog(DEMO_CATALOG)}
    loadRecent();render();
  });
  try{await firebase.finishRedirect()}catch(e){toast(authMessage(e))}
}

el.loginForm.addEventListener("submit",async e=>{
  e.preventDefault();
  const email=el.email.value.trim(), pass=el.password.value;
  if(!email||!pass){toast("Enter email and password.");return}
  setBusy(el.loginBtn,true,"LOGIN");
  try{await firebase.signIn(email,pass)}catch(err){toast(authMessage(err));setBusy(el.loginBtn,false,"LOGIN")}
});
el.google.addEventListener("click",async()=>{
  setBusy(el.google,true,"Continue with Google");
  try{await firebase.googleSignIn()}catch(err){toast(authMessage(err));setBusy(el.google,false,"Continue with Google")}
});
el.forgot.addEventListener("click",async()=>{
  const email=el.email.value.trim();
  if(!email){toast("Enter your email first.");el.email.focus();return}
  try{await firebase.resetPassword(email);toast("Password reset email sent.")}catch(err){toast(authMessage(err))}
});
el.profile.addEventListener("click",()=>navigate("profile"));
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.route)));

document.addEventListener("contextmenu",e=>{if(e.target.closest(".protected-reader"))e.preventDefault()});
document.addEventListener("keydown",e=>{
  if(document.querySelector(".protected-reader") && (e.ctrlKey||e.metaKey) && ["p","s","u"].includes(e.key.toLowerCase())){
    e.preventDefault();toast("This action is disabled in the protected reader.");
  }
});

start();
