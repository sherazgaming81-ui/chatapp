"use client";
// 10-scene explainer video — 3s per scene (30s total). Pure CSS animations, 60fps.
// Video-player style: play/pause, seek bar, scene markers, time display, "Dobara".
// SFX (Web Audio): whoosh on scene change, pop on elements. Sound toggle.
// Real Karachi prayer times (Aladhan API) in Deen scene. ChatsApp logo in scenes 1 & 10.
// WHITE/light theme.
import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { MoonSvg } from "@/components/MoonPage";
import { playWhoosh, playPop } from "@/lib/sfx";
import { getSound, setSound } from "@/lib/prefs";

const SCENE_LEN = 3; // seconds per scene

// Fallback: verified real Karachi times (16 Oct 2026, Hanafi/MWL)
const FALLBACK_TIMES = ["5:14 AM", "12:18 PM", "4:27 PM", "6:04 PM", "7:20 PM"];
const PRAYER_NAMES = ["Fajr", "Zuhr", "Asr", "Maghrib", "Isha"];

function to12h(t24: string): string {
  const m = t24.match(/(\d{1,2}):(\d{2})/);
  if (!m) return t24;
  let h = parseInt(m[1], 10);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
}

const SCENES = [
  { cap: "Assalam-o-Alaikum! 🌙", sub: "ChatsApp — Baatein, ab aur qareeb", bg: "linear-gradient(135deg,#e8ebff,#f7f8ff)" },
  { cap: "Madrasa Group", sub: "Apne doston se juro — elaan aur baatein", bg: "linear-gradient(135deg,#dcf5e9,#f2fdf7)" },
  { cap: "Private DMs", sub: "Sirf aap dono ke liye — mehfooz baatein", bg: "linear-gradient(135deg,#ece9ff,#f8f7ff)" },
  { cap: "Deen, har din", sub: "Namaz timings, Quran, duaein, qibla", bg: "linear-gradient(135deg,#fff3d6,#fffdf4)" },
  { cap: "Apne Stickers", sub: "Photo ya text se apne stickers banao", bg: "linear-gradient(135deg,#ffe3ec,#fff5f8)" },
  { cap: "Profile Studio", sub: "Banner, effects, badges — profile sajao", bg: "linear-gradient(135deg,#dceeff,#f4faff)" },
  { cap: "Chaand aur Hijri", sub: "Live moon phase aur Islamic mahina", bg: "linear-gradient(135deg,#e4e8f7,#f5f6fb)" },
  { cap: "Khel aur Mazaa", sub: "Deen quiz, paheli, tic-tac-toe", bg: "linear-gradient(135deg,#ffe9d6,#fff8f0)" },
  { cap: "Mehfooz aur Private", sub: "App lock aur privacy aapke haath me", bg: "linear-gradient(135deg,#d4f5ef,#f2fdfb)" },
  { cap: "Chalo shuru karte hain! 🚀", sub: "Baatein, ab aur qareeb", bg: "linear-gradient(135deg,#e8ebff,#dcf5e9)" },
];

