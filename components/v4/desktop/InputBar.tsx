'use client';

/**
 * InputBar — WhatsApp Web style input bar.
 * Emoji picker panel · attach menu (photo/document/poll/contact/live-location/
 * self-destruct/schedule) · poll composer (deadline ke saath) · hold-to-record
 * voice · drafts (save/restore) · typing indicator · optimistic send.
 */

import { useEffect, useRef, useState } from 'react';
import { backend } from '@/lib/backend';
import type { ChatMessage, SendInput, UserProfile } from '@/lib/backend/types';
import { avatarColor } from '@/lib/format';
import { Icon, ICONS, Popover, Modal, backendV2, backendV3, v4call } from './common';

interface Props {
  chatId: string;
  me: UserProfile;
  replyTo: ChatMessage | null;
  onClearReply(): void;
  onOptimistic(m: ChatMessage): void;
  onSent(): void;
  editTarget: ChatMessage | null;
  onCancelEdit(): void;
}

const EMOJI_GROUPS: { name: string; list: string[] }[] = [
  { name: 'Smileys', list: ['😀','😁','😂','🤣','😊','😍','😘','😎','🤔','😅','😭','😡','👍','👏','🙏','❤️','🔥','🎉','👋','😌'] },
  { name: 'Log', list: ['😇','🥳','😴','🤯','🥺','😤','🤗','🫡','💯','✨','💔','💪','👀','🙌','🤝','🫶','😺','🐶','🌙','☀️'] },
  { name: 'Cheezein', list: ['📷','🎤','🎵','⚽','🍕','☕','🚗','✈️','🎁','💡','📚','💻','🏠','🌹','⭐','🎯','💰','🔑','📌','📎'] },
  { name: 'Khaana', list: ['🍎','🍌','🍇','🍓','🥭','🍕','🍔','🍟','🌮','🍩','🍰','☕','🍵','🥛','🍯','🥜','🍿','🧃','🍦','🍫'] },
  { name: 'Safar', list: ['🚗','🚕','🚌','🚂','✈️','🚁','⛵','🏝️','🗺️','🧳','🏨','🕌','🏛️','🌉','🎡','⛺','🧭','🛵','🚲','🛺'] },
];

