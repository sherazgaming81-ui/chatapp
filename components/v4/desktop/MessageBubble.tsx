'use client';

/**
 * MessageBubble — WhatsApp Web style bubble.
 * Tails, ticks (blue #53bdeb read), timestamp inside, reactions,
 * right-click menu (Reply/Forward/Copy/Edit/Delete/Info/Star/Pin/React/Select),
 * hover quick actions, voice player, poll view, contact/location cards,
 * deleted-everyone placeholder, self-destruct countdown.
 */

import { forwardRef, useEffect, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat, ChatMessage } from '@/lib/backend/types';
import { Ticks } from '@/components/Ticks';
import { fmtTime } from '@/lib/format';
import { Icon, ICONS, backendV2, v4call, type IconName } from './common';
import PhotoViewer from './PhotoViewer';
import DeleteDialog, { canDeleteForEveryone } from './DeleteDialog';

const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];
const SENDER_COLORS = ['#00a884', '#53bdeb', '#ff9f1c', '#ec4899', '#7f66ff', '#f15c6d', '#ab9df2'];

export function senderColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return SENDER_COLORS[h % SENDER_COLORS.length];
}

export interface MenuAction {
  id: string;
  label: string;
  sub?: string;
  icon: IconName;
  tint?: string;
  danger?: boolean;
  dividerAfter?: boolean;
}

export function tickState(m: ChatMessage, chat: Chat): 'sent' | 'delivered' | 'read' {
  const others = chat.participants.filter((p) => p !== m.senderId);
  if (others.length === 0) return 'sent';
  const readCount = (m.readBy || []).filter((u) => u !== m.senderId).length;
  if (readCount >= others.length) return 'read';
  if (readCount > 0 || (m.deliveredAt ?? 0) > 0) return 'delivered';
  return 'sent';
}

interface Props {
  message: ChatMessage;
  mine: boolean;
  meId: string;
  chat: Chat;
  isAdmin: boolean;
  tail: boolean;
  hideForwardTag: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect(): void;
  onReply(): void;
  onInfo(): void;
  onEnterSelect(): void;
  onPinChanged(): void;
  onEdit(m: ChatMessage): void;
}

