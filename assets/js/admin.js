(function(){
  "use strict";
  const F=window.EVFirebase||{};
  const C=window.EVCatalog;
  const ADM=(window.EV_ADMIN_CONFIG?.emails||[]).map(x=>String(x).trim().toLowerCase());
  const $=id=>document.getElementById(id);
  const ui={auth:$('authView'),panel:$('panelView'),form:$('adminLoginForm'),email:$('adminEmail'),pass:$('adminPassword'),login:$('adminLoginBtn'),google:$('adminGoogleBtn'),message:$('authMessage'),toast:$('toast'),identity:$('adminIdentity'),metrics:$('metrics'),upload:$('uploadForm'),class:$('classSelect'),subject:$('subjectSelect'),section:$('sectionSelect'),title:$('titleInput'),file:$('fileInput'),replace:$('replaceBox'),uploadBtn:$('uploadBtn'),reset:$('resetFormBtn'),progress:$('progressWrap'),bar:$('progressBar'),pct:$('progressText'),status:$('progressStatus'),library:$('libraryList'),search:$('librarySearch'),classFilter:$('libraryClassFilter'),sectionFilter:$('librarySectionFilter')};
  const state={catalog:{},editing:null,tab:'upload'};
  const isAdmin=user=>!!user?.email&&ADM.includes(user.email.toLowerCase());
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast=m=>{ui.toast.textContent=m;ui.toast.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>ui.toast.classList.remove('show'),3000)};
  const fmt=n=>{n=Number(n||0);if(n<1024)return `${n} B`;if(n<1024**2)return `${(n/1024).toFixed(1)} KB`;if(n<1024**3)return `${(n/1024**2).toFixed(1)} MB`;return `${(n/1024**3).toFixed(2)} GB`};
  const slug=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const allItems=()=>C.flattenCatalog(C.normalizeCatalog(state.catalog));
  const currentSection=()=>C.SECTIONS.find(x=>x.id===ui.section.value);

  function setBusy(b,label='PLEASE WAIT…'){ui.login.disabled=b;ui.google.disabled=b;ui.login.textContent=b?label:'SIGN IN'}
  function showAuth(msg=''){ui.auth.classList.remove('hidden');ui.panel.classList.add('hidden');ui.message.textContent=msg}
  function showPanel(user){ui.auth.classList.add('hidden');ui.panel.classList.remove('hidden');ui.identity.textContent=`Signed in as ${user.email}`;}
  function populateSelects(){
    ui.class.innerHTML=C.CLASSES.map(c=>`<option value="${c}">Class ${c}</option>`).join('');
    ui.subject.innerHTML=C.SUBJECTS.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
    ui.section.innerHTML=C.SECTIONS.map(s=>`<option value="${s.id}">${esc(s.name)}${s.protected?' • Protected':''}</option>`).join('');
    ui.classFilter.innerHTML='<option value="all">All Classes</option>'+C.CLASSES.map(c=>`<option value="${c}">Class ${c}</option>`).join('');
    ui.sectionFilter.innerHTML='<option value="all">All Sections</option>'+C.SECTIONS.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
  }
  function fillForEdit(it){
    state.editing=it;
    ui.class.value=it.classId;ui.subject.value=it.subjectId;ui.section.value=it.sectionId;ui.title.value=it.title||'';ui.file.required=false;
    ui.replace.classList.remove('hidden');ui.replace.innerHTML=`<strong>Replacing:</strong> ${esc(it.title)} <span>• ${esc(it.originalName||it.filePath||'existing PDF')}</span>`;
    ui.uploadBtn.textContent='REPLACE & PUBLISH';
    switchTab('upload');window.scrollTo({top:0,behavior:'smooth'});
  }
  function resetForm(){state.editing=null;ui.upload.reset();ui.file.required=true;ui.replace.classList.add('hidden');ui.replace.innerHTML='';ui.uploadBtn.textContent='UPLOAD & PUBLISH';hideProgress();}
  function showProgress(p,status){ui.progress.classList.remove('hidden');ui.bar.style.width=`${p}%`;ui.pct.textContent=`${p}%`;ui.status.textContent=status}
  function hideProgress(){ui.progress.classList.add('hidden');ui.bar.style.width='0%';ui.pct.textContent='0%';ui.status.textContent='Preparing…'}
  function metrics(){
    const items=allItems(), protectedCount=items.filter(x=>x.sectionId!=='worksheet').length, worksheets=items.filter(x=>x.sectionId==='worksheet').length, bytes=items.reduce((n,x)=>n+Number(x.size||0),0);
    ui.metrics.innerHTML=`<div class="metric"><span>📚</span><small>Total PDFs</small><strong>${items.length}</strong></div><div class="metric"><span>🔒</span><small>Protected</small><strong>${protectedCount}</strong></div><div class="metric"><span>📄</span><small>Worksheets</small><strong>${worksheets}</strong></div><div class="metric"><span>☁️</span><small>Catalog size</small><strong>${fmt(bytes)}</strong></div>`;
  }
  function renderLibrary(){
    const q=ui.search.value.trim().toLowerCase(),cf=ui.classFilter.value,sf=ui.sectionFilter.value;
    let items=allItems().filter(it=>(cf==='all'||it.classId===cf)&&(sf==='all'||it.sectionId===sf));
    if(q)items=items.filter(it=>`${it.title} ${it.classId} ${it.subjectId} ${C.SUBJECTS.find(s=>s.id===it.subjectId)?.name||''} ${C.SECTIONS.find(s=>s.id===it.sectionId)?.name||''}`.toLowerCase().includes(q));
    items.sort((a,b)=>Number(a.classId)-Number(b.classId)||a.subjectId.localeCompare(b.subjectId)||a.sectionId.localeCompare(b.sectionId)||Number(a.order||0)-Number(b.order||0));
    if(!items.length){ui.library.innerHTML=`<div class="empty"><div>📚</div><strong>No published material</strong><p>Upload your first PDF from the Upload tab.</p><button class="primary compact" data-open-upload type="button">＋ UPLOAD PDF</button></div>`;return}
    ui.library.innerHTML=items.map(it=>{const s=C.SUBJECTS.find(x=>x.id===it.subjectId),sec=C.SECTIONS.find(x=>x.id===it.sectionId);return`<article class="library-card"><div class="file-icon">${sec?.icon||'📄'}</div><div class="file-info"><strong>${esc(it.title)}</strong><small>Class ${it.classId} • ${esc(s?.name||it.subjectId)} • ${esc(sec?.name||it.sectionId)}</small><small>${esc(it.originalName||'PDF')} • ${fmt(it.size)} ${it.updatedAt?`• ${new Date(it.updatedAt).toLocaleDateString('en-IN')}`:''}</small></div><div class="file-actions"><button class="ghost small" data-edit="${esc(it.id)}" data-class="${it.classId}" data-subject="${it.subjectId}" data-section="${it.sectionId}" type="button">EDIT</button><button class="danger small" data-delete="${esc(it.id)}" data-class="${it.classId}" data-subject="${it.subjectId}" data-section="${it.sectionId}" type="button">DELETE</button></div></article>`}).join('');
  }
  async function refresh(){
    try{state.catalog=await F.adminCatalog();metrics();renderLibrary();toast('Library refreshed')}catch(e){toast(errorMessage(e))}
  }
  function errorMessage(e){const c=e?.code||'';const map={'auth/invalid-credential':'Email or password is incorrect.','auth/user-not-found':'Admin account not found.','auth/wrong-password':'Password is incorrect.','auth/unauthorized-domain':'This domain is not authorized in Firebase.','storage/unauthorized':'Storage permission denied. Check Storage Rules.','storage/quota-exceeded':'Storage quota/billing access is unavailable. Check the Firebase Blaze plan.','database/permission-denied':'Database permission denied. Check database rules.'};return map[c]||e?.message||'Something went wrong.'}
  function switchTab(tab){state.tab=tab;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$('uploadTab').classList.toggle('hidden',tab!=='upload');$('libraryTab').classList.toggle('hidden',tab!=='library');if(tab==='library')renderLibrary()}
  async function uploadSubmit(e){
    e.preventDefault();
    const user=F.currentUser?.();if(!isAdmin(user))return toast('This Firebase account is not an admin.');
    const file=ui.file.files[0];if(!state.editing&&!file)return toast('Choose a PDF file.');
    if(file&&(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')))return toast('Only PDF files are allowed.');
    if(file&&file.size>25*1024*1024)return toast('PDF must be 25 MB or smaller.');
    const c=ui.class.value,s=ui.subject.value,sec=ui.section.value,title=ui.title.value.trim();if(!title)return toast('Enter a material title.');
    const id=state.editing?.id||`${c}-${s}-${sec}-${Date.now()}`;
    const old=state.editing;
    ui.uploadBtn.disabled=true;ui.reset.disabled=true;
    try{
      let filePath=old?.filePath;
      if(file){
        filePath=`materials/class${c}/${s}/${sec}/${id}.pdf`;
        showProgress(0,'Uploading PDF to Firebase Storage…');
        await F.adminUploadPdf(filePath,file,(p)=>showProgress(p,p<100?'Uploading PDF…':'Upload complete'));
      }
      if(!filePath)throw Error('No PDF file is attached to this material.');
      const siblings=state.catalog?.[c]?.[s]?.[sec]||[];
      const order=old?.order||((Math.max(0,...siblings.map(x=>Number(x.order)||0)))+1);
      const item={id,title,order,protected:!!currentSection()?.protected,filePath,originalName:file?.name||old?.originalName||'',size:file?.size||old?.size||0,contentType:'application/pdf',updatedAt:Date.now()};
      await F.adminSaveItem(c,s,sec,id,item);
      // If replacing and the destination path changed, remove the old object after DB update succeeds.
      if(old?.filePath&&old.filePath!==filePath){try{await F.adminDeleteFile(old.filePath)}catch(e){console.warn('Old file cleanup failed',e)}}
      toast(old?'Material replaced successfully.':'PDF uploaded and published successfully.');
      resetForm();await refresh();switchTab('library');
    }catch(e){toast(errorMessage(e));showProgress(0,'Upload failed.');}
    finally{ui.uploadBtn.disabled=false;ui.reset.disabled=false;}
  }
  async function deleteItem(id,c,s,sec){
    const item=state.catalog?.[c]?.[s]?.[sec]?.find(x=>x.id===id);if(!item)return toast('Material not found.');
    if(!confirm(`Delete “${item.title}”? This removes the catalog entry and its PDF from Storage.`))return;
    try{await F.adminDeleteItem(c,s,sec,id);if(item.filePath){try{await F.adminDeleteFile(item.filePath)}catch(e){console.warn('Storage delete failed',e)}}toast('Material deleted.');await refresh()}catch(e){toast(errorMessage(e))}
  }
  function bindLibrary(){
    ui.library.onclick=e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.openUpload){switchTab('upload');return}
      if(b.dataset.edit){const it=state.catalog?.[b.dataset.class]?.[b.dataset.subject]?.[b.dataset.section]?.find(x=>x.id===b.dataset.edit);if(it)fillForEdit({...it});return}
      if(b.dataset.delete)deleteItem(b.dataset.delete,b.dataset.class,b.dataset.subject,b.dataset.section);
    };
  }
  ui.form.addEventListener('submit',async e=>{e.preventDefault();const email=ui.email.value.trim(),pass=ui.pass.value;if(!email||!pass)return toast('Enter email and password.');setBusy(true);try{await F.signIn(email,pass)}catch(err){setBusy(false);toast(errorMessage(err))}});
  ui.google.addEventListener('click',async()=>{setBusy(true,'OPENING GOOGLE…');try{await F.googleSignIn()}catch(e){setBusy(false);toast(errorMessage(e))}});
  ui.upload.addEventListener('submit',uploadSubmit);ui.reset.addEventListener('click',resetForm);$('refreshBtn').addEventListener('click',refresh);$('adminLogout').addEventListener('click',()=>F.logout());
  ui.search.addEventListener('input',renderLibrary);ui.classFilter.addEventListener('change',renderLibrary);ui.sectionFilter.addEventListener('change',renderLibrary);
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
  bindLibrary();populateSelects();
  F.onAuthStateChanged(async user=>{
    if(!user){showAuth('');setBusy(false);return;}
    if(!isAdmin(user)){
      await F.logout();showAuth('This account is not authorized for the Admin Panel.');toast('Admin access denied.');return;
    }
    showPanel(user);await refresh();
  });
})();
