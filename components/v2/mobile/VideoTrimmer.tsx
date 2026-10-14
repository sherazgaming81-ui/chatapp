'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtDur } from './VoiceRecorder';
import { tapHaptic } from '../shared/haptics';

/**
 * VideoTrimmer — WhatsApp-style video trimmer: start/end handles,
 * thumbnail timeline, segment preview, phir trim karke bhejein.
 * Trimming canvas.captureStream + MediaRecorder se hoti hai (koi heavy dep nahi).
 */
export default function VideoTrimmer({
  file,
  onClose,
  onSend,
}: {
  file: File;
  onClose: () => void;
  onSend: (file: File) => void;
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [trimming, setTrimming] = useState(false);
  const [progress, setProgress] = useState(0);
  const dragRef = useRef<'s' | 'e' | null>(null);
  const cancelRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // metadata + thumbnails
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let alive = true;
    const onMeta = async () => {
      if (!alive) return;
      const d = v.duration || 0;
      setDuration(d);
      setStart(0);
      setEnd(d);
      // thumbnails: 8 frames
      const shots: string[] = [];
      const c = document.createElement('canvas');
      c.width = 96; c.height = 54;
      const ctx = c.getContext('2d')!;
      for (let i = 0; i < 8; i++) {
        if (!alive) return;
        const t = ((i + 0.5) / 8) * d;
        await new Promise<void>((res) => {
          const onSeek = () => { v.removeEventListener('seeked', onSeek); res(); };
          v.addEventListener('seeked', onSeek);
          v.currentTime = Math.min(t, Math.max(0, d - 0.05));
          setTimeout(res, 1200); // safety
        });
        if (!alive) return;
        try {
          const vw = v.videoWidth || 16, vh = v.videoHeight || 9;
          const s = Math.min(c.width / vw, c.height / vh);
          const dw = vw * s, dh = vh * s;
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(v, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
          shots.push(c.toDataURL('image/jpeg', 0.6));
        } catch { /* ignore */ }
      }
      if (alive) setThumbs(shots);
    };
    v.addEventListener('loadedmetadata', onMeta);
    return () => { alive = false; v.removeEventListener('loadedmetadata', onMeta); };
  }, [url]);

  useEffect(() => () => { cleanupRef.current?.(); }, []);

  const frac = (t: number) => (duration ? (t / duration) * 100 : 0);

  const dragTo = (clientX: number) => {
    const el = trackRef.current;
    if (!el || !duration) return;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const t = f * duration;
    if (dragRef.current === 's') setStart(Math.min(t, end - 1));
    else if (dragRef.current === 'e') setEnd(Math.max(t, start + 1));
  };

  const previewSeg = () => {
    const v = videoRef.current;
    if (!v || !duration) return;
    if (playing) { v.pause(); setPlaying(false); return; }
    tapHaptic();
    v.currentTime = start;
    v.play().then(() => setPlaying(true)).catch(() => {});
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onT = () => { if (v.currentTime >= end && end > 0) { v.pause(); setPlaying(false); } };
    const onEnd = () => setPlaying(false);
    v.addEventListener('timeupdate', onT);
    v.addEventListener('ended', onEnd);
    v.addEventListener('pause', onEnd);
    return () => { v.removeEventListener('timeupdate', onT); v.removeEventListener('ended', onEnd); v.removeEventListener('pause', onEnd); };
  }, [end]);

  const stopAll = () => {
    try { cleanupRef.current?.(); } catch {}
    cleanupRef.current = null;
    const v = videoRef.current;
    if (v) { v.pause(); }
  };

  const doTrim = async () => {
    const v = videoRef.current;
    if (!v || !duration || trimming) return;
    if (end - start < 0.8 || (start <= 0.05 && end >= duration - 0.05)) {
      // trim bekaar hai — original bhej dein
      onSend(file);
      return;
    }
    tapHaptic();
    setTrimming(true);
    setProgress(0);
    cancelRef.current = false;
    const s = start, e = end;
    try {
      const vw = v.videoWidth || 640, vh = v.videoHeight || 360;
      const scale = Math.min(1, 1280 / Math.max(vw, vh));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vw * scale);
      canvas.height = Math.round(vh * scale);
      const ctx = canvas.getContext('2d')!;
      const vStream = canvas.captureStream(30);

      const AC = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      await AC.resume().catch(() => {});
      const src = AC.createMediaElementSource(v);
      const dest = AC.createMediaStreamDestination();
      src.connect(dest);
      const tracks = [...vStream.getVideoTracks(), ...dest.stream.getAudioTracks()];
      const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => {
        try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
      }) || '';
      const rec = new MediaRecorder(new MediaStream(tracks), mime ? { mimeType: mime, videoBitsPerSecond: 2_500_000 } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.push(ev.data); };

      let raf = 0;
      const clean = () => {
        cancelAnimationFrame(raf);
        try { v.pause(); } catch {}
        try { src.disconnect(); } catch {}
        AC.close().catch(() => {});
      };
      cleanupRef.current = clean;

      const stopped = new Promise<Blob | null>((resolve) => {
        rec.onstop = () => {
          clean();
          cleanupRef.current = null;
          resolve(cancelRef.current ? null : new Blob(chunks, { type: 'video/webm' }));
        };
      });

      v.muted = false;
      v.currentTime = s;
      await v.play().catch(() => {});
      rec.start(250);
      const draw = () => {
        if (cancelRef.current) { try { rec.stop(); } catch {} return; }
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        setProgress(Math.min(1, Math.max(0, (v.currentTime - s) / (e - s))));
        if (v.currentTime < e - 0.05 && !v.ended) raf = requestAnimationFrame(draw);
        else { try { rec.stop(); } catch {} }
      };
      raf = requestAnimationFrame(draw);

      const blob = await stopped;
      setTrimming(false);
      if (!blob || blob.size === 0) { onSend(file); return; }
      onSend(new File([blob], `trimmed-${Date.now()}.webm`, { type: 'video/webm' }));
    } catch {
      stopAll();
      setTrimming(false);
      onSend(file); // fallback: original
    }
  };

  const selLen = Math.max(0, end - start);

  return (
    <div className="fixed inset-0 z-[90] bg-black flex flex-col mv2-fade-anim select-none">
      {/* top bar */}
      <div className="flex items-center justify-between px-2 pt-3 pb-2 mv2-safe-top">
        <button onClick={() => { if (!trimming) { stopAll(); onClose(); } }} aria-label="Band karein" className="w-11 h-11 flex items-center justify-center text-white">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
        <span className="text-white/80 text-[14px] font-medium">Video trim karein</span>
        <button
          onClick={doTrim}
          disabled={trimming}
          className="h-11 px-6 rounded-full bg-[var(--mv2-accent)] text-white font-semibold disabled:opacity-50 active:scale-95 transition-transform"
        >
          {trimming ? '...' : 'Bhejein ✓'}
        </button>
      </div>

      {/* preview */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 relative">
        <video
          ref={videoRef}
          src={url}
          playsInline
          preload="auto"
          className="max-w-full max-h-full rounded-lg bg-black"
          onClick={previewSeg}
        />
        {!playing && duration > 0 && !trimming && (
          <button
            onClick={previewSeg}
            aria-label="Preview chalayein"
            className="absolute w-16 h-16 rounded-full bg-black/60 border border-white/30 text-white flex items-center justify-center active:scale-95 transition-transform"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
          </button>
        )}
      </div>

      {/* time labels */}
      <div className="flex items-center justify-between px-5 pb-1">
        <span className="text-white/80 text-[13px] tabular-nums">{fmtDur(start)}</span>
        <span className="text-[var(--mv2-accent)] text-[13px] font-semibold tabular-nums">{fmtDur(selLen)} selected</span>
        <span className="text-white/80 text-[13px] tabular-nums">{fmtDur(end)}</span>
      </div>

      {/* timeline with dual handles */}
      <div className="px-5 pb-2">
        <div
          ref={trackRef}
          className="relative h-14 rounded-xl overflow-hidden bg-white/10 touch-none"
          onPointerMove={(e) => { if (dragRef.current) dragTo(e.clientX); }}
          onPointerUp={() => { dragRef.current = null; tapHaptic(); }}
          onPointerCancel={() => { dragRef.current = null; }}
        >
          {/* thumbnails */}
          <div className="absolute inset-0 flex">
            {thumbs.length > 0 ? thumbs.map((t, i) => (
              <img key={i} src={t} alt="" className="h-full flex-1 object-cover" draggable={false} />
            )) : (
              <div className="flex-1 flex items-center justify-center text-white/40 text-[12px]">Frames load ho rahe hain...</div>
            )}
          </div>
          {/* dim outside selection */}
          <div className="absolute inset-y-0 left-0 bg-black/60" style={{ width: `${frac(start)}%` }} />
          <div className="absolute inset-y-0 right-0 bg-black/60" style={{ width: `${100 - frac(end)}%` }} />
          {/* selection border */}
          <div
            className="absolute inset-y-0 border-y-2 border-[var(--mv2-accent)]"
            style={{ left: `${frac(start)}%`, width: `${frac(end) - frac(start)}%` }}
          />
          {/* handles */}
          {(['s', 'e'] as const).map((k) => (
            <div
              key={k}
              onPointerDown={(e) => { dragRef.current = k; (e.target as Element).setPointerCapture?.(e.pointerId); e.stopPropagation(); }}
              className="absolute inset-y-0 w-8 -ml-4 flex items-center justify-center cursor-ew-resize"
              style={{ left: k === 's' ? `${frac(start)}%` : `${frac(end)}%` }}
            >
              <div className="w-2.5 h-10 rounded-full bg-[var(--mv2-accent)] shadow" />
            </div>
          ))}
        </div>
        <p className="text-center text-white/45 text-[12px] mt-1.5">Handles drag karke start / end chunein</p>
      </div>
      <div className="h-6 mv2-safe-bottom" />

      {/* trimming progress */}
      {trimming && (
        <div className="absolute inset-0 z-10 bg-black/75 flex flex-col items-center justify-center gap-4 px-10">
          <p className="text-white text-[15px] font-medium">Video trim ho rahi hai...</p>
          <div className="w-full h-2 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full bg-[var(--mv2-accent)] rounded-full transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="text-white/60 text-[13px] tabular-nums">{Math.round(progress * 100)}%</p>
          <button
            onClick={() => { cancelRef.current = true; }}
            className="mt-2 h-11 px-8 rounded-full bg-white/10 text-white text-[14px]"
          >
            Cancel karein
          </button>
        </div>
      )}
    </div>
  );
}