const MessageBubble = forwardRef<HTMLDivElement, Props>(function MessageBubbleInner(
  { message: m, mine, meId, chat, isAdmin, tail, hideForwardTag, selectMode, selected, onToggleSelect, onReply, onInfo, onEnterSelect, onPinChanged, onEdit }: Props,
  ref,
) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [reactBar, setReactBar] = useState(false);
  const [imgOpen, setImgOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  // self-destruct countdown ticker
  const [, force] = useState(0);
  useEffect(() => {
    if (!m.selfDestructAt) return;
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [m.selfDestructAt]);

  const toggleReaction = (emoji: string) => {
    setReactBar(false);
    backend.toggleReaction(chat.id, m.id, emoji).catch(() => {});
  };

  const doDelete = (forEveryone: boolean) => {
    setDelOpen(false);
    backend.deleteMessage(chat.id, m.id, forEveryone).catch(() => {});
  };

  const doPin = () => {
    setMenu(null);
    const fn = m.isPinned ? backend.unpinMessage(chat.id, m.id) : backend.pinMessage(chat.id, m.id);
    fn.then(onPinChanged).catch(() => {});
  };

  const doStar = () => {
    setMenu(null);
    backend.starMessage(m.id, true).catch(() => {});
  };

  const doCopy = () => {
    setMenu(null);
    if (m.text) navigator.clipboard?.writeText(m.text).catch(() => {});
  };

  const pickMenu = (id: string) => {
    setMenu(null);
    if (id === 'reply') onReply();
    else if (id === 'react') setReactBar(true);
    else if (id === 'forward' || id === 'select') onEnterSelect();
    else if (id === 'star') doStar();
    else if (id === 'pin') doPin();
    else if (id === 'info') onInfo();
    else if (id === 'copy') doCopy();
    else if (id === 'edit') onEdit(m);
    else if (id === 'delete') setDelOpen(true);
  };

  // deleted-for-everyone placeholder
  if (m.deletedEveryone) {
    return (
      <div ref={ref} className="flex mb-[3px] scroll-mt-24">
        <div className={`max-w-[72%] ${mine ? 'ml-auto' : 'mr-auto'}`}>
          <div className={`px-3 py-2 rounded-xl shadow ${mine ? 'bg-[#005c4b] rounded-tr-[4px]' : 'bg-[#1f2c34] rounded-tl-[4px]'} ${tail ? (mine ? 'v4tail v4tail-out' : 'v4tail v4tail-in') : ''}`}>
            <p className="text-[13.5px] italic text-[#8696a0] flex items-center gap-1.5">
              <Icon d={ICONS.eyeOff} size={15} />
              {mine ? 'Aap ne yeh message delete kiya' : 'Yeh message delete kar diya gaya'}
            </p>
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <span className="text-[10.5px] text-[#8696a0]">{fmtTime(m.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const menuActions: MenuAction[] = [
    { id: 'reply', label: 'Jawab dein', icon: 'reply', tint: '#00a884' },
    { id: 'react', label: 'React karein', sub: 'Emoji se jawab', icon: 'emoji', tint: '#ff9f1c', dividerAfter: true },
    { id: 'forward', label: 'Forward karein', icon: 'forward', tint: '#53bdeb' },
    { id: 'star', label: 'Star karein', sub: 'Baad me dekhne ke liye', icon: 'star', tint: '#ff9f1c' },
    ...(m.type === 'text' && m.text ? [{ id: 'copy', label: 'Copy karein', icon: 'copy', tint: '#7f66ff' } as MenuAction] : []),
    ...(mine && m.type === 'text' ? [{ id: 'edit', label: 'Edit karein', icon: 'edit', tint: '#00a884' } as MenuAction] : []),
    ...((isAdmin || mine) ? [{ id: 'pin', label: m.isPinned ? 'Unpin karein' : 'Pin karein', icon: 'pin', tint: '#00a884' } as MenuAction] : []),
    ...(mine ? [{ id: 'info', label: 'Message info', sub: 'Delivered / read', icon: 'info', tint: '#7f66ff' } as MenuAction] : []),
    { id: 'select', label: 'Select karein', icon: 'check', tint: '#8696a0', dividerAfter: true },
    { id: 'delete', label: 'Delete karein', sub: 'Mere liye ya sab ke liye', icon: 'trash', danger: true },
  ];

  const selfDestructLeft = m.selfDestructAt ? m.selfDestructAt - Date.now() : 0;
  const shape = mine ? 'rounded-xl rounded-tr-[4px]' : 'rounded-xl rounded-tl-[4px]';
  const tailCls = tail && !selectMode ? (mine ? 'v4tail v4tail-out' : 'v4tail v4tail-in') : '';

  return (
    <div ref={ref} className="flex mb-[3px] scroll-mt-24 v4msgin">
      {selectMode && (
        <button onClick={onToggleSelect} className="mr-1.5 self-center p-1 shrink-0" aria-label="Select">
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${selected ? 'bg-[#00a884] border-[#00a884]' : 'border-[#8696a0]'}`}>
            {selected && <Icon d={ICONS.check} size={13} className="text-white" />}
          </span>
        </button>
      )}
      <div className={`max-w-[70%] min-[1200px]:max-w-[62%] ${mine ? 'ml-auto' : 'mr-auto'}`}>
        <div
          onClick={() => selectMode && onToggleSelect()}
          onContextMenu={(e) => {
            e.preventDefault();
            if (!selectMode) setMenu({ x: e.clientX, y: e.clientY });
          }}
          className={`relative group px-2.5 pt-1.5 pb-1 ${shape} ${tailCls} shadow-md transition ${
            mine ? 'bg-[#005c4b]' : 'bg-[#1f2c34]'
          } ${selected ? 'ring-2 ring-[#00a884]' : ''} ${selectMode ? 'cursor-pointer' : ''}`}
        >
          {m.isPinned && (
            <div className="flex items-center gap-1 text-[10.5px] text-[#00a884] font-medium mb-0.5">
              <Icon d={ICONS.pin} size={11} /> Pinned
            </div>
          )}
          {!mine && chat.type === 'group' && (
            <p className="text-[12.5px] font-semibold leading-tight mb-0.5" style={{ color: senderColor(m.senderName || '?') }}>
              {m.senderName}
            </p>
          )}
          {m.replyTo && (
            <div className={`rounded-lg px-2.5 py-1.5 mb-1 border-l-[3px] ${mine ? 'bg-black/15' : 'bg-[#0b141a]/60'} cursor-pointer`} style={{ borderColor: senderColor(m.replyTo.senderName || '?') }}>
              <p className="text-[12px] font-semibold leading-tight" style={{ color: senderColor(m.replyTo.senderName || '?') }}>{m.replyTo.senderName}</p>
              <p className="text-[12.5px] text-[#d1d7db] truncate leading-snug">{m.replyTo.text}</p>
            </div>
          )}
          {m.forwarded && !hideForwardTag && (
            <p className="text-[11.5px] italic text-[#8696a0] mb-0.5 flex items-center gap-1">
              <Icon d={ICONS.forward} size={12} />
              {m.forwardCount && m.forwardCount >= 5 ? 'Forwarded many times' : 'Forwarded'}
            </p>
          )}

          <MsgBody m={m} meId={meId} chatId={chat.id} mine={mine} onImage={() => setImgOpen(true)} />

          {/* reactions */}
          {m.reactions && Object.keys(m.reactions).length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {Object.entries(m.reactions).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(emoji)}
                  className={`text-[13px] px-1.5 py-[1px] rounded-full border transition ${
                    users.includes(meId) ? 'border-[#00a884] bg-[#00a884]/15' : 'border-[#2a3942] bg-[#0b141a]/40'
                  }`}
                  title={users.join(', ')}
                >
                  {emoji} <span className="text-[11px] text-[#8696a0]">{users.length}</span>
                </button>
              ))}
            </div>
          )}

          {/* meta row */}
          <div className="flex items-center justify-end gap-1 mt-0.5 select-none">
            {m.selfDestructAt && selfDestructLeft > 0 && (
              <span className="flex items-center gap-0.5 text-[10.5px] text-[#ff9f1c] mr-0.5" title="Self-destruct">
                <Icon d={ICONS.timer} size={11} />
                {selfDestructLeft < 60000 ? `${Math.ceil(selfDestructLeft / 1000)}s` : `${Math.ceil(selfDestructLeft / 60000)}m`}
              </span>
            )}
            {m.editedAt && <span className="text-[10.5px] italic text-[#8696a0]">edited</span>}
            <span className="text-[10.5px] text-[#8696a0]">{fmtTime(m.createdAt)}</span>
            {mine && <Ticks state={tickState(m, chat)} />}
          </div>

          {/* hover quick actions */}
          {!selectMode && (
            <div className={`absolute -top-3.5 ${mine ? '-left-1' : '-right-1'} hidden group-hover:flex items-center gap-0.5 bg-[#111b21] border border-[#222d34] rounded-full px-1 py-0.5 shadow-xl z-10 animate-[v4pop_.12s_ease-out]`}>
              <button onClick={() => setReactBar((v) => !v)} className="p-1 text-[#8696a0] hover:text-[#e9edef]" title="React">
                <Icon d={ICONS.emoji} size={17} />
              </button>
              <button onClick={onReply} className="p-1 text-[#8696a0] hover:text-[#e9edef]" title="Jawab dein">
                <Icon d={ICONS.reply} size={17} />
              </button>
              <button onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenu({ x: r.left, y: r.bottom + 6 }); }} className="p-1 text-[#8696a0] hover:text-[#e9edef]" title="Options">
                <Icon d={ICONS.chevDown} size={17} />
              </button>
            </div>
          )}

          {/* quick react bar */}
          {reactBar && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setReactBar(false)} />
              <div className={`absolute z-[61] ${mine ? 'right-0' : 'left-0'} -top-12 bg-[#111b21] border border-[#222d34] rounded-full shadow-2xl animate-[v4pop_.15s_ease-out]`}>
                <div className="flex gap-0.5 px-2.5 py-1.5">
                  {QUICK_EMOJIS.map((e) => (
                    <button key={e} onClick={() => toggleReaction(e)} className="text-[23px] hover:scale-125 transition p-0.5">
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {menu && <BubbleMenu x={menu.x} y={menu.y} actions={menuActions} onPick={pickMenu} onClose={() => setMenu(null)} />}

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
    </div>
  );
});

export default MessageBubble;

// ---------- right-click menu ----------

function BubbleMenu({
  x, y, actions, onPick, onClose,
}: {
  x: number; y: number; actions: MenuAction[]; onPick(id: string): void; onClose(): void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [pos, setPos] = useState({ left: x, top: y });
  useEffect(() => {
    setPos({
      left: Math.min(x, window.innerWidth - 300),
      top: Math.min(y, window.innerHeight - actions.length * 52 - 20),
    });
  }, [x, y, actions.length]);

  return (
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        className="fixed z-[71] bg-[#111b21] border border-[#222d34] rounded-2xl shadow-2xl py-2 min-w-[250px] max-w-[280px] overflow-hidden animate-[v4pop_.15s_ease-out]"
        style={{ left: Math.max(8, pos.left), top: Math.max(8, pos.top) }}
      >
        {actions.map((a) => (
          <div key={a.id}>
            <button
              onClick={() => onPick(a.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition group ${
                a.danger ? 'text-[#ea0038] hover:bg-[#ea0038]/[0.07]' : 'text-[#e9edef] hover:bg-[#1f2c34]'
              }`}
            >
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                style={{
                  background: a.danger ? 'rgba(234,0,56,.12)' : `${a.tint ?? '#8696a0'}1a`,
                  color: a.danger ? '#ea0038' : a.tint ?? '#8696a0',
                }}
              >
                <Icon d={ICONS[a.icon]} size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium leading-tight">{a.label}</span>
                {a.sub && <span className="block text-[11.5px] text-[#8696a0] leading-tight mt-0.5">{a.sub}</span>}
              </span>
            </button>
            {a.dividerAfter && <div className="mx-3.5 my-1 border-t border-[#222d34]" />}
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- message body per type ----------

function MsgBody({ m, meId, chatId, mine, onImage }: { m: ChatMessage; meId: string; chatId: string; mine: boolean; onImage(): void }) {
  if (m.type === 'image' && m.mediaURL) {
    return (
      <div className="mb-1 -mx-1 -mt-0.5">
        <img
          src={m.mediaURL}
          alt=""
          onClick={onImage}
          className="rounded-lg max-h-[320px] w-full object-cover cursor-zoom-in"
          loading="lazy"
          draggable={false}
        />
        {m.text && <p className="text-[14.2px] text-[#e9edef] whitespace-pre-wrap break-words leading-snug mt-1 px-1">{m.text}</p>}
      </div>
    );
  }
  if (m.type === 'audio' && m.mediaURL) {
    return (
      <div className="py-0.5">
        <VoicePlayer url={m.mediaURL} duration={m.duration ?? 0} />
        {m.text && <p className="text-[14.2px] text-[#e9edef] whitespace-pre-wrap break-words mt-1">{m.text}</p>}
      </div>
    );
  }
  if (m.type === 'file' && m.mediaURL) {
    return (
      <a
        href={m.mediaURL}
        target="_blank"
        rel="noreferrer"
        download={m.fileName}
        className="flex items-center gap-2.5 py-1 pr-1 w-full hover:opacity-90 transition"
      >
        <span className="w-11 h-11 rounded-full bg-[#2a3942] flex items-center justify-center shrink-0">
          <Icon d={ICONS.file} size={21} className="text-[#8696a0]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] text-[#e9edef] truncate max-w-[210px]">{m.fileName || 'File'}</span>
          <span className="block text-[11.5px] text-[#8696a0]">
            {m.fileSize ? `${(m.fileSize / 1024).toFixed(0)} KB · ` : ''}Download karein
          </span>
        </span>
        <Icon d={ICONS.download} size={17} className="text-[#8696a0] shrink-0" />
      </a>
    );
  }
  if (m.type === 'contact' && m.contact) {
    return (
      <div className="flex items-center gap-3 py-1 min-w-[220px]">
        <span className="w-11 h-11 rounded-full bg-[#2a3942] flex items-center justify-center shrink-0">
          <Icon d={ICONS.user} size={22} className="text-[#8696a0]" />
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] text-[#e9edef] font-medium truncate">{m.contact.name}</span>
          <span className="block text-[12px] text-[#8696a0] truncate">{m.contact.phone || m.contact.email || 'Contact'}</span>
        </span>
      </div>
    );
  }
  if (m.type === 'location' && m.lat != null && m.lng != null) {
    const maps = `https://www.google.com/maps?q=${m.lat},${m.lng}`;
    return (
      <a href={maps} target="_blank" rel="noreferrer" className="block min-w-[230px] hover:opacity-95 transition">
        <span className="flex items-center gap-2 py-1">
          <span className="w-10 h-10 rounded-full bg-[#00a884]/15 flex items-center justify-center shrink-0">
            <Icon d={ICONS.location} size={20} className="text-[#00a884]" />
          </span>
          <span className="text-[13.5px] text-[#e9edef]">
            Location
            <span className="block text-[11.5px] text-[#8696a0]">Maps me kholein</span>
          </span>
        </span>
      </a>
    );
  }
  if (m.type === 'poll' && m.poll) {
    return <PollView m={m} meId={meId} chatId={chatId} mine={mine} />;
  }
  return (
    <p className="text-[14.2px] text-[#e9edef] whitespace-pre-wrap break-words leading-[1.45] px-0.5">
      {m.text}
    </p>
  );
}

// ---------- poll ----------

function PollView({ m, meId, chatId, mine }: { m: ChatMessage; meId: string; chatId: string; mine: boolean }) {
  const poll = m.poll!;
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const totals = poll.options.map((_, i) => poll.votes[String(i)]?.length ?? 0);
  const total = totals.reduce((a, b) => a + b, 0);
  const myIdx = poll.options.findIndex((_, i) => poll.votes[String(i)]?.includes(meId));
  const deadlinePassed = m.pollDeadline ? Date.now() > m.pollDeadline : false;

  return (
    <div className="min-w-[240px] max-w-[310px] py-1">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon d={ICONS.poll} size={17} className="text-[#00a884]" />
        <p className="text-[14px] font-semibold text-[#e9edef] leading-snug">{poll.question}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {poll.options.map((opt, i) => {
          const pct = total > 0 ? Math.round((totals[i] / total) * 100) : 0;
          const isMine = myIdx === i;
          return (
            <button
              key={i}
              disabled={deadlinePassed}
              onClick={() => backend.votePoll(chatId, m.id, i).catch(() => {})}
              className={`relative overflow-hidden rounded-lg border text-left transition ${
                isMine ? 'border-[#00a884]' : 'border-[#2a3942] hover:border-[#8696a0]'
              } ${deadlinePassed ? 'opacity-60 cursor-default' : ''}`}
            >
              <span className="absolute inset-y-0 left-0 bg-[#00a884]/15 transition-all" style={{ width: `${pct}%` }} />
              <span className="relative flex items-center justify-between px-2.5 py-1.5">
                <span className="text-[13.5px] text-[#e9edef] truncate">{opt}</span>
                <span className="text-[12px] text-[#8696a0] shrink-0 ml-2">{pct}%</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-[11.5px] text-[#8696a0]">
          {total} vote{total === 1 ? '' : 's'}
          {deadlinePassed ? ' · band ho gaya' : m.pollDeadline ? ` · ${fmtTime(m.pollDeadline)} tak` : ''}
        </p>
        <button onClick={() => setAnalyticsOpen(true)} className="text-[11.5px] text-[#00a884] hover:underline">
          Details
        </button>
      </div>
      {analyticsOpen && <PollAnalyticsModal messageId={m.id} chatId={chatId} question={poll.question} onClose={() => setAnalyticsOpen(false)} />}
    </div>
  );
}

function PollAnalyticsModal({ messageId, chatId, question, onClose }: { messageId: string; chatId: string; question: string; onClose(): void }) {
  const [data, setData] = useState<{ option: string; votes: number; voterIds: string[] }[] | null>(null);
  const [deadline, setDeadline] = useState('');
  useEffect(() => {
    v4call(() => backendV2.getPollAnalytics(messageId)).then((a) => { if (a) setData(a.perOption); });
  }, [messageId]);
  const setDl = async () => {
    if (!deadline) return;
    const ts = new Date(deadline).getTime();
    if (ts > Date.now()) await v4call(() => backendV2.setPollDeadline(messageId, ts));
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#111b21] rounded-2xl border border-[#222d34] w-full max-w-[400px] p-5 animate-[v4pop_.18s_ease-out]">
        <h3 className="text-[15px] font-medium mb-3 truncate">{question}</h3>
        {!data && <p className="text-[13px] text-[#8696a0]">Load ho raha hai…</p>}
        {data?.map((o, i) => (
          <div key={i} className="py-2 border-b border-[#222d34] last:border-0">
            <div className="flex justify-between text-[13.5px]">
              <span className="text-[#e9edef] truncate">{o.option}</span>
              <span className="text-[#8696a0] shrink-0 ml-2">{o.votes} votes</span>
            </div>
          </div>
        ))}
        <p className="text-[13px] text-[#8696a0] mt-4 mb-1.5">Voting deadline (optional)</p>
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="flex-1 bg-[#1f2c34] rounded-lg px-3 py-2 text-[13px] outline-none text-[#e9edef]"
          />
          <button onClick={setDl} className="px-4 rounded-lg bg-[#00a884] text-white text-[13px] font-medium">Set</button>
        </div>
      </div>
    </div>
  );
}

// ---------- voice player ----------

function VoicePlayer({ url, duration }: { url: string; duration: number }) {
  const [el, setEl] = useState<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);

  const toggle = () => {
    if (!el) return;
    if (playing) el.pause();
    else el.play().catch(() => {});
  };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2 min-w-[215px] max-w-[280px]">
      <audio
        ref={setEl}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setT((e.target as HTMLAudioElement).currentTime)}
        onEnded={() => { setPlaying(false); setT(0); }}
      />
      <button
        onClick={toggle}
        className="w-9 h-9 rounded-full bg-[#00a884] text-white flex items-center justify-center shrink-0 hover:brightness-110 transition"
        aria-label={playing ? 'Rokein' : 'Chalayein'}
      >
        <Icon d={playing ? ICONS.pause : ICONS.play} size={16} filled />
      </button>
      <div className="flex-1 min-w-0">
        <input
          type="range"
          min={0}
          max={Math.max(duration, t, 1)}
          step={0.1}
          value={t}
          onChange={(e) => { if (el) el.currentTime = Number(e.target.value); }}
          className="w-full accent-[#00a884] h-1 cursor-pointer"
        />
        <p className="text-[11px] text-[#8696a0]">{fmt(t)} / {fmt(duration || t)}</p>
      </div>
      <Icon d={ICONS.mic} size={17} className="text-[#8696a0] shrink-0" />
    </div>
  );
}
