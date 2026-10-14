'use client';

/**
 * SettingsModal — desktop settings.
 * Profile edit · theme Auto/Light/Dark + night schedule · wallpaper picker
 * · per-chat notification tone · privacy · blocked users · locked chats
 * · backup export/import · chat ko styled HTML me export.
 */

import { useEffect, useRef, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat, ChatMessage, PrivacySettings, UserProfile } from '@/lib/backend/types';
import type { BlockedUser } from '@/lib/v2/types';
import Avatar from '@/components/Avatar';
import { fmtTime } from '@/lib/format';
import { Icon, ICONS, RowBtn, SectionTitle, backendV2, v2call } from './common';
import type { DesktopPrefs, ThemeMode, WallpaperKind, BubbleStyle, MessageFont } from './DesktopShell';
import { WALLPAPERS, FONT_LABELS, FONT_STACKS } from './DesktopShell';
import ProfilePicEditor from './ProfilePicEditor';

interface Props {
  me: UserProfile;
  chats: Chat[];
  prefs: DesktopPrefs;
  onSavePrefs(p: Partial<DesktopPrefs>): void;
  onClose(): void;
}

type Page = 'main' | 'profile' | 'theme' | 'wallpaper' | 'tones' | 'privacy' | 'checkup' | 'blocked' | 'locked' | 'backup' | 'exportHtml';

export default function SettingsModal({ me, chats, prefs, onSavePrefs, onClose }: Props) {
  const [page, setPage] = useState<Page>('main');

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-[var(--v2-panel)] text-[var(--v2-text)] rounded-2xl shadow-2xl border border-[var(--v2-border)] w-full max-w-[520px] max-h-[88vh] flex flex-col overflow-hidden animate-[v2pop_.18s_ease-out]">
        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-[var(--v2-border)] shrink-0">
          {page !== 'main' && (
            <button onClick={() => setPage('main')} className="p-1.5 rounded-full hover:bg-[var(--v2-hover)] text-[var(--v2-muted)] transition">
              <Icon d={ICONS.chevRight} size={20} className="rotate-180" />
            </button>
          )}
          <h2 className="text-[16px] font-semibold flex-1 truncate">{pageTitle(page)}</h2>
          <button onClick={onClose} className="p-1.5 rounded-full text-[var(--v2-muted)] hover:bg-[var(--v2-hover)] transition" aria-label="Band karein">
            <Icon d={ICONS.x} size={20} />
          </button>
        </div>
        <div className="overflow-y-auto v2scroll min-h-0">
          {page === 'main' && <MainPage me={me} go={setPage} onClose={onClose} />}
          {page === 'profile' && <ProfilePage me={me} />}
          {page === 'theme' && <ThemePage prefs={prefs} onSavePrefs={onSavePrefs} />}
          {page === 'wallpaper' && <WallpaperPage prefs={prefs} onSavePrefs={onSavePrefs} />}
          {page === 'tones' && <TonesPage chats={chats} />}
          {page === 'privacy' && <PrivacyPage me={me} />}
          {page === 'checkup' && <PrivacyCheckup me={me} go={setPage} />}
          {page === 'blocked' && <BlockedPage />}
          {page === 'locked' && <LockedPage chats={chats} />}
          {page === 'backup' && <BackupPage />}
          {page === 'exportHtml' && <ExportHtmlPage chats={chats} me={me} />}
        </div>
      </div>
    </div>
  );
}

function pageTitle(p: Page) {
  return {
    main: 'Settings', profile: 'Profile', theme: 'Theme', wallpaper: 'Chat wallpaper',
    tones: 'Per-chat notification tone', privacy: 'Privacy', checkup: 'Privacy checkup',
    blocked: 'Blocked users', locked: 'Locked chats', backup: 'Backup', exportHtml: 'Chat export (HTML)',
  }[p];
}

