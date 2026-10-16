"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, Play, Pause, Repeat, Heart, Share2, ChevronDown,
  Shuffle, Trophy, Bell, BellOff, SkipBack, SkipForward, Eye, ListMusic,
  Layers, Target, GraduationCap, X, Check,
} from "lucide-react";
import {
  ASMA_UL_HUSNA, ASMA_FAZILAT, ASMA_AUDIO_URL, loadAsmaTimestamps,
  type AsmaTimestamp,
} from "@/lib/asma";
import { toast } from "@/lib/store";

/* ───────── helpers ───────── */
const LS = {
  get(k: string, d: string) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
const dayOfYear = () => {
  const n = new Date();
  return Math.floor((n.getTime() - new Date(n.getFullYear(), 0, 0).getTime()) / 864e5);
};

const ACH_DEFS = [
  { id: "first", icon: "☝️", title: "Pehla naam!", desc: "Pehli baar sunna shuru kiya" },
  { id: "n25", icon: "🌟", title: "25 naam!", desc: "25 naam sun liye" },
  { id: "n50", icon: "💫", title: "50 naam!", desc: "50 naam sun liye" },
  { id: "n99", icon: "🎉", title: "99 mukammal!", desc: "Saare naam sun liye — MashaAllah!" },
  { id: "quiz10", icon: "🎯", title: "Quiz master!", desc: "Quiz me 10/10 score" },
];

type Mode = "suno" | "flash" | "quiz" | "memorize";
const TABS: { id: Mode; label: string; icon: any }[] = [
  { id: "suno", label: "Suno", icon: ListMusic },
  { id: "flash", label: "Flashcards", icon: Layers },
  { id: "quiz", label: "Quiz", icon: Target },
  { id: "memorize", label: "Yaad karo", icon: GraduationCap },
];

function fmtTime(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/* ═══════════════ MAIN ═══════════════ */
export default function AsmaPlayer({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("suno");
  const [ts, setTs] = useState<AsmaTimestamp[] | null>(null);
  const [cur, setCur] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [dur, setDur] = useState(0);
  const [pos, setPos] = useState(0);
  const [loop, setLoop] = useState(() => LS.get("chatsapp:asma:loop", "0") === "1");
  const [favs, setFavs] = useState<number[]>(() => { try { return JSON.parse(LS.get("chatsapp:asma:fav", "[]")); } catch { return []; } });
  const [filter, setFilter] = useState<"all" | "fav">("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [furthest, setFurthest] = useState(() => { const v = parseInt(LS.get("chatsapp:asma:furthest", "-1"), 10); return isNaN(v) ? -1 : v; });
  const [achv, setAchv] = useState<string[]>(() => { try { return JSON.parse(LS.get("chatsapp:asma:achv", "[]")); } catch { return []; } });
  const [achPop, setAchPop] = useState<{ icon: string; title: string; desc: string } | null>(null);
  const [reminder, setReminder] = useState(() => LS.get("chatsapp:asma:reminder", "0") === "1");
  const [dailyOpen, setDailyOpen] = useState(true);

  const audioRef = useRef<HTMLAudioElement>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const furthestRef = useRef(furthest);
  const achvRef = useRef(achv);
  const curRef = useRef(cur);
  curRef.current = cur;

  const dailyIdx = dayOfYear() % 99;
  const daily = ASMA_UL_HUSNA[dailyIdx];
  const heard = cur >= 0 ? cur + 1 : 0;

  /* ── achievements ── */
  const unlock = (id: string) => {
    if (achvRef.current.includes(id)) return;
    const def = ACH_DEFS.find((a) => a.id === id);
    if (!def) return;
    const next = [...achvRef.current, id];
    achvRef.current = next;
    setAchv(next);
    LS.set("chatsapp:asma:achv", JSON.stringify(next));
    setAchPop({ icon: def.icon, title: def.title, desc: def.desc });
    window.setTimeout(() => setAchPop(null), 3400);
  };

  /* ── load timestamps ── */
  useEffect(() => {
    loadAsmaTimestamps().then(setTs).catch(() => setTs([]));
  }, []);

  /* ── binary search: last timestamp <= time (+0.15s tolerance) ── */
  const findIdx = (time: number) => {
    if (!ts || ts.length === 0) return -1;
    const target = time + 0.15;
    let lo = 0, hi = ts.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (ts[mid].t <= target) { ans = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return ans;
  };

  /* ── audio events ── */
  const handleTime = () => {
    const a = audioRef.current;
    if (!a || !ts) return;
    setPos(a.currentTime);
    const idx = findIdx(a.currentTime);
    if (idx !== curRef.current) {
      curRef.current = idx;
      setCur(idx);
      if (idx > furthestRef.current) {
        furthestRef.current = idx;
        setFurthest(idx);
        LS.set("chatsapp:asma:furthest", String(idx));
        if (idx >= 24) unlock("n25");
        if (idx >= 49) unlock("n50");
      }
    }
  };
  const handleEnded = () => {
    if (loop) return;
    setPlaying(false);
    unlock("n99");
    furthestRef.current = 98;
    setFurthest(98);
    LS.set("chatsapp:asma:furthest", "98");
    toast("MashaAllah! 🎉", "99 naam mukammal ho gaye");
  };

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a || !ts || ts.length === 0) return;
    if (a.paused) { try { await a.play(); } catch { /* ignore */ } }
    else a.pause();
  };
  const seekTo = async (i: number) => {
    const a = audioRef.current;
    if (!a || !ts || !ts[i]) return;
    unlock("first");
    setStarted(true);
    try { a.currentTime = Math.max(0, ts[i].t + 0.01); } catch { /* ignore */ }
    try { await a.play(); } catch { /* ignore */ }
  };
  const skip = (d: number) => {
    const a = audioRef.current;
    if (!a) return;
    const ni = Math.max(0, Math.min(98, curRef.current + d));
    seekTo(ni);
  };

  /* ── loop ── */
  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loop;
    LS.set("chatsapp:asma:loop", loop ? "1" : "0");
  }, [loop]);

  /* ── auto-scroll to current name ── */
  useEffect(() => {
    if (!playing || cur < 0 || mode !== "suno") return;
    rowRefs.current.get(cur)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [cur, playing, mode]);

  /* ── media session (background / lock screen) ── */
  useEffect(() => {
    if (!("mediaSession" in navigator) || cur < 0) return;
    try {
      const n = ASMA_UL_HUSNA[cur];
      (navigator as any).mediaSession.metadata = new (window as any).MediaMetadata({
        title: `${n.tr} — ${n.meaning}`,
        artist: "Atif Aslam · Asma-ul-Husna",
        album: "ChatsApp · Deen",
      });
      (navigator as any).mediaSession.setActionHandler("play", () => audioRef.current?.play().catch(() => {}));
      (navigator as any).mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
    } catch { /* ignore */ }
  }, [cur]);

  /* ── daily reminder (in-app toast) ── */
  useEffect(() => {
    if (LS.get("chatsapp:asma:reminder", "0") !== "1") return;
    const today = new Date().toDateString();
    if (LS.get("chatsapp:asma:reminderLast", "") === today) return;
    LS.set("chatsapp:asma:reminderLast", today);
    const t = window.setTimeout(() => toast("Aaj ka naam ✨", `${daily.tr} — ${daily.meaning}`), 2000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleReminder = async () => {
    const next = !reminder;
    setReminder(next);
    LS.set("chatsapp:asma:reminder", next ? "1" : "0");
    if (next && "Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch { /* ignore */ }
    }
    toast(next ? "Reminder on 🔔" : "Reminder off", next ? "Roz aaj ka naam yaad dilayenge" : "");
  };

  const toggleFav = (i: number) => {
    setFavs((p) => {
      const next = p.includes(i) ? p.filter((x) => x !== i) : [...p, i];
      LS.set("chatsapp:asma:fav", JSON.stringify(next));
      return next;
    });
  };

  /* ── share card (canvas) ── */
  const shareName = async (i: number) => {
    const n = ASMA_UL_HUSNA[i];
    try {
      try { await (document as any).fonts?.load('120px "Amiri Quran"'); } catch { /* ignore */ }
      const c = document.createElement("canvas");
      c.width = 1080; c.height = 1080;
      const x = c.getContext("2d")!;
      const g = x.createLinearGradient(0, 0, 1080, 1080);
      g.addColorStop(0, "#0e6b4a"); g.addColorStop(1, "#073a27");
      x.fillStyle = g; x.fillRect(0, 0, 1080, 1080);
      x.strokeStyle = "rgba(212,175,55,0.85)"; x.lineWidth = 10;
      x.strokeRect(44, 44, 992, 992);
      x.strokeStyle = "rgba(212,175,55,0.3)"; x.lineWidth = 3;
      x.strokeRect(70, 70, 940, 940);
      x.textAlign = "center";
      x.fillStyle = "#f7ecc8";
      try { x.direction = "rtl"; } catch { /* ignore */ }
      x.font = '150px "Amiri Quran", serif';
      x.fillText(n.ar, 540, 470);
      try { x.direction = "ltr"; } catch { /* ignore */ }
      x.fillStyle = "#ffffff";
      x.font = "700 68px system-ui, sans-serif";
      x.fillText(n.tr, 540, 630);
      x.fillStyle = "rgba(255,255,255,0.88)";
      x.font = "500 46px system-ui, sans-serif";
      x.fillText(n.meaning, 540, 715);
      x.fillStyle = "rgba(212,175,55,0.95)";
      x.font = "600 38px system-ui, sans-serif";
      x.fillText("✨ Asma-ul-Husna · ChatsApp ✨", 540, 950);
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
      if (!blob) throw new Error("canvas");
      const file = new File([blob], `asma-${i + 1}.png`, { type: "image/png" });
      const nav = navigator as any;
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: n.tr });
      } else {
        const url = URL.createObjectURL(blob);
        const aEl = document.createElement("a");
        aEl.href = url; aEl.download = `asma-${i + 1}.png`; aEl.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        toast("Card download ho gaya 📤", n.tr);
      }
    } catch {
      toast("Share nahi ho saka", "Dobara koshish karo");
    }
  };

  const list = useMemo(() => {
    const idxs = ASMA_UL_HUSNA.map((_, i) => i);
    return filter === "fav" ? idxs.filter((i) => favs.includes(i)) : idxs;
  }, [filter, favs]);

  const curName = cur >= 0 ? ASMA_UL_HUSNA[cur] : null;
  const pct = furthest >= 0 ? Math.round(((furthest + 1) / 99) * 100) : 0;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#f4f5fa]/[0.98] backdrop-blur-xl">
      {/* hidden audio */}
      <audio
        ref={audioRef}
        src={ASMA_AUDIO_URL}
        preload="metadata"
        onTimeUpdate={handleTime}
        onEnded={handleEnded}
        onPlay={() => { setPlaying(true); setStarted(true); unlock("first"); }}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDur((e.target as HTMLAudioElement).duration || 0)}
      />

      {/* achievement popup */}
      {achPop && (
        <div className="ach-pop fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-xl border-2 border-[#d4af37] bg-[#1c1e24] p-3.5 shadow-2xl">
            <span className="text-3xl">{achPop.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-[#ffd76a]">Achievement hasil! 🏆</span>
              <span className="block truncate text-[13px] font-bold text-white">{achPop.title}</span>
              <span className="block truncate text-xs text-white/60">{achPop.desc}</span>
            </span>
          </div>
        </div>
      )}

      {/* header */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-black/10 px-3">
        <button onClick={onClose} className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5" aria-label="Wapas">
          <ChevronLeft size={20} />
        </button>
        <span className="text-xl">✨</span>
        <h1 className="min-w-0 flex-1 truncate text-[16px] font-extrabold tracking-tight text-[#2f3035]">Asma-ul-Husna</h1>
        <button
          onClick={toggleReminder}
          className={`rounded-lg p-2 transition ${reminder ? "bg-[#d4af37]/15 text-[#9a7b1e]" : "text-[#5c5e66] hover:bg-black/5"}`}
          aria-label="Daily reminder"
          title="Rozana yaad-dihani"
        >{reminder ? <Bell size={19} /> : <BellOff size={19} />}</button>
      </header>

      {/* mode tabs */}
      <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-black/10 px-3 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold transition ${
              mode === t.id ? "bg-[#0e6b4a] text-white soft-shadow" : "bg-black/[0.04] text-[#5c5e66] hover:bg-black/[0.07]"
            }`}
          ><t.icon size={15} /> {t.label}</button>
        ))}
      </div>

      {/* body */}
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {mode === "suno" && (
          <SunoMode
            ts={ts} cur={cur} curName={curName} heard={heard} playing={playing} started={started}
            dur={dur} pos={pos} loop={loop} setLoop={setLoop}
            favs={favs} filter={filter} setFilter={setFilter}
            expanded={expanded} setExpanded={setExpanded}
            list={list} rowRefs={rowRefs}
            pct={pct} furthest={furthest}
            dailyIdx={dailyIdx} daily={daily} dailyOpen={dailyOpen} setDailyOpen={setDailyOpen}
            achv={achv}
            onTogglePlay={togglePlay} onSeekTo={seekTo} onSkip={skip}
            onToggleFav={toggleFav} onShare={shareName}
          />
        )}
        {mode === "flash" && <Flashcards />}
        {mode === "quiz" && <Quiz onMaster={() => unlock("quiz10")} />}
        {mode === "memorize" && <Memorize onPlayName={seekTo} tsLoaded={!!ts && ts.length > 0} />}
      </div>

      {/* mini player */}
      {started && (
        <div className="shrink-0 border-t border-black/10 bg-white/85 px-3 py-2 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <button
              onClick={togglePlay}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#0e6b4a] text-white transition active:scale-95"
              aria-label={playing ? "Roko" : "Chalao"}
            >{playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}</button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-extrabold text-[#2f3035]">
                {curName ? `${curName.tr}` : "…"} <span className="font-semibold text-[#80848e]">{heard}/99</span>
              </p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10">
                <div className="h-full rounded-full bg-gradient-to-r from-[#d4af37] to-[#f5d67b] transition-all" style={{ width: `${(heard / 99) * 100}%` }} />
              </div>
            </div>
            {dur > 0 && <span className="shrink-0 text-xs font-bold tabular-nums text-[#80848e]">{fmtTime(pos)} / {fmtTime(dur)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════ SUNO MODE ═══════════════ */
function SunoMode(p: {
  ts: AsmaTimestamp[] | null; cur: number; curName: any; heard: number;
  playing: boolean; started: boolean; dur: number; pos: number;
  loop: boolean; setLoop: (v: boolean) => void;
  favs: number[]; filter: "all" | "fav"; setFilter: (f: "all" | "fav") => void;
  expanded: number | null; setExpanded: (v: number | null) => void;
  list: number[]; rowRefs: React.RefObject<Map<number, HTMLDivElement>>;
  pct: number; furthest: number;
  dailyIdx: number; daily: any; dailyOpen: boolean; setDailyOpen: (v: boolean) => void;
  achv: string[];
  onTogglePlay: () => void; onSeekTo: (i: number) => void; onSkip: (d: number) => void;
  onToggleFav: (i: number) => void; onShare: (i: number) => void;
}) {
  const { ts, cur, curName, heard, playing, started, dur, pos, loop, setLoop } = p;
  const loading = ts === null;
  const failed = ts !== null && ts.length === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-3 p-3 sm:p-4">
      {/* hero */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0e6b4a] to-[#083a27] p-5 text-white soft-shadow">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/70">
            {started ? `Abhi chal raha hai · ${heard}/99` : "Atif Aslam ki awaz me 🎙️"}
          </p>
          <button
            onClick={() => setLoop(!loop)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${loop ? "bg-[#d4af37] text-[#083a27]" : "bg-white/15 text-white/85 hover:bg-white/25"}`}
            title="Loop"
          ><Repeat size={13} /> {loop ? "On" : "Off"}</button>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <button
            onClick={p.onTogglePlay}
            disabled={loading || failed}
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#d4af37] text-[#083a27] shadow-lg transition active:scale-95 disabled:opacity-50"
            aria-label={playing ? "Roko" : "Chalao"}
          >{playing ? <Pause size={28} /> : <Play size={28} className="ml-1" />}</button>
          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="space-y-2"><div className="h-8 w-3/4 animate-pulse rounded bg-white/20" /><div className="h-4 w-1/2 animate-pulse rounded bg-white/15" /></div>
            ) : failed ? (
              <p className="text-sm font-bold text-white/90">Audio load nahi ho saka 🌐<br /><span className="text-xs font-medium text-white/70">Internet check karke dobara kholo</span></p>
            ) : curName ? (
              <>
                <p className="font-quran text-4xl leading-snug text-[#ffe9a8]" dir="rtl" lang="ar">{curName.ar}</p>
                <p className="mt-1 truncate text-[15px] font-extrabold">{curName.tr} <span className="font-medium text-white/70">· {curName.meaning}</span></p>
              </>
            ) : (
              <p className="text-[15px] font-bold text-white/90">Play dabao —<br /><span className="text-sm font-medium text-white/70">99 naam, perfect sync ke saath ✨</span></p>
            )}
          </div>
        </div>

        {/* transport */}
        {started && (
          <div className="mt-4 flex items-center gap-2">
            <button onClick={() => p.onSkip(-1)} className="rounded-lg bg-white/15 p-2 text-white/90 hover:bg-white/25" aria-label="Pichla"><SkipBack size={16} /></button>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-[#d4af37] transition-all" style={{ width: dur > 0 ? `${(pos / dur) * 100}%` : "0%" }} />
            </div>
            <button onClick={() => p.onSkip(1)} className="rounded-lg bg-white/15 p-2 text-white/90 hover:bg-white/25" aria-label="Agla"><SkipForward size={16} /></button>
            {dur > 0 && <span className="text-xs font-bold tabular-nums text-white/80">{fmtTime(pos)} / {fmtTime(dur)}</span>}
          </div>
        )}
      </div>

      {/* daily naam */}
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
            <button
              onClick={() => p.onSeekTo(p.dailyIdx)}
              disabled={loading || failed}
              className="mx-auto mt-3 flex items-center gap-1.5 rounded-lg bg-[#0e6b4a] px-4 py-2 text-[13px] font-bold text-white transition active:scale-95 disabled:opacity-50"
            ><Play size={14} /> Suno</button>
          </div>
        )}
      </div>

      {/* progress */}
      <div className="rounded-2xl border border-black/10 bg-white/70 p-4 soft-shadow">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-extrabold text-[#2f3035]">📊 Kitna suna</p>
          <p className="text-[13px] font-bold tabular-nums text-[#0e6b4a]">{p.pct}%</p>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full bg-gradient-to-r from-[#0e6b4a] to-[#d4af37] transition-all" style={{ width: `${p.pct}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-[#80848e]">{p.furthest >= 0 ? `${p.furthest + 1} / 99 naam` : "Abhi shuru nahi kiya"}</p>
      </div>

      {/* achievements gallery */}
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

      {/* filter chips */}
      <div className="flex gap-1.5">
        {(["all", "fav"] as const).map((f) => (
          <button
            key={f}
            onClick={() => p.setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${p.filter === f ? "bg-[#0e6b4a] text-white soft-shadow" : "bg-black/5 text-[#5c5e66]"}`}
          >{f === "all" ? `Sab (99)` : `❤️ Pasand (${p.favs.length})`}</button>
        ))}
      </div>

      {/* names list */}
      <div className="space-y-1.5 pb-2">
        {p.list.length === 0 && (
          <p className="rounded-xl bg-black/[0.04] p-6 text-center text-sm text-[#80848e]">Koi pasandida naam nahi — ❤️ dabao!</p>
        )}
        {p.list.map((i) => {
          const n = ASMA_UL_HUSNA[i];
          const active = i === cur;
          const played = cur >= 0 && i < cur;
          const isFav = p.favs.includes(i);
          const open = p.expanded === i;
          return (
            <div
              key={i}
              ref={(el) => { if (el) p.rowRefs.current.set(i, el); else p.rowRefs.current.delete(i); }}
              className={`rounded-xl border bg-white/70 p-3 transition soft-shadow ${active ? "asma-shine asma-current border-[#d4af37]" : "border-black/10"}`}
            >
              <div className="flex items-center gap-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-extrabold tabular-nums ${active ? "bg-[#d4af37] text-white" : "bg-black/[0.06] text-[#80848e]"}`}>
                  {played ? <Check size={14} /> : i + 1}
                </span>
                <button onClick={() => p.onSeekTo(i)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[15px] font-extrabold text-[#2f3035]">{n.tr}</span>
                  <span className="block truncate text-xs text-[#80848e]">{n.meaning}</span>
                </button>
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
                {played && <span className="ml-auto flex items-center gap-1 text-[11px] font-bold text-[#0e6b4a]"><Check size={12} /> suna</span>}
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
          {/* front: arabic only */}
          <div className="asma-face absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-[#d4af37]/50 bg-gradient-to-br from-[#fffdf3] to-[#fdf4dd] p-6 soft-shadow">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#9a7b1e]">Naam dekho — matlab yaad karo</p>
            <p className="mt-4 font-quran text-7xl leading-snug text-[#0e6b4a]" dir="rtl" lang="ar">{n.ar}</p>
            <p className="mt-6 flex items-center gap-1.5 text-[13px] font-bold text-[#9a7b1e]"><Eye size={15} /> Tap karo — jawab dekho</p>
          </div>
          {/* back: meaning */}
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
      {/* score bar */}
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
          <p className="text-xl font-extrabold tabular-nums text-[#2f3035]">{Math.min(round + 1, 10)}/10</p>
        </div>
      </div>

      {done ? (
        <div className="mt-4 rounded-2xl bg-gradient-to-br from-[#0e6b4a] to-[#083a27] p-8 text-center text-white soft-shadow">
          <p className="text-5xl">{score === 10 ? "🏆" : score >= 7 ? "🎉" : "💪"}</p>
          <p className="mt-3 text-2xl font-extrabold">{score}/10</p>
          <p className="mt-1 text-sm text-white/75">
            {score === 10 ? "Kamaal! Quiz Master ban gaye! 🎯" : score >= 7 ? "Bohat khoob! Phir try karo 10/10 ke liye!" : "Himmat nahi harni — dobara khelo!"}
          </p>
          <button onClick={restart} className="mt-5 rounded-xl bg-[#d4af37] px-8 py-3 text-[15px] font-extrabold text-[#083a27] transition active:scale-95">
            Dobara khelo
          </button>
        </div>
      ) : target && q ? (
        <div className="mt-4">
          <div className="rounded-2xl border border-[#d4af37]/40 bg-[#fffdf3] p-5 text-center soft-shadow">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9a7b1e]">Is matlab wala naam kaun sa hai?</p>
            <p className="mt-2 text-xl font-extrabold text-[#2f3035]">"{target.meaning}"</p>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {q.options.map((oi) => {
              const on = ASMA_UL_HUSNA[oi];
              const isAns = oi === q.answer;
              const isPick = picked === oi;
              let cls = "border-black/10 bg-white/70 hover:border-[#0e6b4a]/40";
              if (picked !== null) {
                if (isAns) cls = "border-[#0e6b4a] bg-[#0e6b4a]/10";
                else if (isPick) cls = "border-[#e5486f] bg-[#e5486f]/10";
                else cls = "border-black/10 bg-white/70 opacity-60";
              }
              return (
                <button
                  key={oi}
                  onClick={() => pick(oi)}
                  disabled={picked !== null}
                  className={`flex items-center justify-between rounded-xl border p-4 text-right transition active:scale-[0.99] soft-shadow ${cls}`}
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-[#80848e]">
                    {picked !== null && isAns && <Check size={16} className="text-[#0e6b4a]" />}
                    {picked !== null && isPick && !isAns && <X size={16} className="text-[#e5486f]" />}
                    <span dir="ltr">{on.tr}</span>
                  </span>
                  <span className="font-quran text-3xl text-[#0e6b4a]" dir="rtl" lang="ar">{on.ar}</span>
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <p className={`mt-3 text-center text-sm font-extrabold ${picked === q.answer ? "text-[#0e6b4a]" : "text-[#e5486f]"}`}>
              {picked === q.answer ? "Sahi jawab! MashaAllah ✨" : `Ghalat — sahi jawab: ${target.tr}`}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-3 border-[#0e6b4a]/20 border-t-[#0e6b4a]" /></div>
      )}
      {best > 0 && !done && <p className="mt-3 text-center text-xs text-[#80848e]">Best streak: {best} 🔥</p>}
    </div>
  );
}

/* ═══════════════ MEMORIZE ═══════════════ */
function Memorize({ onPlayName, tsLoaded }: { onPlayName: (i: number) => void; tsLoaded: boolean }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [doneCount, setDoneCount] = useState(0);
  const toggle = (i: number) => {
    setRevealed((p) => {
      const n = new Set(p);
      if (n.has(i)) n.delete(i);
      else { n.add(i); setDoneCount((c) => c + 1); }
      return n;
    });
  };
  return (
    <div className="mx-auto max-w-2xl space-y-3 p-3 sm:p-4">
      <div className="rounded-2xl bg-gradient-to-br from-[#3b2f6b] to-[#241d45] p-5 text-white soft-shadow">
        <p className="text-[15px] font-extrabold">🌟 Khud ko test karo</p>
        <p className="mt-1 text-[13px] leading-relaxed text-white/75">
          Arabic chhupa hua hai — matlab parho, naam <b>zubani bolo</b>, phir tap karke check karo!
        </p>
        <p className="mt-2 text-xs font-bold tabular-nums text-[#ffd76a]">{revealed.size} / 99 check kiye</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-[#ffd76a] transition-all" style={{ width: `${(revealed.size / 99) * 100}%` }} />
        </div>
      </div>
      <div className="space-y-1.5 pb-2">
        {ASMA_UL_HUSNA.map((n, i) => {
          const rev = revealed.has(i);
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition active:scale-[0.99] soft-shadow ${rev ? "border-[#0e6b4a]/40 bg-[#0e6b4a]/[0.05]" : "border-black/10 bg-white/70"}`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/[0.06] text-xs font-extrabold tabular-nums text-[#80848e]">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-extrabold text-[#2f3035]">{n.tr}</span>
                <span className="block truncate text-xs text-[#80848e]">{n.meaning}</span>
              </span>
              <span
                className={`shrink-0 font-quran text-[26px] leading-none transition ${rev ? "text-[#0e6b4a]" : "select-none text-transparent blur-md"}`}
                dir="rtl" lang="ar" aria-hidden={!rev}
              >{n.ar}</span>
              {rev ? <Check size={16} className="shrink-0 text-[#0e6b4a]" /> : <Eye size={16} className="shrink-0 text-[#b0b3ba]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
