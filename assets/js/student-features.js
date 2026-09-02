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
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;" }[c]));
}
function keyify(v){ return String(v ?? "").replace(/[.#$\[\]/]/g, "_"); }
function withTimeout(promise, ms=12000){
  return Promise.race([promise, new Promise((_,r)=>setTimeout(()=>r(new Error("NETWORK_TIMEOUT")),ms))]);
}
function subjectLabel(id){ return SUBJECTS.find(s=>s.id===id)?.label || String(id||""); }
function dateText(ts){
  const d = new Date(Number(ts)||0);
  if(Number.isNaN(d.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"}).format(d);
}
function shortDate(ts){
  const d = new Date(Number(ts)||0);
  if(Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short"}).format(d);
}
function todayDateInput(){
  const d=new Date(); const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,10);
}
function notificationIcon(type){
  if(type==="announcement") return "📢";
  if(type==="practice") return "📝";
  if(type==="material") return "📚";
  return "🔔";
}
function areNotificationsEnabled(){
  return "Notification" in window && Notification.permission === "granted";
}
function browserAlertsEnabled(){
  try { return localStorage.getItem("evc-browser-alerts")==="1" && areNotificationsEnabled(); } catch { return areNotificationsEnabled(); }
}

let cache = {
  notifications: [],
  announcements: [],
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
  let knownIds=new Set(cache.notifications.map(n=>n.id));
  notificationUnsubscribe=onValue(node,(snapshot)=>{
    const value=snapshot.val()||{};
    const next=Object.entries(value).map(([id,v])=>({id,...v})).filter(Boolean)
      .sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,50);
    const fresh=next.filter(n=>!knownIds.has(n.id) && n.read!==true);
    knownIds=new Set(next.map(n=>n.id));
    cache.notifications=next;
    if(browserAlertsEnabled() && document.visibilityState !== "visible" && fresh.length){
      fresh.slice(0,3).forEach(n=>{
        try{
          const note=new Notification(n.title||"EZEE VISION CHAMPUA",{
            body:n.message||"You have a new update.",
            icon:"./assets/images/icon-192.png",
            tag:`evc-${n.id}`,
          });
          note.onclick=()=>{ try{ window.focus(); }catch{}; location.hash="#notifications"; note.close(); };
        }catch{}
      });
    }
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
  cache.notifications=Object.entries(value).map(([id,v])=>({id,...v})).filter(Boolean)
    .sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,50);
  return cache.notifications;
}
export function unreadNotifications(){ return cache.notifications.filter(x=>x.read!==true); }
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
  if(!( "Notification" in window)) throw new Error("NOTIFICATION_UNSUPPORTED");
  const result=await Notification.requestPermission();
  if(result!=="granted") throw new Error("NOTIFICATION_DENIED");
  try { localStorage.setItem("evc-browser-alerts","1"); } catch {}
  return true;
}

async function loadAnnouncementsData(){
  const s=currentState();
  if(!s.user?.uid) return [];
  try {
    const snap=await withTimeout(get(ref(database,"announcements")));
    const value=snap.val()||{};
    cache.announcements=Object.entries(value).map(([id,v])=>({id,...v}))
      .filter(v=>v&&v.active!==false&&(!v.targetClass||v.targetClass==="all"||Number(v.targetClass)===Number(s.assignedClass)))
      .sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,30);
    return cache.announcements;
  } catch (error) {
    const fallback=cache.notifications
      .filter(n=>n?.type==="announcement" && n.active!==false)
      .map(n=>({id:String(n.id),title:n.title||"Announcement",message:n.message||"",priority:n.priority||"normal",createdAt:n.createdAt||0,targetClass:n.targetClass ?? "all",active:true}))
      .filter(v=>!v.targetClass||v.targetClass==="all"||Number(v.targetClass)===Number(s.assignedClass))
      .sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,30);
    cache.announcements=fallback;
    console.warn("Standalone announcements read unavailable; using notification fallback.", error);
    return cache.announcements;
  }
}
export async function loadAnnouncements(){ return loadAnnouncementsData(); }

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
  try{ await withTimeout(update(ref(database),{[`materialSeen/${s.user.uid}/${keyify(materialId)}`]:now}),9000); }
  catch(e){ console.warn("materialSeen save failed",e); }
}

export async function loadAttempts(){
  const s=currentState(); if(!s.user?.uid)return [];
  const snap=await withTimeout(get(ref(database,`practiceAttempts/${s.user.uid}`)));
  const value=snap.val()||{};
  cache.attempts=Object.entries(value).map(([id,v])=>({id,...v})).filter(Boolean)
    .sort((a,b)=>Number(b.submittedAt||0)-Number(a.submittedAt||0));
  return cache.attempts;
}

export async function loadPracticeTests(classNumber, subjectId=""){
  const s=currentState();
  if(Number(classNumber)!==Number(s.assignedClass)) throw new Error("CLASS_NOT_ALLOWED");
  const snap=await withTimeout(get(ref(database,`publishedPractice/class-${Number(classNumber)}`)));
  const value=snap.val()||{};
  const direct=[]; const nested=[];
  Object.entries(value).forEach(([id,v])=>{
    if(v&&typeof v==="object"&&Array.isArray(v.questions)) direct.push({id,...v});
    else if(v&&typeof v==="object") Object.entries(v).forEach(([nestedId,nestedValue])=>{ if(nestedValue&&typeof nestedValue==="object") nested.push({id:String(nestedId),...nestedValue}); });
  });
  cache.tests=[...direct,...nested]
    .filter(v=>v&&v.active!==false&&(!subjectId||v.subject===subjectId))
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
  const normal=String(answer).trim().toLowerCase().replace(/\s+/g," ");
  return accepted.some(a=>String(a).trim().toLowerCase().replace(/\s+/g," ")===normal) ? Number(question.marks||1) : 0;
}

export async function submitPractice(test, answers, startedAt, forced=false){
  const s=currentState(); if(!s.user?.uid) throw new Error("AUTH_REQUIRED");
  const questions=Array.isArray(test.questions)?test.questions:[];
  let correct=0,score=0,unanswered=0;
  const cleanAnswers={};
  const questionResults=[];
  questions.forEach((q,i)=>{
    const value=answers?.[i] ?? "";
    cleanAnswers[i]=String(value);
    if(String(value).trim()===""){
      unanswered++;
      questionResults.push({index:i,correct:false,answered:false,earned:0});
      return;
    }
    const earned=questionScore(q,value);
    score+=earned;
    const isCorrect=earned>0;
    if(isCorrect) correct++;
    questionResults.push({index:i,correct:isCorrect,answered:true,earned});
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
    attempted,timeTakenSec,forced:Boolean(forced),submittedAt:Date.now(),answers:cleanAnswers
  };
  await withTimeout(update(ref(database),{[`practiceAttempts/${s.user.uid}/${attemptId}`]:record}),12000);
  cache.attempts.unshift({id:attemptId,...record});
  return {...record,id:attemptId,questionResults};
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


function priorityMeta(priority){
  const p=String(priority||"normal").toLowerCase();
  if(p==="urgent") return {label:"Urgent", cls:"is-urgent"};
  if(p==="important") return {label:"Important", cls:"is-important"};
  return {label:"Update", cls:"is-normal"};
}
function announcementCard(v,compact=false){
  const priority=priorityMeta(v.priority);
  return `<button class="announcement-card premium-announcement-card ${compact?"announcement-card-compact":""}" type="button" data-action="open-announcement" data-announcement-id="${escapeHtml(v.id)}">
    <span class="announcement-icon premium-update-icon">📢</span>
    <span class="announcement-copy">
      <span class="update-card-topline"><span class="update-badge ${priority.cls}">${escapeHtml(priority.label)}</span><small>${escapeHtml(shortDate(v.createdAt))}</small></span>
      <strong>${escapeHtml(v.title||"Announcement")}</strong>
      <span>${escapeHtml(v.message||"")}</span>
      <small>${v.targetClass&&v.targetClass!=="all"?`Class ${escapeHtml(v.targetClass)}`:"All classes"}</small>
    </span>
    <b class="announcement-arrow">→</b>
  </button>`;
}
function notificationCard(n){
  const priority=priorityMeta(n.priority);
  return `<article class="notification-card premium-notification-card ${n.read===true?"is-read":""} ${priority.cls}">
    <div class="notification-icon">${notificationIcon(n.type)}</div>
    <div class="notification-copy">
      <div class="notification-title-line">
        <strong>${escapeHtml(n.title||"Notification")}</strong>
        ${n.read!==true?`<span class="notification-unread-dot" title="Unread"></span>`:""}
      </div>
      <p>${escapeHtml(n.message||"")}</p>
      <div class="notification-meta-row"><small>${escapeHtml(dateText(n.createdAt))}</small><span class="update-badge ${priority.cls}">${escapeHtml(priority.label)}</span></div>
    </div>
    ${n.read===true?`<span class="notification-read">Read</span>`:`<button class="mini-action notification-read-btn" type="button" data-feature-action="read-notification" data-id="${escapeHtml(n.id)}">Mark read</button>`}
  </article>`;
}

export function renderHomeWidgets({announcementsEl,notificationsEl,homeActionsEl}){
  if(announcementsEl){
    const items=cache.announcements||[];
    announcementsEl.innerHTML=items.length
      ? `<div class="home-update-label"><span>📢 Latest announcement</span><button type="button" class="link-button" data-action="open-notifications">View all</button></div>${items.slice(0,2).map(v=>announcementCard(v,true)).join("")}`
      : `<div class="feature-empty home-update-empty">No announcements right now.</div>`;
  }
  if(notificationsEl){
    const unread=unreadNotifications();
    notificationsEl.innerHTML=unread.length
      ? `<div class="home-update-label"><span>🔔 Your alerts <b class="home-unread-pill">${unread.length}</b></span><button type="button" class="link-button" data-action="open-notifications">View all</button></div>${unread.slice(0,2).map(n=>`<button class="feature-row premium-home-alert" type="button" data-feature-action="read-notification" data-id="${escapeHtml(n.id)}"><span class="feature-icon">${notificationIcon(n.type)}</span><span><strong>${escapeHtml(n.title||"Notification")}</strong><small>${escapeHtml(n.message||"")}</small><em>${escapeHtml(shortDate(n.createdAt))}</em></span><span class="feature-arrow">→</span></button>`).join("")}`
      : `<div class="home-update-label"><span>🔔 Your alerts</span><button type="button" class="link-button" data-action="open-notifications">Open alerts</button></div><div class="feature-empty home-update-empty">You're all caught up.</div>`;
  }
  if(homeActionsEl){
    const attempts=cache.attempts||[];
    const best=attempts.length?Math.max(...attempts.map(a=>Number(a.percentage||0))):0;
    homeActionsEl.innerHTML=`
      <button class="feature-action-card premium-feature-card" type="button" data-action="open-performance"><span>📊</span><div><strong>My Performance</strong><small>${attempts.length?`${attempts.length} attempt${attempts.length===1?"":"s"} • Best ${best}%`:`Track your practice progress`}</small></div><b>→</b></button>
      <button class="feature-action-card premium-feature-card" type="button" data-action="open-planner"><span>📅</span><div><strong>Study Planner</strong><small>Plan, track and complete your next tasks</small></div><b>→</b></button>`;
  }
}
export async function renderAnnouncements(el){
  const s=currentState(); if(!el||!s.user?.uid)return;
  try{
    await loadAnnouncementsData();
    el.innerHTML=cache.announcements.length
      ? cache.announcements.slice(0,5).map(v=>announcementCard(v)).join("")
      : `<div class="feature-empty">No announcements for your class right now.</div>`;
  }catch(e){
    el.innerHTML=`<div class="feature-empty">Announcements could not be loaded. Please retry.</div>`;
  }
}
function announcementDetail(id){
  const item=cache.announcements.find(a=>a.id===String(id));
  if(!item) return `<div class="feature-empty">This announcement is no longer available.</div>`;
  const priority=priorityMeta(item.priority);
  return `<section class="announcement-detail premium-announcement-detail card">
    <div class="announcement-detail-topline">
      <div class="announcement-detail-icon">📢</div>
      <span class="update-badge ${priority.cls}">${escapeHtml(priority.label)}</span>
    </div>
    <p class="eyebrow">ANNOUNCEMENT</p>
    <h2>${escapeHtml(item.title||"Announcement")}</h2>
    <p class="announcement-detail-message">${escapeHtml(item.message||"")}</p>
    <div class="announcement-detail-meta">
      <span>Published ${escapeHtml(dateText(item.createdAt))}</span>
      <span>${item.targetClass&&item.targetClass!=="all"?`Class ${escapeHtml(item.targetClass)}`:`All classes`}</span>
    </div>
  </section>`;
}
export async function renderNotificationsRoute({rootEl,announcementId=""}){
  const notificationResult=await Promise.allSettled([loadNotifications()]);
  const notificationError=notificationResult[0]?.status==="rejected"?notificationResult[0].reason:null;
  try { await loadAnnouncementsData(); } catch (error) { console.warn("Announcements unavailable:", error); }
  const unread=unreadNotifications();
  const selectedId=String(announcementId||"");
  const enabled=areNotificationsEnabled();
  rootEl.innerHTML=`
    ${notificationError ? `<div class="feature-empty updates-data-warning">Some personal alerts could not be loaded. Announcements remain available when published.</div>` : ""}
    <div class="updates-center-hero card">
      <div class="updates-center-hero-copy">
        <div class="updates-center-icon">🔔</div>
        <div><p class="eyebrow">YOUR UPDATES</p><h2>Announcements &amp; Alerts</h2><p>Stay informed about what matters for your class and your account.</p></div>
      </div>
      <div class="updates-center-stats"><strong>${unread.length}</strong><span>unread</span></div>
    </div>
    ${selectedId?`<div class="announcement-detail-wrap">${announcementDetail(selectedId)}<button class="secondary-button full-width" type="button" data-notification-back-list>Back to all updates</button></div>`:""}
    <div class="updates-filter-bar">
      <button class="updates-filter is-active" type="button" data-update-filter="all">All</button>
      <button class="updates-filter" type="button" data-update-filter="announcement">Announcements</button>
      <button class="updates-filter" type="button" data-update-filter="alerts">Alerts</button>
      <button class="updates-filter" type="button" data-update-filter="unread">Unread <span>${unread.length}</span></button>
    </div>
    <section class="updates-feed-section">
      <div class="updates-feed-head"><div><p class="eyebrow">LATEST</p><h3>Announcements</h3><p>Updates published by EZEE VISION CHAMPUA.</p></div></div>
      <div id="updatesAnnouncementsFeed" class="updates-feed">${cache.announcements.length?cache.announcements.map(v=>announcementCard(v)).join(""):`<div class="feature-empty">No announcements for your class right now.</div>`}</div>
    </section>
    <section class="updates-feed-section">
      <div class="updates-feed-head"><div><p class="eyebrow">YOUR ALERTS</p><h3>Notifications</h3><p>Learning and account alerts.</p></div>
        <div class="feature-toolbar-actions"><button class="secondary-button" data-feature-action="enable-notifications" ${enabled?"disabled":""}>${enabled?"Alerts enabled":"Enable alerts"}</button>${unread.length?`<button class="outline-button" data-feature-action="mark-all-read">Mark all read</button>`:""}</div>
      </div>
      <div id="updatesNotificationsFeed" class="updates-feed">${cache.notifications.length?cache.notifications.map(n=>notificationCard(n)).join(""):`<div class="feature-empty">No notifications yet. You're all caught up.</div>`}</div>
    </section>`;

  const applyFilter=(filter)=>{
    rootEl.querySelectorAll(".updates-filter").forEach(b=>b.classList.toggle("is-active",b.dataset.updateFilter===filter));
    const anns=rootEl.querySelector("#updatesAnnouncementsFeed");
    const alerts=rootEl.querySelector("#updatesNotificationsFeed");
    if(!anns||!alerts)return;
    if(filter==="announcement"){ anns.hidden=false; alerts.hidden=true; }
    else if(filter==="alerts"){ anns.hidden=true; alerts.hidden=false; }
    else if(filter==="unread"){
      anns.hidden=true; alerts.hidden=false;
      alerts.querySelectorAll(".notification-card").forEach(card=>card.classList.toggle("filter-hidden",card.classList.contains("is-read")));
    } else {
      anns.hidden=false; alerts.hidden=false;
      alerts.querySelectorAll(".notification-card").forEach(card=>card.classList.remove("filter-hidden"));
    }
  };
  rootEl.querySelectorAll("[data-update-filter]").forEach(btn=>btn.addEventListener("click",()=>applyFilter(btn.dataset.updateFilter)));
  rootEl.querySelectorAll('[data-action="open-announcement"]').forEach(button=>button.addEventListener("click",()=>{
    const id=button.dataset.announcementId;
    if(id) location.hash=`#announcement/${encodeURIComponent(id)}`;
  }));
  rootEl.querySelector("[data-notification-back-list]")?.addEventListener("click",()=>{ location.hash="#notifications"; });
  rootEl.querySelectorAll('[data-feature-action="read-notification"]').forEach(button=>button.addEventListener("click", async (event)=>{
    event.preventDefault(); event.stopPropagation();
    if(button.disabled)return;
    button.disabled=true;
    try{ await markNotificationRead(button.dataset.id); await renderNotificationsRoute({rootEl,announcementId:selectedId}); }
    catch(error){ console.error("Notification read failed",error); button.disabled=false; alert("Could not mark this notification as read. Please retry."); }
  }));
  rootEl.querySelectorAll('[data-feature-action="mark-all-read"]').forEach(button=>button.addEventListener("click", async ()=>{
    button.disabled=true;
    try{ await markAllNotificationsRead(); await renderNotificationsRoute({rootEl,announcementId:selectedId}); }
    catch(error){ console.error("Mark all read failed",error); button.disabled=false; alert("Could not mark notifications as read. Please retry."); }
  }));
  rootEl.querySelectorAll('[data-feature-action="enable-notifications"]').forEach(button=>button.addEventListener("click", async ()=>{
    button.disabled=true;
    try{ await enableNotifications(); await renderNotificationsRoute({rootEl,announcementId:selectedId}); }
    catch(error){ button.disabled=false; alert(error.message==="NOTIFICATION_UNSUPPORTED"?"This browser does not support notifications.":error.message==="NOTIFICATION_DENIED"?"Notification permission was not granted. Please allow notifications in browser settings.":"Notifications could not be enabled. Please try again."); }
  }));
  applyFilter("all");
}

