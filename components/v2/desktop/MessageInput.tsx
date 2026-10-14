'use client';

/**
 * MessageInput — desktop input bar.
 * Emoji picker · attach (photo/file/camera) · poll composer · voice hold-to-record
 * · send. Drafts: debounced save via backendV2.saveDraft, restore on open.
 */

import { useEffect, useRef, useState } from 'react';
import { backend } from '@/lib/backend';
import type { ChatMessage, SendInput } from '@/lib/backend/types';
import { Icon, ICONS, Popover, Modal, backendV2, v2call } from './common';

interface Props {
  chatId: string;
  replyTo: ChatMessage | null;
  onClearReply(): void;
  enterToSend: boolean;
  onSent(): void;
}

const EMOJI_GROUPS: { name: string; list: string[] }[] = [
  { name: 'Smileys', list: ['😀','😁','😂','🤣','😊','😍','😘','😎','🤔','😅','😭','😡','👍','👏','🙏','❤️','🔥','🎉','👋','🤝'] },
  { name: 'Log', list: ['😇','🥳','😴','🤯','🥺','😤','🤗','🫡','💯','✨','💔','💪','👀','🙌','🤝','🫶','😺','🐶','🌙','☀️'] },
  { name: 'Cheezein', list: ['📷','🎤','🎵','⚽','🍕','☕','🚗','✈️','🎁','💡','📚','💻','🏠','🌹','⭐','🎯','💰','🔑','📌','📎'] },
];

