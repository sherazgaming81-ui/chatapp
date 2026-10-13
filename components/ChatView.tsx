'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat, ChatMessage, ReplyRef, UserProfile } from '@/lib/backend/types';
import { fmtDateDivider, fmtLastSeen, fmtTime } from '@/lib/format';
import Avatar from './Avatar';
import MessageInput from './MessageInput';
import { Ticks } from './Ticks';
import PollCard from './v1/PollCard';
import ReactionsBar from './v1/ReactionsBar';
import PinnedBar from './v1/PinnedBar';
import MessageMenu, { useLongPress } from './v1/MessageMenu';
import { EditMessageBar } from './v1/EditMessageBar';
import { ForwardModal } from './v1/ForwardModal';
import ChatInfoPanel from './v1/ChatInfoPanel';
import ReadReceiptsModal from './v1/ReadReceiptsModal';
import ChatSearchBar from './v1/ChatSearchBar';
import PhotoViewer from './v1/PhotoViewer';
import UnreadJumpButton from './v1/UnreadJumpButton';
import { useSwipeReply } from '@/lib/v1/useSwipeReply';
import { triggerPush } from '@/lib/v1/pushClient';

function msgState(msg: ChatMessage, chat: Chat, meId: string): 'sent' | 'delivered' | 'read' {
  const others = chat.participants.filter((p) => p !== meId);
  if (others.length > 0 && others.every((o) => msg.readBy.includes(o))) return 'read';
  const anyOnline = others.some((o) => chat.participantProfiles[o]?.online);
  if (anyOnline || Date.now() - msg.createdAt > 20000) return 'delivered';
  return 'sent';
}

function fmtSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function Bubble({
  msg, mine, chat, meId, isAdmin,
  onReply, onDelete, onEdit, onForward, onStar, onPinToggle, onOpenReaders, onOpenPhoto,
}: {
  msg: ChatMessage;
  mine: boolean;
  chat: Chat;
  meId: string;
  isAdmin: boolean;
  onReply: () => void;
  onDelete: (forEveryone: boolean) => void;
  onEdit: () => void;
  onForward: () => void;
  onStar: () => void;
  onPinToggle: () => void;
  onOpenReaders: () => void;
  onOpenPhoto: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | undefined>(undefined);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const state = msgState(msg, chat, meId);
  const showName = chat.type === 'group' && !mine;

  useLongPress(bubbleRef, (e) => {
    const t = 'touches' in e && e.touches[0] ? e.touches[0] : (e as MouseEvent);
    setMenuPos({ x: (t as Touch).clientX || 0, y: (t as Touch).clientY || 0 });
    setMenu(true);
  });
  useSwipeReply(bubbleRef, onReply);

  return (
    <div id={`msg-${msg.id}`} className={`flex ${mine ? 'justify-end' : 'justify-start'} px-4 sm:px-10 my-0.5 relative`}>
      <div
        ref={bubbleRef}
        className={`max-w-[75%] sm:max-w-[65%] rounded-lg px-2.5 py-1.5 shadow text-[14.5px] leading-snug relative touch-pan-y ${
          mine ? 'bg-[#005c4b] text-white rounded-tr-none' : 'bg-[#202c33] text-white rounded-tl-none'
        }`}
        onContextMenu={(e) => { e.preventDefault(); setMenuPos({ x: e.clientX, y: e.clientY }); setMenu(true); }}
        onDoubleClick={() => backend.toggleReaction(msg.chatId, msg.id, '❤️').catch(() => {})}
      >
        {menu && (
          <MessageMenu
            message={msg}
            mine={mine}
            isAdmin={isAdmin}
            x={menuPos?.x}
            y={menuPos?.y}
            onReply={() => { onReply(); setMenu(false); }}
            onEdit={() => { onEdit(); setMenu(false); }}
            onForward={() => { onForward(); setMenu(false); }}
            onStar={() => { onStar(); setMenu(false); }}
            onPin={() => { onPinToggle(); setMenu(false); }}
            onDelete={() => { onDelete(false); setMenu(false); }}
            onClose={() => setMenu(false)}
          />
        )}
        {msg.forwarded && (
          <p className="text-[11px] text-[#ffffff99] italic mb-0.5">↪ Forwarded</p>
        )}
        {showName && (
          <p className="text-[13px] font-semibold text-[#00a884] mb-0.5">{msg.senderName}</p>
        )}
        {msg.replyTo && (
          <div className="bg-black/25 rounded px-2 py-1 mb-1 border-l-2 border-[#00a884]">
            <p className="text-xs text-[#00a884] font-semibold">{msg.replyTo.senderName}</p>
            <p className="text-xs text-[#8696a0] truncate">{msg.replyTo.text || '📷 Photo'}</p>
          </div>
        )}
        {msg.type === 'poll' ? (
          <PollCard message={msg} meId={meId} />
        ) : (
          <>
            {msg.type === 'image' && msg.mediaURL && (
              <div className="mb-1 cursor-pointer" onClick={onOpenPhoto}>
                <img src={msg.mediaURL} alt={msg.fileName || 'photo'} className="rounded-md max-h-[280px] object-cover" loading="lazy" />
              </div>
            )}
            {msg.type === 'audio' && msg.mediaURL && (
              <div className="flex items-center gap-2 py-1 min-w-[200px]">
                <audio src={msg.mediaURL} controls className="h-8 max-w-[220px]" />
                {msg.duration ? <span className="text-xs text-[#8696a0]">{msg.duration}s</span> : null}
              </div>
            )}
            {msg.type === 'file' && msg.mediaURL && (
              <a href={msg.mediaURL} download={msg.fileName} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 bg-black/25 rounded-lg px-3 py-2.5 mb-1 hover:bg-black/40 transition min-w-[200px]">
                <span className="text-2xl">📎</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{msg.fileName || 'File'}</span>
                  <span className="block text-xs text-[#8696a0]">{fmtSize(msg.fileSize)} • Download</span>
                </span>
              </a>
            )}
            {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
          </>
        )}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div className="mt-1">
            <ReactionsBar
              message={msg}
              meId={meId}
              onToggle={(emoji) => backend.toggleReaction(msg.chatId, msg.id, emoji).catch(() => {})}
            />
          </div>
        )}
        <div className="flex items-center justify-end gap-1 mt-0.5">
          {msg.isPinned && <span title="Pinned" className="text-[11px]">📌</span>}
          {msg.editedAt ? <span className="text-[11px] text-[#ffffff99] italic">edited</span> : null}
          <span className="text-[11px] text-[#ffffff99]">{fmtTime(msg.createdAt)}</span>
          {mine && (
            <button onClick={onOpenReaders} title="Dekhein kis ne parha" className="hover:opacity-80">
              <Ticks state={state} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatView({
  me, chat, chats, messages, onBack,
}: {
  me: UserProfile;
  chat: Chat;
  chats: Chat[];
  messages: ChatMessage[];
  onBack: () => void;
}) {
  const [replyTo, setReplyTo] = useState<ReplyRef | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [forwarding, setForwarding] = useState<ChatMessage | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [readersFor, setReadersFor] = useState<ChatMessage | null>(null);
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(
    () => messages.filter((m) => !(m.deletedFor || []).includes(me.id)),
    [messages, me.id]
  );
  const pinned = useMemo(() => visible.filter((m) => m.isPinned), [visible]);
  const unreadCount = useMemo(
    () => visible.filter((m) => m.senderId !== me.id && !m.readBy.includes(me.id)).length,
    [visible, me.id]
  );
  const isAdmin = (chat.adminIds || []).includes(me.id);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [chat.id]);
  useEffect(() => {
    backend.markRead(chat.id);
  }, [chat.id, visible.length]);

  const scrollToMessage = (id: string) => {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  const typingNames = useMemo(() => {
    const now = Date.now();
    return Object.entries(chat.typing || {})
      .filter(([uid, ts]) => uid !== me.id && now - ts < 4000)
      .map(([uid]) => chat.participantProfiles[uid]?.displayName?.split(' ')[0] || 'Someone');
  }, [chat.typing, chat.participantProfiles, me.id]);

  const status = useMemo(() => {
    if (typingNames.length > 0) return `${typingNames.join(', ')} typing...`;
    if (chat.type === 'direct') {
      const other = chat.participants.find((p) => p !== me.id);
      const prof = other ? chat.participantProfiles[other] : undefined;
      return fmtLastSeen(prof?.lastSeen || 0, !!prof?.online);
    }
    const names = chat.participants.map((p) => chat.participantProfiles[p]?.displayName?.split(' ')[0]).filter(Boolean);
    return names.join(', ');
  }, [typingNames, chat, me.id]);

  const otherId = chat.type === 'direct' ? chat.participants.find((p) => p !== me.id) : undefined;
  const headerPhoto = chat.photoURL || (otherId ? chat.participantProfiles[otherId]?.photoURL : '');

  const doPinToggle = (msg: ChatMessage) => {
    if (msg.isPinned) backend.unpinMessage(chat.id, msg.id).catch(() => {});
    else backend.pinMessage(chat.id, msg.id).catch(() => {});
  };
  const doStar = (msg: ChatMessage) => {
    const s = starred.has(msg.id);
    backend.starMessage(msg.id, !s).catch(() => {});
    setStarred((prev) => {
      const n = new Set(prev);
      if (s) n.delete(msg.id); else n.add(msg.id);
      return n;
    });
  };
  const doReact = (msg: ChatMessage) => {
    backend.toggleReaction(msg.chatId, msg.id, '👍').catch(() => {});
  };

  let lastDay = '';

  return (
    <div className="flex flex-col h-full bg-[#0b141a] relative">
      <div className="flex items-center gap-3 px-3 py-2 bg-[#202c33] shrink-0">
        <button onClick={onBack} className="md:hidden text-[#aebac1] p-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2z" /></svg>
        </button>
        <button onClick={() => setShowInfo(true)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <Avatar name={chat.name} photoURL={headerPhoto} size={40} />
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium truncate">{chat.name}</p>
            <p className="text-[#8696a0] text-xs truncate">{typingNames.length > 0 ? <span className="text-[#00a884]">{status}</span> : status}</p>
          </div>
        </button>
        <button onClick={() => setShowSearch((s) => !s)} className="p-2 text-[#aebac1] hover:text-white" title="Search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z" /></svg>
        </button>
      </div>

      {showSearch && <ChatSearchBar chatId={chat.id} onJumpToMessage={scrollToMessage} />}
      <PinnedBar messages={pinned} onJump={scrollToMessage} />

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto py-3"
        style={{
          backgroundImage: 'radial-gradient(#1a242b 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      >
        {visible.map((msg) => {
          const day = fmtDateDivider(msg.createdAt);
          const showDivider = day !== lastDay;
          lastDay = day;
          const mine = msg.senderId === me.id;
          return (
            <div key={msg.id}>
              {showDivider && (
                <div className="flex justify-center my-3">
                  <span className="bg-[#182229] text-[#8696a0] text-xs px-3 py-1.5 rounded-lg shadow">{day}</span>
                </div>
              )}
              <Bubble
                msg={msg}
                mine={mine}
                chat={chat}
                meId={me.id}
                isAdmin={isAdmin}
                onReply={() => setReplyTo({ id: msg.id, text: msg.text, senderName: msg.senderName })}
                onDelete={(forEveryone) => backend.deleteMessage(chat.id, msg.id, forEveryone).catch(() => {})}
                onEdit={() => setEditing(msg)}
                onForward={() => setForwarding(msg)}
                onStar={() => doStar(msg)}
                onPinToggle={() => doPinToggle(msg)}
                onOpenReaders={() => setReadersFor(msg)}
                onOpenPhoto={() => msg.mediaURL && setPhotoSrc(msg.mediaURL)}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <UnreadJumpButton unreadCount={unreadCount} onClick={scrollToBottom} />

      {editing ? (
        <EditMessageBar
          message={editing}
          onSave={(text) => { backend.editMessage(chat.id, editing.id, text).catch(() => {}); setEditing(null); }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <MessageInput
          chatId={chat.id}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          senderName={me.displayName}
          slowModeSec={chat.slowModeSec || 0}
        />
      )}

      {forwarding && (
        <ForwardModal
          messageId={forwarding.id}
          chats={chats.filter((c) => c.id !== chat.id)}
          onClose={() => setForwarding(null)}
          onDone={() => setForwarding(null)}
        />
      )}
      {readersFor && (
        <ReadReceiptsModal chatId={chat.id} messageId={readersFor.id} onClose={() => setReadersFor(null)} />
      )}
      {photoSrc && <PhotoViewer src={photoSrc} onClose={() => setPhotoSrc(null)} />}
      {showInfo && <ChatInfoPanel chat={chat} meId={me.id} onClose={() => setShowInfo(false)} />}
    </div>
  );
}
