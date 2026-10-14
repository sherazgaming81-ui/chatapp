'use client';

import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import { Ticks } from '@/components/Ticks';
import { backend, backendV2, backendV3 } from '@/lib/backend';
import type { BackendV2 } from '@/lib/v2/types';
import type { Chat, ChatMessage, ReaderInfo, ReplyRef, SendInput, UserProfile } from '@/lib/backend/types';
import { fmtDateDivider, fmtLastSeen, fmtTime } from '@/lib/format';
import { extractUrls, LinkPreviewCard } from '../../v2/shared/LinkPreview';
import { sendHaptic, tapHaptic } from '../../v2/shared/haptics';
import BottomSheet, { SheetRow } from './BottomSheet';
import MicButton, { VoicePlayer } from './VoiceRecorder';
import CameraCapture from '../../v2/mobile/CameraCapture';
import PhotoEditor from '../../v2/mobile/PhotoEditor';
import VideoTrimmer from '../../v2/mobile/VideoTrimmer';
import { chatDisplayName, chatPhoto } from './ChatsScreen';
import {
  BackIcon, SearchIcon, DotsIcon, PaperclipIcon, CameraIcon, SendIcon,
  XIcon, ReplyIcon, ForwardIcon, CopyIcon, StarIcon, PinIcon, TrashIcon,
  InfoIcon, EyeIcon, MuteIcon, LockIcon, BlockIcon, PollIcon, ContactIcon,
  LocationIcon, DocIcon, GalleryIcon, ClockIcon, HeartIcon,
} from './icons';

const backendV2x = backendV2 as unknown as BackendV2;

/** WhatsApp group sender-name palette */
const SENDER_COLORS = ['#ff9e80', '#ffd180', '#e6ee9c', '#a5d6a7', '#80cbc4', '#80d8ff', '#82b1ff', '#b388ff', '#f48fb1', '#ffcc80'];
function senderColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SENDER_COLORS[h % SENDER_COLORS.length];
}

function msgTick(m: ChatMessage, chat: Chat): 'sent' | 'delivered' | 'read' {
  const others = (m.readBy || []).filter((id) => id !== m.senderId);
  if (others.length >= Math.max(1, chat.participants.length - 1)) return 'read';
  if (others.length > 0) return 'delivered';
  return 'sent';
}

function bubblePreview(m: ChatMessage): string {
  if (m.deletedEveryone) return 'Ye message delete kar diya gaya';
  if (m.text) return m.text.slice(0, 60);
  if (m.type === 'image' && m.mediaURL && /\.(webm|mp4|mov)(\?|$)/i.test(m.mediaURL)) return 'Video';
  return m.type === 'image' ? 'Photo' : m.type === 'audio' ? 'Voice message'
    : m.type === 'poll' ? 'Poll' : m.type === 'contact' ? 'Contact'
    : m.type === 'location' ? 'Location' : 'Document';
}

function hi(text: string, q: string): React.ReactNode {
  const query = q.trim().toLowerCase();
  if (!query || !text) return text;
  const out: React.ReactNode[] = [];
  let rest = text;
  let k = 0;
  while (rest) {
    const idx = rest.toLowerCase().indexOf(query);
    if (idx < 0) { out.push(rest); break; }
    if (idx > 0) out.push(rest.slice(0, idx));
    out.push(<mark key={k++} className="wa4-hl">{rest.slice(idx, idx + query.length)}</mark>);
    rest = rest.slice(idx + query.length);
  }
  return <>{out}</>;
}

/** URLs ko clickable links me todo */
function linkify(text: string, mine: boolean, highlight: string): React.ReactNode {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  const isUrl = (p: string) => /^https?:\/\/[^\s]+$/.test(p);
  return (
    <>
      {parts.map((p, i) =>
        isUrl(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            className={mine ? 'text-[#a9e7c9] underline' : 'text-[var(--wa4-tick-blue)] underline'}>
            {highlight ? hi(p, highlight) : p}
          </a>
        ) : (
          <React.Fragment key={i}>{highlight ? hi(p, highlight) : p}</React.Fragment>
        )
      )}
    </>
  );
}

const REACT_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

