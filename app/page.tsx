'use client';

// v5 entry — device ke hisab se v5 mobile ya v5 desktop shell.
// Shared flow (mobile + desktop DONO): LoadingScreen (7s premium)
//   → Login (agar logout) → UpdatePage (agar version badla, ek dafa)
//   → Onboarding (agar pehli dafa) → GroupChat / DesktopShell.
// PWAInit app/layout.tsx me hai (wahi rehta hai).

import { useEffect, useState } from 'react';
import { getDeviceKind, type DeviceKind } from '@/lib/v2/types';
import { backend } from '@/lib/backend';
import { OWNER_EMAIL } from '@/lib/backend/supabaseBackend';
import type { UserProfile } from '@/lib/backend/types';
import LoginScreen from '@/components/LoginScreen';
import { LoadingScreen } from '@/components/v5/shared';
import {
  Onboarding,
  GroupChat,
  UpdatePage,
  shouldShowUpdate,
  markVersionSeen,
} from '@/components/v5/mobile';
import DesktopShell from '@/components/v5/desktop/DesktopShell';
import PWAInstallPrompt, { hasPWAChoice } from '@/components/v5/shared/PWAInstallPrompt';

const V5_SEEN_KEY = 'v5_seen';
const V5_VERSION = '5.0';
const FORCED_LOGOUT_KEY = 'v5_forced_logout';

/** v5 keys saaf karo (fresh start) — sirf 'v5' prefix wali. */
function clearV5Keys() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('v5')) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

function BootSplash() {
  return (
    <div className="h-dvh w-full flex flex-col items-center justify-center gap-4 bg-[#0b141a]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="ChatsApp" className="w-20 h-20 rounded-3xl animate-pulse" />
      <p className="text-[#8696a0] text-sm">ChatsApp khul raha hai…</p>
    </div>
  );
}

export default function Home() {
  const [kind, setKind] = useState<DeviceKind | null>(null);
  const [booted, setBooted] = useState(false); // LoadingScreen mukammal
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [onbDone, setOnbDone] = useState<boolean>(true); // user aane par per-user check hoga
  const [showUpdate, setShowUpdate] = useState<boolean>(() => shouldShowUpdate());
  const [pwaDone, setPwaDone] = useState<boolean>(true); // user aane par per-user check hoga

  useEffect(() => {
    const update = () => setKind(getDeviceKind());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ---- auth + v5 fresh-start gate (mobile + desktop dono ke liye) ----
  useEffect(() => {
    const off = backend.onAuth(async (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        setOnbDone(true); // logout par onboarding chhupao
        setPwaDone(true); // logout par PWA prompt chhupao
        return;
      }
      // Per-user onboarding check — har account ka apna flag.
      try {
        const done = localStorage.getItem(`v5_onboarding_complete_${u.id}`) === '1'
          || localStorage.getItem('v5_onboarding_complete') === '1';
        setOnbDone(done);
      } catch {
        setOnbDone(false);
      }
      // Per-user PWA install prompt — sirf ek dafa per device.
      try {
        setPwaDone(hasPWAChoice());
      } catch {
        setPwaDone(true);
      }
      try {
        const forced = localStorage.getItem(FORCED_LOGOUT_KEY) === '1';
        const seen = localStorage.getItem(V5_SEEN_KEY);
        const owner = (u.email || '').toLowerCase() === OWNER_EMAIL.toLowerCase();
        if (!forced && seen !== V5_VERSION && !owner) {
          // Purana (v4) session — fresh start: logout + v5 keys saaf.
          // `forced` flag isi device par rehta hai taake dobara login par loop na bane.
          localStorage.setItem(FORCED_LOGOUT_KEY, '1');
          clearV5Keys();
          markVersionSeen(); // update tour skip — seedha login → onboarding
          setShowUpdate(false);
          setOnbDone(false);
          await backend.signOut();
          return;
        }
        localStorage.setItem(V5_SEEN_KEY, V5_VERSION);
      } catch {
        /* ignore */
      }
    });
    return off;
  }, []);

  if (!kind) return <BootSplash />;

  // v6: mobile + desktop DONO ke liye EXACT SAME 7s premium loading animation.
  if (!booted) {
    return <LoadingScreen onDone={() => setBooted(true)} />;
  }

  // ---- shared gates (mobile + desktop dono): pehle login, phir update
  // tour (sirf version bump par, ek dafa), phir onboarding (sirf naye
  // user ke liye) — uske BAAD main UI. Desktop pehle inhen bypass karke
  // seedha DesktopShell me chala jata tha (koi onboarding/update nahi).
  if (!authReady) return <BootSplash />;
  if (!user) return <LoginScreen />;
  if (showUpdate) {
    return <UpdatePage onDone={() => setShowUpdate(false)} />;
  }
  if (!onbDone) {
    return <Onboarding user={user} onDone={() => setOnbDone(true)} />;
  }
  // v6: onboarding ke BAAD PWA install prompt (ek dafa per device).
  if (!pwaDone) {
    return <PWAInstallPrompt onDone={() => setPwaDone(true)} />;
  }

  if (kind === 'desktop') {
    return <DesktopShell />;
  }
  return <GroupChat />;
}
