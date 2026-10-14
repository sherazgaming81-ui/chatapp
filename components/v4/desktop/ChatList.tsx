'use client';

/**
 * ChatList — chat list panel (WhatsApp Web new dark UI).
 * ~380px, #111b21. Header "ChatsApp" + new-chat + menu · search · filter chips
 * (All/Unread/Groups) · Archived row · chat rows (48px avatar, preview, time,
 * unread badge) · right-click menu (pin/mute/archive/lock) · new chat/group modal.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat, UserProfile } from '@/lib/backend/types';
import Avatar from '@/components/Avatar';
import { Icon, ICONS, Modal, backendV2, v4call, fmtListHinglish } from './common';
import type { RailTab } from './IconRail';

type Chip = 'all' | 'unread' | 'groups';

interface Props {
  me: UserProfile;
  chats: Chat[];
  selectedId: string | null;
  onSelect(id: string): void;
  unreads: Record<string, number>;
  railTab: RailTab;
  onOpenSettings(): void;
}

const ARCHIVE_KEY = 'v4-archived';
const PIN_KEY = 'v4-pin';
const UNLOCKED_KEY = 'v4-unlocked';

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
}

export default function ChatList({ me, chats, selectedId, onSelect, unreads, railTab, onOpenSettings }: Props) {
  const [chip, setChip] = useState<Chip>('all');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [archivedView, setArchivedView] = useState(false);
  const [archivedIds, setArchivedIds] = useState<string[]>(() => loadJSON(ARCHIVE_KEY, []));
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [mutedIds, setMutedIds] = useState<string[]>([]);
  const [lockedIds, setLockedIds] = useState<string[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<string[]>(() => loadJSON(UNLOCKED_KEY, []));
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; chat: Chat } | null>(null);
  const [pinPrompt, setPinPrompt] = useState<{ chat: Chat } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinErr, setPinErr] = useState('');

  // rail tab → chip sync (render-time adjustment, effect nahi)
  const [prevRail, setPrevRail] = useState(railTab);
  if (prevRail !== railTab) {
    setPrevRail(railTab);
    if (railTab === 'groups') setChip('groups');
    else if (railTab === 'chats') setChip('all');
  }

  // pinned + muted + locked flags
  useEffect(() => {
    v4call(() => backend.getPinnedChats?.() ?? Promise.resolve([])).then((ids) => {
      if (ids) setPinnedIds(ids);
    });
    if (chats.length === 0) return;
    chats.forEach((c) => {
      backend.getChatNotificationSettings(c.id).then((s) => { if (s.muted) setMutedIds((m) => (m.includes(c.id) ? m : [...m, c.id])); }).catch(() => {});
      v4call(() => backendV2.isChatLocked(c.id)).then((v) => { if (v) setLockedIds((l) => (l.includes(c.id) ? l : [...l, c.id])); });
    });
  }, [chats.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleArchive = (id: string) => {
    setArchivedIds((a) => {
      const next = a.includes(id) ? a.filter((x) => x !== id) : [...a, id];
      try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const togglePin = async (id: string) => {
    const isPinned = pinnedIds.includes(id);
    try {
      await backend.setChatPinned(id, !isPinned);
      setPinnedIds((p) => (isPinned ? p.filter((x) => x !== id) : [...p, id]));
    } catch {}
  };

  const toggleMute = async (id: string) => {
    const isMuted = mutedIds.includes(id);
    try {
      await backend.setChatMuted(id, !isMuted);
      setMutedIds((m) => (isMuted ? m.filter((x) => x !== id) : [...m, id]));
    } catch {}
  };

  const toggleLock = async (id: string) => {
    const isLocked = lockedIds.includes(id);
    if (!isLocked && !localStorage.getItem(PIN_KEY)) {
      alert('Pehle Settings me chat lock PIN set karein.');
      onOpenSettings();
      return;
    }
    const ok = await v4call(() => backendV2.setChatLocked(id, !isLocked));
    if (ok !== null) setLockedIds((l) => (isLocked ? l.filter((x) => x !== id) : [...l, id]));
  };

  const rows = useMemo(() => {
    let list = [...chats]
      .filter((c) => (archivedView ? archivedIds.includes(c.id) : !archivedIds.includes(c.id)))
      .sort((a, b) => {
        const pa = pinnedIds.includes(a.id) ? 1 : 0;
        const pb = pinnedIds.includes(b.id) ? 1 : 0;
        if (pa !== pb) return pb - pa;
        return (b.lastMessage?.createdAt ?? b.updatedAt ?? 0) - (a.lastMessage?.createdAt ?? a.updatedAt ?? 0);
      });
    if (chip === 'groups') list = list.filter((c) => c.type === 'group');
    if (chip === 'unread') list = list.filter((c) => (unreads[c.id] ?? 0) > 0);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.lastMessage?.text || '').toLowerCase().includes(q));
    return list;
  }, [chats, chip, query, unreads, archivedIds, archivedView, pinnedIds]);

  const trySelect = (c: Chat) => {
    if (lockedIds.includes(c.id) && !unlockedIds.includes(c.id)) {
      setPinPrompt({ chat: c });
      setPinInput('');
      setPinErr('');
      return;
    }
    onSelect(c.id);
  };

  const unlock = () => {
    const saved = localStorage.getItem(PIN_KEY);
    if (pinPrompt && saved && pinInput === saved) {
      const next = [...unlockedIds, pinPrompt.chat.id];
      setUnlockedIds(next);
      try { localStorage.setItem(UNLOCKED_KEY, JSON.stringify(next)); } catch {}
      onSelect(pinPrompt.chat.id);
      setPinPrompt(null);
    } else {
      setPinErr('Ghalat PIN. Dobara try karein.');
    }
  };

  const totalUnread = useMemo(() => Object.values(unreads).reduce((a, b) => a + b, 0), [unreads]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#111b21]">
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between pl-5 pr-3 py-2.5 shrink-0">
        <h1 className="text-[20px] font-medium text-white tracking-tight">
          {archivedView ? 'Archived' : 'ChatsApp'}
        </h1>
        <div className="flex items-center gap-0.5 text-[#8696a0]">
          {archivedView ? (
            <button
              onClick={() => setArchivedView(false)}
              className="p-2 rounded-full hover:bg-[#1f2c34] hover:text-[#e9edef] transition"
              title="Wapas"
            >
              <Icon d={ICONS.chevLeft} size={22} />
            </button>
          ) : (
            <>
              <button
                onClick={() => setNewChatOpen(true)}
                className="p-2 rounded-full hover:bg-[#1f2c34] hover:text-[#e9edef] transition"
                title="Nayi chat"
              >
                <Icon d={ICONS.pencil} size={21} />
              </button>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((m) => !m)}
                  className="p-2 rounded-full hover:bg-[#1f2c34] hover:text-[#e9edef] transition"
                  title="Menu"
                >
                  <Icon d={ICONS.dots} size={21} filled />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-11 z-[61] bg-[#111b21] border border-[#222d34] rounded-xl shadow-2xl py-1.5 min-w-[220px] animate-[v4pop_.15s_ease-out]">
                      <button
                        onClick={() => { setMenuOpen(false); setNewChatOpen(true); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#e9edef] hover:bg-[#1f2c34] transition text-left"
                      >
                        <Icon d={ICONS.groups} size={19} className="text-[#8696a0]" /> Naya group
                      </button>
                      <button
                        onClick={() => { setMenuOpen(false); onOpenSettings(); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#e9edef] hover:bg-[#1f2c34] transition text-left"
                      >
                        <Icon d={ICONS.settings} size={19} className="text-[#8696a0]" /> Settings
                      </button>
                      <button
                        onClick={() => { setMenuOpen(false); backend.signOut().catch(() => {}); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#e9edef] hover:bg-[#1f2c34] transition text-left"
                      >
                        <Icon d={ICONS.logout} size={19} className="text-[#8696a0]" /> Log out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== Search ===== */}
      <div className="px-3 pb-2 shrink-0">
        <div className="flex items-center gap-3 bg-[#1f2c34] rounded-full px-4 py-[9px]">
          <Icon d={ICONS.search} size={17} className="text-[#8696a0] shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ya nayi chat shuru karein"
            className="bg-transparent outline-none text-[14px] w-full text-[#e9edef]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[#8696a0] hover:text-[#e9edef] shrink-0">
              <Icon d={ICONS.x} size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ===== Filter chips ===== */}
      <div className="flex items-center gap-2 px-3 pb-2.5 shrink-0">
        {([['all', 'All'], ['unread', 'Unread'], ['groups', 'Groups']] as [Chip, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setChip(t)}
            className={`px-3.5 py-[6px] rounded-full text-[13px] font-medium transition whitespace-nowrap ${
              chip === t
                ? 'bg-[#00a884]/15 text-[#00a884]'
                : 'bg-[#1f2c34] text-[#8696a0] hover:text-[#e9edef]'
            }`}
          >
            {label}
            {t === 'unread' && totalUnread > 0 && (
              <span className="ml-1.5 text-[11px] font-bold">{totalUnread}</span>
            )}
          </button>
        ))}
      </div>

      {/* ===== Rows ===== */}
      <div className="flex-1 overflow-y-auto v4scroll min-h-0 pb-2">
        {!archivedView && archivedIds.length > 0 && (
          <button
            onClick={() => setArchivedView(true)}
            className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-[#1f2c34] transition"
          >
            <span className="w-12 h-12 rounded-full bg-[#1f2c34] flex items-center justify-center shrink-0">
              <Icon d={ICONS.archive} size={22} className="text-[#00a884]" />
            </span>
            <span className="flex-1 text-[15px] text-[#e9edef]">Archived</span>
            <span className="text-[13px] text-[#00a884] font-medium">{archivedIds.length}</span>
          </button>
        )}

        {rows.length === 0 && (
          <div className="px-8 py-12 text-center text-[13.5px] text-[#8696a0] leading-relaxed">
            {query
              ? 'Koi chat nahi mili.'
              : archivedView
                ? 'Koi archived chat nahi hai.'
                : chip === 'groups'
                  ? 'Abhi koi group nahi hai.'
                  : chip === 'unread'
                    ? 'Koi unread message nahi. Sab parh liya!'
                    : 'Abhi koi chat nahi. Upar pencil se nayi chat shuru karein!'}
          </div>
        )}

        {rows.map((c) => (
          <ChatRow
            key={c.id}
            chat={c}
            meId={me.id}
            selected={c.id === selectedId}
            unread={unreads[c.id] ?? 0}
            pinned={pinnedIds.includes(c.id)}
            muted={mutedIds.includes(c.id)}
            locked={lockedIds.includes(c.id) && !unlockedIds.includes(c.id)}
            onSelect={() => trySelect(c)}
            onContext={(e) => {
              e.preventDefault();
              setCtxMenu({ x: e.clientX, y: e.clientY, chat: c });
            }}
          />
        ))}
      </div>

      {/* right-click menu */}
      {ctxMenu && (
        <ChatCtxMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          chat={ctxMenu.chat}
          pinned={pinnedIds.includes(ctxMenu.chat.id)}
          muted={mutedIds.includes(ctxMenu.chat.id)}
          archived={archivedIds.includes(ctxMenu.chat.id)}
          locked={lockedIds.includes(ctxMenu.chat.id)}
          onClose={() => setCtxMenu(null)}
          onPin={() => togglePin(ctxMenu.chat.id)}
          onMute={() => toggleMute(ctxMenu.chat.id)}
          onArchive={() => toggleArchive(ctxMenu.chat.id)}
          onLock={() => toggleLock(ctxMenu.chat.id)}
        />
      )}

      {/* locked chat PIN prompt */}
      {pinPrompt && (
        <Modal title="Locked chat" onClose={() => setPinPrompt(null)}>
          <div className="p-6">
            <div className="flex justify-center mb-4 text-[#8696a0]">
              <Icon d={ICONS.lock} size={44} />
            </div>
            <p className="text-center text-[14px] text-[#8696a0] mb-4">
              “{pinPrompt.chat.name}” lock hai. Khulne ke liye PIN dalein.
            </p>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              aria-label="Locked chat ka PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && unlock()}
              placeholder="PIN"
              className="w-full bg-[#1f2c34] rounded-full px-5 py-3 text-center text-[18px] tracking-[0.5em] outline-none text-[#e9edef] mb-2"
            />
            {pinErr && <p className="text-[#ea0038] text-[13px] text-center mb-2">{pinErr}</p>}
            <button
              onClick={unlock}
              className="w-full py-2.5 rounded-full bg-[#00a884] text-white text-[15px] font-medium hover:brightness-110 transition mt-2"
            >
              Unlock karein
            </button>
          </div>
        </Modal>
      )}

      {newChatOpen && <NewChatModal meId={me.id} onClose={() => setNewChatOpen(false)} onDone={onSelect} />}
    </div>
  );
}

