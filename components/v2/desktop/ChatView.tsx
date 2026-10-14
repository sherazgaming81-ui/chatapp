'use client';

/**
 * ChatView — desktop message area.
 * Header (avatar, name, online/last-seen + Quick Actions: search-in-chat, pin info, contact info)
 * · wallpaper · day dividers · bubbles (style options) · reactions · reply quotes · polls
 * · voice player · multi-select mode · message info popover · scroll-to-bottom.
 */

import { Fragment, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat, ChatMessage, ReaderInfo, UserProfile } from '@/lib/backend/types';
import Avatar from '@/components/Avatar';
import { Ticks } from '@/components/Ticks';
import { fmtDateDivider, fmtLastSeen, fmtTime } from '@/lib/format';
import { Icon, ICONS, Popover, Modal, v2call, backendV2 } from './common';
import type { BubbleStyle, MessageFont } from './DesktopShell';
import { FONT_STACKS } from './DesktopShell';
import MessageInput from './MessageInput';
import MessageMenu, { type MenuAction } from './MessageMenu';
import DeleteDialog, { canDeleteForEveryone } from './DeleteDialog';
import DocumentPreview from './DocumentPreview';
import PhotoViewer from './PhotoViewer';

interface Props {
  chat: Chat;
  chats: Chat[];
  me: UserProfile;
  infoOpen: boolean;
  onOpenInfo(): void;
  bubbleStyle: BubbleStyle;
  messageFont: MessageFont;
  enterToSend: boolean;
  jumpTo: { id: string; at: number } | null;
  onJumpHandled(): void;
}

const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

// ---------- per-chat theme (har chat ka apna rang) ----------
const CHAT_THEME_KEY = 'v2-chat-themes';

export function getChatTheme(chatId: string): string | null {
  try {
    const all = JSON.parse(localStorage.getItem(CHAT_THEME_KEY) || '{}');
    return typeof all[chatId] === 'string' ? all[chatId] : null;
  } catch {
    return null;
  }
}

export function setChatTheme(chatId: string, color: string | null) {
  try {
    const all = JSON.parse(localStorage.getItem(CHAT_THEME_KEY) || '{}');
    if (color) all[chatId] = color;
    else delete all[chatId];
    localStorage.setItem(CHAT_THEME_KEY, JSON.stringify(all));
  } catch {}
  window.dispatchEvent(new CustomEvent('v2-chat-theme', { detail: { chatId, color } }));
}

