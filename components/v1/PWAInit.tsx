// PWAInit — service worker register karta hai aur naye version ka banner dikhata hai.
// Usage: root layout me ek dafa mount karein:  <PWAInit />
// Props: koi nahi. Banner text Hinglish me hai: "Naya version aaya — Refresh karein".
// Refresh button par click karne se window.location.reload() hota hai.

'use client';

import { useEffect, useState } from 'react';

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
