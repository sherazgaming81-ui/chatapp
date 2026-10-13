'use client';

import { useEffect, useRef, useState } from 'react';
import { backend } from '@/lib/backend';
import type { ReplyRef } from '@/lib/backend/types';
import { triggerPush } from '@/lib/v1/pushClient';
import PollComposer from './v1/PollComposer';
import ScheduledComposer from './v1/ScheduledComposer';
import EmojiPicker from './EmojiPicker';

export default function MessageInput({
  chatId,
  replyTo,
  onCancelReply,
  senderName,
  slowModeSec = 0,
}: {
  chatId: string;
  replyTo: ReplyRef | null;
  onCancelReply: () => void;
  senderName?: string;
  slowModeSec?: number;
}) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [slowWait, setSlowWait] = useState(0);
  const [showPoll, setShowPoll] = useState(false);
  const [showScheduled, setShowScheduled] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (recTimer.current) clearInterval(recTimer.current);
    };
  }, []);

  const handleText = (v: string) => {
    setText(v);
    backend.setTyping(chatId, true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => backend.setTyping(chatId, false), 2000);
  };

  const stopTyping = () => {
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    backend.setTyping(chatId, false);
  };

  const checkSlowMode = (): boolean => {
    if (!slowModeSec || slowModeSec <= 0) return true;
    try {
      const last = Number(localStorage.getItem(`slowmode_${chatId}`) || 0);
      const wait = slowModeSec - Math.floor((Date.now() - last) / 1000);
      if (wait > 0) {
        setSlowWait(wait);
        setTimeout(() => setSlowWait(0), wait * 1000);
        return false;
      }
    } catch {}
    return true;
  };
  const markSent = () => {
    try { localStorage.setItem(`slowmode_${chatId}`, String(Date.now())); } catch {}
  };

  const send = async () => {
    const t = text.trim();
    if (!t || uploading) return;
    if (!checkSlowMode()) return;
    setText('');
    stopTyping();
    setShowEmoji(false);
    await backend.sendMessage(chatId, { type: 'text', text: t, replyTo });
    markSent();
    onCancelReply();
    triggerPush(chatId, senderName || 'Chat', t.slice(0, 80));
  };

  const sendImage = async (file: File) => {
    setUploading(true);
    try {
      if (!checkSlowMode()) return;
      const { url, kind, name, size } = await backend.uploadFile(chatId, file);
      const caption = text.trim();
      setText('');
      stopTyping();
      if (kind === 'image') {
        await backend.sendMessage(chatId, { type: 'image', text: caption, mediaURL: url, fileName: name, replyTo });
        triggerPush(chatId, senderName || 'Chat', '📷 Photo');
      } else if (kind === 'audio') {
        await backend.sendMessage(chatId, { type: 'audio', text: caption, mediaURL: url, fileName: name, replyTo });
        triggerPush(chatId, senderName || 'Chat', '🎤 Voice message');
      } else {
        await backend.sendMessage(chatId, { type: 'file', text: caption || name, mediaURL: url, fileName: name, fileSize: size, replyTo });
        triggerPush(chatId, senderName || 'Chat', `📎 ${name}`);
      }
      markSent();
      onCancelReply();
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      // WhatsApp jaisi clear voice: noise suppression + echo cancellation + high bitrate opus
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      });
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => {
        try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
      });
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 128000 } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size > 1000) {
          setUploading(true);
          try {
            const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
            const { url } = await backend.uploadMedia(chatId, file);
            await backend.sendMessage(chatId, { type: 'audio', text: '', mediaURL: url, duration: recSecs, replyTo });
            markSent();
            onCancelReply();
            triggerPush(chatId, senderName || 'Chat', '🎤 Voice message');
          } finally {
            setUploading(false);
          }
        }
        setRecording(false);
        setRecSecs(0);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      recTimer.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
    } catch {
      alert('Microphone ki permission nahi mili');
    }
  };

  const stopRecording = (sendIt: boolean) => {
    if (recTimer.current) clearInterval(recTimer.current);
    const rec = recorderRef.current;
    if (!rec) { setRecording(false); return; }
    if (!sendIt) {
      rec.onstop = () => {
        rec.stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setRecSecs(0);
      };
    }
    rec.stop();
  };

  const fmtRec = `${Math.floor(recSecs / 60)}:${(recSecs % 60).toString().padStart(2, '0')}`;

  return (
    <div className="relative">
      {slowWait > 0 && (
        <div className="bg-[#3d2b1f] text-[#ffd279] text-xs text-center py-1.5 px-3">
          Slow mode: {slowWait} sec ruko phir bhejo
        </div>
      )}
      {replyTo && (
        <div className="bg-[#1f2c34] px-4 py-2 flex items-center justify-between border-l-4 border-[#00a884]">
          <div className="min-w-0">
            <p className="text-[#00a884] text-xs font-semibold">{replyTo.senderName}</p>
            <p className="text-[#8696a0] text-sm truncate">{replyTo.text || '📷 Photo'}</p>
          </div>
          <button onClick={onCancelReply} className="text-[#8696a0] hover:text-white text-xl px-2">×</button>
        </div>
      )}
      <div className="flex items-center gap-1 px-2 py-2 bg-[#202c33]">
        {recording ? (
          <div className="flex items-center gap-3 flex-1 px-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-sm">{fmtRec}</span>
            <span className="text-[#8696a0] text-sm">Recording...</span>
            <div className="flex-1" />
            <button onClick={() => stopRecording(false)} className="text-[#8696a0] hover:text-red-400 p-2 text-sm">
              Delete
            </button>
            <button
              onClick={() => stopRecording(true)}
              className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center hover:bg-[#06cf9c]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#0b141a"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" /></svg>
            </button>
          </div>
        ) : (
          <>
            <button onClick={() => setShowEmoji((s) => !s)} className="p-2 text-[#8696a0] hover:text-white transition text-2xl leading-none">
              {showEmoji ? '✕' : '😊'}
            </button>
            <button onClick={() => fileRef.current?.click()} className="p-2 text-[#8696a0] hover:text-white transition" title="Photo ya file bhejein">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 6v11.5a4.5 4.5 0 0 1-9 0V6a3 3 0 0 1 6 0v9.5a1.5 1.5 0 0 1-3 0V7H9v8.5a3 3 0 0 0 6 0V6a4.5 4.5 0 0 0-9 0v11.5a6 6 0 0 0 12 0V6h-1.5z" />
              </svg>
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) sendImage(f);
                e.target.value = '';
              }}
            />
            <button onClick={() => setShowPoll(true)} className="p-2 text-[#8696a0] hover:text-white transition text-xl leading-none" title="Poll banao">
              📊
            </button>
            <button onClick={() => setShowScheduled(true)} className="p-2 text-[#8696a0] hover:text-white transition text-xl leading-none" title="Schedule karein">
              🕐
            </button>
            <input
              value={text}
              onChange={(e) => handleText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder={uploading ? 'Upload ho raha hai...' : 'Message likhein'}
              disabled={uploading}
              className="flex-1 bg-[#2a3942] text-white rounded-full px-4 py-2.5 outline-none placeholder-[#8696a0] text-[15px] disabled:opacity-60"
            />
            {text.trim() ? (
              <button onClick={send} disabled={uploading} className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center hover:bg-[#06cf9c] transition disabled:opacity-50">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#0b141a"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" /></svg>
              </button>
            ) : (
              <button onClick={startRecording} className="p-2 text-[#8696a0] hover:text-white transition" title="Voice note">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v5a4 4 0 0 0 4 4zm6-4a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.94V22h2v-3.06A8 8 0 0 0 20 11h-2z" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
      {showEmoji && !recording && (
        <EmojiPicker
          onPick={(e) => handleText(text + e)}
          onClose={() => setShowEmoji(false)}
        />
      )}
      {showPoll && <PollComposer chatId={chatId} onClose={() => setShowPoll(false)} />}
      {showScheduled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowScheduled(false)}>
          <div
            className="bg-[#111b21] rounded-xl w-full max-w-md max-h-[85vh] flex flex-col border border-[#222d34]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#222d34]">
              <h2 className="text-white font-semibold text-lg">🕐 Scheduled messages</h2>
              <button onClick={() => setShowScheduled(false)} className="text-[#8696a0] hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="p-5 overflow-y-auto">
              <ScheduledComposer chatId={chatId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
