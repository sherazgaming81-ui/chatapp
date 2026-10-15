"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, Pause, Play, Send, Trash2, X, Video as VideoIcon, Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "@/data/types";
import { cn, fileToDataUrl, fmtDur } from "@/lib/util";
import { Avatar, Btn, Sheet } from "../ui";
import { patchOnboarding, toast } from "@/data/api";
import { useStore } from "@/data/store";

let stopCurrent: (() => void) | null = null;

export function Waveform({ peaks, progress, onSeek, height = 30, played = "var(--accent)", idle = "var(--mute)" }: { peaks: number[]; progress: number; onSeek?: (f: number) => void; height?: number; played?: string; idle?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const seek = (x: number) => { const r = ref.current!.getBoundingClientRect(); onSeek?.(Math.max(0, Math.min(1, (x - r.left) / r.width))); };
  return (
    <div ref={ref} className="flex flex-1 cursor-pointer touch-none items-center gap-[2px]" style={{ height }}
      onPointerDown={(e) => { drag.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); seek(e.clientX); }}
      onPointerMove={(e) => drag.current && seek(e.clientX)} onPointerUp={() => (drag.current = false)}>
      {peaks.map((p, i) => (
        <span key={i} className="flex-1 rounded-full transition-colors" style={{ height: `${Math.max(14, p * 100)}%`, minWidth: 2, background: i / peaks.length < progress ? played : idle, opacity: i / peaks.length < progress ? 1 : 0.45 }} />
      ))}
    </div>
  );
}

