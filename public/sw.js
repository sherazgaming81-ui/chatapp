// Service Worker — /public/sw.js, serve hota hai https://…/sw.js par.
// Usage: components/v1/PWAInit.tsx se register hota hai (ek dafa, root layout me).
// Kaam: (1) app shell cache karna, (2) navigations/static ke liye cache-first +
// network fallback, (3) push notifications dikhana, (4) notification click par "/" kholna.

const CACHE_VERSION = "chat-v6"; // v6: aggressive auto cache-bust — version.json mismatch par auto-reload
const CACHE_NAME = `chat-cache-${CACHE_VERSION}`;
const APP_SHELL = ["/"];

// Install: app shell ko cache me daal do
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: purane caches saaf karo, foran control lo
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: navigations ke liye NETWORK-FIRST (hamesha taza HTML), static assets ke liye cache-first
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // v6: version.json hamesha NETWORK se — version check kabhi stale na ho.
  // (Yahi file PWAInit ko batati hai ke naya deploy aaya hai.)
  if (url.pathname === "/version.json") {
    event.respondWith(fetch(req));
    return;
  }

  // Navigation (HTML pages): pehle network try karo, fail ho to cache
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Static assets (JS/CSS/images): cache-first (inme hash hota hai, safe hain)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          throw new Error("offline");
        });
    })
  );
});

// Push: server se aaye payload se notification dikhao
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Chat";
  const options = {
    body: data.body || "Naya message aaya hai",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "chat-message",
    renotify: true,
    data: { chatId: data.chatId || null, url: "/" },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click: relevant tab focus karo, warna "/" kholo
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