export async function renderPerformance({rootEl}){
  await loadAttempts();
  const attempts=cache.attempts;
  const totalAttempts=attempts.length;
  const avg=totalAttempts?Number((attempts.reduce((s,a)=>s+Number(a.percentage||0),0)/totalAttempts).toFixed(1)):0;
  const best=totalAttempts?Math.max(...attempts.map(a=>Number(a.percentage||0))):0;
  const passed=attempts.filter(a=>Number(a.percentage||0)>=40).length;
  const recent=attempts.slice(0,30);
  rootEl.innerHTML=`
    <div class="performance-overview card">
      <div class="performance-overview-main"><p class="eyebrow">YOUR PROGRESS</p><h2>Practice performance</h2><p>Review your scores, accuracy and latest attempts.</p></div>
      <div class="performance-best-ring"><strong>${best}%</strong><span>best score</span></div>
    </div>
    <div class="performance-grid premium-performance-grid">
      <div class="perf-stat card"><span>Total Attempts</span><strong>${totalAttempts}</strong><small>Tests completed</small></div>
      <div class="perf-stat card"><span>Average Score</span><strong>${avg}%</strong><small>Across all attempts</small></div>
      <div class="perf-stat card"><span>Best Score</span><strong>${best}%</strong><small>Personal best</small></div>
      <div class="perf-stat card"><span>Passing Attempts</span><strong>${passed}</strong><small>40% or above</small></div>
    </div>
    <section class="card performance-table premium-performance-table" aria-labelledby="attemptHistoryTitle">
      <div class="performance-table-head"><div><p class="eyebrow">HISTORY</p><h3 id="attemptHistoryTitle">Attempt History</h3><p class="muted">Your latest practice attempts, newest first.</p></div><span class="history-count">${recent.length}</span></div>
      ${recent.length?`<div class="perf-list">${recent.map((a,idx)=>{
        const pct=Number(a.percentage||0);
        const status=pct>=40?"Passed":"Needs practice";
        return `<article class="perf-row premium-perf-row">
          <div class="perf-index">${String(idx+1).padStart(2,"0")}</div>
          <div class="perf-attempt-info"><strong>${escapeHtml(a.title||"Practice Test")}</strong><small>${escapeHtml(subjectLabel(a.subject)||"Practice")} ${a.chapter?`• ${escapeHtml(a.chapter)}`:""}</small><span class="perf-date">${escapeHtml(dateText(a.submittedAt))}</span></div>
          <div class="perf-score"><strong>${Number(a.score||0)}/${Number(a.total||0)}</strong><span>${pct}%</span><em class="perf-status ${pct>=40?"is-pass":"is-low"}">${status}</em></div>
        </article>`;
      }).join("")}</div>`:`<div class="feature-empty">Complete your first practice test and your results will appear here.</div>`}
    </section>`;
}

