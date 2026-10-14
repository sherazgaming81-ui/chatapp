'use client';

/**
 * ThemePicker — group chat background themes (sirf owner).
 * 4 premade presets (Midnight, Emerald, Desert, Ocean) + custom image/video upload.
 * backendV5.getGroupTheme/setGroupTheme (group_themes table) — na mile to
 * localStorage fallback. Change par 'v5-theme-changed' event.
 */

import { useEffect, useRef, useState } from 'react';
import { backend } from '@/lib/backend';
import { Icon, ICONS, Modal, THEME_PRESETS, DEFAULT_THEME, backendV5, v5call, type GroupTheme } from './common';

const LS_KEY = (chatId: string) => `v5-theme:${chatId}`;

export function themeBgStyle(theme: GroupTheme): React.CSSProperties {
  if (theme.kind === 'custom' && theme.url) {
    return { backgroundColor: '#0b141a' };
  }
  const p = THEME_PRESETS.find((x) => x.id === theme.presetId);
  return { backgroundColor: p?.bg ?? '#0b141a' };
}

export function isDoodleTheme(theme: GroupTheme): boolean {
  return theme.kind === 'preset';
}

export async function loadTheme(chatId: string): Promise<GroupTheme> {
  const remote = await v5call(() => backendV5.getGroupTheme!(chatId));
  if (remote) return remote;
  try {
    const raw = localStorage.getItem(LS_KEY(chatId));
    if (raw) return JSON.parse(raw) as GroupTheme;
  } catch {}
  return DEFAULT_THEME;
}

export async function saveTheme(chatId: string, theme: GroupTheme): Promise<void> {
  try {
    localStorage.setItem(LS_KEY(chatId), JSON.stringify(theme));
  } catch {}
  await v5call(() => backendV5.setGroupTheme!(chatId, theme));
  window.dispatchEvent(new CustomEvent('v5-theme-changed', { detail: { chatId, theme } }));
}

export function useGroupTheme(chatId: string | null) {
  const [theme, setTheme] = useState<GroupTheme>(DEFAULT_THEME);
  useEffect(() => {
    if (!chatId) return;
    let on = true;
    loadTheme(chatId).then((t) => { if (on) setTheme(t); });
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as { chatId: string; theme: GroupTheme };
      if (d.chatId === chatId) setTheme(d.theme);
    };
    window.addEventListener('v5-theme-changed', h);
    return () => { on = false; window.removeEventListener('v5-theme-changed', h); };
  }, [chatId]);
  return theme;
}

export default function ThemePicker({ chatId, onClose, onApplied }: { chatId: string; onClose(): void; onApplied(t: GroupTheme): void }) {
  const [theme, setTheme] = useState<GroupTheme>(DEFAULT_THEME);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTheme(chatId).then(setTheme);
  }, [chatId]);

  const apply = async (t: GroupTheme) => {
    setTheme(t);
    await saveTheme(chatId, t);
    onApplied(t);
  };

  const onFile = async (f: File) => {
    setUploading(true);
    try {
      let url: string;
      let mediaType: 'image' | 'video' = f.type.startsWith('video') ? 'video' : 'image';
      try {
        // backend storage me upload — sab members ko nazar aayega
        const r = await backend.uploadMedia(chatId, f);
        url = r.url;
      } catch {
        // fallback: local data URL (sirf isi device par)
        url = await new Promise<string>((res, rej) => {
          const rd = new FileReader();
          rd.onload = () => res(String(rd.result));
          rd.onerror = rej;
          rd.readAsDataURL(f);
        });
      }
      await apply({ kind: 'custom', url, mediaType });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal title="Chat Theme" onClose={onClose}>
      <div className="p-5">
        <p className="text-[13px] text-[#8696a0] mb-4">Madrasa Group ka background choose karein — sab members ko nazar aayega.</p>
        <div className="grid grid-cols-2 gap-3">
          {THEME_PRESETS.map((p) => {
            const active = theme.kind === 'preset' && theme.presetId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => apply({ kind: 'preset', presetId: p.id })}
                className={`relative h-28 rounded-xl overflow-hidden border-2 transition ${active ? 'border-[#00a884]' : 'border-transparent hover:border-[#2a3942]'}`}
                style={{ backgroundColor: p.bg }}
              >
                <span className="absolute inset-0 opacity-30 v5wallpaper doodle" />
                <span className="absolute bottom-0 inset-x-0 px-3 py-2 bg-black/45 text-left">
                  <span className="block text-[13.5px] font-medium text-white">{p.name}</span>
                  <span className="block text-[11px] text-white/70">{p.hint}</span>
                </span>
                {active && (
                  <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#00a884] text-white flex items-center justify-center">
                    <Icon d={ICONS.check} size={14} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="mt-4 w-full rounded-xl border border-dashed border-[#2a3942] hover:border-[#00a884]/60 bg-[#1f2c34]/50 px-4 py-5 flex items-center justify-center gap-3 text-[#aebac1] transition disabled:opacity-60"
        >
          <Icon d={ICONS.image} size={22} className="text-[#00a884]" />
          <span className="text-[14px]">
            {uploading ? 'Upload ho raha hai…' : theme.kind === 'custom' ? 'Custom background badlein (photo/video)' : 'Apni photo/video lagayein (custom background)'}
          </span>
        </button>
        {theme.kind === 'custom' && theme.url && (
          <div className="mt-3 rounded-xl overflow-hidden border border-[#2a3942] relative h-32 bg-black">
            {theme.mediaType === 'video' ? (
              <video src={theme.url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.url} alt="Custom theme" className="w-full h-full object-cover" />
            )}
            <span className="absolute top-2 left-2 text-[11px] bg-black/60 text-white px-2 py-1 rounded-full">Custom active</span>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
      </div>
    </Modal>
  );
}
