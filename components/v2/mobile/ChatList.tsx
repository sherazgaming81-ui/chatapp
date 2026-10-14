'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import { Ticks } from '@/components/Ticks';
import { backend } from '@/lib/backend';
import type { Chat, UserProfile } from '@/lib/backend/types';
import { fmtListTime } from '@/lib/format';
import BottomSheet, { SheetRow } from './BottomSheet';
import EmptyArt from '../shared/EmptyArt';
import { tapHaptic, sendHaptic } from '../shared/haptics';

export function chatDisplayName(chat: Chat, me: string): string {
  if (chat.type === 'group') return chat.name;
  const other = chat.participants.find((p) => p !== me);
  if (other && chat.participantProfiles[other]) return chat.participantProfiles[other].displayName || chat.name;
  return chat.name;
}

export function chatPhoto(chat: Chat, me: string): string {
  if (chat.type === 'group') return chat.photoURL;
  const other = chat.participants.find((p) => p !== me);
  if (other && chat.participantProfiles[other]) return chat.participantProfiles[other].photoURL || chat.photoURL;
  return chat.photoURL;
}

function lastPreview(chat: Chat): string {
  const lm = chat.lastMessage;
  if (!lm) return 'Abhi koi message nahi';
  if (lm.text) return lm.text;
  switch (lm.type) {
    case 'image': return '📷 Photo';
    case 'audio': return '🎤 Voice message';
    case 'poll': return '📊 Poll';
    case 'file': return '📎 File';
    default: return 'Message';
  }
}

function tickState(chat: Chat, me: string): 'sent' | 'delivered' | 'read' {
  // lastMessage has no readBy; approximate: we can't know — use 'sent'.
  // Parent passes chats; read state shown inside ChatScreen. Keep 'sent' here.
  void chat; void me;
  return 'sent';
}

/** Search query ko naam me yellow highlight karein */
function hiName(name: string, q: string): React.ReactNode {
  const query = q.trim().toLowerCase();
  if (!query) return name;
  const idx = name.toLowerCase().indexOf(query);
  if (idx < 0) return name;
  return (
    <>
      {name.slice(0, idx)}
      <mark className="mv2-hl">{name.slice(idx, idx + query.length)}</mark>
      {name.slice(idx + query.length)}
    </>
  );
}

type Tab = 'all' | 'unread' | 'groups';

