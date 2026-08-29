const CACHE="ezee-student-v4";
const CORE=["./","./index.html","./manifest.json","./assets/css/style.css","./assets/js/firebase-config.js","./assets/js/catalog.js","./assets/js/firebase.js","./assets/js/app.js","./assets/images/logo.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
