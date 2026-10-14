'use client';

/**
 * SettingsModal — WhatsApp Web style settings (full-screen overlay, sub-views).
 * Profile · Privacy (last-seen/photo/online, forward-tag) · Disappearing ·
 * Notifications (push) · Devices (v3) · Starred · Scheduled · Locked chats ·
 * Blocked · Backup · Auto-archive · Logout.
 */

import { useEffect, useRef, useState } from 'react';
import { backend } from '@/lib/backend';
import type { ChatMessage, DeviceInfo, PrivacySettings, ScheduledMessage, UserProfile } from '@/lib/backend/types';
import type { BlockedUser } from '@/lib/v2/types';
import Avatar from '@/components/Avatar';
import { fmtTime } from '@/lib/format';
import { Icon, ICONS, RowBtn, SectionTitle, Toggle, backendV2, backendV3, v4call } from './common';

type View = 'main' | 'privacy' | 'disappearing' | 'notifications' | 'devices' | 'starred' | 'scheduled' | 'locked' | 'blocked' | 'backup';

interface Props {
  me: UserProfile;
  onClose(): void;
  onOpenProfile(): void;
}

const PIN_KEY = 'v4-pin';

export default function SettingsModal({ me, onClose, onOpenProfile }: Props) {
  const [view, setView] = useState<View>('main');

  const titles: Record<View, string> = {
    main: 'Settings',
    privacy: 'Privacy',
    disappearing: 'Disappearing messages',
    notifications: 'Notifications',
    devices: 'Linked devices',
    starred: 'Starred messages',
    scheduled: 'Scheduled messages',
    locked: 'Locked chats',
    blocked: 'Blocked users',
    backup: 'Chat backup',
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/60 animate-[v4fade_.15s_ease-out]" onClick={onClose} />
      <div className="relative bg-[#111b21] text-[#e9edef] rounded-2xl shadow-2xl border border-[#222d34] w-full max-w-[520px] h-[86vh] flex flex-col overflow-hidden animate-[v4pop_.18s_ease-out]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#222d34] shrink-0 bg-[#1f2c34]">
          {view !== 'main' ? (
            <button onClick={() => setView('main')} className="p-1.5 -ml-1 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition" title="Wapas">
              <Icon d={ICONS.chevLeft} size={22} />
            </button>
          ) : (
            <button onClick={onClose} className="p-1.5 -ml-1 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition" title="Band karein">
              <Icon d={ICONS.x} size={22} />
            </button>
          )}
          <h2 className="text-[16px] font-medium">{titles[view]}</h2>
        </div>
        <div className="flex-1 overflow-y-auto v4scroll min-h-0">
          {view === 'main' && <MainSettings me={me} go={setView} onOpenProfile={onOpenProfile} onClose={onClose} />}
          {view === 'privacy' && <PrivacyView me={me} />}
          {view === 'disappearing' && <DisappearingView me={me} />}
          {view === 'notifications' && <NotificationsView />}
          {view === 'devices' && <DevicesView />}
          {view === 'starred' && <StarredView />}
          {view === 'scheduled' && <ScheduledView />}
          {view === 'locked' && <LockedView />}
          {view === 'blocked' && <BlockedView />}
          {view === 'backup' && <BackupView />}
        </div>
      </div>
    </div>
  );
}

// ================= main =================

