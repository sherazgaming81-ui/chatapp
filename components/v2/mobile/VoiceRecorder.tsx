'use client';

import { useEffect, useRef, useState } from 'react';

/** Format seconds -> m:ss */
export function fmtDur(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/**
 * VoicePlayer — WhatsApp-style audio message player.
 * Play/pause, seek bar, duration.
 */
export function VoicePlayer({ url, duration, mine }: { url: string; duration?: number; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(duration || 0);

  // Deterministic pseudo-waveform bars from URL
  const bars = (() => {
    let h = 0;
    for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) >>> 0;
    return Array.from({ length: 28 }, (_, i) => {
      const v = ((h >> (i % 16)) ^ (h * (i + 7))) >>> 0;
      return 6 + (v % 22);
    });
  })();

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
    <div className="flex items-center gap-2 min-w-[210px] max-w-[260px]">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        onClick={toggle}
        aria-label={playing ? 'Rokein' : 'Chalayein'}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${mine ? 'bg-white/20' : 'bg-[var(--mv2-accent-soft)]'}`}
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill={mine ? '#fff' : 'var(--mv2-accent)'}><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill={mine ? '#fff' : 'var(--mv2-accent)'}><path d="M8 5.5v13l11-6.5z" /></svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-end gap-[2px] h-7 cursor-pointer" onClick={seek}>
          {bars.map((bh, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full"
              style={{
                height: bh,
                background: i < playedBars ? (mine ? '#fff' : 'var(--mv2-accent)') : (mine ? 'rgba(255,255,255,0.35)' : 'var(--mv2-muted)'),
                opacity: i < playedBars ? 1 : 0.5,
              }}
            />
          ))}
        </div>
        <div className="flex items-center mt-0.5">
          <span className={`text-[11px] ${mine ? 'text-white/80' : 'text-[var(--mv2-muted)]'}`}>{fmtDur(dur)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * MicButton — press & hold to record, slide left to cancel (WhatsApp style).
 * onDone(blob, seconds) when a recording is released.
 */
export default function MicButton({ onDone }: { onDone: (blob: Blob, seconds: number) => void }) {
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [cancelArmed, setCancelArmed] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef2 = useRef<{ ctx: AudioContext; gateTimer: ReturnType<typeof setInterval> } | null>(null);
  const startX = useRef(0);
  const cancelled = useRef(false);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (audioRef2.current) {
      clearInterval(audioRef2.current.gateTimer);
      audioRef2.current.ctx.close().catch(() => {});
      audioRef2.current = null;
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
    const secsNow = secs;
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

      // ---- Noise cancellation chain (Web Audio API) ----
      // mic -> highpass (low rumble kat-ta hai) -> noise gate -> compressor -> recorder
      let recStream: MediaStream = stream;
      try {
        const AC = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        await AC.resume().catch(() => {});
        const src = AC.createMediaStreamSource(stream);
        const hp = AC.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 110; // neeche ka shor (AC hum, hawa) kat jata hai
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
        // noise gate: khamoshi par gate band, bolne par khul jata hai
        const buf = new Float32Array(analyser.fftSize);
        const gateTimer = setInterval(() => {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          const open = rms > 0.012; // ~-38dB threshold
          gate.gain.setTargetAtTime(open ? 1 : 0, AC.currentTime, open ? 0.015 : 0.09);
        }, 90);
        audioRef2.current = { ctx: AC, gateTimer };
        recStream = dest.stream;
      } catch {
        // Web Audio fail — raw stream par record karein
      }

      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = new MediaRecorder(recStream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      cancelled.current = false;
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.current.push(ev.data); };
      rec.start(250);
      recRef.current = rec;
      startX.current = e.clientX;
      setSecs(0);
      setRecording(true);
      timerRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
      // Vibrate lightly if supported
      try { navigator.vibrate?.(30); } catch {}
    } catch {
      // mic permission denied — parent can toast
    }
  };

  const onMove = (e: React.PointerEvent) => {
    if (!recording) return;
    const dx = startX.current - e.clientX;
    setCancelArmed(dx > 90);
  };

  const onUp = () => {
    if (!recording) return;
    finish(!cancelArmed);
  };

  return (
    <>
      {recording && (
        <div className="fixed inset-0 z-[60] pointer-events-none">
          <div className="absolute bottom-24 left-4 right-4 flex items-center justify-between">
            <div className={`flex items-center gap-3 px-4 h-12 rounded-full bg-[var(--mv2-sheet)] shadow-[var(--mv2-shadow)] transition-all ${cancelArmed ? 'opacity-90' : ''}`}>
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--mv2-danger)] animate-pulse" />
              <span className="text-[15px] font-medium text-[var(--mv2-text)] tabular-nums">{fmtDur(secs)}</span>
              <span className="text-[11px] font-medium text-[var(--mv2-accent)] bg-[var(--mv2-accent-soft)] px-2 py-0.5 rounded-full">🎧 Noise filter on</span>
              <span className="text-[13px] text-[var(--mv2-muted)]">← slide karke cancel</span>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${cancelArmed ? 'bg-[var(--mv2-danger)]' : 'bg-[var(--mv2-sheet)]'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={cancelArmed ? '#fff' : 'var(--mv2-muted)'} strokeWidth="2" strokeLinecap="round">
                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
              </svg>
            </div>
          </div>
        </div>
      )}
      <button
        aria-label="Voice message record karein (dabaye rakhein)"
        className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all touch-none select-none ${
          recording ? 'bg-[var(--mv2-danger)] scale-110' : 'bg-[var(--mv2-accent)]'
        } text-white`}
        onPointerDown={start}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => recording && finish(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {recording ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm7 10a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V22h2v-1.06A9 9 0 0 0 21 12h-2z" />
          </svg>
        )}
      </button>
    </>
  );
}