// ---------- chat row ----------

function previewText(c: Chat, meId: string): { text: string; mine: boolean; typing: boolean } {
  const now = Date.now();
  const typingNames = Object.entries(c.typing || {})
    .filter(([uid, ts]) => uid !== meId && now - ts < 6000)
    .map(([uid]) => c.participantProfiles[uid]?.displayName?.split(' ')[0] || 'Koi');
  if (typingNames.length > 0) return { text: 'likh raha hai…', mine: false, typing: true };

  const lm = c.lastMessage;
  if (!lm) return { text: 'Chat shuru karein', mine: false, typing: false };
  const kind =
    lm.type === 'image' ? 'Photo'
    : lm.type === 'audio' ? 'Voice message'
    : lm.type === 'poll' ? 'Poll'
    : lm.type === 'file' ? 'Document'
    : lm.type === 'contact' ? 'Contact'
    : lm.type === 'location' ? 'Location'
    : lm.text;
  return { text: kind || '', mine: lm.senderId === meId, typing: false };
}

function ChatRow({
  chat, meId, selected, unread, pinned, muted, locked, onSelect, onContext,
}: {
  chat: Chat; meId: string; selected: boolean; unread: number; pinned: boolean;
  muted: boolean; locked: boolean; onSelect(): void; onContext(e: React.MouseEvent): void;
}) {
  const pv = previewText(chat, meId);
  return (
    <button
      onClick={onSelect}
      onContextMenu={onContext}
      className={`w-full flex items-center gap-3.5 pl-3.5 pr-4 py-[11px] text-left transition-colors relative ${
        selected ? 'bg-[#1f2c34]' : 'hover:bg-[#1f2c34]/70'
      }`}
    >
      <Avatar name={chat.name} photoURL={locked ? undefined : chat.photoURL} size={49} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[16px] text-[#e9edef] truncate font-normal flex items-center gap-1.5">
            {locked ? 'Locked chat' : chat.name}
            {locked && <Icon d={ICONS.lock} size={13} className="text-[#8696a0] shrink-0" />}
            {muted && <Icon d={ICONS.mute} size={13} className="text-[#8696a0] shrink-0" />}
          </span>
          {chat.lastMessage && (
            <span className={`text-[12px] shrink-0 ${unread > 0 ? 'text-[#00a884] font-medium' : 'text-[#8696a0]'}`}>
              {fmtListHinglish(chat.lastMessage.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-[2px]">
          <span className={`text-[13.5px] truncate ${pv.typing ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
            {pv.mine && !pv.typing && <span className="text-[#8696a0]">Aap: </span>}
            {pv.text}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            {pinned && <Icon d={ICONS.pin} size={14} className="text-[#8696a0]" />}
            {unread > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#00a884] text-[#0b141a] text-[12px] font-bold flex items-center justify-center">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </span>
        </div>
      </div>
    </button>
  );
}

// ---------- right-click menu ----------

function ChatCtxMenu({
  x, y, chat, pinned, muted, archived, locked, onClose, onPin, onMute, onArchive, onLock,
}: {
  x: number; y: number; chat: Chat; pinned: boolean; muted: boolean; archived: boolean; locked: boolean;
  onClose(): void; onPin(): void; onMute(): void; onArchive(): void; onLock(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.min(x, window.innerWidth - r.width - 8),
      top: Math.min(y, window.innerHeight - r.height - 8),
    });
  }, [x, y]);
  const item = (label: string, icon: (typeof ICONS)[keyof typeof ICONS], fn: () => void) => (
    <button
      key={label}
      onClick={() => { fn(); onClose(); }}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#e9edef] hover:bg-[#1f2c34] transition text-left"
    >
      <Icon d={icon} size={18} className="text-[#8696a0]" /> {label}
    </button>
  );
  return (
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        ref={ref}
        className="fixed z-[71] bg-[#111b21] border border-[#222d34] rounded-xl shadow-2xl py-1.5 min-w-[230px] animate-[v4pop_.15s_ease-out]"
        style={{ left: pos.left, top: pos.top }}
      >
        {item(pinned ? 'Unpin karein' : 'Pin karein', ICONS.pin, onPin)}
        {item(muted ? 'Unmute karein' : 'Mute karein', ICONS.mute, onMute)}
        {item(archived ? 'Unarchive karein' : 'Archive karein', ICONS.archive, onArchive)}
        {item(locked ? 'Unlock karein' : 'Lock karein', ICONS.lock, onLock)}
      </div>
    </>
  );
}

// ---------- new chat / group modal ----------

export function NewChatModal({ meId, onClose, onDone }: { meId: string; onClose(): void; onDone(id: string): void }) {
  const [mode, setMode] = useState<'chat' | 'group'>('chat');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [picked, setPicked] = useState<UserProfile[]>([]);
  const [groupName, setGroupName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const search = async (v: string) => {
    setQ(v);
    if (v.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      const r = await backend.searchUsers(v.trim());
      setResults(r.filter((u) => u.id !== meId).slice(0, 12));
    } catch {
      setResults([]);
    }
  };

  const togglePick = (u: UserProfile) =>
    setPicked((p) => (p.some((x) => x.id === u.id) ? p.filter((x) => x.id !== u.id) : [...p, u]));

  const create = async () => {
    setBusy(true);
    setErr('');
    try {
      if (mode === 'chat') {
        const u = picked[0];
        if (!u) throw new Error('Kisi ko chunein');
        const id = await backend.getOrCreateDirectChat(u.id);
        onDone(id);
        onClose();
      } else {
        if (!groupName.trim()) throw new Error('Group ka naam likhein');
        if (picked.length === 0) throw new Error('Kam az kam 1 member chunein');
        const id = await backend.createGroup(groupName.trim(), picked.map((p) => p.id));
        onDone(id);
        onClose();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Nahi ho saka');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={mode === 'chat' ? 'Nayi chat' : 'Naya group'} onClose={onClose}>
      <div className="p-5">
        <div className="flex gap-2 mb-4">
          {(['chat', 'group'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setPicked([]); }}
              className={`flex-1 py-2.5 rounded-full text-[14px] font-medium transition ${
                mode === m ? 'bg-[#00a884]/15 text-[#00a884]' : 'bg-[#1f2c34] text-[#8696a0]'
              }`}
            >
              {m === 'chat' ? 'Direct chat' : 'Group'}
            </button>
          ))}
        </div>
        {mode === 'group' && (
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group ka naam…"
            className="w-full bg-[#1f2c34] rounded-full px-5 py-2.5 text-[14px] outline-none mb-3 text-[#e9edef]"
          />
        )}
        <div className="flex items-center gap-3 bg-[#1f2c34] rounded-full px-4 py-2.5 mb-2">
          <Icon d={ICONS.search} size={17} className="text-[#8696a0]" />
          <input
            value={q}
            onChange={(e) => search(e.target.value)}
            placeholder="Naam ya email se dhoondein…"
            className="bg-transparent outline-none text-[14px] w-full text-[#e9edef]"
          />
        </div>
        {picked.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {picked.map((p) => (
              <button
                key={p.id}
                onClick={() => togglePick(p)}
                className="flex items-center gap-1.5 bg-[#00a884]/15 text-[#00a884] rounded-full pl-1 pr-2.5 py-1 text-[12.5px]"
              >
                <Avatar name={p.displayName} photoURL={p.photoURL} size={20} />
                {p.displayName}
                <Icon d={ICONS.x} size={13} />
              </button>
            ))}
          </div>
        )}
        <div className="max-h-[260px] overflow-y-auto v4scroll">
          {results.map((u) => {
            const isPicked = picked.some((p) => p.id === u.id);
            return (
              <button
                key={u.id}
                onClick={() => (mode === 'chat' ? setPicked([u]) : togglePick(u))}
                className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl transition ${isPicked ? 'bg-[#00a884]/10' : 'hover:bg-[#1f2c34]'}`}
              >
                <Avatar name={u.displayName} photoURL={u.photoURL} size={42} />
                <span className="text-left min-w-0">
                  <span className="block text-[15px] truncate text-[#e9edef]">{u.displayName}</span>
                  <span className="block text-[12.5px] truncate text-[#8696a0]">{u.email}</span>
                </span>
                {isPicked && <Icon d={ICONS.check} size={18} className="ml-auto text-[#00a884]" />}
              </button>
            );
          })}
          {q.trim().length >= 2 && results.length === 0 && (
            <p className="text-center text-[13px] text-[#8696a0] py-6">Koi user nahi mila.</p>
          )}
        </div>
        {err && <p className="text-[#ea0038] text-[13px] mt-2">{err}</p>}
        <button
          onClick={create}
          disabled={busy || picked.length === 0}
          className="w-full mt-4 py-2.5 rounded-full bg-[#00a884] text-white text-[15px] font-medium hover:brightness-110 transition disabled:opacity-50"
        >
          {busy ? 'Ban raha hai…' : mode === 'chat' ? 'Chat shuru karein' : 'Group banayein'}
        </button>
      </div>
    </Modal>
  );
}