function MainPage({ me, go, onClose }: { me: UserProfile; go(p: Page): void; onClose(): void }) {
  return (
    <div className="py-2 animate-[v2fade_.15s_ease-out]">
      <button onClick={() => go('profile')} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[var(--v2-hover)] transition text-left">
        <Avatar name={me.displayName} photoURL={me.photoURL} size={56} />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-medium truncate">{me.displayName}</span>
          <span className="block text-[13px] text-[var(--v2-muted)] truncate">{me.about || 'Hey there!'}</span>
        </span>
        <Icon d={ICONS.chevRight} size={18} className="text-[var(--v2-muted)]" />
      </button>
      <div className="border-t border-[var(--v2-border)] mt-1 pt-1">
        <RowBtn icon="sun" label="Theme" sub="Auto / Light / Dark + night schedule" onClick={() => go('theme')} />
        <RowBtn icon="image" label="Chat wallpaper" sub="Doodle ya plain background" onClick={() => go('wallpaper')} />
        <RowBtn icon="bell" label="Per-chat notification tone" sub="Har chat ki alag tone" onClick={() => go('tones')} />
        <RowBtn icon="shield" label="Privacy" sub="Last seen, photo, online" onClick={() => go('privacy')} />
        <RowBtn icon="check" label="Privacy checkup" sub="Step-by-step privacy wizard" onClick={() => go('checkup')} />
        <RowBtn icon="user" label="Blocked users" sub="Block list manage karein" onClick={() => go('blocked')} />
        <RowBtn icon="lock" label="Locked chats" sub="PIN se chat lock karein" onClick={() => go('locked')} />
        <RowBtn icon="download" label="Backup" sub="Export / import chats JSON" onClick={() => go('backup')} />
        <RowBtn icon="file" label="Chat export (HTML)" sub="Khubsurat styled HTML file" onClick={() => go('exportHtml')} />
        <div className="border-t border-[var(--v2-border)] mt-1 pt-1">
          <RowBtn icon="logout" label="Logout" danger onClick={() => { backend.signOut().catch(() => {}); onClose(); }} />
        </div>
      </div>
    </div>
  );
}

// ================= profile =================

function ProfilePage({ me }: { me: UserProfile }) {
  const [name, setName] = useState(me.displayName);
  const [about, setAbout] = useState(me.about || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await backend.updateProfile({ displayName: name.trim(), about: about.trim() });
      setMsg('Profile update ho gaya.');
    } catch {
      setMsg('Save nahi ho saka.');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 2500);
    }
  };

  return (
    <div className="p-5 animate-[v2fade_.15s_ease-out]">
      <div className="flex justify-center mb-5">
        <ProfilePicEditor name={name || me.displayName} photoURL={me.photoURL} size={110} />
      </div>
      <label className="block text-[12.5px] text-[var(--v2-muted)] mb-1.5">Naam</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[var(--v2-input)] rounded-lg px-3.5 py-2.5 text-[14.5px] outline-none mb-4" />
      <label className="block text-[12.5px] text-[var(--v2-muted)] mb-1.5">About</label>
      <input value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Hey there!" className="w-full bg-[var(--v2-input)] rounded-lg px-3.5 py-2.5 text-[14.5px] outline-none mb-5" />
      {msg && <p className="text-[13px] text-[var(--v2-accent)] mb-3">{msg}</p>}
      <button onClick={save} disabled={saving || !name.trim()} className="w-full py-2.5 rounded-full bg-[var(--v2-accent)] text-white text-[14.5px] font-medium hover:brightness-110 transition disabled:opacity-50">
        {saving ? 'Save ho raha hai…' : 'Save karein'}
      </button>
    </div>
  );
}

// ================= theme =================

