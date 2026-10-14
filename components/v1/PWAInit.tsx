// PWAInit — service worker register karta hai aur naye version ka banner dikhata hai.
// Usage: root layout me ek dafa mount karein:  <PWAInit />
// Props: koi nahi.
// v6: AGGRESSIVE AUTO CACHE-BUST — har app load par /version.json fetch hota hai.
// Agar deploy ka version localStorage se alag ho to: SW ko foran update() karke
// AUTO-RELOAD (user ko refresh/hard-reset ki zaroorat nahi). Reload-loop se
// bachne ke liye sessionStorage guard hai.

'use client';

import { useEffect, useState } from 'react';

const APP_VERSION_KEY = 'chatsapp_version';
const RELOADED_THIS_SESSION_KEY = 'chatsapp_version_reloaded';

export default function PWAInit() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    const handleUpdate = () => setUpdateAvailable(true);

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registration = reg;
        // Agar pehle se naya SW waiting hai to foran banner dikhao
        if (reg.waiting) handleUpdate();
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              handleUpdate();
            }
          });
        });
      })
      .catch(() => {
        // SW register fail (e.g. non-HTTPS/local): chupchaap ignore karo
      });

    return () => {
      registration = null;
    };
  }, []);

  // ---- v6: aggressive auto cache-bust (koi manual refresh nahi chahiye) ----
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    (async () => {
      // Deploy ka version marker — SW isko hamesha network se lata hai (no cache).
      let remote: string | null = null;
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        if (!res.ok) return;
        const data: unknown = await res.json();
        remote =
          typeof data === 'object' &&
          data !== null &&
          'version' in data &&
          typeof (data as { version: unknown }).version === 'string'
            ? (data as { version: string }).version
            : null;
      } catch {
        return; // offline ya fetch fail — chupchaap skip
      }
      if (!remote || cancelled) return;

      let local: string | null = null;
      try {
        local = window.localStorage.getItem(APP_VERSION_KEY);
      } catch {
        /* storage unavailable */
      }

      if (!local) {
        // Pehli dafa — bas note kar lo, reload nahi.
        try {
          window.localStorage.setItem(APP_VERSION_KEY, remote);
        } catch {
          /* ignore */
        }
        return;
      }
      if (local === remote) return; // same version — kuch nahi karna

      // NAYA VERSION: pehle SW ko foran update karne ko kaho…
      // v6.5 NUCLEAR: purana SW kabhi kabhi update() par bhi nahi badalta
      // (browser HTTP cache se purani sw.js de deta hai). Is liye mismatch par
      // tamam SW unregister + tamam caches delete — phir reload. 100% taza.
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister().catch(() => undefined)));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k).catch(() => undefined)));
        }
      } catch {
        /* ignore */
      }
      try {
        window.localStorage.setItem(APP_VERSION_KEY, remote);
      } catch {
        /* ignore */
      }

      // …phir AUTO-RELOAD (session guard: ek session me ek hi dafa).
      let alreadyReloaded = false;
      try {
        alreadyReloaded = window.sessionStorage.getItem(RELOADED_THIS_SESSION_KEY) === '1';
      } catch {
        /* ignore */
      }
      if (!alreadyReloaded && !cancelled) {
        try {
          window.sessionStorage.setItem(RELOADED_THIS_SESSION_KEY, '1');
        } catch {
          /* ignore */
        }
        window.location.reload();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#202c33] text-white text-sm px-4 py-2.5 rounded-full shadow-2xl border border-[#2f3d46] max-w-[92vw]"
      role="status"
      aria-live="polite"
    >
      <span className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse shrink-0" />
      <span className="whitespace-nowrap">Naya version aaya — Refresh karein</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="bg-[#00a884] hover:bg-[#06cf9c] text-[#0b141a] font-semibold text-sm px-3 py-1 rounded-full transition-colors shrink-0"
      >
        Refresh
      </button>
    </div>
  );
}
