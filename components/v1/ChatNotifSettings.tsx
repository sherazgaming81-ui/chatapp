// ChatNotifSettings — ek chat ki notification settings: mute + sound.
// Props: { chatId: string }
// Mount par backend.getChatNotificationSettings(chatId) load hota hai
// (loading skeleton jab tak data na aaye). "Khamosh karein" switch
// backend.setChatMuted(chatId, muted) par wire hai; sound picker
// SOUND_LABELS + playSound (('@/lib/v1/sounds')) se preview play karta hai aur
// backend.setChatSound(chatId, id | null) save karta hai.
// Example:
//   <ChatNotifSettings chatId={chat.id} />
'use client';

import { useEffect, useState } from 'react';
import { backend } from '@/lib/backend';
import type { ChatNotificationSettings } from '@/lib/backend/types';
import { SOUND_LABELS, playSound, type SoundId } from '@/lib/v1/sounds';

const SOUND_IDS = Object.keys(SOUND_LABELS) as SoundId[];

export default function ChatNotifSettings({ chatId }: { chatId: string }) {
  const [settings, setSettings] = useState<ChatNotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await backend.getChatNotificationSettings(chatId);
        if (!cancelled) setSettings(s);
      } catch {
        if (!cancelled) setSettings({ muted: false, sound: null }); // fallback defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const toggleMute = async () => {
    if (!settings) return;
    const next = !settings.muted;
    setSettings({ ...settings, muted: next }); // optimistic
    try {
      await backend.setChatMuted(chatId, next);
    } catch {
      setSettings({ ...settings, muted: !next }); // revert
    }
  };

  const pickSound = async (id: SoundId) => {
    if (!settings) return;
    const prev = settings.sound;
    const next = id === 'default' ? null : id;
    setSettings({ ...settings, sound: next }); // optimistic
    playSound(id); // preview
    try {
      await backend.setChatSound(chatId, next);
    } catch {
      setSettings({ ...settings, sound: prev }); // revert
    }
  };

  if (loading || !settings) {
    return (
      <div className="rounded-xl bg-[#111b21] p-4 text-white">
        <div className="mb-3 h-5 w-40 animate-pulse rounded bg-[#202c33]" />
        <div className="mb-2 h-10 animate-pulse rounded-lg bg-[#202c33]" />
        <div className="h-10 animate-pulse rounded-lg bg-[#202c33]" />
      </div>
    );
  }

  const activeId: SoundId = settings.sound && SOUND_IDS.includes(settings.sound as SoundId)
    ? (settings.sound as SoundId)
    : 'default';

  return (
    <div className="rounded-xl bg-[#111b21] text-white">
      <div className="bg-[#202c33] px-4 py-3 rounded-t-xl">
        <h2 className="text-base font-semibold">Notifications</h2>
      </div>

      {/* Mute switch */}
      <button
        onClick={toggleMute}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#202c33]/60"
      >
        <div>
          <p className="text-sm">Khamosh karein</p>
          <p className="text-xs text-[#8696a0]">
            {settings.muted ? 'Is chat ki notifications band hain' : 'Notifications chalu hain'}
          </p>
        </div>
        <span
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            settings.muted ? 'bg-[#00a884]' : 'bg-[#3b4a54]'
          }`}
          role="switch"
          aria-checked={settings.muted}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
              settings.muted ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </span>
      </button>

      {/* Sound picker */}
      <div className="border-t border-[#202c33] px-4 py-3">
        <p className="mb-2 text-xs text-[#8696a0]">Notification sound</p>
        <div className="flex flex-wrap gap-2">
          {SOUND_IDS.map((id) => (
            <button
              key={id}
              onClick={() => pickSound(id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                activeId === id
                  ? 'bg-[#00a884] text-white'
                  : 'bg-[#202c33] text-[#d1d7db] hover:bg-[#2a3942]'
              }`}
            >
              🔊 {SOUND_LABELS[id]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