function ThemePage({ prefs, onSavePrefs }: { prefs: DesktopPrefs; onSavePrefs(p: Partial<DesktopPrefs>): void }) {
  const modes: { v: ThemeMode; label: string; sub: string; icon: string }[] = [
    { v: 'auto', label: 'Auto', sub: 'Night schedule ke hisaab se', icon: 'clock' },
    { v: 'light', label: 'Light', sub: 'Hamesha light theme', icon: 'sun' },
    { v: 'dark', label: 'Dark', sub: 'Hamesha dark theme', icon: 'moon' },
  ];
  return (
    <div className="p-4 animate-[v2fade_.15s_ease-out]">
      {modes.map((m) => (
        <button
          key={m.v}
          onClick={() => onSavePrefs({ theme: m.v })}
          className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl mb-1.5 transition text-left ${prefs.theme === m.v ? 'bg-[var(--v2-accent-soft)]' : 'hover:bg-[var(--v2-hover)]'}`}
        >
          <span className={`w-10 h-10 rounded-full flex items-center justify-center ${prefs.theme === m.v ? 'bg-[var(--v2-accent)] text-white' : 'bg-[var(--v2-input)] text-[var(--v2-muted)]'}`}>
            <Icon d={ICONS[m.icon as keyof typeof ICONS]} size={19} />
          </span>
          <span className="flex-1">
            <span className={`block text-[14.5px] font-medium ${prefs.theme === m.v ? 'text-[var(--v2-accent)]' : ''}`}>{m.label}</span>
            <span className="block text-[12.5px] text-[var(--v2-muted)]">{m.sub}</span>
          </span>
          {prefs.theme === m.v && <Icon d={ICONS.check} size={19} className="text-[var(--v2-accent)]" />}
        </button>
      ))}

      <SectionTitle>Night schedule (Auto ke liye)</SectionTitle>
      <div className="flex items-center gap-3 px-4 pb-2">
        <div className="flex-1">
          <label className="block text-[12px] text-[var(--v2-muted)] mb-1">Dark kab se</label>
          <input
            type="time"
            value={prefs.nightStart}
            onChange={(e) => onSavePrefs({ nightStart: e.target.value })}
            className="w-full bg-[var(--v2-input)] rounded-lg px-3 py-2 text-[14px] outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="block text-[12px] text-[var(--v2-muted)] mb-1">Dark kab tak</label>
          <input
            type="time"
            value={prefs.nightEnd}
            onChange={(e) => onSavePrefs({ nightEnd: e.target.value })}
            className="w-full bg-[var(--v2-input)] rounded-lg px-3 py-2 text-[14px] outline-none"
          />
        </div>
      </div>
      <p className="px-4 text-[12.5px] text-[var(--v2-muted)] leading-relaxed">
        Auto mode me {prefs.nightStart} se {prefs.nightEnd} tak dark theme rahega, baqi time light.
      </p>

      <SectionTitle>Message font</SectionTitle>
      <div className="grid grid-cols-2 gap-2 px-4 pb-2">
        {FONT_LABELS.map((f: { v: MessageFont; name: string; sample: string }) => (
          <button
            key={f.v}
            onClick={() => onSavePrefs({ messageFont: f.v })}
            className={`rounded-xl border-2 px-3 py-3 text-left transition ${
              prefs.messageFont === f.v
                ? 'border-[var(--v2-accent)] bg-[var(--v2-accent-soft)]'
                : 'border-[var(--v2-border)] hover:border-[var(--v2-muted)]'
            }`}
          >
            <span className="block text-[12px] font-semibold text-[var(--v2-muted)] uppercase tracking-wide mb-1">
              {f.name}
            </span>
            <span className="block text-[16px] text-[var(--v2-text)] truncate" style={{ fontFamily: FONT_STACKS[f.v] }}>
              {f.sample}
            </span>
          </button>
        ))}
      </div>

      <SectionTitle>Message bubble style</SectionTitle>
      <div className="flex gap-2 px-4 pb-4">
        {(['default', 'rounded'] as BubbleStyle[]).map((b) => (
          <button
            key={b}
            onClick={() => onSavePrefs({ bubbleStyle: b })}
            className={`flex-1 py-3 rounded-xl border-2 transition ${prefs.bubbleStyle === b ? 'border-[var(--v2-accent)] bg-[var(--v2-accent-soft)]' : 'border-[var(--v2-border)] hover:border-[var(--v2-muted)]'}`}
          >
            <span className={`inline-block px-4 py-1.5 text-[12.5px] ${b === 'rounded' ? 'rounded-2xl' : 'rounded-xl rounded-br-[4px]'} bg-[var(--v2-bubble-out)] text-[var(--v2-text)]`}>
              {b === 'default' ? 'Default' : 'Rounded'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ================= wallpaper =================

function WallpaperPage({ prefs, onSavePrefs }: { prefs: DesktopPrefs; onSavePrefs(p: Partial<DesktopPrefs>): void }) {
  const thumbStyle = (w: { id: string; light: string; dark: string }): React.CSSProperties | undefined => {
    if (w.id === 'plain') return { background: 'var(--v2-wallpaper)' };
    if (w.light) return { background: w.dark };
    return undefined;
  };
  return (
    <div className="p-4 animate-[v2fade_.15s_ease-out]">
      <div className="grid grid-cols-2 gap-3">
        {WALLPAPERS.map((w) => {
          const active = prefs.wallpaper === w.id;
          return (
            <button
              key={w.id}
              onClick={() => onSavePrefs({ wallpaper: w.id as WallpaperKind })}
              className={`rounded-xl border-2 overflow-hidden transition text-left ${
                active ? 'border-[var(--v2-accent)]' : 'border-[var(--v2-border)] hover:border-[var(--v2-muted)]'
              }`}
            >
              <span
                className={`relative block h-24 ${w.id === 'doodle' ? 'v2wallpaper' : ''}`}
                style={thumbStyle(w)}
              >
                {active && (
                  <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--v2-accent)] text-white flex items-center justify-center">
                    <Icon d={ICONS.check} size={14} />
                  </span>
                )}
                {/* mini chat preview */}
                <span className="absolute bottom-2 left-2 right-8 flex flex-col gap-1 pointer-events-none">
                  <span className="self-start bg-white/85 rounded-lg rounded-bl-[3px] px-2 py-1 text-[8px] text-gray-700 shadow">Salam!</span>
                  <span className="self-end bg-[#d9fdd3] rounded-lg rounded-br-[3px] px-2 py-1 text-[8px] text-gray-700 shadow">Walaikum Assalam</span>
                </span>
              </span>
              <span className="block px-3 py-2.5">
                <span className={`block text-[14px] font-medium ${active ? 'text-[var(--v2-accent)]' : ''}`}>{w.name}</span>
                <span className="block text-[12px] text-[var(--v2-muted)]">{w.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[12.5px] text-[var(--v2-muted)] mt-4 leading-relaxed px-1">
        Wallpaper chat background par lagega. Doodle/Plain theme ke hisaab se rang khud adjust kar lete hain.
      </p>
    </div>
  );
}

// ================= per-chat tones =================

const TONES = ['default', 'chime', 'ding', 'pop', 'silent'];

function TonesPage({ chats }: { chats: Chat[] }) {
  const [tones, setTones] = useState<Record<string, string>>({});

  useEffect(() => {
    chats.forEach((c) => {
      v2call(() => backendV2.getChatTone(c.id)).then((t) => {
        if (t) setTones((p) => ({ ...p, [c.id]: t }));
      });
    });
  }, [chats]);

  return (
    <div className="p-3 animate-[v2fade_.15s_ease-out]">
      {chats.slice(0, 40).map((c) => (
        <div key={c.id} className="flex items-center gap-3 px-2 py-2.5 border-b border-[var(--v2-border)] last:border-0">
          <Avatar name={c.name} photoURL={c.photoURL} size={40} />
          <span className="flex-1 text-[14px] truncate">{c.name}</span>
          <select
            value={tones[c.id] ?? 'default'}
            onChange={async (e) => {
              setTones((p) => ({ ...p, [c.id]: e.target.value }));
              await v2call(() => backendV2.setChatTone(c.id, e.target.value));
            }}
            className="bg-[var(--v2-input)] rounded-lg px-2.5 py-1.5 text-[13px] outline-none"
          >
            {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      ))}
      {chats.length === 0 && <p className="text-center text-[13px] text-[var(--v2-muted)] py-8">Koi chat nahi.</p>}
    </div>
  );
}

// ================= privacy =================

function PrivacyPage({ me }: { me: UserProfile }) {
  const [p, setP] = useState<PrivacySettings>(me.privacy ?? { lastSeen: 'everyone', photo: 'everyone', online: 'everyone' });
  const [saved, setSaved] = useState(false);

  const save = async () => {
    try {
      await backend.updatePrivacy(p);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  const Row = ({ k, label }: { k: keyof PrivacySettings; label: string }) => (
    <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--v2-border)] last:border-0">
      <span className="text-[14px]">{label}</span>
      <div className="flex gap-1.5">
        {(['everyone', 'nobody'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setP((pp) => ({ ...pp, [k]: v }))}
            className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition ${p[k] === v ? 'bg-[var(--v2-accent)] text-white' : 'bg-[var(--v2-input)] text-[var(--v2-muted)]'}`}
          >
            {v === 'everyone' ? 'Sab' : 'Koi nahi'}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="animate-[v2fade_.15s_ease-out]">
      <SectionTitle>Kaun dekh sakta hai</SectionTitle>
      <Row k="lastSeen" label="Last seen" />
      <Row k="photo" label="Profile photo" />
      <Row k="online" label="Online status" />
      <div className="p-5">
        {saved && <p className="text-[13px] text-[var(--v2-accent)] mb-3">Privacy save ho gayi.</p>}
        <button onClick={save} className="w-full py-2.5 rounded-full bg-[var(--v2-accent)] text-white text-[14.5px] font-medium hover:brightness-110 transition">
          Save karein
        </button>
      </div>
    </div>
  );
}

// ================= privacy checkup (wizard) =================

const CHECKUP_STEPS = ['Photo', 'Last seen', 'Profile photo', 'Online', 'Blocked', 'Done'] as const;

function PrivacyCheckup({ me, go }: { me: UserProfile; go(p: Page): void }) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState<PrivacySettings>(me.privacy ?? { lastSeen: 'everyone', photo: 'everyone', online: 'everyone' });
  const [blockedCount, setBlockedCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    v2call(() => backendV2.getBlockedUsers()).then((l) => {
      if (l) setBlockedCount(l.length);
    });
  }, []);

  const savePrivacy = async () => {
    setSaving(true);
    try {
      await backend.updatePrivacy(p);
    } catch {}
    setSaving(false);
  };

  const next = async () => {
    if (step >= 1 && step <= 3) await savePrivacy();
    setStep((s) => Math.min(s + 1, CHECKUP_STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const Choice = ({ k, label, hint }: { k: keyof PrivacySettings; label: string; hint: string }) => (
    <div className="bg-[var(--v2-panel2)] rounded-2xl p-5">
      <p className="text-[15px] font-semibold mb-1">{label}</p>
      <p className="text-[13px] text-[var(--v2-muted)] leading-relaxed mb-4">{hint}</p>
      <div className="grid grid-cols-2 gap-2">
        {(['everyone', 'nobody'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setP((pp) => ({ ...pp, [k]: v }))}
            className={`py-3 rounded-xl text-[14px] font-medium transition border-2 ${
              p[k] === v
                ? 'border-[var(--v2-accent)] bg-[var(--v2-accent-soft)] text-[var(--v2-accent)]'
                : 'border-[var(--v2-border)] hover:border-[var(--v2-muted)]'
            }`}
          >
            {v === 'everyone' ? 'Sab dekh sakte hain' : 'Koi nahi dekh sakta'}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-5 animate-[v2fade_.15s_ease-out]">
      {/* progress */}
      <div className="flex items-center gap-1.5 mb-1">
        {CHECKUP_STEPS.map((s, i) => (
          <div key={s} className="flex-1 flex flex-col gap-1.5">
            <div className={`h-1.5 rounded-full transition ${i <= step ? 'bg-[var(--v2-accent)]' : 'bg-[var(--v2-panel3)]'}`} />
          </div>
        ))}
      </div>
      <p className="text-[12px] text-[var(--v2-muted)] mb-5">
        Step {step + 1} / {CHECKUP_STEPS.length} · {CHECKUP_STEPS[step]}
      </p>

      {step === 0 && (
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--v2-accent-soft)] text-[var(--v2-accent)] flex items-center justify-center mx-auto mb-4">
            <Icon d={ICONS.shield} size={30} />
          </div>
          <h3 className="text-[17px] font-semibold mb-2">Privacy checkup</h3>
          <p className="text-[13.5px] text-[var(--v2-muted)] leading-relaxed max-w-[340px] mx-auto">
            Kuch steps me apni saari privacy settings review karein — kaun aapko dekh sakta hai, kaun nahi.
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="bg-[var(--v2-panel2)] rounded-2xl p-5">
          <p className="text-[15px] font-semibold mb-1">Profile photo</p>
          <p className="text-[13px] text-[var(--v2-muted)] leading-relaxed mb-4">
            Apni photo lagayein ya change karein. Photo par click karke fullscreen dekh sakte hain.
          </p>
          <ProfilePicEditor compact name={me.displayName} photoURL={me.photoURL} size={64} />
        </div>
      )}

      {step === 2 && <Choice k="lastSeen" label="Last seen" hint="Kaun dekh sakta hai ke aap aakhri baar kab online thay?" />}
      {step === 3 && <Choice k="photo" label="Profile photo" hint="Kaun aapki profile photo dekh sakta hai?" />}
      {step === 4 && <Choice k="online" label="Online status" hint="Kaun dekh sakta hai ke aap abhi online hain?" />}

      {step === 5 && (
        <div className="bg-[var(--v2-panel2)] rounded-2xl p-5 text-center">
          <p className="text-[15px] font-semibold mb-1">Blocked users</p>
          <p className="text-[13px] text-[var(--v2-muted)] leading-relaxed mb-4">
            {blockedCount === null
              ? 'Load ho raha hai…'
              : blockedCount === 0
                ? 'Aap ne kisi ko block nahi kiya.'
                : `Aap ne ${blockedCount} user${blockedCount === 1 ? '' : 's'} ko block kiya hua hai.`}
          </p>
          <button
            onClick={() => go('blocked')}
            className="px-5 py-2.5 rounded-full bg-[var(--v2-accent-soft)] text-[var(--v2-accent)] text-[13.5px] font-medium hover:brightness-95 transition"
          >
            Block list dekhein
          </button>
        </div>
      )}

      {step === CHECKUP_STEPS.length - 1 && (
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--v2-accent)] text-white flex items-center justify-center mx-auto mb-4">
            <Icon d={ICONS.check} size={30} />
          </div>
          <h3 className="text-[17px] font-semibold mb-2">Sab set hai!</h3>
          <div className="text-left bg-[var(--v2-panel2)] rounded-2xl p-4 max-w-[340px] mx-auto">
            <SummaryRow label="Last seen" value={p.lastSeen === 'everyone' ? 'Sab' : 'Koi nahi'} />
            <SummaryRow label="Profile photo" value={p.photo === 'everyone' ? 'Sab' : 'Koi nahi'} />
            <SummaryRow label="Online status" value={p.online === 'everyone' ? 'Sab' : 'Koi nahi'} />
            <SummaryRow label="Blocked users" value={blockedCount === null ? '…' : String(blockedCount)} last />
          </div>
        </div>
      )}

      {/* nav */}
      <div className="flex gap-2 mt-6">
        {step > 0 && (
          <button
            onClick={back}
            className="px-5 py-2.5 rounded-full bg-[var(--v2-input)] text-[14px] font-medium hover:bg-[var(--v2-active)] transition"
          >
            Wapas
          </button>
        )}
        <div className="flex-1" />
        {step < CHECKUP_STEPS.length - 1 ? (
          <button
            onClick={next}
            disabled={saving}
            className="px-7 py-2.5 rounded-full bg-[var(--v2-accent)] text-white text-[14px] font-medium hover:brightness-110 transition disabled:opacity-50"
          >
            {saving ? 'Save…' : step === 0 ? 'Shuru karein' : 'Aage'}
          </button>
        ) : (
          <button
            onClick={() => go('main')}
            className="px-7 py-2.5 rounded-full bg-[var(--v2-accent)] text-white text-[14px] font-medium hover:brightness-110 transition"
          >
            Khatam
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 text-[13.5px] ${last ? '' : 'border-b border-[var(--v2-border)]'}`}>
      <span className="text-[var(--v2-muted)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ================= blocked =================

function BlockedPage() {
  const [list, setList] = useState<BlockedUser[]>([]);

  const reload = () => {
    v2call(() => backendV2.getBlockedUsers()).then((r) => { if (r) setList(r); });
  };
  useEffect(reload, []);

  const unblock = async (uid: string) => {
    const ok = await v2call(() => backendV2.unblockUser(uid));
    if (ok !== null) reload();
  };

  return (
    <div className="p-3 animate-[v2fade_.15s_ease-out]">
      {list.length === 0 && <p className="text-center text-[13px] text-[var(--v2-muted)] py-8">Koi blocked user nahi.</p>}
      {list.map((b) => (
        <div key={b.userId} className="flex items-center gap-3 px-2 py-2.5 border-b border-[var(--v2-border)] last:border-0">
          <Avatar name={b.userId.slice(0, 8)} size={40} />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] truncate font-mono">{b.userId.slice(0, 12)}…</p>
            <p className="text-[12px] text-[var(--v2-muted)]">Blocked</p>
          </div>
          <button onClick={() => unblock(b.userId)} className="px-3.5 py-1.5 rounded-full bg-[var(--v2-accent-soft)] text-[var(--v2-accent)] text-[12.5px] font-medium hover:brightness-95 transition">
            Unblock
          </button>
        </div>
      ))}
    </div>
  );
}

// ================= locked chats =================

const LOCK_PIN_KEY = 'v2-lock-pin';

function LockedPage({ chats }: { chats: Chat[] }) {
  const [locked, setLocked] = useState<Record<string, boolean>>({});
  const [pin, setPin] = useState('');
  const [pinSet, setPinSet] = useState(false);
  const [askPinFor, setAskPinFor] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');

  useEffect(() => {
    setPinSet(!!localStorage.getItem(LOCK_PIN_KEY));
    chats.forEach((c) => {
      v2call(() => backendV2.isChatLocked(c.id)).then((v) => {
        if (v !== null) setLocked((p) => ({ ...p, [c.id]: v }));
      });
    });
  }, [chats]);

  const savePin = () => {
    if (pin.length < 4) return;
    localStorage.setItem(LOCK_PIN_KEY, pin);
    setPinSet(true);
    setPin('');
  };

  const toggleLock = async (chatId: string, lock: boolean) => {
    if (lock && !pinSet) return;
    const ok = await v2call(() => backendV2.setChatLocked(chatId, lock));
    if (ok !== null) setLocked((p) => ({ ...p, [chatId]: lock }));
  };

  const verifyAndUnlock = (chatId: string) => {
    if (pinInput === localStorage.getItem(LOCK_PIN_KEY)) {
      toggleLock(chatId, false);
      setAskPinFor(null);
      setPinInput('');
    }
  };

  return (
    <div className="p-4 animate-[v2fade_.15s_ease-out]">
      <p className="text-[13px] text-[var(--v2-muted)] leading-relaxed mb-4">
        Locked chat kholne ke liye PIN lagega. PIN sirf is device par save hota hai.
      </p>
      {!pinSet ? (
        <div className="bg-[var(--v2-panel2)] rounded-xl p-4 mb-4">
          <label className="block text-[13px] font-medium mb-2">PIN set karein (kam az kam 4 digits)</label>
          <div className="flex gap-2">
            <input
              type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="••••" className="flex-1 bg-[var(--v2-input)] rounded-lg px-3.5 py-2 text-[15px] tracking-[0.3em] outline-none text-center"
            />
            <button onClick={savePin} disabled={pin.length < 4} className="px-4 rounded-lg bg-[var(--v2-accent)] text-white text-[13.5px] font-medium disabled:opacity-50">
              Set
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { localStorage.removeItem(LOCK_PIN_KEY); setPinSet(false); }}
          className="text-[12.5px] text-[#ea0038] hover:underline mb-4"
        >
          PIN reset karein
        </button>
      )}
      {chats.slice(0, 40).map((c) => (
        <div key={c.id} className="flex items-center gap-3 px-2 py-2.5 border-b border-[var(--v2-border)] last:border-0">
          <Avatar name={c.name} photoURL={c.photoURL} size={40} />
          <span className="flex-1 text-[14px] truncate">{c.name}</span>
          <Icon d={ICONS.lock} size={16} className={locked[c.id] ? 'text-[var(--v2-accent)]' : 'text-[var(--v2-muted)] opacity-40'} />
          {locked[c.id] ? (
            <button onClick={() => setAskPinFor(c.id)} disabled={!pinSet} className="px-3.5 py-1.5 rounded-full bg-[var(--v2-input)] text-[12.5px] font-medium disabled:opacity-40">
              Unlock
            </button>
          ) : (
            <button onClick={() => toggleLock(c.id, true)} disabled={!pinSet} className="px-3.5 py-1.5 rounded-full bg-[var(--v2-input)] text-[12.5px] font-medium disabled:opacity-40">
              Lock
            </button>
          )}
          {askPinFor === c.id && (
            <div className="flex gap-1.5 items-center">
              <input
                type="password" inputMode="numeric" value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="PIN" className="w-20 bg-[var(--v2-input)] rounded-lg px-2 py-1.5 text-[13px] text-center outline-none"
              />
              <button onClick={() => verifyAndUnlock(c.id)} className="p-1.5 rounded-full bg-[var(--v2-accent)] text-white">
                <Icon d={ICONS.check} size={15} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ================= backup =================

function BackupPage() {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = async () => {
    setBusy(true);
    setMsg('');
    const json = await v2call(() => backendV2.exportChatBackup());
    setBusy(false);
    if (json === null) {
      setMsg('Backup export nahi ho saka (backend me method abhi nahi hai).');
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chatsapp-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg('Backup download ho gaya.');
  };

  const doImport = async (f: File) => {
    setBusy(true);
    setMsg('');
    try {
      const text = await f.text();
      const ok = await v2call(() => backendV2.importChatBackup(text));
      setMsg(ok === null ? 'Import nahi ho saka (backend me method abhi nahi hai).' : 'Backup import ho gaya.');
    } catch {
      setMsg('File parhne me masla hua.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-5 animate-[v2fade_.15s_ease-out]">
      <p className="text-[13px] text-[var(--v2-muted)] leading-relaxed mb-5">
        Saari chats ka JSON backup banayein ya purana backup wapas import karein.
      </p>
      <button onClick={doExport} disabled={busy} className="w-full py-2.5 rounded-full bg-[var(--v2-accent)] text-white text-[14.5px] font-medium hover:brightness-110 transition disabled:opacity-50 mb-3">
        {busy ? 'Kaam ho raha hai…' : 'Backup export karein (JSON)'}
      </button>
      <button onClick={() => fileRef.current?.click()} disabled={busy} className="w-full py-2.5 rounded-full bg-[var(--v2-input)] text-[14.5px] font-medium hover:bg-[var(--v2-active)] transition disabled:opacity-50">
        Backup import karein
      </button>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
      {msg && <p className="text-[13px] text-[var(--v2-muted)] mt-4 leading-relaxed">{msg}</p>}
    </div>
  );
}

// ================= export chat as styled HTML =================

function ExportHtmlPage({ chats, me }: { chats: Chat[]; me: UserProfile }) {
  const [chatId, setChatId] = useState(chats[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const doExport = async () => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat) return;
    setBusy(true);
    setMsg('');
    try {
      const messages: ChatMessage[] = await new Promise((resolve) => {
        const unsub = backend.onMessages(chat.id, (m) => {
          setTimeout(() => { unsub(); resolve(m); }, 300);
        });
        setTimeout(() => { try { unsub(); } catch {} resolve([]); }, 5000);
      });
      const html = buildChatHtml(chat, messages, me);
      const blob = new Blob([html], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `chat-${chat.name.replace(/[^\w\-]+/g, '_')}.html`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg(`${messages.length} messages export ho gaye.`);
    } catch {
      setMsg('Export nahi ho saka.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-5 animate-[v2fade_.15s_ease-out]">
      <p className="text-[13px] text-[var(--v2-muted)] leading-relaxed mb-4">
        Kisi chat ko khubsurat styled HTML file me export karein — print ya share karne ke liye.
      </p>
      <label className="block text-[12.5px] text-[var(--v2-muted)] mb-1.5">Chat chunein</label>
      <select value={chatId} onChange={(e) => setChatId(e.target.value)} className="w-full bg-[var(--v2-input)] rounded-lg px-3 py-2.5 text-[14px] outline-none mb-4">
        {chats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button onClick={doExport} disabled={busy || !chatId} className="w-full py-2.5 rounded-full bg-[var(--v2-accent)] text-white text-[14.5px] font-medium hover:brightness-110 transition disabled:opacity-50">
        {busy ? 'Ban raha hai…' : 'HTML download karein'}
      </button>
      {msg && <p className="text-[13px] text-[var(--v2-muted)] mt-3">{msg}</p>}
    </div>
  );
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildChatHtml(chat: Chat, messages: ChatMessage[], me: UserProfile): string {
  const rows = messages.map((m) => {
    const mine = m.senderId === me.id;
    const body = m.type === 'image' && m.mediaURL
      ? `<img src="${esc(m.mediaURL)}" style="max-width:100%;border-radius:8px"/><div>${esc(m.text || '')}</div>`
      : m.type === 'audio'
        ? `<i>🎤 Voice message (${m.duration || 0}s)</i>`
        : m.type === 'poll' && m.poll
          ? `<b>📊 ${esc(m.poll.question)}</b><ul>${m.poll.options.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>`
          : esc(m.text || `[${m.type}]`);
    return `<div style="display:flex;justify-content:${mine ? 'flex-end' : 'flex-start'};margin:6px 0">
      <div style="max-width:70%;padding:8px 12px;border-radius:12px;background:${mine ? '#d9fdd3' : '#ffffff'};box-shadow:0 1px 1px rgba(0,0,0,.1);font-size:14px;line-height:1.45">
        ${chat.type === 'group' && !mine ? `<div style="font-size:12px;font-weight:600;color:#00a884">${esc(m.senderName)}</div>` : ''}
        ${body}
        <div style="font-size:10.5px;color:#667781;text-align:right;margin-top:2px">${fmtTime(m.createdAt)}</div>
      </div></div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(chat.name)} — ChatsApp Export</title></head>
<body style="font-family:system-ui,sans-serif;background:#eae6df;margin:0;padding:24px">
<div style="max-width:720px;margin:0 auto">
<h2 style="font-weight:600">${esc(chat.name)}</h2>
<p style="color:#667781;font-size:13px">ChatsApp se export · ${messages.length} messages</p>
${rows || '<p style="color:#667781">Koi message nahi.</p>'}
</div></body></html>`;
}
