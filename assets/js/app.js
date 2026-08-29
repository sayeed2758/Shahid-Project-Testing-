const STORAGE_KEY = 'ezee_vision_phase3';
const STORAGE_VERSION = 4;
let activeStorageKey = STORAGE_KEY;
let cloudSavePromise = Promise.resolve();

const DEFAULT_DB = {
  schemaVersion: STORAGE_VERSION,
  user: null,
  students: [
    { id: 'EV001', name: 'Rahul Kumar', cls: 'Class 10', batch: 'Batch A', phone: '', att: 92, due: 1000 },
    { id: 'EV002', name: 'Aman Kumar', cls: 'Class 10', batch: 'Batch B', phone: '', att: 88, due: 0 },
    { id: 'EV003', name: 'Priya Singh', cls: 'Class 9', batch: 'Batch A', phone: '', att: 95, due: 2000 },
    { id: 'EV004', name: 'Neha Das', cls: 'Class 8', batch: 'Batch C', phone: '', att: 91, due: 0 }
  ],
  batches: ['Batch A', 'Batch B', 'Batch C'],
  attendance: {},
  payments: [],
  notifications: ['Welcome to EZEE VISION CHAMPUA'],
  items: {
    exams: [], materials: [], homework: [], online: [], income: [], expenses: [], enquiries: [], staff: []
  }
};

let db = loadLocal();
let state = { page: 'dashboard', selectedStudent: null, attendanceBatch: 'all', studentFilter: 'all' };
let cloudTimer = null;
let cloudBusy = false;

const TITLES = {
  dashboard: 'Dashboard', students: 'Students', attendance: 'Attendance', fees: 'Fees', more: 'More',
  profile: 'Student Profile', addStudent: 'Add Student', notifications: 'Notifications', batches: 'Batches',
  exams: 'Exams', performance: 'Performance', materials: 'Study Material', homework: 'Homework',
  online: 'Online Exams', income: 'Income', expenses: 'Expenses', enquiries: 'Enquiries', staff: 'Staff',
  reports: 'Reports', settings: 'Settings', backup: 'Backup & Restore'
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepMerge(base, saved) {
  if (!saved || typeof saved !== 'object') return base;
  Object.keys(saved).forEach(key => {
    const value = saved[key];
    if (
      value && typeof value === 'object' && !Array.isArray(value) &&
      base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])
    ) {
      base[key] = deepMerge(base[key], value);
    } else {
      base[key] = value;
    }
  });
  return base;
}

function normalizeData(value) {
  const clean = deepMerge(clone(DEFAULT_DB), value || {});
  clean.schemaVersion = STORAGE_VERSION;
  clean.students = Array.isArray(clean.students) ? clean.students : [];
  clean.batches = Array.isArray(clean.batches) ? clean.batches : [];
  clean.payments = Array.isArray(clean.payments) ? clean.payments : [];
  clean.notifications = Array.isArray(clean.notifications) ? clean.notifications : [];
  clean.attendance = clean.attendance && typeof clean.attendance === 'object' ? clean.attendance : {};
  clean.items = clean.items && typeof clean.items === 'object' ? clean.items : clone(DEFAULT_DB.items);
  Object.keys(DEFAULT_DB.items).forEach(key => {
    if (!Array.isArray(clean.items[key])) clean.items[key] = [];
  });
  return clean;
}

function loadLocal(key = activeStorageKey) {
  try {
    const raw = localStorage.getItem(key);
    return normalizeData(raw ? JSON.parse(raw) : {});
  } catch (_) {
    return clone(DEFAULT_DB);
  }
}

function persistLocal() {
  try {
    localStorage.setItem(activeStorageKey, JSON.stringify(db));
  } catch (err) {
    console.warn('Local cache save failed:', err);
  }
}

function setUserStorage(uid) {
  activeStorageKey = uid ? `${STORAGE_KEY}_${uid}` : STORAGE_KEY;
}

function save({ toastMessage = '', immediate = false } = {}) {
  persistLocal();
  scheduleCloudSave(immediate, toastMessage);
}

