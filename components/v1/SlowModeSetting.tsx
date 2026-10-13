// components/v1/SlowModeSetting.tsx
// Group ke liye slow-mode (message bhejne ke darmiyan waqfa) ka admin-only setting.
//
// IMPORTANT: Yeh component khud admin check NAHI karta — parent ko isay sirf
// admin users ke liye render karna chahiye (masalan chat.adminIds me user ho).
//
// Props:
//   chat: Chat — group jiska slow mode set karna hai (chat.slowModeSec ?? 0 se init).
//   onChange?: (seconds: number) => void — save hone ke baad parent ko notify karein.
//
// Example:
//   {isAdmin && <SlowModeSetting chat={chat} onChange={(sec) => setChat({ ...chat, slowModeSec: sec })} />}
'use client';

import { useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat } from '@/lib/backend/types';

const OPTIONS = [
  { sec: 0, label: 'Band' },
  { sec: 10, label: '10 second' },
  { sec: 30, label: '30 second' },
  { sec: 60, label: '1 minute' },
  { sec: 300, label: '5 minute' },
] as const;

export default function SlowModeSetting({
  chat,
  onChange,
}: {
  chat: Chat;
  onChange?: (seconds: number) => void;
}) {
  const [selected, setSelected] = useState<number>(chat.slowModeSec ?? 0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await backend.setSlowMode(chat.id, selected);
      setSaved(true);
      onChange?.(selected);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#111b21] rounded-xl border border-[#222d34] p-4 w-full">
      <h3 className="text-white font-semibold text-base mb-1">Slow Mode</h3>
      <p className="text-[#8696a0] text-xs mb-3">
        Har member itne waqfay se pehle dobara message nahi bhej sakega.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
        {OPTIONS.map((o) => (
          <button
            key={o.sec}
            onClick={() => { setSelected(o.sec); setSaved(false); }}
            className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              selected === o.sec
                ? 'bg-[#00a884] text-[#0b141a]'
                : 'bg-[#202c33] text-white hover:bg-[#2a3942]'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || selected === (chat.slowModeSec ?? 0)}
          className="bg-[#00a884] hover:bg-[#06cf9c] disabled:opacity-40 disabled:cursor-not-allowed text-[#0b141a] font-semibold text-sm rounded-lg px-4 py-2"
        >
          {saving ? 'Mehfooz ho raha...' : 'Mehfooz karein'}
        </button>
        {saved && <span className="text-[#00a884] text-xs">Mehfooz ho gaya ✓</span>}
      </div>
    </div>
  );
}
