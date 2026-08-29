import { CLASS_IDS, SUBJECTS, SECTIONS, DEMO_CATALOG, normalizeCatalog, flattenCatalog } from "./catalog.js";

const firebase = await new Promise(resolve=>{
  if(window.EVFirebase) return resolve(window.EVFirebase);
  window.addEventListener("ev-firebase-ready",()=>resolve(window.EVFirebase),{once:true});
});

const state={route:"home",classId:null,subjectId:null,sectionId:null,itemId:null,catalog:normalizeCatalog(null),profile:{},recent:[],search:""};
const els={loginView:document.getElementById("loginView"),appView:document.getElementById("appView"),content:document.getElementById("content"),pageTitle:document.getElementById("pageTitle"),pageDate:document.getElementById("pageDate"),toast:document.getElementById("toast")};
const STORE="ezee_student_recent_v1";

function esc(x){return String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function showToast(msg){els.toast.textContent=msg;els.toast.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>els.toast.classList.remove("show"),2400)}
function nowText(){return new Intl.DateTimeFormat("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
function className(c){return `Class ${c}`}
function subject(id){return SUBJECTS.find(s=>s.id===id)}
function section(id){return SECTIONS.find(s=>s.id===id)}
function saveRecent(){localStorage.setItem(STORE+"_"+(firebase.currentUser()?.uid||"local"),JSON.stringify(state.recent.slice(0,15)))}
function loadRecent(){try{return JSON.parse(localStorage.getItem(STORE+"_"+(firebase.currentUser()?.uid||"local"))||"[]")}catch{return []}}
function navigate(route, params={}){Object.assign(state,params,{route});render()}
function authError(e){const map={"auth/invalid-credential":"Email or password is incorrect.","auth/user-not-found":"Account not found.","auth/wrong-password":"Password is incorrect.","auth/invalid-email":"Please enter a valid email.","auth/too-many-requests":"Too many attempts. Try again later.","auth/popup-closed-by-user":"Google sign-in was cancelled."};return map[e?.code]||e?.message||"Something went wrong."}

function cardButton(cls,text,attrs=""){return `<button type="button" class="${cls}" ${attrs}>${text}</button>`}

function render(){
  els.pageDate.textContent=nowText();
  const titles={home:"Home",classes:"Classes",subject:"Subjects",section:"Materials",viewer:"Reader",search:"Search",recent:"Recent",profile:"Profile"};
  els.pageTitle.textContent=titles[state.route]||"Home";
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.route===state.route));
  const views={home:viewHome,classes:viewClasses,subject:viewSubject,section:viewSection,viewer:viewViewer,search:viewSearch,recent:viewRecent,profile:viewProfile};
  els.content.innerHTML=(views[state.route]||viewHome)();
  bind();
}

