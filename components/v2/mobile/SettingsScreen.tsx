'use client';

import { useEffect, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import { backend } from '@/lib/backend';
import type { BackendV2, BlockedUser } from '@/lib/v2/types';
import type { PrivacyLevel, UserProfile } from '@/lib/backend/types';
import BottomSheet, { SheetRow } from './BottomSheet';
import { chatDisplayName } from './ChatList';

const backendV2 = backend as unknown as BackendV2;

export type ThemeChoice = 'auto' | 'light' | 'dark';
export interface NightSchedule { enabled: boolean; start: string; end: string }

const TONES = [
  { id: 'default', label: 'Default', freq: 880 },
  { id: 'chime', label: 'Chime', freq: 660 },
  { id: 'pop', label: 'Pop', freq: 520 },
  { id: 'ding', label: 'Ding', freq: 1040 },
];

function playTone(freq: number) {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.5);
    setTimeout(() => ctx.close(), 700);
  } catch {}
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="px-5 mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-[var(--mv2-accent)]">{title}</p>
      <div className="bg-[var(--mv2-sheet)] rounded-2xl mx-3 overflow-hidden">{children}</div>
    </div>
  );
}

function Row({
  label, sub, onClick, right, danger,
}: {
  label: string; sub?: string; onClick?: () => void; right?: React.ReactNode; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 min-h-[56px] text-left active:bg-[var(--mv2-accent-soft)] border-b border-[var(--mv2-divider)] last:border-0"
    >
      <span className="flex-1 min-w-0">
        <span className={`block text-[15.5px] ${danger ? 'text-[var(--mv2-danger)]' : 'text-[var(--mv2-text)]'}`}>{label}</span>
        {sub && <span className="block text-[13px] text-[var(--mv2-muted)] mt-0.5">{sub}</span>}
      </span>
      {right}
      {onClick && !right && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mv2-muted)" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
      )}
    </button>
  );
}