export default function ChatList({
  chats,
  user,
  unread,
  isLocked,
  verifyPin,
  onSelect,
  forceFilter,
  pinnedIds,
  archivedIds,
  compact,
  onArchive,
  onUnarchive,
  onPin,
  onUnpin,
}: {
  chats: Chat[];
  user: UserProfile;
  unread: Record<string, number>;
  isLocked: (chatId: string) => boolean;
  verifyPin: (pin: string) => boolean;
  onSelect: (chat: Chat) => void;
  forceFilter?: 'groups';
  pinnedIds: string[];
  archivedIds: string[];
  compact: boolean;
  onArchive: (chatId: string) => void;
  onUnarchive: (chatId: string) => void;
  onPin: (chatId: string) => void;
  onUnpin: (chatId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>(forceFilter === 'groups' ? 'groups' : 'all');
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [pinFor, setPinFor] = useState<Chat | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [swipeOpen, setSwipeOpen] = useState<string | null>(null);
  const [mutedMap, setMutedMap] = useState<Record<string, boolean>>({});
  const [showArchived, setShowArchived] = useState(false);

  const filtered = useMemo(() => {
    let list = chats.filter((c) => !archivedIds.includes(c.id));
    if (tab === 'unread') list = list.filter((c) => (unread[c.id] || 0) > 0);
    if (tab === 'groups') list = list.filter((c) => c.type === 'group');
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((c) => chatDisplayName(c, user.id).toLowerCase().includes(q));
    }
    // pinned sab se upar, phir recent
    return [...list].sort((a, b) => {
      const pa = pinnedIds.includes(a.id) ? 0 : 1;
      const pb = pinnedIds.includes(b.id) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return b.updatedAt - a.updatedAt;
    });
  }, [chats, tab, unread, query, user.id, archivedIds, pinnedIds]);

  const archivedChats = useMemo(
    () => chats.filter((c) => archivedIds.includes(c.id)).sort((a, b) => b.updatedAt - a.updatedAt),
    [chats, archivedIds]
  );

  const tryOpen = (chat: Chat) => {
    if (isLocked(chat.id)) {
      setPinFor(chat);
      setPinInput('');
      setPinError(false);
      return;
    }
    onSelect(chat);
  };

  const submitPin = () => {
    if (!pinFor) return;
    if (verifyPin(pinInput)) {
      const c = pinFor;
      setPinFor(null);
      onSelect(c);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const ensureMuted = async (chat: Chat) => {
    if (mutedMap[chat.id] !== undefined) return mutedMap[chat.id];
    try {
      const s = await backend.getChatNotificationSettings(chat.id);
      setMutedMap((m) => ({ ...m, [chat.id]: s.muted }));
      return s.muted;
    } catch { return false; }
  };

  const toggleMute = async (chat: Chat) => {
    const cur = await ensureMuted(chat);
    try {
      await backend.setChatMuted(chat.id, !cur);
      setMutedMap((m) => ({ ...m, [chat.id]: !cur }));
      sendHaptic();
    } catch { /* ignore */ }
    setSwipeOpen(null);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: 'Sab' },
    { id: 'unread', label: 'Unread' },
    { id: 'groups', label: 'Groups' },
  ];

  return (
    <div className="flex flex-col h-full relative">
      {/* Search */}
      <div className="px-4 pt-2 pb-1">
        <div className="flex items-center gap-3 bg-[var(--mv2-input)] rounded-full px-4 h-11">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--mv2-muted)" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search karein"
            className="flex-1 bg-transparent outline-none text-[15px] text-[var(--mv2-text)] placeholder:text-[var(--mv2-muted)]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[var(--mv2-muted)] text-lg leading-none" aria-label="Clear">×</button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      {!forceFilter && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto mv2-no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 h-9 rounded-full text-[14px] font-medium whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'bg-[var(--mv2-accent-soft)] text-[var(--mv2-accent)]'
                  : 'bg-[var(--mv2-input)] text-[var(--mv2-muted)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && archivedChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center">
            <EmptyArt size={130} className="mb-4 opacity-90" />
            <p className="text-[15px] font-semibold text-[var(--mv2-text)] mb-1">
              {tab === 'unread' ? 'Sab parh liya! 🎉' : query ? 'Kuch nahi mila' : 'Koi chat nahi'}
            </p>
            <p className="text-[var(--mv2-muted)] text-[14px]">
              {tab === 'unread' ? 'Koi unread chat nahi' : query ? 'Doosra lafz try karein' : 'Neeche + dabakar baat shuru karein'}
            </p>
          </div>
        ) : (
          <>
            {filtered.map((chat) => (
              <SwipeRow
                key={chat.id}
                chat={chat}
                user={user}
                unreadCount={unread[chat.id] || 0}
                locked={isLocked(chat.id)}
                pinned={pinnedIds.includes(chat.id)}
                muted={mutedMap[chat.id] || false}
                compact={compact}
                query={query}
                swipeOpen={swipeOpen}
                setSwipeOpen={setSwipeOpen}
                onOpen={() => tryOpen(chat)}
                onArchive={() => { tapHaptic(); onArchive(chat.id); setSwipeOpen(null); }}
                onMute={() => toggleMute(chat)}
                onPinToggle={() => {
                  tapHaptic();
                  if (pinnedIds.includes(chat.id)) onUnpin(chat.id);
                  else onPin(chat.id);
                  setSwipeOpen(null);
                }}
                onEnsureMuted={() => ensureMuted(chat)}
              />
            ))}
            {/* Archived section */}
            {archivedChats.length > 0 && (
              <div className="mt-1">
                <button
                  onClick={() => { setShowArchived((s) => !s); tapHaptic(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-[var(--mv2-accent-soft)]"
                >
                  <span className="w-10 h-10 rounded-full bg-[var(--mv2-input)] flex items-center justify-center text-[18px]">📦</span>
                  <span className="flex-1 text-[15px] font-medium text-[var(--mv2-text)]">Archived</span>
                  <span className="text-[13px] text-[var(--mv2-muted)]">{archivedChats.length}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mv2-muted)" strokeWidth="2.4" strokeLinecap="round"
                    className={`transition-transform ${showArchived ? 'rotate-180' : ''}`}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {showArchived && archivedChats.map((chat) => {
                  const name = chatDisplayName(chat, user.id);
                  return (
                    <div key={chat.id} className="flex items-center gap-3 px-4 py-2.5 opacity-75">
                      <Avatar name={name} photoURL={chatPhoto(chat, user.id)} size={44} />
                      <button onClick={() => tryOpen(chat)} className="flex-1 min-w-0 text-left">
                        <span className="block text-[15px] text-[var(--mv2-text)] truncate">{hiName(name, query)}</span>
                        <span className="block text-[13px] text-[var(--mv2-muted)] truncate">{lastPreview(chat)}</span>
                      </button>
                      <button
                        onClick={() => { tapHaptic(); onUnarchive(chat.id); }}
                        aria-label="Unarchive karein"
                        className="w-10 h-10 rounded-full bg-[var(--mv2-accent-soft)] text-[var(--mv2-accent)] flex items-center justify-center"
                      >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 10a8 8 0 0 1 14-4l2 2M20 14a8 8 0 0 1-14 4l-2-2" /><path d="M20 4v4h-4M4 20v-4h4" /></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => { setShowNew(true); tapHaptic(); }}
        aria-label="Nayi chat"
        className="absolute bottom-6 right-5 w-14 h-14 rounded-2xl bg-[var(--mv2-accent)] text-white shadow-[var(--mv2-shadow)] flex items-center justify-center active:scale-95 transition-transform"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <NewChatSheet open={showNew} onClose={() => setShowNew(false)} user={user} onSelect={(c) => { setShowNew(false); onSelect(c); }} chats={chats} />

      {/* PIN gate */}
      <BottomSheet open={!!pinFor} onClose={() => setPinFor(null)} title="Locked chat">
        <div className="px-5 pb-6">
          <p className="text-[var(--mv2-muted)] text-[14px] mb-4">PIN daliye taake <b className="text-[var(--mv2-text)]">{pinFor && chatDisplayName(pinFor, user.id)}</b> khul sake.</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && submitPin()}
            placeholder="••••"
            autoFocus
            className={`w-full h-14 text-center text-2xl tracking-[0.5em] rounded-xl bg-[var(--mv2-input)] outline-none border ${
              pinError ? 'border-[var(--mv2-danger)]' : 'border-transparent focus:border-[var(--mv2-accent)]'
            } text-[var(--mv2-text)]`}
          />
          {pinError && <p className="text-[var(--mv2-danger)] text-[13px] mt-2 text-center">Ghalat PIN — dobara try karein</p>}
          <button
            onClick={submitPin}
            disabled={pinInput.length < 4}
            className="w-full mt-4 h-12 rounded-full bg-[var(--mv2-accent)] text-white font-semibold disabled:opacity-40"
          >
            Kholein
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

/**
 * SwipeRow — chat row with swipe actions:
 * daayein swipe → Archive, baayein swipe → Mute / Pin.
 */
function SwipeRow({
  chat, user, unreadCount, locked, pinned, muted, compact, query,
  swipeOpen, setSwipeOpen, onOpen, onArchive, onMute, onPinToggle, onEnsureMuted,
}: {
  chat: Chat;
  user: UserProfile;
  unreadCount: number;
  locked: boolean;
  pinned: boolean;
  muted: boolean;
  compact: boolean;
  query: string;
  swipeOpen: string | null;
  setSwipeOpen: (id: string | null) => void;
  onOpen: () => void;
  onArchive: () => void;
  onMute: () => void;
  onPinToggle: () => void;
  onEnsureMuted: () => void;
}) {
  const [x, setX] = useState(0);
  const start = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const name = chatDisplayName(chat, user.id);
  const mine = chat.lastMessage?.senderId === user.id;
  const open = swipeOpen === chat.id;

  useEffect(() => {
    if (!open) setX(0);
  }, [open ]);

  const onTS = (e: React.TouchEvent) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    moved.current = false;
  };
  const onTM = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - start.current.x;
    const dy = e.touches[0].clientY - start.current.y;
    if (Math.abs(dy) > 28) return; // vertical scroll — chhodein
    if (Math.abs(dx) > 10) moved.current = true;
    setX(Math.max(-168, Math.min(140, dx)));
  };
  const onTE = () => {
    if (x > 64) {
      setX(124);
      setSwipeOpen(chat.id);
      tapHaptic();
    } else if (x < -64) {
      setX(-152);
      setSwipeOpen(chat.id);
      onEnsureMuted();
      tapHaptic();
    } else {
      setX(0);
      if (open) setSwipeOpen(null);
    }
  };

  const onTap = (e: React.MouseEvent) => {
    if (moved.current || open) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
      setX(0);
      setSwipeOpen(null);
      return;
    }
    onOpen();
  };

  const avatarSize = compact ? 44 : 52;

  return (
    <div className="relative overflow-hidden">
      {/* underlay: left = archive (right swipe) */}
      <div className="absolute inset-0 flex items-stretch justify-between">
        <button
          onClick={onArchive}
          aria-label="Archive karein"
          className="w-[124px] shrink-0 bg-[#8a6d3b]/25 flex flex-col items-center justify-center gap-1 text-[#d1a94e]"
        >
          <span className="text-[22px]">📦</span>
          <span className="text-[11px] font-semibold">Archive</span>
        </button>
        <div className="flex-1" />
        <div className="flex shrink-0">
          <button
            onClick={onMute}
            aria-label={muted ? 'Unmute karein' : 'Mute karein'}
            className="w-[76px] bg-[var(--mv2-input)] flex flex-col items-center justify-center gap-1 text-[var(--mv2-muted)]"
          >
            <span className="text-[20px]">{muted ? '🔔' : '🔕'}</span>
            <span className="text-[11px] font-semibold">{muted ? 'Unmute' : 'Mute'}</span>
          </button>
          <button
            onClick={onPinToggle}
            aria-label={pinned ? 'Unpin karein' : 'Pin karein'}
            className={`w-[76px] flex flex-col items-center justify-center gap-1 ${pinned ? 'bg-[var(--mv2-accent)] text-white' : 'bg-[var(--mv2-accent-soft)] text-[var(--mv2-accent)]'}`}
          >
            <span className="text-[20px]">📌</span>
            <span className="text-[11px] font-semibold">{pinned ? 'Unpin' : 'Pin'}</span>
          </button>
        </div>
      </div>

      {/* foreground row */}
      <button
        onClick={onTap}
        onTouchStart={onTS}
        onTouchMove={onTM}
        onTouchEnd={onTE}
        className={`relative w-full flex items-center gap-3 px-4 active:bg-[var(--mv2-accent-soft)] text-left bg-[var(--mv2-bg)] ${compact ? 'py-[7px]' : 'py-3'}`}
        style={{ transform: x ? `translateX(${x}px)` : undefined, transition: x ? 'none' : 'transform 0.18s ease-out' }}
      >
        <div className="relative shrink-0">
          <Avatar name={name} photoURL={chatPhoto(chat, user.id)} size={avatarSize} />
          {locked && (
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[var(--mv2-header)] flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--mv2-muted)"><path d="M12 2a4 4 0 0 0-4 4v3H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V6a4 4 0 0 0-4-4zm-2 7V6a2 2 0 1 1 4 0v3h-4z" /></svg>
            </span>
          )}
        </div>
        <div className={`flex-1 min-w-0 border-b border-[var(--mv2-divider)] ${compact ? 'pb-[7px]' : 'pb-3'}`}>
          <div className="flex items-baseline justify-between gap-2">
            <span className={`font-medium text-[var(--mv2-text)] truncate ${compact ? 'text-[15px]' : 'text-[16px]'}`}>
              {pinned && <span className="mr-1 text-[13px]">📌</span>}
              {hiName(name, query)}
            </span>
            {chat.lastMessage && (
              <span className={`text-[12px] shrink-0 ${unreadCount > 0 ? 'text-[var(--mv2-unread)] font-semibold' : 'text-[var(--mv2-muted)]'}`}>
                {fmtListTime(chat.lastMessage.createdAt)}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className={`text-[14px] truncate flex items-center gap-1 ${unreadCount > 0 ? 'text-[var(--mv2-text)]' : 'text-[var(--mv2-muted)]'}`}>
              {mine && <Ticks state={tickState(chat, user.id)} />}
              {muted && <span className="text-[12px]">🔕</span>}
              {locked ? '🔒 Locked chat' : lastPreview(chat)}
            </span>
            {unreadCount > 0 && (
              <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--mv2-unread)] text-white text-[12px] font-semibold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}

function NewChatSheet({
  open, onClose, user, onSelect, chats,
}: {
  open: boolean; onClose: () => void; user: UserProfile; onSelect: (c: Chat) => void; chats: Chat[];
}) {
  const [mode, setMode] = useState<'chat' | 'group'>('chat');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setQ(''); setResults([]); setGroupName(''); setMembers([]); setMode('chat'); }
  }, [open ]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 2) { setResults([]); return; }
      setSearching(true);
      try {
        const r = await backend.searchUsers(q.trim());
        setResults(r.filter((u) => u.id !== user.id).slice(0, 20));
      } catch { setResults([]); }
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q, user.id]);

  const startChat = async (u: UserProfile) => {
    setBusy(true);
    try {
      const id = await backend.getOrCreateDirectChat(u.id);
      // parent will refresh chats via subscription; construct minimal Chat for immediate open
      const existing = chats.find((c) => c.id === id);
      if (existing) onSelect(existing);
      else onClose();
    } catch { /* ignore */ }
    setBusy(false);
  };

  const toggleMember = (u: UserProfile) =>
    setMembers((m) => (m.some((x) => x.id === u.id) ? m.filter((x) => x.id !== u.id) : [...m, u]));

  const createGroup = async () => {
    if (!groupName.trim()) return;
    setBusy(true);
    try {
      const id = await backend.createGroup(groupName.trim(), members.map((m) => m.id));
      const existing = chats.find((c) => c.id === id);
      if (existing) onSelect(existing);
      else onClose();
    } catch { /* ignore */ }
    setBusy(false);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={mode === 'chat' ? 'Nayi chat' : 'Naya group'} height="78dvh">
      <div className="px-5 pb-6">
        <div className="flex gap-2 mb-4">
          {(['chat', 'group'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 h-10 rounded-full text-[14px] font-medium ${mode === m ? 'bg-[var(--mv2-accent)] text-white' : 'bg-[var(--mv2-input)] text-[var(--mv2-muted)]'}`}
            >
              {m === 'chat' ? 'Nayi chat' : 'Naya group'}
            </button>
          ))}
        </div>

        {mode === 'group' && (
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group ka naam"
            className="w-full h-12 px-4 rounded-xl bg-[var(--mv2-input)] outline-none text-[15px] text-[var(--mv2-text)] placeholder:text-[var(--mv2-muted)] mb-2"
          />
        )}
        {mode === 'group' && members.length > 0 && (
          <div className="flex gap-2 overflow-x-auto mv2-no-scrollbar py-2">
            {members.map((m) => (
              <button key={m.id} onClick={() => toggleMember(m)} className="flex flex-col items-center gap-1 shrink-0 w-14">
                <div className="relative">
                  <Avatar name={m.displayName} photoURL={m.photoURL} size={44} />
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--mv2-danger)] text-white text-[11px] flex items-center justify-center">×</span>
                </div>
                <span className="text-[11px] text-[var(--mv2-muted)] truncate w-full text-center">{m.displayName.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 bg-[var(--mv2-input)] rounded-full px-4 h-11 mb-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--mv2-muted)" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={mode === 'chat' ? 'Naam se dhoondhein' : 'Members add karein'}
            className="flex-1 bg-transparent outline-none text-[15px] text-[var(--mv2-text)] placeholder:text-[var(--mv2-muted)]"
          />
        </div>

        {searching && <p className="text-[var(--mv2-muted)] text-[13px] px-1 py-2">Dhoondh rahe hain...</p>}
        {!searching && q.trim().length >= 2 && results.length === 0 && (
          <p className="text-[var(--mv2-muted)] text-[13px] px-1 py-2">Koi user nahi mila</p>
        )}
        {results.map((u) => {
          const selected = members.some((m) => m.id === u.id);
          return (
            <button
              key={u.id}
              disabled={busy}
              onClick={() => (mode === 'chat' ? startChat(u) : toggleMember(u))}
              className="w-full flex items-center gap-3 py-2.5 active:bg-[var(--mv2-accent-soft)] text-left"
            >
              <Avatar name={u.displayName} photoURL={u.photoURL} size={46} />
              <span className="flex-1">
                <span className="block text-[15px] text-[var(--mv2-text)]">{u.displayName}</span>
                <span className="block text-[13px] text-[var(--mv2-muted)] truncate">{u.about || u.email}</span>
              </span>
              {mode === 'group' && (
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selected ? 'bg-[var(--mv2-accent)] border-[var(--mv2-accent)]' : 'border-[var(--mv2-muted)]'}`}>
                  {selected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}
                </span>
              )}
            </button>
          );
        })}

        {mode === 'group' && (
          <button
            onClick={createGroup}
            disabled={busy || !groupName.trim()}
            className="w-full mt-4 h-12 rounded-full bg-[var(--mv2-accent)] text-white font-semibold disabled:opacity-40"
          >
            {busy ? 'Ban raha hai...' : `Group banayein${members.length ? ` (${members.length})` : ''}`}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