export async function renderPlanner({rootEl}){
  await loadPlans();
  rootEl.innerHTML=`
    <div class="feature-toolbar"><div><p class="eyebrow">PLAN AHEAD</p><h2>Study Planner</h2><p class="muted">Keep your next study tasks in one place.</p></div></div>
    <form id="studentPlanForm" class="card planner-form">
      <label class="field"><span>What will you study?</span><input id="planTitle" required maxlength="120" placeholder="e.g. Revise Nationalism"></label>
      <div class="form-grid-two"><label class="field"><span>Subject</span><select id="planSubject"><option value="">Choose subject</option>${SUBJECTS.map(s=>`<option value="${s.id}">${escapeHtml(s.label)}</option>`).join("")}</select></label><label class="field"><span>Due date</span><input id="planDueDate" type="date" value="${todayDateInput()}"></label></div>
      <label class="field"><span>Notes (optional)</span><textarea id="planNotes" maxlength="300" placeholder="Small reminder"></textarea></label>
      <div id="planMessage" class="inline-message"></div><button class="primary-button full-width" type="submit">Add Study Task</button>
    </form>
    <div class="planner-list">${cache.plans.length?cache.plans.map(p=>`<article class="plan-row card ${p.completed?"is-complete":""}"><label class="plan-check"><input type="checkbox" data-plan-toggle="${escapeHtml(p.id)}" ${p.completed?"checked":""}><span></span></label><div class="plan-copy"><strong>${escapeHtml(p.title)}</strong><small>${escapeHtml(subjectLabel(p.subject))}${p.dueDate?` • Due ${escapeHtml(p.dueDate)}`:""}</small>${p.notes?`<p>${escapeHtml(p.notes)}</p>`:""}</div><button class="mini-action danger" type="button" data-plan-delete="${escapeHtml(p.id)}">Delete</button></article>`).join(""):`<div class="feature-empty">No study tasks yet. Add your first one above.</div>`}</div>`;
  document.querySelector("#studentPlanForm")?.addEventListener("submit",async e=>{e.preventDefault();const msg=document.querySelector("#planMessage");try{const item=await addPlan({title:document.querySelector("#planTitle").value,subject:document.querySelector("#planSubject").value,dueDate:document.querySelector("#planDueDate").value,notes:document.querySelector("#planNotes").value});cache.plans.unshift(item);await renderPlanner({rootEl});}catch(err){msg.textContent=err.message==="INVALID_PLAN_TITLE"?"Enter a study task.":"Could not save this task.";msg.dataset.type="error";}});
  rootEl.querySelectorAll("[data-plan-toggle]").forEach(box=>box.addEventListener("change",async()=>{await togglePlan(box.dataset.planToggle,box.checked);await renderPlanner({rootEl});}));
  rootEl.querySelectorAll("[data-plan-delete]").forEach(btn=>btn.addEventListener("click",async()=>{if(!confirm("Delete this study task?"))return;await deletePlan(btn.dataset.planDelete);await renderPlanner({rootEl});}));
}