export default function InputBar({ chatId, me, replyTo, onClearReply, onOptimistic, onSent, editTarget, onCancelEdit }: Props) {
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [selfDestructOpen, setSelfDestructOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [uploading, setUploading] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRec = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const draftLoadedFor = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  // draft restore
  useEffect(() => {
    if (draftLoadedFor.current === chatId) return;
    draftLoadedFor.current = chatId;
    v4call(() => backendV2.getDraft(chatId)).then((d) => { if (d) setText(d); });
  }, [chatId]);

  // edit mode: text prefill
  useEffect(() => {
    if (editTarget) {
      setText(editTarget.text || '');
      inputRef.current?.focus();
      const el = inputRef.current;
      if (el) {
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
      }
    }
  }, [editTarget]);

  useEffect(() => () => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (recTimer.current) clearInterval(recTimer.current);
  }, []);

  const onChange = (v: string) => {
    setText(v);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    backend.setTyping(chatId, true).catch(() => {});
    typingTimer.current = setTimeout(() => backend.setTyping(chatId, false).catch(() => {}), 2500);
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      const t = v.trim();
      if (t) v4call(() => backendV2.saveDraft(chatId, t));
      else v4call(() => backendV2.clearDraft(chatId));
    }, 800);
  };

  const send = async (override?: SendInput) => {
    const t = text.trim();
    if (editTarget && !override) {
      if (!t) return;
      setText('');
      onCancelEdit();
      try { await backend.editMessage(chatId, editTarget.id, t); } catch {}
      onSent();
      return;
    }
    const input: SendInput | undefined = override ?? (t ? { type: 'text', text: t } : undefined);
    if (!input) return;
    if (replyTo && !override) {
      input.replyTo = { id: replyTo.id, text: replyTo.text?.slice(0, 120) || `[${replyTo.type}]`, senderName: replyTo.senderName };
    }
    // optimistic echo — foran dikhe
    try {
      const local = backendV3.buildLocalMessage(chatId, input, { id: me.id, displayName: me.displayName });
      onOptimistic(local);
    } catch {}
    setText('');
    onClearReply();
    v4call(() => backendV2.clearDraft(chatId));
    try {
      await backend.sendMessage(chatId, input);
      onSent();
    } catch {
      setText(t);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // ---- attachments ----
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

  const shareLiveLocation = () => {
    setAttachOpen(false);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        v4call(() => backendV2.sendLiveLocation(chatId, pos.coords.latitude, pos.coords.longitude, 60));
        onSent();
      },
      () => {},
      { timeout: 10000 },
    );
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
    } catch {}
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
  const hasText = text.trim().length > 0;

  return (
    <div className="bg-[#1f2c34] shrink-0 relative">
      {replyTo && <ReplyCard replyTo={replyTo} onClear={onClearReply} />}
      {editTarget && (
        <div className="px-6 pt-2.5 animate-[v4fade_.18s_ease-out]">
          <div className="relative flex items-stretch rounded-xl overflow-hidden bg-[#2a3942]">
            <span className="w-1 shrink-0 bg-[#00a884]" />
            <div className="flex-1 min-w-0 py-2 pl-3 pr-2">
              <p className="text-[12.5px] font-semibold text-[#00a884]">Message edit kar rahe hain</p>
              <p className="text-[13px] text-[#8696a0] truncate mt-0.5">{editTarget.text?.slice(0, 120)}</p>
            </div>
            <button
              onClick={() => { setText(''); onCancelEdit(); }}
              className="self-start m-1.5 p-1.5 rounded-full text-[#8696a0] hover:bg-[#1f2c34] hover:text-[#e9edef] transition shrink-0"
              title="Edit cancel karein"
            >
              <Icon d={ICONS.x} size={17} />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 px-4 py-2.5">
        {recording ? (
          <div className="flex-1 flex items-center gap-3 bg-[#2a3942] rounded-full px-5 py-2.5 animate-[v4fade_.15s_ease-out]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ea0038] animate-pulse shrink-0" />
            <span className="text-[14px] font-medium tabular-nums text-[#e9edef]">{fmtRec(recSecs)}</span>
            <span className="text-[13px] text-[#8696a0]">Recording… chhorne par bhej diya jayega</span>
            <div className="flex-1" />
            <button onClick={() => stopRec(true)} className="text-[13px] text-[#ea0038] font-medium hover:underline">
              Cancel
            </button>
          </div>
        ) : (
          <>
            {/* emoji */}
            <div className="relative shrink-0">
              <button
                onClick={() => { setEmojiOpen((v) => !v); setAttachOpen(false); }}
                className={`p-2.5 rounded-full transition ${emojiOpen ? 'text-[#00a884] bg-[#00a884]/10' : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]'}`}
                title="Emoji"
              >
                <Icon d={ICONS.emoji} size={26} />
              </button>
              {emojiOpen && (
                <Popover onClose={() => setEmojiOpen(false)} className="left-0 bottom-14 w-[340px] rounded-2xl!">
                  <div className="max-h-[320px] overflow-y-auto v4scroll p-3">
                    {EMOJI_GROUPS.map((g) => (
                      <div key={g.name} className="mb-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8696a0] px-1 mb-1">{g.name}</p>
                        <div className="grid grid-cols-8 gap-0.5">
                          {g.list.map((e) => (
                            <button
                              key={e}
                              onClick={() => { setText((t) => t + e); inputRef.current?.focus(); }}
                              className="text-[23px] p-1 rounded-lg hover:bg-[#1f2c34] transition"
                            >
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
              <button
                onClick={() => { setAttachOpen((v) => !v); setEmojiOpen(false); }}
                className={`p-2.5 rounded-full transition ${attachOpen ? 'text-[#00a884] bg-[#00a884]/10 rotate-45' : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]'}`}
                title="Attach"
              >
                <Icon d={ICONS.plus} size={26} />
              </button>
              {attachOpen && (
                <Popover onClose={() => setAttachOpen(false)} className="left-0 bottom-14 min-w-[260px]!">
                  <AttachRow icon={ICONS.image} label="Photo" sub="Gallery se" color="#7f66ff" onClick={() => imgRef.current?.click()} />
                  <AttachRow icon={ICONS.file} label="Document" sub="PDF, zip waghera" color="#ff9f1c" onClick={() => fileRef.current?.click()} />
                  <AttachRow icon={ICONS.poll} label="Poll" sub="Vote karwayein" color="#00a884" onClick={() => { setAttachOpen(false); setPollOpen(true); }} />
                  <AttachRow icon={ICONS.contact} label="Contact" sub="Contact share karein" color="#53bdeb" onClick={() => { setAttachOpen(false); setContactOpen(true); }} />
                  <AttachRow icon={ICONS.location} label="Live location" sub="1 ghante ke liye" color="#ea0038" onClick={shareLiveLocation} />
                  <AttachRow icon={ICONS.zap} label="Self-destruct" sub="Khud mitne wala message" color="#ff9f1c" onClick={() => { setAttachOpen(false); setSelfDestructOpen(true); }} />
                  <AttachRow icon={ICONS.calendar} label="Schedule karein" sub="Baad me bhejein" color="#00a884" onClick={() => { setAttachOpen(false); setScheduleOpen(true); }} />
                </Popover>
              )}
              <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAndSend(f, true); e.target.value = ''; }} />
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAndSend(f, false); e.target.value = ''; }} />
            </div>

            {/* textbox */}
            <div className="flex-1 bg-[#2a3942] rounded-full px-5 py-[3px] min-w-0">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={uploading ? 'Upload ho raha hai…' : 'Message likhein'}
                rows={1}
                disabled={uploading}
                className="w-full bg-transparent outline-none text-[15px] text-[#e9edef] resize-none max-h-[120px] py-2 leading-snug"
                onInput={(e) => {
                  const el = e.target as HTMLTextAreaElement;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                }}
              />
            </div>

            {/* mic / send */}
            {hasText ? (
              <button
                onClick={() => send()}
                disabled={uploading}
                className="p-3 rounded-full bg-[#00a884] text-white hover:brightness-110 transition shrink-0 shadow-lg disabled:opacity-50 animate-[v4pop_.15s_ease-out]"
                title="Bhejein"
              >
                <Icon d={ICONS.send} size={22} />
              </button>
            ) : (
              <button
                onPointerDown={startRec}
                onPointerUp={() => stopRec(false)}
                onPointerLeave={() => recording && stopRec(false)}
                onPointerCancel={() => recording && stopRec(false)}
                onContextMenu={(e) => e.preventDefault()}
                disabled={uploading}
                className={`p-2.5 rounded-full transition shrink-0 touch-none select-none ${recording ? 'bg-[#ea0038] text-white' : 'text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]'}`}
                title="Hold karke voice record karein"
              >
                <Icon d={ICONS.mic} size={24} />
              </button>
            )}
          </>
        )}
      </div>

      {pollOpen && <PollComposer chatId={chatId} onClose={() => setPollOpen(false)} onDone={() => { setPollOpen(false); onSent(); }} />}
      {contactOpen && <ContactComposer chatId={chatId} onClose={() => setContactOpen(false)} onDone={() => { setContactOpen(false); onSent(); }} />}
      {selfDestructOpen && <SelfDestructComposer chatId={chatId} onClose={() => setSelfDestructOpen(false)} onDone={() => { setSelfDestructOpen(false); onSent(); }} />}
      {scheduleOpen && <ScheduleComposer chatId={chatId} onClose={() => setScheduleOpen(false)} onDone={() => { setScheduleOpen(false); onSent(); }} />}
    </div>
  );
}

// ---------- reply strip ----------

function ReplyCard({ replyTo, onClear }: { replyTo: ChatMessage; onClear(): void }) {
  const c = avatarColor(replyTo.senderName || '?');
  const kind =
    replyTo.type === 'image' ? 'Photo'
    : replyTo.type === 'audio' ? 'Voice message'
    : replyTo.type === 'file' ? (replyTo.fileName || 'Document')
    : replyTo.type === 'poll' ? `Poll: ${replyTo.poll?.question || ''}`
    : replyTo.type === 'contact' ? `Contact: ${replyTo.contact?.name || ''}`
    : replyTo.type === 'location' ? 'Location'
    : null;
  return (
    <div className="px-6 pt-2.5 animate-[v4fade_.18s_ease-out]">
      <div className="relative flex items-stretch rounded-xl overflow-hidden bg-[#2a3942]">
        <span className="w-1 shrink-0" style={{ background: c }} />
        {replyTo.type === 'image' && replyTo.mediaURL && (
          <img src={replyTo.mediaURL} alt="" className="w-13 h-13 object-cover m-2 rounded-lg shrink-0" style={{ width: 52, height: 52 }} />
        )}
        <div className="flex-1 min-w-0 py-2 pl-2 pr-2">
          <p className="text-[12.5px] font-semibold truncate" style={{ color: c }}>{replyTo.senderName}</p>
          <p className="text-[13px] text-[#8696a0] truncate mt-0.5">{kind ?? replyTo.text?.slice(0, 120) ?? ''}</p>
        </div>
        <button
          onClick={onClear}
          className="self-start m-1.5 p-1.5 rounded-full text-[#8696a0] hover:bg-[#1f2c34] hover:text-[#e9edef] transition shrink-0"
          title="Reply hatayein"
        >
          <Icon d={ICONS.x} size={17} />
        </button>
      </div>
    </div>
  );
}

// ---------- attach row ----------

function AttachRow({ icon, label, sub, color, onClick }: { icon: string; label: string; sub: string; color: string; onClick(): void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#1f2c34] transition text-left">
      <span className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: color }}>
        <Icon d={icon} size={19} />
      </span>
      <span>
        <span className="block text-[14.5px] text-[#e9edef]">{label}</span>
        <span className="block text-[12px] text-[#8696a0]">{sub}</span>
      </span>
    </button>
  );
}

// ---------- poll composer ----------

function PollComposer({ chatId, onClose, onDone }: { chatId: string; onClose(): void; onDone(): void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || opts.length < 2) return;
    setBusy(true);
    try {
      const msgId = await backend.createPoll(chatId, question.trim(), opts);
      if (deadline) {
        const ts = new Date(deadline).getTime();
        if (ts > Date.now()) await v4call(() => backendV2.setPollDeadline(msgId, ts));
      }
      onDone();
    } catch {
      setBusy(false);
    }
  };

  return (
    <Modal title="Naya poll" onClose={onClose}>
      <div className="p-5">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Sawal likhein…"
          className="w-full bg-[#1f2c34] rounded-full px-5 py-2.5 text-[14px] outline-none mb-3 text-[#e9edef]"
        />
        {options.map((o, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              value={o}
              onChange={(e) => setOptions((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`Option ${i + 1}`}
              className="flex-1 bg-[#1f2c34] rounded-full px-5 py-2 text-[14px] outline-none text-[#e9edef]"
            />
            {options.length > 2 && (
              <button onClick={() => setOptions((arr) => arr.filter((_, j) => j !== i))} className="p-2 text-[#8696a0] hover:text-[#ea0038]">
                <Icon d={ICONS.x} size={18} />
              </button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <button onClick={() => setOptions((a) => [...a, ''])} className="text-[13.5px] text-[#00a884] font-medium hover:underline mb-3">
            + Option add karein
          </button>
        )}
        <p className="text-[12.5px] text-[#8696a0] mb-1.5">Voting deadline (optional)</p>
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="w-full bg-[#1f2c34] rounded-full px-5 py-2 text-[13.5px] outline-none text-[#e9edef] mb-4"
        />
        <button
          onClick={submit}
          disabled={busy || !question.trim() || options.filter((o) => o.trim()).length < 2}
          className="w-full py-2.5 rounded-full bg-[#00a884] text-white text-[15px] font-medium hover:brightness-110 transition disabled:opacity-50"
        >
          {busy ? 'Ban raha hai…' : 'Poll bhejein'}
        </button>
      </div>
    </Modal>
  );
}

// ---------- contact composer ----------

function ContactComposer({ chatId, onClose, onDone }: { chatId: string; onClose(): void; onDone(): void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const ok = await v4call(() => backendV2.sendContact(chatId, { name: name.trim(), phone: phone.trim() || undefined }));
    setBusy(false);
    if (ok !== null) onDone();
  };
  return (
    <Modal title="Contact share karein" onClose={onClose}>
      <div className="p-5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam…" className="w-full bg-[#1f2c34] rounded-full px-5 py-2.5 text-[14px] outline-none mb-3 text-[#e9edef]" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)…" className="w-full bg-[#1f2c34] rounded-full px-5 py-2.5 text-[14px] outline-none mb-4 text-[#e9edef]" />
        <button onClick={submit} disabled={busy || !name.trim()} className="w-full py-2.5 rounded-full bg-[#00a884] text-white text-[15px] font-medium hover:brightness-110 transition disabled:opacity-50">
          {busy ? 'Bhej rahe hain…' : 'Contact bhejein'}
        </button>
      </div>
    </Modal>
  );
}

// ---------- self-destruct composer ----------

const SD_OPTIONS = [
  { label: '1 minute', sec: 60 },
  { label: '5 minute', sec: 300 },
  { label: '1 ghanta', sec: 3600 },
  { label: '1 din', sec: 86400 },
];

function SelfDestructComposer({ chatId, onClose, onDone }: { chatId: string; onClose(): void; onDone(): void }) {
  const [text, setText] = useState('');
  const [sec, setSec] = useState(300);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const ok = await v4call(() => backendV2.sendSelfDestructMessage(chatId, text.trim(), sec));
    setBusy(false);
    if (ok !== null) onDone();
  };
  return (
    <Modal title="Self-destruct message" onClose={onClose}>
      <div className="p-5">
        <div className="flex items-center gap-2 text-[#ff9f1c] mb-3">
          <Icon d={ICONS.zap} size={18} />
          <p className="text-[13px] text-[#8696a0]">Yeh message waqt par khud mit jayega.</p>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message likhein…"
          rows={3}
          className="w-full bg-[#1f2c34] rounded-2xl px-4 py-3 text-[14px] outline-none mb-3 text-[#e9edef] resize-none"
        />
        <div className="flex gap-2 mb-4 flex-wrap">
          {SD_OPTIONS.map((o) => (
            <button
              key={o.sec}
              onClick={() => setSec(o.sec)}
              className={`px-4 py-2 rounded-full text-[13px] font-medium transition ${sec === o.sec ? 'bg-[#ff9f1c]/15 text-[#ff9f1c]' : 'bg-[#1f2c34] text-[#8696a0]'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button onClick={submit} disabled={busy || !text.trim()} className="w-full py-2.5 rounded-full bg-[#00a884] text-white text-[15px] font-medium hover:brightness-110 transition disabled:opacity-50">
          {busy ? 'Bhej rahe hain…' : 'Bhejein'}
        </button>
      </div>
    </Modal>
  );
}

// ---------- schedule composer ----------

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ScheduleComposer({ chatId, onClose, onDone }: { chatId: string; onClose(): void; onDone(): void }) {
  const [text, setText] = useState('');
  const [when, setWhen] = useState(toLocalInputValue(new Date(Date.now() + 60 * 1000)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    const ts = new Date(when).getTime();
    if (!text.trim()) { setErr('Message likhein.'); return; }
    if (!ts || ts < Date.now() + 60000) { setErr('Waqt kam az kam 1 minute baad ka chunein.'); return; }
    setBusy(true);
    setErr('');
    try {
      await backend.scheduleMessage(chatId, { type: 'text', text: text.trim() }, ts);
      onDone();
    } catch {
      setErr('Schedule nahi ho saka.');
      setBusy(false);
    }
  };
  return (
    <Modal title="Message schedule karein" onClose={onClose}>
      <div className="p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message likhein…"
          rows={3}
          className="w-full bg-[#1f2c34] rounded-2xl px-4 py-3 text-[14px] outline-none mb-3 text-[#e9edef] resize-none"
        />
        <input
          type="datetime-local"
          value={when}
          min={toLocalInputValue(new Date(Date.now() + 60 * 1000))}
          onChange={(e) => setWhen(e.target.value)}
          className="w-full bg-[#1f2c34] rounded-full px-5 py-2.5 text-[14px] outline-none text-[#e9edef] mb-3"
        />
        {err && <p className="text-[#ea0038] text-[13px] mb-2">{err}</p>}
        <button onClick={submit} disabled={busy} className="w-full py-2.5 rounded-full bg-[#00a884] text-white text-[15px] font-medium hover:brightness-110 transition disabled:opacity-50">
          {busy ? 'Schedule ho raha hai…' : 'Schedule karein'}
        </button>
      </div>
    </Modal>
  );
}