function Scene({ n, times }: { n: number; times: string[] }) {
  if (n === 0) return (
    <div className="flex flex-col items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="ChatsApp" className="ex-pop h-24 w-24 rounded-[28px] soft-shadow" />
      <div className="ex-in mt-4 flex gap-1.5" style={{ animationDelay: ".5s" }}>
        {[0, 1, 2].map((i) => <span key={i} className="ex-typing h-2 w-2 rounded-full bg-[#5865f2]" style={{ animationDelay: `${i * 0.18}s` }} />)}
      </div>
    </div>
  );
  if (n === 1) return (
    <div className="flex w-60 flex-col gap-2">
      {[["Assalamu Alaikum! 👋", false, 0], ["Walaikum salam bhai 🤲", true, 0.4], ["Kal dars me aa rahe ho?", false, 0.8], ["Pakka! ✓✓", true, 1.2]].map(([t, o, d], i) => (
        <div key={i} className={`ex-in max-w-[85%] rounded-2xl px-3.5 py-2.5 text-left text-sm font-medium text-[#2f3035] soft-shadow ${o ? "ex-r self-end bg-[#5865f2] !text-white" : "ex-l self-start bg-white"}`} style={{ animationDelay: `${d}s` }}>
          {t as string}
        </div>
      ))}
    </div>
  );
  if (n === 2) return (
    <div className="flex flex-col items-center">
      <div className="ex-pop relative grid h-24 w-24 place-items-center rounded-[28px] bg-white soft-shadow">
        <span className="text-4xl">🔒</span>
        <span className="ex-float absolute -right-3 -top-3 grid h-10 w-10 place-items-center rounded-full bg-[#5865f2] text-lg text-white soft-shadow">💬</span>
      </div>
      <div className="ex-in mt-4 flex items-center gap-2 rounded-full bg-white px-4 py-2 soft-shadow" style={{ animationDelay: ".5s" }}>
        <span className="h-2 w-2 rounded-full bg-[#23a55a]" />
        <span className="text-xs font-bold text-[#2f3035]">Sirf aap dono dekh sakte hain</span>
      </div>
    </div>
  );
  if (n === 3) return (
    <div className="flex items-center gap-5">
      <svg className="ex-pop" width="84" height="84" viewBox="0 0 100 100">
        <path d="M64 14a38 38 0 1 0 22 68 30 30 0 1 1-22-68z" fill="#f2c94c" />
      </svg>
      <div className="ex-in space-y-1.5 rounded-2xl bg-white p-3.5 text-left text-sm font-bold text-[#2f3035] soft-shadow" style={{ animationDelay: ".4s" }}>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#80848e]">Karachi · Aaj</p>
        {PRAYER_NAMES.map((nm, i) => (
          <p key={nm}>🕌 {nm} <span className="tabular-nums text-[#5865f2]">{times[i]}</span></p>
        ))}
      </div>
    </div>
  );
  if (n === 4) return (
    <div className="flex items-center gap-3">
      {["🦁", "🌙", "✨"].map((e, i) => (
        <span key={e} className="ex-pop grid h-20 w-20 place-items-center rounded-[24px] bg-white text-4xl soft-shadow" style={{ animationDelay: `${i * 0.3}s` }}>{e}</span>
      ))}
      <span className="ex-pop grid h-20 w-20 place-items-center rounded-[24px] bg-gradient-to-br from-[#5865f2] to-[#9b7bff] text-4xl text-white soft-shadow" style={{ animationDelay: ".9s" }}>+</span>
    </div>
  );
  if (n === 5) return (
    <div className="ex-in w-60 overflow-hidden rounded-2xl bg-white text-left soft-shadow">
      <div className="h-14 bg-gradient-to-r from-[#5865f2] via-[#9b7bff] to-[#23a55a]" />
      <div className="-mt-6 flex items-end gap-2 px-4">
        <span className="grid h-14 w-14 place-items-center rounded-full border-4 border-white bg-gradient-to-br from-[#5865f2] to-[#9b7bff] text-2xl font-bold text-white">م</span>
        <div className="pb-1">
          <p className="text-sm font-extrabold text-[#2f3035]">Aapka Naam ✨</p>
          <p className="text-[11px] text-[#80848e]">Owner 👑</p>
        </div>
      </div>
      <div className="flex gap-1.5 p-4 pt-2">
        {["🏅", "🌟", "📿"].map((b, i) => <span key={i} className="ex-pop grid h-8 w-8 place-items-center rounded-full bg-black/5 text-base" style={{ animationDelay: `${0.4 + i * 0.2}s` }}>{b}</span>)}
      </div>
    </div>
  );
  if (n === 6) return (
    <div className="flex flex-col items-center">
      <div className="moon-float"><MoonSvg phase={0.5} size={92} /></div>
      <p className="ex-in mt-3 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-[#2f3035] soft-shadow" style={{ animationDelay: ".4s" }}>Poora Chaand · Roshni 100%</p>
    </div>
  );
  if (n === 7) return (
    <div className="flex gap-4">
      {[{ e: "🧠", l: "Quiz" }, { e: "🧩", l: "Paheli" }, { e: "⭕", l: "Tic-tac" }].map((g, i) => (
        <div key={g.l} className="ex-pop flex flex-col items-center gap-1.5" style={{ animationDelay: `${i * 0.3}s` }}>
          <span className="ex-wiggle grid h-18 w-18 place-items-center rounded-[24px] bg-white p-4 text-4xl soft-shadow">{g.e}</span>
          <span className="text-xs font-bold text-[#2f3035]">{g.l}</span>
        </div>
      ))}
    </div>
  );
  if (n === 8) return (
    <div className="flex flex-col items-center">
      <div className="ex-pop grid h-24 w-24 place-items-center rounded-[28px] bg-gradient-to-br from-[#0e6b4a] to-[#23a55a] text-4xl text-white soft-shadow">🛡️</div>
      <div className="ex-in mt-4 flex gap-2" style={{ animationDelay: ".5s" }}>
        {["App Lock", "Privacy"].map((t) => (
          <span key={t} className="rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-[#2f3035] soft-shadow">{t} 🔐</span>
        ))}
      </div>
    </div>
  );
  // Scene 10 — ChatsApp logo + brand
  return (
    <div className="flex flex-col items-center">
      <span className="ex-pop text-7xl">🚀</span>
      <div className="ex-in mt-4 flex items-center gap-3" style={{ animationDelay: ".4s" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="ChatsApp logo" className="ex-pop h-14 w-14 rounded-2xl soft-shadow" style={{ animationDelay: ".5s" }} />
        <span className="ex-pop text-3xl font-extrabold tracking-tight text-[#2f3035]" style={{ animationDelay: ".65s" }}>
          Chats<span className="text-[#23a55a]">App</span>
        </span>
      </div>
    </div>
  );
}

function fmtT(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function Explainer({ onEnd }: { onEnd?: () => void }) {
  const total = SCENES.length * SCENE_LEN;
  const [t, setT] = useState(0);
  const [play, setPlay] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [times, setTimes] = useState<string[]>(FALLBACK_TIMES);
  const raf = useRef(0), last = useRef(0);
  const lastScene = useRef(-1);
  const barRef = useRef<HTMLDivElement>(null);
  const tRef = useRef(0);
  tRef.current = t;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  // Sound preference
  useEffect(() => { setSoundOn(getSound()); }, []);

  // Real Karachi prayer times (Aladhan API) — fail ho to fallback
  useEffect(() => {
    let live = true;
    fetch("https://api.aladhan.com/v1/timingsByCity?city=Karachi&country=Pakistan&method=1")
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        const tm = d?.data?.timings;
        if (tm) {
          setTimes([
            to12h(tm.Fajr || "05:14"),
            to12h(tm.Dhuhr || "12:18"),
            to12h(tm.Asr || "16:27"),
            to12h(tm.Maghrib || "18:04"),
            to12h(tm.Isha || "19:20"),
          ]);
        }
      })
      .catch(() => { /* fallback rehne do */ });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!play) return;
    last.current = performance.now();
    const tick = (n: number) => {
      const dt = (n - last.current) / 1000;
      last.current = n;
      const nt = Math.min(total, tRef.current + dt);
      tRef.current = nt;
      setT(nt);
      if (nt >= total) { setPlay(false); onEndRef.current?.(); return; }
      // Progress bar — direct DOM update (no React re-render, no CSS transition)
      if (barRef.current) {
        barRef.current.style.width = `${(nt / total) * 100}%`;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, total]);

  const sc = Math.min(SCENES.length - 1, Math.floor(t / SCENE_LEN));
  const S = SCENES[sc];

  // Scene change par whoosh SFX
  useEffect(() => {
    if (lastScene.current !== sc) {
      lastScene.current = sc;
      if (soundOn && t > 0.1) {
        playWhoosh();
        // Elements ke liye subtle pops (staggered)
        playPop(0.35); playPop(0.6); playPop(0.85);
      }
    }
  }, [sc, soundOn, t]);

  // Bar ko seek/replay par sync karo
  useEffect(() => {
    if (barRef.current) barRef.current.style.width = `${(t / total) * 100}%`;
  }, [t, total]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const nt = Math.max(0, Math.min(total - 0.01, ((e.clientX - r.left) / r.width) * total));
    tRef.current = nt;
    setT(nt);
    lastScene.current = Math.floor(nt / SCENE_LEN); // seek par dobara whoosh nahi
  };

  const replay = () => {
    tRef.current = 0;
    setT(0);
    lastScene.current = -1;
    setPlay(true);
  };

  const toggleSound = () => {
    const v = !soundOn;
    setSoundOn(v);
    setSound(v);
  };

  const ended = t >= total - 0.01;

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-black/10 bg-white soft-shadow">
      {/* video area */}
      <div
        className="relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center overflow-hidden px-6 text-center"
        style={{ background: S.bg, transition: "background .5s" }}
        onClick={() => setPlay((p) => !p)}
      >
        <div key={sc} className="flex flex-col items-center">
          <Scene n={sc} times={times} />
          <h3 className="ex-in mt-5 text-2xl font-extrabold tracking-tight text-[#2f3035]" style={{ animationDelay: ".3s" }}>{S.cap}</h3>
          <p className="ex-in mt-1 text-sm font-medium text-[#5c5e66]" style={{ animationDelay: ".5s" }}>{S.sub}</p>
        </div>
        {!play && !ended && (
          <div className="absolute inset-0 grid place-items-center bg-black/10">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-[#2f3035] soft-shadow">
              <Play size={26} fill="currentColor" className="ml-1" />
            </span>
          </div>
        )}
        {ended && (
          <div className="absolute inset-0 grid place-items-center bg-black/10" onClick={(e) => { e.stopPropagation(); replay(); }}>
            <span className="grid h-16 w-16 cursor-pointer place-items-center rounded-full bg-[#5865f2] text-white soft-shadow transition active:scale-95">
              <Play size={26} fill="currentColor" className="ml-1" />
            </span>
          </div>
        )}
        <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold tabular-nums text-white">
          {fmtT(t)} / {fmtT(total)}
        </div>
      </div>
      {/* controls */}
      <div className="flex items-center gap-3 bg-white px-3.5 py-3">
        <button
          onClick={() => { if (ended) { replay(); } else setPlay((p) => !p); }}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#5865f2] text-white transition active:scale-95"
          aria-label={play ? "Roko" : "Chalao"}
        >
          {play ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </button>
        <div className="relative h-2.5 flex-1 cursor-pointer rounded-full bg-black/10" onClick={seek}>
          {/* Direct DOM width updates — koi CSS transition nahi (RAF lag fix) */}
          <div ref={barRef} className="h-full rounded-full bg-gradient-to-r from-[#5865f2] to-[#9b7bff]" style={{ width: "0%" }} />
          {SCENES.map((_, i) => i > 0 && (
            <span
              key={i}
              className={`absolute top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full transition-colors ${i <= sc ? "bg-[#5865f2]" : "bg-white/90"}`}
              style={{ left: `calc(${(i / SCENES.length) * 100}% - 1px)` }}
            />
          ))}
        </div>
        <button
          onClick={toggleSound}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#5c5e66] hover:bg-black/5"
          aria-label={soundOn ? "Sound band karo" : "Sound chalao"}
        >
          {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <button
          onClick={replay}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#5c5e66] hover:bg-black/5"
        >
          Dobara
        </button>
      </div>
    </div>
  );
}