function scheduleCloudSave(immediate = false, toastMessage = '') {
  const firebase = window.EVFirebase;
  if (!firebase?.configured || !firebase.auth?.currentUser) return;
  clearTimeout(cloudTimer);
  if (immediate) {
    void saveCloudNow(toastMessage);
    return;
  }
  cloudTimer = setTimeout(() => void saveCloudNow(toastMessage), 350);
}

async function saveCloudNow(toastMessage = '') {
  const firebase = window.EVFirebase;
  const user = firebase?.auth?.currentUser;
  if (!firebase?.configured || !user) return;

  // Queue cloud writes so rapid button presses cannot silently drop a save.
  const snapshot = clone(db);
  cloudSavePromise = cloudSavePromise.then(async () => {
    cloudBusy = true;
    try {
      await firebase.saveCloud(user.uid, snapshot);
      if (toastMessage) toast(toastMessage);
    } catch (err) {
      console.warn('Firebase save failed:', err);
      if (toastMessage) toast('Cloud save failed. Check internet.');
    } finally {
      cloudBusy = false;
    }
  });
  await cloudSavePromise;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
}

function money(value) {
  return '₹' + Number(value || 0).toLocaleString('en-IN');
}

function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateText() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function toast(message) {
  const element = document.getElementById('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(window.__ezeeToastTimer);
  window.__ezeeToastTimer = setTimeout(() => element.classList.remove('show'), 2400);
}

function go(page) {
  state.page = page;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setLoginBusy(busy) {
  const button = document.querySelector('#loginForm button[type="submit"]');
  const google = document.getElementById('googleLoginBtn');
  if (button) {
    button.disabled = busy;
    button.textContent = busy ? 'SIGNING IN…' : 'LOGIN';
  }
  if (google) google.disabled = busy;
}

async function init() {
  document.getElementById('pageDate').textContent = dateText();
  document.getElementById('loginForm').addEventListener('submit', login);
  document.getElementById('forgotBtn').addEventListener('click', forgotPassword);
  document.getElementById('googleLoginBtn').addEventListener('click', googleLogin);
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => go(button.dataset.page));
  });

  await waitForFirebase();
  const firebase = window.EVFirebase;
  if (!firebase?.configured) {
    toast('Firebase configuration is missing.');
    return;
  }

  firebase.onAuthStateChanged(async user => {
    if (user) {
      await loadAuthenticatedUser(user);
    } else {
      showLogin();
    }
  });
}

function waitForFirebase() {
  if (window.EVFirebase) return window.EVFirebase.ready || Promise.resolve();
  return new Promise(resolve => {
    window.addEventListener('ev-firebase-ready', () => {
      const ready = window.EVFirebase?.ready || Promise.resolve();
      ready.then(resolve);
    }, { once: true });
  });
}

async function loadAuthenticatedUser(user) {
  setUserStorage(user.uid);
  db = loadLocal();
  db.user = {
    uid: user.uid,
    name: user.displayName || db.user?.name || 'Shahid Sir',
    login: user.email || '',
    role: 'Admin'
  };

  try {
    const cloud = await window.EVFirebase.loadCloud(user.uid);
    if (cloud) {
      const merged = normalizeData(cloud);
      merged.user = db.user;
      db = merged;
      persistLocal();
    } else {
      await window.EVFirebase.saveCloud(user.uid, db);
      persistLocal();
    }
    showApp();
  } catch (err) {
    console.warn('Firebase load failed:', err);
    persistLocal();
    showApp();
    toast('Cloud load failed. Local data shown.');
  }
}

function showApp() {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appView').classList.remove('hidden');
  render();
}

function showLogin() {
  clearTimeout(cloudTimer);
  activeStorageKey = STORAGE_KEY;
  document.getElementById('appView').classList.add('hidden');
  document.getElementById('loginView').classList.remove('hidden');
  setLoginBusy(false);
}

async function login(event) {
  event.preventDefault();
  const email = document.getElementById('loginId').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) return toast('Email and password are required.');
  if (!window.EVFirebase?.configured) return toast('Firebase is not configured.');

  setLoginBusy(true);
  try {
    await window.EVFirebase.signIn(email, password);
    toast('Login successful ☁️');
  } catch (err) {
    toast(firebaseError(err));
    setLoginBusy(false);
  }
}