export default function SettingsScreen({
  user,
  chats,
  theme,
  onTheme,
  wallpaperId,
  onWallpaper,
  lockedIds,
  onUnlockChat,
  night,
  onNight,
  onSignOut,
}: {
  user: UserProfile;
  chats: import('@/lib/backend/types').Chat[];
  theme: ThemeChoice;
  onTheme: (t: ThemeChoice) => void;
  wallpaperId: string;
  onWallpaper: (id: string) => void;
  lockedIds: string[];
  onUnlockChat: (id: string) => void;
  night: NightSchedule;
  onNight: (n: NightSchedule) => void;
  onSignOut: () => void;
}) {
  const [editing, setEditing] = useState<'name' | 'about' | null>(null);
  const [name, setName] = useState(user.displayName);
  const [about, setAbout] = useState(user.about || '');
  const [saving, setSaving] = useState(false);
  const [tone, setTone] = useState(() => (typeof localStorage !== 'undefined' && localStorage.getItem('v2-tone')) || 'default');
  const [privacy, setPrivacy] = useState(user.privacy || { lastSeen: 'everyone' as PrivacyLevel, photo: 'everyone' as PrivacyLevel, online: 'everyone' as PrivacyLevel });
  const [disappearing, setDisappearing] = useState(user.disappearingAfter || 0);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showDisappearing, setShowDisappearing] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const photoInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => { setName(user.displayName); setAbout(user.about || ''); setPrivacy(user.privacy || { lastSeen: 'everyone', photo: 'everyone', online: 'everyone' }); setDisappearing(user.disappearingAfter || 0); }, [user]);

  const loadBlocked = async () => {
    try { setBlocked(await backendV2.getBlockedUsers()); } catch { setBlocked([]); }
  };
  useEffect(() => { loadBlocked(); }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await backend.updateProfile({ displayName: name.trim() || user.displayName, about: about.trim() });
      setEditing(null);
      setMsg('Profile mehfooz ho gaya ✓');
    } catch { setMsg('Mehfooz nahi ho saka'); }
    setSaving(false);
    setTimeout(() => setMsg(''), 2500);
  };

  const changePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setSaving(true);
    try {
      const { url } = await backend.uploadMedia('profile-photos', f);
      await backend.updateProfile({ photoURL: url });
      setMsg('Photo badal gayi ✓');
    } catch { setMsg('Photo upload nahi ho saki'); }
    setSaving(false);
    setTimeout(() => setMsg(''), 2500);
  };

  const setPriv = async (key: 'lastSeen' | 'photo' | 'online', val: PrivacyLevel) => {
    const next = { ...privacy, [key]: val };
    setPrivacy(next);
    try { await backend.updatePrivacy({ [key]: val }); } catch { /* revert silently */ }
  };

  const setDis = async (secs: number) => {
    setDisappearing(secs);
    setShowDisappearing(false);
    try { await backend.setDisappearingAfter(secs); setMsg('Disappearing messages update ho gaye ✓'); }
    catch { setMsg('Update nahi ho saka'); }
    setTimeout(() => setMsg(''), 2500);
  };

  const unblock = async (userId: string) => {
    try { await backendV2.unblockUser(userId); setBlocked((b) => b.filter((x) => x.userId !== userId)); }
    catch { /* ignore */ }
  };

  const doExport = async () => {
    setBusy(true);
    try {
      const json = await backendV2.exportChatBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `chatsapp-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg('Backup download ho gaya ✓');
    } catch { setMsg('Backup nahi ban saka (backend support chahiye)'); }
    setBusy(false);
    setTimeout(() => setMsg(''), 2500);
  };

  const doImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const text = await f.text();
      await backendV2.importChatBackup(text);
      setMsg('Backup restore ho gaya ✓');
    } catch { setMsg('Restore nahi ho saka (backend support chahiye)'); }
    setBusy(false);
    setShowBackup(false);
    setTimeout(() => setMsg(''), 2500);
  };

  const pickTone = (id: string, freq: number) => {
    setTone(id);
    localStorage.setItem('v2-tone', id);
    playTone(freq);
  };

  const disLabel = disappearing === 0 ? 'Off' : disappearing === 86400 ? '24 ghante' : disappearing === 604800 ? '7 din' : '90 din';
  const privLabel = (v: PrivacyLevel) => (v === 'everyone' ? 'Sab' : 'Koi nahi');

  return (
    <div className="h-full overflow-y-auto pb-8">
      {/* Profile card */}
      <div className="mx-3 mt-2 mb-5 bg-[var(--mv2-sheet)] rounded-2xl p-5 flex items-center gap-4">
        <button onClick={() => photoInput.current?.click()} className="relative shrink-0" aria-label="Profile photo badlein">
          <Avatar name={user.displayName} photoURL={user.photoURL} size={72} />
          <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[var(--mv2-accent)] text-white flex items-center justify-center text-[16px]">📷</span>
        </button>
        <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={changePhoto} />
        <div className="flex-1 min-w-0">
          {editing === 'name' ? (
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
                className="flex-1 h-10 px-3 rounded-lg bg-[var(--mv2-input)] text-[16px] text-[var(--mv2-text)] outline-none border border-[var(--mv2-accent)]" />
              <button onClick={saveProfile} disabled={saving} className="text-[var(--mv2-accent)] font-semibold text-[15px]">OK</button>
            </div>
          ) : (
            <button onClick={() => setEditing('name')} className="block text-left w-full">
              <p className="text-[18px] font-semibold text-[var(--mv2-text)] truncate">{user.displayName}</p>
            </button>
          )}
          {editing === 'about' ? (
            <div className="flex gap-2 mt-1">
              <input value={about} onChange={(e) => setAbout(e.target.value)} maxLength={120} placeholder="About"
                className="flex-1 h-10 px-3 rounded-lg bg-[var(--mv2-input)] text-[14px] text-[var(--mv2-text)] outline-none border border-[var(--mv2-accent)]" />
              <button onClick={saveProfile} disabled={saving} className="text-[var(--mv2-accent)] font-semibold text-[15px]">OK</button>
            </div>
          ) : (
            <button onClick={() => setEditing('about')} className="block text-left w-full mt-0.5">
              <p className="text-[14px] text-[var(--mv2-muted)] truncate">{user.about || 'About likhein...'}</p>
            </button>
          )}
          <p className="text-[12px] text-[var(--mv2-muted)] mt-1 truncate">{user.email}</p>
        </div>
      </div>
      {msg && <p className="text-center text-[13px] text-[var(--mv2-accent)] mb-3 -mt-2">{msg}</p>}

      {/* Appearance */}
      <Section title="Dikhawat">
        <div className="px-4 py-3">
          <p className="text-[14px] text-[var(--mv2-muted)] mb-2">Theme</p>
          <div className="flex gap-2">
            {(['auto', 'light', 'dark'] as const).map((t) => (
              <button key={t} onClick={() => onTheme(t)}
                className={`flex-1 h-11 rounded-xl text-[14px] font-medium capitalize ${theme === t ? 'bg-[var(--mv2-accent)] text-white' : 'bg-[var(--mv2-input)] text-[var(--mv2-muted)]'}`}>
                {t === 'auto' ? 'Auto' : t === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </div>
        <Row label="Wallpaper" sub="Chat background" onClick={() => {}} right={
          <div className="flex gap-1.5">
            {['doodle', 'plain', 'waves', 'grid'].map((w) => (
              <button key={w} onClick={(e) => { e.stopPropagation(); onWallpaper(w); }} aria-label={w}
                className={`w-9 h-9 rounded-lg mv2-wall-${w} border-2 ${wallpaperId === w ? 'border-[var(--mv2-accent)]' : 'border-[var(--mv2-divider)]'}`} />
            ))}
          </div>
        } />
        <div className="px-4 py-3 flex items-center justify-between">
          <span>
            <span className="block text-[15.5px] text-[var(--mv2-text)]">Night schedule</span>
            <span className="block text-[13px] text-[var(--mv2-muted)]">Raat ko auto-dark (Auto theme par)</span>
          </span>
          <button onClick={() => onNight({ ...night, enabled: !night.enabled })} aria-label="Night schedule"
            className={`w-[52px] h-8 rounded-full p-1 transition-colors ${night.enabled ? 'bg-[var(--mv2-accent)]' : 'bg-[var(--mv2-divider)]'}`}>
            <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${night.enabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        {night.enabled && (
          <div className="px-4 pb-3 flex items-center gap-3">
            <input type="time" value={night.start} onChange={(e) => onNight({ ...night, start: e.target.value })}
              className="h-10 px-2 rounded-lg bg-[var(--mv2-input)] text-[14px] text-[var(--mv2-text)]" />
            <span className="text-[var(--mv2-muted)]">se</span>
            <input type="time" value={night.end} onChange={(e) => onNight({ ...night, end: e.target.value })}
              className="h-10 px-2 rounded-lg bg-[var(--mv2-input)] text-[14px] text-[var(--mv2-text)]" />
            <span className="text-[var(--mv2-muted)]">tak</span>
          </div>
        )}
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <div className="px-4 py-3">
          <p className="text-[14px] text-[var(--mv2-muted)] mb-2">Notification tone</p>
          <div className="flex gap-2 flex-wrap">
            {TONES.map((t) => (
              <button key={t.id} onClick={() => pickTone(t.id, t.freq)}
                className={`px-4 h-10 rounded-full text-[14px] ${tone === t.id ? 'bg-[var(--mv2-accent)] text-white' : 'bg-[var(--mv2-input)] text-[var(--mv2-muted)]'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Privacy */}
      <Section title="Privacy">
        <Row label="Last seen / Online" sub={privLabel(privacy.lastSeen)} onClick={() => setShowPrivacy(true)} />
        <Row label="Disappearing messages" sub={disLabel} onClick={() => setShowDisappearing(true)} />
        <Row label="Blocked users" sub={blocked.length ? `${blocked.length} blocked` : 'Koi nahi'} onClick={() => { loadBlocked(); setShowBlocked(true); }} />
        {lockedIds.length > 0 && (
          <div className="px-4 py-2">
            <p className="text-[14px] text-[var(--mv2-muted)] mb-1">Locked chats</p>
            {lockedIds.map((id) => {
              const c = (chats as import('@/lib/backend/types').Chat[]).find((x) => x.id === id);
              return (
                <div key={id} className="flex items-center justify-between py-2">
                  <span className="text-[15px] text-[var(--mv2-text)]">🔒 {c ? chatDisplayName(c, user.id) : id.slice(0, 8)}</span>
                  <button onClick={() => onUnlockChat(id)} className="text-[var(--mv2-accent)] text-[14px] font-medium">Unlock</button>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Backup */}
      <Section title="Backup">
        <Row label="Chat backup" sub="Export / Import" onClick={() => setShowBackup(true)} />
      </Section>

      {/* Account */}
      <Section title="Account">
        <Row label="Sign out" danger onClick={onSignOut} />
      </Section>
      <p className="text-center text-[12px] text-[var(--mv2-muted)] mt-6">ChatsApp v2 • WhatsApp-style</p>

      {/* Privacy sheet */}
      <BottomSheet open={showPrivacy} onClose={() => setShowPrivacy(false)} title="Privacy">
        <div className="px-5 pb-6">
          {([
            { key: 'lastSeen', label: 'Last seen' },
            { key: 'photo', label: 'Profile photo' },
            { key: 'online', label: 'Online status' },
          ] as const).map((p) => (
            <div key={p.key} className="py-3 border-b border-[var(--mv2-divider)] last:border-0">
              <p className="text-[15px] text-[var(--mv2-text)] mb-2">{p.label}</p>
              <div className="flex gap-2">
                {(['everyone', 'nobody'] as PrivacyLevel[]).map((v) => (
                  <button key={v} onClick={() => setPriv(p.key, v)}
                    className={`flex-1 h-10 rounded-full text-[14px] ${privacy[p.key] === v ? 'bg-[var(--mv2-accent)] text-white' : 'bg-[var(--mv2-input)] text-[var(--mv2-muted)]'}`}>
                    {privLabel(v)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </BottomSheet>

      {/* Disappearing sheet */}
      <BottomSheet open={showDisappearing} onClose={() => setShowDisappearing(false)} title="Disappearing messages">
        <div className="pb-6">
          {[
            { s: 0, label: 'Off' },
            { s: 86400, label: '24 ghante' },
            { s: 604800, label: '7 din' },
            { s: 7776000, label: '90 din' },
          ].map((o) => (
            <SheetRow key={o.s} label={o.label} onClick={() => setDis(o.s)}
              icon={disappearing === o.s
                ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--mv2-accent)" strokeWidth="2.5"><path d="M5 13l4 4L19 7" /></svg>
                : <span className="w-5" />} />
          ))}
        </div>
      </BottomSheet>

      {/* Blocked sheet */}
      <BottomSheet open={showBlocked} onClose={() => setShowBlocked(false)} title="Blocked users">
        <div className="pb-6">
          {blocked.length === 0 ? (
            <p className="text-center text-[var(--mv2-muted)] text-[14px] py-6">Koi blocked user nahi</p>
          ) : blocked.map((b) => (
            <div key={b.userId} className="flex items-center justify-between px-5 py-3 border-b border-[var(--mv2-divider)]">
              <span className="text-[15px] text-[var(--mv2-text)]">User {b.userId.slice(0, 8)}…</span>
              <button onClick={() => unblock(b.userId)} className="text-[var(--mv2-accent)] text-[14px] font-medium">Unblock</button>
            </div>
          ))}
        </div>
      </BottomSheet>

      {/* Backup sheet */}
      <BottomSheet open={showBackup} onClose={() => setShowBackup(false)} title="Chat backup">
        <div className="px-5 pb-6">
          <p className="text-[13px] text-[var(--mv2-muted)] mb-4">Apni chats ka backup JSON file me mehfooz karein, ya purana backup wapas layein.</p>
          <button onClick={doExport} disabled={busy} className="w-full h-12 rounded-full bg-[var(--mv2-accent)] text-white font-semibold disabled:opacity-50 mb-3">
            {busy ? 'Kaam ho raha...' : '⬇ Backup download karein'}
          </button>
          <button onClick={() => importInput.current?.click()} disabled={busy} className="w-full h-12 rounded-full bg-[var(--mv2-input)] text-[var(--mv2-text)] font-semibold disabled:opacity-50">
            ⬆ Backup restore karein
          </button>
          <input ref={importInput} type="file" accept=".json,application/json" className="hidden" onChange={doImport} />
        </div>
      </BottomSheet>
    </div>
  );
}
