const state={page:"dashboard"};
const students=[
 {name:"Rahul Kumar",cls:"Class 10",batch:"Batch A",att:"92%",due:"₹1,000"},
 {name:"Aman Kumar",cls:"Class 10",batch:"Batch B",att:"88%",due:"₹0"},
 {name:"Priya Singh",cls:"Class 9",batch:"Batch A",att:"95%",due:"₹2,000"},
 {name:"Neha Das",cls:"Class 8",batch:"Batch C",att:"91%",due:"₹0"}
];

document.addEventListener("DOMContentLoaded",()=>{
 document.getElementById("pageDate").textContent=new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
 document.getElementById("loginForm").addEventListener("submit",e=>{e.preventDefault();document.getElementById("loginView").classList.add("hidden");document.getElementById("appView").classList.remove("hidden");render();});
 document.getElementById("forgotBtn").onclick=()=>showToast("Password recovery will be connected in Phase 2");
 document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>{state.page=b.dataset.page;render();});
});

function render(){
 document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===state.page));
 const titles={dashboard:"Dashboard",students:"Students",attendance:"Attendance",fees:"Fees",more:"More"};
 document.getElementById("pageTitle").textContent=titles[state.page]||"Dashboard";
 const c=document.getElementById("pageContent");
 c.innerHTML={dashboard:dashboard,students:studentsPage,attendance:attendancePage,fees:feesPage,more:morePage}[state.page]();
}

function dashboard(){return `
 <div class="hero-card"><h3>Good Morning, Shahid Sir 👋</h3><p>Manage your coaching centre from one place.</p></div>
 <div class="grid">
  ${stat("👨‍🎓","Students","120")}${stat("🏫","Batches","08")}${stat("✓","Attendance","90%")}${stat("₹","Fees Due","₹18,500")}
 </div>
 <div class="section-title"><h3>Quick Actions</h3></div>
 <div class="quick-grid">
  ${action("＋","Add Student","students")}${action("✓","Take Attendance","attendance")}${action("₹","Collect Fee","fees")}${action("📝","Create Exam","more")}${action("📚","Add Material","more")}
 </div>
 <div class="section-title"><h3>Today's Attendance</h3><small>108 / 120 present</small></div>
 <div class="list-card"><div class="activity">🟢 Present <b>108</b></div><div class="activity">🔴 Absent <b>12</b></div><div class="activity">📊 Percentage <b>90%</b></div></div>
 <div class="section-title"><h3>Recent Activity</h3></div>
 <div class="list-card"><div class="activity">💰 Rahul paid ₹2,000</div><div class="activity">📋 Aman marked absent</div><div class="activity">👨‍🎓 New student added</div><div class="activity">📝 Exam result published</div></div>`}

function stat(i,l,v){return `<div class="stat-card"><div>${i}</div><div class="label">${l}</div><div class="value">${v}</div></div>`}
function action(i,t,p){return `<button class="action-btn" onclick="go('${p}')">${i} ${t}</button>`}
function go(p){state.page=p;render();window.scrollTo({top:0,behavior:"smooth"})}

function studentsPage(){return `<input class="search" placeholder="🔍 Search students..." oninput="filterStudents(this.value)"><div class="filters"><button class="chip active">All</button><button class="chip">Active</button><button class="chip">Inactive</button></div><div id="studentList">${studentCards(students)}</div><button class="primary-btn" style="margin-top:14px" onclick="showToast('Add Student will be connected in Phase 2')">＋ ADD STUDENT</button>`}
function studentCards(arr){return arr.map(s=>`<div class="student-card"><div class="avatar">${s.name.split(" ").map(x=>x[0]).join("")}</div><div class="student-main"><strong>${s.name}</strong><small>${s.cls} • ${s.batch}</small></div><div class="student-meta">${s.att}<br>${s.due} due</div></div>`).join("")}
function filterStudents(q){const x=students.filter(s=>s.name.toLowerCase().includes(q.toLowerCase())||s.batch.toLowerCase().includes(q.toLowerCase()));document.getElementById("studentList").innerHTML=studentCards(x)||`<div class="list-card" style="padding:20px;text-align:center">No students found</div>`}

function attendancePage(){return `<div class="list-card" style="padding:15px"><label class="section-title" style="margin:0 0 8px"><b>Select Batch</b><select id="batch" style="padding:10px;border:1px solid #dce4ef;border-radius:10px"><option>Class 10 - Batch A</option><option>Class 10 - Batch B</option></select></label><p style="font-size:12px;color:#78869c;margin-bottom:0">Date: ${new Date().toLocaleDateString("en-IN")}</p></div><div class="grid">${stat("🟢","Present","108")}${stat("🔴","Absent","12")}${stat("📊","Percentage","90%")}</div><div class="section-title"><h3>Students</h3></div><div class="list-card">${students.map((s,i)=>`<div class="attendance-row"><div class="avatar">${s.name[0]}</div><div class="row-main"><strong>${s.name}</strong><small>${s.batch}</small></div><button class="toggle ${i===1?'absent':'present'}" onclick="toggleAttendance(this)">${i===1?'Absent':'Present'}</button></div>`).join("")}</div><button class="primary-btn" onclick="showToast('Attendance saved locally for Phase 1 demo')">SAVE ATTENDANCE</button>`}
function toggleAttendance(b){const a=b.classList.contains("present");b.classList.toggle("present",!a);b.classList.toggle("absent",a);b.textContent=a?"Absent":"Present"}

function feesPage(){return `<div class="grid">${stat("₹","Total Collection","₹42,500")}${stat("!","Pending","₹18,500")}</div><div class="section-title"><h3>Fee Records</h3></div><div class="list-card">${students.map(s=>`<div class="fee-row"><div class="avatar">${s.name[0]}</div><div class="row-main"><strong>${s.name}</strong><small>${s.batch}</small></div><div class="fee-due">${s.due} due<br><button class="chip" onclick="showToast('Payment screen will be connected in Phase 5')">Collect</button></div></div>`).join("")}</div>`}

function morePage(){const modules=[["🏫","Batches","Manage classes & batches"],["📝","Exams","Marks & results"],["📈","Performance","Student progress"],["📚","Study Material","Notes & resources"],["🏠","Homework","Assignments"],["🖥️","Online Exams","Digital tests"],["💵","Income","Money received"],["💸","Expenses","Track spending"],["📩","Enquiries","New admissions"],["👨‍🏫","Staff","Staff management"],["📊","Reports","PDF & reports"],["🔔","Notifications","Announcements"],["☁️","Backup & Restore","Data safety"],["⚙️","Settings","App settings"]];return `<div class="module-grid">${modules.map(m=>`<button class="module-card" onclick="showToast('${m[1]} module will be connected in its development phase')"><span class="ico">${m[0]}</span><strong>${m[1]}</strong><small>${m[2]}</small></button>`).join("")}</div><button class="logout" onclick="location.reload()">↪ LOG OUT</button>`}

function showToast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.classList.remove("show"),2200)}