async function googleLogin() {
  if (!window.EVFirebase?.configured) return toast('Firebase is not configured.');
  setLoginBusy(true);
  try {
    const result = await window.EVFirebase.signInWithGoogle();
    if (result?.user) toast('Google login successful ☁️');
  } catch (err) {
    toast(firebaseError(err));
    setLoginBusy(false);
  }
}

async function forgotPassword() {
  const email = document.getElementById('loginId').value.trim();
  if (!email) return toast('Enter your email first.');
  if (!window.EVFirebase?.configured) return toast('Firebase is not configured.');
  try {
    await window.EVFirebase.resetPassword(email);
    toast('Password reset email sent.');
  } catch (err) {
    toast(firebaseError(err));
  }
}

function firebaseError(error) {
  const code = error?.code || '';
  const messages = {
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/user-not-found': 'Account not found.',
    'auth/wrong-password': 'Wrong password.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase.',
    'auth/network-request-failed': 'Network error. Check your internet connection.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/popup-blocked': 'Popup blocked. Allow popups and try again.',
    'auth/account-exists-with-different-credential': 'An account already exists with another sign-in method.'
  };
  return messages[code] || error?.message || 'Authentication failed.';
}

async function logout() {
  try {
    if (window.EVFirebase?.configured) await window.EVFirebase.signOut();
  } catch (err) {
    console.warn('Logout failed:', err);
  }
  db.user = null;
  persistLocal();
  showLogin();
  document.getElementById('loginForm').reset();
  toast('Logged out');
}

function render() {
  document.querySelectorAll('.nav-item').forEach(button => {
    button.classList.toggle('active', button.dataset.page === state.page);
  });
  document.getElementById('pageTitle').textContent = TITLES[state.page] || 'Dashboard';
  const pages = {
    dashboard, students: studentsPage, attendance: attendancePage, fees: feesPage, more: morePage,
    profile: profilePage, addStudent: addStudentPage, notifications: notificationsPage, batches: batchesPage,
    exams: examsPage, performance: performancePage, materials: materialsPage, homework: homeworkPage,
    online: onlinePage, income: incomePage, expenses: expensesPage, enquiries: enquiriesPage, staff: staffPage,
    reports: reportsPage, settings: settingsPage, backup: backupPage
  };
  document.getElementById('pageContent').innerHTML = (pages[state.page] || dashboard)();
}