function viewHome(){
  const total=flattenCatalog(state.catalog).length;
  const protectedCount=flattenCatalog(state.catalog).filter(x=>x.sectionId!=="worksheet").length;
  return `<section class="hero-card"><div><p class="hero-kicker">WELCOME BACK</p><h3>${esc(state.profile.name||firebase.currentUser()?.displayName||"Student")} 👋</h3><p>Learn from Class 6 to Class 10 • ${total} material entries</p></div><button class="hero-link" data-go="classes">Browse Classes →</button></section>
  <div class="home-grid"><div class="stat-card"><span>🎓</span><small>Classes</small><strong>5</strong></div><div class="stat-card"><span>📚</span><small>Subjects</small><strong>4</strong></div><div class="stat-card"><span>🔒</span><small>Protected Notes</small><strong>${protectedCount}</strong></div><div class="stat-card"><span>📄</span><small>Worksheets</small><strong>${total-protectedCount}</strong></div></div>
  <div class="section-heading"><h3>Choose your class</h3><button type="button" class="text-btn" data-go="classes">View all</button></div>
  <div class="class-grid">${CLASS_IDS.map(c=>cardButton("class-card",`<span class="class-badge">${c}</span><strong>Class ${c}</strong><small>4 Subjects</small>`,`data-class="${c}"`)).join("")}</div>
  <div class="section-heading"><h3>Continue reading</h3></div>
  ${state.recent.length?renderRecentCards(3):`<div class="empty-card"><div>📖</div><strong>No recent material</strong><p>Open a note or worksheet to see it here.</p></div>`}`;
}
function viewClasses(){return `<div class="page-intro"><p>Choose a class to explore its study material.</p></div><div class="class-grid large">${CLASS_IDS.map(c=>cardButton("class-card",`<span class="class-badge">${c}</span><strong>Class ${c}</strong><small>SST • Science • Math • English</small>`,`data-class="${c}"`)).join("")}</div>`}
function viewSubject(){const c=state.classId;return `<button class="back-btn" type="button" data-go="classes">← Back to Classes</button><div class="title-block"><p>${className(c)}</p><h3>Choose a subject</h3></div><div class="subject-grid">${SUBJECTS.map(s=>cardButton("subject-card",`<span class="subject-icon">${s.icon}</span><strong>${esc(s.name)}</strong><small>3 sections</small>`,`data-subject="${s.id}"`)).join("")}</div>`}
function viewSection(){const c=state.classId,s=subject(state.subjectId);return `<button class="back-btn" type="button" data-go="subject">← Back to Subjects</button><div class="title-block"><p>${className(c)} • ${esc(s?.name||"")}</p><h3>Choose material type</h3></div><div class="section-grid">${SECTIONS.map(sec=>cardButton("section-card",`<span class="section-icon">${sec.icon}</span><strong>${sec.name}</strong><small>${sec.protected?"Read-only • Protected":"Download available"}</small>`,`data-section="${sec.id}"`)).join("")}</div>`}
function itemsFor(){return flattenCatalog(state.catalog).filter(x=>x.classId===state.classId&&x.subjectId===state.subjectId&&x.sectionId===state.sectionId).sort((a,b)=>(a.order||0)-(b.order||0))}
function viewSectionList(){return ""}
function viewMaterialsList(){return ""}
function viewViewer(){const item=itemsFor().find(x=>x.id===state.itemId);if(!item)return `<div class="empty-card"><strong>Material not found.</strong><button class="primary-btn" data-go="section">Go back</button></div>`;
  state.lastOpened=item.id; if(!state.recent.some(r=>r.key===itemKey(item)))state.recent.unshift({key:itemKey(item),classId:item.classId,subjectId:item.subjectId,sectionId:item.sectionId,itemId:item.id,title:item.title});else state.recent=[{key:itemKey(item),classId:item.classId,subjectId:item.subjectId,sectionId:item.sectionId,itemId:item.id,title:item.title},...state.recent.filter(r=>r.key!==itemKey(item))];saveRecent();
  if(item.sectionId==="worksheet") return `<button class="back-btn" type="button" data-go="section">← Back to Worksheets</button><section class="viewer-card"><div class="viewer-head"><div><p>${className(item.classId)} • ${esc(subject(item.subjectId)?.name||"")}</p><h3>${esc(item.title)}</h3></div><span class="access-pill download">DOWNLOAD</span></div><div class="protected-placeholder"><div>📄</div><h4>Worksheet ready</h4><p>Preview is available inside the app. Download is enabled for worksheets.</p>${item.filePath?'<button class="primary-btn" id="downloadWorksheet">DOWNLOAD WORKSHEET</button>':'<button class="primary-btn" id="downloadWorksheet" disabled>PDF NOT PUBLISHED</button>'}<button class="secondary-btn" id="worksheetPreview">OPEN PREVIEW</button></div></section>`;
  return `<button class="back-btn" type="button" data-go="section">← Back to Notes</button><section class="reader-shell"><div class="reader-head"><div><p>${className(item.classId)} • ${esc(subject(item.subjectId)?.name||"")}</p><h3>${esc(item.title)}</h3></div><span class="access-pill protected">READ ONLY</span></div><div id="pdfStatus" class="reader-status">Loading protected reader…</div><div id="pdfToolbar" class="pdf-toolbar hidden"><button id="prevPage">←</button><span id="pageInfo">Page 1</span><button id="nextPage">→</button><button id="zoomOut">−</button><button id="zoomIn">+</button><button id="fullscreenReader">⛶</button></div><div id="pdfCanvasWrap" class="pdf-canvas-wrap" aria-label="Protected PDF reader"><canvas id="pdfCanvas"></canvas></div><div class="privacy-note">🔒 Download, print and external PDF opening are disabled in this reader.</div></section>`}