function MainSettings({ me, go, onOpenProfile, onClose }: { me: UserProfile; go(v: View): void; onOpenProfile(): void; onClose(): void }) {
  const [archived, setArchived] = useState<number | null>(null);
  const [archiving, setArchiving] = useState(false);

  const runArchive = async () => {
    setArchiving(true);
    const n = await v4call(() => backendV3.autoArchiveInactive());
    setArchived(n ?? 0);
    setArchiving(false);
  };

  return (
    <div className="animate-[v4fade_.18s_ease-out] py-2">
      <button onClick={onOpenProfile} className="w-full flex items-center gap-4 px-6 py-4 hover:bg-[#1f2c34] transition text-left">
        <Avatar name={me.displayName} photoURL={me.photoURL} size={56} />
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] text-[#e9edef] truncate">{me.displayName}</span>
          <span className="block text-[13px] text-[#8696a0] truncate mt-0.5">{me.about || 'About add karein…'}</span>
        </span>
        <Icon d={ICONS.chevRight} size={19} className="text-[#8696a0]" />
      </button>

      <div className="border-t border-[#222d34] mt-2 pt-2">
        <RowBtn icon="shield" label="Privacy" sub="Last seen, photo, forward tag" onClick={() => go('privacy')} />
        <RowBtn icon="timer" label="Disappearing messages" sub="Default auto-delete timer" onClick={() => go('disappearing')} />
        <RowBtn icon="bell" label="Notifications" sub="Push notifications" onClick={() => go('notifications')} />
        <RowBtn icon="devices" label="Linked devices" sub="Device manager" onClick={() => go('devices')} />
      </div>
      <div className="border-t border-[#222d34] mt-2 pt-2">
        <RowBtn icon="star" label="Starred messages" sub="Save kiye hue messages" onClick={() => go('starred')} />
        <RowBtn icon="calendar" label="Scheduled messages" sub="Baad me bhejein" onClick={() => go('scheduled')} />
        <RowBtn icon="lock" label="Locked chats" sub="PIN se mehfooz chats" onClick={() => go('locked')} />
        <RowBtn icon="eyeOff" label="Blocked users" sub="Block list" onClick={() => go('blocked')} />
      </div>
      <div className="border-t border-[#222d34] mt-2 pt-2">
        <RowBtn icon="archive" label="Auto-archive" sub={archived !== null ? `${archived} chats archive hui` : '30 din inactive chats archive karein'} onClick={runArchive} />
        {archiving && <p className="px-6 pb-2 text-[12.5px] text-[#8696a0]">Archive ho raha hai…</p>}
        <RowBtn icon="download" label="Chat backup" sub="Export / import" onClick={() => go('backup')} />
        <RowBtn icon="logout" label="Log out" danger onClick={() => { backend.signOut().catch(() => {}); onClose(); }} />
      </div>
      <p className="text-center text-[12px] text-[#8696a0] py-6">ChatsApp Web · v4</p>
    </div>
  );
}

// ================= privacy =================

