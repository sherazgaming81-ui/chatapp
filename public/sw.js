// ChatsApp service worker — intentionally tiny (no stale caches). Remote "full wipe" unregisters this.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
