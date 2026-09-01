
import { get, ref, update } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { auth, database } from "./firebase-init.js";
import { listStudents } from "./admin-client.js";

const $ = (s)=>document.querySelector(s);
const ADMIN_EMAIL = "creativesayeedd@gmail.com";
const SUBJECTS = [
  {id:"sst",label:"SST"},{id:"science",label:"Science"},{id:"math",label:"Math"},{id:"english",label:"English"}
];
const TYPES = [
  {id:"mcq",label:"MCQ"},
  {id:"truefalse",label:"True / False"},
  {id:"fill",label:"Fill in the Blanks"}
];
const CLASSES=[6,7,8,9,10];
const timeout=(ms=15000)=>new Promise((_,r)=>setTimeout(()=>r(new Error("NETWORK_TIMEOUT")),ms));
async function withTimeout(p,ms=15000){return Promise.race([p,timeout(ms)]);}
function k(v){return String(v??"").replace(/[.#$\[\]/]/g,"_");}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function isAdmin(){return String(auth.currentUser?.email||"").toLowerCase()===ADMIN_EMAIL.toLowerCase();}
function msg(text,type=""){const el=$("#featureAdminMessage");if(el){el.textContent=text;el.dataset.type=type;}}
async function notifyClass(classNumber,title,message,type="material",priority="normal"){
  const result=await listStudents();
  const updates={};
  result.students.filter(s=>Number(s.class)===Number(classNumber)&&s.active!==false).forEach(s=>{
    const id=`n-${Date.now()}-${Math.random().toString(36).slice(2,7)}-${k(s.uid).slice(-4)}`;
    updates[`notifications/${s.uid}/${id}`]={title,message,type,priority,createdAt:Date.now(),read:false,targetClass:Number(classNumber)};
  });
  if(Object.keys(updates).length) await withTimeout(update(ref(database),updates),15000);
}

let practiceQuestions=[];
let editingPracticeId="";
let practiceClass=6;

function resetQuestionComposer(){
  const type=$("#pqType"); if(!type)return;
  type.value="mcq";
  $("#pqPrompt").value="";
  $("#pqOptionA").value=""; $("#pqOptionB").value=""; $("#pqOptionC").value=""; $("#pqOptionD").value="";
  $("#pqAnswer").value="0";
  $("#pqAccepted").value="";
  $("#pqMarks").value="1";
  renderQuestionComposer();
}
function renderQuestionComposer(){
  const type=$("#pqType")?.value||"mcq";
  const opts=$("#pqMcqOptions"), fill=$("#pqFillOptions"), tf=$("#pqTfOptions");
  if(opts)opts.hidden=type!=="mcq";
  if(fill)fill.hidden=type!=="fill";
  if(tf)tf.hidden=type!=="truefalse";
}
function collectQuestion(){
  const type=$("#pqType").value;
  const prompt=$("#pqPrompt").value.trim();
  const marks=Math.max(1,Number($("#pqMarks").value)||1);
  if(prompt.length<2)throw new Error("Enter the question.");
  if(type==="mcq"){
    const options=[$("#pqOptionA").value,$("#pqOptionB").value,$("#pqOptionC").value,$("#pqOptionD").value].map(x=>String(x||"").trim());
    if(options.some(x=>x.length<1))throw new Error("Fill all four MCQ options.");
    const answer=String($("#pqAnswer").value);
    if(!["0","1","2","3"].includes(answer))throw new Error("Choose the correct MCQ option.");
    return {type,prompt,options,answer,marks};
  }
  if(type==="truefalse"){
    return {type,prompt,answer:$("#pqTfAnswer").value==="true"?"true":"false",marks};
  }
  const accepted=$("#pqAccepted").value.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean);
  if(!accepted.length)throw new Error("Add at least one accepted answer.");
  return {type,prompt,acceptedAnswers:accepted,answer:accepted[0],marks};
}
function renderQuestionsList(){
  const box=$("#practiceQuestionsList"); if(!box)return;
  if(!practiceQuestions.length){box.innerHTML='<div class="table-empty">No questions added yet.</div>';return;}
  box.innerHTML=practiceQuestions.map((q,i)=>`
    <article class="question-admin-row">
      <div><strong>Q${i+1}. ${esc(q.prompt)}</strong><small>${esc(TYPES.find(t=>t.id===q.type)?.label||q.type)} • ${Number(q.marks||1)} mark(s)</small></div>
      <button type="button" class="mini-action danger" data-remove-question="${i}">Remove</button>
    </article>`).join("");
  box.querySelectorAll("[data-remove-question]").forEach(b=>b.addEventListener("click",()=>{practiceQuestions.splice(Number(b.dataset.removeQuestion),1);renderQuestionsList();}));
}

async function savePractice(){
  if(!isAdmin()) throw new Error("AUTH_REQUIRED");
  const title=$("#practiceTitle").value.trim(), chapter=$("#practiceChapter").value.trim();
  const cls=Number($("#practiceClass").value), subject=$("#practiceSubject").value;
  const duration=Math.max(0,Math.round(Number($("#practiceDuration").value||0)*60));
  if(title.length<2)throw new Error("Enter a practice title.");
  if(!CLASSES.includes(cls))throw new Error("Choose a class.");
  if(!SUBJECTS.some(x=>x.id===subject))throw new Error("Choose a subject.");
  if(!practiceQuestions.length)throw new Error("Add at least one question.");
  const id=editingPracticeId||`t-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const record={id,title,chapter,class:cls,subject,durationSec:duration,questions:practiceQuestions.map(q=>JSON.parse(JSON.stringify(q))),active:Boolean($("#practicePublish").checked),createdAt:Number($("#practiceCreatedAt").value)||Date.now(),updatedAt:Date.now()};
  const updates={[`practiceCatalog/class-${cls}/${id}`]:record,[`publishedPractice/class-${cls}/${id}`]:record.active?record:null};
  if(editingPracticeId && practiceClass!==cls){
    updates[`practiceCatalog/class-${practiceClass}/${id}`]=null;
    updates[`publishedPractice/class-${practiceClass}/${id}`]=null;
  }
  await withTimeout(update(ref(database),updates),15000);
  if(record.active){
    try {
      await notifyClass(cls,"New practice test",`${title} is now available for Class ${cls}.`,"practice");
    } catch (notifyError) {
      console.warn("Practice notification failed; test was saved successfully.", notifyError);
    }
  }
  msg(editingPracticeId?"Practice test updated.":"Practice test created and published.","success");
  resetPracticeEditor(); await loadPracticeAdmin();
}
function resetPracticeEditor(){
  editingPracticeId=""; practiceClass=Number($("#practiceClass")?.value||6); practiceQuestions=[];
  const form=$("#practiceFormAdmin"); form?.reset();
  if($("#practiceClass"))$("#practiceClass").value=String(practiceClass);
  if($("#practiceDuration"))$("#practiceDuration").value="10";
  if($("#practicePublish"))$("#practicePublish").checked=true;
  if($("#practiceCreatedAt"))$("#practiceCreatedAt").value=String(Date.now());
  resetQuestionComposer(); renderQuestionsList();
  const title=$("#practiceAdminMode"); if(title)title.textContent="CREATE PRACTICE";
  const btn=$("#practiceSaveBtn"); if(btn)btn.textContent="Save Practice Test";
}
async function loadPracticeAdmin(){
  if(!isAdmin())return;
  const list=$("#practiceAdminList"); if(!list)return;
  list.innerHTML='<div class="table-empty">Loading practice tests…</div>';
  try{
    const snap=await withTimeout(get(ref(database,"practiceCatalog")));
    const value=snap.val()||{}; const items=[];
    Object.entries(value).forEach(([ck,node])=>Object.entries(node||{}).forEach(([id,v])=>v&&items.push({id,...v})));
    items.sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));
    list.innerHTML=items.length?items.map(t=>`
      <article class="admin-feature-row">
        <div><strong>${esc(t.title)}</strong><small>Class ${Number(t.class)} • ${esc(SUBJECTS.find(s=>s.id===t.subject)?.label||t.subject)} • ${Array.isArray(t.questions)?t.questions.length:0} questions • ${Math.round(Number(t.durationSec||0)/60)} min</small></div>
        <div class="row-actions"><span class="status-pill ${t.active===false?"disabled":"active"}">${t.active===false?"Unpublished":"Published"}</span><button class="mini-action" data-practice-edit="${esc(t.id)}">Edit</button><button class="mini-action ${t.active===false?"success":""}" data-practice-toggle="${esc(t.id)}">${t.active===false?"Publish":"Unpublish"}</button><button class="mini-action danger" data-practice-delete="${esc(t.id)}">Delete</button></div>
      </article>`).join(""):'<div class="table-empty">No practice tests created yet.</div>';
    list.querySelectorAll("[data-practice-edit]").forEach(b=>b.addEventListener("click",()=>editPractice(items.find(x=>x.id===b.dataset.practiceEdit))));
    list.querySelectorAll("[data-practice-toggle]").forEach(b=>b.addEventListener("click",()=>togglePractice(items.find(x=>x.id===b.dataset.practiceToggle))));
    list.querySelectorAll("[data-practice-delete]").forEach(b=>b.addEventListener("click",()=>deletePractice(items.find(x=>x.id===b.dataset.practiceDelete))));
  }catch(e){list.innerHTML='<div class="table-empty">Practice tests could not be loaded.</div>';}
}
function editPractice(t){
  if(!t)return;
  editingPracticeId=t.id; practiceClass=Number(t.class); practiceQuestions=Array.isArray(t.questions)?JSON.parse(JSON.stringify(t.questions)):[];
  $("#practiceClass").value=String(t.class); $("#practiceSubject").value=t.subject; $("#practiceTitle").value=t.title||""; $("#practiceChapter").value=t.chapter||""; $("#practiceDuration").value=String(Math.round(Number(t.durationSec||0)/60)); $("#practicePublish").checked=t.active!==false; $("#practiceCreatedAt").value=String(t.createdAt||Date.now());
  $("#practiceAdminMode").textContent="EDIT PRACTICE"; $("#practiceSaveBtn").textContent="Save Changes"; renderQuestionsList();
  window.scrollTo({top:0,behavior:"smooth"});
}
async function togglePractice(t){
  if(!t)return;
  const next=t.active===false;
  if(!confirm(`${next?"Publish":"Unpublish"} “${t.title}”?`))return;
  const updated={...t,active:next,updatedAt:Date.now()};
  await withTimeout(update(ref(database),{[`practiceCatalog/class-${t.class}/${t.id}`]:updated,[`publishedPractice/class-${t.class}/${t.id}`]:next?updated:null}),15000);
  if(next)await notifyClass(t.class,"New practice test",`${t.title} is now available.`,"practice");
  await loadPracticeAdmin();
}
async function deletePractice(t){
  if(!t||!confirm(`Delete “${t.title}”?`))return;
  await withTimeout(update(ref(database),{[`practiceCatalog/class-${t.class}/${t.id}`]:null,[`publishedPractice/class-${t.class}/${t.id}`]:null}),15000);
  await loadPracticeAdmin();
}

async function loadAnnouncements(){
  const list=$("#announcementAdminList"); if(!list||!isAdmin())return;
  list.innerHTML='<div class="table-empty">Loading announcements…</div>';
  const snap=await withTimeout(get(ref(database,"announcements"))); const v=snap.val()||{};
  const items=Object.entries(v).map(([id,x])=>({id,...x})).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0));
  list.innerHTML=items.length?items.map(a=>`
    <article class="admin-feature-row">
      <div><strong>${esc(a.title)}</strong><small>${a.targetClass==="all"?"All classes":`Class ${Number(a.targetClass)}`} • ${esc(a.message||"")}</small></div>
      <div class="row-actions"><span class="status-pill ${a.active!==false?"active":"disabled"}">${a.active!==false?"Published":"Hidden"}</span><span class="status-pill priority-${esc(a.priority||"normal")}">${esc(a.priority||"normal")}</span><button class="mini-action" data-ann-edit="${esc(a.id)}">Edit</button><button class="mini-action ${a.active===false?"success":""}" data-ann-toggle="${esc(a.id)}">${a.active===false?"Publish":"Hide"}</button><button class="mini-action danger" data-ann-delete="${esc(a.id)}">Delete</button></div>
    </article>`).join(""):'<div class="table-empty">No announcements yet.</div>';
  list.querySelectorAll("[data-ann-edit]").forEach(b=>b.addEventListener("click",()=>editAnnouncement(items.find(x=>x.id===b.dataset.annEdit))));
  list.querySelectorAll("[data-ann-toggle]").forEach(b=>b.addEventListener("click",()=>toggleAnnouncement(items.find(x=>x.id===b.dataset.annToggle))));
  list.querySelectorAll("[data-ann-delete]").forEach(b=>b.addEventListener("click",()=>deleteAnnouncement(items.find(x=>x.id===b.dataset.annDelete))));
}
function editAnnouncement(a){
  $("#annId").value=a.id;
  $("#annTitle").value=a.title||"";
  $("#annClass").value=String(a.targetClass||"all");
  $("#annPriority").value=String(a.priority||"normal");
  $("#annMessage").value=a.message||"";
  $("#annPublish").checked=a.active!==false;
  $("#annCreatedAt").value=String(a.createdAt||Date.now());
  $("#annMode").textContent="EDIT ANNOUNCEMENT";
  $("#annSaveBtn").textContent="Save Changes";
}
async function saveAnnouncement(){
  const title=$("#annTitle").value.trim(), messageText=$("#annMessage").value.trim(), target=$("#annClass").value;
  if(title.length<2||messageText.length<2)throw new Error("Enter title and message.");
  const id=$("#annId").value||`ann-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const rec={id,title,message:messageText,targetClass:target||"all",priority:$("#annPriority")?.value||"normal",active:Boolean($("#annPublish").checked),createdAt:Number($("#annCreatedAt").value)||Date.now(),updatedAt:Date.now()};
  await withTimeout(update(ref(database),{[`announcements/${id}`]:rec}),15000);
  if(rec.active){
    try {
      if(target==="all"){
        const r=await listStudents(); const updates={};
        r.students.filter(s=>s.active!==false).forEach(s=>{const nid=`n-${Date.now()}-${Math.random().toString(36).slice(2,7)}-${k(s.uid).slice(-4)}`;updates[`notifications/${s.uid}/${nid}`]={title:rec.title,message:messageText,type:"announcement",priority:rec.priority||"normal",createdAt:Date.now(),read:false,targetClass:"all"};});
        if(Object.keys(updates).length)await withTimeout(update(ref(database),updates),15000);
      }else {
        await notifyClass(Number(target),rec.title,messageText,"announcement",rec.priority||"normal");
      }
    } catch (notifyError) {
      console.warn("Announcement notification failed; announcement was saved successfully.", notifyError);
    }
  }
  resetAnnouncement(); await loadAnnouncements(); msg("Announcement saved.","success");
}
function resetAnnouncement(){
  $("#announcementFormAdmin")?.reset();
  $("#annId").value=""; $("#annCreatedAt").value=String(Date.now()); $("#annPublish").checked=true;
  if($("#annPriority"))$("#annPriority").value="normal";
  $("#annMode").textContent="NEW ANNOUNCEMENT"; $("#annSaveBtn").textContent="Publish Announcement";
}
async function toggleAnnouncement(a){
  const next=a.active===false; if(!confirm(`${next?"Publish":"Hide"} “${a.title}”?`))return;
  const rec={...a,active:next,updatedAt:Date.now()};
  await withTimeout(update(ref(database),{[`announcements/${a.id}`]:rec}),15000);
  if(next){
    try {
      if(a.targetClass==="all"){
        const r=await listStudents();const updates={};
        r.students.filter(s=>s.active!==false).forEach(s=>{const nid=`n-${Date.now()}-${Math.random().toString(36).slice(2,7)}-${k(s.uid).slice(-4)}`;updates[`notifications/${s.uid}/${nid}`]={title:a.title,message:a.message,type:"announcement",priority:a.priority||"normal",createdAt:Date.now(),read:false,targetClass:"all"};});
        if(Object.keys(updates).length)await withTimeout(update(ref(database),updates),15000);
      } else {
        await notifyClass(Number(a.targetClass),a.title,a.message,"announcement",a.priority||"normal");
      }
    } catch (notifyError) {
      console.warn("Announcement notification failed after publish toggle.", notifyError);
    }
  }
  await loadAnnouncements();
}
async function deleteAnnouncement(a){if(!a||!confirm(`Delete “${a.title}”?`))return;await withTimeout(update(ref(database),{[`announcements/${a.id}`]:null}),15000);await loadAnnouncements();}

export function initAdminExtras(){
  if(!document.querySelector("#adminFeatureRoot"))return;
  $("#pqType")?.addEventListener("change",renderQuestionComposer);
  $("#addPracticeQuestionBtn")?.addEventListener("click",()=>{try{practiceQuestions.push(collectQuestion());resetQuestionComposer();renderQuestionsList();msg("Question added.","success");}catch(e){msg(e.message,"error");}});
  $("#practiceFormAdmin")?.addEventListener("submit",async e=>{e.preventDefault();try{await savePractice();}catch(err){msg(err.message||"Could not save practice test.","error");}});
  $("#practiceResetBtn")?.addEventListener("click",resetPracticeEditor);
  $("#announcementFormAdmin")?.addEventListener("submit",async e=>{e.preventDefault();try{await saveAnnouncement();}catch(err){msg(err.message||"Could not save announcement.","error");}});
  $("#announcementResetBtn")?.addEventListener("click",resetAnnouncement);
  document.querySelectorAll("[data-extra-admin-tab]").forEach(b=>b.addEventListener("click",()=>{
    const name=b.dataset.extraAdminTab;
    document.querySelectorAll(".admin-tab-panel").forEach(p=>p.hidden=true);
    document.querySelectorAll("[data-extra-admin-panel]").forEach(p=>p.hidden=p.dataset.extraAdminPanel!==name);
    document.querySelectorAll(".admin-tab").forEach(x=>x.classList.toggle("is-active",x===b));
    if(name==="practice")loadPracticeAdmin();
    if(name==="announcements")loadAnnouncements();
  }));
  document.querySelectorAll(".admin-tab[data-admin-tab]").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll("[data-extra-admin-panel]").forEach(p=>p.hidden=true);
  }));
  resetPracticeEditor(); resetAnnouncement();
}
