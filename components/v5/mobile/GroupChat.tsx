'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { backend } from '@/lib/backend';
import {
  BellOffIcon,
  CheckIcon,
  CrownIcon,
  DoubleCheckIcon,
  ImageIcon,
  MicIcon,
  PauseIcon,
  PlayIcon,
  SendIcon,
  SlashIcon,
  TrashIcon,
  XIcon,
} from './icons';
import VoiceRecorder from './VoiceRecorder';
import type { Chat, ChatMessage, UserProfile, V5Backend } from './v5types';
import { MAIN_GROUP_NAME, OWNER_DISPLAY_NAME, fmtCountdown, fmtDateChip, fmtDur, fmtTime } from './v5types';
import './v5-mobile.css';

const b = backend as unknown as V5Backend;

interface MuteState {
  muted: boolean;
  until: number | null;
}

interface CmdDef {
  cmd: string;
  desc: string;
  usage: string;
  needsMember?: boolean;
}

const COMMANDS: CmdDef[] = [
  { cmd: 'mute', desc: 'kisi member ko mute karo', usage: '/mute naam minutes', needsMember: true },
  { cmd: 'unmute', desc: 'member ka mute hatao', usage: '/unmute naam', needsMember: true },
  { cmd: 'announce', desc: 'sab ko announcement bhejo', usage: '/announce text' },
];

/** deterministic pseudo-waveform bars from message id */
function waveBars(seed: string, n = 36): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: n }, (_, i) => {
    const v = ((h >> (i % 16)) ^ (h * (i + 7))) >>> 0;
    return 6 + (v % 24);
  });
}

/**
 * GroupChat — v5 single-group screen. Koi chat list nahi, koi DM nahi,
 * sirf "Madrasa Group". Owner = sheraz (Owner badge), baqi sab Member.
 */