function viewSearch(){return `<div class="search-box"><input id="searchInput" value="${esc(state.search)}" placeholder="Search chapters, notes, worksheets…" autocomplete="off"><button class="icon-btn small" id="clearSearch">✕</button></div><div id="searchResults"></div>`}
function renderSearchResults(){const q=state.search.trim().toLowerCase();const all=flattenCatalog(state.catalog);const rows=q?all.filter(x=>`${x.title} ${x.chapter} ${x.subjectName} ${x.classId} ${x.sectionName}`.toLowerCase().includes(q)).slice(0,50):[];document.getElementById("searchResults").innerHTML=rows.length?`<div class="result-list">${rows.map(r=>`<button type="button" class="result-card" data-item="${r.itemId||r.id}" data-class="${r.classId}" data-subject="${r.subjectId}" data-section="${r.sectionId}"><span>${esc(section(r.sectionId)?.icon||"📄")}</span><div><strong>${esc(r.title)}</strong><small>Class ${r.classId} • ${esc(r.subjectName)} • ${esc(r.sectionName)}</small></div><b>›</b></button>`).join("")}</div>`:(q?`<div class="empty-card"><div>🔎</div><strong>No material found</strong><p>Try another chapter or subject name.</p></div>`:`<div class="empty-card"><div>⌕</div><strong>Search your material</strong><p>Type a chapter, subject or class above.</p></div>`)}
function viewRecent(){return state.recent.length?`<div class="section-heading"><h3>Recently opened</h3><button type="button" class="text-btn" id="clearRecent">Clear</button></div>${renderRecentCards(15)}`:`<div class="empty-card"><div>◷</div><strong>No recent items</strong><p>Your opened notes and worksheets will appear here.</p></div>`}
function renderRecentCards(limit){return `<div class="recent-list">${state.recent.slice(0,limit).map(r=>`<button type="button" class="recent-card" data-recent="${r.key}"><span>${section(r.sectionId)?.icon||"📄"}</span><div><strong>${esc(r.title)}</strong><small>Class ${r.classId} • ${esc(subject(r.subjectId)?.name||"")} • ${esc(section(r.sectionId)?.name||"")}</small></div><b>›</b></button>`).join("")}</div>`}
function viewProfile(){const u=firebase.currentUser?.();return `<div class="profile-card"><div class="profile-avatar">${esc((state.profile.name||u?.displayName||u?.email||"S").slice(0,1).toUpperCase())}</div><h3>${esc(state.profile.name||u?.displayName||"Student")}</h3><p>${esc(u?.email||"")}</p></div><div class="panel"><label class="field-label">Display name</label><input id="displayName" class="field" value="${esc(state.profile.name||u?.displayName||"")}" placeholder="Your name"><button class="primary-btn" id="saveProfile">SAVE PROFILE</button><button class="danger-btn" id="logoutBtn">LOG OUT</button></div>`}

function itemKey(item){return `${item.classId}|${item.subjectId}|${item.sectionId}|${item.id}`}
function bind(){
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>navigate(b.dataset.go));
  document.querySelectorAll("[data-class]").forEach(b=>b.onclick=()=>navigate("subject",{classId:b.dataset.classId}));
  document.querySelectorAll("[data-subject]").forEach(b=>b.onclick=()=>navigate("section",{subjectId:b.dataset.subjectId}));
  if(state.route==="section") document.querySelectorAll("[data-section]").forEach(b=>b.onclick=()=>navigate("sectionList",{sectionId:b.dataset.section}));
  if(state.route==="sectionList") bindItemList();
  const searchInput=document.getElementById("searchInput"); if(searchInput){searchInput.oninput=()=>{state.search=searchInput.value;renderSearchResults()};renderSearchResults()}
  const clearSearch=document.getElementById("clearSearch"); if(clearSearch)clearSearch.onclick=()=>{state.search="";render()};
  const clearRecent=document.getElementById("clearRecent");if(clearRecent)clearRecent.onclick=()=>{state.recent=[];saveRecent();render()};
  document.querySelectorAll("[data-recent]").forEach(b=>b.onclick=()=>{const r=state.recent.find(x=>x.key===b.dataset.recent);if(r)navigate("viewer",r)});
  document.querySelectorAll("[data-item]").forEach(b=>b.onclick=()=>navigate("viewer",{classId:b.dataset.class,subjectId:b.dataset.subject,sectionId:b.dataset.section,itemId:b.dataset.item}));
  const profile=document.getElementById("profileBtn");if(profile)profile.onclick=()=>navigate("profile");
  const save=document.getElementById("saveProfile");if(save)save.onclick=saveProfile;
  const logout=document.getElementById("logoutBtn");if(logout)logout.onclick=logout;
  const dl=document.getElementById("downloadWorksheet");if(dl)dl.onclick=downloadWorksheet;
  const prev=document.getElementById("worksheetPreview");if(prev)prev.onclick=()=>loadWorksheetPreview();
  if(state.route==="viewer" && section(state.sectionId)?.protected) loadProtectedPdf();
}
function bindItemList(){
  document.querySelectorAll("[data-material]").forEach(b=>b.onclick=()=>navigate("viewer",{itemId:b.dataset.material}));
}