function stat(icon, label, value) {
  return `<div class="stat-card"><div class="stat-icon">${icon}</div><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

function action(icon, label, page) {
  return `<button class="action-btn" type="button" onclick="go('${page}')">${icon} ${label}</button>`;
}

function dashboard() {
  const due = db.students.reduce((sum, student) => sum + Number(student.due || 0), 0);
  const avg = db.students.length
    ? Math.round(db.students.reduce((sum, student) => sum + Number(student.att || 0), 0) / db.students.length)
    : 0;
  const today = attendanceCounts('all');
  return `
    <div class="hero-card"><h3>Good Morning, ${esc(db.user?.name || 'Shahid Sir')} 👋</h3><p>EZEE VISION CHAMPUA • Smart Coaching Management</p></div>
    <div class="grid">
      ${stat('👨‍🎓', 'Students', db.students.length)}
      ${stat('🏫', 'Batches', db.batches.length)}
      ${stat('✓', 'Attendance', avg + '%')}
      ${stat('₹', 'Fees Due', money(due))}
    </div>
    <div class="section-title"><h3>Quick Actions</h3></div>
    <div class="quick-grid">
      ${action('＋', 'Add Student', 'addStudent')}
      ${action('✓', 'Take Attendance', 'attendance')}
      ${action('₹', 'Collect Fee', 'fees')}
      ${action('📝', 'Create Exam', 'exams')}
      ${action('📚', 'Add Material', 'materials')}
    </div>
    <div class="section-title"><h3>Today's Attendance</h3><small>${dateText()}</small></div>
    <div class="list-card">
      <div class="activity">🟢 Present <b>${today.present}</b></div>
      <div class="activity">🔴 Absent <b>${today.absent}</b></div>
      <div class="activity">📊 Percentage <b>${today.percent}%</b></div>
    </div>
    <div class="section-title"><h3>Recent Activity</h3></div>
    <div class="list-card">
      ${db.payments.slice(-5).reverse().map(payment => `<div class="activity">💰 ${esc(payment.name)} paid ${money(payment.amount)} <small>${esc(payment.date || '')}</small></div>`).join('') || '<div class="activity">✨ No payments recorded yet</div>'}
    </div>`;
}

function attendanceCounts(batch = 'all') {
  const students = batch === 'all' ? db.students : db.students.filter(student => student.batch === batch);
  let present = 0;
  let absent = 0;
  students.forEach(student => {
    const value = db.attendance[`${todayKey()}_${student.id}`] || 'present';
    value === 'absent' ? absent++ : present++;
  });
  const total = present + absent;
  return { present, absent, percent: total ? Math.round((present / total) * 100) : 0 };
}

function studentsPage() {
  const filter = state.studentFilter;
  const filtered = filterStudentsData('', filter);
  return `
    <div class="toolbar-row"><input class="search" id="studentSearch" placeholder="🔍 Search students..." oninput="searchStudents(this.value)"></div>
    <div class="filters">
      <button class="chip ${filter === 'all' ? 'active' : ''}" onclick="setStudentFilter('all')">All</button>
      <button class="chip ${filter === 'active' ? 'active' : ''}" onclick="setStudentFilter('active')">Active</button>
      <button class="chip ${filter === 'due' ? 'active' : ''}" onclick="setStudentFilter('due')">Fees Due</button>
    </div>
    <div id="studentList">${studentCards(filtered)}</div>
    <button class="primary-btn" type="button" onclick="go('addStudent')">＋ ADD STUDENT</button>`;
}

function filterStudentsData(query = '', filter = state.studentFilter) {
  const q = query.trim().toLowerCase();
  return db.students.filter(student => {
    const matchesQuery = !q || `${student.name} ${student.cls} ${student.batch} ${student.phone}`.toLowerCase().includes(q);
    const matchesFilter = filter === 'due' ? Number(student.due) > 0 : filter === 'active' ? student.active !== false : true;
    return matchesQuery && matchesFilter;
  });
}

function searchStudents(query) {
  const list = document.getElementById('studentList');
  if (list) list.innerHTML = studentCards(filterStudentsData(query));
}

function setStudentFilter(filter) {
  state.studentFilter = filter;
  render();
}

function studentCards(students) {
  return students.map(student => `
    <button class="student-card" type="button" onclick="openStudent('${esc(student.id)}')">
      <div class="avatar">${esc(initials(student.name))}</div>
      <div class="student-main"><strong>${esc(student.name)}</strong><small>${esc(student.cls)} • ${esc(student.batch)}</small></div>
      <div class="student-meta">${Number(student.att || 0)}%<br>${money(student.due)} due</div>
    </button>`).join('') || '<div class="list-card empty">No students found.</div>';
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
}

function openStudent(id) {
  state.selectedStudent = id;
  go('profile');
}

function profilePage() {
  const student = db.students.find(item => item.id === state.selectedStudent) || db.students[0];
  if (!student) return studentsPage();
  return `
    <button class="back-btn" type="button" onclick="go('students')">← Back</button>
    <div class="panel"><div class="profile-head"><div class="avatar big">${esc(initials(student.name))}</div><div><h3>${esc(student.name)}</h3><div class="muted">${esc(student.cls)} • ${esc(student.batch)}</div></div></div></div>
    <div class="panel">
      <div class="kv"><span>Student ID</span><b>${esc(student.id)}</b></div>
      <div class="kv"><span>Attendance</span><b>${Number(student.att || 0)}%</b></div>
      <div class="kv"><span>Fees Due</span><b>${money(student.due)}</b></div>
      <div class="kv"><span>Parent / Mobile</span><b>${esc(student.phone || 'Not added')}</b></div>
    </div>
    <div class="quick-grid">${action('✓', 'Attendance', 'attendance')}${action('₹', 'Collect Fee', 'fees')}${action('📈', 'Performance', 'performance')}${action('📝', 'Exams', 'exams')}</div>
    <div class="button-row"><button class="secondary-btn" type="button" onclick="editStudent('${esc(student.id)}')">✏️ EDIT STUDENT</button><button class="danger" type="button" onclick="deleteStudent('${esc(student.id)}')">DELETE STUDENT</button></div>`;
}

function addStudentPage() {
  return `
    <button class="back-btn" type="button" onclick="go('students')">← Back</button>
    <div class="panel"><h3>Add New Student</h3>
      <form onsubmit="saveStudent(event)">
        <label>Name</label><input class="field" id="newName" required placeholder="Student name">
        <label>Class</label><input class="field" id="newClass" required placeholder="Class 10">
        <label>Batch</label><select class="field" id="newBatch">${db.batches.map(batch => `<option value="${esc(batch)}">${esc(batch)}</option>`).join('')}</select>
        <label>Parent / Mobile</label><input class="field" id="newPhone" inputmode="tel" placeholder="Optional">
        <label>Opening Fee Due</label><input class="field" id="newDue" type="number" min="0" step="1" value="0" placeholder="0">
        <button class="primary-btn" type="submit">SAVE STUDENT</button>
      </form>
    </div>`;
}

function makeStudentId() {
  let id;
  do { id = 'EV' + String(Date.now() + Math.floor(Math.random() * 1000)).slice(-7); }
  while (db.students.some(student => student.id === id));
  return id;
}

function saveStudent(event) {
  event.preventDefault();
  const name = document.getElementById('newName').value.trim();
  const cls = document.getElementById('newClass').value.trim();
  const batch = document.getElementById('newBatch').value;
  const phone = document.getElementById('newPhone').value.trim();
  const due = Math.max(0, Number(document.getElementById('newDue').value || 0));
  if (!name || !cls || !batch) return toast('Please fill required fields.');
  db.students.push({ id: makeStudentId(), name, cls, batch, phone, att: 100, due });
  save({ toastMessage: 'Student saved ☁️' });
  go('students');
}

function editStudent(id) {
  const student = db.students.find(item => item.id === id);
  if (!student) return toast('Student not found.');
  const name = prompt('Student name', student.name);
  if (name === null) return;
  const cls = prompt('Class', student.cls);
  if (cls === null) return;
  const phone = prompt('Parent / Mobile', student.phone || '');
  if (phone === null) return;
  const dueText = prompt('Current fee due', String(student.due || 0));
  if (dueText === null) return;
  const due = Number(dueText);
  if (!name.trim() || !cls.trim() || !Number.isFinite(due) || due < 0) return toast('Invalid student details.');
  student.name = name.trim();
  student.cls = cls.trim();
  student.phone = phone.trim();
  student.due = due;
  save({ toastMessage: 'Student updated ☁️' });
  render();
}

function deleteStudent(id) {
  const student = db.students.find(item => item.id === id);
  if (!student || !confirm(`Delete ${student.name}? This cannot be undone.`)) return;
  db.students = db.students.filter(item => item.id !== id);
  Object.keys(db.attendance).forEach(key => { if (key.endsWith(`_${id}`)) delete db.attendance[key]; });
  save({ toastMessage: 'Student deleted ☁️' });
  go('students');
}

function attendancePage() {
  const batch = state.attendanceBatch;
  const students = batch === 'all' ? db.students : db.students.filter(student => student.batch === batch);
  const counts = attendanceCounts(batch);
  return `
    <div class="panel"><label><b>Select Batch</b><select class="field" onchange="setAttendanceBatch(this.value)"><option value="all" ${batch === 'all' ? 'selected' : ''}>All Batches</option>${db.batches.map(item => `<option value="${esc(item)}" ${batch === item ? 'selected' : ''}>${esc(item)}</option>`).join('')}</select></label><p class="muted">Date: ${new Date().toLocaleDateString('en-IN')}</p></div>
    <div class="grid"><div class="stat-card"><div class="label">Present</div><div class="value">${counts.present}</div></div><div class="stat-card"><div class="label">Absent</div><div class="value">${counts.absent}</div></div></div>
    <div class="list-card attendance-list">${students.map(student => attendanceRow(student)).join('') || '<div class="activity">No students in this batch.</div>'}</div>
    <button class="primary-btn" type="button" onclick="markAllPresent()">MARK ALL PRESENT</button>
    <button class="secondary-btn" type="button" onclick="saveAttendance()">SAVE ATTENDANCE</button>`;
}

function attendanceRow(student) {
  const key = `${todayKey()}_${student.id}`;
  const value = db.attendance[key] || 'present';
  return `<div class="attendance-row"><div class="avatar">${esc(initials(student.name))}</div><div class="row-main"><strong>${esc(student.name)}</strong><small>${esc(student.batch)} • ${esc(student.cls)}</small></div><button class="toggle ${value}" type="button" onclick="toggleAttendance('${esc(student.id)}',this)">${value === 'present' ? 'Present' : 'Absent'}</button></div>`;
}

function setAttendanceBatch(batch) {
  state.attendanceBatch = batch;
  render();
}

function toggleAttendance(id, button) {
  const key = `${todayKey()}_${id}`;
  db.attendance[key] = db.attendance[key] === 'absent' ? 'present' : 'absent';
  button.className = `toggle ${db.attendance[key]}`;
  button.textContent = db.attendance[key] === 'present' ? 'Present' : 'Absent';
  save();
  const counts = attendanceCounts(state.attendanceBatch);
  toast(`${counts.present} present • ${counts.absent} absent`);
}

function markAllPresent() {
  const students = state.attendanceBatch === 'all' ? db.students : db.students.filter(student => student.batch === state.attendanceBatch);
  students.forEach(student => { db.attendance[`${todayKey()}_${student.id}`] = 'present'; });
  save({ toastMessage: 'Attendance saved ☁️' });
  render();
}

function saveAttendance() {
  save({ toastMessage: 'Attendance saved to Firebase ☁️', immediate: true });
}

function feesPage() {
  const due = db.students.reduce((sum, student) => sum + Number(student.due || 0), 0);
  const collection = db.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return `
    <div class="grid">${stat('₹', 'Total Collection', money(collection))}${stat('!', 'Pending', money(due))}</div>
    <div class="section-title"><h3>Fee Records</h3></div>
    <div class="list-card">${db.students.map(student => `
      <div class="fee-row"><div class="avatar">${esc(initials(student.name))}</div><div class="row-main"><strong>${esc(student.name)}</strong><small>${esc(student.batch)}</small></div><div class="fee-due">${money(student.due)} due<br><button class="chip" type="button" onclick="collectFee('${esc(student.id)}')">Collect</button></div></div>`).join('') || '<div class="activity">No students found.</div>'}</div>
    <div class="section-title"><h3>Recent Payments</h3></div>
    <div class="list-card">${db.payments.slice(-10).reverse().map(payment => `<div class="activity">💰 ${esc(payment.name)} • ${money(payment.amount)} <small>${esc(payment.date || '')}</small></div>`).join('') || '<div class="activity">No payments recorded.</div>'}</div>`;
}

function collectFee(id) {
  const student = db.students.find(item => item.id === id);
  if (!student) return toast('Student not found.');
  const amountText = prompt(`Payment amount for ${student.name}`, String(student.due || 0));
  if (amountText === null) return;
  const amount = Number(amountText);
  if (!Number.isFinite(amount) || amount <= 0) return toast('Enter a valid payment amount.');
  student.due = Math.max(0, Number(student.due || 0) - amount);
  db.payments.push({ id: `PAY${Date.now()}`, studentId: student.id, name: student.name, amount, date: todayKey() });
  save({ toastMessage: `Payment recorded: ${money(amount)} ☁️` });
  render();
}

function morePage() {
  const modules = [
    ['🏫', 'Batches', 'batches'], ['📝', 'Exams', 'exams'], ['📈', 'Performance', 'performance'],
    ['📚', 'Study Material', 'materials'], ['🏠', 'Homework', 'homework'], ['🖥️', 'Online Exams', 'online'],
    ['💵', 'Income', 'income'], ['💸', 'Expenses', 'expenses'], ['📩', 'Enquiries', 'enquiries'],
    ['👨‍🏫', 'Staff', 'staff'], ['📊', 'Reports', 'reports'], ['🔔', 'Notifications', 'notifications'],
    ['☁️', 'Backup & Restore', 'backup'], ['⚙️', 'Settings', 'settings']
  ];
  return `<div class="module-grid">${modules.map(module => `<button class="module-card" type="button" onclick="go('${module[2]}')"><span class="ico">${module[0]}</span><strong>${module[1]}</strong><small>Open module</small></button>`).join('')}</div><button class="danger" type="button" onclick="logout()">↪ LOG OUT</button>`;
}

function notificationsPage() {
  return `<button class="back-btn" type="button" onclick="go('more')">← More</button>${db.notifications.map((item, index) => `<div class="panel notification-item"><b>🔔 ${esc(item)}</b><p class="muted">EZEE VISION CHAMPUA</p><button class="chip" type="button" onclick="deleteNotification(${index})">Delete</button></div>`).join('') || '<div class="panel">No notifications.</div>'}<button class="primary-btn" type="button" onclick="addNotification()">＋ ADD NOTIFICATION</button>`;
}

function addNotification() {
  const value = prompt('Notification text');
  if (!value?.trim()) return;
  db.notifications.unshift(value.trim());
  save({ toastMessage: 'Notification added ☁️' });
  render();
}

function deleteNotification(index) {
  if (!confirm('Delete this notification?')) return;
  db.notifications.splice(index, 1);
  save({ toastMessage: 'Notification deleted ☁️' });
  render();
}

function batchesPage() {
  return `<button class="back-btn" type="button" onclick="go('more')">← More</button><div class="module-grid">${db.batches.map(batch => `<button class="module-card" type="button" onclick="setAttendanceBatch('${esc(batch)}');go('attendance')"><span class="ico">🏫</span><strong>${esc(batch)}</strong><small>${db.students.filter(student => student.batch === batch).length} students</small></button>`).join('') || '<div class="panel">No batches.</div>'}</div><button class="primary-btn" type="button" onclick="addBatch()">＋ ADD BATCH</button>`;
}

function addBatch() {
  const value = prompt('Batch name');
  const name = value?.trim();
  if (!name) return;
  if (db.batches.some(batch => batch.toLowerCase() === name.toLowerCase())) return toast('Batch already exists.');
  db.batches.push(name);
  save({ toastMessage: 'Batch added ☁️' });
  render();
}

function modulePage(type, title, icon) {
  const records = db.items[type] || [];
  return `<button class="back-btn" type="button" onclick="go('more')">← More</button><div class="panel"><h3>${icon} ${title}</h3><p class="muted">Firebase cloud-synced module.</p><button class="primary-btn" type="button" onclick="addItem('${type}','${esc(title)}')">＋ ADD ${esc(title).toUpperCase()}</button></div><div class="list-card">${records.map((item, index) => `<div class="activity activity-with-action"><b>${esc(item)}</b><button class="chip" type="button" onclick="deleteItem('${type}',${index})">Delete</button></div>`).join('') || '<div class="activity">No records yet.</div>'}</div>`;
}

function addItem(type, title) {
  const value = prompt(`Enter ${title} name`);
  if (!value?.trim()) return;
  db.items[type].push(value.trim());
  save({ toastMessage: `${title} added ☁️` });
  render();
}

function deleteItem(type, index) {
  if (!confirm('Delete this record?')) return;
  db.items[type].splice(index, 1);
  save({ toastMessage: 'Record deleted ☁️' });
  render();
}

function examsPage() { return modulePage('exams', 'Exams', '📝'); }
function materialsPage() { return modulePage('materials', 'Study Material', '📚'); }
function homeworkPage() { return modulePage('homework', 'Homework', '🏠'); }
function onlinePage() { return modulePage('online', 'Online Exams', '🖥️'); }
function incomePage() { return modulePage('income', 'Income', '💵'); }
function expensesPage() { return modulePage('expenses', 'Expenses', '💸'); }
function enquiriesPage() { return modulePage('enquiries', 'Enquiries', '📩'); }
function staffPage() { return modulePage('staff', 'Staff', '👨‍🏫'); }

function performancePage() {
  return `<button class="back-btn" type="button" onclick="go('more')">← More</button><div class="panel"><h3>📈 Performance</h3>${db.students.map(student => `<div class="kv"><span>${esc(student.name)}</span><b>${Number(student.att || 0)}% attendance</b></div>`).join('') || '<div class="muted">No students yet.</div>'}</div>`;
}

function reportsPage() {
  const reports = ['Student Report', 'Attendance Report', 'Fees Report', 'Payment Report'];
  return `<button class="back-btn" type="button" onclick="go('more')">← More</button><div class="module-grid">${reports.map(name => `<button class="module-card" type="button" onclick="exportReport('${esc(name)}')"><span class="ico">📊</span><strong>${esc(name)}</strong><small>Export CSV</small></button>`).join('')}</div>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function exportReport(name) {
  let rows = [];
  if (name === 'Student Report') {
    rows = [['ID', 'Name', 'Class', 'Batch', 'Mobile', 'Attendance %', 'Fee Due'], ...db.students.map(student => [student.id, student.name, student.cls, student.batch, student.phone, student.att, student.due])];
  } else if (name === 'Attendance Report') {
    rows = [['Date', 'Student ID', 'Name', 'Batch', 'Status'], ...db.students.map(student => [todayKey(), student.id, student.name, student.batch, db.attendance[`${todayKey()}_${student.id}`] || 'present'])];
  } else if (name === 'Fees Report') {
    rows = [['Student ID', 'Name', 'Batch', 'Fee Due'], ...db.students.map(student => [student.id, student.name, student.batch, student.due])];
  } else {
    rows = [['Payment ID', 'Date', 'Student ID', 'Name', 'Amount'], ...db.payments.map(payment => [payment.id, payment.date, payment.studentId, payment.name, payment.amount])];
  }
  const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
  downloadFile(`${name.replace(/\s+/g, '-').toLowerCase()}.csv`, csv, 'text/csv;charset=utf-8');
  toast(`${name} exported`);
}

function backupPage() {
  return `<button class="back-btn" type="button" onclick="go('more')">← More</button><div class="panel"><h3>☁️ Backup & Restore</h3><p class="muted">Download a JSON backup or restore one. Restored data is synced to Firebase.</p><button class="primary-btn" type="button" onclick="downloadBackup()">DOWNLOAD BACKUP</button><label class="secondary-btn file-btn">RESTORE BACKUP<input type="file" accept="application/json,.json" onchange="restoreBackup(event)" hidden></label></div>`;
}

function downloadBackup() {
  downloadFile('ezee-vision-backup.json', JSON.stringify(db, null, 2), 'application/json');
  toast('Backup downloaded');
}

function restoreBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(reader.result);
      db = normalizeData(parsed);
      if (window.EVFirebase?.auth?.currentUser) {
        db.user = { ...db.user, uid: window.EVFirebase.auth.currentUser.uid, login: window.EVFirebase.auth.currentUser.email || db.user?.login || '' };
      }
      save({ toastMessage: 'Backup restored and synced ☁️', immediate: true });
      render();
    } catch (_) {
      toast('Invalid backup file.');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function settingsPage() {
  const connected = Boolean(window.EVFirebase?.configured && window.EVFirebase?.auth?.currentUser);
  return `<button class="back-btn" type="button" onclick="go('more')">← More</button><div class="panel"><h3>⚙️ Settings</h3><div class="kv"><span>Account</span><button class="chip" type="button" onclick="go('profile')">Open Profile</button></div><div class="kv"><span>Login</span><b>${esc(db.user?.login || '—')}</b></div><div class="kv"><span>Data storage</span><b>Firebase + local cache</b></div><div class="kv"><span>Cloud backend</span><b>${connected ? 'Connected ✓' : 'Not connected'}</b></div></div><button class="danger" type="button" onclick="resetData()">RESET MY DATA</button>`;
}

async function resetData() {
  if (!confirm('Reset your coaching data to the starter state? This will replace your current cloud data.')) return;
  const currentUser = db.user;
  db = clone(DEFAULT_DB);
  db.user = currentUser;
  save({ toastMessage: 'Data reset and synced ☁️', immediate: true });
  state = { page: 'dashboard', selectedStudent: null, attendanceBatch: 'all', studentFilter: 'all' };
  render();
}

window.addEventListener('DOMContentLoaded', init);
