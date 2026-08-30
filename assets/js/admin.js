import {
  SUBJECTS,
  SECTIONS,
  CLASSES,
  BOOTSTRAP_EMAIL,
  configureAuthPersistence,
  loginWithEmailAndPassword,
  loginWithGoogle,
  sendResetEmail,
  logout,
  listenForAuth,
  adminBootstrap,
  createStudent,
  listStudents,
  updateStudent,
  setStudentActive,
  setStudentPassword,
  getAdminIdentity,
  loadAllCatalog,
  uploadMaterial,
  replaceMaterial,
  deleteMaterial,
  publishMaterial,
} from "./admin-client.js";

const $ = (s) => document.querySelector(s);
const state = {
  user: null,
  admin: false,
  students: [],
  materials: [],
  pageToken: "",
  studentMode: "create",
  selectedStudent: null,
  selectedPasswordUid: null,
  replacingMaterial: null,
};

const el = {
  authView: $("#adminAuthView"),
  panel: $("#adminPanelView"),
  loginForm: $("#adminLoginForm"),
  email: $("#adminEmail"),
  password: $("#adminPassword"),
  loginBtn: $("#adminLoginBtn"),
  googleBtn: $("#adminGoogleBtn"),
  forgotBtn: $("#adminForgotBtn"),
  authMessage: $("#adminAuthMessage"),
  bootstrapBox: $("#bootstrapBox"),
  bootstrapBtn: $("#bootstrapAdminBtn"),
  sessionEmail: $("#adminSessionEmail"),
  logoutBtn: $("#adminLogoutBtn"),
  refreshBtn: $("#adminRefreshBtn"),
  tabs: [...document.querySelectorAll(".admin-tab")],
  panels: [...document.querySelectorAll(".admin-tab-panel")],
  statStudents: $("#statStudents"), statMaterials: $("#statMaterials"), statNotes: $("#statNotes"), statWorksheets: $("#statWorksheets"), statPublished: $("#statPublished"), statStorage: $("#statStorage"),
  overviewRecentMaterials: $("#overviewRecentMaterials"),
  overviewMaterialsBtn: $("#overviewMaterialsBtn"),
  studentsMessage: $("#studentsMessage"),
  studentSearch: $("#studentSearch"), studentClassFilter: $("#studentClassFilter"), studentStatusFilter: $("#studentStatusFilter"),
  studentsBody: $("#studentsTableBody"), addStudentBtn: $("#addStudentBtn"),
  materialsMessage: $("#materialsMessage"), materialSearch: $("#materialSearch"), materialClassFilter: $("#materialClassFilter"), materialSubjectFilter: $("#materialSubjectFilter"), materialSectionFilter: $("#materialSectionFilter"), materialsBody: $("#materialsTableBody"), refreshMaterialsBtn: $("#refreshMaterialsBtn"),
  uploadForm: $("#uploadForm"), uploadClass: $("#uploadClass"), uploadSubject: $("#uploadSubject"), uploadSection: $("#uploadSection"), uploadTitle: $("#uploadTitle"), uploadChapter: $("#uploadChapter"), uploadFile: $("#uploadFile"), chooseFile: $("#chooseUploadFileBtn"), uploadFileName: $("#uploadFileName"), uploadFileMeta: $("#uploadFileMeta"), publishOnUpload: $("#publishOnUpload"), uploadProgressWrap: $("#uploadProgressWrap"), uploadProgressLabel: $("#uploadProgressLabel"), uploadProgressPercent: $("#uploadProgressPercent"), uploadProgressBar: $("#uploadProgressBar"), uploadMessage: $("#uploadMessage"), uploadBtn: $("#uploadBtn"),
  studentDialog: $("#studentDialog"), studentForm: $("#studentForm"), studentDialogTitle: $("#studentDialogTitle"), studentDialogEyebrow: $("#studentDialogEyebrow"), studentDialogClose: $("#studentDialogClose"), studentDialogCancel: $("#studentDialogCancel"), studentName: $("#studentName"), studentEmail: $("#studentEmail"), studentPassword: $("#studentPassword"), studentClass: $("#studentClass"), studentUid: $("#studentUid"), studentDialogHelp: $("#studentDialogHelp"), studentDialogMessage: $("#studentDialogMessage"), studentDialogSubmit: $("#studentDialogSubmit"),
  passwordDialog: $("#passwordDialog"), passwordForm: $("#passwordForm"), passwordStudentUid: $("#passwordStudentUid"), newStudentPassword: $("#newStudentPassword"), passwordDialogClose: $("#passwordDialogClose"), passwordDialogCancel: $("#passwordDialogCancel"), passwordDialogMessage: $("#passwordDialogMessage"),
  globalStatus: $("#adminGlobalStatus"),
};