function PrivacyView({ me }: { me: UserProfile }) {
  const [privacy, setPrivacy] = useState<PrivacySettings>(me.privacy ?? { lastSeen: 'everyone', photo: 'everyone', online: 'everyone' });
  const [hideTag, setHideTag] = useState(false);

  useEffect(() => {
    v4call(() => backendV3.getHideForwardTag()).then((v) => { if (v !== null) setHideTag(v); });
  }, []);

  const set = async (patch: Partial<PrivacySettings>) => {
    const next = { ...privacy, ...patch };
    setPrivacy(next);
    try { await backend.updatePrivacy(patch); } catch {}
  };

  const toggleHideTag = async () => {
    const next = !hideTag;
    setHideTag(next);
    await v4call(() => backendV3.setHideForwardTag(next));
  };

  const opts: { v: 'everyone' | 'nobody'; label: string }[] = [
    { v: 'everyone', label: 'Sab' },
    { v: 'nobody', label: 'Koi nahi' },
  ];

  return (
    <div className="animate-[v4fade_.18s_ease-out] py-2">
      <SectionTitle>Kaun dekh sakta hai</SectionTitle>
      {([['lastSeen', 'Last seen'], ['photo', 'Profile photo'], ['online', 'Online status']] as const).map(([k, label]) => (
        <div key={k} className="px-6 py-3">
          <p className="text-[14.5px] text-[#e9edef] mb-2">{label}</p>
          <div className="flex gap-2">
            {opts.map((o) => (
              <button
                key={o.v}
                onClick={() => set({ [k]: o.v })}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition ${privacy[k] === o.v ? 'bg-[#00a884]/15 text-[#00a884]' : 'bg-[#1f2c34] text-[#8696a0]'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="border-t border-[#222d34] mt-2 pt-2">
        <div className="flex items-center gap-4 px-6 py-3">
          <Icon d={ICONS.forward} size={22} className="text-[#8696a0]" />
          <span className="flex-1">
            <span className="block text-[14.5px] text-[#e9edef]">Forwarded tag chhupayein</span>
            <span className="block text-[12.5px] text-[#8696a0] mt-0.5">Forward kiye messages par “Forwarded” nahi likha aayega</span>
          </span>
          <Toggle value={hideTag} onToggle={toggleHideTag} />
        </div>
      </div>
    </div>
  );
}

// ================= disappearing =================

const DM_OPTIONS = [
  { label: 'Off', sec: 0 },
  { label: '24 ghante', sec: 86400 },
  { label: '7 din', sec: 604800 },
  { label: '90 din', sec: 7776000 },
];

function DisappearingView({ me }: { me: UserProfile }) {
  const [val, setVal] = useState(me.disappearingAfter ?? 0);
  const [expiring, setExpiring] = useState<ChatMessage[]>([]);
  useEffect(() => {
    v4call(() => backendV3.getExpiringSoon()).then((r) => { if (r) setExpiring(r); });
  }, []);
  const save = async (s: number) => {
    setVal(s);
    try { await backend.setDisappearingAfter(s); } catch { setVal(me.disappearingAfter ?? 0); }
  };
  return (
    <div className="animate-[v4fade_.18s_ease-out] py-2">
      <p className="px-6 pb-2 text-[13px] text-[#8696a0] leading-relaxed">
        Naye messages is muddat ke baad khud mit jayenge. Yeh default sirf aapke liye hai.
      </p>
      {DM_OPTIONS.map((o) => (
        <button key={o.sec} onClick={() => save(o.sec)} className="w-full flex items-center gap-3 px-6 py-3 hover:bg-[#1f2c34] transition text-left">
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${val === o.sec ? 'border-[#00a884]' : 'border-[#8696a0]'}`}>
            {val === o.sec && <span className="w-2.5 h-2.5 rounded-full bg-[#00a884]" />}
          </span>
          <span className="text-[14.5px] text-[#e9edef]">{o.label}</span>
        </button>
      ))}
      {expiring.length > 0 && (
        <>
          <SectionTitle>Jald mitne wale ({expiring.length})</SectionTitle>
          {expiring.slice(0, 10).map((m) => (
            <div key={m.id} className="px-6 py-2 flex items-center gap-3">
              <Icon d={ICONS.timer} size={17} className="text-[#ff9f1c] shrink-0" />
              <span className="text-[13.5px] text-[#e9edef] truncate flex-1">{m.text || `[${m.type}]`}</span>
              <span className="text-[12px] text-[#8696a0] shrink-0">{m.selfDestructAt ? fmtTime(m.selfDestructAt) : ''}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ================= notifications =================

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
function keyToBase64(key: ArrayBuffer | null): string {
  if (!key) return '';
  const bytes = new Uint8Array(key);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return window.btoa(str);
}

function NotificationsView() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {});
  }, []);

  const toggle = async () => {
    setBusy(true);
    setErr('');
    try {
      if (enabled) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        await sub?.unsubscribe();
        await backend.unsubscribePush().catch(() => {});
        setEnabled(false);
      } else {
        const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapid) throw new Error('Push setup nahi hai');
        let permission = Notification.permission;
        if (permission === 'default') permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error('Permission nahi mili');
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
        setEnabled(true);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Nahi ho saka');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-[v4fade_.18s_ease-out] py-2">
      <div className="flex items-center gap-4 px-6 py-4">
        <Icon d={ICONS.bell} size={24} className="text-[#8696a0]" />
        <span className="flex-1">
          <span className="block text-[15px] text-[#e9edef]">Push notifications</span>
          <span className="block text-[12.5px] text-[#8696a0] mt-0.5">Naye messages ki khabar, browser band ho tab bhi</span>
        </span>
        <Toggle value={enabled} onToggle={() => { if (!busy) toggle(); }} />
      </div>
      {err && <p className="px-6 text-[13px] text-[#ea0038]">{err}</p>}
      <p className="px-6 pt-2 text-[12.5px] text-[#8696a0] leading-relaxed">
        Har chat ko alag se mute/unmute chat info se kiya ja sakta hai.
      </p>
    </div>
  );
}

// ================= devices (v3) =================

function DevicesView() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    v4call(() => backendV3.getDevices()).then((d) => {
      setDevices(d ?? []);
      setLoading(false);
    });
  };
  useEffect(load, []);
  const revoke = async (id: string) => {
    const ok = await v4call(() => backendV3.revokeDevice(id));
    if (ok !== null) setDevices((d) => d.filter((x) => x.id !== id));
  };
  return (
    <div className="animate-[v4fade_.18s_ease-out] py-2">
      {loading && <p className="px-6 text-[13px] text-[#8696a0]">Load ho raha hai…</p>}
      {!loading && devices.length === 0 && <p className="px-6 text-[13px] text-[#8696a0]">Koi linked device nahi.</p>}
      {devices.map((d) => (
        <div key={d.id} className="flex items-center gap-4 px-6 py-3.5 border-b border-[#222d34]">
          <Icon d={ICONS.devices} size={24} className="text-[#8696a0] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[14.5px] text-[#e9edef] truncate">
              {d.name} {d.isCurrent && <span className="text-[11px] text-[#00a884] font-medium ml-1">YEH DEVICE</span>}
            </p>
            <p className="text-[12px] text-[#8696a0]">Last active: {fmtTime(d.lastActive)}</p>
          </div>
          {!d.isCurrent && (
            <button onClick={() => revoke(d.id)} className="text-[13px] text-[#ea0038] hover:underline shrink-0">Remove</button>
          )}
        </div>
      ))}
    </div>
  );
}

// ================= starred =================

function StarredView() {
  const [items, setItems] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    backend.getStarredMessages().then((r) => { setItems(r); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  const unstar = async (id: string) => {
    await backend.starMessage(id, false).catch(() => {});
    setItems((x) => x.filter((m) => m.id !== id));
  };
  return (
    <div className="animate-[v4fade_.18s_ease-out] py-2">
      {loading && <p className="px-6 text-[13px] text-[#8696a0]">Load ho raha hai…</p>}
      {!loading && items.length === 0 && <p className="px-6 text-[13px] text-[#8696a0]">Koi starred message nahi.</p>}
      {items.map((m) => (
        <div key={m.id} className="flex items-start gap-3 px-6 py-3 border-b border-[#222d34]">
          <Icon d={ICONS.star} size={18} className="text-[#ff9f1c] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-[#00a884] font-medium">{m.senderName}</p>
            <p className="text-[13.5px] text-[#e9edef] break-words mt-0.5">{m.text || `[${m.type}]`}</p>
          </div>
          <button onClick={() => unstar(m.id)} className="p-1.5 text-[#8696a0] hover:text-[#ea0038] shrink-0" title="Unstar">
            <Icon d={ICONS.x} size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ================= scheduled (all chats) =================

function ScheduledView() {
  const [items, setItems] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    backend.getScheduledMessages().then((r) => { setItems(r); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  const cancel = async (id: string) => {
    await backend.cancelScheduledMessage(id).catch(() => {});
    setItems((x) => x.filter((s) => s.id !== id));
  };
  return (
    <div className="animate-[v4fade_.18s_ease-out] py-2">
      {loading && <p className="px-6 text-[13px] text-[#8696a0]">Load ho raha hai…</p>}
      {!loading && items.length === 0 && <p className="px-6 text-[13px] text-[#8696a0]">Koi scheduled message nahi.</p>}
      {items.map((s) => (
        <div key={s.id} className="flex items-center gap-3 px-6 py-3 border-b border-[#222d34]">
          <Icon d={ICONS.calendar} size={19} className="text-[#00a884] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] text-[#e9edef] truncate">{s.input.text || `[${s.input.type}]`}</p>
            <p className="text-[12px] text-[#8696a0]">{new Date(s.sendAt).toLocaleString()} · {s.chatId.slice(0, 8)}…</p>
          </div>
          <button onClick={() => cancel(s.id)} className="text-[12.5px] text-[#ea0038] hover:underline shrink-0">Cancel</button>
        </div>
      ))}
    </div>
  );
}

// ================= locked chats =================

function LockedView() {
  const [pin, setPin] = useState('');
  const [saved, setSaved] = useState(!!(typeof window !== 'undefined' && localStorage.getItem(PIN_KEY)));
  const [msg, setMsg] = useState('');
  const save = () => {
    if (pin.length < 4) { setMsg('PIN kam az kam 4 digit ka ho.'); return; }
    try { localStorage.setItem(PIN_KEY, pin); setSaved(true); setMsg('PIN set ho gaya.'); setPin(''); }
    catch { setMsg('Save nahi ho saka.'); }
  };
  const clear = () => {
    try { localStorage.removeItem(PIN_KEY); localStorage.removeItem('v4-unlocked'); } catch {}
    setSaved(false);
    setMsg('PIN hata diya gaya.');
  };
  return (
    <div className="animate-[v4fade_.18s_ease-out] p-6">
      <div className="flex justify-center mb-4 text-[#8696a0]"><Icon d={ICONS.lock} size={44} /></div>
      <p className="text-center text-[13.5px] text-[#8696a0] leading-relaxed mb-5">
        Chat list me kisi chat par right-click karke “Lock karein” dabayein. Khulne ke liye yeh PIN lagega.
      </p>
      {saved ? (
        <div className="text-center">
          <p className="text-[14px] text-[#00a884] mb-4">PIN set hai.</p>
          <button onClick={clear} className="px-6 py-2.5 rounded-full bg-[#ea0038]/10 text-[#ea0038] text-[14px] font-medium">PIN hatayein</button>
        </div>
      ) : (
        <div>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Naya PIN (4+ digit)"
            className="w-full bg-[#1f2c34] rounded-full px-5 py-3 text-center text-[16px] tracking-[0.4em] outline-none text-[#e9edef] mb-3"
          />
          <button onClick={save} className="w-full py-2.5 rounded-full bg-[#00a884] text-white text-[15px] font-medium hover:brightness-110 transition">PIN set karein</button>
        </div>
      )}
      {msg && <p className="text-center text-[13px] text-[#8696a0] mt-3">{msg}</p>}
    </div>
  );
}

// ================= blocked =================

function BlockedView() {
  const [list, setList] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    v4call(() => backendV2.getBlockedUsers()).then((r) => { setList(r ?? []); setLoading(false); });
  }, []);
  const unblock = async (uid: string) => {
    const ok = await v4call(() => backendV2.unblockUser(uid));
    if (ok !== null) setList((l) => l.filter((b) => b.userId !== uid));
  };
  return (
    <div className="animate-[v4fade_.18s_ease-out] py-2">
      {loading && <p className="px-6 text-[13px] text-[#8696a0]">Load ho raha hai…</p>}
      {!loading && list.length === 0 && <p className="px-6 text-[13px] text-[#8696a0]">Koi blocked user nahi.</p>}
      {list.map((b) => (
        <div key={b.userId} className="flex items-center gap-3 px-6 py-3 border-b border-[#222d34]">
          <Avatar name={b.userId} size={42} />
          <span className="flex-1 text-[14px] text-[#e9edef] truncate">{b.userId}</span>
          <button onClick={() => unblock(b.userId)} className="text-[13px] text-[#00a884] hover:underline shrink-0">Unblock</button>
        </div>
      ))}
    </div>
  );
}

// ================= backup =================

function BackupView() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = async () => {
    setBusy(true);
    setMsg('');
    const json = await v4call(() => backendV2.exportChatBackup());
    setBusy(false);
    if (json) {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `chatsapp-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg('Backup download ho gaya.');
    } else setMsg('Backup nahi ban saka.');
  };

  const doImport = async (f: File) => {
    setBusy(true);
    setMsg('');
    try {
      const text = await f.text();
      const ok = await v4call(() => backendV2.importChatBackup(text));
      setMsg(ok !== null ? 'Backup restore ho gaya.' : 'Restore nahi ho saka.');
    } catch {
      setMsg('File parhi nahi ja saki.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-[v4fade_.18s_ease-out] p-6">
      <div className="flex justify-center mb-4 text-[#00a884]"><Icon d={ICONS.download} size={44} /></div>
      <p className="text-center text-[13.5px] text-[#8696a0] leading-relaxed mb-5">
        Apni chats ka backup download karein ya purana backup wapas layein.
      </p>
      <button onClick={doExport} disabled={busy} className="w-full py-2.5 rounded-full bg-[#00a884] text-white text-[15px] font-medium hover:brightness-110 transition disabled:opacity-50 mb-2">
        {busy ? 'Kaam ho raha hai…' : 'Backup download karein'}
      </button>
      <button onClick={() => fileRef.current?.click()} disabled={busy} className="w-full py-2.5 rounded-full bg-[#1f2c34] text-[#e9edef] text-[15px] font-medium hover:bg-[#2a3942] transition disabled:opacity-50">
        Backup restore karein
      </button>
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
      {msg && <p className="text-center text-[13px] text-[#8696a0] mt-4">{msg}</p>}
    </div>
  );
}
