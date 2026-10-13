// Service Worker — /public/sw.js, serve hota hai https://…/sw.js par.
// Usage: components/v1/PWAInit.tsx se register hota hai (ek dafa, root layout me).
// Kaam: (1) app shell cache karna, (2) navigations/static ke liye cache-first +
// network fallback, (3) push notifications dikhana, (4) notification click par "/" kholna.

const CACHE_VERSION = "chat-v1";
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

// Fetch: same-origin GET requests ke liye cache-first, warna network
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Sirf valid responses cache karo
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          // Offline ho aur navigation ho to cached "/" dikhao
          if (req.mode === "navigate") return caches.match("/");
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

  event.waitUntil(
    self.registration.showNotification(data.title || "Chat", {
      body: data.body || "Naya message aaya hai",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || "chat-message",
    })
  );
});

// Notification click: "/" wala tab focus karo ya naya kholo
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow("/");
      })
  );
});