function viewSectionList(){const s=subject(state.subjectId),sec=section(state.sectionId),rows=itemsFor();return `<button class="back-btn" type="button" data-go="section">← Back</button><div class="title-block"><p>${className(state.classId)} • ${esc(s?.name||"")}</p><h3>${esc(sec?.name||"")}</h3><small>${sec?.protected?"Read-only viewer • No download/print":"Worksheets can be downloaded"}</small></div><div class="material-list">${rows.map(x=>`<button type="button" class="material-card" data-material="${esc(x.id)}"><span class="material-icon">${sec?.icon||"📄"}</span><div><strong>${esc(x.title)}</strong><small>${esc(x.description||"Tap to open")}</small></div><span class="material-action">${sec?.protected?"READ":"DOWNLOAD"}</span></button>`).join("")}</div>`}

// Dynamic view dispatch for sectionList.
const originalRender=render;
render=function(){
  els.pageDate.textContent=nowText();
  const titles={home:"Home",classes:"Classes",subject:"Subjects",section:"Materials",sectionList:section(state.sectionId)?.name||"Materials",viewer:"Reader",search:"Search",recent:"Recent",profile:"Profile"};
  els.pageTitle.textContent=titles[state.route]||"Home";
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",["home","classes","search","recent"].includes(state.route)&&b.dataset.route===state.route));
  const views={home:viewHome,classes:viewClasses,subject:viewSubject,section:viewSection,sectionList:viewSectionList,viewer:viewViewer,search:viewSearch,recent:viewRecent,profile:viewProfile};
  els.content.innerHTML=(views[state.route]||viewHome)();bind();els.content.focus({preventScroll:true});
};

async function boot(){
  state.recent=loadRecent();
  if(!firebase?.configured){showToast("Firebase configuration is missing.");return;}
  firebase.onAuthStateChanged(async user=>{
    if(user){
      els.loginView.classList.add("hidden");els.appView.classList.remove("hidden");
      try{state.profile=await firebase.loadUserProfile(user.uid)||{name:user.displayName||"Student",email:user.email||""};}catch{state.profile={name:user.displayName||"Student",email:user.email||""}}
      try{state.catalog=normalizeCatalog(await firebase.loadCatalog())}catch{state.catalog=normalizeCatalog(DEMO_CATALOG)}
      render();
    }else{els.appView.classList.add("hidden");els.loginView.classList.remove("hidden");}
  });
  await firebase.getRedirectResult().catch(()=>{});
}

document.getElementById("loginForm").addEventListener("submit",async e=>{e.preventDefault();const email=document.getElementById("loginEmail").value.trim(),pass=document.getElementById("loginPassword").value;if(!email||!pass){showToast("Enter email and password");return}try{await firebase.signIn(email,pass)}catch(err){showToast(authError(err))}});
document.getElementById("googleLoginBtn").onclick=async()=>{try{await firebase.signInWithGoogle()}catch(err){showToast(authError(err))}};
document.getElementById("forgotBtn").onclick=async()=>{const email=document.getElementById("loginEmail").value.trim();if(!email){showToast("Enter your email first");return}try{await firebase.resetPassword(email);showToast("Password reset email sent") }catch(err){showToast(authError(err))}};

document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>navigate(b.dataset.route));