export function VoicePlayer({ m, mine }: { m: Pick<Message, "src" | "dur" | "peaks" | "id">; mine?: boolean }) {
  const dur = m.dur ?? 10;
  const peaks = m.peaks ?? Array.from({ length: 40 }, (_, i) => 0.3 + 0.6 * Math.abs(Math.sin(i)));
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [speed, setSpeed] = useState(1);
  const audio = useRef<HTMLAudioElement | null>(null);
  const raf = useRef(0);
  const last = useRef(0);
  const posRef = useRef(0);
  const real = !!m.src && /^(data:audio|blob:|data:video)/.test(m.src);

  useEffect(() => { if (real) { audio.current = new Audio(m.src); audio.current.onended = () => { setPlaying(false); setPos(0); posRef.current = 0; }; } return () => { audio.current?.pause(); cancelAnimationFrame(raf.current); }; }, [m.src, real]);

  const stop = useCallback(() => { setPlaying(false); audio.current?.pause(); cancelAnimationFrame(raf.current); }, []);
  const tick = useCallback((t: number) => {
    if (real && audio.current) { posRef.current = audio.current.currentTime; setPos(audio.current.currentTime); }
    else { const dt = (t - last.current) / 1000; last.current = t; posRef.current += dt * speedRef.current; setPos(posRef.current); if (posRef.current >= dur) { setPlaying(false); setPos(0); posRef.current = 0; return; } }
    raf.current = requestAnimationFrame(tick);
  }, [real, dur]);
  const speedRef = useRef(1);
  useEffect(() => { speedRef.current = speed; if (audio.current) audio.current.playbackRate = speed; }, [speed]);

  const toggle = () => {
    if (playing) { stop(); return; }
    stopCurrent?.(); stopCurrent = stop;
    setPlaying(true);
    if (real && audio.current) { audio.current.playbackRate = speed; audio.current.currentTime = posRef.current; audio.current.play().catch(() => {}); }
    last.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  };
  const seek = (f: number) => { const t = f * dur; posRef.current = t; setPos(t); if (audio.current) audio.current.currentTime = t; };
  const total = real && audio.current && isFinite(audio.current.duration) ? audio.current.duration : dur;
  return (
    <div className="flex w-[232px] max-w-full items-center gap-2.5 py-0.5">
      <button onClick={toggle} className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", mine ? "bg-white/90 text-[#0b3d2c]" : "bg-accent text-accent-fg")} aria-label={playing ? "Roko" : "Chalao"}>
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <Waveform peaks={peaks} progress={Math.min(1, pos / total)} onSeek={seek} played={mine ? "#fff" : "var(--accent)"} idle={mine ? "#fff" : "var(--mute)"} />
        <div className="mt-0.5 flex items-center justify-between text-[11px] opacity-75"><span>{fmtDur(playing || pos > 0 ? pos : total)}</span></div>
      </div>
      <button onClick={() => setSpeed((s) => (s === 1 ? 1.5 : s === 1.5 ? 2 : 1))} className="rounded-full bg-black/25 px-2 py-1 text-[11px] font-bold tabular-nums">{speed}x</button>
    </div>
  );
}

// ───────── recorder ─────────
export function useRecorder() {
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const t0 = useRef(0);
  const an = useRef<{ ctx: AudioContext; a: AnalyserNode } | null>(null);
  const sim = useRef(false);

  const cleanup = () => { if (timer.current) clearInterval(timer.current); stream.current?.getTracks().forEach((t) => t.stop()); an.current?.ctx.close().catch(() => {}); an.current = null; setRec(false); };
  const start = async () => {
    setSecs(0); setLevels([]); chunks.current = []; t0.current = Date.now();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s; sim.current = false;
      mr.current = new MediaRecorder(s);
      mr.current.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.current.start();
      try { const ctx = new AudioContext(); const a = ctx.createAnalyser(); a.fftSize = 64; ctx.createMediaStreamSource(s).connect(a); an.current = { ctx, a }; } catch { /* ignore */ }
    } catch { sim.current = true; }
    setRec(true);
    timer.current = setInterval(() => {
      setSecs((Date.now() - t0.current) / 1000);
      let lv = 0.2 + Math.random() * 0.7;
      if (an.current) { const d = new Uint8Array(an.current.a.frequencyBinCount); an.current.a.getByteFrequencyData(d); lv = Math.min(1, d.reduce((x, y) => x + y, 0) / d.length / 90 + 0.12); }
      setLevels((l) => [...l.slice(-39), lv]);
    }, 100);
  };
  const stop = (): Promise<{ src: string; dur: number; peaks: number[] } | null> => new Promise((res) => {
    const dur = (Date.now() - t0.current) / 1000;
    const peaks = levels.length > 8 ? Array.from({ length: 44 }, (_, i) => levels[Math.floor((i / 44) * levels.length)] ?? 0.3) : Array.from({ length: 44 }, () => 0.2 + Math.random() * 0.7);
    if (sim.current || !mr.current) { cleanup(); res({ src: "", dur, peaks }); return; }
    mr.current.onstop = async () => { const blob = new Blob(chunks.current, { type: mr.current?.mimeType || "audio/webm" }); const src = await fileToDataUrl(blob); res({ src, dur, peaks }); };
    mr.current.stop(); cleanup();
  });
  const cancel = () => { try { mr.current?.state === "recording" && mr.current.stop(); } catch { /* ignore */ } cleanup(); };
  useEffect(() => cancel, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { rec, secs, levels, start, stop, cancel };
}

export function RecorderBar({ r, onSend, onCancel }: { r: ReturnType<typeof useRecorder>; onSend: () => void; onCancel: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-1 items-center gap-3 rounded-3xl bg-surface2 px-3 py-2">
      <button onClick={onCancel} className="rounded-full p-1.5 text-danger" aria-label="Radd"><Trash2 size={20} /></button>
      <span className="rec-dot h-2.5 w-2.5 rounded-full bg-danger" />
      <span className="w-12 text-sm font-semibold tabular-nums">{fmtDur(r.secs)}</span>
      <div className="flex h-8 flex-1 items-center gap-[2px] overflow-hidden">
        {r.levels.map((l, i) => <span key={i} className="w-[3px] shrink-0 rounded-full bg-accent" style={{ height: `${Math.max(12, l * 100)}%` }} />)}
      </div>
      <button onClick={onSend} className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-fg" aria-label="Bhejo"><Send size={18} /></button>
    </motion.div>
  );
}

/** F14: first-voice-note tutorial — practice recording is discarded, NOT sent to group */
export function VoiceTutorial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const r = useRecorder();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [clip, setClip] = useState<{ src: string; dur: number; peaks: number[] } | null>(null);
  const finish = () => { setClip(null); setStep(0); patchOnboarding({ voiceTutorialDone: true }); toast("Practice delete ho gayi", "Wo group me nahi bheji gayi ✅", "info"); onClose(); };
  return (
    <Sheet open={open} onClose={() => { r.cancel(); onClose(); }} title="Voice note kaise bhejein">
      <ol className="mb-5 space-y-3 text-[15px]">
        {["Mic dabayein — recording shuru ho jayegi", "Bolein. Pasand na aaye to dustbin se radd karein", "Theek lage to Bhejo dabayein"].map((t, i) => (
          <li key={i} className="flex items-start gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-fg">{i + 1}</span>{t}</li>
        ))}
      </ol>
      <div className="rounded-2xl bg-surface2 p-4">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-mute">Practice karein (group me nahi jayegi)</p>
        {step === 0 && <div className="flex justify-center"><Btn onClick={async () => { await r.start(); setStep(1); }}><Mic size={18} /> Practice shuru</Btn></div>}
        {step === 1 && <RecorderBar r={r} onCancel={() => { r.cancel(); setStep(0); }} onSend={async () => { const c = await r.stop(); setClip(c); setStep(2); }} />}
        {step === 2 && clip && <div className="flex flex-col items-center gap-3"><VoicePlayer m={{ id: "practice", ...clip }} /><p className="text-center text-xs text-mute">Ye sirf practice thi. Neeche dabate hi ye delete ho jayegi.</p></div>}
      </div>
      <Btn className="mt-4 w-full" disabled={step !== 2} onClick={finish}><Check size={18} /> Samajh gaya — practice delete karo</Btn>
      <button className="mt-3 w-full text-center text-xs text-mute underline" onClick={finish}>Chhod do (skip)</button>
    </Sheet>
  );
}

