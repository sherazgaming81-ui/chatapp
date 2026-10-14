'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import { Ticks } from '@/components/Ticks';
import { backend } from '@/lib/backend';
import type { Chat, ChatMessage, UserProfile } from '@/lib/backend/types';
import { fmtListTime } from '@/lib/format';
import BottomSheet, { SheetRow } from './BottomSheet';
import CameraCapture from '../../v2/mobile/CameraCapture';
import PhotoEditor from '../../v2/mobile/PhotoEditor';
import { tapHaptic } from '../../v2/shared/haptics';
import {
  CameraIcon, SearchIcon, DotsIcon, LockIcon, ArchiveIcon, PlusIcon,
  ChevronDown, XIcon, CheckIcon, MuteIcon, PinIcon, StarIcon, SettingsNavIcon,
} from './icons';

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

function lastPreview(chat: Chat, me: string): string {
  const lm = chat.lastMessage;
  if (!lm) return 'Abhi koi message nahi';
  if ((lm as unknown as ChatMessage).deletedEveryone) return 'Ye message delete kar diya gaya';
  const own = lm.senderId === me ? 'Aap: ' : chat.type === 'group' ? `${lm.senderName.split(' ')[0]}: ` : '';
  if (lm.text) return own + lm.text;
  switch (lm.type) {
    case 'image': return own + 'Photo';
    case 'audio': return own + 'Voice message';
    case 'poll': return own + 'Poll';
    case 'file': return own + 'Document';
    case 'contact': return own + 'Contact';
    case 'location': return own + 'Location';
    default: return own + 'Message';
  }
}

type Filter = 'all' | 'unread' | 'favorites' | 'groups';