function attemptStatsForTest(testId){
  const list=cache.attempts.filter(a=>a.testId===testId);
  return {count:list.length,best:list.length?Math.max(...list.map(a=>Number(a.percentage||0))):0,last:list[0]||null};
}

export async function renderPracticeList({rootEl,classNumber,subjectId}){
  rootEl.innerHTML=`<div class="practice-hub card"><div class="practice-hub-copy"><p class="eyebrow">SMART PRACTICE</p><h2>${escapeHtml(subjectLabel(subjectId))} Practice</h2><p>Choose a test, track your progress and practise at your own pace.</p></div><div class="practice-hub-badge">⚡</div></div><div id="practiceListInner"><div class="feature-empty">Loading practice tests…</div></div>`;
  try{
    const results=await Promise.allSettled([loadPracticeTests(classNumber,subjectId),loadAttempts()]);
    if(results[0].status==="rejected") throw results[0].reason;
    if(results[1].status==="rejected") { cache.attempts=[]; console.warn("Practice attempts could not be loaded:", results[1].reason); }
    const tests=cache.tests;
    const attempts=cache.attempts;
    const subjectAttempts=attempts.filter(a=>!subjectId||a.subject===subjectId);
    const best=subjectAttempts.length?Math.max(...subjectAttempts.map(a=>Number(a.percentage||0))):0;
    const avg=subjectAttempts.length?Number((subjectAttempts.reduce((s,a)=>s+Number(a.percentage||0),0)/subjectAttempts.length).toFixed(1)):0;
    const inner=rootEl.querySelector("#practiceListInner");
    inner.innerHTML=`
      <div class="practice-summary-grid">
        <div class="practice-summary-card"><span>Available</span><strong>${tests.length}</strong><small>Practice tests</small></div>
        <div class="practice-summary-card"><span>Your attempts</span><strong>${subjectAttempts.length}</strong><small>This subject</small></div>
        <div class="practice-summary-card"><span>Best score</span><strong>${best}%</strong><small>Personal best</small></div>
        <div class="practice-summary-card"><span>Average</span><strong>${avg}%</strong><small>Across attempts</small></div>
      </div>
      <div class="practice-list-toolbar">
        <label class="practice-search"><span>⌕</span><input id="practiceSearchInput" type="search" placeholder="Search practice tests…" autocomplete="off"></label>
        <select id="practiceSortSelect" class="practice-sort"><option value="newest">Newest</option><option value="best">Best score</option><option value="attempts">Most attempted</option><option value="shortest">Shortest</option></select>
      </div>
      <div id="practiceCards" class="practice-card-list"></div>`;

    const renderCards=()=>{
      const query=String(inner.querySelector("#practiceSearchInput")?.value||"").trim().toLowerCase();
      const sort=inner.querySelector("#practiceSortSelect")?.value||"newest";
      let list=tests.filter(t=>`${t.title||""} ${t.chapter||""}`.toLowerCase().includes(query));
      list=[...list].sort((a,b)=>{
        const sa=attemptStatsForTest(a.id), sb=attemptStatsForTest(b.id);
        if(sort==="best") return sb.best-sa.best;
        if(sort==="attempts") return sb.count-sa.count;
        if(sort==="shortest") return Number(a.durationSec||0)-Number(b.durationSec||0);
        return Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0);
      });
      const box=inner.querySelector("#practiceCards");
      box.innerHTML=list.length?list.map((t,i)=>{
        const st=attemptStatsForTest(t.id);
        const qCount=Array.isArray(t.questions)?t.questions.length:0;
        const mins=Number(t.durationSec||0)>0?Math.max(1,Math.ceil(Number(t.durationSec)/60)):0;
        const meta=[t.chapter||"General",`${qCount} question${qCount===1?"":"s"}`,mins?`${mins} min`:"No limit"].join(" • ");
        return `<button class="practice-test-card premium-practice-card" type="button" data-action="open-practice-test" data-class-number="${Number(classNumber)}" data-subject-id="${escapeHtml(subjectId)}" data-test-id="${escapeHtml(t.id)}">
          <span class="practice-card-index">${String(i+1).padStart(2,"0")}</span><span class="practice-test-icon premium-practice-icon">📝</span><span class="practice-test-main"><strong>${escapeHtml(t.title||"Practice Test")}</strong><small>${escapeHtml(meta)}</small><span class="practice-card-progress"><i style="width:${Math.min(100,st.best)}%"></i></span><em>${st.count?`${st.count} attempt${st.count===1?"":"s"} • Best ${st.best}%`:"Not attempted yet"}</em></span><b class="practice-card-arrow">→</b>
        </button>`;
      }).join(""):`<div class="feature-empty">No matching practice tests found.</div>`;
      box.querySelectorAll('[data-action="open-practice-test"]').forEach(button=>button.addEventListener("click",()=>{
        location.hash=`#practice-test/${Number(button.dataset.classNumber)}/${encodeURIComponent(button.dataset.subjectId)}/${encodeURIComponent(button.dataset.testId)}`;
      }));
    };
    inner.querySelector("#practiceSearchInput").addEventListener("input",renderCards);
    inner.querySelector("#practiceSortSelect").addEventListener("change",renderCards);
    renderCards();
  }catch(e){
    rootEl.querySelector("#practiceListInner").innerHTML=`<div class="feature-empty">Practice tests could not be loaded. Check your connection and retry.</div>`;
  }
}

