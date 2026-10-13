'use client';

import type { UserProfile } from '@/lib/backend/types';
import { backend } from '@/lib/backend';
import { useTheme, type ThemeMode, type WallpaperKind } from '@/lib/v1/theme';
import PushSetup from './v1/PushSetup';
import PrivacySettings from './v1/PrivacySettings';
import DisappearingSetting from './v1/DisappearingSetting';

const ACCENTS = ['#00a884', '#7f66ff', '#ff5c8a', '#ff9f1c', '#2ec4b6', '#4cc9f0'];
const WALLPAPERS: { id: WallpaperKind; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'dots', label: 'Dots' },
  { id: 'waves', label: 'Waves' },
  { id: 'none', label: 'Saada' },
];

export default function SettingsModal({ me, onClose }: { me: UserProfile; onClose: () => void }) {
  const { mode, setMode, accent, setAccent, wallpaper, setWallpaper } = useTheme();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-[#111b21] rounded-xl w-full max-w-md max-h-[85vh] flex flex-col border border-[#222d34]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222d34]">
          <h2 className="text-white font-semibold text-lg">Settings</h2>
          <button onClick={onClose} className="text-[#8696a0] hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="p-5 overflow-y-auto space-y-7">
          <section>
            <h3 className="text-[#00a884] text-sm font-semibold mb-3">Theme</h3>
            <div className="flex gap-2 mb-4">
              {(['dark', 'light'] as ThemeMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
                    mode === m ? 'bg-[#00a884] text-[#0b141a]' : 'bg-[#202c33] text-white hover:bg-[#2a3942]'
                  }`}
                >
                  {m === 'dark' ? '🌙 Dark' : '☀️ Light'}
                </button>
              ))}
            </div>
            <p className="text-[#8696a0] text-xs mb-2">Accent color</p>
            <div className="flex gap-2 mb-4">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setAccent(c)}
                  className={`w-9 h-9 rounded-full transition ${accent === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#111b21]' : ''}`}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
            <p className="text-[#8696a0] text-xs mb-2">Chat wallpaper</p>
            <div className="grid grid-cols-4 gap-2">
              {WALLPAPERS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setWallpaper(w.id)}
                  className={`rounded-lg py-2 text-xs transition ${
                    wallpaper === w.id ? 'bg-[#00a884] text-[#0b141a] font-semibold' : 'bg-[#202c33] text-white hover:bg-[#2a3942]'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[#00a884] text-sm font-semibold mb-3">Notifications</h3>
            <PushSetup />
          </section>

          <section>
            <h3 className="text-[#00a884] text-sm font-semibold mb-3">Privacy</h3>
            <PrivacySettings me={me} />
          </section>

          <section>
            <h3 className="text-[#00a884] text-sm font-semibold mb-3">Disappearing messages</h3>
            <DisappearingSetting
              current={me.disappearingAfter || 0}
              onChange={(s) => backend.setDisappearingAfter(s).catch(() => {})}
            />
            <p className="text-[#8696a0] text-xs mt-2">Aapke bheje hue messages is waqt ke baad auto-delete honge.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
