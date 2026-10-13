// PushSetup.tsx — browser push-notification setup card.
// Props: { onDone?: () => void } — onDone() is called once notifications get enabled.
// Usage: import PushSetup from '@/components/v1/PushSetup'; <PushSetup onDone={() => console.log('push on')} />
'use client';

import { useEffect, useState } from 'react';
import { backend } from '@/lib/backend';

type State = 'idle' | 'enabling' | 'enabled' | 'blocked' | 'unsupported' | 'novapid';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function keyToBase64(key: ArrayBuffer | null): string {
  if (!key) return '';
  const bytes = new Uint8Array(key);
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return window.btoa(str);
}

export default function PushSetup({ onDone }: { onDone?: () => void } = {}) {
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setState('novapid');
      return;
    }
    if (Notification.permission === 'granted') {
      // Double-check an active subscription exists
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setState(sub ? 'enabled' : 'idle'))
        .catch(() => setState('idle'));
    } else if (Notification.permission === 'denied') {
      setState('blocked');
    }
  }, []);

  const enable = async () => {
    setError('');
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setState('unsupported');
      return;
    }
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) {
      setState('novapid');
      return;
    }
    setState('enabling');
    try {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') {
        setState('blocked');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      }));
      const json = sub.toJSON();
      await backend.subscribePush({
        endpoint: sub.endpoint,
        keys: {
          p256dh: json.keys?.p256dh ?? keyToBase64(sub.getKey('p256dh')),
          auth: json.keys?.auth ?? keyToBase64(sub.getKey('auth')),
        },
      });
      setState('enabled');
      onDone?.();
    } catch (e) {
      console.error('Push setup failed:', e);
      setError('Kuch ghalat ho gaya, dobara try karein.');
      setState('idle');
    }
  };

  const disable = async () => {
    setError('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await backend.unsubscribePush();
      setState('idle');
    } catch (e) {
      console.error('Push disable failed:', e);
      setError('Band karne mein masla hua, dobara try karein.');
    }
  };

  const card =
    'w-full max-w-md rounded-xl bg-[#111b21] border border-[#202c33] p-4 text-white shadow-lg';
  const btnPrimary =
    'rounded-full bg-[#00a884] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#06cf9c] disabled:opacity-60 disabled:cursor-not-allowed transition';
  const btnGhost =
    'rounded-full px-5 py-2.5 text-sm font-medium text-[#8696a0] hover:text-white hover:bg-[#202c33] transition';

  if (state === 'unsupported') {
    return (
      <div className={card}>
        <p className="text-sm font-semibold">Notifications on karein</p>
        <p className="mt-1 text-sm text-[#8696a0]">
          Aapka browser push notifications support nahi karta.
        </p>
      </div>
    );
  }

  if (state === 'novapid') {
    return (
      <div className={card}>
        <p className="text-sm font-semibold">Notifications on karein</p>
        <p className="mt-1 text-sm text-[#8696a0]">Push setup nahi hua.</p>
      </div>
    );
  }

  if (state === 'blocked') {
    return (
      <div className={card}>
        <p className="text-sm font-semibold">Notifications on karein</p>
        <p className="mt-1 text-sm text-[#8696a0]">
          Notifications block hain. Browser ki settings mein jaa kar is site ke liye notifications
          allow karein, phir yahan dobara try karein.
        </p>
        <button className={btnPrimary + ' mt-3'} onClick={enable}>
          Dobara try karein
        </button>
      </div>
    );
  }

  if (state === 'enabled') {
    return (
      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Notifications on hain ✓</p>
            <p className="mt-1 text-sm text-[#8696a0]">
              Naye message par aapko khabar mil jayegi.
            </p>
          </div>
          <button className={btnGhost} onClick={disable}>
            Band karein
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className={card}>
      <p className="text-sm font-semibold">Notifications on karein</p>
      <p className="mt-1 text-sm text-[#8696a0]">
        Naye message par khabar milegi — chahe app khuli ho ya na ho.
      </p>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <button className={btnPrimary + ' mt-3'} onClick={enable} disabled={state === 'enabling'}>
        {state === 'enabling' ? 'On ho raha hai...' : 'Notifications on karein'}
      </button>
    </div>
  );
}