let activeTest=null;
let activeAnswers={};
let activeStartedAt=0;
let activeTimer=null;
let activeSubmitting=false;
let activeQuestionIndex=0;
let activeMarked=new Set();
let activeStorageKey="";
let activeGoBack=null;

function clearPracticeTimer(){ if(activeTimer){clearInterval(activeTimer);activeTimer=null;} }
function practiceStorageKey(test){
  const uid=currentState().user?.uid||"guest";
  return `evc_practice_draft_${uid}_${test.id}`;
}
function savePracticeDraft(rootEl){
  if(!activeTest||!activeStorageKey)return;
  try{
    activeAnswers=collectAnswers(rootEl);
    localStorage.setItem(activeStorageKey,JSON.stringify({answers:activeAnswers,startedAt:activeStartedAt,marked:[...activeMarked],updatedAt:Date.now()}));
  }catch(e){console.warn("Practice draft save failed",e);}
}
function restorePracticeDraft(rootEl,test){
  try{
    const raw=localStorage.getItem(practiceStorageKey(test));
    if(!raw)return false;
    const draft=JSON.parse(raw);
    if(!draft||typeof draft!=="object")return false;
    activeAnswers=draft.answers||{};
    activeMarked=new Set(Array.isArray(draft.marked)?draft.marked.map(Number):[]);
    const age=Date.now()-Number(draft.updatedAt||0);
    if(age>24*60*60*1000)return false;
    if(Number(test.durationSec||0)>0 && Date.now()-Number(draft.startedAt||Date.now())>=Number(test.durationSec)*1000)return false;
    activeStartedAt=Number(draft.startedAt)||Date.now();
    applyAnswersToForm(rootEl);
    return true;
  }catch(e){return false;}
}
function clearPracticeDraft(){try{if(activeStorageKey)localStorage.removeItem(activeStorageKey);}catch{}}
function applyAnswersToForm(rootEl){
  Object.entries(activeAnswers||{}).forEach(([i,value])=>{
    const radio=rootEl.querySelector(`[name="q-${Number(i)}"][value="${CSS.escape(String(value))}"]`);
    if(radio)radio.checked=true;
    const input=rootEl.querySelector(`[data-q-index="${Number(i)}"]`);
    if(input&&!radio)input.value=String(value);
  });
}
function renderQuestion(q,i){
  const type=q.type||"mcq";
  const marks=Number(q.marks||1);
  const marked=activeMarked.has(i);
  const meta=`<div class="practice-question-head"><span class="practice-q-number">Q${i+1}</span><span class="practice-q-marks">${marks} mark${marks===1?"":"s"}</span><button class="question-mark-btn ${marked?"is-marked":""}" type="button" data-mark-question="${i}" aria-label="${marked?"Unmark":"Mark"} question for review">${marked?"★":"☆"}</button></div>`;
  if(type==="mcq"){
    const opts=Array.isArray(q.options)?q.options:[];
    return `<fieldset class="practice-question card" data-question-card="${i}" hidden><legend>${meta}<span class="practice-prompt">${escapeHtml(q.prompt||"Question")}</span></legend><div class="answer-options">${opts.map((o,j)=>`<label class="answer-option"><input type="radio" name="q-${i}" value="${escapeHtml(String(j))}"><span class="answer-option-text"><b>${String.fromCharCode(65+j)}</b><span>${escapeHtml(o)}</span></span></label>`).join("")}</div></fieldset>`;
  }
  if(type==="truefalse") return `<fieldset class="practice-question card" data-question-card="${i}" hidden><legend>${meta}<span class="practice-prompt">${escapeHtml(q.prompt||"Question")}</span></legend><div class="answer-options answer-options-two"><label class="answer-option"><input type="radio" name="q-${i}" value="true"><span class="answer-option-text"><b>✓</b><span>True</span></span></label><label class="answer-option"><input type="radio" name="q-${i}" value="false"><span class="answer-option-text"><b>✕</b><span>False</span></span></label></div></fieldset>`;
  return `<div class="practice-question card" data-question-card="${i}" hidden><div>${meta}</div><div class="practice-prompt">${escapeHtml(q.prompt||"Question")}</div><input class="practice-text-answer" data-q-index="${i}" type="text" autocomplete="off" placeholder="Type your answer"></div>`;
}
function collectAnswers(rootEl){
  const answers={};
  (activeTest?.questions||[]).forEach((q,i)=>{
    const choice=rootEl.querySelector(`[name="q-${i}"]:checked`);
    if(choice) answers[i]=choice.value;
    else {const input=rootEl.querySelector(`[data-q-index="${i}"]`);answers[i]=input?.value||"";}
  });
  return answers;
}
function updatePracticeUI(rootEl){
  const questions=activeTest?.questions||[];
  const total=questions.length;
  const answeredCount=questions.reduce((n,_,i)=>n+(String(collectAnswers(rootEl)[i]||"").trim()!==""?1:0),0);
  const progress=total?Math.round(((activeQuestionIndex+1)/total)*100):0;
  const answeredProgress=total?Math.round((answeredCount/total)*100):0;
  rootEl.querySelectorAll("[data-question-card]").forEach((card)=>{card.hidden=Number(card.dataset.questionCard)!==activeQuestionIndex;});
  const label=rootEl.querySelector("#practiceQuestionCounter");if(label)label.textContent=`Question ${Math.min(activeQuestionIndex+1,total)} of ${total}`;
  const bar=rootEl.querySelector("#practiceProgressBar");if(bar)bar.style.width=`${progress}%`;
  const answered=rootEl.querySelector("#practiceAnsweredBar");if(answered)answered.style.width=`${answeredProgress}%`;
  const answeredLabel=rootEl.querySelector("#practiceAnsweredLabel");if(answeredLabel)answeredLabel.textContent=`${answeredCount}/${total} answered`;
  const prev=rootEl.querySelector("[data-practice-prev]");if(prev)prev.disabled=activeQuestionIndex<=0;
  const next=rootEl.querySelector("[data-practice-next]");if(next){next.hidden=activeQuestionIndex>=total-1;next.disabled=activeQuestionIndex>=total-1;}
  const submit=rootEl.querySelector("[data-practice-submit]");if(submit)submit.hidden=activeQuestionIndex<total-1;
  rootEl.querySelectorAll("[data-question-jump]").forEach(btn=>{const idx=Number(btn.dataset.questionJump);const val=collectAnswers(rootEl)[idx];btn.classList.toggle("is-current",idx===activeQuestionIndex);btn.classList.toggle("is-answered",String(val||"").trim()!=="");btn.classList.toggle("is-marked",activeMarked.has(idx));});
  const markedLabel=rootEl.querySelector("#practiceMarkedLabel");if(markedLabel)markedLabel.textContent=`${activeMarked.size} marked`;
}
function startTimer(test,rootEl){
  clearPracticeTimer();
  const timer=rootEl.querySelector("#practiceTimer");
  const limit=Math.max(0,Number(test.durationSec||0));
  const tick=()=>{
    if(!limit){timer.textContent="No limit";timer.classList.remove("is-warning","is-danger");return;}
    const elapsed=Math.floor((Date.now()-activeStartedAt)/1000);
    const left=Math.max(0,limit-elapsed);
    timer.textContent=`${String(Math.floor(left/60)).padStart(2,"0")}:${String(left%60).padStart(2,"0")}`;
    timer.classList.toggle("is-warning",left<=60&&left>20);
    timer.classList.toggle("is-danger",left<=20);
    if(left<=0){clearPracticeTimer();void finalizePractice(true,rootEl,activeGoBack);}
  };
  tick(); if(limit)activeTimer=setInterval(tick,1000);
}
function renderPracticeResult(rootEl,result,forced,goBack){
  const questions=activeTest.questions||[];
  const pct=Number(result.percentage||0);
  const answered=Number(result.attempted||0);
  const review=questions.map((q,i)=>{
    const value=result.answers?.[i]??"";
    const correct=questionScore(q,value)>0;
    return `<div class="result-review-row ${correct?"is-correct":String(value).trim()?"is-wrong":"is-unanswered""><span>Q${i+1}</span><div><strong>${correct?"Correct":String(value).trim()?"Needs review":"Not answered"}</strong><small>${escapeHtml(q.prompt||"")}</small></div><b>${correct?`+${Number(q.marks||1)}`:String(value).trim()?"0":"—"}</b></div>`;
  }).join("");
  rootEl.querySelectorAll("input,button").forEach(x=>x.disabled=false);
  rootEl.querySelector("#practiceWorkspace")?.remove();
  const resultBox=rootEl.querySelector("#practiceResult");
  resultBox.innerHTML=`<section class="advanced-score-card card"><div class="score-result-top"><div><p class="eyebrow">${forced?"TIME'S UP":"TEST COMPLETE"}</p><h2>${escapeHtml(activeTest.title||"Practice Test")}</h2><p>${forced?"The timer ended and your answers were submitted.":"Great work. Here is your performance."}</p></div><div class="score-percent"><strong>${pct}%</strong><span>${pct>=40?"Passed":"Keep practising"}</span></div></div><div class="score-main advanced-score-main"><strong>${Number(result.score||0)}/${Number(result.total||0)}</strong><span>${answered}/${questions.length} answered</span></div><div class="score-grid advanced-score-grid"><div><span>Correct</span><strong>${result.correct}</strong></div><div><span>Wrong</span><strong>${result.wrong}</strong></div><div><span>Unanswered</span><strong>${result.unanswered}</strong></div><div><span>Time</span><strong>${Math.floor(result.timeTakenSec/60)}m ${result.timeTakenSec%60}s</strong></div></div><details class="result-review"><summary>Review answers <span>${questions.length} questions</span></summary><div>${review}</div></details><div class="dialog-actions"><button class="primary-button" type="button" data-practice-retake>Retake Test</button><button class="secondary-button" type="button" data-practice-back>Back to Practice</button></div></section>`;
  clearPracticeDraft();
  resultBox.querySelector("[data-practice-retake]")?.addEventListener("click",()=>{void renderPracticeTest({rootEl,classNumber:activeTest.class,subjectId:activeTest.subject,testId:activeTest.id,goBack});});
  resultBox.querySelector("[data-practice-back]")?.addEventListener("click",()=>goBack?.());
}
async function finalizePractice(forced,rootEl,goBack){
  if(!activeTest||activeSubmitting)return;
  activeSubmitting=true;clearPracticeTimer();
  const answers=collectAnswers(rootEl);activeAnswers=answers;savePracticeDraft(rootEl);
  rootEl.querySelectorAll("input,button").forEach(x=>x.disabled=true);
  try{
    const result=await submitPractice(activeTest,answers,activeStartedAt,forced);
    activeSubmitting=false;
    renderPracticeResult(rootEl,result,forced,goBack);
  }catch(e){
    activeSubmitting=false;
    rootEl.querySelectorAll("input,button").forEach(x=>x.disabled=false);
    rootEl.querySelector("#practiceSaveError").textContent="Your result could not be saved. Please retry.";
  }
}

