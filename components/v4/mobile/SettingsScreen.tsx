'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Avatar from '@/components/Avatar';
import { backend, backendV2, backendV3 } from '@/lib/backend';
import type { Chat, ChatMessage, DeviceInfo, PrivacyLevel, ScheduledMessage, UserProfile } from '@/lib/backend/types';
import type { BlockedUser } from '@/lib/v2/types';
import { fmtTime } from '@/lib/format';
import BottomSheet, { SheetRow } from './BottomSheet';
import { tapHaptic } from '../../v2/shared/haptics';
import {
  CameraIcon, StarIcon, ClockIcon, BellIcon, ShieldIcon,
  BlockIcon, DevicesIcon, BackupIcon, LogoutIcon, XIcon, CheckIcon,
} from './icons';
import { chatDisplayName } from './ChatsScreen';

function b64(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64s = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function SettingsScreen({
  user,
  chats,
  onSignOut,
}: {
  user: UserProfile;
  chats: Chat[];
  onSignOut: () => void;
}) {
  const [sheet, setSheet] = useState<
    | null
    | { kind: 'name' } | { kind: 'about' } | { kind: 'photo' }
    | { kind: 'starred' } | { kind: 'scheduled' } | { kind: 'privacy' }
    | { kind: 'blocked' } | { kind: 'devices' } | { kind: 'backup' }
    | { kind: 'disappearing' } | { kind: 'push' }
  >(null);
  const [name, setName] = useState(user.displayName);
  const [about, setAbout] = useState(user.about || '');
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [starred, setStarred] = useState<ChatMessage[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const [privacy, setPrivacy] = useState(user.privacy || { lastSeen: 'everyone', photo: 'everyone', online: 'everyone' });
  const [hideFwd, setHideFwd] = useState(false);
  const [disappearing, setDisappearing] = useState(user.disappearingAfter || 0);
  const [pushOn, setPushOn] = useState(false);
  const [msg, setMsg] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    backendV2.getBlockedUsers().then(setBlocked).catch(() => setBlocked([]));
    backendV3.getDevices?.().then(setDevices).catch(() => setDevices([]));
    backend.getStarredMessages().then(setStarred).catch(() => setStarred([]));
    backend.getScheduledMessages().then(setScheduled).catch(() => setScheduled([]));
    backendV3.getHideForwardTag?.().then(setHideFwd).catch(() => {});
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription())
        .then((s) => setPushOn(!!s)).catch(() => {});
    }
  }, []);

  const flash = (t: string) => {
    setMsg(t);
    setTimeout(() => setMsg(''), 2500);
  };

  const saveProfile = async (patch: Partial<Pick<UserProfile, 'displayName' | 'about' | 'photoURL'>>) => {
    setSaving(true);
    try {
      await backend.updateProfile(patch);
      flash('Profile update ho gayi');
      setSheet(null);
    } catch { flash('Save nahi ho saka'); }
    setSaving(false);
  };

  const onPhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setSaving(true);
    try {
      const { url } = await backend.uploadMedia('profile-photos', f);
      await backend.updateProfile({ photoURL: url });
      flash('Photo update ho gayi');
      setSheet(null);
    } catch { flash('Photo upload nahi ho saki'); }
    setSaving(false);
  };

  const setPriv = async (key: 'lastSeen' | 'photo' | 'online', val: PrivacyLevel) => {
    const prev = privacy;
    setPrivacy({ ...privacy, [key]: val });
    try { await backend.updatePrivacy({ [key]: val }); }
    catch { setPrivacy(prev); }
  };

  const togglePush = async () => {
    try {
      if (pushOn) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        await sub?.unsubscribe();
        await backend.unsubscribePush().catch(() => {});
        setPushOn(false);
        flash('Notifications band');
      } else {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { flash('Permission nahi mili'); return; }
        const r = await fetch('/api/push/vapid-key').then((x) => x.json()).catch(() => ({}));
        const key = r.key || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
        if (!key) { flash('Push setup nahi hai'); return; }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
        await backend.subscribePush({
          endpoint: sub.endpoint,
          keys: { p256dh: b64(sub.getKey('p256dh')), auth: b64(sub.getKey('auth')) },
        });
        setPushOn(true);
        flash('Notifications chalu');
      }
    } catch { flash('Push setup nahi ho saka'); }
  };

  const exportBackup = async () => {
    try {
      const json = await backendV2.exportChatBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `chatsapp-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      flash('Backup download ho gaya');
    } catch { flash('Backup nahi ho saka'); }
  };

  const importBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const text = await f.text();
      await backendV2.importChatBackup(text);
      flash('Backup restore ho gaya');
    } catch { flash('Backup restore nahi ho saka'); }
  };

  const chatNameOf = (chatId: string) => {
    const c = chats.find((x) => x.id === chatId);
    return c ? chatDisplayName(c, user.id) : 'Chat';
  };

  return (
    <div className="flex flex-col h-full">
      <header className="wa4-safe-top bg-[var(--wa4-header)] z-20">
        <div className="flex items-center pl-5 pr-2 h-[60px]">
          <span className="text-[19px] font-semibold text-[var(--wa4-text)] flex-1">Settings</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-6">
        {msg && (
          <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-[var(--wa4-accent-dim)] text-[var(--wa4-accent)] text-[13.5px] font-medium wa4-fade-in">
            {msg}
          </div>
        )}

        {/* Profile card */}
        <button onClick={() => setSheet({ kind: 'photo' })}
          className="wa4-row w-full flex items-center gap-4 px-5 py-4 text-left border-b border-[var(--wa4-divider)]">
          <Avatar name={user.displayName} photoURL={user.photoURL} size={64} />
          <span className="flex-1 min-w-0">
            <span className="block text-[18px] font-medium text-[var(--wa4-text)] truncate">{user.displayName}</span>
            <span className="block text-[14px] text-[var(--wa4-muted)] truncate mt-0.5">{user.about || 'Hey there! ChatsApp use kar raha hun.'}</span>
          </span>
          <span className="text-[var(--wa4-accent)]"><CameraIcon size={22} /></span>
        </button>

        <div className="pt-2">
          <SheetRow label="Starred messages" sub={`${starred.length} starred`} onClick={() => setSheet({ kind: 'starred' })}
            icon={<StarIcon size={22} />} />
          <SheetRow label="Scheduled messages" sub={`${scheduled.length} scheduled`} onClick={() => setSheet({ kind: 'scheduled' })}
            icon={<ClockIcon size={22} />} />
          <SheetRow label="Notifications" sub={pushOn ? 'Chalu hain' : 'Band hain'}
            onClick={togglePush} icon={<BellIcon size={22} />} />
          <SheetRow label="Privacy" sub="Last seen, photo, online" onClick={() => setSheet({ kind: 'privacy' })}
            icon={<ShieldIcon size={22} />} />
          <SheetRow label="Disappearing messages"
            sub={disappearing === 0 ? 'Band hain' : disappearing < 60 ? `${disappearing} second` : disappearing < 3600 ? `${disappearing / 60} minute` : `${disappearing / 3600} ghanta`}
            onClick={() => setSheet({ kind: 'disappearing' })} icon={<ClockIcon size={22} />} />
          <SheetRow label={`Blocked (${blocked.length})`} sub="Blocked users" onClick={() => setSheet({ kind: 'blocked' })}
            icon={<BlockIcon size={22} />} />
          <SheetRow label={`Linked devices (${devices.length})`} sub="Devices manage karein" onClick={() => setSheet({ kind: 'devices' })}
            icon={<DevicesIcon size={22} />} />
          <SheetRow label="Chat backup" sub="Export / import" onClick={() => setSheet({ kind: 'backup' })}
            icon={<BackupIcon size={22} />} />
        </div>

        <div className="mt-4 px-5 flex items-center gap-3">
          <Image src="/logo.png" alt="ChatsApp" width={44} height={44} className="rounded-xl" />
          <div>
            <p className="text-[15px] font-semibold text-[var(--wa4-text)]">ChatsApp</p>
            <p className="text-[12.5px] text-[var(--wa4-muted)]">v4 · WhatsApp-style chat</p>
          </div>
        </div>

        <div className="px-5 mt-5">
          <button onClick={onSignOut}
            className="w-full h-12 rounded-full border border-[var(--wa4-danger)]/50 text-[var(--wa4-danger)] font-semibold flex items-center justify-center gap-2 wa4-fab">
            <LogoutIcon size={20} /> Log out
          </button>
        </div>
      </div>

      <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={onPhotoPick} />
      <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={importBackup} />

      {/* ---- Profile: name/about/photo ---- */}
      <BottomSheet open={sheet?.kind === 'photo'} onClose={() => setSheet(null)} title="Profile">
        <div className="px-5 pb-6">
          <div className="flex justify-center py-3">
            <Avatar name={user.displayName} photoURL={user.photoURL} size={96} />
          </div>
          <button onClick={() => photoRef.current?.click()} disabled={saving}
            className="w-full h-12 rounded-full bg-[var(--wa4-accent-dim)] text-[var(--wa4-accent)] font-semibold mb-4 disabled:opacity-40">
            {saving ? 'Upload ho rahi hai...' : 'Photo badlein'}
          </button>
          <label className="text-[13px] text-[var(--wa4-muted)] font-medium">Naam</label>
          <div className="flex gap-2 mt-1 mb-3">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
              className="flex-1 h-12 px-4 rounded-xl bg-[var(--wa4-input)] outline-none text-[15px] text-[var(--wa4-text)]" />
            <button onClick={() => name.trim() && saveProfile({ displayName: name.trim() })} disabled={saving || !name.trim()}
              className="w-12 h-12 rounded-xl bg-[var(--wa4-accent)] text-[#0b141a] flex items-center justify-center shrink-0 disabled:opacity-40"
              aria-label="Naam save karein">
              <CheckIcon size={20} />
            </button>
          </div>
          <label className="text-[13px] text-[var(--wa4-muted)] font-medium">About</label>
          <div className="flex gap-2 mt-1">
            <input value={about} onChange={(e) => setAbout(e.target.value)} maxLength={140} placeholder="Apne baare me likhein"
              className="flex-1 h-12 px-4 rounded-xl bg-[var(--wa4-input)] outline-none text-[15px] text-[var(--wa4-text)] placeholder:text-[var(--wa4-muted)]" />
            <button onClick={() => saveProfile({ about: about.trim() })} disabled={saving}
              className="w-12 h-12 rounded-xl bg-[var(--wa4-accent)] text-[#0b141a] flex items-center justify-center shrink-0 disabled:opacity-40"
              aria-label="About save karein">
              <CheckIcon size={20} />
            </button>
          </div>
          <p className="text-[12.5px] text-[var(--wa4-muted)] mt-3">{user.email}</p>
        </div>
      </BottomSheet>

      {/* ---- Starred ---- */}
      <BottomSheet open={sheet?.kind === 'starred'} onClose={() => setSheet(null)} title="Starred messages">
        <div className="pb-6 max-h-[60dvh] overflow-y-auto">
          {starred.length === 0 && <p className="text-[var(--wa4-muted)] text-[14px] text-center py-8">Koi starred message nahi</p>}
          {starred.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-[var(--wa4-divider)]">
              <span className="flex-1 min-w-0">
                <span className="block text-[12px] text-[var(--wa4-accent)] font-medium">{chatNameOf(m.chatId)} · {m.senderName}</span>
                <span className="block text-[14px] text-[var(--wa4-text)] truncate">{m.text || m.type}</span>
              </span>
              <button onClick={() => {
                backend.starMessage(m.id, false).catch(() => {});
                setStarred((s) => s.filter((x) => x.id !== m.id));
              }} className="text-[var(--wa4-muted)] p-2" aria-label="Unstar karein">
                <XIcon size={18} />
              </button>
            </div>
          ))}
        </div>
      </BottomSheet>

      {/* ---- Scheduled ---- */}
      <BottomSheet open={sheet?.kind === 'scheduled'} onClose={() => setSheet(null)} title="Scheduled messages">
        <div className="pb-6 max-h-[60dvh] overflow-y-auto">
          {scheduled.length === 0 && <p className="text-[var(--wa4-muted)] text-[14px] text-center py-8">Koi scheduled message nahi</p>}
          {scheduled.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-[var(--wa4-divider)]">
              <span className="flex-1 min-w-0">
                <span className="block text-[12px] text-[var(--wa4-accent)] font-medium">{chatNameOf(s.chatId)} · {fmtTime(s.sendAt)}</span>
                <span className="block text-[14px] text-[var(--wa4-text)] truncate">{s.input.text || s.input.type}</span>
              </span>
              <button onClick={() => {
                backend.cancelScheduledMessage(s.id).catch(() => {});
                setScheduled((arr) => arr.filter((x) => x.id !== s.id));
                tapHaptic();
              }} className="text-[var(--wa4-danger)] p-2" aria-label="Cancel karein">
                <XIcon size={18} />
              </button>
            </div>
          ))}
        </div>
      </BottomSheet>

      {/* ---- Privacy ---- */}
      <BottomSheet open={sheet?.kind === 'privacy'} onClose={() => setSheet(null)} title="Privacy">
        <div className="px-5 pb-6">
          {([
            { key: 'lastSeen', label: 'Last seen' },
            { key: 'photo', label: 'Profile photo' },
            { key: 'online', label: 'Online status' },
          ] as const).map((row) => (
            <div key={row.key} className="mb-4">
              <p className="text-[14px] font-medium text-[var(--wa4-text)] mb-2">{row.label}</p>
              <div className="flex gap-2">
                {(['everyone', 'nobody'] as PrivacyLevel[]).map((v) => (
                  <button key={v} onClick={() => setPriv(row.key, v)}
                    className={`flex-1 h-10 rounded-full text-[13.5px] font-medium ${
                      privacy[row.key] === v
                        ? 'bg-[var(--wa4-accent)] text-[#0b141a] font-semibold'
                        : 'bg-[var(--wa4-input)] text-[var(--wa4-muted)]'
                    }`}>
                    {v === 'everyone' ? 'Sab' : 'Koi nahi'}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={async () => {
            const nv = !hideFwd;
            setHideFwd(nv);
            try { await backendV3.setHideForwardTag?.(nv); } catch {}
          }} className="wa4-row w-full flex items-center justify-between py-3 text-left">
            <span>
              <span className="block text-[14px] text-[var(--wa4-text)]">Forwarded tag chhupayein</span>
              <span className="block text-[12.5px] text-[var(--wa4-muted)]">Forward kiye messages par tag na dikhe</span>
            </span>
            <span className={`w-12 h-7 rounded-full p-1 transition-colors ${hideFwd ? 'bg-[var(--wa4-accent)]' : 'bg-[var(--wa4-input)]'}`}>
              <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${hideFwd ? 'translate-x-5' : ''}`} />
            </span>
          </button>
        </div>
      </BottomSheet>

      {/* ---- Disappearing ---- */}
      <BottomSheet open={sheet?.kind === 'disappearing'} onClose={() => setSheet(null)} title="Disappearing messages">
        <div className="pb-6 pt-1">
          {[
            { label: 'Band', secs: 0 },
            { label: '10 second', secs: 10 },
            { label: '1 minute', secs: 60 },
            { label: '1 ghanta', secs: 3600 },
            { label: '1 din', secs: 86400 },
          ].map((o) => (
            <button key={o.secs} onClick={async () => {
              try {
                await backend.setDisappearingAfter(o.secs);
                setDisappearing(o.secs);
                flash('Disappearing messages update ho gaye');
                setSheet(null);
              } catch { flash('Update nahi ho saka'); }
            }} className="wa4-row w-full flex items-center justify-between px-5 py-3.5 text-left">
              <span className="text-[15.5px] text-[var(--wa4-text)]">{o.label}</span>
              {disappearing === o.secs && <span className="text-[var(--wa4-accent)]"><CheckIcon size={20} /></span>}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* ---- Blocked ---- */}
      <BottomSheet open={sheet?.kind === 'blocked'} onClose={() => setSheet(null)} title="Blocked users">
        <div className="pb-6 max-h-[60dvh] overflow-y-auto">
          {blocked.length === 0 && <p className="text-[var(--wa4-muted)] text-[14px] text-center py-8">Koi blocked user nahi</p>}
          {blocked.map((b) => (
            <div key={b.userId} className="flex items-center gap-3 px-5 py-2.5">
              <Avatar name={b.userId} size={44} />
              <span className="flex-1 text-[15px] text-[var(--wa4-text)] truncate">{b.userId}</span>
              <button onClick={async () => {
                try {
                  await backendV2.unblockUser(b.userId);
                  setBlocked((arr) => arr.filter((x) => x.userId !== b.userId));
                  flash('Unblock ho gaya');
                } catch {}
              }} className="text-[13.5px] font-semibold text-[var(--wa4-accent)] px-3 py-2">
                Unblock
              </button>
            </div>
          ))}
        </div>
      </BottomSheet>

      {/* ---- Devices ---- */}
      <BottomSheet open={sheet?.kind === 'devices'} onClose={() => setSheet(null)} title="Linked devices">
        <div className="pb-6 max-h-[60dvh] overflow-y-auto">
          {devices.length === 0 && <p className="text-[var(--wa4-muted)] text-[14px] text-center py-8">Koi device nahi mila</p>}
          {devices.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-[var(--wa4-divider)]">
              <span className="text-[var(--wa4-muted)]"><DevicesIcon size={22} /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] text-[var(--wa4-text)] truncate">
                  {d.name}{d.isCurrent ? ' (ye device)' : ''}
                </span>
                <span className="block text-[12.5px] text-[var(--wa4-muted)]">
                  Last active: {d.lastActive ? fmtTime(d.lastActive) : '—'}
                </span>
              </span>
              {!d.isCurrent && (
                <button onClick={async () => {
                  try {
                    await backendV3.revokeDevice?.(d.id);
                    setDevices((arr) => arr.filter((x) => x.id !== d.id));
                    flash('Device hata diya');
                  } catch {}
                }} className="text-[13.5px] font-semibold text-[var(--wa4-danger)] px-3 py-2">
                  Hatayein
                </button>
              )}
            </div>
          ))}
        </div>
      </BottomSheet>

      {/* ---- Backup ---- */}
      <BottomSheet open={sheet?.kind === 'backup'} onClose={() => setSheet(null)} title="Chat backup">
        <div className="px-5 pb-6">
          <p className="text-[13.5px] text-[var(--wa4-muted)] mb-4">
            Apni chats ka backup JSON file me save karein, ya purana backup wapas layein.
          </p>
          <button onClick={exportBackup}
            className="w-full h-12 rounded-full bg-[var(--wa4-accent)] text-[#0b141a] font-semibold mb-2 wa4-fab">
            Backup download karein
          </button>
          <button onClick={() => importRef.current?.click()}
            className="w-full h-12 rounded-full bg-[var(--wa4-input)] text-[var(--wa4-text)] font-semibold">
            Backup restore karein
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
