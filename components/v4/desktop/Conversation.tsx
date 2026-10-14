'use client';

/**
 * Conversation — WhatsApp Web style conversation panel.
 * Header (avatar, name, online/last-seen, search + select + menu — NO call icons)
 * · pinned banner · doodle wallpaper · date chips · bubbles · typing indicator ·
 * search-in-chat · multi-select · forward · input bar.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat, ChatMessage, UserProfile } from '@/lib/backend/types';
import Avatar from '@/components/Avatar';
import { Icon, ICONS, Popover, Modal, backendV3, v4call, fmtDayHinglish, fmtSeenHinglish } from './common';
import MessageBubble from './MessageBubble';
import InputBar from './InputBar';
import MessageInfoModal from './MessageInfoModal';
import DeleteDialog, { canDeleteForEveryone } from './DeleteDialog';

interface Props {
  chat: Chat;
  chats: Chat[];
  me: UserProfile;
  onOpenInfo(): void;
  jumpTo: { id: string; at: number } | null;
  onJumpHandled(): void;
}

export default function Conversation({ chat, chats, me, onOpenInfo, jumpTo, onJumpHandled }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [pinned, setPinned] = useState<ChatMessage[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editTarget, setEditTarget] = useState<ChatMessage | null>(null);
  const [hideForwardTag, setHideForwardTag] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [forwardOpen, setForwardOpen] = useState(false);
  const [infoMsg, setInfoMsg] = useState<ChatMessage | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [bulkDelOpen, setBulkDelOpen] = useState(false);
  const [headerMenu, setHeaderMenu] = useState(false);
  const [muted, setMuted] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const msgRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // messages subscription (deleted-for-me filter)
  useEffect(
    () =>
      backend.onMessages(chat.id, (msgs) =>
        setMessages(msgs.filter((m) => !(m.deletedFor || []).includes(me.id))),
      ),
    [chat.id, me.id],
  );

  // optimistic pending: real message aa jaye to pending hatao (render-time filter)
  const allMessages = useMemo(() => {
    const real = messages.filter((m) => !m.id.startsWith('tmp_'));
    const unresolved = pending.filter(
      (pm) =>
        !real.some(
          (rm) =>
            rm.senderId === pm.senderId &&
            rm.type === pm.type &&
            (rm.text || '') === (pm.text || '') &&
            Math.abs(rm.createdAt - pm.createdAt) < 25000,
        ),
    );
    return [...real, ...unresolved].sort((a, b) => a.createdAt - b.createdAt);
  }, [messages, pending]);

  useEffect(() => {
    backend.getPinnedMessages(chat.id).then(setPinned).catch(() => setPinned([]));
    backend.getChatNotificationSettings(chat.id).then((s) => setMuted(s.muted)).catch(() => {});
    v4call(() => backendV3.getHideForwardTag()).then((v) => { if (v !== null) setHideForwardTag(v); });
    v4call(() => backend.sweepDisappearing?.() ?? Promise.resolve()).catch(() => {});
  }, [chat.id]);

  // read marker
  useEffect(() => {
    backend.markRead(chat.id).catch(() => {});
  }, [chat.id, messages.length]);

  // typing
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      const names = Object.entries(chat.typing || {})
        .filter(([uid, ts]) => uid !== me.id && now - ts < 6000)
        .map(([uid]) => chat.participantProfiles[uid]?.displayName || 'Koi');
      setTypingText(names.length ? `${names.join(', ')} likh raha hai…` : '');
    }, 1000);
    return () => clearInterval(t);
  }, [chat, me.id]);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
  }, []);

  const wasNearBottom = useRef(true);
  useEffect(() => {
    if (wasNearBottom.current) scrollToBottom(false);
  }, [allMessages.length, scrollToBottom]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    wasNearBottom.current = near;
    setShowScrollBtn(!near);
  };

  // jump-to
  useEffect(() => {
    if (!jumpTo) return;
    const el = msgRefs.current.get(jumpTo.id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('v4flash');
      setTimeout(() => el.classList.remove('v4flash'), 1600);
    }
    onJumpHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo]);

  // search-in-chat
  useEffect(() => {
    if (!searchOpen || chatSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      backend.searchInChat(chat.id, chatSearch.trim()).then(setSearchResults).catch(() => setSearchResults([]));
    }, 400);
    return () => clearTimeout(t);
  }, [chatSearch, chat.id, searchOpen]);

  const subtitle = useMemo(() => {
    if (typingText) return typingText;
    if (chat.type === 'group') return `${chat.participants.length} members`;
    const other = chat.participants.find((p) => p !== me.id);
    const prof = other ? chat.participantProfiles[other] : undefined;
    if (!prof) return '';
    return fmtSeenHinglish(prof.lastSeen ?? 0, !!prof.online);
  }, [typingText, chat, me.id]);

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const bulkDelete = async (forEveryone: boolean) => {
    const ids = [...selected];
    setSelectMode(false);
    setSelected(new Set());
    for (const id of ids) {
      try { await backend.deleteMessage(chat.id, id, forEveryone); } catch {}
    }
  };

  const selectedMsgs = useMemo(() => messages.filter((m) => selected.has(m.id)), [messages, selected]);
  const selectedAllowEveryone =
    selectedMsgs.length > 0 && selectedMsgs.every((m) => canDeleteForEveryone(m.senderId, me.id, m.createdAt));
  const selectedPreview =
    selectedMsgs.slice(0, 2).map((m) => (m.text || `[${m.type}]`).slice(0, 80)).join(' · ') || '…';

  const isAdmin = (chat.adminIds || []).includes(me.id);
  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    try { await backend.setChatMuted(chat.id, next); } catch { setMuted(!next); }
    setHeaderMenu(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 relative">
      {/* ===== Header ===== */}
      <header className="flex items-center gap-3 px-4 py-2 bg-[#1f2c34] shrink-0 z-20">
        <button onClick={onOpenInfo} className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-lg px-1 py-0.5 -ml-1 hover:bg-white/[0.04] transition">
          <Avatar name={chat.name} photoURL={chat.photoURL} size={40} />
          <span className="min-w-0">
            <span className="block text-[16px] font-normal text-[#e9edef] truncate leading-tight">{chat.name}</span>
            <span className="block text-[12.5px] text-[#8696a0] truncate">
              {typingText ? <span className="text-[#00a884]">{typingText}</span> : subtitle}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-0.5 text-[#8696a0] shrink-0">
          <button
            onClick={() => { setSearchOpen((v) => !v); setChatSearch(''); }}
            className={`p-2.5 rounded-full hover:bg-[#2a3942] hover:text-[#e9edef] transition ${searchOpen ? 'text-[#00a884]' : ''}`}
            title="Chat me dhoondein"
          >
            <Icon d={ICONS.search} size={22} />
          </button>
          <div className="relative">
            <button
              onClick={() => setHeaderMenu((v) => !v)}
              className="p-2.5 rounded-full hover:bg-[#2a3942] hover:text-[#e9edef] transition"
              title="Menu"
            >
              <Icon d={ICONS.dots} size={22} filled />
            </button>
            {headerMenu && (
              <Popover onClose={() => setHeaderMenu(false)} className="right-0 top-12">
                <HMenuItem label="Chat info" icon={ICONS.info} onClick={() => { setHeaderMenu(false); onOpenInfo(); }} />
                <HMenuItem label="Select messages" icon={ICONS.check} onClick={() => { setHeaderMenu(false); setSelectMode(true); }} />
                <HMenuItem label={muted ? 'Unmute karein' : 'Mute karein'} icon={ICONS.mute} onClick={toggleMute} />
                <HMenuItem label="Pinned messages" icon={ICONS.pin} sub={pinned.length ? `${pinned.length} pinned` : undefined} onClick={() => { setHeaderMenu(false); jumpToPinned(); }} />
              </Popover>
            )}
          </div>
        </div>
      </header>

      {/* pinned banner (WA style) */}
      {pinned.length > 0 && !selectMode && (
        <button
          onClick={jumpToPinned}
          className="bg-[#1f2c34] border-t border-[#2a3942] px-5 py-2 flex items-center gap-3 text-left hover:bg-[#2a3942]/60 transition shrink-0 z-10"
        >
          <Icon d={ICONS.pin} size={16} className="text-[#00a884] shrink-0 -rotate-12" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium text-[#00a884] uppercase tracking-wide">Pinned message</span>
            <span className="block text-[12.5px] text-[#d1d7db] truncate">
              {pinned[0].text || `[${pinned[0].type}]`}
            </span>
          </span>
          <span className="text-[11px] text-[#8696a0] shrink-0">{pinned.length > 1 ? `+${pinned.length - 1}` : ''}</span>
        </button>
      )}

      {/* search-in-chat strip */}
      {searchOpen && (
        <div className="bg-[#1f2c34] border-t border-[#2a3942] px-4 py-2 shrink-0 z-10 animate-[v4fade_.15s_ease-out]">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-[#2a3942] rounded-full px-4 py-1.5">
              <Icon d={ICONS.search} size={16} className="text-[#8696a0]" />
              <input
                autoFocus
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Is chat me dhoondein…"
                className="bg-transparent outline-none text-[13.5px] w-full text-[#e9edef]"
              />
            </div>
            <button onClick={() => { setSearchOpen(false); setChatSearch(''); }} className="p-1.5 text-[#8696a0] hover:text-[#e9edef]">
              <Icon d={ICONS.x} size={18} />
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-1.5 max-h-[180px] overflow-y-auto v4scroll rounded-xl bg-[#2a3942]">
              {searchResults.slice(0, 20).map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSearchOpen(false); setChatSearch('');
                    msgRefs.current.get(m.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-[#1f2c34] text-[13px] truncate border-b border-[#1f2c34] last:border-0"
                >
                  <span className="text-[#00a884] text-[12px] font-medium">{m.senderName}: </span>
                  <span className="text-[#e9edef]">{m.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Messages ===== */}
      <div ref={listRef} onScroll={onScroll} className="v4wallpaper flex-1 overflow-y-auto v4scroll px-[7%] py-4 min-h-0">
        {allMessages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="bg-[#1f2c34] rounded-2xl px-6 py-5 text-center max-w-[380px] shadow-lg animate-[v4welcomefade_.3s_ease-out]">
              <p className="text-[14.5px] text-[#e9edef] font-medium mb-1">Abhi koi message nahi</p>
              <p className="text-[13px] text-[#8696a0]">Neeche se pehla message bhejein.</p>
            </div>
          </div>
        )}
        {groupByDay(allMessages).map((day) => (
          <Fragment key={day.key}>
            <DayDivider label={day.label} />
            {day.items.map((m, i) => (
              <MessageBubble
                key={m.id}
                ref={(el) => { if (el) msgRefs.current.set(m.id, el); else msgRefs.current.delete(m.id); }}
                message={m}
                mine={m.senderId === me.id}
                meId={me.id}
                chat={chat}
                isAdmin={isAdmin}
                tail={i === day.items.length - 1 || day.items[i + 1].senderId !== m.senderId}
                hideForwardTag={hideForwardTag}
                selectMode={selectMode}
                selected={selected.has(m.id)}
                onToggleSelect={() => toggleSelect(m.id)}
                onReply={() => setReplyTo(m)}
                onInfo={() => setInfoMsg(m)}
                onEnterSelect={() => { setSelectMode(true); toggleSelect(m.id); }}
                onEdit={(msg) => setEditTarget(msg)}
                onPinChanged={() => backend.getPinnedMessages(chat.id).then(setPinned).catch(() => {})}
              />
            ))}
          </Fragment>
        ))}

        {/* typing indicator bubble */}
        {typingText && (
          <div className="flex mb-[3px] animate-[v4fade_.2s_ease-out]">
            <div className="bg-[#1f2c34] rounded-xl rounded-tl-[4px] px-4 py-3 shadow-md flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-[#8696a0]"
                  style={{ animation: 'v4typing 1.2s infinite', animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* scroll-to-bottom */}
      {showScrollBtn && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-[92px] right-6 z-20 w-11 h-11 rounded-full bg-[#1f2c34] shadow-xl flex items-center justify-center text-[#8696a0] hover:text-[#e9edef] transition animate-[v4pop_.15s_ease-out]"
          title="Neeche jayein"
        >
          <Icon d={ICONS.chevDown} size={22} />
        </button>
      )}

      {/* multi-select action bar */}
      {selectMode && (
        <div className="bg-[#1f2c34] px-4 py-2.5 flex items-center gap-2 shrink-0 animate-[v4fade_.15s_ease-out]">
          <button onClick={() => { setSelectMode(false); setSelected(new Set()); }} className="p-2 text-[#8696a0] hover:text-[#e9edef]">
            <Icon d={ICONS.x} size={20} />
          </button>
          <span className="text-[14px] font-medium text-[#e9edef]">{selected.size} selected</span>
          <div className="flex-1" />
          <SelBtn icon={ICONS.forward} label="Forward karein" disabled={selected.size === 0} onClick={() => setForwardOpen(true)} />
          <SelBtn icon={ICONS.star} label="Star karein" disabled={selected.size === 0} onClick={async () => {
            for (const id of selected) { try { await backend.starMessage(id, true); } catch {} }
            setSelectMode(false); setSelected(new Set());
          }} />
          <SelBtn icon={ICONS.trash} label="Delete karein" danger disabled={selected.size === 0} onClick={() => setBulkDelOpen(true)} />
        </div>
      )}

      {/* ===== Input ===== */}
      {!selectMode && (
        <InputBar
          chatId={chat.id}
          me={me}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          onOptimistic={(m) => setPending((p) => [...p.slice(-19), m])}
          onSent={() => { setReplyTo(null); setEditTarget(null); scrollToBottom(false); }}
          editTarget={editTarget}
          onCancelEdit={() => setEditTarget(null)}
        />
      )}

      {forwardOpen && (
        <ForwardModal
          chats={chats}
          currentId={chat.id}
          onClose={() => setForwardOpen(false)}
          onPick={async (targetId) => {
            setForwardOpen(false);
            for (const id of selected) {
              try { await backend.forwardMessage(id, targetId); } catch {}
            }
            setSelectMode(false);
            setSelected(new Set());
          }}
        />
      )}

      {infoMsg && <MessageInfoModal message={infoMsg} chat={chat} onClose={() => setInfoMsg(null)} />}

      {bulkDelOpen && (
        <DeleteDialog
          preview={selectedPreview}
          count={selected.size}
          allowForEveryone={selectedAllowEveryone}
          onPick={(choice) => {
            setBulkDelOpen(false);
            bulkDelete(choice === 'everyone');
          }}
          onClose={() => setBulkDelOpen(false)}
        />
      )}
    </div>
  );

  function jumpToPinned() {
    const first = pinned[0];
    if (!first) return;
    const el = msgRefs.current.get(first.id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('v4flash');
      setTimeout(() => el.classList.remove('v4flash'), 1600);
    }
  }
}

function HMenuItem({ label, icon, sub, onClick }: { label: string; icon: string; sub?: string; onClick(): void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#e9edef] hover:bg-[#1f2c34] transition text-left">
      <Icon d={icon} size={19} className="text-[#8696a0]" />
      <span className="min-w-0">
        <span className="block leading-tight">{label}</span>
        {sub && <span className="block text-[12px] text-[#8696a0] mt-0.5">{sub}</span>}
      </span>
    </button>
  );
}

function SelBtn({ icon, label, disabled, danger, onClick }: { icon: string; label: string; disabled?: boolean; danger?: boolean; onClick(): void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13.5px] font-medium transition disabled:opacity-40 ${
        danger ? 'bg-[#ea0038]/10 text-[#ea0038] hover:bg-[#ea0038]/20' : 'bg-[#2a3942] text-[#e9edef] hover:bg-[#374045]'
      }`}
    >
      <Icon d={icon} size={16} />
      {label}
    </button>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex justify-center my-3 sticky top-0 z-10">
      <span className="bg-[#1f2c34] text-[#8696a0] text-[12px] font-medium px-3.5 py-1.5 rounded-lg shadow-md uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

function groupByDay(msgs: ChatMessage[]) {
  const days: { key: string; label: string; items: ChatMessage[] }[] = [];
  for (const m of msgs) {
    const label = fmtDayHinglish(m.createdAt);
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(m);
    else days.push({ key: label + m.id, label, items: [m] });
  }
  return days;
}

// ---------- forward modal ----------

function ForwardModal({ chats, currentId, onClose, onPick }: { chats: Chat[]; currentId: string; onClose(): void; onPick(id: string): void }) {
  const [q, setQ] = useState('');
  const list = chats
    .filter((c) => c.id !== currentId)
    .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 30);
  return (
    <Modal title="Forward karein" onClose={onClose}>
      <div className="p-4">
        <div className="flex items-center gap-3 bg-[#1f2c34] rounded-full px-4 py-2.5 mb-3">
          <Icon d={ICONS.search} size={16} className="text-[#8696a0]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chat dhoondein…" className="bg-transparent outline-none text-[14px] w-full text-[#e9edef]" />
        </div>
        <div className="max-h-[320px] overflow-y-auto v4scroll">
          {list.map((c) => (
            <button key={c.id} onClick={() => onPick(c.id)} className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#1f2c34] transition text-left">
              <Avatar name={c.name} photoURL={c.photoURL} size={44} />
              <span className="text-[15px] text-[#e9edef] truncate">{c.name}</span>
            </button>
          ))}
          {list.length === 0 && <p className="text-center text-[13px] text-[#8696a0] py-6">Koi chat nahi.</p>}
        </div>
      </div>
    </Modal>
  );
}