export const CHAT_THEME_COLORS = [
  { name: 'Default', value: '' },
  { name: 'Teal', value: '#00a884' },
  { name: 'Blue', value: '#34b7f1' },
  { name: 'Purple', value: '#7f66ff' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Orange', value: '#ff9f1c' },
  { name: 'Red', value: '#ea0038' },
  { name: 'Green', value: '#22c55e' },
];

export default function ChatView({
  chat, chats, me, infoOpen, onOpenInfo, bubbleStyle, messageFont, enterToSend, jumpTo, onJumpHandled,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinned, setPinned] = useState<ChatMessage[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [chatSearch, setChatSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [showPinPop, setShowPinPop] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [forwardOpen, setForwardOpen] = useState(false);
  const [infoMsg, setInfoMsg] = useState<ChatMessage | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [chatAccent, setChatAccent] = useState<string | null>(() => getChatTheme(chat.id));
  const [bulkDelOpen, setBulkDelOpen] = useState(false);

  // per-chat theme: doosri jagah (InfoPanel) se badle to yahan reflect ho
  useEffect(() => {
    setChatAccent(getChatTheme(chat.id));
    const onTheme = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.chatId === chat.id) setChatAccent(d.color || null);
    };
    window.addEventListener('v2-chat-theme', onTheme);
    return () => window.removeEventListener('v2-chat-theme', onTheme);
  }, [chat.id]);

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const msgRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // FIX (problem 5): "mere liye delete" kiye messages chhupao — mobile yehi filter lagata hai
  useEffect(
    () =>
      backend.onMessages(chat.id, (msgs) =>
        setMessages(msgs.filter((m) => !(m.deletedFor || []).includes(me.id))),
      ),
    [chat.id, me.id],
  );
  useEffect(() => {
    backend.getPinnedMessages(chat.id).then(setPinned).catch(() => setPinned([]));
  }, [chat.id]);

  // read marker + typing debounce
  useEffect(() => {
    backend.markRead(chat.id).catch(() => {});
  }, [chat.id, messages.length]);

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

  // naye message par auto-scroll (agar pehle se neeche tha)
  const wasNearBottom = useRef(true);
  useEffect(() => {
    if (wasNearBottom.current) scrollToBottom(false);
  }, [messages.length, scrollToBottom]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    wasNearBottom.current = near;
    setShowScrollBtn(!near);
  };

  // jump-to (pinned se ya info panel se)
  useEffect(() => {
    if (!jumpTo) return;
    const el = msgRefs.current.get(jumpTo.id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('v2flash');
      setTimeout(() => el.classList.remove('v2flash'), 1600);
    }
    onJumpHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo]);

  // search-in-chat
  useEffect(() => {
    if (chatSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      backend.searchInChat(chat.id, chatSearch.trim()).then(setSearchResults).catch(() => setSearchResults([]));
    }, 400);
    return () => clearTimeout(t);
  }, [chatSearch, chat.id]);

  const subtitle = useMemo(() => {
    if (typingText) return typingText;
    if (chat.type === 'group') {
      const n = chat.participants.length;
      return `${n} member`;
    }
    const other = chat.participants.find((p) => p !== me.id);
    const prof = other ? chat.participantProfiles[other] : undefined;
    if (!prof) return '';
    return fmtLastSeen(prof.lastSeen ?? 0, !!prof.online);
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
      try {
        await backend.deleteMessage(chat.id, id, forEveryone);
      } catch {}
    }
  };

  // bulk delete dialog ke liye: sab selected apne + time limit me hon to "sab ke liye" dikhe
  const selectedMsgs = useMemo(() => messages.filter((m) => selected.has(m.id)), [messages, selected]);
  const selectedAllowEveryone =
    selectedMsgs.length > 0 &&
    selectedMsgs.every((m) => canDeleteForEveryone(m.senderId, me.id, m.createdAt));
  const selectedPreview =
    selectedMsgs
      .slice(0, 2)
      .map((m) => (m.text || `[${m.type}]`).slice(0, 80))
      .join(' · ') || '…';

  const isAdmin = (chat.adminIds || []).includes(me.id);

  const rootStyle = {
    ...(chatAccent
      ? ({ '--v2-accent': chatAccent, '--v2-accent-soft': `${chatAccent}1f` } as React.CSSProperties)
      : {}),
    '--v2-msgfont': FONT_STACKS[messageFont] || FONT_STACKS.system,
  } as React.CSSProperties;

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0" style={rootStyle}>
      {/* ===== Header ===== */}
      <header className="flex items-center gap-3 px-4 py-2 bg-[var(--v2-panel)] border-b border-[var(--v2-border)] shrink-0 z-20">
        <button onClick={onOpenInfo} className="flex items-center gap-3 min-w-0 flex-1 text-left group">
          <Avatar name={chat.name} photoURL={chat.photoURL} size={40} />
          <span className="min-w-0">
            <span className="block text-[15.5px] font-medium text-[var(--v2-text)] truncate leading-tight">
              {chat.name}
            </span>
            <span className="block text-[12.5px] text-[var(--v2-muted)] truncate">
              {typingText ? <span className="text-[var(--v2-accent)]">{typingText}</span> : subtitle}
            </span>
          </span>
        </button>

        {/* Quick Actions: search-in-chat, pin info, contact info. NO call buttons. */}
        <div className="flex items-center gap-0.5 text-[var(--v2-muted)] shrink-0">
          <div className="relative">
            <button
              onClick={() => setChatSearch((s) => (s ? '' : ' '))}
              className={`p-2 rounded-full hover:bg-[var(--v2-hover)] transition ${chatSearch ? 'text-[var(--v2-accent)]' : ''}`}
              title="Chat me dhoondein"
            >
              <Icon d={ICONS.search} size={21} />
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowPinPop((v) => !v)}
              className={`p-2 rounded-full hover:bg-[var(--v2-hover)] transition relative ${showPinPop ? 'text-[var(--v2-accent)]' : ''}`}
              title="Pinned messages"
            >
              <Icon d={ICONS.pin} size={21} />
              {pinned.length > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--v2-accent)] text-white text-[10px] font-bold flex items-center justify-center">
                  {pinned.length}
                </span>
              )}
            </button>
            {showPinPop && (
              <Popover onClose={() => setShowPinPop(false)} className="right-0 top-11 w-[300px]">
                <div className="px-4 py-2.5 text-[13px] font-semibold text-[var(--v2-accent)] border-b border-[var(--v2-border)]">
                  Pinned messages
                </div>
                <div className="max-h-[300px] overflow-y-auto v2scroll">
                  {pinned.length === 0 && (
                    <p className="px-4 py-5 text-[13px] text-[var(--v2-muted)] text-center">Koi pinned message nahi.</p>
                  )}
                  {pinned.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setShowPinPop(false);
                        msgRefs.current.get(m.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-[var(--v2-hover)] transition border-b border-[var(--v2-border)] last:border-0"
                    >
                      <p className="text-[12px] text-[var(--v2-accent)] font-medium">{m.senderName}</p>
                      <p className="text-[13.5px] text-[var(--v2-text)] truncate mt-0.5">{m.text || m.type}</p>
                    </button>
                  ))}
                </div>
              </Popover>
            )}
          </div>
          <button
            onClick={selectMode ? () => { setSelectMode(false); setSelected(new Set()); } : () => setSelectMode(true)}
            className={`p-2 rounded-full hover:bg-[var(--v2-hover)] transition ${selectMode ? 'text-[var(--v2-accent)]' : ''}`}
            title="Messages select karein"
          >
            <Icon d={ICONS.check} size={21} />
          </button>
          <button
            onClick={onOpenInfo}
            className={`p-2 rounded-full hover:bg-[var(--v2-hover)] transition ${infoOpen ? 'text-[var(--v2-accent)]' : ''}`}
            title="Contact / group info"
          >
            <Icon d={ICONS.info} size={21} />
          </button>
        </div>
      </header>

      {/* search-in-chat strip */}
      {chatSearch !== '' && (
        <div className="bg-[var(--v2-panel)] border-b border-[var(--v2-border)] px-4 py-2 shrink-0 z-10">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-[var(--v2-input)] rounded-lg px-3 py-1.5">
              <Icon d={ICONS.search} size={16} className="text-[var(--v2-muted)]" />
              <input
                autoFocus
                value={chatSearch.trimStart()}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Is chat me dhoondein…"
                className="bg-transparent outline-none text-[13.5px] w-full text-[var(--v2-text)]"
              />
            </div>
            <button onClick={() => setChatSearch('')} className="p-1.5 text-[var(--v2-muted)] hover:text-[var(--v2-text)]">
              <Icon d={ICONS.x} size={18} />
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-1.5 max-h-[180px] overflow-y-auto v2scroll rounded-lg bg-[var(--v2-panel2)]">
              {searchResults.slice(0, 20).map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setChatSearch('');
                    msgRefs.current.get(m.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[var(--v2-hover)] text-[13px] truncate border-b border-[var(--v2-border)] last:border-0"
                >
                  <span className="text-[var(--v2-accent)] text-[12px] font-medium">{m.senderName}: </span>
                  <span className="text-[var(--v2-text)]">{m.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== Messages ===== */}
      <div ref={listRef} onScroll={onScroll} className="v2wallpaper flex-1 overflow-y-auto v2scroll px-[6%] py-4 min-h-0 relative">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="bg-[var(--v2-panel)] border border-[var(--v2-border)] rounded-xl px-5 py-4 text-center max-w-[380px] shadow-[var(--v2-shadow)]">
              <p className="text-[14px] text-[var(--v2-text)] font-medium mb-1">Abhi koi message nahi</p>
              <p className="text-[13px] text-[var(--v2-muted)]">Neeche se pehla message bhejein. 👋</p>
            </div>
          </div>
        )}
        {groupByDay(messages).map((day) => (
          // Fragment: sticky date divider poore scroll container me chipka rahe (wrapper div ise rok deta tha)
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
                bubbleStyle={bubbleStyle}
                tail={i === day.items.length - 1 || day.items[i + 1].senderId !== m.senderId}
                selectMode={selectMode}
                selected={selected.has(m.id)}
                onToggleSelect={() => toggleSelect(m.id)}
                onReply={() => setReplyTo(m)}
                onInfo={() => setInfoMsg(m)}
                onEnterSelect={() => { setSelectMode(true); toggleSelect(m.id); }}
                onPinChanged={() => backend.getPinnedMessages(chat.id).then(setPinned).catch(() => {})}
              />
            ))}
          </Fragment>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* scroll-to-bottom */}
      {showScrollBtn && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-[92px] right-6 z-20 w-11 h-11 rounded-full bg-[var(--v2-panel)] border border-[var(--v2-border)] shadow-xl flex items-center justify-center text-[var(--v2-muted)] hover:text-[var(--v2-text)] transition animate-[v2pop_.15s_ease-out]"
          title="Neeche jayein"
        >
          <Icon d={ICONS.chevDown} size={22} />
        </button>
      )}

      {/* multi-select action bar */}
      {selectMode && (
        <div className="bg-[var(--v2-panel)] border-t border-[var(--v2-border)] px-4 py-2.5 flex items-center gap-2 shrink-0 animate-[v2fade_.15s_ease-out]">
          <button onClick={() => { setSelectMode(false); setSelected(new Set()); }} className="p-2 text-[var(--v2-muted)] hover:text-[var(--v2-text)]">
            <Icon d={ICONS.x} size={20} />
          </button>
          <span className="text-[14px] font-medium">{selected.size} selected</span>
          <div className="flex-1" />
          <SelBtn icon={ICONS.forward} label="Forward" disabled={selected.size === 0} onClick={() => setForwardOpen(true)} />
          <SelBtn icon={ICONS.star} label="Star" disabled={selected.size === 0} onClick={async () => {
            for (const id of selected) { try { await backend.starMessage(id, true); } catch {} }
            setSelectMode(false); setSelected(new Set());
          }} />
          <SelBtn icon={ICONS.trash} label="Delete" danger disabled={selected.size === 0} onClick={() => setBulkDelOpen(true)} />
        </div>
      )}

      {/* ===== Input ===== */}
      {!selectMode && (
        <MessageInput
          chatId={chat.id}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          enterToSend={enterToSend}
          onSent={() => { setReplyTo(null); scrollToBottom(false); }}
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

      <style>{`
        .v2flash { animation: v2flash 1.6s ease-out; }
        @keyframes v2flash { 0%,60% { filter: brightness(1.6); } 100% { filter: none; } }
        /* WhatsApp-style bubble tails (sirf group ke aakhri bubble par) */
        .v2tail { position: relative; }
        .v2tail-out::before, .v2tail-in::before { content: ""; position: absolute; top: -1px; width: 10px; height: 14px; }
        .v2tail-out::before { right: -8px; background: var(--v2-bubble-out); clip-path: polygon(0 0, 100% 0, 8% 100%); }
        .v2tail-in::before { left: -8px; background: var(--v2-bubble-in); clip-path: polygon(0 0, 100% 0, 92% 100%); }
        /* message font (settings se) */
        .v2msg { font-family: var(--v2-msgfont, inherit); }
      `}</style>
    </div>
  );
}

