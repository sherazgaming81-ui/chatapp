'use client';

/**
 * InfoPanel — right panel (toggleable).
 * Group/user info · media/docs summary · pinned (jump-to) · poll analytics
 * · invite link management · join requests · ownership transfer
 * · disappearing messages · slow mode · member admin actions.
 */

import { useEffect, useMemo, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat, ChatMessage, UserProfile } from '@/lib/backend/types';
import type { InviteLink, JoinRequest, PollAnalytics } from '@/lib/v2/types';
import Avatar from '@/components/Avatar';
import { fmtTime } from '@/lib/format';
import { Icon, ICONS, RowBtn, SectionTitle, backendV2, v2call } from './common';

interface Props {
  chat: Chat;
  me: UserProfile;
  onClose(): void;
  onJumpTo(messageId: string): void;
}

export default function InfoPanel({ chat, me, onClose, onJumpTo }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinned, setPinned] = useState<ChatMessage[]>([]);
  const [section, setSection] = useState<'main' | 'media' | 'polls' | 'invite' | 'requests' | 'ownership' | 'disappearing' | 'slowmode' | 'members'>('main');

  useEffect(() => backend.onMessages(chat.id, setMessages), [chat.id]);
  useEffect(() => {
    backend.getPinnedMessages(chat.id).then(setPinned).catch(() => setPinned([]));
  }, [chat.id]);

  const isGroup = chat.type === 'group';
  const isAdmin = (chat.adminIds || []).includes(me.id);
  const isOwner = isGroup && (chat.adminIds || [])[0] === me.id;

  const media = useMemo(() => messages.filter((m) => m.type === 'image' && m.mediaURL).slice(-24).reverse(), [messages]);
  const docs = useMemo(() => messages.filter((m) => m.type === 'file' && m.mediaURL).slice(-12).reverse(), [messages]);
  const polls = useMemo(() => messages.filter((m) => m.type === 'poll' && m.poll).slice(-8).reverse(), [messages]);

  const otherId = !isGroup ? chat.participants.find((p) => p !== me.id) : undefined;
  const otherProf = otherId ? chat.participantProfiles[otherId] : undefined;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--v2-border)] shrink-0">
        <button onClick={onClose} className="p-1.5 -ml-1 rounded-full text-[var(--v2-muted)] hover:bg-[var(--v2-hover)] transition">
          <Icon d={ICONS.x} size={20} />
        </button>
        <h2 className="text-[15.5px] font-medium truncate">
          {section === 'main' ? (isGroup ? 'Group info' : 'Contact info') : sectionTitle(section)}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto v2scroll min-h-0">
        {section === 'main' && (
          <MainSection
            chat={chat} me={me} isGroup={isGroup} isAdmin={isAdmin} isOwner={isOwner}
            otherProf={otherProf} media={media} docs={docs} polls={polls} pinned={pinned}
            onJumpTo={onJumpTo} go={setSection}
          />
        )}
        {section === 'media' && <MediaGrid media={media} docs={docs} />}
        {section === 'polls' && <PollsSection polls={polls} />}
        {section === 'invite' && isGroup && <InviteSection chatId={chat.id} isAdmin={isAdmin} />}
        {section === 'requests' && isGroup && <JoinRequestsSection chatId={chat.id} chat={chat} me={me} isAdmin={isAdmin} />}
        {section === 'ownership' && isGroup && <OwnershipSection chat={chat} me={me} isOwner={isOwner} />}
        {section === 'disappearing' && <DisappearingSection me={me} />}
        {section === 'slowmode' && isGroup && <SlowModeSection chatId={chat.id} current={chat.slowModeSec ?? 0} isAdmin={isAdmin} />}
        {section === 'members' && isGroup && <MembersSection chat={chat} me={me} isAdmin={isAdmin} />}
      </div>

      {section !== 'main' && (
        <button
          onClick={() => setSection('main')}
          className="shrink-0 m-3 py-2.5 rounded-full bg-[var(--v2-input)] text-[var(--v2-text)] text-[14px] font-medium hover:bg-[var(--v2-active)] transition"
        >
          Wapas
        </button>
      )}
    </div>
  );
}