export default function MessageInput({ chatId, replyTo, onClearReply, enterToSend, onSent }: Props) {
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [uploading, setUploading] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRec = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const draftLoadedFor = useRef<string | null>(null);

  // draft restore on open
  useEffect(() => {
    if (draftLoadedFor.current === chatId) return;
    draftLoadedFor.current = chatId;
    v2call(() => backendV2.getDraft(chatId)).then((d) => {
      if (d) setText(d);
    });
  }, [chatId]);

  // typing indicator (throttled)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChange = (v: string) => {
    setText(v);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    backend.setTyping(chatId, true).catch(() => {});
    typingTimer.current = setTimeout(() => backend.setTyping(chatId, false).catch(() => {}), 2500);
    // debounced draft save
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      const t = v.trim();
      if (t) v2call(() => backendV2.saveDraft(chatId, t));
      else v2call(() => backendV2.clearDraft(chatId));
    }, 800);
  };

  useEffect(() => () => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (recTimer.current) clearInterval(recTimer.current);
  }, []);

  const send = async (override?: SendInput) => {
    const t = text.trim();
    const input: SendInput | undefined = override ?? (t ? { type: 'text', text: t } : undefined);
    if (!input) return;
    if (replyTo && !override) {
      input.replyTo = { id: replyTo.id, text: replyTo.text?.slice(0, 120) || `[${replyTo.type}]`, senderName: replyTo.senderName };
    }
    setText('');
    onClearReply();
    v2call(() => backendV2.clearDraft(chatId));
    try {
      await backend.sendMessage(chatId, input);
      onSent();
    } catch {
      setText(t); // fail par text wapas
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && enterToSend) {
      e.preventDefault();
      send();
    }
  };

  // ---- attachments ----
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const uploadAndSend = async (file: File, asImage: boolean) => {
    setUploading(true);
    setAttachOpen(false);
    try {
      const res = asImage ? await backend.uploadMedia(chatId, file) : await backend.uploadFile(chatId, file);
      const kind = (res as { kind: string }).kind;
      await send({
        type: kind === 'image' ? 'image' : kind === 'audio' ? 'audio' : 'file',
        text: kind === 'file' ? (res as { name?: string }).name || file.name : '',
        mediaURL: res.url,
        fileName: (res as { name?: string }).name || file.name,
        fileSize: file.size,
      });
    } catch {
    } finally {
      setUploading(false);
    }
  };

  // ---- voice record (hold-to-record) ----
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
        setUploading(true);
        try {
          const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
          const up = await backend.uploadMedia(chatId, file);
          await send({ type: 'audio', text: '', mediaURL: up.url, duration: recSecs });
        } catch {
        } finally {
          setUploading(false);
        }
      };
      rec.start();
      setRecording(true);
      setRecSecs(0);
      recTimer.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
    } catch {
      // mic permission denied — silently ignore
    }
  };

  const stopRec = (cancel = false) => {
    if (recTimer.current) clearInterval(recTimer.current);
    setRecording(false);
    const rec = mediaRec.current;
    if (!rec) return;
    if (cancel) {
      recChunks.current = [];
      rec.onstop = null;
      rec.stream.getTracks().forEach((t) => t.stop());
      mediaRec.current = null;
      return;
    }
    try { rec.stop(); } catch {}
    mediaRec.current = null;
  };

  const fmtRec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="bg-[var(--v2-panel)] shrink-0 relative">
      {/* reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 pt-2 animate-[v2fade_.15s_ease-out]">
          <div className="flex-1 bg-[var(--v2-panel2)] border-l-[3px] border-[var(--v2-accent)] rounded-md px-3 py-1.5 min-w-0">
            <p className="text-[12px] font-semibold text-[var(--v2-accent)]">{replyTo.senderName}</p>
            <p className="text-[12.5px] text-[var(--v2-muted)] truncate">{replyTo.text?.slice(0, 120) || `[${replyTo.type}]`}</p>
          </div>
          <button onClick={onClearReply} className="p-1.5 text-[var(--v2-muted)] hover:text-[var(--v2-text)]">
            <Icon d={ICONS.x} size={18} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-1 px-3 py-2.5">
        {recording ? (
          <div className="flex-1 flex items-center gap-3 bg-[var(--v2-input)] rounded-2xl px-4 py-2.5 animate-[v2fade_.15s_ease-out]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ea0038] animate-pulse shrink-0" />
            <span className="text-[14px] font-medium tabular-nums">{fmtRec(recSecs)}</span>
            <span className="text-[13px] text-[var(--v2-muted)]">Recording… chhorne par bhej diya jayega</span>
            <div className="flex-1" />
            <button onClick={() => stopRec(true)} className="text-[13px] text-[#ea0038] font-medium hover:underline">
              Cancel
            </button>
          </div>
        ) : (
          <>
            {/* emoji */}
            <div className="relative shrink-0">
              <button onClick={() => { setEmojiOpen((v) => !v); setAttachOpen(false); }} className="p-2.5 text-[var(--v2-muted)] hover:text-[var(--v2-text)] hover:bg-[var(--v2-hover)] rounded-full transition" title="Emoji">
                <Icon d={ICONS.emoji} size={24} />
              </button>
              {emojiOpen && (
                <Popover onClose={() => setEmojiOpen(false)} className="left-0 bottom-12 w-[330px]">
                  <div className="max-h-[300px] overflow-y-auto v2scroll p-3">
                    {EMOJI_GROUPS.map((g) => (
                      <div key={g.name} className="mb-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--v2-muted)] px-1 mb-1">{g.name}</p>
                        <div className="grid grid-cols-8 gap-0.5">
                          {g.list.map((e) => (
                            <button key={e} onClick={() => { setText((t) => t + e); inputRef.current?.focus(); }} className="text-[22px] p-1 rounded-lg hover:bg-[var(--v2-hover)] transition">
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Popover>
              )}
            </div>

            {/* attach */}
            <div className="relative shrink-0">
              <button onClick={() => { setAttachOpen((v) => !v); setEmojiOpen(false); }} className="p-2.5 text-[var(--v2-muted)] hover:text-[var(--v2-text)] hover:bg-[var(--v2-hover)] rounded-full transition" title="Attach">
                <Icon d={ICONS.plus} size={24} />
              </button>
              {attachOpen && (
                <Popover onClose={() => setAttachOpen(false)} className="left-0 bottom-12">
                  <AttachRow icon={ICONS.image} label="Photo" sub="Gallery se" color="#7f66ff" onClick={() => imgRef.current?.click()} />
                  <AttachRow icon={ICONS.file} label="Document" sub="PDF, zip waghera" color="#ff9f1c" onClick={() => fileRef.current?.click()} />
                  <AttachRow icon={ICONS.camera} label="Camera" sub="Abhi photo lein" color="#ea0038" onClick={() => imgRef.current?.click()} />
                  <AttachRow icon={ICONS.poll} label="Poll" sub="Vote karwayein" color="#00a884" onClick={() => { setAttachOpen(false); setPollOpen(true); }} />
                </Popover>
              )}
              <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAndSend(f, true); e.target.value = ''; }} />
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAndSend(f, false); e.target.value = ''; }} />
            </div>

            {/* textbox */}
            <div className="flex-1 bg-[var(--v2-input)] rounded-2xl px-4 py-1 min-w-0">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={uploading ? 'Upload ho raha hai…' : 'Message likhein'}
                rows={1}
                disabled={uploading}
                className="w-full bg-transparent outline-none text-[14.5px] text-[var(--v2-text)] resize-none max-h-[120px] py-2 leading-snug"
                onInput={(e) => {
                  const el = e.target as HTMLTextAreaElement;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                }}
              />
            </div>

            {/* voice / send */}
            {text.trim() ? (
              <button onClick={() => send()} disabled={uploading} className="p-2.5 rounded-full bg-[var(--v2-accent)] text-white hover:brightness-110 transition shrink-0 shadow-md disabled:opacity-50" title="Bhejein">
                <Icon d={ICONS.send} size={22} />
              </button>
            ) : (
              <button
                onMouseDown={startRec}
                onMouseUp={() => stopRec(false)}
                onMouseLeave={() => recording && stopRec(false)}
                onTouchStart={startRec}
                onTouchEnd={() => stopRec(false)}
                disabled={uploading}
                className={`p-2.5 rounded-full transition shrink-0 ${recording ? 'bg-[#ea0038] text-white' : 'text-[var(--v2-muted)] hover:text-[var(--v2-text)] hover:bg-[var(--v2-hover)]'}`}
                title="Hold karke voice record karein"
              >
                <Icon d={ICONS.mic} size={22} />
              </button>
            )}
          </>
        )}
      </div>

      {pollOpen && <PollComposer chatId={chatId} onClose={() => setPollOpen(false)} onDone={() => { setPollOpen(false); onSent(); }} />}
    </div>
  );
}