function SelBtn({ icon, label, disabled, danger, onClick }: { icon: string; label: string; disabled?: boolean; danger?: boolean; onClick(): void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13.5px] font-medium transition disabled:opacity-40 ${
        danger ? 'bg-[#ea0038]/10 text-[#ea0038] hover:bg-[#ea0038]/20' : 'bg-[var(--v2-input)] text-[var(--v2-text)] hover:bg-[var(--v2-active)]'
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
      <span className="bg-[var(--v2-panel)] border border-[var(--v2-border)] text-[var(--v2-muted)] text-[11.5px] font-medium px-3 py-1 rounded-lg shadow-[var(--v2-shadow)] uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

function groupByDay(msgs: ChatMessage[]) {
  const days: { key: string; label: string; items: ChatMessage[] }[] = [];
  for (const m of msgs) {
    const label = fmtDateDivider(m.createdAt);
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(m);
    else days.push({ key: label + m.id, label, items: [m] });
  }
  return days;
}

function tickState(m: ChatMessage, chat: Chat): 'sent' | 'delivered' | 'read' {
  const others = chat.participants.filter((p) => p !== m.senderId);
  if (others.length === 0) return 'sent';
  const readCount = (m.readBy || []).filter((u) => u !== m.senderId).length;
  if (readCount >= others.length) return 'read';
  if (readCount > 0) return 'delivered';
  return 'sent';
}

// ================= MessageBubble =================

interface BubbleProps {
  message: ChatMessage;
  mine: boolean;
  meId: string;
  chat: Chat;
  isAdmin: boolean;
  bubbleStyle: BubbleStyle;
  tail: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect(): void;
  onReply(): void;
  onInfo(): void;
  onEnterSelect(): void;
  onPinChanged(): void;
}

const MessageBubble = forwardRef<HTMLDivElement, BubbleProps>(function MessageBubbleInner(
  { message: m, mine, meId, chat, isAdmin, bubbleStyle, tail, selectMode, selected, onToggleSelect, onReply, onInfo, onEnterSelect, onPinChanged }: BubbleProps,
  ref: React.Ref<HTMLDivElement>,
) {
  const [menu, setMenu] = useState(false);
  const [reactBar, setReactBar] = useState(false);
  const [imgOpen, setImgOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const toggleReaction = (emoji: string) => {
    setReactBar(false);
    backend.toggleReaction(chat.id, m.id, emoji).catch(() => {});
  };

  const doDelete = (forEveryone: boolean) => {
    setDelOpen(false);
    backend.deleteMessage(chat.id, m.id, forEveryone).catch(() => {});
  };

  const doPin = () => {
    setMenu(false);
    const fn = m.isPinned ? backend.unpinMessage(chat.id, m.id) : backend.pinMessage(chat.id, m.id);
    fn.then(onPinChanged).catch(() => {});
  };

  const doStar = () => {
    setMenu(false);
    backend.starMessage(m.id, true).catch(() => {});
  };

  const doCopy = () => {
    setMenu(false);
    if (m.text) navigator.clipboard?.writeText(m.text).catch(() => {});
  };

  const pickMenu = (id: string) => {
    setMenu(false);
    if (id === 'reply') onReply();
    else if (id === 'react') setReactBar(true);
    else if (id === 'forward' || id === 'select') onEnterSelect();
    else if (id === 'star') doStar();
    else if (id === 'pin') doPin();
    else if (id === 'info') onInfo();
    else if (id === 'copy') doCopy();
    else if (id === 'delete') setDelOpen(true);
  };

  const menuActions: MenuAction[] = [
    { id: 'reply', label: 'Jawab dein', icon: 'reply', tint: 'var(--v2-accent)' },
    { id: 'react', label: 'React karein', sub: 'Emoji se jawab', icon: 'emoji', tint: '#ff9f1c', dividerAfter: true },
    { id: 'forward', label: 'Forward karein', icon: 'forward', tint: '#34b7f1' },
    { id: 'star', label: 'Star karein', sub: 'Baad me dekhne ke liye', icon: 'star', tint: '#ff9f1c' },
    ...(m.type === 'text' && m.text ? [{ id: 'copy', label: 'Copy karein', icon: 'file', tint: '#7f66ff' } as MenuAction] : []),
    ...((isAdmin || mine) ? [{ id: 'pin', label: m.isPinned ? 'Unpin karein' : 'Pin karein', icon: 'pin', tint: '#00a884' } as MenuAction] : []),
    ...(mine ? [{ id: 'info', label: 'Message info', sub: 'Delivered / read', icon: 'info', tint: '#7f66ff' } as MenuAction] : []),
    { id: 'select', label: 'Select karein', icon: 'check', tint: 'var(--v2-muted)', dividerAfter: true },
    { id: 'delete', label: 'Delete karein', sub: 'Mere liye ya sab ke liye', icon: 'trash', danger: true },
  ];

  // WhatsApp-style tails: 'default' me group ke aakhri bubble par nukili tail
  const useTail = bubbleStyle === 'default' && tail && !selectMode;
  const shape =
    bubbleStyle === 'rounded'
      ? 'rounded-2xl'
      : mine
        ? 'rounded-xl rounded-tr-[4px]'
        : 'rounded-xl rounded-tl-[4px]';
  const tailCls = useTail ? (mine ? 'v2tail v2tail-out' : 'v2tail v2tail-in') : '';

  return (
    <div ref={ref} className="flex mb-[3px] scroll-mt-24">
      {selectMode && (
        <button onClick={onToggleSelect} className="mr-1.5 self-center p-1 shrink-0">
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${selected ? 'bg-[var(--v2-accent)] border-[var(--v2-accent)]' : 'border-[var(--v2-muted)]'}`}>
            {selected && <Icon d={ICONS.check} size={13} className="text-white" />}
          </span>
        </button>
      )}
      <div className={`max-w-[72%] min-[1200px]:max-w-[65%] ${mine ? 'ml-auto' : 'mr-auto'}`}>
        <div
          onClick={() => selectMode && onToggleSelect()}
          onContextMenu={(e) => { e.preventDefault(); if (!selectMode) setMenu(true); }}
          className={`relative group px-2.5 pt-1.5 pb-1 ${shape} ${tailCls} shadow-[var(--v2-shadow)] transition ${
            mine ? 'bg-[var(--v2-bubble-out)]' : 'bg-[var(--v2-bubble-in)]'
          } ${selected ? 'ring-2 ring-[var(--v2-accent)]' : ''} ${selectMode ? 'cursor-pointer' : ''}`}
        >
          {m.isPinned && (
            <div className="flex items-center gap-1 text-[10.5px] text-[var(--v2-accent)] font-medium mb-0.5">
              <Icon d={ICONS.pin} size={11} /> Pinned
            </div>
          )}
          {!mine && chat.type === 'group' && (
            <p className="text-[12.5px] font-semibold text-[var(--v2-accent)] leading-tight mb-0.5">{m.senderName}</p>
          )}
          {m.replyTo && (
            <div className={`rounded-md px-2 py-1 mb-1 border-l-[3px] border-[var(--v2-accent)] ${mine ? 'bg-black/10' : 'bg-[var(--v2-panel2)]'}`}>
              <p className="text-[11.5px] font-semibold text-[var(--v2-accent)] leading-tight">{m.replyTo.senderName}</p>
              <p className="text-[12.5px] text-[var(--v2-text2)] truncate leading-snug">{m.replyTo.text}</p>
            </div>
          )}
          {m.forwarded && (
            <p className="text-[11px] italic text-[var(--v2-muted)] mb-0.5 flex items-center gap-1">
              <Icon d={ICONS.forward} size={11} /> Forwarded
            </p>
          )}

          <MsgBody m={m} meId={meId} chatId={chat.id} onImage={() => setImgOpen(true)} onDoc={() => setDocOpen(true)} />

          {/* reactions display */}
          {m.reactions && Object.keys(m.reactions).length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {Object.entries(m.reactions).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(emoji)}
                  className={`text-[13px] px-1.5 py-[1px] rounded-full border transition ${
                    users.includes(meId) ? 'border-[var(--v2-accent)] bg-[var(--v2-accent-soft)]' : 'border-[var(--v2-border)] bg-[var(--v2-panel2)]'
                  }`}
                  title={users.join(', ')}
                >
                  {emoji} <span className="text-[11px] text-[var(--v2-muted)]">{users.length}</span>
                </button>
              ))}
            </div>
          )}

          {/* meta row */}
          <div className="flex items-center justify-end gap-1 mt-0.5 select-none">
            {m.editedAt && <span className="text-[10.5px] italic text-[var(--v2-muted)]">edited</span>}
            <span className="text-[10.5px] text-[var(--v2-muted)]">{fmtTime(m.createdAt)}</span>
            {mine && <Ticks state={tickState(m, chat)} />}
          </div>

          {/* hover actions */}
          {!selectMode && (
            <div className={`absolute -top-3 ${mine ? '-left-2' : '-right-2'} hidden group-hover:flex items-center gap-0.5 bg-[var(--v2-panel)] border border-[var(--v2-border)] rounded-full px-1 py-0.5 shadow-lg z-10`}>
              <button onClick={() => setReactBar((v) => !v)} className="p-1 text-[var(--v2-muted)] hover:text-[var(--v2-text)]" title="React">
                <Icon d={ICONS.emoji} size={16} />
              </button>
              <button onClick={onReply} className="p-1 text-[var(--v2-muted)] hover:text-[var(--v2-text)]" title="Jawab dein">
                <Icon d={ICONS.reply} size={16} />
              </button>
              <button onClick={() => setMenu(true)} className="p-1 text-[var(--v2-muted)] hover:text-[var(--v2-text)]" title="Options">
                <Icon d={ICONS.chevDown} size={16} />
              </button>
            </div>
          )}

          {reactBar && (
            <Popover onClose={() => setReactBar(false)} className={`${mine ? 'right-0' : 'left-0'} -top-12 !min-w-0`}>
              <div className="flex gap-0.5 px-2 py-1.5">
                {QUICK_EMOJIS.map((e) => (
                  <button key={e} onClick={() => toggleReaction(e)} className="text-[22px] hover:scale-125 transition p-0.5">
                    {e}
                  </button>
                ))}
              </div>
            </Popover>
          )}

          {menu && (
            <MessageMenu actions={menuActions} mine={mine} onPick={pickMenu} onClose={() => setMenu(false)} />
          )}

          {delOpen && (
            <DeleteDialog
              preview={(m.text || `[${m.type}]`).slice(0, 120)}
              allowForEveryone={canDeleteForEveryone(m.senderId, meId, m.createdAt)}
              onPick={(choice) => doDelete(choice === 'everyone')}
              onClose={() => setDelOpen(false)}
            />
          )}
        </div>
      </div>

      {imgOpen && m.mediaURL && (
        <PhotoViewer src={m.mediaURL} caption={m.text || m.senderName} onClose={() => setImgOpen(false)} />
      )}

      {docOpen && m.mediaURL && (
        <DocumentPreview
          url={m.mediaURL}
          fileName={m.fileName || 'File'}
          fileSize={m.fileSize}
          onClose={() => setDocOpen(false)}
        />
      )}
    </div>
  );
});

function MsgBody({ m, meId, chatId, onImage, onDoc }: { m: ChatMessage; meId: string; chatId: string; onImage(): void; onDoc(): void }) {
  if (m.type === 'image' && m.mediaURL) {
    return (
      <div className="mb-1 -mx-1 -mt-0.5">
        <img src={m.mediaURL} alt="" onClick={onImage} className="rounded-lg max-h-[320px] w-full object-cover cursor-zoom-in" loading="lazy" />
        {m.text && <p className="v2msg text-[14.2px] text-[var(--v2-text)] whitespace-pre-wrap break-words leading-snug mt-1 px-1">{m.text}</p>}
      </div>
    );
  }
  if (m.type === 'audio' && m.mediaURL) {
    return (
      <div className="py-0.5">
        <VoicePlayer url={m.mediaURL} duration={m.duration ?? 0} mine={false} />
        {m.text && <p className="v2msg text-[14.2px] text-[var(--v2-text)] whitespace-pre-wrap break-words mt-1">{m.text}</p>}
      </div>
    );
  }
  if (m.type === 'file' && m.mediaURL) {
    return (
      <button onClick={onDoc} className="flex items-center gap-2.5 py-1 pr-1 text-left w-full hover:opacity-90 transition" title="Preview dekhein">
        <span className="w-10 h-10 rounded-full bg-[var(--v2-panel3)] flex items-center justify-center shrink-0">
          <Icon d={ICONS.file} size={20} className="text-[var(--v2-muted)]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] text-[var(--v2-text)] truncate max-w-[200px]">{m.fileName || 'File'}</span>
          <span className="block text-[11.5px] text-[var(--v2-muted)]">
            {m.fileSize ? `${(m.fileSize / 1024).toFixed(0)} KB` : ''} · Preview
          </span>
        </span>
        <Icon d={ICONS.chevRight} size={16} className="text-[var(--v2-muted)] shrink-0" />
      </button>
    );
  }
  if (m.type === 'poll' && m.poll) {
    return <PollView m={m} meId={meId} chatId={chatId} />;
  }
  return (
    <p className="v2msg text-[14.2px] text-[var(--v2-text)] whitespace-pre-wrap break-words leading-[1.45] px-0.5">
      {m.text}
    </p>
  );
}

function PollView({ m, meId, chatId }: { m: ChatMessage; meId: string; chatId: string }) {
  const poll = m.poll!;
  const totals = poll.options.map((_, i) => poll.votes[String(i)]?.length ?? 0);
  const total = totals.reduce((a, b) => a + b, 0);
  const myIdx = poll.options.findIndex((_, i) => poll.votes[String(i)]?.includes(meId));

  return (
    <div className="min-w-[230px] max-w-[300px] py-1">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon d={ICONS.poll} size={17} className="text-[var(--v2-accent)]" />
        <p className="text-[14px] font-semibold text-[var(--v2-text)] leading-snug">{poll.question}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {poll.options.map((opt, i) => {
          const pct = total > 0 ? Math.round((totals[i] / total) * 100) : 0;
          const isMine = myIdx === i;
          return (
            <button
              key={i}
              onClick={() => backend.votePoll(chatId, m.id, i).catch(() => {})}
              className={`relative overflow-hidden rounded-lg border text-left transition ${
                isMine ? 'border-[var(--v2-accent)]' : 'border-[var(--v2-border)] hover:border-[var(--v2-muted)]'
              }`}
            >
              <span
                className="absolute inset-y-0 left-0 bg-[var(--v2-accent-soft)] transition-all"
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center justify-between px-2.5 py-1.5">
                <span className="text-[13.5px] text-[var(--v2-text)] truncate">{opt}</span>
                <span className="text-[12px] text-[var(--v2-muted)] shrink-0 ml-2">{pct}%</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11.5px] text-[var(--v2-muted)] mt-1.5">{total} vote{total === 1 ? '' : 's'}</p>
    </div>
  );
}

function VoicePlayer({ url, duration }: { url: string; duration: number; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play().catch(() => {});
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2 min-w-[210px] max-w-[280px]">
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setT((e.target as HTMLAudioElement).currentTime)}
        onEnded={() => { setPlaying(false); setT(0); }}
      />
      <button
        onClick={toggle}
        className="w-9 h-9 rounded-full bg-[var(--v2-accent)] text-white flex items-center justify-center shrink-0 hover:brightness-110 transition"
      >
        <Icon d={playing ? ICONS.pause : ICONS.play} size={17} filled />
      </button>
      <div className="flex-1 min-w-0">
        <input
          type="range"
          min={0}
          max={Math.max(duration, t, 1)}
          step={0.1}
          value={t}
          onChange={(e) => {
            const a = audioRef.current;
            if (a) a.currentTime = Number(e.target.value);
          }}
          className="w-full accent-[#00a884] h-1 cursor-pointer"
        />
        <p className="text-[11px] text-[var(--v2-muted)]">{fmt(t)} / {fmt(duration || t)}</p>
      </div>
      <Icon d={ICONS.mic} size={17} className="text-[var(--v2-muted)] shrink-0" />
    </div>
  );
}

// ================= ForwardModal =================

function ForwardModal({ chats, currentId, onClose, onPick }: { chats: Chat[]; currentId: string; onClose(): void; onPick(id: string): void }) {
  const [q, setQ] = useState('');
  const list = chats
    .filter((c) => c.id !== currentId)
    .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 30);
  return (
    <Modal title="Forward karein" onClose={onClose}>
      <div className="p-4">
        <div className="flex items-center gap-2 bg-[var(--v2-input)] rounded-lg px-3 py-2 mb-3">
          <Icon d={ICONS.search} size={16} className="text-[var(--v2-muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chat dhoondein…" className="bg-transparent outline-none text-[14px] w-full text-[var(--v2-text)]" />
        </div>
        <div className="max-h-[320px] overflow-y-auto v2scroll">
          {list.map((c) => (
            <button key={c.id} onClick={() => onPick(c.id)} className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--v2-hover)] transition text-left">
              <Avatar name={c.name} photoURL={c.photoURL} size={42} />
              <span className="text-[14.5px] text-[var(--v2-text)] truncate">{c.name}</span>
            </button>
          ))}
          {list.length === 0 && <p className="text-center text-[13px] text-[var(--v2-muted)] py-6">Koi chat nahi.</p>}
        </div>
      </div>
    </Modal>
  );
}

// ================= MessageInfoModal =================

function MessageInfoModal({ message: m, chat, onClose }: { message: ChatMessage; chat: Chat; onClose(): void }) {
  const [readers, setReaders] = useState<ReaderInfo[] | null>(null);

  useEffect(() => {
    backend.getMessageReaders(chat.id, m.id).then(setReaders).catch(() => setReaders([]));
  }, [chat.id, m.id]);

  const deliveredTo = (m.readBy || []).filter((u) => u !== m.senderId);
  const others = chat.participants.filter((p) => p !== m.senderId);

  return (
    <Modal title="Message info" onClose={onClose}>
      <div className="p-4">
        <p className="text-[13.5px] text-[var(--v2-text)] bg-[var(--v2-panel2)] rounded-lg px-3 py-2.5 mb-3 break-words">
          {m.text || `[${m.type}]`}
        </p>
        <div className="text-[13px] space-y-2">
          <InfoRow icon={ICONS.check} label="Bheja gaya" value={fmtTime(m.createdAt)} />
          <InfoRow icon={ICONS.check} label="Deliver hua" value={`${deliveredTo.length}/${others.length} members`} />
          <InfoRow icon={ICONS.check} label="Padha" value={`${readers ? readers.length : '…'} members`} />
        </div>
        <SectionHead>Padhne wale</SectionHead>
        {!readers && <p className="text-[13px] text-[var(--v2-muted)] px-1">Load ho raha hai…</p>}
        {readers && readers.length === 0 && <p className="text-[13px] text-[var(--v2-muted)] px-1">Abhi kisi ne nahi padha.</p>}
        <div className="max-h-[220px] overflow-y-auto v2scroll">
          {readers?.map((r) => (
            <div key={r.userId} className="flex items-center justify-between px-1 py-1.5 border-b border-[var(--v2-border)] last:border-0">
              <span className="text-[13.5px] text-[var(--v2-text)] truncate">{r.displayName}</span>
              <span className="text-[12px] text-[var(--v2-muted)] shrink-0 ml-2">{fmtTime(r.readAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <Icon d={icon} size={16} className="text-[var(--v2-muted)]" />
      <span className="text-[var(--v2-muted)]">{label}</span>
      <span className="ml-auto text-[var(--v2-text)] font-medium">{value}</span>
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return <div className="px-1 pt-4 pb-1 text-[12px] font-semibold uppercase tracking-wide text-[var(--v2-accent)]">{children}</div>
}