export async function renderPracticeTest({rootEl,classNumber,subjectId,testId,goBack}){
  clearPracticeTimer();activeGoBack=goBack;rootEl.innerHTML=`<div class="feature-empty">Loading practice test…</div>`;
  try{
    const test=await loadPracticeTest(classNumber,subjectId,testId);
    if(!test)throw new Error("TEST_NOT_FOUND");
    activeTest=test;activeSubmitting=false;activeQuestionIndex=0;activeMarked=new Set();activeAnswers={};activeStorageKey=practiceStorageKey(test);activeStartedAt=Date.now();
    rootEl.innerHTML=`<div class="practice-test-shell"><div class="practice-test-top card"><div class="practice-test-top-copy"><p class="eyebrow">ACTIVE PRACTICE</p><h2>${escapeHtml(test.title||"Practice Test")}</h2><p>${escapeHtml(test.chapter||subjectLabel(test.subject)||"Practice")}</p></div><div class="practice-timer-wrap"><span>TIME LEFT</span><div class="practice-timer" id="practiceTimer">--:--</div></div></div><div class="practice-progress-card card"><div class="practice-progress-meta"><strong id="practiceQuestionCounter">Question 1 of ${Array.isArray(test.questions)?test.questions.length:0}</strong><span id="practiceAnsweredLabel">0/${Array.isArray(test.questions)?test.questions.length:0} answered</span></div><div class="practice-progress-track"><i id="practiceProgressBar"></i><b id="practiceAnsweredBar"></b></div></div><div class="practice-workspace" id="practiceWorkspace"><div class="practice-question-nav card"><div class="question-nav-head"><strong>Questions</strong><span id="practiceMarkedLabel">0 marked</span></div><div class="question-jump-grid">${(test.questions||[]).map((_,i)=>`<button type="button" data-question-jump="${i}">${i+1}</button>`).join("")}</div><div class="question-nav-legend"><span><i></i> Current</span><span><i></i> Answered</span><span><i></i> Marked</span></div></div><form id="practiceForm" class="practice-form"><div class="practice-question-stage">${(test.questions||[]).map((q,i)=>renderQuestion(q,i)).join("")}<div id="practiceSaveError" class="inline-message"></div></div><div class="practice-controls"><button class="secondary-button" type="button" data-practice-prev>← Previous</button><button class="outline-button" type="button" data-practice-next>Next →</button><button class="primary-button" type="submit" data-practice-submit hidden>Submit Practice</button></div></form></div><div id="practiceResult"></div></div>`;
    const restored=restorePracticeDraft(rootEl,test);
    if(!restored){activeStartedAt=Date.now();activeAnswers={};activeMarked=new Set();}
    rootEl.querySelectorAll("[data-question-jump]").forEach(btn=>btn.addEventListener("click",()=>{savePracticeDraft(rootEl);activeQuestionIndex=Number(btn.dataset.questionJump);updatePracticeUI(rootEl);window.scrollTo({top:Math.max(0,rootEl.getBoundingClientRect().top+window.scrollY-90),behavior:"smooth"});}));
    rootEl.querySelector("[data-practice-prev]")?.addEventListener("click",()=>{savePracticeDraft(rootEl);activeQuestionIndex=Math.max(0,activeQuestionIndex-1);updatePracticeUI(rootEl);});
    rootEl.querySelector("[data-practice-next]")?.addEventListener("click",()=>{savePracticeDraft(rootEl);activeQuestionIndex=Math.min((test.questions||[]).length-1,activeQuestionIndex+1);updatePracticeUI(rootEl);});
    rootEl.querySelectorAll("[data-mark-question]").forEach(btn=>btn.addEventListener("click",()=>{const i=Number(btn.dataset.markQuestion);if(activeMarked.has(i))activeMarked.delete(i);else activeMarked.add(i);savePracticeDraft(rootEl);updatePracticeUI(rootEl);}));
    rootEl.querySelector("#practiceForm")?.addEventListener("input",()=>{activeAnswers=collectAnswers(rootEl);savePracticeDraft(rootEl);updatePracticeUI(rootEl);});
    rootEl.querySelector("#practiceForm")?.addEventListener("change",()=>{activeAnswers=collectAnswers(rootEl);savePracticeDraft(rootEl);updatePracticeUI(rootEl);});
    rootEl.querySelector("#practiceForm")?.addEventListener("submit",async e=>{e.preventDefault();const answers=collectAnswers(rootEl);const empty=(test.questions||[]).filter((_,i)=>String(answers[i]||"").trim()==="").length;if(empty&&!confirm(`${empty} question${empty===1?" is":"s are"} unanswered. Submit anyway?`))return;await finalizePractice(false,rootEl,goBack);});
    updatePracticeUI(rootEl);startTimer(test,rootEl);
  }catch(e){
    rootEl.innerHTML=`<div class="feature-empty">${e.message==="TEST_NOT_FOUND"?"Practice test not found or unpublished.":"Could not load this practice test."}</div>`;
  }
}

export function handleFeatureAction(action,id,renderContext){
  if(action==="read-notification")return markNotificationRead(id).then(()=>renderContext?renderNotificationsRoute(renderContext):undefined);
  if(action==="mark-all-read")return markAllNotificationsRead().then(()=>renderContext?renderNotificationsRoute(renderContext):undefined);
  if(action==="enable-notifications")return enableNotifications().then(()=>alert("Notifications enabled for this device."));
  return Promise.resolve();
}