function sectionTitle(s: string) {
  return { media: 'Media & docs', polls: 'Polls', invite: 'Invite link', requests: 'Join requests', ownership: 'Ownership', disappearing: 'Disappearing messages', slowmode: 'Slow mode', members: 'Members' }[s] ?? s;
}

// ================= main =================

function MainSection(props: {
  chat: Chat; me: UserProfile; isGroup: boolean; isAdmin: boolean; isOwner: boolean;
  otherProf?: { displayName: string; photoURL: string; online?: boolean; lastSeen?: number };
  media: ChatMessage[]; docs: ChatMessage[]; polls: ChatMessage[]; pinned: ChatMessage[];
  onJumpTo(id: string): void; go(s: 'media' | 'polls' | 'invite' | 'requests' | 'ownership' | 'disappearing' | 'slowmode' | 'members'): void;
}) {
  const { chat, me, isGroup, isAdmin, isOwner, otherProf, media, docs, polls, pinned, onJumpTo, go } = props;
  const [muted, setMuted] = useState(false);
  const [tone, setTone] = useState('default');
  const [descEdit, setDescEdit] = useState(false);
  const [desc, setDesc] = useState(chat.description || '');

  useEffect(() => {
    backend.getChatNotificationSettings(chat.id).then((s) => setMuted(s.muted)).catch(() => {});
    v2call(() => backendV2.getChatTone(chat.id)).then((t) => { if (t) setTone(t); });
  }, [chat.id]);

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    try { await backend.setChatMuted(chat.id, next); } catch { setMuted(!next); }
  };

  return (
    <div className="animate-[v2fade_.18s_ease-out]">
      {/* profile hero */}
      <div className="flex flex-col items-center px-6 pt-6 pb-5 border-b border-[var(--v2-border)]">
        <Avatar name={chat.name} photoURL={chat.photoURL} size={120} />
        <h3 className="text-[19px] font-medium mt-3 text-center break-words">{chat.name}</h3>
        {isGroup ? (
          <p className="text-[13px] text-[var(--v2-muted)] mt-1">{chat.participants.length} members</p>
        ) : (
          <p className="text-[13px] text-[var(--v2-muted)] mt-1 break-all">{otherProf ? 'Online status privacy ke mutabiq' : ''}</p>
        )}
        {isGroup && (
          <div className="w-full mt-3">
            {descEdit ? (
              <div className="flex gap-2">
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Group description…"
                  className="flex-1 bg-[var(--v2-input)] rounded-lg px-3 py-2 text-[13.5px] outline-none"
                />
                <button
                  onClick={() => {
                    backend.setGroupDescription(chat.id, desc).then(() => setDescEdit(false)).catch(() => {});
                  }}
                  className="px-3 rounded-lg bg-[var(--v2-accent)] text-white text-[13px] font-medium"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => isAdmin && setDescEdit(true)}
                className="w-full text-left text-[13.5px] text-[var(--v2-muted)] leading-relaxed"
              >
                {chat.description || (isAdmin ? 'Description add karein…' : 'Koi description nahi.')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* quick toggles */}
      <div className="px-2 py-2 border-b border-[var(--v2-border)]">
        <ToggleRow icon={ICONS.mute} label="Mute notifications" value={muted} onToggle={toggleMute} />
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Icon d={ICONS.bell} size={20} className="text-[var(--v2-muted)]" />
          <span className="text-[14px] flex-1">Notification tone</span>
          <select
            value={tone}
            onChange={async (e) => {
              setTone(e.target.value);
              await v2call(() => backendV2.setChatTone(chat.id, e.target.value));
            }}
            className="bg-[var(--v2-input)] rounded-lg px-2 py-1.5 text-[13px] outline-none max-w-[130px]"
          >
            {['default', 'chime', 'ding', 'pop', 'silent'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* pinned */}
      {pinned.length > 0 && (
        <div className="border-b border-[var(--v2-border)]">
          <SectionTitle>Pinned messages ({pinned.length})</SectionTitle>
          {pinned.slice(0, 3).map((m) => (
            <button
              key={m.id}
              onClick={() => onJumpTo(m.id)}
              className="w-full text-left px-5 py-2 hover:bg-[var(--v2-hover)] transition flex items-center gap-2.5"
            >
              <Icon d={ICONS.pin} size={15} className="text-[var(--v2-accent)] shrink-0" />
              <span className="min-w-0">
                <span className="block text-[12px] text-[var(--v2-accent)] font-medium">{m.senderName}</span>
                <span className="block text-[13.5px] truncate text-[var(--v2-text)]">{m.text || `[${m.type}]`}</span>
              </span>
              <Icon d={ICONS.chevRight} size={16} className="ml-auto text-[var(--v2-muted)] shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* media preview */}
      {(media.length > 0 || docs.length > 0) && (
        <div className="border-b border-[var(--v2-border)]">
          <button onClick={() => go('media')} className="w-full">
            <SectionTitle>Media & docs</SectionTitle>
            <div className="grid grid-cols-4 gap-1 px-5 pb-4">
              {media.slice(0, 4).map((m) => (
                <img key={m.id} src={m.mediaURL} alt="" className="w-full aspect-square object-cover rounded-md" loading="lazy" />
              ))}
              {Array.from({ length: Math.max(0, 4 - media.slice(0, 4).length) }).map((_, i) => (
                <div key={i} className="aspect-square rounded-md bg-[var(--v2-panel2)] flex items-center justify-center">
                  <Icon d={ICONS.file} size={20} className="text-[var(--v2-muted)]" />
                </div>
              ))}
            </div>
          </button>
        </div>
      )}

      {/* sections */}
      <div className="py-1">
        {isGroup && <RowBtn icon="users" label="Members" sub={`${chat.participants.length} members`} onClick={() => go('members')} />}
        {polls.length > 0 && <RowBtn icon="poll" label="Polls" sub={`${polls.length} polls · analytics dekhein`} onClick={() => go('polls')} />}
        <RowBtn icon="timer" label="Disappearing messages" sub="Auto-delete timer" onClick={() => go('disappearing')} />
        {isGroup && isAdmin && <RowBtn icon="link" label="Invite link" sub="Create / copy / revoke" onClick={() => go('invite')} />}
        {isGroup && isAdmin && <RowBtn icon="userPlus" label="Join requests" sub="Approve ya reject karein" onClick={() => go('requests')} />}
        {isGroup && isAdmin && <RowBtn icon="clock" label="Slow mode" sub={chat.slowModeSec ? `${chat.slowModeSec}s` : 'Off'} onClick={() => go('slowmode')} />}
        {isGroup && isOwner && <RowBtn icon="crown" label="Ownership transfer" sub="Naya owner chunein" onClick={() => go('ownership')} />}
        {!isGroup && (
          <BlockRow userId={chat.participants.find((p) => p !== me.id) || ''} name={chat.name} />
        )}
      </div>
    </div>
  );
}

function ToggleRow({ icon, label, value, onToggle }: { icon: string; label: string; value: boolean; onToggle(): void }) {
  return (
    <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--v2-hover)] transition text-left">
      <Icon d={ICONS[icon as keyof typeof ICONS]} size={20} className="text-[var(--v2-muted)]" />
      <span className="text-[14px] flex-1">{label}</span>
      <span className={`w-10 h-[22px] rounded-full relative transition ${value ? 'bg-[var(--v2-accent)]' : 'bg-[var(--v2-panel3)]'}`}>
        <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white transition-all ${value ? 'left-[22px]' : 'left-[3px]'}`} />
      </span>
    </button>
  );
}

function BlockRow({ userId, name }: { userId: string; name: string }) {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    v2call(() => backendV2.getBlockedUsers()).then((list) => {
      if (list) setBlocked(list.some((b) => b.userId === userId));
    });
  }, [userId]);

  const toggle = async () => {
    if (blocked) {
      const ok = await v2call(() => backendV2.unblockUser(userId));
      if (ok !== null) setBlocked(false);
    } else {
      const ok = await v2call(() => backendV2.blockUser(userId));
      if (ok !== null) setBlocked(true);
    }
  };

  return (
    <button onClick={toggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--v2-hover)] transition">
      <Icon d={ICONS.shield} size={20} className={blocked ? 'text-[var(--v2-accent)]' : 'text-[var(--v2-muted)]'} />
      <span className="min-w-0">
        <span className="block text-[14px]">{blocked ? 'Unblock karein' : 'Block karein'}</span>
        <span className="block text-[12px] text-[var(--v2-muted)] truncate">{name} {blocked ? 'blocked hai' : 'ko block karein'}</span>
      </span>
    </button>
  );
}

// ================= media =================

function MediaGrid({ media, docs }: { media: ChatMessage[]; docs: ChatMessage[] }) {
  const [tab, setTab] = useState<'media' | 'docs'>('media');
  return (
    <div className="animate-[v2fade_.18s_ease-out]">
      <div className="flex gap-2 px-5 pt-4">
        {(['media', 'docs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition ${tab === t ? 'bg-[var(--v2-accent-soft)] text-[var(--v2-accent)]' : 'bg-[var(--v2-input)] text-[var(--v2-muted)]'}`}
          >
            {t === 'media' ? `Media (${media.length})` : `Docs (${docs.length})`}
          </button>
        ))}
      </div>
      {tab === 'media' ? (
        <div className="grid grid-cols-3 gap-1.5 p-5">
          {media.map((m) => (
            <a key={m.id} href={m.mediaURL} target="_blank" rel="noreferrer">
              <img src={m.mediaURL} alt="" className="w-full aspect-square object-cover rounded-lg hover:opacity-85 transition" loading="lazy" />
            </a>
          ))}
          {media.length === 0 && <EmptyNote text="Koi media nahi." />}
        </div>
      ) : (
        <div className="p-3">
          {docs.map((m) => (
            <a key={m.id} href={m.mediaURL} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--v2-hover)] transition">
              <span className="w-10 h-10 rounded-full bg-[var(--v2-panel2)] flex items-center justify-center shrink-0">
                <Icon d={ICONS.file} size={19} className="text-[var(--v2-muted)]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] truncate">{m.fileName || 'Document'}</span>
                <span className="block text-[12px] text-[var(--v2-muted)]">{m.senderName} · {fmtTime(m.createdAt)}</span>
              </span>
              <Icon d={ICONS.download} size={17} className="text-[var(--v2-muted)] shrink-0" />
            </a>
          ))}
          {docs.length === 0 && <EmptyNote text="Koi document nahi." />}
        </div>
      )}
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="col-span-3 text-center text-[13px] text-[var(--v2-muted)] py-8">{text}</p>;
}

// ================= polls + analytics =================

function PollsSection({ polls }: { polls: ChatMessage[] }) {
  const [analytics, setAnalytics] = useState<Record<string, PollAnalytics>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async (m: ChatMessage) => {
    if (openId === m.id) { setOpenId(null); return; }
    setOpenId(m.id);
    if (!analytics[m.id]) {
      const a = await v2call(() => backendV2.getPollAnalytics(m.id));
      if (a) setAnalytics((p) => ({ ...p, [m.id]: a }));
    }
  };

  return (
    <div className="p-3 animate-[v2fade_.18s_ease-out]">
      {polls.length === 0 && <EmptyNote text="Koi poll nahi." />}
      {polls.map((m) => {
        const a = analytics[m.id];
        const opened = openId === m.id;
        return (
          <div key={m.id} className="bg-[var(--v2-panel2)] rounded-xl p-3.5 mb-2.5">
            <button onClick={() => load(m)} className="w-full text-left">
              <p className="text-[14px] font-semibold mb-1">{m.poll!.question}</p>
              <p className="text-[12px] text-[var(--v2-muted)]">
                {m.poll!.options.length} options · {opened ? 'chhupayein' : 'analytics dekhein'}
              </p>
            </button>
            {opened && (
              <div className="mt-2.5 pt-2.5 border-t border-[var(--v2-border)]">
                {!a && <p className="text-[12.5px] text-[var(--v2-muted)]">Load ho raha hai…</p>}
                {a && a.perOption.map((o, i) => (
                  <div key={i} className="mb-2">
                    <div className="flex justify-between text-[12.5px] mb-1">
                      <span className="truncate">{o.option}</span>
                      <span className="text-[var(--v2-muted)] shrink-0 ml-2">{o.votes} ({a.totalVotes ? Math.round((o.votes / a.totalVotes) * 100) : 0}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--v2-panel3)] overflow-hidden">
                      <div className="h-full bg-[var(--v2-accent)] rounded-full transition-all" style={{ width: `${a.totalVotes ? (o.votes / a.totalVotes) * 100 : 0}%` }} />
                    </div>
                    {o.voterIds.length > 0 && (
                      <p className="text-[11px] text-[var(--v2-muted)] mt-0.5 truncate">{o.voterIds.length} voters</p>
                    )}
                  </div>
                ))}
                {a && <p className="text-[12px] text-[var(--v2-muted)] mt-1">Total: {a.totalVotes} votes</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ================= invite links =================

function InviteSection({ chatId, isAdmin }: { chatId: string; isAdmin: boolean }) {
  const [link, setLink] = useState<InviteLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    const l = await v2call(() => backendV2.createInviteLink(chatId));
    if (l) setLink(l);
    setBusy(false);
  };
  const revoke = async () => {
    if (!link) return;
    const ok = await v2call(() => backendV2.revokeInviteLink(link.code));
    if (ok !== null) setLink(null);
  };
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${link.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="p-5 animate-[v2fade_.18s_ease-out]">
      <p className="text-[13px] text-[var(--v2-muted)] leading-relaxed mb-4">
        Link jiske paas hoga, woh group join kar sakega. Revoke karne par purana link kaam nahi karega.
      </p>
      {!link ? (
        <button
          onClick={create}
          disabled={busy || !isAdmin}
          className="w-full py-2.5 rounded-full bg-[var(--v2-accent)] text-white text-[14px] font-medium hover:brightness-110 transition disabled:opacity-50"
        >
          {busy ? 'Ban raha hai…' : 'Invite link banayein'}
        </button>
      ) : (
        <div className="bg-[var(--v2-panel2)] rounded-xl p-4">
          <p className="text-[12px] text-[var(--v2-muted)] mb-1">Invite code</p>
          <p className="text-[17px] font-mono font-semibold tracking-wide mb-3">{link.code}</p>
          <p className="text-[12px] text-[var(--v2-muted)] mb-3">{link.uses} dafa use hua</p>
          <div className="flex gap-2">
            <button onClick={copy} className="flex-1 py-2 rounded-full bg-[var(--v2-accent)] text-white text-[13.5px] font-medium hover:brightness-110 transition">
              {copied ? 'Copy ho gaya!' : 'Copy karein'}
            </button>
            <button onClick={revoke} className="flex-1 py-2 rounded-full bg-[#ea0038]/10 text-[#ea0038] text-[13.5px] font-medium hover:bg-[#ea0038]/20 transition">
              Revoke
            </button>
          </div>
          <button onClick={create} className="w-full mt-2 py-2 text-[13px] text-[var(--v2-accent)] font-medium hover:underline">
            Naya link banayein
          </button>
        </div>
      )}
      {!isAdmin && <p className="text-[12.5px] text-[var(--v2-muted)] mt-3">Sirf admins link bana sakte hain.</p>}
    </div>
  );
}

// ================= join requests =================

function JoinRequestsSection({ chatId, chat, me, isAdmin }: { chatId: string; chat: Chat; me: UserProfile; isAdmin: boolean }) {
  const [reqs, setReqs] = useState<JoinRequest[]>([]);

  const reload = () => {
    v2call(() => backendV2.getJoinRequests(chatId)).then((r) => { if (r) setReqs(r.filter((x) => x.status === 'pending')); });
  };
  useEffect(reload, [chatId]);

  const decide = async (id: string, approve: boolean) => {
    const ok = await v2call(() => approve ? backendV2.approveJoinRequest(id) : backendV2.rejectJoinRequest(id));
    if (ok !== null) reload();
  };

  return (
    <div className="p-3 animate-[v2fade_.18s_ease-out]">
      {reqs.length === 0 && <EmptyNote text="Koi pending request nahi." />}
      {reqs.map((r) => {
        const prof = chat.participantProfiles[r.userId];
        return (
          <div key={r.id} className="flex items-center gap-3 px-2 py-2.5 border-b border-[var(--v2-border)] last:border-0">
            <Avatar name={prof?.displayName || 'User'} photoURL={prof?.photoURL} size={42} />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] truncate">{prof?.displayName || r.userId.slice(0, 8)}</p>
              <p className="text-[12px] text-[var(--v2-muted)]">Join karna chahta hai</p>
            </div>
            {isAdmin && (
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => decide(r.id, true)} className="px-3 py-1.5 rounded-full bg-[var(--v2-accent)] text-white text-[12.5px] font-medium hover:brightness-110 transition">
                  Approve
                </button>
                <button onClick={() => decide(r.id, false)} className="px-3 py-1.5 rounded-full bg-[var(--v2-input)] text-[12.5px] font-medium hover:bg-[var(--v2-active)] transition">
                  Reject
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ================= ownership =================

function OwnershipSection({ chat, me, isOwner }: { chat: Chat; me: UserProfile; isOwner: boolean }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const members = chat.participants.filter((p) => p !== me.id);

  const transfer = async (uid: string) => {
    const ok = await v2call(() => backendV2.transferOwnership(chat.id, uid));
    if (ok !== null) {
      setDone(true);
      setConfirm(null);
    }
  };

  if (!isOwner) return <EmptyNote text="Sirf group owner ownership transfer kar sakta hai." />;

  return (
    <div className="p-4 animate-[v2fade_.18s_ease-out]">
      <p className="text-[13px] text-[var(--v2-muted)] leading-relaxed mb-4">
        Naya owner chunein. Aap admin rahenge, lekin ownership naye member ko mil jayegi.
      </p>
      {done && <p className="text-[13.5px] text-[var(--v2-accent)] font-medium mb-3">Ownership transfer ho gayi.</p>}
      {members.map((uid) => {
        const prof = chat.participantProfiles[uid];
        const name = prof?.displayName || uid.slice(0, 8);
        return (
          <div key={uid}>
            <button
              onClick={() => setConfirm(uid)}
              className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-[var(--v2-hover)] transition text-left"
            >
              <Avatar name={name} photoURL={prof?.photoURL} size={42} />
              <span className="text-[14px] truncate flex-1">{name}</span>
              {(chat.adminIds || []).includes(uid) && (
                <span className="flex items-center gap-1 text-[11.5px] text-[var(--v2-accent)] font-medium">
                  <Icon d={ICONS.crown} size={13} /> Admin
                </span>
              )}
            </button>
            {confirm === uid && (
              <div className="bg-[var(--v2-panel2)] rounded-xl p-3.5 mb-2 ml-2">
                <p className="text-[13.5px] mb-3">Kya <b>{name}</b> ko owner banana hai?</p>
                <div className="flex gap-2">
                  <button onClick={() => transfer(uid)} className="flex-1 py-2 rounded-full bg-[var(--v2-accent)] text-white text-[13px] font-medium">
                    Haan, transfer karein
                  </button>
                  <button onClick={() => setConfirm(null)} className="flex-1 py-2 rounded-full bg-[var(--v2-input)] text-[13px] font-medium">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ================= disappearing =================

const DISAPPEAR_OPTS = [
  { s: 0, label: 'Off' },
  { s: 86400, label: '24 ghante' },
  { s: 604800, label: '7 din' },
  { s: 7776000, label: '90 din' },
];

function DisappearingSection({ me }: { me: UserProfile }) {
  const [val, setVal] = useState(me.disappearingAfter ?? 0);

  const set = async (s: number) => {
    setVal(s);
    try { await backend.setDisappearingAfter(s); } catch { setVal(me.disappearingAfter ?? 0); }
  };

  return (
    <div className="p-4 animate-[v2fade_.18s_ease-out]">
      <p className="text-[13px] text-[var(--v2-muted)] leading-relaxed mb-4">
        Timer on karne par naye messages itne waqt baad sab ke liye auto-delete ho jayenge.
      </p>
      {DISAPPEAR_OPTS.map((o) => (
        <button
          key={o.s}
          onClick={() => set(o.s)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl mb-1.5 transition ${
            val === o.s ? 'bg-[var(--v2-accent-soft)] text-[var(--v2-accent)]' : 'hover:bg-[var(--v2-hover)]'
          }`}
        >
          <span className="flex items-center gap-3 text-[14px] font-medium">
            <Icon d={ICONS.timer} size={18} className={val === o.s ? '' : 'text-[var(--v2-muted)]'} />
            {o.label}
          </span>
          {val === o.s && <Icon d={ICONS.check} size={18} />}
        </button>
      ))}
    </div>
  );
}

// ================= slow mode =================

const SLOW_OPTS = [0, 10, 30, 60, 300, 900];

function SlowModeSection({ chatId, current, isAdmin }: { chatId: string; current: number; isAdmin: boolean }) {
  const [val, setVal] = useState(current);

  const set = async (s: number) => {
    if (!isAdmin) return;
    setVal(s);
    try { await backend.setSlowMode(chatId, s); } catch { setVal(current); }
  };

  return (
    <div className="p-4 animate-[v2fade_.18s_ease-out]">
      <p className="text-[13px] text-[var(--v2-muted)] leading-relaxed mb-4">
        Slow mode me har member itne seconds me sirf 1 message bhej sakega. Spam rokne ke liye.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {SLOW_OPTS.map((s) => (
          <button
            key={s}
            onClick={() => set(s)}
            disabled={!isAdmin}
            className={`py-2.5 rounded-xl text-[13.5px] font-medium transition disabled:opacity-60 ${
              val === s ? 'bg-[var(--v2-accent)] text-white' : 'bg-[var(--v2-input)] hover:bg-[var(--v2-active)]'
            }`}
          >
            {s === 0 ? 'Off' : s < 60 ? `${s}s` : `${s / 60}m`}
          </button>
        ))}
      </div>
      {!isAdmin && <p className="text-[12.5px] text-[var(--v2-muted)] mt-3">Sirf admins badal sakte hain.</p>}
    </div>
  );
}

// ================= members =================

function MembersSection({ chat, me, isAdmin }: { chat: Chat; me: UserProfile; isAdmin: boolean }) {
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  return (
    <div className="p-3 animate-[v2fade_.18s_ease-out]">
      {chat.participants.map((uid) => {
        const prof = chat.participantProfiles[uid];
        const name = uid === me.id ? 'Aap' : prof?.displayName || uid.slice(0, 8);
        const admin = (chat.adminIds || []).includes(uid);
        return (
          <div key={uid}>
            <div className="flex items-center gap-3 px-2 py-2.5">
              <Avatar name={name} photoURL={prof?.photoURL} size={42} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] truncate">{name}</p>
                <p className="text-[12px] text-[var(--v2-muted)]">{admin ? 'Admin' : 'Member'}</p>
              </div>
              {isAdmin && uid !== me.id && (
                <div className="flex gap-1 shrink-0">
                  {!admin && (
                    <button
                      onClick={() => backend.makeAdmin(chat.id, uid).catch(() => {})}
                      className="p-2 rounded-full hover:bg-[var(--v2-hover)] text-[var(--v2-muted)] hover:text-[var(--v2-accent)] transition"
                      title="Admin banayein"
                    >
                      <Icon d={ICONS.crown} size={17} />
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmRemove(uid)}
                    className="p-2 rounded-full hover:bg-[var(--v2-danger-bg)] text-[var(--v2-muted)] hover:text-[#ea0038] transition"
                    title="Remove karein"
                  >
                    <Icon d={ICONS.x} size={17} />
                  </button>
                </div>
              )}
            </div>
            {confirmRemove === uid && (
              <div className="bg-[var(--v2-panel2)] rounded-xl p-3.5 mb-2 ml-2 flex items-center gap-2">
                <p className="text-[13px] flex-1"><b>{name}</b> ko remove karein?</p>
                <button
                  onClick={() => { backend.removeMember(chat.id, uid).then(() => setConfirmRemove(null)).catch(() => setConfirmRemove(null)); }}
                  className="px-3 py-1.5 rounded-full bg-[#ea0038] text-white text-[12.5px] font-medium"
                >
                  Remove
                </button>
                <button onClick={() => setConfirmRemove(null)} className="px-3 py-1.5 rounded-full bg-[var(--v2-input)] text-[12.5px]">
                  Cancel
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
