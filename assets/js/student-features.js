
import {
  get, ref, update, onValue
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { database } from "./firebase-init.js";
import { SUBJECTS } from "./catalog.js";

const stateRef = { get: () => null };
let initialized = false;
let notificationUnsubscribe = null;

function currentState(){ return stateRef.get() || {}; }
function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function keyify(v){ return String(v ?? "").replace(/[.#$\[\]/]/g, "_"); }
function withTimeout(promise, ms=12000){
  return Promise.race([promise, new Promise((_,r)=>setTimeout(()=>r(new Error("NETWORK_TIMEOUT")),ms))]);
}
function subjectLabel(id){ return SUBJECTS.find(s=>s.id===id)?.label || String(id||""); }
function whatsappUrl(text){
  return `https://wa.me/919124478453?text=${encodeURIComponent(text)}`;
}
function dateText(ts){
  const d = new Date(Number(ts)||0);
  if(Number.isNaN(d.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"}).format(d);
}
function todayDateInput(){
  const d=new Date(); const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,10);
}

let cache = {
  notifications: [],
  seen: {},
  attempts: [],
  plans: [],
  tests: [],
};

export function init(getState){
  if(initialized) return;
  stateRef.get=getState;
  initialized=true;
}

export function watchNotifications(uid){
  if(notificationUnsubscribe) { try{ notificationUnsubscribe(); }catch{} notificationUnsubscribe=null; }
  if(!uid) return;
  const node=ref(database,`notifications/${uid}`);
  notificationUnsubscribe=onValue(node,(snapshot)=>{
    const value=snapshot.val()||{};
    cache.notifications=Object.entries(value).map(([id,v])=>({id,...v})).filter(Boolean)
      .sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,30);
    window.dispatchEvent(new CustomEvent("evc-notifications-updated",{detail:{unread:unreadNotifications().length}}));
  },(error)=>console.warn("Notification listener failed:",error));
}

export function stopNotificationWatch(){
  if(notificationUnsubscribe){ try{notificationUnsubscribe();}catch{} notificationUnsubscribe=null; }
}

export async function loadNotifications(){
  const s=currentState();
  if(!s.user?.uid) return [];
  const snap=await withTimeout(get(ref(database,`notifications/${s.user.uid}`)));
  const value=snap.val()||{};
  cache.notifications=Object.entries(value).map(([id,v])=>({id,...v})).filter(Boolean).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,30);
  return cache.notifications;
}
export function unreadNotifications(){
  return cache.notifications.filter(x=>x.read!==true);
}
export async function markNotificationRead(id){
  const s=currentState(); if(!s.user?.uid||!id)return;
  await withTimeout(update(ref(database),{[`notifications/${s.user.uid}/${keyify(id)}/read`]:true}));
  const n=cache.notifications.find(x=>x.id===id); if(n)n.read=true;
}
export async function markAllNotificationsRead(){
  const s=currentState(); if(!s.user?.uid)return;
  const updates={};
  cache.notifications.filter(x=>x.read!==true).forEach(n=>updates[`notifications/${s.user.uid}/${keyify(n.id)}/read`]=true);
  if(Object.keys(updates).length) await withTimeout(update(ref(database),updates));
  cache.notifications.forEach(n=>n.read=true);
}
export async function enableNotifications(){
  if(!("Notification" in window)) throw new Error("NOTIFICATION_UNSUPPORTED");
  const result=await Notification.requestPermission();
  if(result!=="granted") throw new Error("NOTIFICATION_DENIED");
  return true;
}

export async function loadMaterialSeen(){
  const s=currentState(); if(!s.user?.uid) return {};
  const snap=await withTimeout(get(ref(database,`materialSeen/${s.user.uid}`)));
  cache.seen=snap.val()||{};
  return cache.seen;
}
export function isMaterialNew(material){
  if(!material?.id || !material?.createdAt) return false;
  const seen=Number(cache.seen?.[material.id]||0);
  const age=Date.now()-Number(material.createdAt||0);
  return seen < Number(material.createdAt||0) && age <= 14*24*60*60*1000;
}
export async function markMaterialSeen(materialId){
  const s=currentState(); if(!s.user?.uid||!materialId)return;
  const now=Date.now();
  cache.seen[materialId]=now;
  try{
    await withTimeout(update(ref(database),{[`materialSeen/${s.user.uid}/${keyify(materialId)}`]:now}),9000);
  }catch(e){ console.warn("materialSeen save failed",e); }
}

export async function loadAttempts(){
  const s=currentState(); if(!s.user?.uid)return [];
  const snap=await withTimeout(get(ref(database,`practiceAttempts/${s.user.uid}`)));
  const value=snap.val()||{};
  cache.attempts=Object.entries(value).map(([id,v])=>({id,...v})).filter(Boolean).sort((a,b)=>Number(b.submittedAt||0)-Number(a.submittedAt||0));
  return cache.attempts;
}

export async function loadPracticeTests(classNumber, subjectId=""){
  const s=currentState();
  if(Number(classNumber)!==Number(s.assignedClass)) throw new Error("CLASS_NOT_ALLOWED");
  const snap=await withTimeout(get(ref(database,`publishedPractice/class-${Number(classNumber)}`)));
  const value=snap.val()||{};
  cache.tests=Object.entries(value).map(([id,v])=>({id,...v}))
    .filter(v=>v && v.active!==false && (!subjectId || v.subject===subjectId))
    .sort((a,b)=>(Number(b.updatedAt||0)-Number(a.updatedAt||0))||String(a.title||"").localeCompare(String(b.title||"")));
  return cache.tests;
}
export async function loadPracticeTest(classNumber,subjectId,testId){
  const tests=await loadPracticeTests(classNumber,subjectId);
  return tests.find(x=>x.id===String(testId))||null;
}

function questionScore(question, answer){
  const type=question?.type||"mcq";
  if(answer===null||answer===undefined||String(answer).trim()==="") return 0;
  if(type==="mcq"||type==="truefalse") return String(answer).trim()===String(question.answer??"").trim() ? Number(question.marks||1) : 0;
  const accepted=Array.isArray(question.acceptedAnswers)?question.acceptedAnswers:[String(question.answer??"")];
  const normal=String(answer).trim().toLowerCase();
  return accepted.some(a=>String(a).trim().toLowerCase()===normal) ? Number(question.marks||1) : 0;
}

export async function submitPractice(test, answers, startedAt, forced=false){
  const s=currentState(); if(!s.user?.uid) throw new Error("AUTH_REQUIRED");
  const questions=Array.isArray(test.questions)?test.questions:[];
  let correct=0,score=0,unanswered=0;
  const cleanAnswers={};
  questions.forEach((q,i)=>{
    const value=answers?.[i] ?? "";
    cleanAnswers[i]=String(value);
    if(String(value).trim()===""){ unanswered++; return; }
    const earned=questionScore(q,value);
    score+=earned; if(earned>0) correct++;
  });
  const total=questions.reduce((sum,q)=>sum+Number(q.marks||1),0);
  const attempted=questions.length-unanswered;
  const wrong=Math.max(0,attempted-correct);
  const timeLimit=Number(test.durationSec||0);
  const elapsed=Math.max(0,Math.round((Date.now()-Number(startedAt||Date.now()))/1000));
  const timeTakenSec=Math.min(timeLimit>0?timeLimit:elapsed,elapsed);
  const attemptId=`a-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const record={
    testId:test.id,title:test.title||"Practice Test",subject:test.subject||"",chapter:test.chapter||"",
    score,total,percentage:total?Number((score/total*100).toFixed(2)):0,correct,wrong,unanswered,
    timeTakenSec,forced:Boolean(forced),submittedAt:Date.now(),answers:cleanAnswers
  };
  await withTimeout(update(ref(database),{[`practiceAttempts/${s.user.uid}/${attemptId}`]:record}),12000);
  cache.attempts.unshift({id:attemptId,...record});
  return {id:attemptId,...record};
}

export async function loadPlans(){
  const s=currentState(); if(!s.user?.uid)return [];
  const snap=await withTimeout(get(ref(database,`studyPlans/${s.user.uid}`)));
  const value=snap.val()||{};
  cache.plans=Object.entries(value).map(([id,v])=>({id,...v})).filter(Boolean)
    .sort((a,b)=>(a.completed?1:0)-(b.completed?1:0)||String(a.dueDate||"9999").localeCompare(String(b.dueDate||"9999")));
  return cache.plans;
}
export async function addPlan({title,subject,dueDate,notes}){
  const s=currentState(); if(!s.user?.uid)throw new Error("AUTH_REQUIRED");
  if(String(title||"").trim().length<2)throw new Error("INVALID_PLAN_TITLE");
  const id=`p-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const record={title:String(title).trim(),subject:String(subject||""),dueDate:String(dueDate||""),notes:String(notes||"").trim(),completed:false,createdAt:Date.now(),updatedAt:Date.now()};
  await withTimeout(update(ref(database),{[`studyPlans/${s.user.uid}/${id}`]:record}));
  return {id,...record};
}
export async function togglePlan(id, completed){
  const s=currentState(); if(!s.user?.uid||!id)return;
  await withTimeout(update(ref(database),{[`studyPlans/${s.user.uid}/${keyify(id)}/completed`]:Boolean(completed),[`studyPlans/${s.user.uid}/${keyify(id)}/updatedAt`]:Date.now()}));
}
export async function deletePlan(id){
  const s=currentState(); if(!s.user?.uid||!id)return;
  await withTimeout(update(ref(database),{[`studyPlans/${s.user.uid}/${keyify(id)}`]:null}));
}

export function renderHomeWidgets({announcementsEl,notificationsEl,homeActionsEl}){
  const unread=unreadNotifications();
  if(notificationsEl){
    notificationsEl.innerHTML=unread.length?unread.slice(0,3).map(n=>`
      <button class="feature-row" type="button" data-feature-action="read-notification" data-id="${escapeHtml(n.id)}">
        <span class="feature-icon">🔔</span>
        <span><strong>${escapeHtml(n.title||"Notification")}</strong><small>${escapeHtml(n.message||"")}</small></span>
        <span class="feature-arrow">→</span>
      </button>`).join(""):`<div class="feature-empty">No new notifications.</div>`;
  }
  if(homeActionsEl){
    homeActionsEl.innerHTML=`
      <button class="feature-action-card" type="button" data-action="open-performance"><span>📊</span><div><strong>My Performance</strong><small>Practice scores and attempts</small></div><b>→</b></button>
      <button class="feature-action-card" type="button" data-action="open-planner"><span>📅</span><div><strong>Study Planner</strong><small>Plan what to study next</small></div><b>→</b></button>`;
  }
  if(announcementsEl){
    // populated by renderAnnouncements
  }
}

export async function renderAnnouncements(el){
  const s=currentState(); if(!el||!s.user?.uid)return;
  try{
    const snap=await withTimeout(get(ref(database,"announcements")));
    const value=snap.val()||{};
    const items=Object.entries(value).map(([id,v])=>({id,...v}))
      .filter(v=>v&&v.active!==false&&(!v.targetClass||v.targetClass==="all"||Number(v.targetClass)===Number(s.assignedClass)))
      .sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,5);
    el.innerHTML=items.length?items.map(v=>`
      <article class="announcement-card">
        <div class="announcement-icon">📢</div>
        <div><strong>${escapeHtml(v.title||"Announcement")}</strong><p>${escapeHtml(v.message||"")}</p><small>${escapeHtml(dateText(v.createdAt))}</small></div>
      </article>`).join(""):`<div class="feature-empty">No announcements right now.</div>`;
  }catch(e){
    el.innerHTML=`<div class="feature-empty">Announcements could not be loaded. Please retry.</div>`;
  }
}

export async function renderNotificationsRoute({rootEl}){
  await loadNotifications();
  const unread=unreadNotifications();
  const enabled=areNotificationsEnabled();
  rootEl.innerHTML=`
    <div class="feature-toolbar"><div><p class="eyebrow">ALERTS</p><h2>Notifications</h2></div>
      <div class="feature-toolbar-actions">
        <button class="secondary-button" data-feature-action="enable-notifications" ${enabled?"disabled":""}>${enabled?"Enabled":"Enable"}</button>
        ${unread.length?`<button class="outline-button" data-feature-action="mark-all-read">Mark all read</button>`:""}
      </div>
    </div>
    <div class="feature-list">
      ${cache.notifications.length?cache.notifications.map(n=>`
        <article class="notification-card ${n.read===true?"is-read":""}">
          <div class="notification-icon">${n.type==="announcement"?"📢":n.type==="practice"?"📝":"🆕"}</div>
          <div class="notification-copy"><strong>${escapeHtml(n.title||"Notification")}</strong><p>${escapeHtml(n.message||"")}</p><small>${escapeHtml(dateText(n.createdAt))}</small></div>
          ${n.read===true?`<span class="notification-read">Read</span>`:`<button class="mini-action notification-read-btn" type="button" data-feature-action="read-notification" data-id="${escapeHtml(n.id)}">Mark as read</button>`}
        </article>`).join(""):`<div class="feature-empty">You have no notifications yet.</div>`}
    </div>`;
  rootEl.querySelectorAll('[data-feature-action="read-notification"]').forEach((button)=>button.addEventListener("click", async (event)=>{
    event.preventDefault();
    event.stopPropagation();
    if(button.disabled) return;
    button.disabled=true;
    try { await markNotificationRead(button.dataset.id); await renderNotificationsRoute({rootEl}); }
    catch (error) { console.error("Notification read failed", error); button.disabled=false; alert("Could not mark this notification as read. Please retry."); }
  }));
  rootEl.querySelectorAll('[data-feature-action="mark-all-read"]').forEach((button)=>button.addEventListener("click", async (event)=>{
    event.preventDefault();
    event.stopPropagation();
    if(button.disabled) return;
    button.disabled=true;
    try { await markAllNotificationsRead(); await renderNotificationsRoute({rootEl}); }
    catch (error) { console.error("Mark all read failed", error); button.disabled=false; alert("Could not mark notifications as read. Please retry."); }
  }));
  rootEl.querySelectorAll('[data-feature-action="enable-notifications"]').forEach((button)=>button.addEventListener("click", async (event)=>{
    event.preventDefault();
    event.stopPropagation();
    if(button.disabled) return;
    button.disabled=true;
    try { await enableNotifications(); await renderNotificationsRoute({rootEl}); }
    catch (error) { button.disabled=false; alert(error.message==="NOTIFICATION_UNSUPPORTED"?"This browser does not support notifications.":error.message==="NOTIFICATION_DENIED"?"Notification permission was not granted. Please allow notifications in browser settings.":"Notifications could not be enabled. Please try again."); }
  }));
}

export async function renderPerformance({rootEl}){
  await loadAttempts();
  const attempts=cache.attempts;
  const totalAttempts=attempts.length;
  const avg=totalAttempts?Number((attempts.reduce((s,a)=>s+Number(a.percentage||0),0)/totalAttempts).toFixed(1)):0;
  const best=totalAttempts?Math.max(...attempts.map(a=>Number(a.percentage||0))):0;
  const passed=attempts.filter(a=>Number(a.percentage||0)>=40).length;
  rootEl.innerHTML=`
    <div class="feature-toolbar"><div><p class="eyebrow">YOUR RESULTS</p><h2>My Performance</h2><p class="muted">Practice test results saved to your student account.</p></div></div>
    <div class="performance-grid">
      <div class="perf-stat card"><span>Total Attempts</span><strong>${totalAttempts}</strong></div>
      <div class="perf-stat card"><span>Average Score</span><strong>${avg}%</strong></div>
      <div class="perf-stat card"><span>Best Score</span><strong>${best}%</strong></div>
      <div class="perf-stat card"><span>Passing Attempts</span><strong>${passed}</strong></div>
    </div>
    <section class="card performance-table" aria-labelledby="attemptHistoryTitle">
      <div class="performance-table-head">
        <div><p class="eyebrow">HISTORY</p><h3 id="attemptHistoryTitle">Attempt History</h3><p class="muted">Your latest practice attempts.</p></div>
      </div>
      ${attempts.length?`<div class="perf-list">${attempts.slice(0,30).map((a,idx)=>`
        <article class="perf-row">
          <div class="perf-attempt-info">
            <strong>${escapeHtml(a.title||"Practice Test")}</strong>
            <small>${escapeHtml(subjectLabel(a.subject))} • ${escapeHtml(dateText(a.submittedAt))}</small>
          </div>
          <div class="perf-score" aria-label="Score ${Number(a.score||0)} out of ${Number(a.total||0)}">
            <strong>${Number(a.score||0)}/${Number(a.total||0)}</strong>
            <span>${Number(a.percentage||0)}%</span>
          </div>
        </article>`).join("")}</div>`:`<div class="feature-empty">Complete a practice test and your results will appear here.</div>`}
    </section>`;
}

export async function renderPlanner({rootEl}){
  await loadPlans();
  rootEl.innerHTML=`
    <div class="feature-toolbar"><div><p class="eyebrow">PLAN AHEAD</p><h2>Study Planner</h2><p class="muted">Keep your next study tasks in one place.</p></div></div>
    <form id="studentPlanForm" class="card planner-form">
      <label class="field"><span>What will you study?</span><input id="planTitle" required maxlength="120" placeholder="e.g. Revise Nationalism"></label>
      <div class="form-grid-two">
        <label class="field"><span>Subject</span><select id="planSubject"><option value="">Choose subject</option>${SUBJECTS.map(s=>`<option value="${s.id}">${escapeHtml(s.label)}</option>`).join("")}</select></label>
        <label class="field"><span>Due date</span><input id="planDueDate" type="date" value="${todayDateInput()}"></label>
      </div>
      <label class="field"><span>Notes (optional)</span><textarea id="planNotes" maxlength="300" placeholder="Small reminder"></textarea></label>
      <div id="planMessage" class="inline-message"></div>
      <button class="primary-button full-width" type="submit">Add Study Task</button>
    </form>
    <div class="planner-list">
      ${cache.plans.length?cache.plans.map(p=>`
        <article class="plan-row card ${p.completed?"is-complete":""}">
          <label class="plan-check"><input type="checkbox" data-plan-toggle="${escapeHtml(p.id)}" ${p.completed?"checked":""}><span></span></label>
          <div class="plan-copy"><strong>${escapeHtml(p.title)}</strong><small>${escapeHtml(subjectLabel(p.subject))}${p.dueDate?` • Due ${escapeHtml(p.dueDate)}`:""}</small>${p.notes?`<p>${escapeHtml(p.notes)}</p>`:""}</div>
          <button class="mini-action danger" type="button" data-plan-delete="${escapeHtml(p.id)}">Delete</button>
        </article>`).join(""):`<div class="feature-empty">No study tasks yet. Add your first one above.</div>`}
    </div>`;
  document.querySelector("#studentPlanForm")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const f=e.currentTarget;
    const msg=document.querySelector("#planMessage");
    try{
      const item=await addPlan({title:document.querySelector("#planTitle").value,subject:document.querySelector("#planSubject").value,dueDate:document.querySelector("#planDueDate").value,notes:document.querySelector("#planNotes").value});
      cache.plans.unshift(item);
      await renderPlanner({rootEl});
    }catch(err){msg.textContent=err.message==="INVALID_PLAN_TITLE"?"Enter a study task.":"Could not save this task.";msg.dataset.type="error";}
  });
  rootEl.querySelectorAll("[data-plan-toggle]").forEach(box=>box.addEventListener("change",async()=>{await togglePlan(box.dataset.planToggle,box.checked);await renderPlanner({rootEl});}));
  rootEl.querySelectorAll("[data-plan-delete]").forEach(btn=>btn.addEventListener("click",async()=>{if(!confirm("Delete this study task?"))return;await deletePlan(btn.dataset.planDelete);await renderPlanner({rootEl});}));
}