async function saveProfile(){const input=document.getElementById("displayName"),name=input.value.trim();if(!name){showToast("Enter your name");return}try{await firebase.updateDisplayName(name);await firebase.saveUserProfile(firebase.currentUser().uid,{name,email:firebase.currentUser().email||"",updatedAt:Date.now()});state.profile={...state.profile,name};showToast("Profile saved");render()}catch(e){showToast(e.message||"Profile could not be saved")}}
async function logout(){try{await firebase.signOut()}catch(e){showToast("Could not log out")}}

async function fetchPdfDocument(blob){
  if(!window.__pdfjs){window.__pdfjs=import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");}
  const pdfjs=await window.__pdfjs;pdfjs.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  return pdfjs.getDocument({data:await blob.arrayBuffer(),disableAutoFetch:false}).promise;
}
let reader={pdf:null,page:1,scale:1.12};
async function loadProtectedPdf(){
  const item=itemsFor().find(x=>x.id===state.itemId),status=document.getElementById("pdfStatus");if(!item||!status)return;
  if(!item.filePath){status.innerHTML="<strong>Material not published yet.</strong><br><span>Your protected PDF will appear here after it is uploaded to Firebase Storage.</span>";return}
  try{const blob=await firebase.readBlob(item.filePath);reader.pdf=await fetchPdfDocument(blob);reader.page=1;reader.scale=1.12;status.classList.add("hidden");document.getElementById("pdfToolbar").classList.remove("hidden");await renderPdfPage();}
  catch(e){status.innerHTML=`<strong>Could not open this note.</strong><br><span>${esc(e?.message||"Access denied or file unavailable.")}</span>`}
}
async function renderPdfPage(){const canvas=document.getElementById("pdfCanvas"),ctx=canvas?.getContext("2d");if(!reader.pdf||!canvas)return;const page=await reader.pdf.getPage(reader.page),vp=page.getViewport({scale:reader.scale});canvas.width=vp.width;canvas.height=vp.height;await page.render({canvasContext:ctx,viewport:vp}).promise;document.getElementById("pageInfo").textContent=`Page ${reader.page} / ${reader.pdf.numPages}`}
document.addEventListener("click",async e=>{const id=e.target.id;if(!id)return;if(id==="prevPage"&&reader.pdf&&reader.page>1){reader.page--;renderPdfPage()}if(id==="nextPage"&&reader.pdf&&reader.page<reader.pdf.numPages){reader.page++;renderPdfPage()}if(id==="zoomOut"){reader.scale=Math.max(.75,reader.scale-.12);renderPdfPage()}if(id==="zoomIn"){reader.scale=Math.min(2.5,reader.scale+.12);renderPdfPage()}if(id==="fullscreenReader"){document.querySelector(".reader-shell")?.requestFullscreen?.()}});

async function downloadWorksheet(){const item=itemsFor().find(x=>x.id===state.itemId);if(!item?.filePath){showToast("Worksheet PDF is not published yet");return}try{const blob=await firebase.readBlob(item.filePath);const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=(item.title||"worksheet").replace(/[^a-z0-9-_ ]/gi,"")+".pdf";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);showToast("Worksheet downloaded")}catch(e){showToast("Download failed")}}
async function loadWorksheetPreview(){const item=itemsFor().find(x=>x.id===state.itemId);if(!item?.filePath){showToast("Worksheet PDF is not published yet");return}try{const blob=await firebase.readBlob(item.filePath),url=URL.createObjectURL(blob);const w=window.open("about:blank","_blank","noopener,noreferrer");if(!w){showToast("Allow pop-ups to preview worksheet");URL.revokeObjectURL(url);return}w.document.write(`<html><head><title>${esc(item.title)}</title></head><body style="margin:0"><iframe src="${url}" style="width:100%;height:100vh;border:0"></iframe></body></html>`);w.document.close();setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(e){showToast("Preview failed")}}

// Prevent common browser actions in protected reader. OS-level screenshots cannot be fully prevented by a web app.
document.addEventListener("contextmenu",e=>{if(e.target.closest(".reader-shell"))e.preventDefault()});
document.addEventListener("keydown",e=>{if(document.querySelector(".reader-shell") && ((e.ctrlKey||e.metaKey)&&["p","s","u"].includes(e.key.toLowerCase()))){e.preventDefault();showToast("This action is disabled in protected reader")}});

authorizeNavigation();
function authorizeNavigation(){render();boot()}
