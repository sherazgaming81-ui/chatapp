'use client';

import { useEffect, useRef, useState } from 'react';
import { TrashIcon, StopIcon, PlayIcon, PauseIcon, SendIcon } from './icons';
import { fmtDur } from './v5types';
import './v5-mobile.css';

type Phase = 'recording' | 'preview';

interface Props {
  /** recording bhejne par: audio blob + duration (seconds) */
  onSend: (blob: Blob, durationSec: number) => void;
  /** cancel/delete par */
  onCancel: () => void;
  /** mic permission fail par */
  onError?: (msg: string) => void;
}

const MAX_SEC = 600; // 10 min cap
const BARS = 42;

/**
 * VoiceRecorder — WhatsApp locked-recording style.
 *
 * Mount hote hi recording shuru (tap-mic = auto lock, naye WhatsApp jaisa):
 *  - Recording UI: red dot + live timer + live waveform + trash (cancel) + STOP
 *  - STOP dabane par PREVIEW: play karke suno, phir BOTH buttons —
 *    delete (🗑) discard kare, send (✓) bheje. (purana bug: sirf stop tha)
 */
export default function VoiceRecorder({ onSend, onCancel, onError }: Props) {
  const [phase, setPhase] = useState<Phase>('recording');
  const [secs, setSecs] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(BARS).fill(4));
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const waveRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const secsRef = useRef(0);
  const doneRef = useRef(false);

  // ---- mount: recording shuru ----
  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;

        // live waveform ke liye analyser
        try {
          const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const ctx = new AC();
          audioCtxRef.current = ctx;
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          analyserRef.current = analyser;
          const buf = new Uint8Array(analyser.fftSize);
          const tickWave = () => {
            analyser.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) {
              const v = (buf[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / buf.length);
            const h = Math.max(4, Math.min(32, 4 + rms * 160));
            setBars(prev => [...prev.slice(1), h]);
            waveRef.current = window.setTimeout(tickWave, 100);
          };
          tickWave();
        } catch { /* waveform optional hai */ }

        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : undefined;
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        chunksRef.current = [];
        rec.ondataavailable = e => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        rec.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setAudioURL(url);
          (rec as unknown as { __blob?: Blob }).__blob = blob;
          setPhase('preview');
        };
        recRef.current = rec;
        rec.start(250);

        timerRef.current = window.setInterval(() => {
          secsRef.current += 1;
          setSecs(secsRef.current);
          if (secsRef.current >= MAX_SEC) finish();
        }, 1000);
      } catch {
        onError?.('Mic ki permission nahi mili — settings me allow karein');
        onCancel();
      }
    }

    start();
    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (waveRef.current) clearTimeout(waveRef.current);
    try { recRef.current?.state !== 'inactive' && recRef.current?.stop(); } catch { /* noop */ }
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    recRef.current = null;
  }

  /** STOP — recording khatam, preview dikhao (send + delete dono) */
  function finish() {
    if (phase !== 'recording') return;
    if (timerRef.current) clearInterval(timerRef.current);
    if (waveRef.current) clearTimeout(waveRef.current);
    try { recRef.current?.stop(); } catch { /* noop */ }
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(() => {});
  }

  function cancel() {
    cleanup();
    if (audioURL) URL.revokeObjectURL(audioURL);
    onCancel();
  }

  function send() {
    const blob = (recRef.current as unknown as { __blob?: Blob } | null)?.__blob;
    doneRef.current = true;
    cleanup();
    if (blob) onSend(blob, Math.max(1, secsRef.current));
    else onCancel();
  }

  function togglePlay() {
    const a = audioElRef.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play().catch(() => {});
    setPlaying(!playing);
  }

  useEffect(() => {
    const a = audioElRef.current;
    if (!a) return;
    const onEnd = () => setPlaying(false);
    a.addEventListener('ended', onEnd);
    return () => a.removeEventListener('ended', onEnd);
  }, [audioURL]);

  if (phase === 'preview' && audioURL) {
    return (
      <div className="v5-preview-bar" role="group" aria-label="Voice note preview">
        <audio ref={audioElRef} src={audioURL} preload="auto" />
        <button className="v5-preview-play v5-touch" onClick={togglePlay} aria-label={playing ? 'Roko' : 'Suno'}>
          {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
        </button>
        <div className="v5-preview-info">
          <div className="v5-rec-wave" style={{ height: 26 }} aria-hidden>
            {bars.map((h, i) => (
              <span key={i} className="v5-rec-wavebar" style={{ height: h }} />
            ))}
          </div>
          <div>{fmtDur(secs)}</div>
        </div>
        <button className="v5-preview-del v5-touch" onClick={cancel} aria-label="Delete karo">
          <TrashIcon size={22} />
        </button>
        <button className="v5-preview-send v5-touch" onClick={send} aria-label="Bhej do">
          <SendIcon size={22} />
        </button>
      </div>
    );
  }

  return (
    <div className="v5-rec-bar" role="group" aria-label="Recording voice note">
      <span className="v5-rec-dot" aria-hidden />
      <span className="v5-rec-time">{fmtDur(secs)}</span>
      <div className="v5-rec-wave" aria-hidden>
        {bars.map((h, i) => (
          <span key={i} className="v5-rec-wavebar" style={{ height: h }} />
        ))}
      </div>
      <button className="v5-icon-btn" onClick={cancel} aria-label="Cancel karo" style={{ color: '#f15c6d' }}>
        <TrashIcon size={22} />
      </button>
      <button className="v5-icon-btn" onClick={finish} aria-label="Recording roko" style={{ color: '#e9edef' }}>
        <StopIcon size={22} />
      </button>
    </div>
  );
}
