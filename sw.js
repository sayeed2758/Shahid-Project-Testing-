const CACHE="ezee-student-v1";
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(["./","./index.html","./manifest.json","./assets/css/style.css"]))))
self.addEventListener("fetch",event=>event.respondWith(caches.match(event.request).then(r=>r||fetch(event.request).catch(()=>caches.match("./index.html")))));
