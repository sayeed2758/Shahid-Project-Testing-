const CACHE='ezee-student-v16';
const CORE=['./','./index.html','./manifest.json','./assets/css/style.css','./assets/js/firebase-config.js?v=16','./assets/js/firebase.js?v=16','./assets/js/catalog.js?v=16','./assets/js/admin-config.js?v=16','./assets/js/app.js?v=16','./assets/images/logo.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))})
