"use client";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft, Play, Pause, Square, Volume2, VolumeX, Maximize,
  Heart, Share2, ChevronDown, Shuffle, Trophy, Bell, BellOff,
  SkipBack, SkipForward, Eye, Layers, Target, GraduationCap, Check,
  Clapperboard, ListMusic, RotateCcw, RotateCw,
} from "lucide-react";
import { ASMA_UL_HUSNA, ASMA_FAZILAT } from "@/lib/asma";
import { toast } from "@/lib/store";
import {
  useVideo, setVideoSlot, onVideoEnded,
  videoPlay, videoToggle, videoStop, videoSeekFrac, videoSkip, videoToggleMute,
  fmtVideoTime, VIDEO_POSTER,
} from "@/lib/videoPlayer";

/* ───────── helpers ───────── */
const LS = {
  get(k: string, d: string) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
const dayOfYear = () => {
  const n = new Date();
  return Math.floor((n.getTime() - new Date(n.getFullYear(), 0, 0).getTime()) / 864e5);
};
const fmtT = fmtVideoTime; // singleton helper

/* ───────── achievements ───────── */
const ACH_DEFS = [
  { id: "first", icon: "☝️", title: "Pehla naam!", desc: "99 naamon ka safar shuru" },
  { id: "fav5", icon: "❤️", title: "5 pasandida!", desc: "5 naam favorite kiye" },
  { id: "quiz10", icon: "🎯", title: "Quiz master!", desc: "Quiz me 10/10 score" },
  { id: "mem25", icon: "🌟", title: "25 yaad!", desc: "Memorize me 25 naam reveal" },
  { id: "mukammal", icon: "🎉", title: "Mukammal!", desc: "Poori video dekhi" },
];

type Mode = "video" | "naam" | "flash" | "quiz" | "memorize";
const TABS: { id: Mode; label: string; icon: any }[] = [
  { id: "video", label: "Video", icon: Clapperboard },
  { id: "naam", label: "99 Naam", icon: ListMusic },
  { id: "flash", label: "Flashcards", icon: Layers },
  { id: "quiz", label: "Quiz", icon: Target },
  { id: "memorize", label: "Yaad karo", icon: GraduationCap },
];

/* ═══════════════ MAIN ═══════════════ */
export default function AsmaPlayer({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("video");
  const [favs, setFavs] = useState<number[]>(() => { try { return JSON.parse(LS.get("chatsapp:asma:fav", "[]")); } catch { return []; } });
  const [filter, setFilter] = useState<"all" | "fav">("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [achv, setAchv] = useState<string[]>(() => { try { return JSON.parse(LS.get("chatsapp:asma:achv", "[]")); } catch { return []; } });
  const [achPop, setAchPop] = useState<{ icon: string; title: string; desc: string } | null>(null);
  const [reminder, setReminder] = useState(() => LS.get("chatsapp:asma:reminder", "0") === "1");
  const [dailyOpen, setDailyOpen] = useState(true);

  /* ── video — APP-LEVEL singleton (VideoStage me ek hi element, kabhi unmount nahi) ── */
  const v = useVideo();
  const frameRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const [seekFlash, setSeekFlash] = useState<string | null>(null);
  const flashTimer = useRef(0);
  const lastTap = useRef<{ t: number } | null>(null);

  const playing = v.playing;
  const started = v.started;
  const pos = v.pos;
  const dur = v.dur;
  const muted = v.muted;
  const pct = dur > 0 ? Math.round((pos / dur) * 100) : 0;

  const dailyIdx = dayOfYear() % 99;
  const daily = ASMA_UL_HUSNA[dailyIdx];

  /* ── achievements ── */
  const unlock = (id: string) => {
    const cur = JSON.parse(LS.get("chatsapp:asma:achv", "[]")) as string[];
    if (cur.includes(id)) return;
    const def = ACH_DEFS.find((a) => a.id === id);
    if (!def) return;
    const next = [...cur, id];
    LS.set("chatsapp:asma:achv", JSON.stringify(next));
    setAchv(next);
    setAchPop({ icon: def.icon, title: def.title, desc: def.desc });
    window.setTimeout(() => setAchPop(null), 3400);
  };
  useEffect(() => { unlock("first"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── daily reminder toast ── */
  useEffect(() => {
    if (LS.get("chatsapp:asma:reminder", "0") !== "1") return;
    const today = new Date().toDateString();
    if (LS.get("chatsapp:asma:remtoast", "") === today) return;
    LS.set("chatsapp:asma:remtoast", today);
    window.setTimeout(() => toast(`🌅 Aaj ka naam: ${daily.tr}`, daily.meaning), 2500);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── video slot: video tab open ho to video is frame me (portal), warna invisible host me ── */
  const isVideoTab = mode === "video";
  useEffect(() => {
    if (isVideoTab && slotRef.current) {
      setVideoSlot(slotRef.current);
      return () => setVideoSlot(null);
    }
    setVideoSlot(null);
  }, [isVideoTab]);
  // unmount (AsmaPlayer close) par slot hatao — video invisible host me wapas, CHALTI RAHEGI
  useEffect(() => () => setVideoSlot(null), []);

  /* ── video khatam → achievement popup (confetti+toast singleton me) ── */
  useEffect(() => onVideoEnded(() => unlock("mukammal")), []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── keyboard shortcuts (sirf AsmaPlayer open ho tab) ── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.code === "Space" || e.code === "KeyK") { e.preventDefault(); videoToggle(); }
      else if (e.code === "ArrowLeft") { videoSkip(-10); }
      else if (e.code === "ArrowRight") { videoSkip(10); }
      else if (e.code === "KeyF") { doFullscreen(); }
      else if (e.code === "KeyM") { videoToggleMute(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── double-tap gesture (mobile): left = −10s, right = +10s ── */
  const flashSeek = (dir: number) => {
    videoSkip(dir);
    setSeekFlash(dir > 0 ? "+10s" : "−10s");
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setSeekFlash(null), 650);
  };
  const doFullscreen = () => {
    const el = frameRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  };

  /* ── double-tap gesture (mobile): left = −10s, right = +10s ── */
  const onTapZone = (clientX: number, zoneEl: HTMLElement) => {
    if (!started) return;
    const now = Date.now();
    const prev = lastTap.current;
    if (prev && now - prev.t < 350) {
      const r = zoneEl.getBoundingClientRect();
      flashSeek(clientX < r.left + r.width / 2 ? -10 : 10);
      lastTap.current = null;
    } else {
      lastTap.current = { t: now };
    }
  };

  /* ── close par video NA roko — background me chalti rahe! (GlobalVideoBar dikhega) ── */
  const handleClose = () => { onClose(); };

  const toggleFav = (i: number) => {
    const next = favs.includes(i) ? favs.filter((f) => f !== i) : [...favs, i];
    setFavs(next);
    LS.set("chatsapp:asma:fav", JSON.stringify(next));
    if (next.length >= 5) unlock("fav5");
  };

  const share = async (i: number) => {
    const n = ASMA_UL_HUSNA[i];
    const c = document.createElement("canvas");
    c.width = 1080; c.height = 1080;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 1080, 1080);
    grad.addColorStop(0, "#0e6b4a"); grad.addColorStop(1, "#083a27");
    g.fillStyle = grad; g.fillRect(0, 0, 1080, 1080);
    g.strokeStyle = "#d4af37"; g.lineWidth = 6;
    g.strokeRect(40, 40, 1000, 1000);
    g.fillStyle = "#d4af37"; g.font = "700 44px sans-serif"; g.textAlign = "center";
    g.fillText("ASMA-UL-HUSNA", 540, 130);
    g.fillStyle = "#ffe9a8"; g.font = "120px 'Amiri Quran', serif";
    g.fillText(n.ar, 540, 480);
    g.fillStyle = "#ffffff"; g.font = "800 56px sans-serif";
    g.fillText(n.tr, 540, 620);
    g.fillStyle = "rgba(255,255,255,0.85)"; g.font = "44px sans-serif";
    g.fillText(n.meaning, 540, 700);
    g.fillStyle = "rgba(255,255,255,0.5)"; g.font = "36px sans-serif";
    g.fillText("ChatsApp · Deen", 540, 960);
    c.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `asma-${i + 1}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: n.tr }); return; } catch { /* fallthrough */ }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `asma-${i + 1}.png`; a.click();
      toast("Card download ho gaya 📤", "Doston ko bhejo!");
    }, "image/png");
  };

  const toggleReminder = async () => {
    const next = !reminder;
    if (next && "Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch { /* ignore */ }
    }
    setReminder(next);
    LS.set("chatsapp:asma:reminder", next ? "1" : "0");
    toast(next ? "🔔 Reminder on" : "🔕 Reminder off", next ? "Roz subah aaj ka naam milega" : "");
  };

  const list = (() => {
    const all = ASMA_UL_HUSNA.map((_, i) => i);
    return filter === "fav" ? all.filter((i) => favs.includes(i)) : all;
  })();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f4f4f6]">
      {/* header */}
      <header className="flex shrink-0 items-center gap-2 border-b border-black/10 bg-white/80 px-3 py-2.5 backdrop-blur">
        <button onClick={handleClose} className="rounded-lg p-2 text-[#5c5e66] hover:bg-black/5" aria-label="Wapas">
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold text-[#2f3035]">Asma-ul-Husna ✨</p>
          <p className="truncate text-xs text-[#80848e]">Atif Aslam ki awaz me · 99 naam</p>
        </div>
        <button onClick={toggleReminder} className="rounded-lg p-2 text-[#5c5e66] hover:bg-black/5" aria-label="Reminder">
          {reminder ? <Bell size={18} className="text-[#d4af37]" /> : <BellOff size={18} />}
        </button>
      </header>

      {/* achievement popup */}
      {achPop && (
        <div className="ach-pop pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-xl bg-[#1e1f22] px-4 py-3 text-white shadow-2xl">
            <span className="text-3xl">{achPop.icon}</span>
            <span>
              <span className="block text-sm font-extrabold text-[#ffd76a]">Achievement: {achPop.title}</span>
              <span className="block text-xs text-white/70">{achPop.desc}</span>
            </span>
          </div>
        </div>
      )}

      {/* mode tabs */}
      <div className="flex shrink-0 gap-1.5 overflow-x-auto px-3 py-2.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold transition ${mode === t.id ? "bg-[#0e6b4a] text-white soft-shadow" : "bg-black/[0.04] text-[#5c5e66] hover:bg-black/[0.07]"}`}
            ><Icon size={15} /> {t.label}</button>
          );
        })}
      </div>

      {/* body */}
      <div className="thin-scroll relative min-h-0 flex-1 overflow-y-auto">
        {mode === "naam" && (
          <NamesList
            favs={favs} filter={filter} setFilter={setFilter}
            expanded={expanded} setExpanded={setExpanded}
            list={list} achv={achv}
            dailyIdx={dailyIdx} daily={daily} dailyOpen={dailyOpen} setDailyOpen={setDailyOpen}
            onToggleFav={toggleFav} onShare={share}
          />
        )}
        {mode === "flash" && <Flashcards />}
        {mode === "quiz" && <Quiz onMaster={() => unlock("quiz10")} />}
        {mode === "memorize" && <Memorize onReveal25={() => unlock("mem25")} />}

        {/* ═══ video player — video element VideoStage me hai, yahan portal slot hai ═══ */}
        <div className={isVideoTab
          ? "mx-auto flex min-h-full max-w-2xl flex-col justify-center p-3 sm:p-6"
          : "hidden"
        }>
          {isVideoTab ? (
            <div>
              {/* ★ calligraphy header — animated */}
              <div className="asma-fadein mb-3 text-center">
                <p className="font-quran text-[34px] leading-snug text-[#0e6b4a]" dir="rtl" lang="ar">أَسْمَاءُ الْحُسْنَىٰ</p>
                <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a7b1e]">Atif Aslam • 99 Names of Allah</p>
              </div>

              {/* ★ themed frame — emerald/gold glassmorphism + golden pulse jab play ho */}
              <div ref={frameRef} className={`rounded-[18px] bg-gradient-to-br from-[#d4af37] via-[#0e6b4a] to-[#d4af37] p-[3px] soft-shadow ${playing ? "asma-glow" : ""}`}>
                <div className="rounded-[15px] bg-black/[0.92] p-2 backdrop-blur">
                  <div
                    className="relative aspect-video w-full overflow-hidden rounded-[10px] bg-black"
                    style={{ touchAction: "manipulation" }}
                    onTouchEnd={(e) => {
                      const t = e.changedTouches[0];
                      if (t) onTapZone(t.clientX, e.currentTarget);
                    }}
                    onDoubleClick={(e) => onTapZone(e.clientX, e.currentTarget)}
                  >
                    {/* ★ portal slot — video element yahan ata hai jab ye tab open ho */}
                    <div ref={slotRef} className="absolute inset-0" />

                    {!started && !v.err && (
                      <button onClick={videoPlay} className="group absolute inset-0 h-full w-full" aria-label="Video chalao">
                        <img src={VIDEO_POSTER} alt="Atif Aslam — Asma-ul-Husna" className="h-full w-full object-cover" loading="lazy" draggable={false} />
                        <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                        <span className="absolute inset-0 grid place-items-center">
                          <span className="grid h-20 w-20 place-items-center rounded-full bg-[#d4af37] text-[#083a27] shadow-2xl transition group-hover:scale-110 group-active:scale-95">
                            <Play size={36} className="ml-1.5" fill="currentColor" />
                          </span>
                        </span>
                        <span className="absolute bottom-3 left-4 right-4 text-left">
                          <span className="block font-quran text-2xl text-[#ffe9a8] drop-shadow" dir="rtl" lang="ar">أَسْمَاءُ ٱلْحُسْنَىٰ</span>
                          <span className="mt-0.5 block text-[13px] font-bold text-white/90">Atif Aslam — 99 Names of Allah 🎙️</span>
                        </span>
                        <span className="absolute right-3 top-3 flex gap-1.5">
                          <span className="rounded-md bg-[#0e6b4a] px-1.5 py-0.5 text-[11px] font-bold text-white">OFFLINE</span>
                          <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white">HD</span>
                        </span>
                      </button>
                    )}
                    {v.err && (
                      <div className="absolute inset-0 grid place-items-center p-6 text-center">
                        <p className="text-sm font-bold text-white/90">Video load nahi ho saki 😔<br /><span className="text-xs font-medium text-white/70">Dobara koshish karo</span></p>
                      </div>
                    )}
                    {/* double-tap seek indicator */}
                    {seekFlash && (
                      <div className="pointer-events-none absolute inset-0 grid place-items-center">
                        <span key={seekFlash} className="seek-flash rounded-2xl bg-black/70 px-5 py-3 text-2xl font-extrabold tabular-nums text-[#ffd76a]">
                          {seekFlash}
                        </span>
                      </div>
                    )}
                  </div>

                  {started && (
                    <div className="px-2 pb-1.5 pt-2.5">
                      <button
                        onClick={(e) => {
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          videoSeekFrac(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
                        }}
                        className="block w-full py-1.5" aria-label="Seek"
                      >
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                          <div className="h-full rounded-full bg-[#d4af37] transition-all" style={{ width: dur > 0 ? `${(pos / dur) * 100}%` : "0%" }} />
                        </div>
                      </button>
                      <div className="mt-1 flex items-center gap-1.5">
                        <button onClick={videoToggle} className="grid h-11 w-11 place-items-center rounded-full bg-[#d4af37] text-[#083a27] transition hover:brightness-110 active:scale-95" aria-label={playing ? "Pause" : "Play"}>
                          {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} className="ml-0.5" fill="currentColor" />}
                        </button>
                        <button onClick={() => flashSeek(-10)} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white/90 transition hover:bg-white/25 active:scale-95" aria-label="10 second peeche" title="−10s">
                          <span className="relative">
                            <RotateCcw size={15} />
                            <span className="absolute inset-0 grid place-items-center text-[7px] font-extrabold">10</span>
                          </span>
                        </button>
                        <button onClick={() => flashSeek(10)} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white/90 transition hover:bg-white/25 active:scale-95" aria-label="10 second aage" title="+10s">
                          <span className="relative">
                            <RotateCw size={15} />
                            <span className="absolute inset-0 grid place-items-center text-[7px] font-extrabold">10</span>
                          </span>
                        </button>
                        <button onClick={videoStop} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white/90 transition hover:bg-white/25 active:scale-95" aria-label="Stop">
                          <Square size={15} fill="currentColor" />
                        </button>
                        <span className="ml-1 text-xs font-bold tabular-nums text-white/80">{fmtT(pos)} / {fmtT(dur)}</span>
                        <span className="flex-1" />
                        <button onClick={videoToggleMute} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white/90 transition hover:bg-white/25" aria-label="Mute">
                          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                        <button onClick={doFullscreen} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white/90 transition hover:bg-white/25" aria-label="Fullscreen">
                          <Maximize size={16} />
                        </button>
                      </div>
                      {/* ★ watch progress */}
                      <div className="mt-2 flex items-center gap-2 px-0.5">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-[#ffd76a] transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="shrink-0 text-[11px] font-bold tabular-nums text-white/70">{pct}% dekhi</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-2 text-center text-[11px] text-[#80848e]">Double-tap: left −10s · right +10s · Space/K play · ←/→ seek · F fullscreen · M mute</p>
            </div>
          ) : null}
        </div>

        {/* mini-player — dusre tabs par: video (audio) chalti rahe */}
        {!isVideoTab && started && (
          <div className="fixed bottom-3 left-3 right-3 z-40 sm:left-auto sm:right-6 sm:w-[380px]">
            <div className="flex items-center gap-2.5 rounded-2xl bg-[#0e6b4a] p-2.5 pr-3 text-white shadow-2xl">
              <img src={VIDEO_POSTER} alt="" className="h-11 w-16 shrink-0 rounded-lg object-cover" draggable={false} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-extrabold">Asma-ul-Husna</p>
                <p className="text-[11px] font-bold tabular-nums text-white/70">{fmtT(pos)} / {fmtT(dur)}</p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-[#d4af37]" style={{ width: dur > 0 ? `${(pos / dur) * 100}%` : "0%" }} />
                </div>
              </div>
              <button onClick={videoToggle} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#d4af37] text-[#083a27] transition active:scale-95" aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} className="ml-0.5" fill="currentColor" />}
              </button>
              <button onClick={videoStop} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-white/90 transition active:scale-95" aria-label="Stop">
                <Square size={13} fill="currentColor" />
              </button>
              <button onClick={() => setMode("video")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-white/90 transition active:scale-95" aria-label="Video par wapas">
                <Maximize size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════ NAMES LIST (shared) ═══════════════ */
function NamesList(p: {
  favs: number[]; filter: "all" | "fav"; setFilter: (f: "all" | "fav") => void;
  expanded: number | null; setExpanded: (v: number | null) => void;
  list: number[]; achv: string[];
  dailyIdx: number; daily: any; dailyOpen: boolean; setDailyOpen: (v: boolean) => void;
  onToggleFav: (i: number) => void; onShare: (i: number) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-3 p-3 sm:p-4">
      {/* daily */}
      <div className="overflow-hidden rounded-2xl border border-[#d4af37]/40 bg-[#fffdf3] soft-shadow">
        <button onClick={() => p.setDailyOpen(!p.dailyOpen)} className="flex w-full items-center gap-3 p-4 text-left">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#d4af37]/15 text-2xl">🌅</span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-[0.1em] text-[#9a7b1e]">Aaj ka naam</span>
            <span className="block truncate text-[15px] font-extrabold text-[#2f3035]">{p.daily.tr} <span className="font-semibold text-[#80848e]">· {p.daily.meaning}</span></span>
          </span>
          <ChevronDown size={18} className={`shrink-0 text-[#80848e] transition ${p.dailyOpen ? "rotate-180" : ""}`} />
        </button>
        {p.dailyOpen && (
          <div className="border-t border-[#d4af37]/25 px-4 pb-4 pt-3">
            <p className="text-center font-quran text-4xl text-[#0e6b4a]" dir="rtl" lang="ar">{p.daily.ar}</p>
            <p className="mt-2 text-center text-sm text-[#5c5e66]">{ASMA_FAZILAT[p.dailyIdx]}</p>
          </div>
        )}
      </div>

      {/* achievements */}
      <div className="rounded-2xl border border-black/10 bg-white/70 p-4 soft-shadow">
        <p className="flex items-center gap-1.5 text-[13px] font-extrabold text-[#2f3035]"><Trophy size={14} className="text-[#d4af37]" /> Achievements</p>
        <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
          {ACH_DEFS.map((a) => {
            const has = p.achv.includes(a.id);
            return (
              <div key={a.id} className={`flex w-20 shrink-0 flex-col items-center rounded-xl border p-2.5 text-center ${has ? "border-[#d4af37]/60 bg-[#fff8e1]" : "border-black/10 bg-black/[0.03] opacity-50"}`}>
                <span className="text-2xl">{has ? a.icon : "🔒"}</span>
                <span className="mt-1 text-[10px] font-bold leading-tight text-[#2f3035]">{a.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* filter */}
      <div className="flex gap-1.5">
        {(["all", "fav"] as const).map((f) => (
          <button
            key={f}
            onClick={() => p.setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${p.filter === f ? "bg-[#0e6b4a] text-white soft-shadow" : "bg-black/5 text-[#5c5e66]"}`}
          >{f === "all" ? `Sab (99)` : `❤️ Pasand (${p.favs.length})`}</button>
        ))}
      </div>

      {/* list */}
      <div className="space-y-1.5 pb-2">
        {p.list.length === 0 && (
          <p className="rounded-xl bg-black/[0.04] p-6 text-center text-sm text-[#80848e]">Koi pasandida naam nahi — ❤️ dabao!</p>
        )}
        {p.list.map((i) => {
          const n = ASMA_UL_HUSNA[i];
          const isFav = p.favs.includes(i);
          const open = p.expanded === i;
          return (
            <div key={i} className="rounded-xl border border-black/10 bg-white/70 p-3 soft-shadow">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/[0.06] text-xs font-extrabold tabular-nums text-[#80848e]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-extrabold text-[#2f3035]">{n.tr}</span>
                  <span className="block truncate text-xs text-[#80848e]">{n.meaning}</span>
                </div>
                <span className="shrink-0 font-quran text-[26px] leading-none text-[#0e6b4a]" dir="rtl" lang="ar">{n.ar}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1 pl-11">
                <button onClick={() => p.onToggleFav(i)} className={`rounded-md p-1.5 transition ${isFav ? "text-[#e5486f]" : "text-[#b0b3ba] hover:text-[#e5486f]"}`} aria-label="Pasand">
                  <Heart size={15} fill={isFav ? "currentColor" : "none"} />
                </button>
                <button onClick={() => p.onShare(i)} className="rounded-md p-1.5 text-[#b0b3ba] hover:text-[#0e6b4a]" aria-label="Share">
                  <Share2 size={15} />
                </button>
                <button onClick={() => p.setExpanded(open ? null : i)} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-bold text-[#80848e] hover:text-[#0e6b4a]">
                  Fazilat <ChevronDown size={13} className={`transition ${open ? "rotate-180" : ""}`} />
                </button>
              </div>
              {open && (
                <p className="mt-1.5 rounded-lg bg-[#0e6b4a]/[0.06] px-3 py-2 pl-11 text-[13px] leading-relaxed text-[#2f3035]">
                  <span className="font-extrabold text-[#0e6b4a]">Fazilat: </span>{ASMA_FAZILAT[i]}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════ FLASHCARDS ═══════════════ */
function Flashcards() {
  const [order, setOrder] = useState<number[]>(() => ASMA_UL_HUSNA.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const idx = order[pos];
  const n = ASMA_UL_HUSNA[idx];

  const go = (d: number) => { setFlipped(false); setPos((p) => (p + d + order.length) % order.length); };
  const shuffle = () => {
    const arr = [...order];
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    setOrder(arr); setPos(0); setFlipped(false);
    toast("Shuffle ho gaya 🔀", "Nayi tarteeb me yaad karo");
  };

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-extrabold tabular-nums text-[#5c5e66]">{pos + 1} / 99</p>
        <button onClick={shuffle} className="flex items-center gap-1.5 rounded-lg bg-black/[0.05] px-3 py-1.5 text-xs font-bold text-[#5c5e66] hover:bg-black/[0.08]">
          <Shuffle size={13} /> Shuffle
        </button>
      </div>

      <button onClick={() => setFlipped((f) => !f)} className={`asma-flip mt-3 flex-1 ${flipped ? "asma-flipped" : ""}`} aria-label="Flip">
        <div className="asma-flip-inner relative min-h-[340px] w-full">
          <div className="asma-face absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-[#d4af37]/50 bg-gradient-to-br from-[#fffdf3] to-[#fdf4dd] p-6 soft-shadow">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#9a7b1e]">Naam dekho — matlab yaad karo</p>
            <p className="mt-4 font-quran text-7xl leading-snug text-[#0e6b4a]" dir="rtl" lang="ar">{n.ar}</p>
            <p className="mt-6 flex items-center gap-1.5 text-[13px] font-bold text-[#9a7b1e]"><Eye size={15} /> Tap karo — jawab dekho</p>
          </div>
          <div className="asma-face asma-back absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#0e6b4a] to-[#083a27] p-6 text-white soft-shadow">
            <p className="text-lg font-extrabold">{n.tr}</p>
            <p className="mt-2 text-center text-[15px] text-white/85">{n.meaning}</p>
            <p className="mt-3 max-w-xs text-center text-[13px] leading-relaxed text-white/70">{ASMA_FAZILAT[idx]}</p>
          </div>
        </div>
      </button>

      <div className="mt-4 flex items-center justify-center gap-3 pb-2">
        <button onClick={() => go(-1)} className="grid h-12 w-12 place-items-center rounded-full bg-black/[0.06] text-[#2f3035] transition active:scale-95" aria-label="Pichla">
          <SkipBack size={20} />
        </button>
        <button onClick={() => setFlipped((f) => !f)} className="rounded-full bg-[#0e6b4a] px-8 py-3 text-[15px] font-extrabold text-white transition active:scale-95 soft-shadow">
          {flipped ? "Wapas" : "Jawab dekho"}
        </button>
        <button onClick={() => go(1)} className="grid h-12 w-12 place-items-center rounded-full bg-black/[0.06] text-[#2f3035] transition active:scale-95" aria-label="Agla">
          <SkipForward size={20} />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════ QUIZ ═══════════════ */
interface QuizQ { answer: number; options: number[]; }
function Quiz({ onMaster }: { onMaster: () => void }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(() => parseInt(LS.get("chatsapp:asma:quizbest", "0"), 10) || 0);
  const [q, setQ] = useState<QuizQ | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const newQ = () => {
    const answer = Math.floor(Math.random() * 99);
    const opts = new Set<number>([answer]);
    while (opts.size < 4) opts.add(Math.floor(Math.random() * 99));
    setQ({ answer, options: [...opts].sort(() => Math.random() - 0.5) });
    setPicked(null);
  };
  useEffect(() => { newQ(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (i: number) => {
    if (!q || picked !== null) return;
    setPicked(i);
    const ok = i === q.answer;
    const ns = score + (ok ? 1 : 0);
    const nst = ok ? streak + 1 : 0;
    if (ok) { setScore(ns); setStreak(nst); }
    else setStreak(0);
    if (nst > best) { setBest(nst); LS.set("chatsapp:asma:quizbest", String(nst)); }
    window.setTimeout(() => {
      if (round + 1 >= 10) {
        setDone(true);
        if (ns === 10) onMaster();
      } else { setRound((r) => r + 1); newQ(); }
    }, 1100);
  };

  const restart = () => { setRound(0); setScore(0); setStreak(0); setDone(false); newQ(); };
  const target = q ? ASMA_UL_HUSNA[q.answer] : null;

  return (
    <div className="mx-auto max-w-2xl p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-xl border border-black/10 bg-white/70 p-3 text-center soft-shadow">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#80848e]">Score</p>
          <p className="text-xl font-extrabold tabular-nums text-[#0e6b4a]">{score}/10</p>
        </div>
        <div className="flex-1 rounded-xl border border-black/10 bg-white/70 p-3 text-center soft-shadow">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#80848e]">Streak 🔥</p>
          <p className="text-xl font-extrabold tabular-nums text-[#d4af37]">{streak}</p>
        </div>
        <div className="flex-1 rounded-xl border border-black/10 bg-white/70 p-3 text-center soft-shadow">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#80848e]">Round</p>
          <p className="text-xl font-extrabold tabular-nums text-[#5c5e66]">{Math.min(round + 1, 10)}/10</p>
        </div>
      </div>

      {done ? (
        <div className="mt-4 rounded-2xl border border-[#d4af37]/40 bg-[#fffdf3] p-8 text-center soft-shadow">
          <p className="text-5xl">{score === 10 ? "🏆" : score >= 7 ? "🌟" : "💪"}</p>
          <p className="mt-3 text-xl font-extrabold text-[#2f3035]">{score}/10</p>
          <p className="mt-1 text-sm text-[#80848e]">{score === 10 ? "MashaAllah! Perfect!" : score >= 7 ? "Bohat khoob!" : "Phir koshish karo!"}</p>
          <button onClick={restart} className="mt-4 rounded-xl bg-[#0e6b4a] px-6 py-2.5 text-sm font-extrabold text-white transition active:scale-95 soft-shadow">
            Dobara khelo
          </button>
        </div>
      ) : target && q ? (
        <div className="mt-4">
          <div className="rounded-2xl bg-gradient-to-br from-[#0e6b4a] to-[#083a27] p-6 text-center text-white soft-shadow">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/70">Is matlab ka naam kya hai?</p>
            <p className="mt-2 text-lg font-extrabold">"{target.meaning}"</p>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {q.options.map((oi) => {
              const n = ASMA_UL_HUSNA[oi];
              const isAns = oi === q.answer;
              const isPicked = picked === oi;
              let cls = "border-black/10 bg-white/70 hover:border-[#0e6b4a]/40";
              if (picked !== null) {
                if (isAns) cls = "border-[#0e6b4a] bg-[#0e6b4a]/10";
                else if (isPicked) cls = "border-[#e5486f] bg-[#e5486f]/10";
                else cls = "border-black/10 bg-white/70 opacity-60";
              }
              return (
                <button
                  key={oi} onClick={() => pick(oi)} disabled={picked !== null}
                  className={`flex items-center justify-between rounded-xl border p-3.5 text-right transition soft-shadow ${cls}`}
                >
                  <span className="text-sm font-extrabold text-[#2f3035]">{n.tr}</span>
                  <span className="font-quran text-2xl text-[#0e6b4a]" dir="rtl" lang="ar">{n.ar}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ═══════════════ MEMORIZE ═══════════════ */
function Memorize({ onReveal25 }: { onReveal25: () => void }) {
  const [revealed, setRevealed] = useState<number[]>(() => {
    try { return JSON.parse(LS.get("chatsapp:asma:mem", "[]")); } catch { return []; }
  });
  const toggle = (i: number) => {
    const next = revealed.includes(i) ? revealed.filter((r) => r !== i) : [...revealed, i];
    setRevealed(next);
    LS.set("chatsapp:asma:mem", JSON.stringify(next));
    if (next.length >= 25) onReveal25();
  };
  const reset = () => { setRevealed([]); LS.set("chatsapp:asma:mem", "[]"); };

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-3 sm:p-4">
      <div className="rounded-2xl border border-[#d4af37]/40 bg-[#fffdf3] p-4 soft-shadow">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-extrabold text-[#2f3035]">🌟 Khud yaad karo — tap karke check karo</p>
          <button onClick={reset} className="text-xs font-bold text-[#80848e] hover:text-[#e5486f]">Reset</button>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full bg-gradient-to-r from-[#0e6b4a] to-[#d4af37] transition-all" style={{ width: `${(revealed.length / 99) * 100}%` }} />
        </div>
        <p className="mt-1.5 text-xs font-bold tabular-nums text-[#0e6b4a]">{revealed.length} / 99 reveal</p>
      </div>

      <div className="space-y-1.5 pb-2">
        {ASMA_UL_HUSNA.map((n, i) => {
          const show = revealed.includes(i);
          return (
            <button
              key={i} onClick={() => toggle(i)}
              className="flex w-full items-center gap-3 rounded-xl border border-black/10 bg-white/70 p-3 text-left soft-shadow transition active:scale-[0.99]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/[0.06] text-xs font-extrabold tabular-nums text-[#80848e]">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-extrabold text-[#2f3035]">{n.tr}</span>
                <span className="block truncate text-xs text-[#80848e]">{n.meaning}</span>
              </span>
              {show ? (
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="font-quran text-2xl text-[#0e6b4a]" dir="rtl" lang="ar">{n.ar}</span>
                  <Check size={16} className="text-[#0e6b4a]" />
                </span>
              ) : (
                <span className="shrink-0 rounded-lg bg-black/[0.06] px-3 py-1.5 font-quran text-lg text-transparent blur-[6px] select-none" dir="rtl" lang="ar">{n.ar}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
