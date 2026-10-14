'use client';

import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import { Ticks } from '@/components/Ticks';
import { backend } from '@/lib/backend';
import type { BackendV2 } from '@/lib/v2/types';
import type { Chat, ChatMessage, ReaderInfo, ReplyRef, UserProfile } from '@/lib/backend/types';
import { fmtDateDivider, fmtLastSeen, fmtTime } from '@/lib/format';
import BottomSheet, { SheetRow } from './BottomSheet';
import MicButton, { VoicePlayer } from './VoiceRecorder';
import CameraCapture from './CameraCapture';
import StickerPicker from './StickerPicker';
import PhotoEditor from './PhotoEditor';
import VideoTrimmer from './VideoTrimmer';
import EmptyArt from '../shared/EmptyArt';
import TypingDots from '../shared/TypingDots';
import { extractUrls, LinkPreviewCard } from '../shared/LinkPreview';
import { sendHaptic, tapHaptic } from '../shared/haptics';
import { chatDisplayName, chatPhoto } from './ChatList';

const backendV2 = backend as unknown as BackendV2;

const WALLPAPERS = [
  { id: 'doodle', label: 'Doodle' },
  { id: 'plain', label: 'Saada' },
  { id: 'waves', label: 'Waves' },
  { id: 'grid', label: 'Grid' },
];

function msgTick(m: ChatMessage, chat: Chat): 'sent' | 'delivered' | 'read' {
  const others = (m.readBy || []).filter((id) => id !== m.senderId);
  if (others.length >= Math.max(1, chat.participants.length - 1)) return 'read';
  if (others.length > 0) return 'delivered';
  return 'sent';
}

function bubblePreview(m: ChatMessage): string {
  if (m.text) return m.text.slice(0, 60);
  if (m.type === 'image' && m.mediaURL && /\.(webm|mp4|mov)(\?|$)/i.test(m.mediaURL)) return '🎬 Video';
  return m.type === 'image' ? '📷 Photo' : m.type === 'audio' ? '🎤 Voice' : m.type === 'poll' ? '📊 Poll' : '📎 File';
}

/** Search ka lafz yellow highlight karein */
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
    out.push(<mark key={k++} className="mv2-hl">{rest.slice(idx, idx + query.length)}</mark>);
    rest = rest.slice(idx + query.length);
  }
  return <>{out}</>;
}