// ───────── video note (circular) ─────────
export function VideoNoteRecorder({ onSend, onClose }: { onSend: (p: { src: string; dur: number }) => void; onClose: () => void }) {
  const vid = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const t0 = useRef(0);
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);
  const me = useStore((s) => s.members.find((m) => m.id === s.me)!);
  const cancelled = useRef(false);

  useEffect(() => {
    let s: MediaStream | null = null;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user", width: 480, height: 480 }, audio: true }).then((st) => { s = st; setStream(st); if (vid.current) { vid.current.srcObject = st; vid.current.play().catch(() => {}); } }).catch(() => {});
    return () => { s?.getTracks().forEach((t) => t.stop()); if (iv.current) clearInterval(iv.current); };
  }, []);

  const begin = () => {
    cancelled.current = false; chunks.current = []; t0.current = Date.now(); setRecording(true); setSecs(0);
    if (stream) { try { mr.current = new MediaRecorder(stream, { videoBitsPerSecond: 600000 }); mr.current.ondataavailable = (e) => e.data.size && chunks.current.push(e.data); mr.current.start(); } catch { mr.current = null; } }
    iv.current = setInterval(() => { const d = (Date.now() - t0.current) / 1000; setSecs(d); if (d >= 30) end(false); }, 100);
  };
  const end = (cancel: boolean) => {
    if (!recording && !iv.current) return;
    if (iv.current) clearInterval(iv.current); iv.current = null;
    const dur = (Date.now() - t0.current) / 1000;
    setRecording(false);
    if (cancel || dur < 1) { cancelled.current = true; try { mr.current?.stop(); } catch { /* ignore */ } if (dur < 1 && !cancel) toast("Dabaye rakho", "Video note record karne ke liye button dabaye rakho", "info"); return; }
    if (mr.current && mr.current.state !== "inactive") {
      mr.current.onstop = async () => { const src = await fileToDataUrl(new Blob(chunks.current, { type: mr.current?.mimeType || "video/webm" })); onSend({ src, dur }); onClose(); };
      mr.current.stop();
    } else { onSend({ src: "", dur }); onClose(); }
  };
  const C = 2 * Math.PI * 124;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black/90 px-6 text-white" onPointerUp={() => recording && end(false)}>
      <button onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/10 p-2"><X /></button>
      <div className="relative h-[260px] w-[260px]">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 260 260"><circle cx="130" cy="130" r="124" fill="none" stroke="#ffffff22" strokeWidth="5" /><circle cx="130" cy="130" r="124" fill="none" stroke="#2ccf8a" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - secs / 30)} /></svg>
        <div className="absolute inset-3 overflow-hidden rounded-full bg-[#10201b]">
          {stream ? <video ref={vid} muted playsInline className="h-full w-full -scale-x-100 object-cover" /> : <div className="grid h-full w-full place-items-center"><Avatar m={me} size={110} dot={false} /></div>}
        </div>
      </div>
      <p className="mt-6 text-lg font-bold tabular-nums">{recording ? <span className="text-danger">● {fmtDur(secs)}</span> : "Dabaye rakho aur bolo"}</p>
      <p className="mt-1 max-w-xs text-center text-sm text-white/60">{stream ? "Button dabaye rakho — chhodte hi video note chala jayega" : "Camera nahi mila — demo mode me record hoga"}</p>
      <button onPointerDown={(e) => { e.stopPropagation(); begin(); }} className={cn("mt-8 grid h-20 w-20 place-items-center rounded-full border-4 border-white/80 transition touch-none select-none", recording ? "scale-110 bg-danger" : "bg-accent")}>
        <VideoIcon size={30} />
      </button>
      {recording && <button onPointerUp={(e) => { e.stopPropagation(); end(true); }} className="mt-4 text-sm text-white/70 underline">Radd karo</button>}
    </motion.div>
  );
}