export async function renderPracticeList({rootEl,classNumber,subjectId}){
  rootEl.innerHTML=`<div class="feature-toolbar"><div><p class="eyebrow">PRACTICE</p><h2>${escapeHtml(subjectLabel(subjectId))} Practice</h2><p class="muted">Answer questions, beat the timer and get your score instantly.</p></div></div><div id="practiceListInner">${`<div class="feature-empty">Loading practice tests…</div>`}</div>`;
  try{
    const tests=await loadPracticeTests(classNumber,subjectId);
    const inner=rootEl.querySelector("#practiceListInner");
    inner.innerHTML=tests.length?tests.map(t=>`
      <button class="practice-test-card card" type="button" data-action="open-practice-test" data-class-number="${Number(classNumber)}" data-subject-id="${escapeHtml(subjectId)}" data-test-id="${escapeHtml(t.id)}">
        <span class="practice-test-icon">📝</span><div><strong>${escapeHtml(t.title||"Practice Test")}</strong><small>${escapeHtml(t.chapter||"General")} • ${Array.isArray(t.questions)?t.questions.length:0} questions • ${Math.max(1,Math.round(Number(t.durationSec||0)/60))} min</small></div><b>→</b>
      </button>`).join(""):`<div class="feature-empty">No practice tests have been published for this subject yet.</div>`;
  }catch(e){rootEl.querySelector("#practiceListInner").innerHTML=`<div class="feature-empty">Practice tests could not be loaded. Check your connection and retry.</div>`;}
}

