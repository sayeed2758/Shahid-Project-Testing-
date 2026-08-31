const CACHE_NAME = "ezee-vision-shell-simple-v8-practice-safe";

const APP_SHELL = [
  "./",
  "./index.html",
  "./admin.html",
  "./manifest.json",
  "./assets/css/app.css",
  "./assets/css/admin.css",
  "./assets/js/app.js",
  "./assets/js/auth.js",
  "./assets/js/firebase-init.js",
  "./assets/js/firebase-config.js",
  "./assets/js/catalog.js",
  "./assets/js/search.js",
  "./assets/js/recent.js",
  "./assets/js/pdf-reader.js",
  "./assets/js/admin.js",
  "./assets/js/admin-client.js",
  "./assets/js/profile.js",
  "./assets/images/logo.png",
  "./assets/images/icon-192.png",
  "./assets/images/icon-512.png",
];

const NETWORK_FIRST_EXTENSIONS = new Set([".html", ".js", ".css", ".json"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        for (const asset of APP_SHELL) {
          try { await cache.add(asset); } catch (error) { console.warn("SW cache skipped:", asset, error); }
        }
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function isFirebaseOrPrivateAsset(url) {
  return (
    url.pathname.toLowerCase().endsWith(".pdf") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("firebasestorage.app") ||
    url.hostname.includes("firebaseapp.com")
  );
}

function extensionOf(pathname) {
  const last = pathname.split("/").pop() || "";
  const dot = last.lastIndexOf(".");
  return dot >= 0 ? last.slice(dot).toLowerCase() : "";
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    isFirebaseOrPrivateAsset(url)
  ) {
    return;
  }

  const extension = extensionOf(url.pathname);

  if (NETWORK_FIRST_EXTENSIONS.has(extension) || request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          if (request.mode === "navigate") {
            const shell = await caches.match("./index.html");
            if (shell) return shell;
          }
          return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