function AttachRow({ icon, label, sub, color, onClick }: { icon: string; label: string; sub: string; color: string; onClick(): void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--v2-hover)] transition text-left">
      <span className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: color }}>
        <Icon d={icon} size={18} />
      </span>
      <span>
        <span className="block text-[14px] text-[var(--v2-text)]">{label}</span>
        <span className="block text-[12px] text-[var(--v2-muted)]">{sub}</span>
      </span>
    </button>
  );
}

function PollComposer({ chatId, onClose, onDone }: { chatId: string; onClose(): void; onDone(): void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || opts.length < 2) return;
    setBusy(true);
    try {
      await backend.createPoll(chatId, question.trim(), opts);
      onDone();
    } catch {
      setBusy(false);
    }
  };

  return (
    <Modal title="Naya poll" onClose={onClose}>
      <div className="p-4">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Sawal likhein…"
          className="w-full bg-[var(--v2-input)] rounded-lg px-3.5 py-2.5 text-[14px] outline-none mb-3 text-[var(--v2-text)]"
        />
        {options.map((o, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              value={o}
              onChange={(e) => setOptions((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`Option ${i + 1}`}
              className="flex-1 bg-[var(--v2-input)] rounded-lg px-3.5 py-2 text-[14px] outline-none text-[var(--v2-text)]"
            />
            {options.length > 2 && (
              <button onClick={() => setOptions((arr) => arr.filter((_, j) => j !== i))} className="p-2 text-[var(--v2-muted)] hover:text-[#ea0038]">
                <Icon d={ICONS.x} size={18} />
              </button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <button onClick={() => setOptions((a) => [...a, ''])} className="text-[13.5px] text-[var(--v2-accent)] font-medium hover:underline mb-3">
            + Option add karein
          </button>
        )}
        <button
          onClick={submit}
          disabled={busy || !question.trim() || options.filter((o) => o.trim()).length < 2}
          className="w-full py-2.5 rounded-full bg-[var(--v2-accent)] text-white text-[14.5px] font-medium hover:brightness-110 transition disabled:opacity-50"
        >
          {busy ? 'Ban raha hai…' : 'Poll bhejein'}
        </button>
      </div>
    </Modal>
  );
}
