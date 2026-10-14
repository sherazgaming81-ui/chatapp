'use client';

/**
 * ChatInfo — right slide-over panel (WhatsApp Web style).
 * Group/contact info · members (admin actions) · media grid · pinned ·
 * polls + analytics · invite link · join requests · ownership · disappearing ·
 * slow mode · chat analytics (v3) · scheduled messages · block.
 */

import { useEffect, useMemo, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat, ChatMessage, ChatAnalytics, ScheduledMessage, UserProfile } from '@/lib/backend/types';
import type { InviteLink, JoinRequest, PollAnalytics } from '@/lib/v2/types';
import Avatar from '@/components/Avatar';
import { fmtTime } from '@/lib/format';
import { Icon, ICONS, Modal, RowBtn, SectionTitle, Toggle, backendV2, backendV3, v4call, fmtSeenHinglish } from './common';
import PhotoViewer from './PhotoViewer';

type View = 'main' | 'members' | 'media' | 'polls' | 'invite' | 'requests' | 'ownership' | 'disappearing' | 'slowmode' | 'analytics' | 'scheduled';

interface Props {
  chat: Chat;
  me: UserProfile;
  onClose(): void;
  onJumpTo(id: string): void;
}

export default function ChatInfo({ chat, me, onClose, onJumpTo }: Props) {
  const [view, setView] = useState<View>('main');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinned, setPinned] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const unsub = backend.onMessages(chat.id, setMessages);
    backend.getPinnedMessages(chat.id).then(setPinned).catch(() => setPinned([]));
    return unsub;
  }, [chat.id]);

  const isGroup = chat.type === 'group';
  const isAdmin = (chat.adminIds || []).includes(me.id);
  const isOwner = isGroup && (chat.adminIds || [])[0] === me.id;
  const otherId = !isGroup ? chat.participants.find((p) => p !== me.id) : undefined;
  const otherProf = otherId ? chat.participantProfiles[otherId] : undefined;

  const media = useMemo(() => messages.filter((m) => m.type === 'image' && m.mediaURL), [messages]);
  const docs = useMemo(() => messages.filter((m) => m.type === 'file'), [messages]);
  const polls = useMemo(() => messages.filter((m) => m.type === 'poll' && m.poll), [messages]);

  const titles: Record<View, string> = {
    main: isGroup ? 'Group info' : 'Contact info',
    members: 'Members',
    media: 'Media aur documents',
    polls: 'Polls',
    invite: 'Invite link',
    requests: 'Join requests',
    ownership: 'Ownership transfer',
    disappearing: 'Disappearing messages',
    slowmode: 'Slow mode',
    analytics: 'Chat analytics',
    scheduled: 'Scheduled messages',
  };

  return (
    <div className="h-full flex flex-col bg-[#111b21] animate-[v4slideL_.22s_ease-out]">
      {/* header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-[#1f2c34] shrink-0">
        {view !== 'main' ? (
          <button onClick={() => setView('main')} className="p-1.5 -ml-1 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition" title="Wapas">
            <Icon d={ICONS.chevLeft} size={22} />
          </button>
        ) : (
          <button onClick={onClose} className="p-1.5 -ml-1 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition" title="Band karein">
            <Icon d={ICONS.x} size={22} />
          </button>
        )}
        <h2 className="text-[16px] font-medium text-[#e9edef]">{titles[view]}</h2>
      </div>

      <div className="flex-1 overflow-y-auto v4scroll min-h-0">
        {view === 'main' && (
          <MainView
            chat={chat} me={me} isGroup={isGroup} isAdmin={isAdmin} isOwner={isOwner}
            otherProf={otherProf} media={media} docs={docs} polls={polls} pinned={pinned}
            go={setView} onJumpTo={onJumpTo}
          />
        )}
        {view === 'members' && <MembersView chat={chat} me={me} isAdmin={isAdmin} />}
        {view === 'media' && <MediaView media={media} docs={docs} />}
        {view === 'polls' && <PollsView polls={polls} />}
        {view === 'invite' && <InviteView chatId={chat.id} />}
        {view === 'requests' && <RequestsView chatId={chat.id} />}
        {view === 'ownership' && <OwnershipView chat={chat} me={me} />}
        {view === 'disappearing' && <DisappearingView me={me} />}
        {view === 'slowmode' && <SlowModeView chatId={chat.id} current={chat.slowModeSec ?? 0} />}
        {view === 'analytics' && <AnalyticsView chatId={chat.id} />}
        {view === 'scheduled' && <ScheduledView chatId={chat.id} />}
      </div>
    </div>
  );
}

// ================= main =================

function MainView(props: {
  chat: Chat; me: UserProfile; isGroup: boolean; isAdmin: boolean; isOwner: boolean;
  otherProf?: { displayName: string; photoURL: string; online?: boolean; lastSeen?: number; about?: string };
  media: ChatMessage[]; docs: ChatMessage[]; polls: ChatMessage[]; pinned: ChatMessage[];
  go(v: View): void; onJumpTo(id: string): void;
}) {
  const { chat, me, isGroup, isAdmin, isOwner, otherProf, media, docs, polls, pinned, go, onJumpTo } = props;
  const [muted, setMuted] = useState(false);
  const [tone, setTone] = useState('default');
  const [descEdit, setDescEdit] = useState(false);
  const [desc, setDesc] = useState(chat.description || '');
  const [photoOpen, setPhotoOpen] = useState(false);
  const [e2e, setE2e] = useState<boolean | null>(null);

  useEffect(() => {
    backend.getChatNotificationSettings(chat.id).then((s) => setMuted(s.muted)).catch(() => {});
    v4call(() => backendV2.getChatTone(chat.id)).then((t) => { if (t) setTone(t); });
    v4call(() => backendV3.isE2EEnabled(chat.id)).then((v) => { if (v !== null) setE2e(v); });
  }, [chat.id]);

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    try { await backend.setChatMuted(chat.id, next); } catch { setMuted(!next); }
  };

  return (
    <div className="animate-[v4fade_.18s_ease-out]">
      {/* hero */}
      <div className="flex flex-col items-center px-6 pt-7 pb-6">
        <button onClick={() => chat.photoURL && setPhotoOpen(true)} className="relative group" title={chat.name}>
          <Avatar name={chat.name} photoURL={chat.photoURL} size={150} />
          {chat.photoURL && (
            <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
              <Icon d={ICONS.search} size={30} />
            </span>
          )}
        </button>
        {photoOpen && chat.photoURL && <PhotoViewer src={chat.photoURL} caption={chat.name} onClose={() => setPhotoOpen(false)} />}
        <h3 className="text-[21px] font-normal mt-4 text-center break-words text-[#e9edef]">{chat.name}</h3>
        {isGroup ? (
          <p className="text-[13.5px] text-[#8696a0] mt-1">{chat.participants.length} members</p>
        ) : (
          <p className="text-[13.5px] text-[#8696a0] mt-1">
            {otherProf ? fmtSeenHinglish(otherProf.lastSeen ?? 0, !!otherProf.online) || 'last seen pata nahi' : ''}
          </p>
        )}
        {isGroup && (
          <div className="w-full mt-4">
            {descEdit ? (
              <div className="flex gap-2">
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Group description…"
                  className="flex-1 bg-[#1f2c34] rounded-full px-4 py-2 text-[13.5px] outline-none text-[#e9edef]"
                />
                <button
                  onClick={() => backend.setGroupDescription(chat.id, desc).then(() => setDescEdit(false)).catch(() => {})}
                  className="px-4 rounded-full bg-[#00a884] text-white text-[13px] font-medium"
                >
                  Save karein
                </button>
              </div>
            ) : (
              <button onClick={() => isAdmin && setDescEdit(true)} className="w-full text-center text-[13.5px] text-[#8696a0] leading-relaxed">
                {chat.description || (isAdmin ? 'Description add karein…' : 'Koi description nahi.')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* quick toggles */}
      <div className="py-2">
        <div className="flex items-center gap-4 px-6 py-3">
          <Icon d={ICONS.mute} size={22} className="text-[#8696a0]" />
          <span className="text-[15px] text-[#e9edef] flex-1">Mute notifications</span>
          <Toggle value={muted} onToggle={toggleMute} />
        </div>
        <div className="flex items-center gap-4 px-6 py-3">
          <Icon d={ICONS.bell} size={22} className="text-[#8696a0]" />
          <span className="text-[15px] text-[#e9edef] flex-1">Notification tone</span>
          <select
            value={tone}
            onChange={async (e) => { setTone(e.target.value); await v4call(() => backendV2.setChatTone(chat.id, e.target.value)); }}
            className="bg-[#1f2c34] rounded-lg px-2.5 py-1.5 text-[13px] outline-none text-[#e9edef] max-w-[130px]"
          >
            {['default', 'chime', 'ding', 'pop', 'silent'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="border-t border-[#222d34]" />

      {/* media preview */}
      {(media.length > 0 || docs.length > 0) && (
        <div>
          <button onClick={() => go('media')} className="w-full text-left">
            <SectionTitle>Media aur documents</SectionTitle>
            <div className="grid grid-cols-4 gap-1 px-6 pb-5">
              {media.slice(0, 4).map((m) => (
                <img key={m.id} src={m.mediaURL} alt="" className="w-full aspect-square object-cover rounded-lg" loading="lazy" />
              ))}
              {Array.from({ length: Math.max(0, 4 - media.slice(0, 4).length) }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-[#1f2c34] flex items-center justify-center">
                  <Icon d={ICONS.file} size={20} className="text-[#8696a0]" />
                </div>
              ))}
            </div>
          </button>
          <div className="border-t border-[#222d34]" />
        </div>
      )}

      {/* pinned */}
      {pinned.length > 0 && (
        <div>
          <SectionTitle>Pinned messages ({pinned.length})</SectionTitle>
          {pinned.slice(0, 3).map((m) => (
            <button
              key={m.id}
              onClick={() => onJumpTo(m.id)}
              className="w-full text-left px-6 py-2.5 hover:bg-[#1f2c34] transition flex items-center gap-3"
            >
              <Icon d={ICONS.pin} size={16} className="text-[#00a884] shrink-0" />
              <span className="min-w-0">
                <span className="block text-[12px] text-[#00a884] font-medium">{m.senderName}</span>
                <span className="block text-[13.5px] truncate text-[#e9edef]">{m.text || `[${m.type}]`}</span>
              </span>
              <Icon d={ICONS.chevRight} size={17} className="ml-auto text-[#8696a0] shrink-0" />
            </button>
          ))}
          <div className="border-t border-[#222d34] mt-2" />
        </div>
      )}

      {/* sections */}
      <div className="py-2">
        {isGroup && <RowBtn icon="groups" label="Members" sub={`${chat.participants.length} members`} onClick={() => go('members')} />}
        {polls.length > 0 && <RowBtn icon="poll" label="Polls" sub={`${polls.length} polls`} onClick={() => go('polls')} />}
        <RowBtn icon="calendar" label="Scheduled messages" sub="Is chat ke liye" onClick={() => go('scheduled')} />
        <RowBtn icon="chart" label="Chat analytics" sub="Stats dekhein" onClick={() => go('analytics')} />
        <RowBtn icon="timer" label="Disappearing messages" sub="Auto-delete timer" onClick={() => go('disappearing')} />
        {isGroup && isAdmin && <RowBtn icon="link" label="Invite link" sub="Create / copy / revoke" onClick={() => go('invite')} />}
        {isGroup && isAdmin && <RowBtn icon="userPlus" label="Join requests" sub="Approve ya reject karein" onClick={() => go('requests')} />}
        {isGroup && isAdmin && <RowBtn icon="clock" label="Slow mode" sub={chat.slowModeSec ? `${chat.slowModeSec}s` : 'Off'} onClick={() => go('slowmode')} />}
        {isGroup && isOwner && <RowBtn icon="crown" label="Ownership transfer" sub="Naya owner chunein" onClick={() => go('ownership')} />}
        {!isGroup && <BlockRow userId={chat.participants.find((p) => p !== me.id) || ''} name={chat.name} />}
      </div>
    </div>
  );
}

// ================= members =================

function MembersView({ chat, me, isAdmin }: { chat: Chat; me: UserProfile; isAdmin: boolean }) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const members = chat.participants.map((uid) => ({
    uid,
    prof: chat.participantProfiles[uid],
    admin: (chat.adminIds || []).includes(uid),
  }));

  return (
    <div className="animate-[v4fade_.18s_ease-out]">
      <SectionTitle>{members.length} members</SectionTitle>
      {isAdmin && (
        <RowBtn icon="userPlus" label="Member add karein" sub="Invite link se ya direct" onClick={() => setAddOpen(true)} />
      )}
      {members.map(({ uid, prof, admin }) => (
        <div key={uid} className="relative">
          <div className="flex items-center gap-3 px-6 py-2.5 hover:bg-[#1f2c34] transition">
            <Avatar name={prof?.displayName || 'User'} photoURL={prof?.photoURL} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] text-[#e9edef] truncate">
                {uid === me.id ? 'Aap' : prof?.displayName || 'User'}
              </p>
              <p className="text-[12.5px] text-[#8696a0] truncate">
                {admin ? 'Admin' : prof?.about || ''}
              </p>
            </div>
            {isAdmin && uid !== me.id && (
              <button onClick={() => setMenuFor(menuFor === uid ? null : uid)} className="p-2 text-[#8696a0] hover:text-[#e9edef] rounded-full">
                <Icon d={ICONS.dots} size={19} filled />
              </button>
            )}
          </div>
          {menuFor === uid && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setMenuFor(null)} />
              <div className="absolute right-4 top-12 z-[61] bg-[#111b21] border border-[#222d34] rounded-xl shadow-2xl py-1.5 min-w-[220px] animate-[v4pop_.15s_ease-out]">
                {!admin && (
                  <button onClick={() => { setMenuFor(null); backend.makeAdmin(chat.id, uid).catch(() => {}); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] hover:bg-[#1f2c34] text-left text-[#e9edef]">
                    <Icon d={ICONS.crown} size={18} className="text-[#8696a0]" /> Admin banayein
                  </button>
                )}
                <button onClick={() => { setMenuFor(null); setConfirmRemove(uid); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] hover:bg-[#ea0038]/10 text-left text-[#ea0038]">
                  <Icon d={ICONS.user} size={18} /> Remove karein
                </button>
              </div>
            </>
          )}
        </div>
      ))}
      {confirmRemove && (
        <Modal title="Member remove karein?" onClose={() => setConfirmRemove(null)}>
          <div className="p-5">
            <p className="text-[14px] text-[#8696a0] mb-4">
              Kya aap {chat.participantProfiles[confirmRemove]?.displayName || 'is member'} ko group se nikalna chahte hain?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmRemove(null)} className="flex-1 py-2.5 rounded-full bg-[#1f2c34] text-[14.5px]">Cancel</button>
              <button
                onClick={() => backend.removeMember(chat.id, confirmRemove).then(() => setConfirmRemove(null)).catch(() => setConfirmRemove(null))}
                className="flex-1 py-2.5 rounded-full bg-[#ea0038] text-white text-[14.5px] font-medium"
              >
                Remove
              </button>
            </div>
          </div>
        </Modal>
      )}
      {addOpen && <AddMemberModal chat={chat} meId={me.id} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddMemberModal({ chat, meId, onClose }: { chat: Chat; meId: string; onClose(): void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const search = async (v: string) => {
    setQ(v);
    if (v.trim().length < 2) { setResults([]); return; }
    try {
      const r = await backend.searchUsers(v.trim());
      setResults(r.filter((u) => u.id !== meId && !chat.participants.includes(u.id)).slice(0, 10));
    } catch { setResults([]); }
  };
  return (
    <Modal title="Member add karein" onClose={onClose}>
      <div className="p-5">
        <div className="flex items-center gap-3 bg-[#1f2c34] rounded-full px-4 py-2.5 mb-3">
          <Icon d={ICONS.search} size={17} className="text-[#8696a0]" />
          <input value={q} onChange={(e) => search(e.target.value)} placeholder="Naam se dhoondein…" className="bg-transparent outline-none text-[14px] w-full text-[#e9edef]" />
        </div>
        <div className="max-h-[280px] overflow-y-auto v4scroll">
          {results.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-2 py-2">
              <Avatar name={u.displayName} photoURL={u.photoURL} size={42} />
              <span className="flex-1 min-w-0">
                <span className="block text-[14.5px] text-[#e9edef] truncate">{u.displayName}</span>
                <span className="block text-[12.5px] text-[#8696a0] truncate">{u.email}</span>
              </span>
              <span className="text-[12px] text-[#8696a0]">Invite link use karein</span>
            </div>
          ))}
          {q.trim().length >= 2 && results.length === 0 && <p className="text-center text-[13px] text-[#8696a0] py-6">Koi user nahi mila.</p>}
        </div>
        <p className="text-[12.5px] text-[#8696a0] mt-3 leading-relaxed">Naye members invite link se jud sakte hain (Invite link section se link banayein).</p>
      </div>
    </Modal>
  );
}

// ================= media =================

function MediaView({ media, docs }: { media: ChatMessage[]; docs: ChatMessage[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="animate-[v4fade_.18s_ease-out]">
      <SectionTitle>Photos ({media.length})</SectionTitle>
      {media.length === 0 && <p className="px-6 pb-4 text-[13px] text-[#8696a0]">Koi photo nahi.</p>}
      <div className="grid grid-cols-3 gap-1 px-6 pb-4">
        {media.map((m) => (
          <button key={m.id} onClick={() => setOpen(m.mediaURL || null)} className="aspect-square overflow-hidden rounded-lg hover:opacity-90 transition">
            <img src={m.mediaURL} alt="" className="w-full h-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
      <SectionTitle>Documents ({docs.length})</SectionTitle>
      {docs.length === 0 && <p className="px-6 pb-6 text-[13px] text-[#8696a0]">Koi document nahi.</p>}
      {docs.map((m) => (
        <a key={m.id} href={m.mediaURL} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-6 py-2.5 hover:bg-[#1f2c34] transition">
          <span className="w-10 h-10 rounded-full bg-[#1f2c34] flex items-center justify-center shrink-0">
            <Icon d={ICONS.file} size={19} className="text-[#8696a0]" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13.5px] text-[#e9edef] truncate">{m.fileName || 'Document'}</span>
            <span className="block text-[11.5px] text-[#8696a0]">{fmtTime(m.createdAt)}</span>
          </span>
        </a>
      ))}
      {open && <PhotoViewer src={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ================= polls =================

function PollsView({ polls }: { polls: ChatMessage[] }) {
  const [analytics, setAnalytics] = useState<PollAnalytics | null>(null);
  const [q, setQ] = useState('');
  const load = async (m: ChatMessage) => {
    setQ(m.poll?.question || '');
    const a = await v4call(() => backendV2.getPollAnalytics(m.id));
    if (a) setAnalytics(a);
  };
  return (
    <div className="animate-[v4fade_.18s_ease-out]">
      <SectionTitle>{polls.length} polls</SectionTitle>
      {polls.length === 0 && <p className="px-6 text-[13px] text-[#8696a0]">Koi poll nahi.</p>}
      {polls.map((m) => (
        <button key={m.id} onClick={() => load(m)} className="w-full text-left px-6 py-3 hover:bg-[#1f2c34] transition border-b border-[#222d34]">
          <p className="text-[14px] text-[#e9edef] font-medium truncate">{m.poll?.question}</p>
          <p className="text-[12.5px] text-[#8696a0] mt-0.5">{m.poll?.options.length} options · {m.senderName}</p>
        </button>
      ))}
      {analytics && (
        <Modal title={q} onClose={() => setAnalytics(null)}>
          <div className="p-5">
            <p className="text-[13px] text-[#8696a0] mb-2">Total votes: {analytics.totalVotes}</p>
            {analytics.perOption.map((o, i) => (
              <div key={i} className="py-2.5 border-b border-[#222d34] last:border-0">
                <div className="flex justify-between text-[13.5px] mb-1">
                  <span className="text-[#e9edef] truncate">{o.option}</span>
                  <span className="text-[#8696a0] shrink-0 ml-2">{o.votes}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#1f2c34] overflow-hidden">
                  <div className="h-full bg-[#00a884] rounded-full" style={{ width: `${analytics.totalVotes ? (o.votes / analytics.totalVotes) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ================= invite =================

function InviteView({ chatId }: { chatId: string }) {
  const [link, setLink] = useState<InviteLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const create = async () => {
    setBusy(true);
    const l = await v4call(() => backendV2.createInviteLink(chatId));
    if (l) setLink(l);
    setBusy(false);
  };
  const revoke = async () => {
    if (!link) return;
    const ok = await v4call(() => backendV2.revokeInviteLink(link.code));
    if (ok !== null) setLink(null);
  };
  const url = link ? `${window.location.origin}/join/${link.code}` : '';
  return (
    <div className="animate-[v4fade_.18s_ease-out] p-6">
      <div className="flex justify-center mb-4 text-[#00a884]"><Icon d={ICONS.link} size={44} /></div>
      <p className="text-center text-[13.5px] text-[#8696a0] leading-relaxed mb-5">
        Link se koi bhi is group me jud sakta hai. Link share karte waqt ehtiyat karein.
      </p>
      {link ? (
        <div className="bg-[#1f2c34] rounded-xl p-4 mb-3">
          <p className="text-[13px] text-[#00a884] break-all mb-3">{url}</p>
          <div className="flex gap-2">
            <button
              onClick={() => { navigator.clipboard?.writeText(url).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="flex-1 py-2 rounded-full bg-[#00a884] text-white text-[13.5px] font-medium"
            >
              {copied ? 'Copy ho gaya!' : 'Copy karein'}
            </button>
            <button onClick={revoke} className="flex-1 py-2 rounded-full bg-[#ea0038]/10 text-[#ea0038] text-[13.5px] font-medium">
              Revoke
            </button>
          </div>
        </div>
      ) : (
        <button onClick={create} disabled={busy} className="w-full py-2.5 rounded-full bg-[#00a884] text-white text-[15px] font-medium hover:brightness-110 transition disabled:opacity-50">
          {busy ? 'Ban raha hai…' : 'Invite link banayein'}
        </button>
      )}
    </div>
  );
}

// ================= join requests =================

function RequestsView({ chatId }: { chatId: string }) {
  const [reqs, setReqs] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => {
    v4call(() => backendV2.getJoinRequests(chatId)).then((r) => {
      setReqs(r ? r.filter((x) => x.status === 'pending') : []);
      setLoading(false);
    });
  };
  useEffect(load, [chatId]);
  const decide = async (id: string, approve: boolean) => {
    const ok = await v4call(() => (approve ? backendV2.approveJoinRequest(id) : backendV2.rejectJoinRequest(id)));
    if (ok !== null) setReqs((r) => r.filter((x) => x.id !== id));
  };
  return (
    <div className="animate-[v4fade_.18s_ease-out]">
      <SectionTitle>Pending requests</SectionTitle>
      {loading && <p className="px-6 text-[13px] text-[#8696a0]">Load ho raha hai…</p>}
      {!loading && reqs.length === 0 && <p className="px-6 text-[13px] text-[#8696a0]">Koi pending request nahi.</p>}
      {reqs.map((r) => (
        <div key={r.id} className="flex items-center gap-3 px-6 py-3 border-b border-[#222d34]">
          <Avatar name={r.userId} size={42} />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] text-[#e9edef] truncate">{r.userId}</p>
            <p className="text-[12px] text-[#8696a0]">{fmtTime(r.createdAt)}</p>
          </div>
          <button onClick={() => decide(r.id, true)} className="px-3.5 py-1.5 rounded-full bg-[#00a884] text-white text-[13px] font-medium">Approve</button>
          <button onClick={() => decide(r.id, false)} className="px-3.5 py-1.5 rounded-full bg-[#1f2c34] text-[#8696a0] text-[13px]">Reject</button>
        </div>
      ))}
    </div>
  );
}

// ================= ownership =================

function OwnershipView({ chat, me }: { chat: Chat; me: UserProfile }) {
  const [done, setDone] = useState(false);
  const candidates = chat.participants.filter((u) => u !== me.id);
  const transfer = async (uid: string) => {
    const ok = await v4call(() => backendV2.transferOwnership(chat.id, uid));
    if (ok !== null) setDone(true);
  };
  return (
    <div className="animate-[v4fade_.18s_ease-out]">
      <SectionTitle>Group ka naya owner chunein</SectionTitle>
      {done && <p className="px-6 text-[13.5px] text-[#00a884] pb-2">Ownership transfer ho gayi.</p>}
      {candidates.map((uid) => (
        <button key={uid} onClick={() => transfer(uid)} className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-[#1f2c34] transition text-left">
          <Avatar name={chat.participantProfiles[uid]?.displayName || 'User'} photoURL={chat.participantProfiles[uid]?.photoURL} size={42} />
          <span className="text-[14.5px] text-[#e9edef] truncate flex-1">{chat.participantProfiles[uid]?.displayName || uid}</span>
          <Icon d={ICONS.crown} size={17} className="text-[#ffd279]" />
        </button>
      ))}
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
  const save = async (s: number) => {
    setVal(s);
    try { await backend.setDisappearingAfter(s); } catch { setVal(me.disappearingAfter ?? 0); }
  };
  return (
    <div className="animate-[v4fade_.18s_ease-out]">
      <SectionTitle>Default timer</SectionTitle>
      <p className="px-6 pb-3 text-[13px] text-[#8696a0] leading-relaxed">
        Naye messages is muddat ke baad khud mit jayenge. Yeh setting sirf aapke liye hai.
      </p>
      {DM_OPTIONS.map((o) => (
        <button key={o.sec} onClick={() => save(o.sec)} className="w-full flex items-center gap-3 px-6 py-3 hover:bg-[#1f2c34] transition text-left">
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${val === o.sec ? 'border-[#00a884]' : 'border-[#8696a0]'}`}>
            {val === o.sec && <span className="w-2.5 h-2.5 rounded-full bg-[#00a884]" />}
          </span>
          <span className="text-[14.5px] text-[#e9edef]">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ================= slow mode =================

const SM_OPTIONS = [0, 10, 30, 60, 300];

function SlowModeView({ chatId, current }: { chatId: string; current: number }) {
  const [val, setVal] = useState(current);
  const save = async (s: number) => {
    setVal(s);
    try { await backend.setSlowMode(chatId, s); } catch { setVal(current); }
  };
  return (
    <div className="animate-[v4fade_.18s_ease-out]">
      <SectionTitle>Slow mode</SectionTitle>
      <p className="px-6 pb-3 text-[13px] text-[#8696a0] leading-relaxed">
        Members har message ke darmiyan itna waqfa rakhenge.
      </p>
      {SM_OPTIONS.map((s) => (
        <button key={s} onClick={() => save(s)} className="w-full flex items-center gap-3 px-6 py-3 hover:bg-[#1f2c34] transition text-left">
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${val === s ? 'border-[#00a884]' : 'border-[#8696a0]'}`}>
            {val === s && <span className="w-2.5 h-2.5 rounded-full bg-[#00a884]" />}
          </span>
          <span className="text-[14.5px] text-[#e9edef]">{s === 0 ? 'Band' : `${s} second`}</span>
        </button>
      ))}
    </div>
  );
}

// ================= analytics (v3) =================

function AnalyticsView({ chatId }: { chatId: string }) {
  const [data, setData] = useState<ChatAnalytics | null>(null);
  useEffect(() => {
    v4call(() => backendV3.getChatAnalytics(chatId)).then((a) => { if (a) setData(a); });
  }, [chatId]);
  if (!data) return <p className="px-6 pt-6 text-[13px] text-[#8696a0]">Load ho raha hai…</p>;
  const max = Math.max(1, ...data.perUser.map((u) => u.count));
  return (
    <div className="animate-[v4fade_.18s_ease-out]">
      <SectionTitle>Overview</SectionTitle>
      <div className="grid grid-cols-2 gap-2 px-6 pb-2">
        <StatCard label="Total messages" value={String(data.totalMessages)} />
        <StatCard label="Sab se active hour" value={data.mostActiveHour >= 0 ? `${data.mostActiveHour}:00` : '—'} />
      </div>
      <SectionTitle>Top members</SectionTitle>
      {data.perUser.slice(0, 8).map((u) => (
        <div key={u.userId} className="px-6 py-2.5">
          <div className="flex justify-between text-[13.5px] mb-1">
            <span className="text-[#e9edef] truncate">{u.displayName}</span>
            <span className="text-[#8696a0] shrink-0 ml-2">{u.count}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#1f2c34] overflow-hidden">
            <div className="h-full bg-[#00a884] rounded-full" style={{ width: `${(u.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#1f2c34] rounded-xl p-4">
      <p className="text-[22px] font-medium text-[#00a884]">{value}</p>
      <p className="text-[12px] text-[#8696a0] mt-1">{label}</p>
    </div>
  );
}

// ================= scheduled =================

function ScheduledView({ chatId }: { chatId: string }) {
  const [items, setItems] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => {
    backend.getScheduledMessages().then((all) => {
      setItems(all.filter((s) => s.chatId === chatId));
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(load, [chatId]);
  const cancel = async (id: string) => {
    await backend.cancelScheduledMessage(id).catch(() => {});
    setItems((x) => x.filter((s) => s.id !== id));
  };
  return (
    <div className="animate-[v4fade_.18s_ease-out]">
      <SectionTitle>Scheduled ({items.length})</SectionTitle>
      {loading && <p className="px-6 text-[13px] text-[#8696a0]">Load ho raha hai…</p>}
      {!loading && items.length === 0 && <p className="px-6 text-[13px] text-[#8696a0]">Koi scheduled message nahi. Input bar ke + menu se schedule karein.</p>}
      {items.map((s) => (
        <div key={s.id} className="flex items-center gap-3 px-6 py-3 border-b border-[#222d34]">
          <Icon d={ICONS.calendar} size={19} className="text-[#00a884] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] text-[#e9edef] truncate">{s.input.text || `[${s.input.type}]`}</p>
            <p className="text-[12px] text-[#8696a0]">{fmtTime(s.sendAt)} · {new Date(s.sendAt).toLocaleDateString()}</p>
          </div>
          <button onClick={() => cancel(s.id)} className="text-[12.5px] text-[#ea0038] hover:underline shrink-0">Cancel</button>
        </div>
      ))}
    </div>
  );
}

// ================= block =================

function BlockRow({ userId, name }: { userId: string; name: string }) {
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!userId) return;
    v4call(() => backendV2.getBlockedUsers()).then((list) => {
      if (list) setBlocked(list.some((b) => b.userId === userId));
    });
  }, [userId]);
  const toggle = async () => {
    if (!userId || busy) return;
    setBusy(true);
    const ok = await v4call(() => (blocked ? backendV2.unblockUser(userId) : backendV2.blockUser(userId)));
    if (ok !== null) setBlocked(!blocked);
    setBusy(false);
  };
  if (!userId) return null;
  return (
    <div className="border-t border-[#222d34]">
      <RowBtn
        icon="eyeOff"
        label={blocked ? `${name} ko unblock karein` : `${name} ko block karein`}
        sub={blocked ? 'Block hata diya jayega' : 'Messages band'}
        danger={!blocked}
        onClick={toggle}
      />
    </div>
  );
}
