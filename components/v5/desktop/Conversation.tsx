'use client';

/**
 * Conversation — v5 single-group conversation (WhatsApp Web style).
 * - Header: group avatar/name, members + typing subtitle, theme (owner), info
 * - Mute banner with live countdown (muted users ke liye)
 * - Bubbles: sender name + Owner/Member badge, reply, reactions, ticks
 * - Right-click menu: Reply / Copy / Pin (owner) / Delete (v5 rules:
 *   member = sirf "mere liye"; owner = "sab ke liye" hard-delete, no placeholder)
 * - Input: emoji, attach, voice note, poll (owner), command palette "/" with
 *   command + member auto-suggest (commands -> backend.executeCommand)
 * - Theme background (preset ya custom image/video)
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat, ChatMessage, UserProfile } from '@/lib/backend/types';
import { Ticks } from '@/components/Ticks';
import Avatar from '@/components/Avatar';
import {
  Icon, ICONS, Modal, Popover, MenuItem, runOwnerCommand, useMemberRoles,
  fmtDayHinglish, fmtCountdown, RoleBadge, type GroupTheme,
} from './common';

const SENDER_COLORS = ['#00a884', '#53bdeb', '#ff9f1c', '#ec4899', '#7f66ff', '#f15c6d', '#ab9df2'];
export function senderColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return SENDER_COLORS[h % SENDER_COLORS.length];
}

function tickState(m: ChatMessage, chat: Chat): 'sent' | 'delivered' | 'read' {
  const others = chat.participants.filter((p) => p !== m.senderId);
  if (others.length === 0) return 'sent';
  const readCount = (m.readBy || []).filter((u) => u !== m.senderId).length;
  if (readCount >= others.length) return 'read';
  if (readCount > 0 || (m.deliveredAt ?? 0) > 0) return 'delivered';
  return 'sent';
}

function fmtDur(sec?: number): string {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function msgPreview(m: ChatMessage): string {
  if (m.text) return m.text.slice(0, 80);
  if (m.type === 'image') return '📷 Photo';
  if (m.type === 'audio') return '🎤 Voice note';
  if (m.type === 'file') return `📄 ${m.fileName || 'Document'}`;
  if (m.type === 'poll') return '📊 Poll';
  return 'Message';
}

// ---------- owner commands (command palette) ----------

const COMMANDS: { cmd: string; desc: string; needsMember?: boolean; needsText?: boolean }[] = [
  { cmd: '/mute', desc: 'Member ko mute karo — misal: /mute @ahmed 10m', needsMember: true },
  { cmd: '/unmute', desc: 'Mute hatao', needsMember: true },
  { cmd: '/warn', desc: 'Member ko warning do', needsMember: true },
  { cmd: '/ban', desc: 'Member ko group se nikalo (ban)', needsMember: true },
  { cmd: '/lock', desc: 'Group lock — sirf owner likh sakega' },
  { cmd: '/unlock', desc: 'Group unlock karo' },
  { cmd: '/announce', desc: 'Announcement bhejo', needsText: true },
  { cmd: '/clear', desc: 'Saare messages saaf karo (tasdeeq ke saath)' },
  { cmd: '/stats', desc: 'Group stats dekho' },
];

// ---------- audio player ----------

function AudioPlayer({ url, duration }: { url: string; duration?: number }) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play().catch(() => {});
  };

  return (
    <div className="flex items-center gap-2 min-w-[210px] py-1">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setPos(0); }}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
      />
      <button
        onClick={toggle}
        className="w-9 h-9 rounded-full bg-[#00a884] text-white flex items-center justify-center shrink-0 hover:bg-[#06cf9c] transition"
        aria-label={playing ? 'Roko' : 'Chalao'}
      >
        <Icon d={playing ? ICONS.pause : ICONS.play} size={17} filled />
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-1 rounded-full bg-[#2a3942] overflow-hidden">
          <div
            className="h-full bg-[#00a884] rounded-full transition-[width]"
            style={{ width: `${duration ? Math.min(100, (pos / duration) * 100) : 0}%` }}
          />
        </div>
        <div className="text-[11px] text-[#8696a0] mt-1 tabular-nums">
          {pos > 0 ? fmtDur(pos) : fmtDur(duration)}
        </div>
      </div>
      <Icon d={ICONS.mic} size={20} className="text-[#8696a0] shrink-0" />
    </div>
  );
}

// ---------- poll ----------

function PollView({ m, chatId }: { m: ChatMessage; chatId: string }) {
  const poll = m.poll;
  const [voting, setVoting] = useState(false);
  if (!poll) return null;
  const total = Object.values(poll.votes || {}).reduce((n, arr) => n + arr.length, 0);
  const vote = async (i: number) => {
    if (voting) return;
    setVoting(true);
    try { await backend.votePoll(chatId, m.id, i); } finally { setVoting(false); }
  };
  return (
    <div className="min-w-[230px]">
      <p className="text-[14px] font-medium text-[#e9edef] mb-2">{poll.question}</p>
      <div className="space-y-1.5">
        {poll.options.map((opt, i) => {
          const votes = (poll.votes?.[String(i)] || []).length;
          const pct = total ? Math.round((votes / total) * 100) : 0;
          return (
            <button
              key={i}
              onClick={() => vote(i)}
              disabled={voting}
              className="w-full text-left rounded-lg border border-[#2a3942] hover:border-[#00a884]/60 transition overflow-hidden disabled:opacity-70"
            >
              <div className="relative px-3 py-2">
                <div className="absolute inset-y-0 left-0 bg-[#00a884]/20 transition-all" style={{ width: `${pct}%` }} />
                <div className="relative flex items-center justify-between gap-2">
                  <span className="text-[13.5px] text-[#e9edef] truncate">{opt}</span>
                  <span className="text-[11.5px] text-[#8696a0] tabular-nums shrink-0">{votes} · {pct}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-[#8696a0] mt-2">{total} votes · vote ke liye option dabayein</p>
    </div>
  );
}

// ---------- v5 message bubble ----------

const QUICK_REACT = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

interface BubbleProps {
  m: ChatMessage;
  mine: boolean;
  chat: Chat;
  role: string;
  amOwner: boolean;
  tail: boolean;
  onReply(m: ChatMessage): void;
}

function MessageBubble({ m, mine, chat, role, amOwner, tail, onReply }: BubbleProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [reactOpen, setReactOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [imgOpen, setImgOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const isPinned = !!m.isPinned;

  const toggleReact = async (emoji: string) => {
    setReactOpen(false);
    try { await backend.toggleReaction(chat.id, m.id, emoji); } catch {}
  };

  const doDelete = async (choice: 'me' | 'everyone') => {
    setDelBusy(true);
    try {
      await backend.deleteMessage(chat.id, m.id, choice === 'everyone');
      setDelOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete nahi ho saka');
    } finally {
      setDelBusy(false);
    }
  };

  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const reactions = Object.entries(m.reactions || {}).filter(([, u]) => u.length > 0);

  return (
    <>
      <div
        ref={wrapRef}
        onContextMenu={onContext}
        className={`v4msgin max-w-[72%] md:max-w-[65%] rounded-lg px-2.5 pt-1.5 pb-1 shadow-sm relative group ${
          mine ? 'bg-[#005c4b] text-[#e9edef] v4tail-out v4tail ml-auto' : 'bg-[#1f2c34] text-[#e9edef] v4tail-in v4tail'
        } ${tail ? '' : mine ? '[&::before]:hidden' : '[&::before]:hidden'}`}
      >
        {!mine && (
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="text-[13px] font-medium" style={{ color: senderColor(m.senderName || '?') }}>
              {m.senderName || 'Koi'}
            </span>
            <RoleBadge role={role} small />
          </div>
        )}
        {mine && (role === 'Owner' || role === 'owner') && (
          <div className="flex justify-end mb-0.5"><RoleBadge role="Owner" small /></div>
        )}

        {isPinned && (
          <div className="flex items-center gap-1 text-[11px] text-[#ffd447] mb-1">
            <Icon d={ICONS.pin} size={12} /> Pinned
          </div>
        )}

        {m.replyTo && (
          <div className={`rounded-md px-2 py-1.5 mb-1.5 border-l-[3px] ${mine ? 'bg-black/20 border-[#53bdeb]' : 'bg-black/25 border-[#00a884]'}`}>
            <p className="text-[12px] font-medium text-[#53bdeb] truncate">{m.replyTo.senderName}</p>
            <p className="text-[12.5px] text-[#aebac1] truncate">{m.replyTo.text}</p>
          </div>
        )}

        {m.forwarded && <p className="text-[11.5px] text-[#8696a0] italic mb-1">Forwarded</p>}

        {m.type === 'text' && (
          <p className="text-[14.2px] leading-[1.45] whitespace-pre-wrap break-words">{m.text}</p>
        )}

        {m.type === 'image' && m.mediaURL && (
          <button onClick={() => setImgOpen(true)} className="block -mx-1 -mt-0.5 mb-1 rounded-md overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.mediaURL} alt="" className="max-h-[320px] w-auto rounded-md" loading="lazy" />
          </button>
        )}
        {m.type === 'image' && m.text && (
          <p className="text-[14.2px] leading-[1.45] whitespace-pre-wrap break-words mt-1">{m.text}</p>
        )}

        {m.type === 'audio' && m.mediaURL && <AudioPlayer url={m.mediaURL} duration={m.duration} />}

        {m.type === 'file' && (
          <a
            href={m.mediaURL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-2.5 my-1 hover:bg-black/30 transition min-w-[200px]"
          >
            <span className="w-10 h-10 rounded-full bg-[#2a3942] flex items-center justify-center shrink-0">
              <Icon d={ICONS.file} size={20} className="text-[#8696a0]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] text-[#e9edef] truncate">{m.fileName || 'Document'}</span>
              <span className="block text-[11.5px] text-[#8696a0]">
                {m.fileSize ? `${(m.fileSize / 1024).toFixed(0)} KB` : ''} · kholne ke liye dabayein
              </span>
            </span>
          </a>
        )}

        {m.type === 'poll' && <PollView m={m} chatId={chat.id} />}

        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {reactions.map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => toggleReact(emoji)}
                className="text-[13px] bg-black/25 hover:bg-black/40 rounded-full px-2 py-[1px] transition"
                title={`${users.length} reactions`}
              >
                {emoji} <span className="text-[11px] text-[#aebac1]">{users.length}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-1 mt-0.5">
          {m.editedAt ? <span className="text-[10.5px] text-[#8696a0] italic">edited</span> : null}
          <span className="text-[10.5px] text-[#8696a0]">
            {new Date(m.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
          {mine && <Ticks state={tickState(m, chat)} />}
        </div>

        {/* hover quick react */}
        <button
          onClick={() => setReactOpen((v) => !v)}
          className={`absolute -top-2 ${mine ? '-left-3' : '-right-3'} w-7 h-7 rounded-full bg-[#2a3942] text-[#aebac1] items-center justify-center shadow hidden group-hover:flex hover:text-white transition`}
          title="React karein"
        >
          <span className="text-[14px]">😊</span>
        </button>
        {reactOpen && (
          <div className={`absolute -top-11 ${mine ? 'right-0' : 'left-0'} z-30 bg-[#111b21] border border-[#222d34] rounded-full px-2 py-1.5 flex gap-1 shadow-2xl animate-[v4pop_.15s_ease-out]`}>
            {QUICK_REACT.map((e) => (
              <button key={e} onClick={() => toggleReact(e)} className="text-[20px] hover:scale-125 transition-transform px-0.5">
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* context menu */}
      {menu && (
        <div className="fixed inset-0 z-[70]" onClick={() => setMenu(null)}>
          <div
            className="fixed z-[71] bg-[#111b21] border border-[#222d34] rounded-xl shadow-2xl py-1.5 min-w-[210px] animate-[v4pop_.15s_ease-out]"
            style={{ left: Math.min(menu.x, window.innerWidth - 230), top: Math.min(menu.y, window.innerHeight - 260) }}
            onClick={(e) => e.stopPropagation()}
          >
            <MenuItem label="Reply" icon="reply" onClick={() => { setMenu(null); onReply(m); }} />
            <MenuItem label="Copy" icon="copy" onClick={() => { setMenu(null); try { navigator.clipboard.writeText(m.text || ''); } catch {} }} />
            {amOwner && (
              <MenuItem
                label={isPinned ? 'Unpin karein' : 'Pin karein'}
                icon="pin"
                onClick={async () => {
                  setMenu(null);
                  try {
                    if (isPinned) await backend.unpinMessage(chat.id, m.id);
                    else await backend.pinMessage(chat.id, m.id);
                  } catch {}
                }}
              />
            )}
            <MenuItem label="Delete" icon="trash" danger onClick={() => { setMenu(null); setDelOpen(true); }} />
          </div>
        </div>
      )}

      {/* v5 delete dialog — member: sirf "mere liye"; owner: "sab ke liye" hard-delete */}
      {delOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/60 animate-[v4fade_.15s_ease-out]" onClick={() => setDelOpen(false)} />
          <div className="relative bg-[#111b21] text-[#e9edef] rounded-2xl shadow-2xl border border-[#222d34] w-full max-w-[380px] overflow-hidden animate-[v4pop_.18s_ease-out]">
            <div className="px-5 pt-5 pb-2">
              <div className="w-12 h-12 rounded-full bg-[#ea0038]/10 text-[#ea0038] flex items-center justify-center mb-3">
                <Icon d={ICONS.trash} size={22} />
              </div>
              <h2 className="text-[17px] font-medium mb-1.5">Message delete karein?</h2>
              <p className="text-[13.5px] text-[#8696a0] leading-relaxed bg-[#1f2c34] rounded-xl px-3 py-2 mt-2 break-words max-h-[76px] overflow-hidden">
                “{msgPreview(m)}”
              </p>
            </div>
            <div className="p-3 pt-2 flex flex-col gap-1">
              {amOwner && (
                <button
                  onClick={() => doDelete('everyone')}
                  disabled={delBusy}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-[#ea0038] font-medium text-[14.5px] hover:bg-[#ea0038]/10 transition disabled:opacity-50"
                >
                  <Icon d={ICONS.trash} size={19} />
                  Sab ke liye delete karein
                </button>
              )}
              <button
                onClick={() => doDelete('me')}
                disabled={delBusy}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-[14.5px] hover:bg-[#1f2c34] transition disabled:opacity-50"
              >
                <Icon d={ICONS.user} size={19} className="text-[#8696a0]" />
                Sirf mere liye delete karein
              </button>
              <button
                onClick={() => setDelOpen(false)}
                disabled={delBusy}
                className="w-full px-4 py-3 rounded-xl text-[14.5px] font-medium text-[#00a884] hover:bg-[#00a884]/10 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <p className="text-center text-[11.5px] text-[#8696a0] px-2">
                {amOwner
                  ? '“Sab ke liye” dabane par message foran sab ke paas se hat jayega (koi nishan nahi).'
                  : '“Mere liye” dabane par message sirf aapke paas se hatega.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* image viewer */}
      {imgOpen && m.mediaURL && (
        <div className="fixed inset-0 z-[95] bg-black/95 flex items-center justify-center p-6" onClick={() => setImgOpen(false)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Band karein">
            <Icon d={ICONS.x} size={22} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.mediaURL} alt="" className="max-w-full max-h-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

// ---------- v5 input bar (command palette "/" ke saath) ----------

const EMOJIS = ['😀','😁','😂','🤣','😊','😍','😘','😎','🤔','😅','😭','😡','👍','👏','🙏','❤️','🔥','🎉','👋','😌','😇','🥳','😴','🤯','🥺','😤','🤗','🫡','💯','✨','💔','💪','👀','🙌','🤝','🫶','🌙','☀️','🕌','📿'];

interface InputProps {
  chat: Chat;
  me: UserProfile;
  amOwner: boolean;
  mutedUntil: number | null;
  replyTo: ChatMessage | null;
  onClearReply(): void;
  onOptimistic(m: ChatMessage): void;
  onToast(msg: string): void;
}

function InputBar({ chat, me, amOwner, mutedUntil, replyTo, onClearReply, onOptimistic, onToast }: InputProps) {
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const mediaRec = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMuted = mutedUntil != null && mutedUntil > Date.now();

  // palette state
  const paletteOpen = text.startsWith('/');
  const slashWord = text.slice(1).split(' ')[0].toLowerCase();
  const afterCmd = text.slice(1 + slashWord.length).trimStart();
  const matchedCmds = useMemo(
    () => COMMANDS.filter((c) => (amOwner ? true : false) && c.cmd.startsWith('/' + slashWord)).slice(0, 6),
    [slashWord, amOwner],
  );
  const memberQuery = afterCmd.replace(/^@/, '').toLowerCase();
  const suggestedMembers = useMemo(() => {
    const list = Object.entries(chat.participantProfiles || {}).map(([id, p]) => ({
      id,
      name: id === me.id ? `${p.displayName || me.displayName} (aap)` : p.displayName || 'Koi',
    }));
    return list.filter((x) => !memberQuery || x.name.toLowerCase().includes(memberQuery)).slice(0, 5);
  }, [chat.participantProfiles, memberQuery, me.id, me.displayName]);

  useEffect(() => {
    const ta = inputRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(120, ta.scrollHeight) + 'px';
    }
  }, [text]);

  const pingTyping = () => {
    backend.setTyping(chat.id, true).catch(() => {});
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => backend.setTyping(chat.id, false).catch(() => {}), 2500);
  };

  const runCommand = async (cmdText: string) => {
    try {
      const res = await runOwnerCommand(chat.id, cmdText);
      onToast(res.text || 'Ho gaya ✓');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Command nahi chali');
    }
  };

  const send = async () => {
    const t = text.trim();
    if (!t || sending || isMuted) return;
    if (t.startsWith('/') && amOwner) {
      setText('');
      setSending(true);
      try { await runCommand(t); } finally { setSending(false); }
      return;
    }
    const replyRef = replyTo ? { id: replyTo.id, text: msgPreview(replyTo), senderName: replyTo.senderName } : null;
    const optimistic: ChatMessage = {
      id: `tmp_${Date.now()}`,
      chatId: chat.id,
      senderId: me.id,
      senderName: me.displayName,
      type: 'text',
      text: t,
      replyTo: replyRef,
      createdAt: Date.now(),
      readBy: [me.id],
    };
    setText('');
    onClearReply();
    onOptimistic(optimistic);
    backend.setTyping(chat.id, false).catch(() => {});
    try {
      await backend.sendMessage(chat.id, { type: 'text', text: t, replyTo: replyRef });
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Message nahi bheja ja saka');
    }
  };

  const sendMedia = async (file: File, kind: 'image' | 'file') => {
    setAttachOpen(false);
    onToast(kind === 'image' ? 'Photo upload ho rahi hai…' : 'File upload ho rahi hai…');
    try {
      const up = kind === 'image' ? await backend.uploadMedia(chat.id, file) : await backend.uploadFile(chat.id, file);
      await backend.sendMessage(chat.id, {
        type: kind === 'image' ? 'image' : 'file',
        text: '',
        mediaURL: up.url,
        fileName: file.name,
        fileSize: file.size,
      });
    } catch {
      onToast('Upload nahi ho saki');
    }
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRec.current = rec;
      recChunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) recChunks.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recChunks.current, { type: rec.mimeType || 'audio/webm' });
        if (blob.size < 1000) return;
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        const secs = recSecs;
        onToast('Voice note bheji ja rahi hai…');
        try {
          const up = await backend.uploadMedia(chat.id, file);
          await backend.sendMessage(chat.id, { type: 'audio', text: '', mediaURL: up.url, duration: secs });
        } catch { onToast('Voice note nahi bheji ja saki'); }
      };
      rec.start();
      setRecording(true);
      setRecSecs(0);
      recTimer.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
    } catch {
      onToast('Mic ki ijazat nahi mili');
    }
  };

  const stopRec = (sendIt: boolean) => {
    if (recTimer.current) clearInterval(recTimer.current);
    setRecording(false);
    const rec = mediaRec.current;
    if (rec && rec.state !== 'inactive') {
      if (!sendIt) {
        rec.onstop = () => {};
        recChunks.current = [];
      }
      rec.stop();
    }
    mediaRec.current = null;
  };

  const createPoll = async () => {
    const q = pollQ.trim();
    const opts = pollOpts.map((o) => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) { onToast('Sawal aur kam az kam 2 options likhein'); return; }
    setPollOpen(false);
    setPollQ('');
    setPollOpts(['', '']);
    try {
      await backend.createPoll(chat.id, q, opts);
      onToast('Poll bana di gayi');
    } catch { onToast('Poll nahi ban saki'); }
  };

  const pickCommand = (cmd: string) => {
    setText(cmd + ' ');
    inputRef.current?.focus();
  };

  const pickMember = (name: string) => {
    const base = '/' + slashWord;
    const clean = name.replace(' (aap)', '');
    setText(`${base} @${clean} `);
    inputRef.current?.focus();
  };

  return (
    <div className="relative shrink-0">
      {/* command palette */}
      {paletteOpen && amOwner && (matchedCmds.length > 0 || suggestedMembers.length > 0) && (
        <div className="absolute bottom-full left-3 right-3 mb-2 z-40 bg-[#111b21] border border-[#222d34] rounded-xl shadow-2xl overflow-hidden animate-[v4pop_.15s_ease-out] max-h-[300px] overflow-y-auto v4scroll">
          {matchedCmds.length > 0 && (
            <>
              <p className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wide text-[#8696a0]">Commands</p>
              {matchedCmds.map((c) => (
                <button key={c.cmd} onClick={() => pickCommand(c.cmd)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#1f2c34] transition">
                  <span className="text-[14px] font-mono text-[#00a884] font-medium min-w-[86px]">{c.cmd}</span>
                  <span className="text-[13px] text-[#aebac1] truncate">{c.desc}</span>
                </button>
              ))}
            </>
          )}
          {afterCmd !== '' && suggestedMembers.length > 0 && (
            <>
              <p className="px-4 pt-2 pb-1 text-[11px] uppercase tracking-wide text-[#8696a0]">Members</p>
              {suggestedMembers.map((mb) => (
                <button key={mb.id} onClick={() => pickMember(mb.name)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#1f2c34] transition">
                  <Avatar name={mb.name} size={28} />
                  <span className="text-[13.5px] text-[#e9edef] truncate">{mb.name}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {replyTo && (
        <div className="mx-3 mb-1 flex items-center gap-2 bg-[#1f2c34] rounded-lg px-3 py-2">
          <div className="flex-1 min-w-0 border-l-[3px] border-[#00a884] pl-2">
            <p className="text-[12px] font-medium text-[#00a884]">{replyTo.senderName}</p>
            <p className="text-[12.5px] text-[#aebac1] truncate">{msgPreview(replyTo)}</p>
          </div>
          <button onClick={onClearReply} className="p-1 text-[#8696a0] hover:text-white" aria-label="Reply hatao">
            <Icon d={ICONS.x} size={18} />
          </button>
        </div>
      )}

      {isMuted && (
        <div className="mx-3 mb-2 flex items-center gap-2.5 bg-[#ea0038]/10 border border-[#ea0038]/30 rounded-xl px-4 py-2.5">
          <Icon d={ICONS.mute} size={18} className="text-[#ea0038] shrink-0" />
          <p className="text-[13px] text-[#e9edef]">
            Aap <span className="font-medium text-[#ea0038]">mute</span> hain · <span className="tabular-nums">{fmtCountdown(mutedUntil!)}</span> baqi
          </p>
        </div>
      )}

      <div className="px-3 pb-3">
        <div className="flex items-end gap-1.5">
          <div className="flex gap-0.5 pb-1">
            <button onClick={() => setEmojiOpen((v) => !v)} className="p-2.5 rounded-full text-[#8696a0] hover:bg-[#1f2c34] hover:text-[#d1d7db] transition" title="Emoji">
              <Icon d={ICONS.emoji} size={24} />
            </button>
            <button onClick={() => setAttachOpen((v) => !v)} className="p-2.5 rounded-full text-[#8696a0] hover:bg-[#1f2c34] hover:text-[#d1d7db] transition" title="Attach">
              <Icon d={ICONS.plus} size={24} />
            </button>
          </div>

          <div className="flex-1 relative">
            {emojiOpen && (
              <div className="absolute bottom-full left-0 mb-2 z-40 bg-[#111b21] border border-[#222d34] rounded-xl shadow-2xl p-3 w-[320px] animate-[v4pop_.15s_ease-out]">
                <div className="grid grid-cols-8 gap-1 max-h-[220px] overflow-y-auto v4scroll">
                  {EMOJIS.map((e) => (
                    <button key={e} onClick={() => setText((t) => t + e)} className="text-[22px] p-1 hover:bg-[#1f2c34] rounded-lg transition">
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {attachOpen && (
              <div className="absolute bottom-full left-0 mb-2 z-40 animate-[v4pop_.15s_ease-out]">
                <Popover onClose={() => setAttachOpen(false)} className="left-0 bottom-0">
                  <MenuItem label="Photo / Video" icon="image" onClick={() => imgRef.current?.click()} />
                  <MenuItem label="Document" icon="file" onClick={() => fileRef.current?.click()} />
                  {amOwner && <MenuItem label="Poll banayein" icon="poll" sub="Sirf owner" onClick={() => { setAttachOpen(false); setPollOpen(true); }} />}
                </Popover>
              </div>
            )}
            <textarea
              ref={inputRef}
              value={text}
              disabled={isMuted}
              onChange={(e) => { setText(e.target.value); pingTyping(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder={isMuted ? 'Aap mute hain…' : amOwner ? 'Message likhein… ( / dabayein for commands )' : 'Message likhein…'}
              rows={1}
              className="w-full bg-[#1f2c34] text-[#e9edef] text-[15px] rounded-2xl px-4 py-3 resize-none outline-none v4scroll disabled:opacity-60 max-h-[120px]"
            />
          </div>

          {recording ? (
            <div className="flex items-center gap-1.5 pb-1">
              <span className="text-[13px] text-[#ea0038] tabular-nums font-medium flex items-center gap-1.5 bg-[#1f2c34] rounded-full px-3 py-2">
                <span className="v5pulse w-2 h-2 rounded-full bg-[#ea0038]" /> {fmtDur(recSecs)}
              </span>
              <button onClick={() => stopRec(false)} className="p-2.5 rounded-full text-[#8696a0] hover:bg-[#1f2c34]" title="Cancel">
                <Icon d={ICONS.trash} size={20} />
              </button>
              <button onClick={() => stopRec(true)} className="p-2.5 rounded-full bg-[#00a884] text-white hover:bg-[#06cf9c]" title="Bhejo">
                <Icon d={ICONS.send} size={20} />
              </button>
            </div>
          ) : text.trim() ? (
            <button onClick={send} disabled={sending || isMuted} className="p-2.5 mb-1 rounded-full bg-[#00a884] text-white hover:bg-[#06cf9c] transition disabled:opacity-50" title="Bhejo">
              <Icon d={ICONS.send} size={22} />
            </button>
          ) : (
            <button onClick={startRec} disabled={isMuted} className="p-2.5 mb-1 rounded-full text-[#8696a0] hover:bg-[#1f2c34] hover:text-[#d1d7db] transition disabled:opacity-50" title="Voice note">
              <Icon d={ICONS.mic} size={24} />
            </button>
          )}
        </div>
      </div>

      <input ref={imgRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) sendMedia(f, 'image'); e.target.value = ''; }} />
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) sendMedia(f, 'file'); e.target.value = ''; }} />

      {/* owner poll creator */}
      {pollOpen && (
        <Modal title="Nayi Poll (sirf owner)" onClose={() => setPollOpen(false)}>
          <div className="p-5 space-y-3">
            <input
              value={pollQ}
              onChange={(e) => setPollQ(e.target.value)}
              placeholder="Sawal likhein…"
              className="w-full bg-[#1f2c34] rounded-xl px-4 py-3 text-[14.5px] text-[#e9edef] outline-none focus:ring-1 focus:ring-[#00a884]"
            />
            {pollOpts.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={o}
                  onChange={(e) => setPollOpts((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 bg-[#1f2c34] rounded-xl px-4 py-2.5 text-[14px] text-[#e9edef] outline-none focus:ring-1 focus:ring-[#00a884]"
                />
                {pollOpts.length > 2 && (
                  <button onClick={() => setPollOpts((arr) => arr.filter((_, j) => j !== i))} className="p-2 text-[#8696a0] hover:text-[#ea0038]">
                    <Icon d={ICONS.x} size={18} />
                  </button>
                )}
              </div>
            ))}
            {pollOpts.length < 6 && (
              <button onClick={() => setPollOpts((a) => [...a, ''])} className="text-[13.5px] text-[#00a884] hover:underline">
                + Option add karein
              </button>
            )}
            <button onClick={createPoll} className="w-full bg-[#00a884] hover:bg-[#06cf9c] text-white font-medium rounded-xl py-3 text-[14.5px] transition">
              Poll banayein
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- main Conversation ----------

interface Props {
  chat: Chat;
  me: UserProfile;
  ownerId: string | null;
  amOwner: boolean;
  theme: GroupTheme;
  mutedUntil: number | null;
  onOpenInfo(): void;
  onOpenThemes(): void;
}

export default function Conversation({ chat, me, ownerId, amOwner, theme, mutedUntil, onOpenInfo, onOpenThemes }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [typingText, setTypingText] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [, tick] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  // messages subscription (deleted-for-me filter)
  useEffect(
    () =>
      backend.onMessages(chat.id, (msgs) =>
        setMessages(msgs.filter((m) => !(m.deletedFor || []).includes(me.id))),
      ),
    [chat.id, me.id],
  );

  // read marker
  useEffect(() => {
    backend.markRead(chat.id).catch(() => {});
  }, [chat.id, messages.length]);

  // mute countdown ticker
  useEffect(() => {
    if (mutedUntil == null || mutedUntil <= Date.now()) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [mutedUntil]);

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

  // optimistic merge
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

  // auto-scroll
  useEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [allMessages.length]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  // backend roles (custom roles samet) — ek dafa per member cache
  const senderIdsKey = useMemo(
    () => [...new Set(allMessages.map((m) => m.senderId))].join(','),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages.length],
  );
  const roleMap = useMemberRoles(chat.id, senderIdsKey);

  const roleOf = useCallback(
    (userId: string): string => {
      if (roleMap[userId]) return roleMap[userId];
      return ownerId != null && userId === ownerId ? 'Owner' : 'Member';
    },
    [ownerId, roleMap],
  );

  const memberCount = chat.participants.length;

  // theme background
  const themeStyle: React.CSSProperties =
    theme.kind === 'custom' && theme.url
      ? { backgroundColor: '#0b141a' }
      : (() => {
          const presets: Record<string, string> = { midnight: '#0b141a', emerald: '#0c3b33', desert: '#3a2c20', ocean: '#0a2c40' };
          return { backgroundColor: presets[theme.presetId ?? 'midnight'] ?? '#0b141a' };
        })();

  let lastDay = '';

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0b141a]">
      {/* header */}
      <header className="h-[60px] shrink-0 bg-[#1f2c34] flex items-center gap-3 px-4 z-30">
        <button onClick={onOpenInfo} className="flex items-center gap-3 min-w-0 flex-1 text-left group">
          <Avatar name={chat.name || 'Madrasa Group'} photoURL={chat.photoURL} size={42} />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-[16px] font-medium text-[#e9edef] truncate group-hover:underline">
                {chat.name || 'Madrasa Group'}
              </span>
            </span>
            <span className="block text-[12.5px] text-[#8696a0] truncate">
              {typingText || `${memberCount} members · sirf group chat`}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-0.5">
          {amOwner && (
            <button onClick={onOpenThemes} className="p-2.5 rounded-full text-[#8696a0] hover:bg-[#2a3942] hover:text-[#e9edef] transition" title="Chat theme (owner)">
              <Icon d={ICONS.image} size={21} />
            </button>
          )}
          <button onClick={onOpenInfo} className="p-2.5 rounded-full text-[#8696a0] hover:bg-[#2a3942] hover:text-[#e9edef] transition" title="Group info">
            <Icon d={ICONS.info} size={21} />
          </button>
        </div>
      </header>

      {/* messages */}
      <div
        ref={listRef}
        onScroll={onScroll}
        className={`flex-1 overflow-y-auto v4scroll px-4 md:px-10 lg:px-16 py-4 relative ${theme.kind === 'preset' ? 'v5wallpaper doodle' : 'v5wallpaper'}`}
        style={themeStyle}
      >
        {theme.kind === 'custom' && theme.url && (
          theme.mediaType === 'video' ? (
            <video src={theme.url} className="absolute inset-0 w-full h-full object-cover" muted loop autoPlay playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )
        )}
        {theme.kind === 'custom' && theme.url && <div className="absolute inset-0 bg-black/45" />}

        <div className="relative max-w-[900px] mx-auto flex flex-col gap-[3px]">
          {allMessages.length === 0 && (
            <div className="self-center mt-16 max-w-[380px] text-center">
              <div className="bg-[#1f2c34]/90 rounded-2xl px-6 py-6 shadow-lg">
                <p className="text-[15px] text-[#e9edef] font-medium mb-1">Assalam-o-Alaikum! 🤲</p>
                <p className="text-[13px] text-[#8696a0] leading-relaxed">
                  Madrasa Group me khush aamdeed. Yahan sab dost ek saath baat karte hain.
                </p>
              </div>
            </div>
          )}
          {allMessages.map((m, i) => {
            const day = fmtDayHinglish(m.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            const mine = m.senderId === me.id;
            const prev = allMessages[i - 1];
            const tail = !prev || prev.senderId !== m.senderId || m.createdAt - prev.createdAt > 60000;
            return (
              <Fragment key={m.id}>
                {showDay && (
                  <div className="self-center my-3">
                    <span className="text-[11.5px] font-medium text-[#aebac1] bg-[#1f2c34]/95 rounded-lg px-3 py-1.5 shadow">
                      {day}
                    </span>
                  </div>
                )}
                <MessageBubble
                  m={m}
                  mine={mine}
                  chat={chat}
                  role={roleOf(m.senderId)}
                  amOwner={amOwner}
                  tail={tail}
                  onReply={setReplyTo}
                />
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* input */}
      <div className="bg-[#1f2c34] shrink-0">
        <InputBar
          chat={chat}
          me={me}
          amOwner={amOwner}
          mutedUntil={mutedUntil}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          onOptimistic={(m) => setPending((p) => [...p, m])}
          onToast={showToast}
        />
      </div>

      {/* toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-[#1f2c34] border border-[#2a3942] text-[#e9edef] text-[13.5px] rounded-full px-5 py-2.5 shadow-2xl animate-[v4pop_.18s_ease-out] max-w-[90%] truncate">
          {toast}
        </div>
      )}
    </div>
  );
}
