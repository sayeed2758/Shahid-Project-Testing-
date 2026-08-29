// PWA service worker will be implemented after the authentication and private-material strategy is finalized.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