let activeTest=null;
let activeAnswers={};
let activeStartedAt=0;
let activeTimer=null;
let activeSubmitting=false;

export async function renderPracticeTest({rootEl,classNumber,subjectId,testId,goBack}){
  clearInterval(activeTimer);
  rootEl.innerHTML=`<div class="feature-empty">Loading practice test…</div>`;
  try{
    const test=await loadPracticeTest(classNumber,subjectId,testId);
    if(!test) throw new Error("TEST_NOT_FOUND");
    activeTest=test; activeAnswers={}; activeStartedAt=Date.now(); activeSubmitting=false;
    rootEl.innerHTML=`
      <div class="practice-header card"><div><p class="eyebrow">TIMED PRACTICE</p><h2>${escapeHtml(test.title||"Practice Test")}</h2><p class="muted">${escapeHtml(test.chapter||subjectLabel(test.subject))}</p></div><div class="practice-timer" id="practiceTimer">--:--</div></div>
      <form id="practiceForm" class="practice-form">
        ${(test.questions||[]).map((q,i)=>renderQuestion(q,i)).join("")}
        <button id="practiceSubmitBtn" class="primary-button full-width" type="submit">Submit Practice</button>
      </form>
      <div id="practiceResult"></div>`;
    startTimer(test,rootEl);
    rootEl.querySelector("#practiceForm").addEventListener("submit",async e=>{e.preventDefault();await finalizePractice(false,rootEl,goBack);});
  }catch(e){
    rootEl.innerHTML=`<div class="feature-empty">${e.message==="TEST_NOT_FOUND"?"Practice test not found or unpublished.":"Could not load this practice test."}</div>`;
  }
}
function renderQuestion(q,i){
  const type=q.type||"mcq";
  const marks=Number(q.marks||1);
  const meta=`<div class="practice-question-head"><span class="practice-q-number">Q${i+1}</span><span class="practice-q-marks">${marks} mark${marks===1?"":"s"}</span></div>`;
  if(type==="mcq"){
    const opts=Array.isArray(q.options)?q.options:[];
    return `<fieldset class="practice-question card"><legend>${meta}<span class="practice-prompt">${escapeHtml(q.prompt||"Question")}</span></legend><div class="answer-options">${opts.map((o,j)=>`<label class="answer-option"><input type="radio" name="q-${i}" value="${escapeHtml(String(j))}"><span class="answer-option-text"><b>${String.fromCharCode(65+j)}</b>${escapeHtml(o)}</span></label>`).join("")}</div></fieldset>`;
  }
  if(type==="truefalse") return `<fieldset class="practice-question card"><legend>${meta}<span class="practice-prompt">${escapeHtml(q.prompt||"Question")}</span></legend><div class="answer-options"><label class="answer-option"><input type="radio" name="q-${i}" value="true"><span class="answer-option-text">True</span></label><label class="answer-option"><input type="radio" name="q-${i}" value="false"><span class="answer-option-text">False</span></label></div></fieldset>`;
  return `<div class="practice-question card"><div class="practice-question-head"><span class="practice-q-number">Q${i+1}</span><span class="practice-q-marks">${marks} mark${marks===1?"":"s"}</span></div><div class="practice-prompt">${escapeHtml(q.prompt||"Question")}</div><input class="practice-text-answer" data-q-index="${i}" type="text" autocomplete="off" placeholder="Type your answer"></div>`;
}
function collectAnswers(rootEl){
  const answers={};
  (activeTest?.questions||[]).forEach((q,i)=>{
    const choice=rootEl.querySelector(`[name="q-${i}"]:checked`);
    if(choice) answers[i]=choice.value;
    else {
      const input=rootEl.querySelector(`[data-q-index="${i}"]`);
      answers[i]=input?.value||"";
    }
  });
  return answers;
}
function startTimer(test,rootEl){
  const timer=rootEl.querySelector("#practiceTimer");
  const limit=Math.max(0,Number(test.durationSec||0));
  if(!limit){timer.textContent="No time limit";return;}
  const tick=()=>{
    const elapsed=Math.floor((Date.now()-activeStartedAt)/1000);
    const left=Math.max(0,limit-elapsed);
    timer.textContent=`${String(Math.floor(left/60)).padStart(2,"0")}:${String(left%60).padStart(2,"0")}`;
    if(left<=0){ clearInterval(activeTimer); activeTimer=null; void finalizePractice(true,rootEl); }
  };
  tick(); activeTimer=setInterval(tick,1000);
}
async function finalizePractice(forced,rootEl,goBack){
  if(!activeTest || activeSubmitting) return;
  activeSubmitting=true;
  clearInterval(activeTimer); activeTimer=null;
  rootEl.querySelectorAll("input,button").forEach(x=>x.disabled=true);
  try{
    const result=await submitPractice(activeTest,collectAnswers(rootEl),activeStartedAt,forced);
    rootEl.querySelector("#practiceResult").innerHTML=`
      <section class="score-card card">
        <p class="eyebrow">RESULT</p><h2>${forced?"Time's Up! ":""}${escapeHtml(activeTest.title||"Practice Test")}</h2>
        <div class="score-main"><strong>${Number(result.score||0)}/${Number(result.total||0)}</strong><span>${Number(result.percentage||0)}%</span></div>
        <div class="score-grid"><div><span>Correct</span><strong>${result.correct}</strong></div><div><span>Wrong</span><strong>${result.wrong}</strong></div><div><span>Unanswered</span><strong>${result.unanswered}</strong></div><div><span>Time</span><strong>${Math.floor(result.timeTakenSec/60)}m ${result.timeTakenSec%60}s</strong></div></div>
        <div class="dialog-actions"><button class="primary-button" type="button" data-practice-retake>Retake</button><button class="secondary-button" type="button" data-practice-back>Back to Practice</button></div>
      </section>`;
    rootEl.querySelector("[data-practice-retake]")?.addEventListener("click",()=>{void renderPracticeTest({rootEl,classNumber:activeTest.class,subjectId:activeTest.subject,testId:activeTest.id,goBack});});
    rootEl.querySelector("[data-practice-back]")?.addEventListener("click",()=>goBack?.());
  }catch(e){
    activeSubmitting=false;
    rootEl.querySelector("#practiceResult").innerHTML=`<div class="feature-empty">Your result could not be saved. Please retry.</div>`;
    rootEl.querySelectorAll("input,button").forEach(x=>x.disabled=false);
  }
}

export async function handleFeatureAction(action,id,renderContext){
  if(action==="read-notification"){ await markNotificationRead(id); if(renderContext) await renderNotificationsRoute(renderContext); }
  if(action==="mark-all-read"){ await markAllNotificationsRead(); if(renderContext) await renderNotificationsRoute(renderContext); }
  if(action==="enable-notifications"){ try{await enableNotifications();alert("Notifications enabled for this device.");}catch(e){alert(e.message==="NOTIFICATION_UNSUPPORTED"?"This browser does not support notifications.":"Notification permission was not granted.");} }
}