export default function ChatsScreen({
  chats,
  user,
  unread,
  totalUnread,
  lockedIds,
  verifyPin,
  favoriteIds,
  onToggleFavorite,
  pinnedIds,
  archivedIds,
  onArchive,
  onUnarchive,
  onPin,
  onUnpin,
  onSelect,
  onOpenSettings,
  onOpenStarred,
  forceGroups,
}: {
  chats: Chat[];
  user: UserProfile;
  unread: Record<string, number>;
  totalUnread: number;
  lockedIds: string[];
  verifyPin: (pin: string) => boolean;
  favoriteIds: string[];
  onToggleFavorite: (id: string) => void;
  pinnedIds: string[];
  archivedIds: string[];
  onArchive: (chatId: string) => void;
  onUnarchive: (chatId: string) => void;
  onPin: (chatId: string) => void;
  onUnpin: (chatId: string) => void;
  onSelect: (chat: Chat) => void;
  onOpenSettings: () => void;
  onOpenStarred: () => void;
  forceGroups?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>(forceGroups ? 'groups' : 'all');
  const [query, setQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showNew, setShowNew] = useState<'chat' | 'group' | null>(null);
  const [pinFor, setPinFor] = useState<Chat | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showLocked, setShowLocked] = useState(false);
  const [lockedOpen, setLockedOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [swipeOpen, setSwipeOpen] = useState<string | null>(null);
  const [mutedMap, setMutedMap] = useState<Record<string, boolean>>({});
  const [showCamera, setShowCamera] = useState(false);
  const [cameraFile, setCameraFile] = useState<{ file: File; caption: string } | null>(null);
  const [sendTo, setSendTo] = useState<File | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const groupCount = useMemo(() => chats.filter((c) => c.type === 'group' && !archivedIds.includes(c.id)).length, [chats, archivedIds]);
  const lockedChats = useMemo(() => chats.filter((c) => lockedIds.includes(c.id)), [chats, lockedIds]);

  const filtered = useMemo(() => {
    let list = chats.filter((c) => !archivedIds.includes(c.id) && !lockedIds.includes(c.id));
    if (filter === 'unread') list = list.filter((c) => (unread[c.id] || 0) > 0);
    if (filter === 'favorites') list = list.filter((c) => favoriteIds.includes(c.id));
    if (filter === 'groups' || forceGroups) list = list.filter((c) => c.type === 'group');
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((c) => chatDisplayName(c, user.id).toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const pa = pinnedIds.includes(a.id) ? 0 : 1;
      const pb = pinnedIds.includes(b.id) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return b.updatedAt - a.updatedAt;
    });
  }, [chats, filter, unread, query, user.id, archivedIds, pinnedIds, favoriteIds, lockedIds, forceGroups]);

  const archivedChats = useMemo(
    () => chats.filter((c) => archivedIds.includes(c.id)).sort((a, b) => b.updatedAt - a.updatedAt),
    [chats, archivedIds]
  );

  const tryOpen = (chat: Chat) => {
    if (lockedIds.includes(chat.id)) {
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
      setPinFor(null);
      setLockedOpen(true);
      setShowLocked(true);
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

  const filters: { id: Filter; label: string; badge?: number | string }[] = forceGroups
    ? [{ id: 'groups', label: 'Groups', badge: groupCount }]
    : [
        { id: 'all', label: 'All' },
        { id: 'unread', label: 'Unread', badge: totalUnread > 0 ? totalUnread : undefined },
        { id: 'favorites', label: 'Favorites' },
        { id: 'groups', label: 'Groups', badge: groupCount },
      ];

  return (
    <div className="flex flex-col h-full relative">
      {/* ---- Header: ChatsApp green + camera/search/menu ---- */}
      <header className="wa4-safe-top bg-[var(--wa4-header)] z-20">
        <div className="flex items-center gap-1 pl-5 pr-1 h-[60px]">
          <span className="text-[21px] font-bold tracking-tight flex-1" style={{ color: '#25d366' }}>
            ChatsApp
          </span>
          <button onClick={() => { tapHaptic(); setShowCamera(true); }} aria-label="Camera"
            className="w-11 h-11 flex items-center justify-center text-[var(--wa4-muted)]">
            <CameraIcon size={23} />
          </button>
          <button onClick={() => { tapHaptic(); searchRef.current?.focus(); }} aria-label="Dhoondein"
            className="w-11 h-11 flex items-center justify-center text-[var(--wa4-muted)]">
            <SearchIcon size={22} />
          </button>
          <button onClick={() => { tapHaptic(); setShowMenu(true); }} aria-label="Menu"
            className="w-11 h-11 flex items-center justify-center text-[var(--wa4-muted)]">
            <DotsIcon size={20} />
          </button>
        </div>
      </header>

      {/* ---- Search bar ---- */}
      <div className="px-4 pt-2.5 pb-1">
        <div className="flex items-center gap-3 bg-[var(--wa4-input)] rounded-full px-4 h-[46px]">
          <span className="text-[var(--wa4-muted)]"><SearchIcon size={18} /></span>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search karein"
            className="flex-1 bg-transparent outline-none text-[15px] text-[var(--wa4-text)] placeholder:text-[var(--wa4-muted)]"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Saaf karein" className="text-[var(--wa4-muted)]">
              <XIcon size={18} />
            </button>
          )}
        </div>
      </div>

      {/* ---- Filter chips ---- */}
      <div className="flex gap-2 px-4 py-2.5 overflow-x-auto wa4-no-scrollbar">
        {filters.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => { setFilter(f.id); tapHaptic(); }}
              className={`wa4-chip flex items-center gap-1.5 px-4 h-11 rounded-full text-[14px] font-medium whitespace-nowrap ${
                active
                  ? 'text-[var(--wa4-accent)]'
                  : 'bg-[var(--wa4-chip)] text-[var(--wa4-muted)]'
              }`}
              style={active ? { background: 'var(--wa4-accent-dim)' } : undefined}
            >
              {f.label}
              {f.badge !== undefined && (
                <span className={`min-w-[20px] h-5 px-1 rounded-full text-[11px] font-bold flex items-center justify-center ${
                  active ? 'bg-[var(--wa4-accent)] text-[#0b141a]' : 'bg-[var(--wa4-muted)]/25 text-[var(--wa4-muted)]'
                }`}>
                  {typeof f.badge === 'number' && f.badge > 99 ? '99+' : f.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ---- List ---- */}
      <div className="flex-1 overflow-y-auto pb-2">
        {/* Locked chats row */}
        {!forceGroups && lockedChats.length > 0 && (
          <button
            onClick={() => {
              tapHaptic();
              if (lockedOpen) setShowLocked(true);
              else { setPinFor({ id: '__locked__' } as Chat); setPinInput(''); setPinError(false); }
            }}
            className="wa4-row w-full flex items-center gap-4 px-5 py-3 text-left"
          >
            <span className="w-[52px] h-[52px] rounded-full bg-[var(--wa4-input)] flex items-center justify-center text-[var(--wa4-accent)] shrink-0">
              <LockIcon size={24} />
            </span>
            <span className="flex-1 text-[16px] text-[var(--wa4-muted)]">Locked chats</span>
            <span className="text-[14px] text-[var(--wa4-muted)]">{lockedChats.length}</span>
          </button>
        )}

        {/* Archived row */}
        {!forceGroups && archivedChats.length > 0 && (
          <div>
            <button
              onClick={() => { setShowArchived((s) => !s); tapHaptic(); }}
              className="wa4-row w-full flex items-center gap-4 px-5 py-3 text-left"
            >
              <span className="w-[52px] h-[52px] rounded-full bg-[var(--wa4-input)] flex items-center justify-center text-[var(--wa4-accent)] shrink-0">
                <ArchiveIcon size={24} />
              </span>
              <span className="flex-1 text-[16px] text-[var(--wa4-muted)]">Archived</span>
              <span className="text-[14px] text-[var(--wa4-muted)]">{archivedChats.length}</span>
              <span className={`text-[var(--wa4-muted)] transition-transform ${showArchived ? 'rotate-180' : ''}`}>
                <ChevronDown size={18} />
              </span>
            </button>
            {showArchived && archivedChats.map((chat) => (
              <ArchivedRow key={chat.id} chat={chat} user={user}
                onOpen={() => tryOpen(chat)}
                onUnarchive={() => { tapHaptic(); onUnarchive(chat.id); }} />
            ))}
          </div>
        )}

        {/* Chat rows */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <p className="text-[16px] font-semibold text-[var(--wa4-text)] mb-1">
              {filter === 'unread' ? 'Sab parh liya!' : filter === 'favorites' ? 'Koi favorite nahi' : query ? 'Kuch nahi mila' : 'Koi chat nahi'}
            </p>
            <p className="text-[var(--wa4-muted)] text-[14px]">
              {filter === 'unread' ? 'Koi unread chat nahi hai' : query ? 'Doosra lafz try karein' : 'Neeche + dabakar baat shuru karein'}
            </p>
          </div>
        ) : (
          filtered.map((chat) => (
            <SwipeRow
              key={chat.id}
              chat={chat}
              user={user}
              unreadCount={unread[chat.id] || 0}
              pinned={pinnedIds.includes(chat.id)}
              muted={mutedMap[chat.id] || false}
              favorite={favoriteIds.includes(chat.id)}
              swipeOpen={swipeOpen}
              setSwipeOpen={setSwipeOpen}
              onOpen={() => tryOpen(chat)}
              onArchive={() => { tapHaptic(); onArchive(chat.id); setSwipeOpen(null); }}
              onMute={async () => {
                const cur = await ensureMuted(chat);
                try {
                  await backend.setChatMuted(chat.id, !cur);
                  setMutedMap((m) => ({ ...m, [chat.id]: !cur }));
                  tapHaptic();
                } catch { /* ignore */ }
                setSwipeOpen(null);
              }}
              onPinToggle={() => {
                tapHaptic();
                if (pinnedIds.includes(chat.id)) onUnpin(chat.id);
                else onPin(chat.id);
                setSwipeOpen(null);
              }}
              onFavorite={() => { tapHaptic(); onToggleFavorite(chat.id); setSwipeOpen(null); }}
              onEnsureMuted={() => ensureMuted(chat)}
            />
          ))
        )}
      </div>

      {/* ---- FAB: green rounded-square with white + ---- */}
      <button
        onClick={() => { tapHaptic(); setShowNew(forceGroups ? 'group' : 'chat'); }}
        aria-label={forceGroups ? 'Naya group' : 'Nayi chat'}
        className="wa4-fab absolute bottom-5 right-4 w-14 h-14 bg-[var(--wa4-accent)] text-white flex items-center justify-center shadow-[var(--wa4-shadow)]"
        style={{ borderRadius: 16 }}
      >
        <PlusIcon size={28} />
      </button>

      {/* New chat / group sheet */}
      <NewChatSheet
        open={showNew !== null}
        initialMode={showNew || 'chat'}
        onClose={() => setShowNew(null)}
        user={user}
        chats={chats}
        onSelect={(c) => { setShowNew(null); onSelect(c); }}
      />

      {/* Header menu */}
      <BottomSheet open={showMenu} onClose={() => setShowMenu(false)}>
        <div className="pb-6 pt-1">
          <SheetRow label="Naya group" onClick={() => { setShowMenu(false); setShowNew('group'); }}
            icon={<PlusIcon size={22} />} />
          <SheetRow label="Nayi chat" onClick={() => { setShowMenu(false); setShowNew('chat'); }}
            icon={<SearchIcon size={22} />} />
          <SheetRow label="Starred messages" sub="Star kiye hue messages" onClick={() => { setShowMenu(false); onOpenStarred(); }}
            icon={<StarIcon size={22} />} />
          <SheetRow label="Settings" onClick={() => { setShowMenu(false); onOpenSettings(); }}
            icon={<SettingsNavIcon size={22} />} />
        </div>
      </BottomSheet>

      {/* PIN gate */}
      <BottomSheet open={!!pinFor} onClose={() => setPinFor(null)} title="Locked chats">
        <div className="px-5 pb-6">
          <div className="flex justify-center py-3 text-[var(--wa4-accent)]"><LockIcon size={40} /></div>
          <p className="text-[var(--wa4-muted)] text-[14px] mb-4 text-center">
            Locked chats dekhne ke liye PIN daliye.
          </p>
          <input
            type="password" inputMode="numeric" maxLength={6}
            value={pinInput}
            aria-label="Locked chats ka PIN"
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && submitPin()}
            placeholder="••••" autoFocus
            className={`w-full h-14 text-center text-2xl tracking-[0.5em] rounded-xl bg-[var(--wa4-input)] outline-none border text-[var(--wa4-text)] ${
              pinError ? 'border-[var(--wa4-danger)]' : 'border-transparent focus:border-[var(--wa4-accent)]'
            }`}
          />
          {pinError && <p className="text-[var(--wa4-danger)] text-[13px] mt-2 text-center">Ghalat PIN — dobara try karein</p>}
          <button onClick={submitPin} disabled={pinInput.length < 4}
            className="w-full mt-4 h-12 rounded-full bg-[var(--wa4-accent)] text-[#0b141a] font-semibold disabled:opacity-40">
            Kholein
          </button>
        </div>
      </BottomSheet>

      {/* Locked chats list */}
      <BottomSheet open={showLocked && lockedOpen} onClose={() => setShowLocked(false)} title="Locked chats">
        <div className="pb-6">
          {lockedChats.map((chat) => {
            const name = chatDisplayName(chat, user.id);
            return (
              <button key={chat.id} onClick={() => { setShowLocked(false); onSelect(chat); }}
                className="wa4-row w-full flex items-center gap-3 px-5 py-3 text-left">
                <Avatar name={name} photoURL={chatPhoto(chat, user.id)} size={48} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[16px] text-[var(--wa4-text)] truncate">{name}</span>
                  <span className="block text-[13px] text-[var(--wa4-muted)] truncate">{lastPreview(chat, user.id)}</span>
                </span>
              </button>
            );
          })}
          {lockedChats.length === 0 && (
            <p className="text-[var(--wa4-muted)] text-[14px] text-center py-8">Koi locked chat nahi</p>
          )}
        </div>
      </BottomSheet>

      {/* Camera (home) */}
      <div className="mv2" data-theme="dark">
        {showCamera && (
          <CameraCapture
            onClose={() => setShowCamera(false)}
            onSend={(file, caption) => { setShowCamera(false); setCameraFile({ file, caption }); }}
          />
        )}
        {cameraFile && (
          <PhotoEditor
            file={cameraFile.file}
            initialCaption={cameraFile.caption}
            onClose={() => setCameraFile(null)}
            onSend={(f) => { setCameraFile(null); setSendTo(f); }}
          />
        )}
      </div>

      {/* Recipient picker for home-camera photo */}
      <BottomSheet open={!!sendTo} onClose={() => setSendTo(null)} title="Kis ko bhejein?">
        <div className="pb-6 max-h-[55dvh] overflow-y-auto">
          {chats.filter((c) => !archivedIds.includes(c.id)).slice(0, 30).map((c) => (
            <button key={c.id}
              onClick={async () => {
                const f = sendTo;
                setSendTo(null);
                if (!f) return;
                try {
                  const up = await backend.uploadMedia(c.id, f);
                  await backend.sendMessage(c.id, { type: 'image', text: '', mediaURL: up.url });
                  onSelect(c);
                } catch { /* ignore */ }
              }}
              className="wa4-row w-full flex items-center gap-3 px-5 py-2.5 text-left">
              <Avatar name={chatDisplayName(c, user.id)} photoURL={chatPhoto(c, user.id)} size={46} />
              <span className="text-[15px] text-[var(--wa4-text)] truncate">{chatDisplayName(c, user.id)}</span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}

function ArchivedRow({ chat, user, onOpen, onUnarchive }: {
  chat: Chat; user: UserProfile; onOpen: () => void; onUnarchive: () => void;
}) {
  const name = chatDisplayName(chat, user.id);
  return (
    <div className="flex items-center gap-3 pl-5 pr-4 py-2 opacity-80">
      <Avatar name={name} photoURL={chatPhoto(chat, user.id)} size={48} />
      <button onClick={onOpen} className="flex-1 min-w-0 text-left">
        <span className="block text-[15px] text-[var(--wa4-text)] truncate">{name}</span>
        <span className="block text-[13px] text-[var(--wa4-muted)] truncate">{lastPreview(chat, user.id)}</span>
      </button>
      <button onClick={onUnarchive} aria-label="Unarchive karein"
        className="w-11 h-11 rounded-full bg-[var(--wa4-accent-dim)] text-[var(--wa4-accent)] flex items-center justify-center shrink-0">
        <ArchiveIcon size={18} />
      </button>
    </div>
  );
}

/** Swipeable chat row: right swipe = Archive, left swipe = Mute / Pin / Favorite */
function SwipeRow({
  chat, user, unreadCount, pinned, muted, favorite,
  swipeOpen, setSwipeOpen, onOpen, onArchive, onMute, onPinToggle, onFavorite, onEnsureMuted,
}: {
  chat: Chat;
  user: UserProfile;
  unreadCount: number;
  pinned: boolean;
  muted: boolean;
  favorite: boolean;
  swipeOpen: string | null;
  setSwipeOpen: (id: string | null) => void;
  onOpen: () => void;
  onArchive: () => void;
  onMute: () => void;
  onPinToggle: () => void;
  onFavorite: () => void;
  onEnsureMuted: () => void;
}) {
  const [x, setX] = useState(0);
  const start = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const name = chatDisplayName(chat, user.id);
  const mine = chat.lastMessage?.senderId === user.id;
  const open = swipeOpen === chat.id;

  useEffect(() => { if (!open) setX(0); }, [open ]);

  const onTS = (e: React.TouchEvent) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    moved.current = false;
  };
  const onTM = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - start.current.x;
    const dy = e.touches[0].clientY - start.current.y;
    if (Math.abs(dy) > 28) return;
    if (Math.abs(dx) > 10) moved.current = true;
    setX(Math.max(-228, Math.min(140, dx)));
  };
  const onTE = () => {
    if (x > 64) { setX(124); setSwipeOpen(chat.id); tapHaptic(); }
    else if (x < -64) { setX(-228); setSwipeOpen(chat.id); onEnsureMuted(); tapHaptic(); }
    else { setX(0); if (open) setSwipeOpen(null); }
  };
  const onTap = (e: React.MouseEvent) => {
    if (moved.current || open) {
      e.preventDefault(); e.stopPropagation();
      moved.current = false; setX(0); setSwipeOpen(null);
      return;
    }
    onOpen();
  };

  const timeColor = unreadCount > 0 ? 'text-[var(--wa4-accent)]' : 'text-[var(--wa4-muted)]';

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 flex items-stretch justify-between">
        <button onClick={onArchive} aria-label="Archive karein"
          className="w-[124px] shrink-0 bg-[#1f2c34] flex flex-col items-center justify-center gap-1 text-[var(--wa4-muted)]">
          <ArchiveIcon size={22} />
          <span className="text-[11px] font-semibold">Archive</span>
        </button>
        <div className="flex-1" />
        <div className="flex shrink-0">
          <button onClick={onMute} aria-label={muted ? 'Unmute' : 'Mute'}
            className="w-[76px] bg-[#1f2c34] flex flex-col items-center justify-center gap-1 text-[var(--wa4-muted)]">
            <MuteIcon size={22} muted={muted} />
            <span className="text-[11px] font-semibold">{muted ? 'Unmute' : 'Mute'}</span>
          </button>
          <button onClick={onPinToggle} aria-label={pinned ? 'Unpin' : 'Pin'}
            className={`w-[76px] flex flex-col items-center justify-center gap-1 ${pinned ? 'bg-[var(--wa4-accent)] text-[#0b141a]' : 'bg-[var(--wa4-accent-dim)] text-[var(--wa4-accent)]'}`}>
            <PinIcon size={22} />
            <span className="text-[11px] font-semibold">{pinned ? 'Unpin' : 'Pin'}</span>
          </button>
          <button onClick={onFavorite} aria-label={favorite ? 'Favorite hatayein' : 'Favorite banayein'}
            className={`w-[76px] flex flex-col items-center justify-center gap-1 ${favorite ? 'bg-[#f15c6d]/25 text-[#f15c6d]' : 'bg-[#1f2c34] text-[var(--wa4-muted)]'}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill={favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.5 5 8 5c1.6 0 3.1.8 4 2.1C12.9 5.8 14.4 5 16 5c2.5 0 4.5 2 4.5 4.6 0 3.7-3.5 6.9-8.5 10.9z" />
            </svg>
            <span className="text-[11px] font-semibold">Fav</span>
          </button>
        </div>
      </div>

      <button
        onClick={onTap}
        onTouchStart={onTS}
        onTouchMove={onTM}
        onTouchEnd={onTE}
        className="wa4-row relative w-full flex items-center gap-3.5 pl-4 pr-4 py-3 text-left bg-[var(--wa4-bg)]"
        style={{ transform: x ? `translateX(${x}px)` : undefined, transition: x ? 'none' : 'transform 0.18s ease-out' }}
      >
        <div className="shrink-0">
          <Avatar name={name} photoURL={chatPhoto(chat, user.id)} size={52} />
        </div>
        <div className="flex-1 min-w-0 border-b border-[var(--wa4-divider)] pb-3 -mb-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`text-[16px] truncate ${unreadCount > 0 ? 'font-semibold text-[var(--wa4-text)]' : 'font-medium text-[var(--wa4-text)]'}`}>
              {name}
            </span>
            {chat.lastMessage && (
              <span className={`text-[12px] shrink-0 tabular-nums ${timeColor} ${unreadCount > 0 ? 'font-semibold' : ''}`}>
                {fmtListTime(chat.lastMessage.createdAt)}
              </span>
            )}
          </div>
          <div className="flex items-start justify-between gap-2 mt-[3px]">
            <span className="block text-[14px] text-[var(--wa4-muted)] line-clamp-2 min-w-0 leading-snug flex-1">
              {pinned && <span className="inline-block align-[-2px] mr-1 text-[var(--wa4-muted)]"><PinIcon size={13} /></span>}
              {muted && <span className="inline-block align-[-2px] mr-1 text-[var(--wa4-muted)]"><MuteIcon size={13} muted /></span>}
              {mine && chat.lastMessage && <span className="inline-block align-[-2px] mr-1"><Ticks state="sent" /></span>}
              {lastPreview(chat, user.id)}
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              {favorite && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#f15c6d"><path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.5 5 8 5c1.6 0 3.1.8 4 2.1C12.9 5.8 14.4 5 16 5c2.5 0 4.5 2 4.5 4.6 0 3.7-3.5 6.9-8.5 10.9z" /></svg>
              )}
              {unreadCount > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--wa4-accent)] text-[#0b141a] text-[12px] font-bold flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}

/** New chat / new group sheet */
function NewChatSheet({
  open, initialMode, onClose, user, chats, onSelect,
}: {
  open: boolean; initialMode: 'chat' | 'group'; onClose: () => void;
  user: UserProfile; chats: Chat[]; onSelect: (c: Chat) => void;
}) {
  const [mode, setMode] = useState<'chat' | 'group'>(initialMode);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setMode(initialMode); setQ(''); setResults([]); setGroupName(''); setMembers([]); }
  }, [open, initialMode ]);

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
    <BottomSheet open={open} onClose={onClose} title={mode === 'chat' ? 'Nayi chat' : 'Naya group'} height="80dvh">
      <div className="px-5 pb-6">
        <div className="flex gap-2 mb-4">
          {(['chat', 'group'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 h-11 rounded-full text-[14px] font-medium ${
                mode === m ? 'bg-[var(--wa4-accent)] text-[#0b141a] font-semibold' : 'bg-[var(--wa4-input)] text-[var(--wa4-muted)]'
              }`}
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
            className="w-full h-12 px-4 rounded-xl bg-[var(--wa4-input)] outline-none text-[15px] text-[var(--wa4-text)] placeholder:text-[var(--wa4-muted)] mb-2"
          />
        )}
        {mode === 'group' && members.length > 0 && (
          <div className="flex gap-2 overflow-x-auto wa4-no-scrollbar py-2">
            {members.map((m) => (
              <button key={m.id} onClick={() => toggleMember(m)} className="flex flex-col items-center gap-1 shrink-0 w-14">
                <div className="relative">
                  <Avatar name={m.displayName} photoURL={m.photoURL} size={44} />
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--wa4-danger)] text-white text-[11px] flex items-center justify-center">
                    <XIcon size={12} />
                  </span>
                </div>
                <span className="text-[11px] text-[var(--wa4-muted)] truncate w-full text-center">{m.displayName.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 bg-[var(--wa4-input)] rounded-full px-4 h-11 mb-2">
          <span className="text-[var(--wa4-muted)]"><SearchIcon size={16} /></span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={mode === 'chat' ? 'Naam se dhoondhein' : 'Members add karein'}
            className="flex-1 bg-transparent outline-none text-[15px] text-[var(--wa4-text)] placeholder:text-[var(--wa4-muted)]"
          />
        </div>

        {searching && <p className="text-[var(--wa4-muted)] text-[13px] px-1 py-2">Dhoondh rahe hain...</p>}
        {!searching && q.trim().length >= 2 && results.length === 0 && (
          <p className="text-[var(--wa4-muted)] text-[13px] px-1 py-2">Koi user nahi mila</p>
        )}
        {results.map((u) => {
          const selected = members.some((m) => m.id === u.id);
          return (
            <button
              key={u.id}
              disabled={busy}
              onClick={() => (mode === 'chat' ? startChat(u) : toggleMember(u))}
              className="wa4-row w-full flex items-center gap-3 py-2.5 text-left"
            >
              <Avatar name={u.displayName} photoURL={u.photoURL} size={46} />
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] text-[var(--wa4-text)] truncate">{u.displayName}</span>
                <span className="block text-[13px] text-[var(--wa4-muted)] truncate">{u.about || u.email}</span>
              </span>
              {mode === 'group' && (
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'bg-[var(--wa4-accent)] border-[var(--wa4-accent)] text-[#0b141a]' : 'border-[var(--wa4-muted)]'}`}>
                  {selected && <CheckIcon size={13} />}
                </span>
              )}
            </button>
          );
        })}

        {mode === 'group' && (
          <button
            onClick={createGroup}
            disabled={busy || !groupName.trim()}
            className="w-full mt-4 h-12 rounded-full bg-[var(--wa4-accent)] text-[#0b141a] font-semibold disabled:opacity-40"
          >
            {busy ? 'Ban raha hai...' : `Group banayein${members.length ? ` (${members.length})` : ''}`}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