function message(target, text = "", type = "") { target.textContent = text; target.className = `inline-message ${type}`.trim(); }
function status(text = "") { el.globalStatus.textContent = text; el.globalStatus.hidden = !text; }
function sleepClear(ms = 2200) { setTimeout(() => status(""), ms); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function fmtSize(bytes) { const n=Number(bytes)||0; if(n<1024*1024) return `${Math.max(1,Math.round(n/1024))} KB`; return `${(n/1024/1024).toFixed(1)} MB`; }
function fmtDate(v) { if(!v) return "—"; const d=new Date(v); return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric"}).format(d); }
function fmtDateTime(v) { if(!v) return "Never"; const d=new Date(v); return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d); }

function showAuth() { el.authView.hidden=false; el.panel.hidden=true; }
function showPanel() { el.authView.hidden=true; el.panel.hidden=false; }

function tab(name) {
  el.tabs.forEach(b=>b.classList.toggle("is-active", b.dataset.adminTab===name));
  el.panels.forEach(p=>p.hidden=p.dataset.panel!==name);
  if(name === "students") loadStudents();
  if(name === "materials") loadMaterials();
}

function studentFiltered() {
  const q=el.studentSearch.value.trim().toLowerCase();
  const cls=el.studentClassFilter.value;
  const st=el.studentStatusFilter.value;
  return state.students.filter(s=>{
    const matchesQ=!q || [s.displayName,s.email,s.uid].join(" ").toLowerCase().includes(q);
    const matchesC=cls==="all" || String(s.class||"")===cls;
    const matchesS=st==="all" || (st==="active" ? !s.disabled : s.disabled);
    return matchesQ&&matchesC&&matchesS;
  });
}

function renderStudents() {
  const rows=studentFiltered();
  if(!rows.length){ el.studentsBody.innerHTML=`<tr><td colspan="5"><div class="table-empty">No students match this filter.</div></td></tr>`; return; }
  el.studentsBody.innerHTML=rows.map(s=>{
    const initial=(s.displayName||s.email||"S").trim().charAt(0).toUpperCase();
    return `<tr>
      <td><div class="student-cell"><span class="table-avatar">${escapeHtml(initial)}</span><div><strong>${escapeHtml(s.displayName||"Unnamed")}</strong><small>${escapeHtml(s.email)}</small></div></div></td>
      <td>Class ${Number(s.class)||"—"}</td>
      <td><span class="status-pill ${s.disabled?"disabled":"active"}">${s.disabled?"Disabled":"Active"}</span></td>
      <td>${escapeHtml(fmtDateTime(s.lastSignInTime))}</td>
      <td><div class="row-actions">
        <button class="mini-action" data-student-action="edit" data-uid="${escapeHtml(s.uid)}" type="button">Edit</button>
        <button class="mini-action" data-student-action="password" data-uid="${escapeHtml(s.uid)}" type="button">Password</button>
        <button class="mini-action ${s.disabled?"success":"danger"}" data-student-action="toggle" data-uid="${escapeHtml(s.uid)}" type="button">${s.disabled?"Enable":"Disable"}</button>
      </div></td>
    </tr>`;
  }).join("");
}

function materialFiltered() {
  const q=el.materialSearch.value.trim().toLowerCase(); const cls=el.materialClassFilter.value; const sub=el.materialSubjectFilter.value; const sec=el.materialSectionFilter.value;
  return state.materials.filter(m=>{
    const qok=!q || [m.title,m.chapter,m.fileName,m.subject,m.section].join(" ").toLowerCase().includes(q);
    return qok&&(cls==="all"||String(m.class)===cls)&&(sub==="all"||m.subject===sub)&&(sec==="all"||m.section===sec);
  });
}

function renderMaterials() {
  const rows=materialFiltered();
  if(!rows.length){ el.materialsBody.innerHTML=`<tr><td colspan="6"><div class="table-empty">No materials match this filter.</div></td></tr>`; return; }
  const subjectLabel=Object.fromEntries(SUBJECTS.map(x=>[x.id,x.label])); const sectionLabel=Object.fromEntries(SECTIONS.map(x=>[x.id,x.label]));
  el.materialsBody.innerHTML=rows.map(m=>`<tr>
    <td><div><strong>${escapeHtml(m.title||"Untitled")}</strong><small>${escapeHtml(m.fileName||"PDF")}${m.chapter?` • ${escapeHtml(m.chapter)}`:""}</small></div></td>
    <td>Class ${Number(m.class)}</td><td>${escapeHtml(sectionLabel[m.section]||m.section)}<small>${escapeHtml(subjectLabel[m.subject]||m.subject)}</small></td>
    <td>${escapeHtml(fmtSize(m.fileSize))}</td><td><span class="status-pill ${m.active?"active":"disabled"}">${m.active?"Published":"Unpublished"}</span></td>
    <td><div class="row-actions"><button class="mini-action" data-material-action="toggle" data-id="${escapeHtml(m.id)}" type="button">${m.active?"Unpublish":"Publish"}</button><button class="mini-action" data-material-action="replace" data-id="${escapeHtml(m.id)}" type="button">Replace</button><button class="mini-action danger" data-material-action="delete" data-id="${escapeHtml(m.id)}" type="button">Delete</button></div></td>
  </tr>`).join("");
}

async function loadStudents({append=false}={}) {
  message(el.studentsMessage, append?"Loading more students…":"Loading students…", "loading");
  try {
    const data=await listStudents(append?state.pageToken:"");
    state.pageToken=data.pageToken||"";
    if(append) state.students=[...state.students,...(data.students||[])]; else state.students=data.students||[];
    renderStudents();
    message(el.studentsMessage, `${state.students.length} student${state.students.length===1?"":"s"} loaded.`, "success");
  } catch(error) {
    console.error(error); message(el.studentsMessage, friendlyFunctionError(error), "error");
  }
}

async function loadMaterials() {
  message(el.materialsMessage,"Loading catalog…","loading");
  try { state.materials=await loadAllCatalog(); renderMaterials(); message(el.materialsMessage,`${state.materials.length} material${state.materials.length===1?"":"s"} loaded.` ,"success"); renderStats(); } catch(error){ console.error(error); message(el.materialsMessage,"Catalog could not be loaded. Check your admin access and retry.","error"); }
}

function renderStats() {
  const m=state.materials; el.statMaterials.textContent=m.length; el.statNotes.textContent=m.filter(x=>x.section!=="worksheet").length; el.statWorksheets.textContent=m.filter(x=>x.section==="worksheet").length; el.statPublished.textContent=m.filter(x=>x.active).length; el.statStorage.textContent=m.reduce((n,x)=>n+Number(x.fileSize||0),0)>0?fmtSize(m.reduce((n,x)=>n+Number(x.fileSize||0),0)):"0 KB";
  el.statStudents.textContent=state.students.length||"—";
  const latest=m.slice(0,6); el.overviewRecentMaterials.innerHTML=latest.length?latest.map(x=>`<div class="mini-list-row"><span><strong>${escapeHtml(x.title||"Untitled")}</strong><small>Class ${Number(x.class)} • ${escapeHtml(x.subject)} • ${escapeHtml(x.section)}</small></span><b>${x.active?"Published":"Unpublished"}</b></div>`).join(""):`<div class="table-empty">No materials uploaded yet.</div>`;
}

function friendlyFunctionError(error) {
  const code=error?.code||error?.message||"";
  const map={
    "functions/permission-denied":"You do not have admin permission for this action.",
    "functions/invalid-argument":"Please check the form values.",
    "functions/unauthenticated":"Please sign in again.",
    "functions/already-exists":"That email is already registered.",
    "functions/not-found":"The student could not be found.",
    "NETWORK_TIMEOUT":"The request timed out. Please retry.",
  };
  return map[code]||error?.message||"Something went wrong. Please retry.";
}

function resetStudentDialog() {
  el.studentForm.reset(); el.studentUid.value=""; el.studentMode="create"; el.studentDialogTitle.textContent="Add Student"; el.studentDialogEyebrow.textContent="NEW STUDENT"; el.studentEmail.readOnly=false; el.studentPassword.required=true; el.studentDialogSubmit.textContent="Create Student"; el.studentDialogHelp.innerHTML="<strong>New account</strong><span>The password is stored by Firebase Authentication, not Realtime Database.</span>"; message(el.studentDialogMessage,"");
}

function openStudentDialog(student=null) {
  resetStudentDialog();
  if(student){ state.studentMode="edit"; state.selectedStudent=student; el.studentUid.value=student.uid; el.studentName.value=student.displayName||""; el.studentEmail.value=student.email||""; el.studentEmail.readOnly=true; el.studentPassword.required=false; el.studentPassword.placeholder="Leave blank to keep current password"; el.studentClass.value=String(student.class||""); el.studentDialogTitle.textContent="Edit Student"; el.studentDialogEyebrow.textContent="STUDENT ACCOUNT"; el.studentDialogSubmit.textContent="Save Changes"; el.studentDialogHelp.innerHTML="<strong>Account management</strong><span>Change name/class here. Use the Password action to set a new password.</span>"; }
  el.studentDialog.showModal();
}

async function submitStudent(event){ event.preventDefault();
  const name=el.studentName.value.trim(), email=el.studentEmail.value.trim(), password=el.studentPassword.value, cls=Number(el.studentClass.value);
  if(name.length<2){ message(el.studentDialogMessage,"Name must contain at least 2 characters.","error"); return; }
  if(!/^\\S+@\\S+\\.\\S+$/.test(email)){ message(el.studentDialogMessage,"Enter a valid email address.","error"); return; }
  if(!Number.isInteger(cls)||!CLASSES.includes(cls)){ message(el.studentDialogMessage,"Choose Class 6–10.","error"); return; }
  if(state.studentMode==="create" && password.length<6){ message(el.studentDialogMessage,"Password must be at least 6 characters.","error"); return; }
  el.studentDialogSubmit.disabled=true; message(el.studentDialogMessage,state.studentMode==="create"?"Creating student…":"Saving student…","loading");
  try{
    if(state.studentMode==="create"){
      const result=await createStudent({displayName:name,email,password,classNumber:cls});
      await loadStudents();
      el.studentDialog.close();
      status(`Student created: ${result.data?.email||email}`); sleepClear(3500);
    }else{
      const result=await updateStudent({uid:el.studentUid.value,displayName:name,classNumber:cls});
      await loadStudents();
      el.studentDialog.close();
      status(`Student updated: ${result.data?.email||email}`); sleepClear(2800);
    }
  }catch(error){ console.error(error); message(el.studentDialogMessage,friendlyFunctionError(error),"error"); }
  finally{ el.studentDialogSubmit.disabled=false; }
}

function openPasswordDialog(student){ state.selectedPasswordUid=student.uid; el.passwordStudentUid.value=student.uid; el.newStudentPassword.value=""; message(el.passwordDialogMessage,""); el.passwordDialog.showModal(); }
async function submitPassword(event){ event.preventDefault(); const password=el.newStudentPassword.value; if(password.length<6){message(el.passwordDialogMessage,"Password must be at least 6 characters.","error");return;} el.passwordDialog.querySelector("button[type=submit]").disabled=true; message(el.passwordDialogMessage,"Updating password…","loading"); try{await setStudentPassword({uid:state.selectedPasswordUid,password});el.passwordDialog.close();status("Student password updated.");sleepClear();}catch(error){console.error(error);message(el.passwordDialogMessage,friendlyFunctionError(error),"error");}finally{el.passwordDialog.querySelector("button[type=submit]").disabled=false;} }

async function toggleStudent(student){ if(!student) return; const next=!student.disabled; if(!confirm(`${next?"Disable":"Enable"} ${student.displayName||student.email}?`)) return; status(next?"Disabling student…":"Enabling student…"); try{await setStudentActive({uid:student.uid,active:!next});await loadStudents();status(next?"Student disabled.":"Student enabled.");sleepClear();}catch(error){console.error(error);status(friendlyFunctionError(error));sleepClear(3200);} }

async function materialAction(action,id){ const material=state.materials.find(m=>m.id===id); if(!material)return;
  if(action==="toggle"){
    const target=!material.active; if(!confirm(`${target?"Publish":"Unpublish"} “${material.title}"?`))return; status(target?"Publishing material…":"Unpublishing material…"); try{const updated=await publishMaterial(material,target); Object.assign(material,updated);renderMaterials();renderStats();status(target?"Material published.":"Material unpublished.");sleepClear();}catch(error){console.error(error);status(friendlyFunctionError(error));sleepClear(3200);} return;
  }
  if(action==="delete"){
    if(!confirm(`Delete “${material.title}" permanently? This deletes the Storage file and catalog record.`))return; status("Deleting material…"); try{await deleteMaterial(material);state.materials=state.materials.filter(x=>x.id!==material.id);renderMaterials();renderStats();status("Material deleted successfully.");sleepClear();}catch(error){console.error(error);status(friendlyFunctionError(error));sleepClear(3200);} return;
  }
  if(action==="replace"){
    state.replacingMaterial=material; replacementInput.click();
  }
}

const replacementInput=document.createElement("input"); replacementInput.type="file"; replacementInput.accept="application/pdf,.pdf"; replacementInput.hidden=true; document.body.appendChild(replacementInput);
replacementInput.addEventListener("change",async()=>{const file=replacementInput.files?.[0],material=state.replacingMaterial;replacementInput.value="";if(!file||!material)return; status("Replacing PDF… 0%"); try{const updated=await replaceMaterial(material,file,material.active,(p)=>status(`Replacing PDF… ${p.percent}%`));state.materials=state.materials.map(x=>x.id===updated.id?updated:x);renderMaterials();renderStats();status("PDF replaced successfully.");sleepClear(3200);}catch(error){console.error(error);status(friendlyFunctionError(error));sleepClear(3200);}finally{state.replacingMaterial=null;}});

function fileSelected(){const file=el.uploadFile.files?.[0];if(!file){el.uploadFileName.textContent="Choose PDF file";el.uploadFileMeta.textContent="Maximum 100 MB • PDF only";return;}el.uploadFileName.textContent=file.name;el.uploadFileMeta.textContent=`${fmtSize(file.size)} • PDF`;
  if(file.type!=="application/pdf"||!file.name.toLowerCase().endsWith(".pdf")){el.uploadFileName.textContent="Invalid file type";message(el.uploadMessage,"Please select a PDF file.","error");}
  else if(file.size>100*1024*1024){message(el.uploadMessage,"PDF exceeds the 100 MB limit.","error");}
  else message(el.uploadMessage,"File ready to upload.","success");
}

async function submitUpload(event){event.preventDefault(); const file=el.uploadFile.files?.[0];const cls=Number(el.uploadClass.value),subject=el.uploadSubject.value,section=el.uploadSection.value,title=el.uploadTitle.value.trim(),chapter=el.uploadChapter.value.trim();
  if(!CLASSES.includes(cls)||!SUBJECTS.some(x=>x.id===subject)||!SECTIONS.some(x=>x.id===section)){message(el.uploadMessage,"Choose class, subject and section.","error");return;}
  if(title.length<2){message(el.uploadMessage,"Enter a material title.","error");return;}
  if(!file||file.type!=="application/pdf"||!file.name.toLowerCase().endsWith(".pdf")){message(el.uploadMessage,"Choose a valid PDF.","error");return;}
  if(file.size<=0||file.size>100*1024*1024){message(el.uploadMessage,"PDF must be larger than 0 and no more than 100 MB.","error");return;}
  const id=crypto.randomUUID?crypto.randomUUID():`m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const cleanFilename=file.name.replace(/[^a-zA-Z0-9._-]/g,"-").slice(-160);
  const storagePath=`study-materials/class-${cls}/${subject}/${section}/${id}.pdf`;
  const metadata={id,title,chapter,class:cls,subject,section,storagePath,fileName:cleanFilename,type:"pdf",active:false,createdAt:Date.now(),updatedAt:Date.now()};
  el.uploadBtn.disabled=true;el.chooseFile.disabled=true;el.uploadProgressWrap.hidden=false;el.uploadProgressBar.style.width="0%";el.uploadProgressLabel.textContent="Uploading…";el.uploadProgressPercent.textContent="0%";message(el.uploadMessage,"Starting upload…","loading");
  try{const record=await uploadMaterial({file,metadata,publish:el.publishOnUpload.checked,onProgress:(p)=>{el.uploadProgressBar.style.width=`${p.percent}%`;el.uploadProgressPercent.textContent=`${p.percent}%`;el.uploadProgressLabel.textContent="Uploading PDF…";}});state.materials.unshift(record);renderMaterials();renderStats();message(el.uploadMessage,record.active?"Upload + publish complete.":"Upload complete; material remains unpublished.","success");el.uploadForm.reset();el.uploadFileName.textContent="Choose PDF file";el.uploadFileMeta.textContent="Maximum 100 MB • PDF only";setTimeout(()=>tab("materials"),900);}catch(error){console.error(error);message(el.uploadMessage,friendlyFunctionError(error),"error");}finally{el.uploadBtn.disabled=false;el.chooseFile.disabled=false;setTimeout(()=>{el.uploadProgressWrap.hidden=true;},1200);}
}

async function becomeAdmin(){el.bootstrapBtn.disabled=true;message(el.authMessage,"Activating admin access…","loading");try{await adminBootstrap();await elCurrentTokenRefresh();showPanel();await loadDashboard();message(el.authMessage,"");}catch(error){console.error(error);message(el.authMessage,friendlyFunctionError(error),"error");}finally{el.bootstrapBtn.disabled=false;}}
async function elCurrentTokenRefresh(){const {user}=await getAdminIdentity(false);if(user)await user.getIdToken(true);}

async function processAuthUser(user){ state.user=user;if(!user){state.admin=false;showAuth();return;}
  try{
    const identity=await getAdminIdentity(true);state.admin=identity.admin;el.sessionEmail.textContent=user.email||"";
    if(!identity.admin){showAuth();el.bootstrapBox.hidden=user.email?.toLowerCase()!==BOOTSTRAP_EMAIL.toLowerCase();message(el.authMessage,el.bootstrapBox.hidden?"This account is not authorised for the Admin Panel.":"Admin access is ready to be activated for this account.","error");return;}
    showPanel();await loadDashboard();
  }catch(error){console.error(error);showAuth();message(el.authMessage,"Could not verify admin access. Please sign in again.","error");}
}

async function loadDashboard(){message(el.materialsMessage,"");message(el.studentsMessage,"");await Promise.allSettled([loadStudents(),loadMaterials()]);renderStats();}

async function login(event){event.preventDefault();const email=el.email.value.trim(),password=el.password.value;if(!email||!el.email.validity.valid){message(el.authMessage,"Enter a valid email.","error");return;}if(password.length<6){message(el.authMessage,"Enter your password.","error");return;}el.loginBtn.disabled=true;el.googleBtn.disabled=true;el.forgotBtn.disabled=true;message(el.authMessage,"Signing in…","loading");try{await loginWithEmailAndPassword(email,password);}catch(error){console.error(error);message(el.authMessage,friendlyFunctionError(error),"error");}finally{el.loginBtn.disabled=false;el.googleBtn.disabled=false;el.forgotBtn.disabled=false;}}
async function googleLogin(){el.loginBtn.disabled=true;el.googleBtn.disabled=true;el.forgotBtn.disabled=true;message(el.authMessage,"Opening Google sign-in…","loading");try{await loginWithGoogle();}catch(error){console.error(error);message(el.authMessage,friendlyFunctionError(error),"error");}finally{el.loginBtn.disabled=false;el.googleBtn.disabled=false;el.forgotBtn.disabled=false;}}
async function forgot(){const email=el.email.value.trim();if(!email||!el.email.validity.valid){message(el.authMessage,"Enter admin email first.","error");return;}el.loginBtn.disabled=true;el.googleBtn.disabled=true;el.forgotBtn.disabled=true;message(el.authMessage,"Sending reset email…","loading");try{await sendResetEmail(email);message(el.authMessage,"Password reset email sent.","success");}catch(error){console.error(error);message(el.authMessage,friendlyFunctionError(error),"error");}finally{el.loginBtn.disabled=false;el.googleBtn.disabled=false;el.forgotBtn.disabled=false;}}

function bind(){
  el.loginForm.addEventListener("submit",login);el.googleBtn.addEventListener("click",googleLogin);el.forgotBtn.addEventListener("click",forgot);el.bootstrapBtn.addEventListener("click",becomeAdmin);el.logoutBtn.addEventListener("click",()=>logout().catch(console.error));el.refreshBtn.addEventListener("click",loadDashboard);
  el.tabs.forEach(b=>b.addEventListener("click",()=>tab(b.dataset.adminTab)));el.overviewMaterialsBtn.addEventListener("click",()=>tab("materials"));
  el.addStudentBtn.addEventListener("click",()=>openStudentDialog());el.studentForm.addEventListener("submit",submitStudent);el.studentDialogClose.addEventListener("click",()=>el.studentDialog.close());el.studentDialogCancel.addEventListener("click",()=>el.studentDialog.close());
  el.passwordForm.addEventListener("submit",submitPassword);el.passwordDialogClose.addEventListener("click",()=>el.passwordDialog.close());el.passwordDialogCancel.addEventListener("click",()=>el.passwordDialog.close());
  [el.studentSearch,el.studentClassFilter,el.studentStatusFilter].forEach(x=>x.addEventListener("input",renderStudents));
  [el.materialSearch,el.materialClassFilter,el.materialSubjectFilter,el.materialSectionFilter].forEach(x=>x.addEventListener("input",renderMaterials));el.refreshMaterialsBtn.addEventListener("click",loadMaterials);
  el.chooseFile.addEventListener("click",()=>el.uploadFile.click());el.uploadFile.addEventListener("change",fileSelected);el.uploadForm.addEventListener("submit",submitUpload);
  el.studentsBody.addEventListener("click",e=>{const b=e.target.closest("[data-student-action]");if(!b)return;const s=state.students.find(x=>x.uid===b.dataset.uid);if(!s)return;const a=b.dataset.studentAction;if(a==="edit")openStudentDialog(s);if(a==="password")openPasswordDialog(s);if(a==="toggle")toggleStudent(s);});
  el.materialsBody.addEventListener("click",e=>{const b=e.target.closest("[data-material-action]");if(b)materialAction(b.dataset.materialAction,b.dataset.id);});
}

(async function bootstrap(){
  bind();showAuth();
  try{await configureAuthPersistence();}catch(error){console.warn(error);}
  listenForAuth(async user=>{await processAuthUser(user);});
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
})();
