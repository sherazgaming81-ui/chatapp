'use client';

// v2 entry — device ke hisab se Mobile ya Desktop shell render hota hai.
// Dono shells khud auth, chats, theme sab sambhalte hain.

import { useEffect, useState } from 'react';
import { getDeviceKind, type DeviceKind } from '@/lib/v2/types';
import MobileShell from '@/components/v2/mobile/MobileShell';
import DesktopShell from '@/components/v2/desktop/DesktopShell';

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

  useEffect(() => {
    const update = () => setKind(getDeviceKind());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (!kind) return <BootSplash />;
  return kind === 'mobile' ? <MobileShell /> : <DesktopShell />;
}