export default function ChatScreen({
  chat,
  user,
  chats,
  wallpaperId,
  onWallpaper,
  isChatLocked,
  onToggleLock,
  isUserBlocked,
  onToggleBlock,
  onBack,
  onSelectChat,
}: {
  chat: Chat;
  user: UserProfile;
  chats: Chat[];
  wallpaperId: string;
  onWallpaper: (id: string) => void;
  isChatLocked: (id: string) => boolean;
  onToggleLock: (chat: Chat) => void;
  isUserBlocked: (userId: string) => boolean;
  onToggleBlock: (chat: Chat) => void;
  onBack: () => void;
  onSelectChat: (chat: Chat) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyRef | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showWallpaper, setShowWallpaper] = useState(false);
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
  const [lastSendAt, setLastSendAt] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const nearBottom = useRef(true);

  const me = user.id;
  const otherId = chat.type === 'direct' ? chat.participants.find((p) => p !== me) : undefined;
  const title = chatDisplayName(chat, me);

  // Messages subscription
  useEffect(() => {
    setMessages([]);
    const unsub = backend.onMessages(chat.id, (msgs) => {
      setMessages(msgs.filter((m) => !(m.deletedFor || []).includes(me)));
    });
    backend.markRead(chat.id).catch(() => {});
    return unsub;
  }, [chat.id, me]);

  // FIX (problem 4): messages hamesha created_at ascending hon — naya message neeche.
  // Backend sort karta hai, phir bhi defensive sort taake koi edge-case upar na dhakele.
  const sorted = useMemo(
    () => [...messages].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
    [messages]
  );

  // Mark read when new incoming arrives
  useEffect(() => {
    const last = sorted[sorted.length - 1];
    if (last && last.senderId !== me) backend.markRead(chat.id).catch(() => {});
  }, [sorted, chat.id, me]);

  // Mute state
  useEffect(() => {
    backend.getChatNotificationSettings(chat.id).then((s) => setMuted(s.muted)).catch(() => {});
  }, [chat.id]);

  // Draft: load once
  useEffect(() => {
    backendV2.getDraft?.(chat.id).then((d) => { if (d) setInput(d); }).catch(() => {});
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id]);

  // Typing display
  const typingNames = useMemo(() => {
    const now = Date.now();
    return Object.entries(chat.typing || {})
      .filter(([id, ts]) => id !== me && now - ts < 5000)
      .map(([id]) => chat.participantProfiles[id]?.displayName?.split(' ')[0] || 'Koi');
  }, [chat.typing, chat.participantProfiles, me]);

  const subtitle = typingNames.length > 0
    ? `${typingNames.join(', ')} likh raha hai…`
    : chat.type === 'group'
      ? `${chat.participants.length} members`
      : otherId
        ? chat.participantProfiles[otherId]?.online
          ? 'online'
          : fmtLastSeen(chat.participantProfiles[otherId]?.lastSeen || 0, false)
        : '';

  // Compose-time link preview (pehla URL)
  const composeUrl = useMemo(() => extractUrls(input)[0] || null, [input]);

  // Scroll handling
  const scrollBottom = (smooth = true) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };
  useEffect(() => {
    if (nearBottom.current) scrollBottom(false);
  }, [sorted.length, typingNames.length]);

  const onInput = (v: string) => {
    setInput(v);
    backend.setTyping(chat.id, true).catch(() => {});
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => backend.setTyping(chat.id, false).catch(() => {}), 2500);
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      const t = v.trim();
      if (t) backendV2.saveDraft?.(chat.id, t).catch(() => {});
      else backendV2.clearDraft?.(chat.id).catch(() => {});
    }, 800);
  };

  const clearDraft = () => backendV2.clearDraft?.(chat.id).catch(() => {});

  const sendText = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    const rp = replyTo;
    setInput('');
    setReplyTo(null);
    setShowPicker(false);
    try {
      await backend.sendMessage(chat.id, { type: 'text', text, replyTo: rp });
      clearDraft();
      setLastSendAt(Date.now());
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
    } catch { /* ignore */ }
  };

  const sendSticker = async (svg: string) => {
    try {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const file = new File([blob], `sticker-${Date.now()}.svg`, { type: 'image/svg+xml' });
      const up = await backend.uploadMedia(chat.id, file);
      await backend.sendMessage(chat.id, { type: 'image', text: '', mediaURL: up.url, replyTo });
      setReplyTo(null);
      setShowPicker(false);
    } catch { /* ignore */ }
  };

  const sendCameraPhoto = async (file: File, caption: string) => {
    setShowCamera(false);
    // Camera ke baad WA-style editor khulta hai (crop/text/doodle)
    setPendingPhoto({ file, caption });
  };

  const sendEditedPhoto = async (file: File, caption: string) => {
    setPendingPhoto(null);
    try {
      const up = await backend.uploadMedia(chat.id, file);
      await backend.sendMessage(chat.id, { type: 'image', text: caption, mediaURL: up.url, replyTo });
      setReplyTo(null);
      setLastSendAt(Date.now());
      sendHaptic();
    } catch { /* ignore */ }
  };

  const sendTrimmedVideo = async (file: File) => {
    setPendingVideo(null);
    try {
      const up = await backend.uploadMedia(chat.id, file);
      await backend.sendMessage(chat.id, { type: 'image', text: '', mediaURL: up.url, replyTo });
      setReplyTo(null);
      setLastSendAt(Date.now());
      sendHaptic();
    } catch { /* ignore */ }
  };

  const onGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setShowAttach(false);
    // Video → trimmer, Photo → editor (WhatsApp flow)
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
    } catch { /* ignore */ }
  };

  const vote = (m: ChatMessage, idx: number) => {
    backend.votePoll(chat.id, m.id, idx).catch(() => {});
  };

  // ---- message actions ----
  const openActions = (m: ChatMessage) => setActionMsg(m);

  const doReply = (m: ChatMessage) => {
    setReplyTo({ id: m.id, text: bubblePreview(m), senderName: m.senderId === me ? 'Aap' : m.senderName });
    setActionMsg(null);
  };
  const doCopy = (m: ChatMessage) => {
    if (m.text) navigator.clipboard?.writeText(m.text).catch(() => {});
    setActionMsg(null);
  };
  const doStar = (m: ChatMessage) => {
    backend.starMessage(m.id, true).catch(() => {});
    setActionMsg(null);
  };
  const doPin = (m: ChatMessage) => {
    (m.isPinned ? backend.unpinMessage(chat.id, m.id) : backend.pinMessage(chat.id, m.id)).catch(() => {});
    setActionMsg(null);
  };
  const doDelete = (m: ChatMessage, forEveryone: boolean) => {
    backend.deleteMessage(chat.id, m.id, forEveryone).catch(() => {});
    setActionMsg(null);
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
  }, [searchQ, searching, chat.id]);

  const jumpTo = (id: string) => {
    const el = msgRefs.current[id];
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('mv2-pop-anim');
      setTimeout(() => el.classList.remove('mv2-pop-anim'), 600);
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
    <div className="flex flex-col h-full bg-[var(--mv2-bg)]">
      {/* Header */}
      <header className="mv2-safe-top bg-[var(--mv2-header)] shadow-sm z-20">
        <div className="flex items-center gap-1 px-1 h-[60px]">
          <button onClick={onBack} aria-label="Wapas" className="w-11 h-11 flex items-center justify-center text-[var(--mv2-text)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button onClick={() => setShowInfo(true)} className="flex items-center gap-3 flex-1 min-w-0 text-left py-1">
            <Avatar name={title} photoURL={chatPhoto(chat, me)} size={42} />
            <span className="min-w-0">
              <span className="block font-semibold text-[16px] text-[var(--mv2-text)] truncate">{title}</span>
              <span className="flex items-center gap-1.5 text-[12px] text-[var(--mv2-muted)] truncate">
                {typingNames.length > 0 ? (
                  <>
                    <span className="text-[var(--mv2-accent)] font-medium truncate">{typingNames.join(', ')}</span>
                    <TypingDots size={5} color="var(--mv2-accent)" />
                  </>
                ) : (
                  subtitle
                )}
              </span>
            </span>
          </button>
          <button onClick={() => { setSearching((s) => !s); setSearchQ(''); }} aria-label="Search" className="w-11 h-11 flex items-center justify-center text-[var(--mv2-muted)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          </button>
          <button onClick={() => setShowMenu(true)} aria-label="Menu" className="w-11 h-11 flex items-center justify-center text-[var(--mv2-muted)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
          </button>
        </div>
        {searching && (
          <div className="px-4 pb-2">
            <input
              autoFocus
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Is chat me dhoondhein..."
              className="w-full h-10 px-4 rounded-full bg-[var(--mv2-input)] text-[14px] text-[var(--mv2-text)] placeholder:text-[var(--mv2-muted)] outline-none"
            />
            {searchHits.length > 0 && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-xl bg-[var(--mv2-sheet)] shadow-[var(--mv2-shadow)]">
                {searchHits.slice(0, 10).map((m) => (
                  <button key={m.id} onClick={() => jumpTo(m.id)} className="w-full text-left px-4 py-2.5 text-[14px] text-[var(--mv2-text)] truncate border-b border-[var(--mv2-divider)]">
                    <span className="text-[var(--mv2-muted)] text-[12px]">{m.senderName}: </span>{bubblePreview(m)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Messages */}
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className={`flex-1 overflow-y-auto px-3 py-2 mv2-wall-${wallpaperId}`}
      >
        {sorted.map((m, i) => {
          const prev = sorted[i - 1];
          const showDay = !prev || fmtDateDivider(prev.createdAt) !== fmtDateDivider(m.createdAt);
          const mine = m.senderId === me;
          const fresh = mine && lastSendAt > 0 && (m.createdAt || 0) >= lastSendAt - 2000;
          return (
            <div key={m.id}>
              {showDay && (
                <div className="flex justify-center my-3">
                  <span className="text-[11px] font-medium text-[var(--mv2-muted)] bg-[var(--mv2-header)] px-3 py-1.5 rounded-lg shadow-sm">
                    {fmtDateDivider(m.createdAt)}
                  </span>
                </div>
              )}
              <MessageRow
                ref={(el: HTMLDivElement | null) => { msgRefs.current[m.id] = el; }}
                m={m}
                mine={mine}
                chat={chat}
                highlight={searching ? searchQ : ''}
                fresh={fresh}
                onReply={() => doReply(m)}
                onLongPress={() => openActions(m)}
                onVote={(idx) => vote(m, idx)}
              />
            </div>
          );
        })}
        {/* WhatsApp-style typing bubble */}
        {typingNames.length > 0 && (
          <div className="flex justify-start mb-1.5 mv2-fade-anim">
            <div className="bg-[var(--mv2-bubble-in)] rounded-xl rounded-tl-sm px-4 py-3.5 shadow-sm">
              <TypingDots />
            </div>
          </div>
        )}
        {sorted.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-10">
            <EmptyArt size={150} className="mb-5 opacity-90" />
            <p className="text-[15px] font-semibold text-[var(--mv2-text)] mb-1">Abhi khaali hai</p>
            <p className="text-[var(--mv2-muted)] text-[14px]">Pehla message bhejein — baat shuru karein</p>
          </div>
        )}
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="bg-[var(--mv2-header)] px-4 py-2 flex items-center gap-3 border-l-4 border-[var(--mv2-accent)] ml-3">
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-semibold text-[var(--mv2-accent)]">{replyTo.senderName}</span>
            <span className="block text-[13px] text-[var(--mv2-muted)] truncate">{replyTo.text}</span>
          </span>
          <button onClick={() => setReplyTo(null)} aria-label="Reply hatayein" className="w-9 h-9 flex items-center justify-center text-[var(--mv2-muted)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Sticker panel */}
      {showPicker && (
        <StickerPicker
          onEmojiPick={(e) => setInput((v) => v + e)}
          onStickerSend={sendSticker}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Link preview — likhte waqt (WA style) */}
      {composeUrl && (
        <div className="px-3 pb-1.5 mv2-fade-anim">
          <LinkPreviewCard url={composeUrl} compact />
        </div>
      )}

      {/* Input bar */}
      <div className="bg-[var(--mv2-bg)] px-2 pb-2 pt-1 mv2-safe-bottom">
        <div className="flex items-end gap-1.5">
          <div className="flex-1 flex items-end bg-[var(--mv2-input)] rounded-3xl min-h-[48px] pl-1 pr-2 py-1">
            <button
              onClick={() => setShowPicker((s) => !s)}
              aria-label="Emoji"
              className={`w-11 h-11 flex items-center justify-center shrink-0 ${showPicker ? 'text-[var(--mv2-accent)]' : 'text-[var(--mv2-muted)]'}`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8" strokeLinecap="round" /><circle cx="9" cy="9.5" r="1.2" fill="currentColor" /><circle cx="15" cy="9.5" r="1.2" fill="currentColor" /></svg>
            </button>
            <textarea
              value={input}
              onChange={(e) => onInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
              placeholder="Message likhein"
              rows={1}
              className="flex-1 bg-transparent outline-none text-[16px] text-[var(--mv2-text)] placeholder:text-[var(--mv2-muted)] resize-none max-h-[110px] py-2.5 leading-6"
            />
            <button onClick={() => setShowAttach(true)} aria-label="Attach" className="w-11 h-11 flex items-center justify-center text-[var(--mv2-muted)] shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h7" transform="rotate(45 12 12)" /><path d="M21 11l-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8L13 3.5a3.7 3.7 0 0 1 5.2 5.2l-8.2 8.2a1.85 1.85 0 0 1-2.6-2.6L15 6.8" /></svg>
            </button>
            {!input.trim() && (
              <button onClick={() => setShowCamera(true)} aria-label="Camera" className="w-11 h-11 flex items-center justify-center text-[var(--mv2-muted)] shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
              </button>
            )}
          </div>
          {input.trim() ? (
            <button
              onClick={sendText}
              disabled={sending}
              aria-label="Bhejein"
              className="w-12 h-12 rounded-full bg-[var(--mv2-accent)] text-white flex items-center justify-center shrink-0 active:scale-95 transition-transform disabled:opacity-60"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 20.5l17-8.5-17-8.5v6.2L14 12 3.5 14.3z" /></svg>
            </button>
          ) : (
            <MicButton onDone={sendVoice} />
          )}
        </div>
      </div>

      <input ref={galleryRef} type="file" accept="image/*,video/*" className="hidden" onChange={onGallery} />
      <input ref={fileRef} type="file" className="hidden" onChange={onFile} />

      {/* Attach sheet */}
      <BottomSheet open={showAttach} onClose={() => setShowAttach(false)} title="Attach karein">
        <div className="px-3 pb-6 grid grid-cols-3 gap-2">
          {[
            { label: 'Camera', icon: '📷', fn: () => { setShowAttach(false); setShowCamera(true); } },
            { label: 'Gallery', icon: '🖼️', fn: () => { setShowAttach(false); galleryRef.current?.click(); } },
            { label: 'Document', icon: '📄', fn: () => { setShowAttach(false); fileRef.current?.click(); } },
          ].map((a) => (
            <button key={a.label} onClick={a.fn} className="flex flex-col items-center gap-2 py-4 rounded-xl active:bg-[var(--mv2-accent-soft)]">
              <span className="w-14 h-14 rounded-full bg-[var(--mv2-accent-soft)] flex items-center justify-center text-[26px]">{a.icon}</span>
              <span className="text-[13px] text-[var(--mv2-muted)]">{a.label}</span>
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Chat menu */}
      <BottomSheet open={showMenu} onClose={() => setShowMenu(false)} title="Chat options">
        <div className="pb-6">
          <SheetRow label="Chat info" sub={chat.type === 'group' ? 'Members dekhein' : 'Profile dekhein'} onClick={() => { setShowMenu(false); setShowInfo(true); }}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>} />
          <SheetRow label={muted ? 'Unmute karein' : 'Mute karein'} onClick={toggleMute}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 10v4h4l5 4V6l-5 4H4z" />{muted ? <path d="M16 9l5 5M21 9l-5 5" /> : <path d="M16 9a4 4 0 0 1 0 6" />}</svg>} />
          <SheetRow label="Wallpaper" sub="Chat ka background" onClick={() => { setShowMenu(false); setShowWallpaper(true); }}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 15l5-5 4 4 3-3 6 6" /></svg>} />
          <SheetRow label={isChatLocked(chat.id) ? 'Unlock karein' : 'Lock karein'} sub="PIN se mehfooz" onClick={() => { setShowMenu(false); onToggleLock(chat); }}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>} />
          {otherId && (
            <SheetRow label={blocked ? 'Unblock karein' : 'Block karein'} danger={!blocked} onClick={() => { setShowMenu(false); onToggleBlock(chat); }}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M6 6l12 12" /></svg>} />
          )}
        </div>
      </BottomSheet>

      {/* Wallpaper picker */}
      <BottomSheet open={showWallpaper} onClose={() => setShowWallpaper(false)} title="Wallpaper chunein">
        <div className="px-5 pb-6 grid grid-cols-2 gap-3">
          {WALLPAPERS.map((w) => (
            <button
              key={w.id}
              onClick={() => { onWallpaper(w.id); setShowWallpaper(false); }}
              className={`h-24 rounded-xl mv2-wall-${w.id} border-2 flex items-end justify-center pb-2 ${wallpaperId === w.id ? 'border-[var(--mv2-accent)]' : 'border-transparent'}`}
            >
              <span className="text-[12px] bg-black/50 text-white px-2 py-0.5 rounded-full">{w.label}</span>
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Chat info */}
      <BottomSheet open={showInfo} onClose={() => setShowInfo(false)} title="Chat info">
        <div className="px-5 pb-6">
          <div className="flex flex-col items-center py-4">
            <Avatar name={title} photoURL={chatPhoto(chat, me)} size={84} />
            <p className="mt-3 text-[18px] font-semibold text-[var(--mv2-text)]">{title}</p>
            <p className="text-[13px] text-[var(--mv2-muted)]">{subtitle}</p>
            {chat.description && <p className="text-[14px] text-[var(--mv2-muted)] mt-2 text-center">{chat.description}</p>}
            {/* Msg counter + status chips */}
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              <span className="px-3 py-1.5 rounded-full bg-[var(--mv2-accent-soft)] text-[var(--mv2-accent)] text-[13px] font-semibold">
                💬 {sorted.length} messages
              </span>
              {muted && (
                <span className="px-3 py-1.5 rounded-full bg-[var(--mv2-input)] text-[var(--mv2-muted)] text-[13px] font-medium">🔕 Muted</span>
              )}
              {isChatLocked(chat.id) && (
                <span className="px-3 py-1.5 rounded-full bg-[var(--mv2-input)] text-[var(--mv2-muted)] text-[13px] font-medium">🔒 Locked</span>
              )}
            </div>
          </div>
          {chat.type === 'group' && (
            <>
              <p className="text-[13px] font-semibold text-[var(--mv2-muted)] mb-2">{chat.participants.length} MEMBERS</p>
              {chat.participants.map((pid) => {
                const p = chat.participantProfiles[pid];
                const isAdmin = (chat.adminIds || []).includes(pid);
                return (
                  <div key={pid} className="flex items-center gap-3 py-2">
                    <Avatar name={p?.displayName || '?'} photoURL={p?.photoURL} size={44} />
                    <span className="flex-1">
                      <span className="block text-[15px] text-[var(--mv2-text)]">{pid === me ? 'Aap' : p?.displayName || 'User'}</span>
                      {isAdmin && <span className="text-[12px] text-[var(--mv2-accent)]">Admin</span>}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </BottomSheet>

      {/* Message long-press actions */}
      <BottomSheet open={!!actionMsg} onClose={() => { setActionMsg(null); setReaders(null); }} title={actionMsg ? bubblePreview(actionMsg) : ''}>
        {actionMsg && (
          <div className="pb-6">
            <SheetRow label="Reply" onClick={() => doReply(actionMsg)}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14l-5-5 5-5M4 9h10a6 6 0 0 1 0 12h-3" /></svg>} />
            {actionMsg.text && <SheetRow label="Copy" onClick={() => doCopy(actionMsg)}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>} />}
            <SheetRow label="Forward" onClick={() => setForwardMsg(actionMsg)}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" /></svg>} />
            <SheetRow label="Star karein" onClick={() => doStar(actionMsg)}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" /></svg>} />
            <SheetRow label={actionMsg.isPinned ? 'Unpin karein' : 'Pin karein'} onClick={() => doPin(actionMsg)}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 4h6l-1 7 3 3v2H7v-2l3-3zM12 16v5" /></svg>} />
            {actionMsg.senderId === me && (
              <SheetRow label="Read receipts" sub="Kis ne dekha" onClick={() => doInfo(actionMsg)}
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>} />
            )}
            {readers !== null && (
              <div className="px-5 py-2">
                {readers.length === 0 ? <p className="text-[13px] text-[var(--mv2-muted)]">Abhi kisi ne nahi dekha</p> :
                  readers.map((r) => (
                    <div key={r.userId} className="flex items-center justify-between py-1.5">
                      <span className="text-[14px] text-[var(--mv2-text)]">{r.displayName}</span>
                      <span className="text-[12px] text-[var(--mv2-muted)]">{fmtTime(r.readAt)}</span>
                    </div>
                  ))}
              </div>
            )}
            <SheetRow label="Delete" danger sub="Mere liye" onClick={() => doDelete(actionMsg, false)}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>} />
            {actionMsg.senderId === me && (
              <SheetRow label="Sab ke liye delete" danger onClick={() => doDelete(actionMsg, true)}
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>} />
            )}
          </div>
        )}
      </BottomSheet>

      {/* Forward picker */}
      <BottomSheet open={!!forwardMsg} onClose={() => setForwardMsg(null)} title="Forward karein">
        <div className="pb-6 max-h-[50dvh] overflow-y-auto">
          {chats.filter((c) => c.id !== chat.id).map((c) => (
            <button key={c.id} onClick={() => doForwardPick(c)} className="w-full flex items-center gap-3 px-5 py-2.5 active:bg-[var(--mv2-accent-soft)] text-left">
              <Avatar name={chatDisplayName(c, me)} photoURL={chatPhoto(c, me)} size={46} />
              <span className="text-[15px] text-[var(--mv2-text)] truncate">{chatDisplayName(c, me)}</span>
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Camera overlay */}
      {showCamera && <CameraCapture onClose={() => setShowCamera(false)} onSend={sendCameraPhoto} />}

      {/* Photo editor (WA style) */}
      {pendingPhoto && (
        <PhotoEditor
          file={pendingPhoto.file}
          initialCaption={pendingPhoto.caption}
          onClose={() => setPendingPhoto(null)}
          onSend={sendEditedPhoto}
        />
      )}

      {/* Video trimmer (WA style) */}
      {pendingVideo && (
        <VideoTrimmer
          file={pendingVideo}
          onClose={() => setPendingVideo(null)}
          onSend={sendTrimmedVideo}
        />
      )}
    </div>
  );
}

/** Single message row: swipe-to-reply + long-press */
function MessageRow({
  m, mine, chat, highlight, fresh, onReply, onLongPress, onVote, ref,
}: {
  m: ChatMessage; mine: boolean; chat: Chat;
  highlight: string; fresh: boolean;
  onReply: () => void; onLongPress: () => void; onVote: (idx: number) => void;
  ref: (el: HTMLDivElement | null) => void;
}) {
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swiped = useRef(false);

  const touchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiped.current = false;
    longTimer.current = setTimeout(() => { onLongPress(); swiped.current = true; }, 550);
  };
  const touchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (Math.abs(dy) > 30 || Math.abs(dx) > 10) {
      if (longTimer.current) clearTimeout(longTimer.current);
    }
    if (dx > 40 && Math.abs(dy) < 40 && !mine) {
      // incoming: swipe right to reply
      setSwipeX(Math.min(70, dx - 40));
    } else if (dx < -40 && Math.abs(dy) < 40 && mine) {
      // outgoing: swipe left to reply
      setSwipeX(Math.max(-70, dx + 40));
    }
  };
  const touchEnd = () => {
    if (longTimer.current) clearTimeout(longTimer.current);
    if (Math.abs(swipeX) >= 55 && !swiped.current) onReply();
    setSwipeX(0);
  };

  return (
    <div
      ref={ref}
      className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-1.5 ${fresh ? 'mv2-send-anim' : 'mv2-msg-anim'}`}
      onTouchStart={touchStart}
      onTouchMove={touchMove}
      onTouchEnd={touchEnd}
      onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
    >
      <div
        className={`max-w-[80%] rounded-xl px-2.5 pt-1.5 pb-1 shadow-sm relative ${
          mine ? 'bg-[var(--mv2-bubble-out)] rounded-tr-sm' : 'bg-[var(--mv2-bubble-in)] rounded-tl-sm'
        }`}
        style={{ transform: swipeX ? `translateX(${swipeX}px)` : undefined, transition: swipeX ? 'none' : 'transform 0.15s' }}
      >
        {!mine && chat.type === 'group' && (
          <p className="text-[12.5px] font-semibold text-[var(--mv2-accent)] mb-0.5">{m.senderName}</p>
        )}
        {m.replyTo && (
          <div className={`rounded-md px-2 py-1 mb-1 border-l-[3px] ${mine ? 'bg-black/15 border-white/60' : 'bg-black/20 border-[var(--mv2-accent)]'}`}>
            <p className={`text-[12px] font-semibold ${mine ? 'text-white/90' : 'text-[var(--mv2-accent)]'}`}>{m.replyTo.senderName}</p>
            <p className={`text-[12px] truncate ${mine ? 'text-white/70' : 'text-[var(--mv2-muted)]'}`}>{m.replyTo.text}</p>
          </div>
        )}
        {m.forwarded && <p className={`text-[11px] italic mb-0.5 ${mine ? 'text-white/70' : 'text-[var(--mv2-muted)]'}`}>↪ Forwarded</p>}
        <MessageBody m={m} mine={mine} highlight={highlight} onVote={onVote} />
        <div className={`flex items-center justify-end gap-1 mt-0.5 ${mine ? '' : ''}`}>
          {m.editedAt && <span className={`text-[10px] ${mine ? 'text-white/60' : 'text-[var(--mv2-muted)]'}`}>edited</span>}
          <span className={`text-[10.5px] ${mine ? 'text-white/70' : 'text-[var(--mv2-muted)]'}`}>{fmtTime(m.createdAt)}</span>
          {mine && <Ticks state={msgTick(m, chat)} />}
        </div>
      </div>
    </div>
  );
}

function MessageBody({ m, mine, highlight, onVote }: { m: ChatMessage; mine: boolean; highlight: string; onVote: (idx: number) => void }) {
  const textCls = `text-[15.5px] leading-[1.4] whitespace-pre-wrap break-words ${mine ? 'text-white' : 'text-[var(--mv2-text)]'}`;
  const hl = (t: string) => (highlight ? hi(t, highlight) : t);
  const isVideo = !!m.mediaURL && /\.(webm|mp4|mov)(\?|$)/i.test(m.mediaURL);

  if (m.type === 'image' && m.mediaURL) {
    return (
      <div className="mb-1">
        {isVideo ? (
          <video src={m.mediaURL} controls playsInline preload="metadata" className="rounded-lg max-h-64 w-full bg-black" />
        ) : (
          <img src={m.mediaURL} alt="" className="rounded-lg max-h-64 w-full object-cover" loading="lazy" />
        )}
        {m.text && <p className={textCls + ' mt-1'}>{hl(m.text)}</p>}
      </div>
    );
  }
  if (m.type === 'audio' && m.mediaURL) {
    return <VoicePlayer url={m.mediaURL} duration={m.duration} mine={mine} />;
  }
  if (m.type === 'file' && m.mediaURL) {
    return (
      <a href={m.mediaURL} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-1 min-w-[180px]">
        <span className={`w-11 h-11 rounded-full flex items-center justify-center text-[20px] ${mine ? 'bg-white/20' : 'bg-[var(--mv2-accent-soft)]'}`}>📄</span>
        <span className="min-w-0">
          <span className={`block text-[14px] font-medium truncate ${mine ? 'text-white' : 'text-[var(--mv2-text)]'}`}>{m.fileName || 'File'}</span>
          <span className={`text-[12px] ${mine ? 'text-white/70' : 'text-[var(--mv2-muted)]'}`}>
            {m.fileSize ? `${(m.fileSize / 1024).toFixed(0)} KB` : ''} • kholein
          </span>
        </span>
      </a>
    );
  }
  if (m.type === 'poll' && m.poll) {    const total = Object.values(m.poll.votes || {}).reduce((a, v) => a + v.length, 0);
    return (
      <div className="min-w-[210px] py-1">
        <p className={`text-[15px] font-semibold mb-2 ${mine ? 'text-white' : 'text-[var(--mv2-text)]'}`}>📊 {m.poll.question}</p>
        {m.poll.options.map((opt, i) => {
          const votes = (m.poll!.votes?.[String(i)] || []).length;
          const pct = total ? Math.round((votes / total) * 100) : 0;
          return (
            <button key={i} onClick={() => onVote(i)} className="w-full text-left mb-1.5">
              <div className={`relative rounded-lg px-2.5 py-2 overflow-hidden ${mine ? 'bg-black/15' : 'bg-black/10'}`}>
                <div className="absolute inset-y-0 left-0 bg-[var(--mv2-accent)]/25" style={{ width: `${pct}%` }} />
                <span className={`relative text-[14px] ${mine ? 'text-white' : 'text-[var(--mv2-text)]'}`}>{opt}</span>
                <span className={`relative float-right text-[12px] ${mine ? 'text-white/70' : 'text-[var(--mv2-muted)]'}`}>{pct}%</span>
              </div>
            </button>
          );
        })}
        <p className={`text-[11px] ${mine ? 'text-white/60' : 'text-[var(--mv2-muted)]'}`}>{total} vote{total !== 1 ? 's' : ''} • tap karke vote karein</p>
      </div>
    );
  }
  const firstUrl = m.type === 'text' ? extractUrls(m.text)[0] : undefined;
  return (
    <>
      <p className={textCls}>{hl(m.text)}</p>
      {firstUrl && <LinkPreviewCard url={firstUrl} mine={mine} compact />}
    </>
  );
}