export default function ChatScreen({
  chat,
  user,
  chats,
  onBack,
  onSelectChat,
  isChatLocked,
  onToggleLock,
  isUserBlocked,
  onToggleBlock,
  isFavorite,
  onToggleFavorite,
}: {
  chat: Chat;
  user: UserProfile;
  chats: Chat[];
  onBack: () => void;
  onSelectChat: (chat: Chat) => void;
  isChatLocked: (id: string) => boolean;
  onToggleLock: (chat: Chat) => void;
  isUserBlocked: (userId: string) => boolean;
  onToggleBlock: (chat: Chat) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyRef | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [actionMsg, setActionMsg] = useState<ChatMessage | null>(null);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [readers, setReaders] = useState<ReaderInfo[] | null>(null);
  const [muted, setMuted] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{ file: File; caption: string } | null>(null);
  const [pendingVideo, setPendingVideo] = useState<File | null>(null);
  const [viewer, setViewer] = useState<{ url: string; caption: string } | null>(null);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [pinned, setPinned] = useState<ChatMessage[]>([]);
  const [unreadMark, setUnreadMark] = useState<{ id: string; count: number } | null>(null);
  const [hideFwdTag, setHideFwdTag] = useState(false);
  // sheets
  const [showPoll, setShowPoll] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showSelfDestruct, setShowSelfDestruct] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showLocation, setShowLocation] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const nearBottom = useRef(true);
  const firstLoad = useRef(true);

  const me = user.id;
  const otherId = chat.type === 'direct' ? chat.participants.find((p) => p !== me) : undefined;
  const title = chatDisplayName(chat, me);

  // ---- messages subscription ----
  useEffect(() => {
    setMessages([]);
    setUnreadMark(null);
    firstLoad.current = true;
    const unsub = backend.onMessages(chat.id, (msgs) => {
      const list = msgs.filter((m) => !(m.deletedFor || []).includes(me));
      setMessages(list);
      if (firstLoad.current) {
        firstLoad.current = false;
        const unreadMsgs = list.filter((m) => m.senderId !== me && !(m.readBy || []).includes(me));
        if (unreadMsgs.length > 0) {
          setUnreadMark({ id: unreadMsgs[0].id, count: unreadMsgs.length });
        }
      }
    });
    backend.markRead(chat.id).catch(() => {});
    return unsub;
  }, [chat.id, me]);

  const sorted = useMemo(
    () => [...messages].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
    [messages]
  );

  useEffect(() => {
    const last = sorted[sorted.length - 1];
    if (last && last.senderId !== me) backend.markRead(chat.id).catch(() => {});
  }, [sorted, chat.id, me]);

  useEffect(() => {
    backend.getChatNotificationSettings(chat.id).then((s) => setMuted(s.muted)).catch(() => {});
    backend.getPinnedMessages(chat.id).then(setPinned).catch(() => setPinned([]));
    backend.getStarredMessages().then((s) => setStarredIds(new Set(s.map((m) => m.id)))).catch(() => {});
    backendV3.getHideForwardTag?.().then(setHideFwdTag).catch(() => {});
  }, [chat.id ]);

  // ---- draft ----
  useEffect(() => {
    backendV2x.getDraft?.(chat.id).then((d) => { if (d) setInput(d); }).catch(() => {});
    return () => { if (draftTimer.current) clearTimeout(draftTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id ]);

  // ---- typing ----
  const typingNames = useMemo(() => {
    const now = Date.now();
    return Object.entries(chat.typing || {})
      .filter(([id, ts]) => id !== me && now - ts < 5000)
      .map(([id]) => chat.participantProfiles[id]?.displayName?.split(' ')[0] || 'Koi');
  }, [chat.typing, chat.participantProfiles, me ]);

  const subtitle = typingNames.length > 0
    ? `${typingNames.join(', ')} likh raha hai…`
    : chat.type === 'group'
      ? `${chat.participants.length} members`
      : otherId
        ? chat.participantProfiles[otherId]?.online
          ? 'online'
          : fmtLastSeen(chat.participantProfiles[otherId]?.lastSeen || 0, false)
        : '';

  const composeUrl = useMemo(() => extractUrls(input)[0] || null, [input]);

  // ---- scroll ----
  const scrollBottom = (smooth = true) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };
  useEffect(() => { if (nearBottom.current) scrollBottom(false); }, [sorted.length, typingNames.length]);

  const onInput = (v: string) => {
    setInput(v);
    backend.setTyping(chat.id, true).catch(() => {});
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => backend.setTyping(chat.id, false).catch(() => {}), 2500);
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      const t = v.trim();
      if (t) backendV2x.saveDraft?.(chat.id, t).catch(() => {});
      else backendV2x.clearDraft?.(chat.id).catch(() => {});
    }, 800);
  };

  const sendText = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    const rp = replyTo;
    setInput('');
    setReplyTo(null);
    try {
      await backend.sendMessage(chat.id, { type: 'text', text, replyTo: rp });
      backendV2x.clearDraft?.(chat.id).catch(() => {});
      sendHaptic();
    } catch { setInput(text); }
    setSending(false);
  };

  const sendVoice = async (blob: Blob, seconds: number) => {
    try {
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
      const up = await backend.uploadMedia(chat.id, file);
      await backend.sendMessage(chat.id, { type: 'audio', text: '', mediaURL: up.url, duration: seconds, replyTo });
      setReplyTo(null);
      sendHaptic();
    } catch { /* ignore */ }
  };

  const onGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setShowAttach(false);
    if (f.type.startsWith('video/')) setPendingVideo(f);
    else setPendingPhoto({ file: f, caption: '' });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setShowAttach(false);
    try {
      const up = await backend.uploadFile(chat.id, f);
      await backend.sendMessage(chat.id, { type: 'file', text: '', mediaURL: up.url, fileName: up.name, fileSize: up.size, replyTo });
      setReplyTo(null);
      sendHaptic();
    } catch { /* ignore */ }
  };

  const sendEditedPhoto = async (file: File, caption: string) => {
    setPendingPhoto(null);
    try {
      const up = await backend.uploadMedia(chat.id, file);
      await backend.sendMessage(chat.id, { type: 'image', text: caption, mediaURL: up.url, replyTo });
      setReplyTo(null);
      sendHaptic();
    } catch { /* ignore */ }
  };

  const sendTrimmedVideo = async (file: File) => {
    setPendingVideo(null);
    try {
      const up = await backend.uploadMedia(chat.id, file);
      await backend.sendMessage(chat.id, { type: 'image', text: '', mediaURL: up.url, replyTo });
      setReplyTo(null);
      sendHaptic();
    } catch { /* ignore */ }
  };

  // ---- message actions ----
  const doReply = (m: ChatMessage) => {
    setReplyTo({ id: m.id, text: bubblePreview(m), senderName: m.senderId === me ? 'Aap' : m.senderName });
    setActionMsg(null);
  };
  const doCopy = (m: ChatMessage) => {
    if (m.text) navigator.clipboard?.writeText(m.text).catch(() => {});
    setActionMsg(null);
  };
  const doStar = (m: ChatMessage) => {
    const starred = !starredIds.has(m.id);
    backend.starMessage(m.id, starred).catch(() => {});
    setStarredIds((s) => { const n = new Set(s); if (starred) n.add(m.id); else n.delete(m.id); return n; });
    setActionMsg(null);
    tapHaptic();
  };
  const doPin = (m: ChatMessage) => {
    (m.isPinned ? backend.unpinMessage(chat.id, m.id) : backend.pinMessage(chat.id, m.id))
      .then(() => backend.getPinnedMessages(chat.id).then(setPinned).catch(() => {}))
      .catch(() => {});
    setActionMsg(null);
  };
  const doDelete = (m: ChatMessage, forEveryone: boolean) => {
    backend.deleteMessage(chat.id, m.id, forEveryone).catch(() => {});
    setActionMsg(null);
  };
  const doReact = (m: ChatMessage, emoji: string) => {
    backend.toggleReaction(chat.id, m.id, emoji).catch(() => {});
  };
  const doInfo = async (m: ChatMessage) => {
    setReaders([]);
    try { setReaders(await backend.getMessageReaders(chat.id, m.id)); }
    catch { setReaders(null); }
  };
  const doForwardPick = (target: Chat) => {
    if (!forwardMsg) return;
    backend.forwardMessage(forwardMsg.id, target.id).catch(() => {});
    setForwardMsg(null);
    setActionMsg(null);
    if (target.id !== chat.id) onSelectChat(target);
  };

  // ---- in-chat search ----
  useEffect(() => {
    if (!searching || searchQ.trim().length < 2) { setSearchHits([]); return; }
    const t = setTimeout(async () => {
      try { setSearchHits(await backend.searchInChat(chat.id, searchQ.trim())); }
      catch { setSearchHits([]); }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQ, searching, chat.id ]);

  const jumpTo = (id: string) => {
    const el = msgRefs.current[id];
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('wa4-pop');
      setTimeout(() => el.classList.remove('wa4-pop'), 500);
    }
  };

  const toggleMute = async () => {
    try {
      await backend.setChatMuted(chat.id, !muted);
      setMuted(!muted);
    } catch {}
    setShowMenu(false);
  };

  const blocked = otherId ? isUserBlocked(otherId) : false;

  return (
    <div className="flex flex-col h-full bg-[#0b141a]">
      {/* ============ HEADER ============ */}
      <header className="wa4-safe-top bg-[var(--wa4-header)] z-20 shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-0.5 pl-1 pr-1 h-[60px]">
          <button onClick={onBack} aria-label="Wapas" className="w-10 h-11 flex items-center justify-center text-[var(--wa4-text)]">
            <BackIcon size={23} />
          </button>
          <button onClick={() => setShowInfo(true)} className="flex items-center gap-3 flex-1 min-w-0 text-left py-1">
            <Avatar name={title} photoURL={chatPhoto(chat, me)} size={40} />
            <span className="min-w-0">
              <span className="block font-medium text-[16.5px] text-[var(--wa4-text)] truncate leading-tight">{title}</span>
              <span className="flex items-center gap-1.5 text-[13px] text-[var(--wa4-muted)] truncate leading-tight mt-0.5">
                {typingNames.length > 0 ? (
                  <span className="flex items-center gap-1.5">
                    <span className="text-[var(--wa4-accent)] truncate">{typingNames.join(', ')} likh raha hai</span>
                    <span className="flex gap-[3px]"><span className="wa4-typing-dot" /><span className="wa4-typing-dot" /><span className="wa4-typing-dot" /></span>
                  </span>
                ) : subtitle}
              </span>
            </span>
          </button>
          <button onClick={() => { setSearching((s) => !s); setSearchQ(''); }} aria-label="Dhoondein"
            className="w-11 h-11 flex items-center justify-center text-[var(--wa4-muted)]">
            <SearchIcon size={22} />
          </button>
          <button onClick={() => setShowMenu(true)} aria-label="Menu"
            className="w-11 h-11 flex items-center justify-center text-[var(--wa4-muted)]">
            <DotsIcon size={20} />
          </button>
        </div>
        {searching && (
          <div className="px-4 pb-2.5">
            <input
              autoFocus
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Is chat me dhoondhein..."
              className="w-full h-10 px-4 rounded-full bg-[#0b141a] text-[14px] text-[var(--wa4-text)] placeholder:text-[var(--wa4-muted)] outline-none"
            />
            {searchHits.length > 0 && (
              <div className="mt-1.5 max-h-44 overflow-y-auto rounded-xl bg-[var(--wa4-sheet)] shadow-[var(--wa4-shadow)]">
                {searchHits.slice(0, 10).map((m) => (
                  <button key={m.id} onClick={() => jumpTo(m.id)}
                    className="wa4-row w-full text-left px-4 py-2.5 text-[14px] text-[var(--wa4-text)] truncate border-b border-[var(--wa4-divider)]">
                    <span className="text-[var(--wa4-muted)] text-[12px]">{m.senderName}: </span>{bubblePreview(m)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* ============ PINNED BAR ============ */}
      {pinned.length > 0 && (
        <button
          onClick={() => jumpTo(pinned[0].id)}
          className="flex items-center gap-2.5 px-4 py-2 bg-[var(--wa4-header)] border-b border-[var(--wa4-divider)] text-left"
        >
          <span className="text-[var(--wa4-accent)]"><PinIcon size={16} /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-[11px] font-semibold text-[var(--wa4-accent)] uppercase tracking-wide">Pinned</span>
            <span className="block text-[13px] text-[var(--wa4-muted)] truncate">{bubblePreview(pinned[0])}{pinned.length > 1 ? ` (+${pinned.length - 1})` : ''}</span>
          </span>
        </button>
      )}

      {/* ============ MESSAGES ============ */}
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className="flex-1 overflow-y-auto px-3 pt-2 pb-3 wa4-doodle"
      >
        {sorted.map((m, i) => {
          const prev = sorted[i - 1];
          const showDay = !prev || fmtDateDivider(prev.createdAt) !== fmtDateDivider(m.createdAt);
          const mine = m.senderId === me;
          const prevSameSender = prev && !showDay && prev.senderId === m.senderId;
          const isFirstOfGroup = !prevSameSender;
          return (
            <div key={m.id}>
              {showDay && (
                <div className="flex justify-center my-3">
                  <span className="text-[12px] font-medium text-[var(--wa4-muted)] bg-[var(--wa4-header)] px-3.5 py-[7px] rounded-lg shadow-sm uppercase tracking-wide">
                    {fmtDateDivider(m.createdAt)}
                  </span>
                </div>
              )}
              {unreadMark && unreadMark.id === m.id && (
                <div className="flex justify-center my-3">
                  <span className="text-[12px] font-bold text-[#0b141a] bg-[var(--wa4-accent)] px-4 py-[7px] rounded-full uppercase tracking-wide shadow-sm">
                    {unreadMark.count} unread message{unreadMark.count > 1 ? 's' : ''}
                  </span>
                </div>
              )}
              <MessageRow
                ref={(el: HTMLDivElement | null) => { msgRefs.current[m.id] = el; }}
                m={m}
                mine={mine}
                chat={chat}
                me={me}
                isFirstOfGroup={isFirstOfGroup}
                highlight={searching ? searchQ : ''}
                hideFwdTag={hideFwdTag}
                onReply={() => doReply(m)}
                onLongPress={() => setActionMsg(m)}
                onVote={(idx) => backend.votePoll(chat.id, m.id, idx).catch(() => {})}
                onReact={(emoji) => doReact(m, emoji)}
                onOpenImage={(url, caption) => setViewer({ url, caption })}
              />
            </div>
          );
        })}
        {typingNames.length > 0 && (
          <div className="flex justify-start mb-1.5 wa4-fade-in">
            <div className="bg-[var(--wa4-bubble-in)] rounded-lg rounded-tl-none px-4 py-3.5 shadow-sm flex gap-[4px] items-center">
              <span className="wa4-typing-dot" /><span className="wa4-typing-dot" /><span className="wa4-typing-dot" />
            </div>
          </div>
        )}
        {sorted.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-10">
            <div className="w-24 h-24 rounded-full bg-[var(--wa4-header)] flex items-center justify-center mb-5">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#25d366" strokeWidth="1.5" strokeLinecap="round">
                <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />
              </svg>
            </div>
            <p className="text-[16px] font-semibold text-[var(--wa4-text)] mb-1">Abhi khaali hai</p>
            <p className="text-[var(--wa4-muted)] text-[14px]">Pehla message bhejein — baat shuru karein</p>
          </div>
        )}
      </div>

      {/* ============ REPLY PREVIEW ============ */}
      {replyTo && (
        <div className="bg-[var(--wa4-header)] pl-4 pr-2 py-2 mx-3 mb-1 rounded-lg flex items-center gap-3 border-l-4 border-[var(--wa4-accent)]">
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-semibold text-[var(--wa4-accent)]">{replyTo.senderName}</span>
            <span className="block text-[13px] text-[var(--wa4-muted)] truncate">{replyTo.text}</span>
          </span>
          <button onClick={() => setReplyTo(null)} aria-label="Reply hatayein"
            className="w-11 h-11 flex items-center justify-center text-[var(--wa4-muted)] shrink-0">
            <XIcon size={17} />
          </button>
        </div>
      )}

      {/* Link preview while composing */}
      {composeUrl && (
        <div className="px-3 pb-1.5 wa4-fade-in">
          <LinkPreviewCard url={composeUrl} compact />
        </div>
      )}

      {/* ============ INPUT BAR ============ */}
      <div className="px-2 pb-2 pt-1 wa4-safe-bottom bg-transparent">
        <div className="flex items-end gap-2">
          <div className="flex-1 flex items-end bg-[var(--wa4-input)] rounded-[26px] min-h-[50px] pl-1 pr-1.5 py-1">
            <textarea
              value={input}
              onChange={(e) => onInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
              placeholder="Message likhein"
              rows={1}
              className="flex-1 bg-transparent outline-none text-[16px] text-[var(--wa4-text)] placeholder:text-[var(--wa4-muted)] resize-none max-h-[110px] py-2.5 pl-3 leading-6"
            />
            <button onClick={() => { tapHaptic(); setShowAttach(true); }} aria-label="Attach"
              className="w-11 h-11 flex items-center justify-center text-[var(--wa4-muted)] shrink-0">
              <PaperclipIcon size={24} />
            </button>
            {!input.trim() && (
              <button onClick={() => { tapHaptic(); setShowCamera(true); }} aria-label="Camera"
                className="w-11 h-11 flex items-center justify-center text-[var(--wa4-muted)] shrink-0">
                <CameraIcon size={24} />
              </button>
            )}
          </div>
          {input.trim() ? (
            <button
              onClick={sendText}
              disabled={sending}
              aria-label="Bhejein"
              className="wa4-fab w-12 h-12 rounded-full bg-[var(--wa4-accent)] text-white flex items-center justify-center shrink-0 disabled:opacity-60 shadow-[var(--wa4-shadow)]"
            >
              <SendIcon size={21} />
            </button>
          ) : (
            <MicButton onDone={sendVoice} />
          )}
        </div>
      </div>

      <input ref={galleryRef} type="file" accept="image/*,video/*" className="hidden" onChange={onGallery} />
      <input ref={fileRef} type="file" className="hidden" onChange={onFile} />

      {/* ============ ATTACH SHEET (WhatsApp style grid) ============ */}
      <BottomSheet open={showAttach} onClose={() => setShowAttach(false)} title="Share karein">
        <div className="px-6 pb-8 pt-2 grid grid-cols-3 gap-y-5">
          <AttachBtn color="#7f66ff" label="Document" onClick={() => { setShowAttach(false); fileRef.current?.click(); }}>
            <DocIcon size={26} />
          </AttachBtn>
          <AttachBtn color="#ff5c8a" label="Camera" onClick={() => { setShowAttach(false); setShowCamera(true); }}>
            <CameraIcon size={26} />
          </AttachBtn>
          <AttachBtn color="#9b59b6" label="Gallery" onClick={() => { setShowAttach(false); galleryRef.current?.click(); }}>
            <GalleryIcon size={26} />
          </AttachBtn>
          <AttachBtn color="#25d366" label="Poll" onClick={() => { setShowAttach(false); setShowPoll(true); }}>
            <PollIcon size={26} />
          </AttachBtn>
          <AttachBtn color="#4aa3f0" label="Contact" onClick={() => { setShowAttach(false); setShowContact(true); }}>
            <ContactIcon size={26} />
          </AttachBtn>
          <AttachBtn color="#00a884" label="Location" onClick={() => { setShowAttach(false); setShowLocation(true); }}>
            <LocationIcon size={26} />
          </AttachBtn>
        </div>
      </BottomSheet>

      {/* ============ CHAT MENU ============ */}
      <BottomSheet open={showMenu} onClose={() => setShowMenu(false)} title="Chat options">
        <div className="pb-6 pt-1">
          <SheetRow label="Chat info" sub={chat.type === 'group' ? 'Members dekhein' : 'Profile dekhein'}
            onClick={() => { setShowMenu(false); setShowInfo(true); }}
            icon={<ContactIcon size={22} />} />
          <SheetRow label={muted ? 'Unmute karein' : 'Mute karein'} onClick={toggleMute}
            icon={<MuteIcon size={22} muted={muted} />} />
          <SheetRow label={isFavorite(chat.id) ? 'Favorite se hatayein' : 'Favorite banayein'}
            onClick={() => { setShowMenu(false); onToggleFavorite(chat.id); }}
            icon={<HeartIcon size={22} filled={isFavorite(chat.id)} />} />
          <SheetRow label={isChatLocked(chat.id) ? 'Unlock karein' : 'Lock karein'} sub="PIN se mehfooz"
            onClick={() => { setShowMenu(false); onToggleLock(chat); }}
            icon={<LockIcon size={22} />} />
          <SheetRow label="Schedule message" sub="Baad me bhejein"
            onClick={() => { setShowMenu(false); setShowSchedule(true); }}
            icon={<ClockIcon size={22} />} />
          <SheetRow label="Self-destruct message" sub="Timer ke baad gayab"
            onClick={() => { setShowMenu(false); setShowSelfDestruct(true); }}
            icon={<TrashIcon size={22} />} />
          {otherId && (
            <SheetRow label={blocked ? 'Unblock karein' : 'Block karein'} danger={!blocked}
              onClick={() => { setShowMenu(false); onToggleBlock(chat); }}
              icon={<BlockIcon size={22} />} />
          )}
        </div>
      </BottomSheet>

      {/* ============ CHAT INFO ============ */}
      <BottomSheet open={showInfo} onClose={() => setShowInfo(false)} title="Chat info">
        <div className="px-5 pb-6">
          <div className="flex flex-col items-center py-4">
            <Avatar name={title} photoURL={chatPhoto(chat, me)} size={88} />
            <p className="mt-3 text-[19px] font-semibold text-[var(--wa4-text)] text-center">{title}</p>
            <p className="text-[13px] text-[var(--wa4-muted)] mt-0.5">{subtitle}</p>
            {chat.description && <p className="text-[14px] text-[var(--wa4-muted)] mt-2 text-center">{chat.description}</p>}
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              <span className="px-3 py-1.5 rounded-full bg-[var(--wa4-accent-dim)] text-[var(--wa4-accent)] text-[13px] font-semibold">
                {sorted.length} messages
              </span>
              {muted && (
                <span className="px-3 py-1.5 rounded-full bg-[var(--wa4-input)] text-[var(--wa4-muted)] text-[13px] font-medium">Muted</span>
              )}
              {isChatLocked(chat.id) && (
                <span className="px-3 py-1.5 rounded-full bg-[var(--wa4-input)] text-[var(--wa4-muted)] text-[13px] font-medium">Locked</span>
              )}
            </div>
          </div>
          {chat.type === 'group' && (
            <>
              <p className="text-[13px] font-semibold text-[var(--wa4-muted)] mb-1 uppercase tracking-wide">{chat.participants.length} members</p>
              {chat.participants.map((pid) => {
                const p = chat.participantProfiles[pid];
                const isAdmin = (chat.adminIds || []).includes(pid);
                const isMeAdmin = (chat.adminIds || []).includes(me);
                return (
                  <div key={pid} className="flex items-center gap-3 py-2">
                    <Avatar name={p?.displayName || '?'} photoURL={p?.photoURL} size={44} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] text-[var(--wa4-text)] truncate">{pid === me ? 'Aap' : p?.displayName || 'User'}</span>
                      {isAdmin && <span className="text-[12px] text-[var(--wa4-accent)]">Group admin</span>}
                    </span>
                    {isMeAdmin && pid !== me && (
                      <div className="flex gap-1">
                        {!isAdmin && (
                          <button onClick={() => backend.makeAdmin(chat.id, pid).catch(() => {})}
                            className="text-[12px] text-[var(--wa4-accent)] px-2 py-1.5">Admin</button>
                        )}
                        <button onClick={() => backend.removeMember(chat.id, pid).catch(() => {})}
                          className="text-[12px] text-[var(--wa4-danger)] px-2 py-1.5">Nikalein</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </BottomSheet>

      {/* ============ MESSAGE LONG-PRESS MENU ============ */}
      <BottomSheet open={!!actionMsg} onClose={() => { setActionMsg(null); setReaders(null); }}
        title={actionMsg ? bubblePreview(actionMsg) : ''}>
        {actionMsg && (
          <div className="pb-6 pt-1">
            {/* quick reactions */}
            <div className="flex justify-around px-6 py-3 mb-1 bg-[var(--wa4-input)] rounded-2xl mx-5">
              {REACT_EMOJIS.map((e) => {
                const mine2 = (actionMsg.reactions?.[e] || []).includes(me);
                return (
                  <button key={e} onClick={() => { doReact(actionMsg, e); tapHaptic(); }}
                    className={`text-[28px] leading-none p-1 rounded-full ${mine2 ? 'bg-[var(--wa4-accent-dim)] scale-110' : ''}`}>
                    {e}
                  </button>
                );
              })}
            </div>
            <SheetRow label="Jawab dein" onClick={() => doReply(actionMsg)} icon={<ReplyIcon size={22} />} />
            {actionMsg.text && <SheetRow label="Copy karein" onClick={() => doCopy(actionMsg)} icon={<CopyIcon size={22} />} />}
            <SheetRow label="Forward karein" onClick={() => setForwardMsg(actionMsg)} icon={<ForwardIcon size={22} />} />
            <SheetRow label={starredIds.has(actionMsg.id) ? 'Unstar karein' : 'Star karein'} onClick={() => doStar(actionMsg)}
              icon={<StarIcon size={22} filled={starredIds.has(actionMsg.id)} />} />
            <SheetRow label={actionMsg.isPinned ? 'Unpin karein' : 'Pin karein'} onClick={() => doPin(actionMsg)}
              icon={<PinIcon size={22} />} />
            {actionMsg.senderId === me && (
              <SheetRow label="Info" sub="Read receipts dekhein" onClick={() => doInfo(actionMsg)} icon={<EyeIcon size={22} />} />
            )}
            {readers !== null && (
              <div className="px-5 py-2 bg-[var(--wa4-input)] rounded-xl mx-5 mb-2">
                {readers.length === 0
                  ? <p className="text-[13px] text-[var(--wa4-muted)] py-1">Abhi kisi ne nahi dekha</p>
                  : readers.map((r) => (
                    <div key={r.userId} className="flex items-center justify-between py-1.5">
                      <span className="text-[14px] text-[var(--wa4-text)]">{r.displayName}</span>
                      <span className="text-[12px] text-[var(--wa4-muted)]">{fmtTime(r.readAt)}</span>
                    </div>
                  ))}
              </div>
            )}
            <SheetRow label="Delete karein" danger sub="Sirf mere liye" onClick={() => doDelete(actionMsg, false)}
              icon={<TrashIcon size={22} />} />
            {actionMsg.senderId === me && (
              <SheetRow label="Sab ke liye delete" danger onClick={() => doDelete(actionMsg, true)}
                icon={<TrashIcon size={22} />} />
            )}
          </div>
        )}
      </BottomSheet>

      {/* ============ FORWARD PICKER ============ */}
      <BottomSheet open={!!forwardMsg} onClose={() => setForwardMsg(null)} title="Forward karein">
        <div className="pb-6 max-h-[55dvh] overflow-y-auto">
          {chats.filter((c) => c.id !== chat.id).map((c) => (
            <button key={c.id} onClick={() => doForwardPick(c)}
              className="wa4-row w-full flex items-center gap-3 px-5 py-2.5 text-left">
              <Avatar name={chatDisplayName(c, me)} photoURL={chatPhoto(c, me)} size={46} />
              <span className="text-[15px] text-[var(--wa4-text)] truncate">{chatDisplayName(c, me)}</span>
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* ============ POLL CREATOR ============ */}
      <PollSheet open={showPoll} onClose={() => setShowPoll(false)}
        onCreate={async (q, opts) => {
          setShowPoll(false);
          try { await backend.createPoll(chat.id, q, opts); sendHaptic(); } catch { /* ignore */ }
        }} />

      {/* ============ SCHEDULE MESSAGE ============ */}
      <ScheduleSheet open={showSchedule} onClose={() => setShowSchedule(false)}
        onSchedule={async (text, at) => {
          setShowSchedule(false);
          try {
            await backend.scheduleMessage(chat.id, { type: 'text', text }, at);
            sendHaptic();
          } catch { /* ignore */ }
        }} />

      {/* ============ SELF DESTRUCT ============ */}
      <BottomSheet open={showSelfDestruct} onClose={() => setShowSelfDestruct(false)} title="Self-destruct message">
        <div className="pb-6 pt-1">
          <p className="px-5 text-[13px] text-[var(--wa4-muted)] mb-2">
            Neeche likha message is waqt ke baad khud gayab ho jayega.
          </p>
          {[
            { label: '10 second', secs: 10 },
            { label: '1 minute', secs: 60 },
            { label: '1 ghanta', secs: 3600 },
          ].map((o) => (
            <SheetRow key={o.secs} label={o.label} onClick={async () => {
              const text = input.trim();
              setShowSelfDestruct(false);
              if (!text) return;
              try {
                await backendV2x.sendSelfDestructMessage(chat.id, text, o.secs);
                setInput('');
                backendV2x.clearDraft?.(chat.id).catch(() => {});
                sendHaptic();
              } catch { /* ignore */ }
            }} icon={<TrashIcon size={22} />} />
          ))}
        </div>
      </BottomSheet>

      {/* ============ CONTACT SHARE ============ */}
      <ContactSheet open={showContact} onClose={() => setShowContact(false)}
        onSend={async (name, phone) => {
          setShowContact(false);
          try {
            await backendV2x.sendContact(chat.id, { name, phone });
            sendHaptic();
          } catch { /* ignore */ }
        }} />

      {/* ============ LOCATION ============ */}
      <LocationSheet open={showLocation} onClose={() => setShowLocation(false)}
        onSendCurrent={async () => {
          setShowLocation(false);
          navigator.geolocation?.getCurrentPosition(async (pos) => {
            try {
              await backend.sendMessage(chat.id, {
                type: 'location', text: '',
                lat: pos.coords.latitude, lng: pos.coords.longitude,
              } as SendInput);
              sendHaptic();
            } catch { /* ignore */ }
          });
        }}
        onSendLive={async (mins) => {
          setShowLocation(false);
          navigator.geolocation?.getCurrentPosition(async (pos) => {
            try {
              await backendV2x.sendLiveLocation(chat.id, pos.coords.latitude, pos.coords.longitude, mins);
              sendHaptic();
            } catch { /* ignore */ }
          });
        }} />

      {/* ============ FULLSCREEN PHOTO VIEWER ============ */}
      {viewer && (
        <div className="fixed inset-0 z-[80] bg-black flex flex-col wa4-fade-in" onClick={() => setViewer(null)}>
          <div className="wa4-safe-top flex items-center justify-between px-2 h-[60px]">
            <button aria-label="Band karein" className="w-11 h-11 flex items-center justify-center text-white"
              onClick={() => setViewer(null)}>
              <XIcon size={24} />
            </button>
            <a href={viewer.url} download target="_blank" rel="noreferrer" aria-label="Download"
              className="w-11 h-11 flex items-center justify-center text-white" onClick={(e) => e.stopPropagation()}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
            </a>
          </div>
          <div className="flex-1 flex items-center justify-center min-h-0 px-2">
            <img src={viewer.url} alt="" className="max-w-full max-h-full object-contain" />
          </div>
          {viewer.caption && (
            <p className="wa4-safe-bottom text-center text-white/90 text-[14px] px-6 py-4">{viewer.caption}</p>
          )}
        </div>
      )}

      {/* v2 media overlays */}
      <div className="mv2" data-theme="dark">
        {showCamera && (
          <CameraCapture
            onClose={() => setShowCamera(false)}
            onSend={(file, caption) => { setShowCamera(false); setPendingPhoto({ file, caption }); }}
          />
        )}
        {pendingPhoto && (
          <PhotoEditor
            file={pendingPhoto.file}
            initialCaption={pendingPhoto.caption}
            onClose={() => setPendingPhoto(null)}
            onSend={sendEditedPhoto}
          />
        )}
        {pendingVideo && (
          <VideoTrimmer
            file={pendingVideo}
            onClose={() => setPendingVideo(null)}
            onSend={sendTrimmedVideo}
          />
        )}
      </div>
    </div>
  );
}

function AttachBtn({ color, label, onClick, children }: {
  color: string; label: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={() => { tapHaptic(); onClick(); }} className="flex flex-col items-center gap-2">
      <span className="w-[52px] h-[52px] rounded-full flex items-center justify-center text-white wa4-fab"
        style={{ background: color }}>
        {children}
      </span>
      <span className="text-[12.5px] text-[var(--wa4-muted)]">{label}</span>
    </button>
  );
}

/** Single message row: swipe-to-reply + long-press */
const MessageRow = React.forwardRef<HTMLDivElement, {
  m: ChatMessage; mine: boolean; chat: Chat; me: string;
  isFirstOfGroup: boolean; highlight: string; hideFwdTag: boolean;
  onReply: () => void; onLongPress: () => void; onVote: (idx: number) => void;
  onReact: (emoji: string) => void; onOpenImage: (url: string, caption: string) => void;
}>(function MessageRow({
  m, mine, chat, me, isFirstOfGroup, highlight, hideFwdTag,
  onReply, onLongPress, onVote, onReact, onOpenImage, ...rest
}, ref) {
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swiped = useRef(false);

  const touchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiped.current = false;
    longTimer.current = setTimeout(() => { onLongPress(); swiped.current = true; tapHaptic(); }, 500);
  };
  const touchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (Math.abs(dy) > 30 || Math.abs(dx) > 10) {
      if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null; }
    }
    if (dx > 40 && Math.abs(dy) < 40 && !mine) setSwipeX(Math.min(64, dx - 40));
    else if (dx < -40 && Math.abs(dy) < 40 && mine) setSwipeX(Math.max(-64, dx + 40));
  };
  const touchEnd = () => {
    if (longTimer.current) { clearTimeout(longTimer.current); longTimer.current = null; }
    if (Math.abs(swipeX) >= 52 && !swiped.current) onReply();
    setSwipeX(0);
  };

  const reactions = Object.entries(m.reactions || {}).filter(([, ids]) => ids.length > 0);

  return (
    <div
      {...rest}
      ref={ref}
      className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-[3px] wa4-msg-in`}
      onTouchStart={touchStart}
      onTouchMove={touchMove}
      onTouchEnd={touchEnd}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
    >
      <div
        className={`relative max-w-[82%] rounded-lg shadow-[0_1px_1px_rgba(0,0,0,0.25)] ${
          mine ? 'bg-[var(--wa4-bubble-out)]' : 'bg-[var(--wa4-bubble-in)]'
        } ${isFirstOfGroup ? (mine ? 'rounded-tr-sm' : 'rounded-tl-sm') : ''}`}
        style={{ transform: swipeX ? `translateX(${swipeX}px)` : undefined, transition: swipeX ? 'none' : 'transform 0.15s' }}
      >
        {/* tail */}
        {isFirstOfGroup && (
          <svg className={mine ? 'wa4-tail-out' : 'wa4-tail-in'} viewBox="0 0 8 13" aria-hidden>
            <path d="M0 0h8C5.5 1.5 3 5 1.2 13H0V0z" fill="currentColor" />
          </svg>
        )}
        <div className="px-2 pt-[5px] pb-[4px]">
          {!mine && chat.type === 'group' && !m.deletedEveryone && (
            <p className="text-[13px] font-semibold leading-tight mb-[1px]" style={{ color: senderColor(m.senderId) }}>
              {m.senderName}
            </p>
          )}
          {m.replyTo && !m.deletedEveryone && (
            <div className={`rounded-[6px] px-2 py-[5px] mb-1 border-l-[3px] overflow-hidden ${mine ? 'bg-black/20 border-white/50' : 'bg-black/25 border-[var(--wa4-accent)]'}`}>
              <p className={`text-[12.5px] font-semibold leading-tight ${mine ? 'text-white/90' : 'text-[var(--wa4-accent)]'}`}>
                {m.replyTo.senderName}
              </p>
              <p className={`text-[12.5px] leading-snug truncate ${mine ? 'text-white/70' : 'text-[var(--wa4-muted)]'}`}>
                {m.replyTo.text}
              </p>
            </div>
          )}
          {m.forwarded && !hideFwdTag && !m.deletedEveryone && (
            <p className={`flex items-center gap-1 text-[11.5px] italic mb-[1px] ${mine ? 'text-white/70' : 'text-[var(--wa4-muted)]'}`}>
              <ForwardIcon size={13} />
              {(m.forwardCount || 0) >= 5 ? 'Forwarded many times' : 'Forwarded'}
            </p>
          )}
          <MessageBody
            m={m} mine={mine} me={me} chat={chat} highlight={highlight}
            onVote={onVote} onOpenImage={onOpenImage}
          />
          {/* reactions display */}
          {reactions.length > 0 && !m.deletedEveryone && (
            <div className="flex flex-wrap gap-1 mt-1">
              {reactions.map(([emoji, ids]) => (
                <button
                  key={emoji}
                  onClick={(e) => { e.stopPropagation(); onReact(emoji); }}
                  className={`flex items-center gap-1 px-1.5 py-[3px] rounded-full text-[13px] leading-none border ${
                    ids.includes(me)
                      ? 'bg-[var(--wa4-accent-dim)] border-[var(--wa4-accent)]'
                      : 'bg-black/20 border-white/10'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className={`text-[11px] font-semibold ${mine ? 'text-white/80' : 'text-[var(--wa4-muted)]'}`}>{ids.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

/** Timestamp tucked inside bubble bottom-right (WhatsApp style float) */
function MetaTuck({ m, mine, chat }: { m: ChatMessage; mine: boolean; chat: Chat }) {
  return (
    <span className="float-right flex items-center gap-1 ml-2 mt-[8px] select-none" contentEditable={false}>
      {m.editedAt && (
        <span className={`text-[10px] italic ${mine ? 'text-white/60' : 'text-[var(--wa4-muted)]'}`}>edited</span>
      )}
      <span className={`text-[11px] tabular-nums ${mine ? 'text-white/70' : 'text-[var(--wa4-muted)]'}`}>
        {fmtTime(m.createdAt)}
      </span>
      {mine && (
        <span className="inline-flex"><Ticks state={msgTick(m, chat)} /></span>
      )}
    </span>
  );
}

function MessageBody({ m, mine, me, chat, highlight, onVote, onOpenImage }: {
  m: ChatMessage; mine: boolean; me: string; chat: Chat; highlight: string;
  onVote: (idx: number) => void; onOpenImage: (url: string, caption: string) => void;
}) {
  const textCls = `text-[15.5px] leading-[1.38] whitespace-pre-wrap break-words ${mine ? 'text-white' : 'text-[var(--wa4-text)]'}`;
  const isVideo = !!m.mediaURL && /\.(webm|mp4|mov)(\?|$)/i.test(m.mediaURL);

  if (m.deletedEveryone) {
    return (
      <p className="flex items-center gap-1.5 text-[14px] italic text-[var(--wa4-muted)] py-0.5 pr-1">
        <BlockIcon size={15} />
        Ye message delete kar diya gaya
        <MetaTuck m={m} mine={mine} chat={chat} />
      </p>
    );
  }

  if (m.type === 'image' && m.mediaURL) {
    return (
      <div className="mb-[1px]">
        <button onClick={(e) => { e.stopPropagation(); if (!isVideo) onOpenImage(m.mediaURL!, m.text || ''); }}
          className="block relative rounded-[6px] overflow-hidden -mx-[3px]">
          {isVideo ? (
            <video src={m.mediaURL} controls playsInline preload="metadata" className="max-h-72 w-full bg-black" />
          ) : (
            <img src={m.mediaURL} alt="" className="max-h-72 w-full object-cover" loading="lazy" draggable={false} />
          )}
          {!isVideo && (
            <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-black/60 rounded px-1.5 py-[3px]">
              <span className="text-[11px] text-white tabular-nums">{fmtTime(m.createdAt)}</span>
              {mine && <Ticks state={msgTick(m, chat)} />}
            </span>
          )}
        </button>
        {m.text ? (
          <p className={textCls + ' mt-1'}>{highlight ? hi(m.text, highlight) : m.text}{isVideo && <MetaTuck m={m} mine={mine} chat={chat} />}</p>
        ) : isVideo ? (
          <span className="flex justify-end"><MetaTuck m={m} mine={mine} chat={chat} /></span>
        ) : null}
      </div>
    );
  }

  if (m.type === 'audio' && m.mediaURL) {
    return (
      <div>
        <VoicePlayer url={m.mediaURL} duration={m.duration} mine={mine} />
        <span className="flex justify-end"><MetaTuck m={m} mine={mine} chat={chat} /></span>
      </div>
    );
  }

  if (m.type === 'file' && m.mediaURL) {
    return (
      <div>
        <a href={m.mediaURL} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-3 py-1.5 min-w-[190px]">
          <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${mine ? 'bg-white/15 text-white' : 'bg-[var(--wa4-accent-dim)] text-[var(--wa4-accent)]'}`}>
            <DocIcon size={22} />
          </span>
          <span className="min-w-0">
            <span className={`block text-[14px] font-medium truncate ${mine ? 'text-white' : 'text-[var(--wa4-text)]'}`}>
              {m.fileName || 'Document'}
            </span>
            <span className={`text-[12px] ${mine ? 'text-white/70' : 'text-[var(--wa4-muted)]'}`}>
              {m.fileSize ? `${(m.fileSize / 1024).toFixed(0)} KB` : ''} · kholein
            </span>
          </span>
        </a>
        <span className="flex justify-end"><MetaTuck m={m} mine={mine} chat={chat} /></span>
      </div>
    );
  }

  if (m.type === 'poll' && m.poll) {
    const total = Object.values(m.poll.votes || {}).reduce((a, v) => a + v.length, 0);
    return (
      <div className="min-w-[215px] py-1">
        <p className={`flex items-center gap-1.5 text-[15px] font-semibold mb-2 ${mine ? 'text-white' : 'text-[var(--wa4-text)]'}`}>
          <span className={mine ? 'text-white/80' : 'text-[var(--wa4-accent)]'}><PollIcon size={17} /></span>
          {highlight ? hi(m.poll.question, highlight) : m.poll.question}
        </p>
        {m.poll.options.map((opt, i) => {
          const votes = (m.poll!.votes?.[String(i)] || []).length;
          const pct = total ? Math.round((votes / total) * 100) : 0;
          const voted = (m.poll!.votes?.[String(i)] || []).includes(me);
          return (
            <button key={i} onClick={(e) => { e.stopPropagation(); onVote(i); }} className="w-full text-left mb-1.5">
              <div className={`relative rounded-lg px-2.5 py-2 overflow-hidden ${mine ? 'bg-black/20' : 'bg-black/15'} ${voted ? 'ring-1 ring-[var(--wa4-accent)]' : ''}`}>
                <div className="absolute inset-y-0 left-0 bg-[var(--wa4-accent)]/25" style={{ width: `${pct}%` }} />
                <span className={`relative text-[14px] ${mine ? 'text-white' : 'text-[var(--wa4-text)]'}`}>{opt}</span>
                <span className={`relative float-right text-[12px] font-semibold ${mine ? 'text-white/80' : 'text-[var(--wa4-muted)]'}`}>{pct}%</span>
              </div>
            </button>
          );
        })}
        <p className={`text-[11px] ${mine ? 'text-white/60' : 'text-[var(--wa4-muted)]'}`}>
          {total} vote{total !== 1 ? 's' : ''} · tap karke vote karein
          {m.pollDeadline ? ` · ${new Date(m.pollDeadline) < new Date() ? 'band ho gayi' : 'deadline: ' + fmtTime(m.pollDeadline)}` : ''}
        </p>
        <span className="flex justify-end"><MetaTuck m={m} mine={mine} chat={chat} /></span>
      </div>
    );
  }

  if (m.type === 'contact' && m.contact) {
    return (
      <div className="min-w-[200px]">
        <div className="flex items-center gap-3 py-1.5">
          <Avatar name={m.contact.name} size={44} />
          <span className="min-w-0">
            <span className={`block text-[15px] font-medium truncate ${mine ? 'text-white' : 'text-[var(--wa4-text)]'}`}>{m.contact.name}</span>
            {(m.contact.phone || m.contact.email) && (
              <span className={`block text-[13px] truncate ${mine ? 'text-white/70' : 'text-[var(--wa4-muted)]'}`}>
                {m.contact.phone || m.contact.email}
              </span>
            )}
          </span>
        </div>
        <span className="flex justify-end"><MetaTuck m={m} mine={mine} chat={chat} /></span>
      </div>
    );
  }

  if (m.type === 'location' && m.lat !== undefined && m.lng !== undefined) {
    const live = m.locationExpiresAt && m.locationExpiresAt > Date.now();
    return (
      <div className="min-w-[210px]">
        <a href={`https://maps.google.com/?q=${m.lat},${m.lng}`} target="_blank" rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`flex items-center gap-3 rounded-lg p-2.5 ${mine ? 'bg-black/20' : 'bg-black/15'}`}>
          <span className="w-11 h-11 rounded-full bg-[var(--wa4-accent)] text-white flex items-center justify-center shrink-0">
            <LocationIcon size={22} />
          </span>
          <span>
            <span className={`block text-[14px] font-semibold ${mine ? 'text-white' : 'text-[var(--wa4-text)]'}`}>
              {live ? 'Live location' : 'Location'}
            </span>
            <span className={`block text-[12px] ${mine ? 'text-white/70' : 'text-[var(--wa4-muted)]'}`}>Map me kholein</span>
          </span>
        </a>
        <span className="flex justify-end"><MetaTuck m={m} mine={mine} chat={chat} /></span>
      </div>
    );
  }

  const firstUrl = m.type === 'text' ? extractUrls(m.text)[0] : undefined;
  return (
    <>
      <p className={textCls}>
        {linkify(m.text, mine, highlight)}
        <MetaTuck m={m} mine={mine} chat={chat} />
      </p>
      {firstUrl && (
        <span className="block mt-1" onClick={(e) => e.stopPropagation()}>
          <LinkPreviewCard url={firstUrl} mine={mine} compact />
        </span>
      )}
    </>
  );
}

/* ---------------- Poll creator sheet ---------------- */
function PollSheet({ open, onClose, onCreate }: {
  open: boolean; onClose: () => void; onCreate: (q: string, opts: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState(['', '']);
  useEffect(() => { if (open) { setQ(''); setOpts(['', '']); } }, [open ]);
  const valid = q.trim().length > 0 && opts.filter((o) => o.trim()).length >= 2;
  return (
    <BottomSheet open={open} onClose={onClose} title="Poll banayein">
      <div className="px-5 pb-6">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sawal likhein"
          className="w-full h-12 px-4 rounded-xl bg-[var(--wa4-input)] outline-none text-[15px] text-[var(--wa4-text)] placeholder:text-[var(--wa4-muted)] mb-2" />
        {opts.map((o, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input value={o} onChange={(e) => setOpts((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`Option ${i + 1}`}
              className="flex-1 h-12 px-4 rounded-xl bg-[var(--wa4-input)] outline-none text-[15px] text-[var(--wa4-text)] placeholder:text-[var(--wa4-muted)]" />
            {opts.length > 2 && (
              <button onClick={() => setOpts((arr) => arr.filter((_, j) => j !== i))}
                className="w-12 h-12 rounded-xl bg-[var(--wa4-input)] text-[var(--wa4-muted)] flex items-center justify-center shrink-0"
                aria-label="Option hatayein">
                <XIcon size={18} />
              </button>
            )}
          </div>
        ))}
        {opts.length < 6 && (
          <button onClick={() => setOpts((a) => [...a, ''])}
            className="text-[14px] text-[var(--wa4-accent)] font-medium py-2 min-h-[44px] inline-flex items-center">+ Option add karein</button>
        )}
        <button onClick={() => onCreate(q.trim(), opts.map((o) => o.trim()).filter(Boolean))} disabled={!valid}
          className="w-full mt-3 h-12 rounded-full bg-[var(--wa4-accent)] text-[#0b141a] font-semibold disabled:opacity-40">
          Poll bhejein
        </button>
      </div>
    </BottomSheet>
  );
}

/* ---------------- Schedule sheet ---------------- */
function ScheduleSheet({ open, onClose, onSchedule }: {
  open: boolean; onClose: () => void; onSchedule: (text: string, at: number) => void;
}) {
  const [text, setText] = useState('');
  const [dt, setDt] = useState('');
  useEffect(() => { if (open) { setText(''); setDt(''); } }, [open ]);
  const at = dt ? new Date(dt).getTime() : 0;
  const valid = text.trim().length > 0 && at > Date.now() + 60000;
  return (
    <BottomSheet open={open} onClose={onClose} title="Message schedule karein">
      <div className="px-5 pb-6">
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Message likhein" rows={3}
          className="w-full px-4 py-3 rounded-xl bg-[var(--wa4-input)] outline-none text-[15px] text-[var(--wa4-text)] placeholder:text-[var(--wa4-muted)] resize-none mb-2" />
        <input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)}
          className="w-full h-12 px-4 rounded-xl bg-[var(--wa4-input)] outline-none text-[15px] text-[var(--wa4-text)] mb-3"
          style={{ colorScheme: 'dark' }} />
        <button onClick={() => onSchedule(text.trim(), at)} disabled={!valid}
          className="w-full h-12 rounded-full bg-[var(--wa4-accent)] text-[#0b141a] font-semibold disabled:opacity-40">
          Schedule karein
        </button>
      </div>
    </BottomSheet>
  );
}

/* ---------------- Contact sheet ---------------- */
function ContactSheet({ open, onClose, onSend }: {
  open: boolean; onClose: () => void; onSend: (name: string, phone: string) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  useEffect(() => { if (open) { setName(''); setPhone(''); } }, [open ]);
  return (
    <BottomSheet open={open} onClose={onClose} title="Contact share karein">
      <div className="px-5 pb-6">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam"
          className="w-full h-12 px-4 rounded-xl bg-[var(--wa4-input)] outline-none text-[15px] text-[var(--wa4-text)] placeholder:text-[var(--wa4-muted)] mb-2" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" inputMode="tel"
          className="w-full h-12 px-4 rounded-xl bg-[var(--wa4-input)] outline-none text-[15px] text-[var(--wa4-text)] placeholder:text-[var(--wa4-muted)] mb-3" />
        <button onClick={() => name.trim() && onSend(name.trim(), phone.trim())} disabled={!name.trim()}
          className="w-full h-12 rounded-full bg-[var(--wa4-accent)] text-[#0b141a] font-semibold disabled:opacity-40">
          Contact bhejein
        </button>
      </div>
    </BottomSheet>
  );
}

/* ---------------- Location sheet ---------------- */
function LocationSheet({ open, onClose, onSendCurrent, onSendLive }: {
  open: boolean; onClose: () => void; onSendCurrent: () => void; onSendLive: (mins: number) => void;
}) {
  const [liveFor, setLiveFor] = useState<number | null>(null);
  useEffect(() => { if (open) setLiveFor(null); }, [open ]);
  return (
    <BottomSheet open={open} onClose={onClose} title="Location bhejein">
      <div className="pb-6 pt-1">
        <SheetRow label="Maujooda location" sub="Abhi ki location bhejein" onClick={onSendCurrent}
          icon={<LocationIcon size={22} />} />
        <div className="px-5 pt-2">
          <p className="text-[13px] text-[var(--wa4-muted)] mb-2">Live location kitni der ke liye?</p>
          <div className="flex gap-2">
            {[15, 60, 480].map((m) => (
              <button key={m} onClick={() => setLiveFor(m)}
                className={`flex-1 h-11 rounded-full text-[13px] font-medium ${
                  liveFor === m ? 'bg-[var(--wa4-accent)] text-[#0b141a] font-semibold' : 'bg-[var(--wa4-input)] text-[var(--wa4-muted)]'
                }`}>
                {m >= 60 ? `${m / 60} ghanta` : `${m} min`}
              </button>
            ))}
          </div>
          <button onClick={() => liveFor && onSendLive(liveFor)} disabled={!liveFor}
            className="w-full mt-3 h-12 rounded-full bg-[var(--wa4-accent)] text-[#0b141a] font-semibold disabled:opacity-40">
            Live location shuru karein
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
