'use client';

import { useEffect, useRef, useState } from 'react';
import { PlayIcon, PauseIcon } from './icons';

/** seconds -> m:ss */
export function fmtDur(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/** Deterministic pseudo-waveform bars from a seed string */
export function waveBars(seed: string, n = 32): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: n }, (_, i) => {
    const v = ((h >> (i % 16)) ^ (h * (i + 7))) >>> 0;
    return 6 + (v % 24);
  });
}

/**
 * VoicePlayer — WhatsApp-style: play triangle + waveform (played portion green) + duration.
 */
export function VoicePlayer({ url, duration, mine }: { url: string; duration?: number; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(duration || 0);
  const bars = waveBars(url);

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

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play().catch(() => {});
    setPlaying(!playing);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    a.currentTime = ratio * dur;
    setT(a.currentTime);
  };

  const playedBars = dur ? Math.round((t / dur) * bars.length) : 0;

  return (
    <div className="flex items-center gap-2.5 min-w-[200px] max-w-[250px] py-0.5">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        aria-label={playing ? 'Rokein' : 'Chalayein'}
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ color: mine ? '#fff' : 'var(--wa4-muted)' }}
      >
        {playing ? <PauseIcon size={20} /> : <PlayIcon size={22} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[2.5px] h-8 cursor-pointer" onClick={(e) => { e.stopPropagation(); seek(e); }}>
          {bars.map((bh, i) => (
            <span
              key={i}
              className="w-[2.5px] rounded-full shrink-0"
              style={{
                height: bh,
                background: i < playedBars ? 'var(--wa4-accent)' : mine ? 'rgba(255,255,255,0.4)' : 'var(--wa4-muted)',
                opacity: i < playedBars ? 1 : 0.55,
              }}
            />
          ))}
        </div>
        <span className={`text-[11px] tabular-nums ${mine ? 'text-white/70' : 'text-[var(--wa4-muted)]'}`}>{fmtDur(dur)}</span>
      </div>
    </div>
  );
}

/**
 * MicButton — WhatsApp style: green circular button, hold to record, slide left to cancel.
 * Noise-filtered recording chain (highpass + gate + compressor).
 */
export default function MicButton({ onDone }: { onDone: (blob: Blob, seconds: number) => void }) {
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [cancelArmed, setCancelArmed] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioFx = useRef<{ ctx: AudioContext; gateTimer: ReturnType<typeof setInterval> } | null>(null);
  const startX = useRef(0);
  const cancelled = useRef(false);
  const secsRef = useRef(0);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (audioFx.current) {
      clearInterval(audioFx.current.gateTimer);
      audioFx.current.ctx.close().catch(() => {});
      audioFx.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    setRecording(false);
    setCancelArmed(false);
  };

  const finish = (send: boolean) => {
    const rec = recRef.current;
    if (!rec) { cleanup(); return; }
    cancelled.current = !send;
    const secsNow = secsRef.current;
    rec.onstop = () => {
      if (!cancelled.current && chunks.current.length > 0) {
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
        if (secsNow >= 1) onDone(blob, Math.round(secsNow));
      }
      chunks.current = [];
      cleanup();
    };
    try { rec.stop(); } catch { cleanup(); }
  };

  const start = async (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      let recStream: MediaStream = stream;
      try {
        const AC = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        await AC.resume().catch(() => {});
        const src = AC.createMediaStreamSource(stream);
        const hp = AC.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 110;
        hp.Q.value = 0.7;
        const analyser = AC.createAnalyser();
        analyser.fftSize = 512;
        const gate = AC.createGain();
        gate.gain.value = 0;
        const comp = AC.createDynamicsCompressor();
        comp.threshold.value = -30;
        comp.knee.value = 18;
        comp.ratio.value = 8;
        comp.attack.value = 0.004;
        comp.release.value = 0.18;
        const dest = AC.createMediaStreamDestination();
        src.connect(hp);
        hp.connect(analyser);
        hp.connect(gate);
        gate.connect(comp);
        comp.connect(dest);
        const buf = new Float32Array(analyser.fftSize);
        const gateTimer = setInterval(() => {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          const open = rms > 0.012;
          gate.gain.setTargetAtTime(open ? 1 : 0, AC.currentTime, open ? 0.015 : 0.09);
        }, 90);
        audioFx.current = { ctx: AC, gateTimer };
        recStream = dest.stream;
      } catch { /* raw stream fallback */ }

      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = new MediaRecorder(recStream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      cancelled.current = false;
      secsRef.current = 0;
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.current.push(ev.data); };
      rec.start(250);
      recRef.current = rec;
      startX.current = e.clientX;
      setSecs(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        secsRef.current += 1;
        setSecs(secsRef.current);
      }, 1000);
      try { navigator.vibrate?.(30); } catch {}
    } catch { /* mic permission denied */ }
  };

  const onMove = (e: React.PointerEvent) => {
    if (!recording) return;
    setCancelArmed(startX.current - e.clientX > 90);
  };

  const onUp = () => {
    if (!recording) return;
    finish(!cancelArmed);
  };

  return (
    <>
      {recording && (
        <div className="fixed inset-0 z-[60] pointer-events-none">
          <div className="absolute bottom-28 left-4 right-4 flex items-center justify-between">
            <div className="flex items-center gap-3 px-4 h-12 rounded-full bg-[var(--wa4-sheet)] shadow-[var(--wa4-shadow)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--wa4-danger)] animate-pulse" />
              <span className="text-[15px] font-medium text-[var(--wa4-text)] tabular-nums">{fmtDur(secs)}</span>
              <span className="text-[13px] text-[var(--wa4-muted)]">slide karke cancel karein</span>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${cancelArmed ? 'bg-[var(--wa4-danger)]' : 'bg-[var(--wa4-sheet)]'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={cancelArmed ? '#fff' : 'var(--wa4-muted)'} strokeWidth="2" strokeLinecap="round">
                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
              </svg>
            </div>
          </div>
        </div>
      )}
      <button
        aria-label="Voice message record karein (dabaye rakhein)"
        className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 touch-none select-none wa4-fab text-white ${
          recording ? 'bg-[var(--wa4-danger)] scale-110' : 'bg-[var(--wa4-accent)]'
        }`}
        onPointerDown={start}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => recording && finish(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {recording ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
        ) : (
          <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm7 10a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V22h2v-1.06A9 9 0 0 0 21 12h-2z" />
          </svg>
        )}
      </button>
    </>
  );
}