export default function GroupChat() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [group, setGroup] = useState<Chat | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [mute, setMute] = useState<MuteState>({ muted: false, until: null });
  const [now, setNow] = useState(Date.now());
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sheetMsg, setSheetMsg] = useState<ChatMessage | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const msgsRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);
  const nearBottom = useRef(true);
  const isOwner = useMemo(() => {
    try { return b.isOwner(); } catch { return false; }
  }, [user]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // ---- mute status (backend deta hai { muted, remainingMs }) ----
  const refreshMute = useCallback(async (): Promise<MuteState | null> => {
    try {
      const m = await b.isMuted();
      return { muted: m.muted, until: m.muted ? Date.now() + m.remainingMs : null };
    } catch {
      return null;
    }
  }, []);

  // ---- optimistic temp messages: tempId -> signature ----
  // Real INSERT aate hi temp se swap ho jata hai (duplicate nahi banta).
  const pendingTemps = useRef(new Map<string, string>());
  const tempSig = (senderId: string, m: { type: string; text: string; mediaURL?: string; fileName?: string }) =>
    `${senderId}|${m.type}|${m.text}|${m.mediaURL || ''}|${m.fileName || ''}`;

  /** temp message list me daalo + pending mark karo */
  function trackTemp(temp: ChatMessage) {
    pendingTemps.current.set(temp.id, tempSig(temp.senderId, temp));
    setMessages(prev => [...prev, temp].sort((x, y) => x.createdAt - y.createdAt));
    setPendingIds(prev => new Set(prev).add(temp.id));
  }

  /** temp hatao (send fail hone par) */
  function dropTemp(tempId: string) {
    pendingTemps.current.delete(tempId);
    setMessages(prev => prev.filter(m => m.id !== tempId));
    setPendingIds(prev => { const n = new Set(prev); n.delete(tempId); return n; });
  }

  // ---- auth ----
  useEffect(() => {
    const off = backend.onAuth(u => setUser(u));
    return off;
  }, []);

  // ---- group join + subscriptions ----
  useEffect(() => {
    if (!user) return;
    let offMsgs: (() => void) | null = null;
    let offPayload: (() => void) | null = null;
    let offPresence: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const id = await b.ensureMemberAutoJoin();
        if (cancelled) return;
        setGroupId(id);
        try {
          const g = await b.getMainGroup();
          if (!cancelled && g) setGroup(g);
        } catch { /* group basic info optional */ }

        b.trackPresence();
        offPresence = b.onPresenceChange(state => {
          if (!cancelled) setOnlineCount(Object.keys(state).length);
        });

        const merge = (list: ChatMessage[]) => {
          if (cancelled) return;
          const mine = user.id;
          const visible = list.filter(m => !m.deletedFor?.includes(mine));
          setMessages(prev => {
            // apne temp messages mehfooz rakho — real INSERT aane par swap honge
            const temps = prev.filter(m => m.id.startsWith('tmp_') && pendingTemps.current.has(m.id));
            return [...visible, ...temps].sort((x, y) => x.createdAt - y.createdAt);
          });
          // pending ids jo ab real list me hain, hata do
          setPendingIds(prev => {
            const ids = new Set(list.map(m => m.id));
            const next = new Set(prev);
            prev.forEach(p => { if (ids.has(p)) next.delete(p); });
            return next;
          });
        };
        offMsgs = backend.onMessages(id, merge);
        offPayload = b.onMessagePayload(id, (msg, event) => {
          if (cancelled) return;
          if (event === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== msg.id));
            return;
          }
          if (msg.deletedFor?.includes(user.id)) return;
          // apna temp message ho to real se swap karo (duplicate nahi)
          const sig = tempSig(msg.senderId, msg);
          let swapTemp: string | null = null;
          for (const [tid, tsig] of pendingTemps.current) {
            if (tsig === sig) { swapTemp = tid; break; }
          }
          if (swapTemp) {
            pendingTemps.current.delete(swapTemp);
            const tid = swapTemp;
            setPendingIds(prev => { const n = new Set(prev); n.delete(tid); return n; });
            setMessages(prev => prev.map(m => (m.id === tid ? msg : m)));
            return;
          }
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) {
              return prev.map(m => (m.id === msg.id ? msg : m));
            }
            return [...prev, msg].sort((x, y) => x.createdAt - y.createdAt);
          });
        });

        const m = await refreshMute();
        if (!cancelled && m) setMute(m);
      } catch (e) {
        if (!cancelled) showToast(e instanceof Error ? e.message : 'Group load nahi ho saka');
      }
    })();

    return () => {
      cancelled = true;
      offMsgs?.();
      offPayload?.();
      offPresence?.();
    };
  }, [user, showToast, refreshMute]);

  // ---- mute refresh + countdown tick ----
  useEffect(() => {
    if (!user) return;
    const iv = window.setInterval(async () => {
      setNow(Date.now());
      const m = await refreshMute();
      if (m) setMute(prev => (prev.muted === m.muted && prev.until === m.until ? prev : m));
    }, 1000);
    return () => clearInterval(iv);
  }, [user, refreshMute]);

  // ---- auto scroll ----
  useEffect(() => {
    if (nearBottom.current && msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }
  }, [messages]);

  // ---- mark read ----
  useEffect(() => {
    if (!groupId || messages.length === 0) return;
    const t = window.setTimeout(() => backend.markRead(groupId).catch(() => {}), 800);
    return () => clearTimeout(t);
  }, [groupId, messages.length]);

  const ownerId = useMemo(() => {
    const admins = group?.adminIds;
    return admins && admins.length > 0 ? admins[0] : null;
  }, [group]);

  const memberNames = useMemo(() => {
    const profs = group?.participantProfiles || {};
    return Object.entries(profs).map(([id, p]) => ({ id, name: p.displayName || 'Member' }));
  }, [group]);

  // ---- command dropdown ----
  const showCmds = isOwner && text.startsWith('/') && !text.includes('\n');
  const cmdQuery = showCmds ? text.slice(1).split(' ')[0].toLowerCase() : '';
  const cmdRest = showCmds ? text.slice(1).split(' ').slice(1).join(' ') : '';
  const matchedCmd = COMMANDS.find(c => c.cmd === cmdQuery);
  const cmdSuggestions = useMemo(() => {
    if (!showCmds) return [];
    if (matchedCmd?.needsMember && cmdRest.length > 0) {
      // member name suggestions
      return memberNames
        .filter(m => m.name.toLowerCase().includes(cmdRest.toLowerCase()))
        .slice(0, 5)
        .map(m => ({ kind: 'member' as const, label: m.name, insert: `/${matchedCmd.cmd} ${m.name} ` }));
    }
    return COMMANDS.filter(c => c.cmd.startsWith(cmdQuery)).map(c => ({
      kind: 'cmd' as const,
      label: `/${c.cmd}`,
      desc: c.desc,
      usage: c.usage,
      insert: `/${c.cmd} `,
    }));
  }, [showCmds, cmdQuery, cmdRest, matchedCmd, memberNames]);

  async function handleSend() {
    const t = text.trim();
    if (!t || !groupId || mute.muted || !user) return;
    // owner command? (desktop jaisa: "/" se shuru ho to command hi samjho)
    if (isOwner && t.startsWith('/')) {
      setText('');
      try {
        const parsed = b.parseCommand(t);
        if (!parsed) throw new Error('Command samajh nahi aaya');
        const res = await b.executeCommand(parsed.command, parsed.args, groupId);
        showToast(res.text || 'Ho gaya ✓');
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Command nahi chala');
        setText(t);
      }
      return;
    }
    setText('');
    const sender = { id: user.id, displayName: user.displayName };
    const { temp, sent } = b.sendMessageOptimistic(groupId, { type: 'text', text: t }, sender);
    trackTemp(temp);
    sent.catch(e => {
      dropTemp(temp.id);
      showToast(e instanceof Error ? e.message : 'Message nahi bheja ja saka');
      setText(t);
    });
  }

  async function handleVoiceSend(blob: Blob, durSec: number) {
    setRecording(false);
    if (!groupId || !user) return;
    try {
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
      const up = await backend.uploadMedia(groupId, file);
      const { temp, sent } = b.sendMessageOptimistic(groupId, {
        type: 'audio',
        text: '',
        mediaURL: up.url,
        duration: durSec,
        fileName: file.name,
        fileSize: file.size,
      }, { id: user.id, displayName: user.displayName });
      trackTemp(temp);
      sent.catch(e => {
        dropTemp(temp.id);
        showToast(e instanceof Error ? e.message : 'Voice note nahi bheja ja saka');
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Voice note nahi bheja ja saka');
    }
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !groupId || !user) return;
    showToast('Photo bheji ja rahi hai…');
    try {
      const up = await backend.uploadMedia(groupId, f);
      const { temp, sent } = b.sendMessageOptimistic(groupId, {
        type: 'image',
        text: '',
        mediaURL: up.url,
        fileName: f.name,
        fileSize: f.size,
      }, { id: user.id, displayName: user.displayName });
      trackTemp(temp);
      sent.catch(err => {
        dropTemp(temp.id);
        showToast(err instanceof Error ? err.message : 'Photo nahi bheji ja saki');
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Photo nahi bheji ja saki');
    }
  }

  // ---- long-press → delete sheet ----
  const lpTimer = useRef<number | null>(null);
  function lpStart(m: ChatMessage) {
    lpTimer.current = window.setTimeout(() => setSheetMsg(m), 550);
  }
  function lpEnd() {
    if (lpTimer.current) clearTimeout(lpTimer.current);
  }

  async function doDelete(mode: 'me' | 'everyone') {
    if (!sheetMsg || !groupId) return;
    const id = sheetMsg.id;
    setSheetMsg(null);
    try {
      await b.deleteMessage(groupId, id, mode === 'everyone');
      if (mode === 'me') {
        setMessages(prev => prev.filter(m => m.id !== id));
        showToast('Aapke liye delete ho gaya');
      } else {
        // hard delete — server se gayab, koi placeholder nahi
        setMessages(prev => prev.filter(m => m.id !== id));
        showToast('Sab ke liye delete ho gaya');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Delete nahi ho saka');
    }
  }

  // ---- date chips ke sath grouped render ----
  const rendered = useMemo(() => {
    const out: Array<{ kind: 'date'; label: string } | { kind: 'msg'; msg: ChatMessage }> = [];
    let lastDay = '';
    for (const m of messages) {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay) {
        lastDay = day;
        out.push({ kind: 'date', label: fmtDateChip(m.createdAt) });
      }
      out.push({ kind: 'msg', msg: m });
    }
    return out;
  }, [messages]);

  if (!user) {
    return (
      <div className="v5-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="v5-typing-bubble" aria-label="Loading">
          <span className="v5-tdot" />
          <span className="v5-tdot" />
          <span className="v5-tdot" />
        </div>
      </div>
    );
  }

  const mutedActive = mute.muted && (!mute.until || mute.until > now);
  const typingNames = Object.entries(group?.typing || {})
    .filter(([, ts]) => Date.now() - ts < 6000)
    .map(([uid]) => group?.participantProfiles?.[uid]?.displayName)
    .filter(Boolean) as string[];

  return (
    <div className="v5-root" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ---- Header ---- */}
      <header className="v5-header">
        <div className="v5-avatar" aria-hidden>
          {group?.photoURL ? <img src={group.photoURL} alt="" /> : 'M'}
        </div>
        <div className="v5-header-titles">
          <div className="v5-header-name">{group?.name || MAIN_GROUP_NAME}</div>
          <div className="v5-header-sub">
            {typingNames.length > 0 ? (
              <span style={{ color: '#00e6a8' }}>{typingNames[0]} likh raha hai…</span>
            ) : (
              <>
                {onlineCount > 0 && <span className="v5-online-dot">● {onlineCount} online</span>}
                {onlineCount > 0 && ' • '}
                Owner: {OWNER_DISPLAY_NAME}
              </>
            )}
          </div>
        </div>
      </header>

      {/* ---- Mute banner ---- */}
      {mutedActive && (
        <div className="v5-mute-banner" role="alert">
          <BellOffIcon size={20} />
          <span style={{ flex: 1 }}>
            Owner ne aapko mute kiya hai —{' '}
            {mute.until ? <span className="v5-mute-timer">{fmtCountdown(mute.until, now)}</span> : 'kuch der ke liye'}
          </span>
        </div>
      )}

      {/* ---- Messages ---- */}
      <div
        className="v5-msgs"
        ref={msgsRef}
        onScroll={e => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
      >
        {rendered.length === 0 && (
          <div style={{ textAlign: 'center', color: '#8696a0', marginTop: 40, padding: '0 32px', fontSize: 14, lineHeight: 1.6 }}>
            Abhi koi message nahi hai.
            <br />
            Pehla salaam bhejo! 👋
          </div>
        )}
        {rendered.map((item, i) =>
          item.kind === 'date' ? (
            <div key={`d-${i}`} className="v5-date-chip">{item.label}</div>
          ) : (
            <MessageBubble
              key={item.msg.id}
              msg={item.msg}
              mine={item.msg.senderId === user.id}
              isOwnerMsg={ownerId ? item.msg.senderId === ownerId : item.msg.senderId === user.id && isOwner}
              pending={pendingIds.has(item.msg.id)}
              onLongPress={lpStart}
              onLongPressEnd={lpEnd}
            />
          )
        )}
      </div>

      {/* ---- Composer / recording ---- */}
      {!mutedActive && (
        <div className="v5-composer-wrap">
          {showCmds && cmdSuggestions.length > 0 && (
            <div className="v5-cmd-dropdown">
              {cmdSuggestions.map(s =>
                s.kind === 'cmd' ? (
                  <button
                    key={s.label}
                    className="v5-cmd-item"
                    onClick={() => setText(s.insert)}
                  >
                    <SlashIcon size={20} color="#00e6a8" />
                    <span>
                      <span className="v5-cmd-name">{s.label}</span>
                      <br />
                      <span className="v5-cmd-desc">{s.desc} • {s.usage}</span>
                    </span>
                  </button>
                ) : (
                  <button
                    key={s.label}
                    className="v5-cmd-item"
                    onClick={() => setText(s.insert)}
                  >
                    <span className="v5-avatar" style={{ width: 32, height: 32, fontSize: 14 }}>
                      {s.label.charAt(0).toUpperCase()}
                    </span>
                    <span className="v5-cmd-name" style={{ color: '#e9edef' }}>{s.label}</span>
                  </button>
                )
              )}
            </div>
          )}
          <div className="v5-composer">
            {recording ? (
              <VoiceRecorder
                onSend={handleVoiceSend}
                onCancel={() => setRecording(false)}
                onError={msg => { setRecording(false); showToast(msg); }}
              />
            ) : (
              <>
                <div className="v5-input-pill">
                  <textarea
                    className="v5-input"
                    rows={1}
                    value={text}
                    onChange={e => {
                      setText(e.target.value);
                      if (groupId) backend.setTyping(groupId, e.target.value.length > 0).catch(() => {});
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={isOwner ? 'Message likhein… ( / commands ke liye )' : 'Message likhein…'}
                    aria-label="Message likhein"
                  />
                  <button
                    className="v5-icon-btn"
                    onClick={() => fileRef.current?.click()}
                    aria-label="Photo bhejo"
                  >
                    <ImageIcon size={24} />
                  </button>
                </div>
                {text.trim() ? (
                  <button className="v5-round-btn v5-touch" onClick={handleSend} aria-label="Bhej do">
                    <SendIcon size={22} />
                  </button>
                ) : (
                  <button
                    className="v5-round-btn v5-touch"
                    onClick={() => setRecording(true)}
                    aria-label="Voice note record karo"
                  >
                    <MicIcon size={22} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {mutedActive && (
        <div style={{ padding: '10px 16px calc(12px + env(safe-area-inset-bottom))', textAlign: 'center', color: '#8696a0', fontSize: 13 }}>
          Aap mute hain — sirf parh sakte hain 👀
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImagePick}
      />

      {/* ---- Delete action sheet ---- */}
      {sheetMsg && (
        <div className="v5-sheet-backdrop" onClick={() => setSheetMsg(null)}>
          <div className="v5-sheet" onClick={e => e.stopPropagation()}>
            <div className="v5-sheet-grab" />
            <button className="v5-sheet-item" onClick={() => doDelete('me')}>
              <TrashIcon size={22} color="#aebac1" />
              Mere liye delete karo
            </button>
            {isOwner && (
              <button className="v5-sheet-item danger" onClick={() => doDelete('everyone')}>
                <TrashIcon size={22} />
                Sab ke liye delete karo
              </button>
            )}
            <button className="v5-sheet-item" onClick={() => setSheetMsg(null)}>
              <XIcon size={22} color="#8696a0" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {toast && <div className="v5-toast">{toast}</div>}
    </div>
  );
}

/** single message bubble with Member/Owner badge */
function MessageBubble({
  msg,
  mine,
  isOwnerMsg,
  pending,
  onLongPress,
  onLongPressEnd,
}: {
  msg: ChatMessage;
  mine: boolean;
  isOwnerMsg: boolean;
  pending: boolean;
  onLongPress: (m: ChatMessage) => void;
  onLongPressEnd: () => void;
}) {
  const read = msg.readBy && msg.readBy.length > 1;
  return (
    <div className={`v5-msg-row${mine ? ' mine' : ''}`}>
      <div
        className={`v5-msg${mine ? ' mine' : ' theirs'}${pending ? ' v5-msg-pending' : ''}`}
        onTouchStart={() => onLongPress(msg)}
        onTouchEnd={onLongPressEnd}
        onTouchMove={onLongPressEnd}
        onContextMenu={e => {
          e.preventDefault();
          onLongPress(msg);
        }}
      >
        {!mine && (
          <div className="v5-msg-sender">
            {msg.senderName || 'Member'}
            {isOwnerMsg ? (
              <span className="v5-badge v5-badge-owner">
                <CrownIcon size={10} /> Owner
              </span>
            ) : (
              <span className="v5-badge v5-badge-member">Member</span>
            )}
          </div>
        )}
        {mine && isOwnerMsg && (
          <div className="v5-msg-sender">
            <span className="v5-badge v5-badge-owner" style={{ marginLeft: 0 }}>
              <CrownIcon size={10} /> Owner
            </span>
          </div>
        )}
        {msg.type === 'image' && msg.mediaURL && (
          <div className="v5-msg-media">
            <img src={msg.mediaURL} alt="photo" loading="lazy" />
          </div>
        )}
        {msg.type === 'audio' && msg.mediaURL && (
          <VoicePlayer url={msg.mediaURL} duration={msg.duration} mine={mine} seed={msg.id} />
        )}
        {msg.text ? <div className="v5-msg-text">{msg.text}</div> : null}
        <span className="v5-msg-meta">
          {fmtTime(msg.createdAt)}
          {mine && (pending
            ? <CheckIcon size={14} color="rgba(233,237,239,0.5)" />
            : read
              ? <DoubleCheckIcon size={16} blue />
              : <DoubleCheckIcon size={16} color="rgba(233,237,239,0.6)" />
          )}
        </span>
      </div>
    </div>
  );
}

/** WhatsApp-style voice player: play + waveform + duration */
function VoicePlayer({ url, duration, mine, seed }: { url: string; duration?: number; mine: boolean; seed: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(duration || 0);
  const bars = useMemo(() => waveBars(seed), [seed]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onMeta = () => setDur(a.duration || duration || 0);
    const onTime = () => setT(a.currentTime);
    const onEnd = () => { setPlaying(false); setT(0); };
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      a.pause();
    };
  }, [url, duration]);

  const playedCount = dur > 0 ? Math.round((t / dur) * bars.length) : 0;

  return (
    <div className="v5-vplayer">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        className="v5-vplayer-btn v5-touch"
        style={{ width: 40, height: 40, minWidth: 40, minHeight: 40 }}
        onClick={() => {
          const a = audioRef.current;
          if (!a) return;
          if (playing) a.pause();
          else a.play().catch(() => {});
          setPlaying(!playing);
        }}
        aria-label={playing ? 'Roko' : 'Suno'}
      >
        {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
      </button>
      <div className="v5-vplayer-bars" aria-hidden>
        {bars.map((h, i) => (
          <span key={i} className={`v5-vplayer-bar${i < playedCount ? ' played' : ''}`} style={{ height: h }} />
        ))}
      </div>
      <span className="v5-vplayer-dur">{fmtDur(playing ? t : dur)}</span>
    </div>
  );
}