export function VideoNoteBubble({ m }: { m: Message }) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const v = useRef<HTMLVideoElement>(null);
  const dur = m.dur ?? 10;
  useEffect(() => {
    if (!playing) return;
    const t0 = Date.now() - pos * 1000;
    const iv = setInterval(() => { const p = (Date.now() - t0) / 1000; if (p >= dur) { setPlaying(false); setPos(0); } else setPos(p); }, 100);
    return () => clearInterval(iv);
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps
  const C = 2 * Math.PI * 84;
  const sender = useStore((s) => s.members.find((x) => x.id === m.from));
  return (
    <button onClick={() => { const n = !playing; setPlaying(n); if (v.current) { n ? v.current.play() : v.current.pause(); } }} className="relative block h-[176px] w-[176px]">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 176 176"><circle cx="88" cy="88" r="84" fill="none" stroke="#ffffff22" strokeWidth="4" /><circle cx="88" cy="88" r="84" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pos / dur)} /></svg>
      <div className="absolute inset-2 overflow-hidden rounded-full bg-gradient-to-br from-[#14403a] to-[#0a1b17]">
        {m.src ? <video ref={v} src={m.src} loop playsInline className="h-full w-full object-cover" /> : (
          <div className={cn("grid h-full w-full place-items-center", playing && "animate-pulse")}>{sender && <Avatar m={sender} size={96} dot={false} />}</div>
        )}
        <AnimatePresence>{!playing && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center bg-black/30"><Play fill="white" className="text-white" size={34} /></motion.span>}</AnimatePresence>
      </div>
      <span className="absolute bottom-3 left-4 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">{fmtDur(playing ? pos : dur)}</span>
    </button>
  );
}
