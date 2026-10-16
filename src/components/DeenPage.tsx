"use client";
import { useEffect, useState } from "react";
import { Moon, MapPin, RotateCcw, Compass, BookOpen, ChevronLeft, Play } from "lucide-react";
import { patchUI, useStore } from "@/lib/store";
import { prayerTimes, nextPrayer, qiblaBearing, hijri, DUAS, TASBEEH_PRESETS, PRAYER_NAMES, PRAYER_ORDER, DEFAULT_LOC, type PrayerKey } from "@/lib/deen";
import { fmtTime } from "@/components/ui";
import QuranReader from "@/components/QuranReader";
import AsmaPlayer from "@/components/AsmaPlayer";
import { DailyAyat, DailyHadees, CelebrationBanner, AzaanAlertTop, AzaanToggle } from "@/components/DeenExtras";
import { useVideo, getSavedProgress, videoPlay, fmtVideoTime } from "@/lib/videoPlayer";

function useNow(ms = 1000) {
  const [, t] = useState(0);
  useEffect(() => { const i = setInterval(() => t((x) => x + 1), ms); return () => clearInterval(i); }, [ms]);
}

function useLocation() {
  const [loc, setLoc] = useState(DEFAULT_LOC);
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, name: "Aapki location" }),
      () => { /* fallback: Karachi */ },
      { timeout: 8000 }
    );
  }, []);
  return loc;
}

function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`glass rounded-2xl p-4 sm:p-5 ${className}`}>{children}</section>;
}
function Title({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <h2 className="mb-3 flex items-center gap-2 text-[15px] font-extrabold tracking-tight text-[#2f3035]">{icon}{text}</h2>;
}

// ───────── Tasbeeh ─────────
function Tasbeeh() {
  const [preset, setPreset] = useState(TASBEEH_PRESETS[0]);
  const [count, setCount] = useState(0);
  const [target, setTarget] = useState(preset.target);
  const [today, setToday] = useState(0);
  const dayKey = new Date().toDateString();

  useEffect(() => {
    try {
      const raw = localStorage.getItem("chatsapp:tasbeeh");
      if (raw) { const d = JSON.parse(raw); if (d.day === dayKey) setToday(d.total || 0); }
    } catch { /* ignore */ }
  }, [dayKey]);
  useEffect(() => { setTarget(preset.target); setCount(0); }, [preset.id]); // eslint-disable-line

  const tap = () => {
    const n = count + 1, nt = today + 1;
    setCount(n); setToday(nt);
    try { localStorage.setItem("chatsapp:tasbeeh", JSON.stringify({ day: dayKey, total: nt })); } catch { /* ignore */ }
    if (n === target) { try { navigator.vibrate?.(80); } catch { /* ignore */ } }
  };
  const done = count >= target;

  return (
    <Card>
      <Title icon={<span className="text-lg">📿</span>} text="Tasbeeh counter" />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TASBEEH_PRESETS.map((p) => (
          <button key={p.id} onClick={() => setPreset(p)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${p.id === preset.id ? "bg-[#5865f2] text-white soft-shadow" : "bg-black/5 text-[#5c5e66] hover:bg-black/10"}`}>{p.name}</button>
        ))}
      </div>
      <p className="mb-1 text-center font-arabic text-2xl leading-relaxed text-[#2f3035]" dir="rtl" lang="ar">{preset.ar}</p>
      <button onClick={tap} className="mx-auto my-3 grid h-44 w-44 place-items-center rounded-full border-4 border-[#5865f2]/20 bg-gradient-to-br from-white to-[#eef0fb] soft-shadow transition active:scale-95" aria-label="Gino">
        <span>
          <span className={`block text-5xl font-extrabold tabular-nums tracking-tight ${done ? "text-[#23a55a]" : "text-[#2f3035]"}`}>{count}</span>
          <span className="block text-xs font-semibold text-[#80848e]">/ {target}</span>
        </span>
      </button>
      {done && <p className="mb-2 text-center text-sm font-bold text-[#23a55a]">MashaAllah! Target poora ✨</p>}
      <div className="flex items-center justify-center gap-2">
        {[33, 100, 500, 1000].map((t) => (
          <button key={t} onClick={() => { setTarget(t); setCount(0); }} className={`rounded-md px-2.5 py-1 text-xs font-bold ${target === t ? "bg-[#2f3035] text-white" : "bg-black/5 text-[#5c5e66]"}`}>{t}</button>
        ))}
        <button onClick={() => setCount(0)} className="flex items-center gap-1 rounded-md bg-black/5 px-2.5 py-1 text-xs font-bold text-[#5c5e66] hover:bg-black/10"><RotateCcw size={13} /> Reset</button>
      </div>
      <p className="mt-3 text-center text-xs text-[#80848e]">Aaj ka kul: <b className="text-[#2f3035]">{today}</b></p>
    </Card>
  );
}

// ───────── Qibla ─────────
function Qibla({ loc }: { loc: { lat: number; lng: number } }) {
  const bearing = qiblaBearing(loc.lat, loc.lng);
  const [heading, setHeading] = useState<number | null>(null);
  useEffect(() => {
    const h = (e: any) => {
      const hd = e.webkitCompassHeading ?? (e.alpha != null ? 360 - e.alpha : null);
      if (hd != null && !isNaN(hd)) setHeading(hd);
    };
    window.addEventListener("deviceorientation", h as any);
    return () => window.removeEventListener("deviceorientation", h as any);
  }, []);
  const needle = heading != null ? bearing - heading : 0;
  return (
    <Card>
      <Title icon={<Compass size={17} className="text-[#5865f2]" />} text="Qibla direction" />
      <div className="flex items-center gap-4">
        <div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full border-2 border-[#5865f2]/25 bg-white/60">
          <span className="absolute top-1 text-[10px] font-bold text-[#80848e]">N</span>
          <div className="transition-transform duration-300" style={{ transform: `rotate(${needle}deg)` }}>
            <div className="flex h-20 flex-col items-center">
              <span className="text-xl text-[#5865f2]">▲</span>
              <span className="mt-auto text-[10px] font-bold text-[#5865f2]">🕋</span>
            </div>
          </div>
        </div>
        <div>
          <p className="text-2xl font-extrabold tabular-nums tracking-tight text-[#2f3035]">{Math.round(bearing)}°</p>
          <p className="text-sm text-[#5c5e66]">Makkah ki taraf</p>
          <p className="mt-1 text-xs text-[#80848e]">{heading != null ? "Live compass chal raha hai" : "Phone ghumao — ya degrees dekho"}</p>
        </div>
      </div>
    </Card>
  );
}

// ───────── Duas ─────────
function DuaList() {
  const [f, setF] = useState<"sab" | "subah" | "shaam">("sab");
  const list = DUAS.filter((d) => f === "sab" || d.time === f || d.time === "dono");
  return (
    <Card>
      <Title icon={<BookOpen size={17} className="text-[#5865f2]" />} text="Masnoon duaein" />
      <div className="mb-3 flex gap-1.5">
        {(["sab", "subah", "shaam"] as const).map((x) => (
          <button key={x} onClick={() => setF(x)} className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition ${f === x ? "bg-[#5865f2] text-white soft-shadow" : "bg-black/5 text-[#5c5e66] hover:bg-black/10"}`}>
            {x === "sab" ? "Sab" : x === "subah" ? "Subah" : "Shaam"}
          </button>
        ))}
      </div>
      <div className="space-y-2.5">
        {list.map((d) => (
          <details key={d.id} className="group rounded-xl border border-black/10 bg-white/60 p-3.5">
            <summary className="cursor-pointer list-none">
              <span className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-bold text-[#2f3035]">{d.title}</span>
                <span className="badge-pill shrink-0">{d.time === "dono" ? "Subah·Shaam" : d.time}</span>
              </span>
            </summary>
            <p className="mt-2.5 text-right text-lg leading-loose text-[#2f3035]" dir="rtl" lang="ar">{d.ar}</p>
            <p className="mt-2 text-sm italic leading-relaxed text-[#5c5e66]">{d.rom}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-[#2f3035]">{d.tr}</p>
            <p className="mt-1.5 text-xs text-[#80848e]">📖 {d.src}</p>
          </details>
        ))}
      </div>
    </Card>
  );
}

// ───────── Continue watching — Asma video jahan chhori thi ─────────
function ContinueWatching() {
  const v = useVideo();
  const prog = getSavedProgress();
  // video abhi chal rahi ho to card nahi — already watching
  if (!prog || v.playing) return null;
  return (
    <button
      onClick={() => { patchUI({ asmaOpen: true }); videoPlay(); }}
      className="flex w-full items-center gap-3 rounded-2xl border border-[#0e6b4a]/25 bg-gradient-to-br from-[#0e6b4a]/[0.07] to-white p-4 text-left transition hover:border-[#0e6b4a]/50 active:scale-[0.99] soft-shadow"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0e6b4a] text-white">
        <Play size={20} className="ml-0.5" fill="currentColor" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-extrabold tracking-tight text-[#2f3035]">⏯️ Jahan chhori thi — wahan se dekho</span>
        <span className="block text-xs tabular-nums text-[#80848e]">{fmtVideoTime(prog.pos)} se resume · kul {fmtVideoTime(prog.dur)}</span>
      </span>
      <ChevronLeft size={18} className="rotate-180 shrink-0 text-[#0e6b4a]" />
    </button>
  );
}

// ───────── main page ─────────
export default function DeenPage() {
  useNow(1000);
  const loc = useLocation();
  const now = new Date();
  const h = hijri(now);
  const times = prayerTimes(now, loc.lat, loc.lng);
  const nx = nextPrayer(loc.lat, loc.lng, now);
  const isNext = (k: PrayerKey) => k === nx.key;
  const [quranOpen, setQuranOpen] = useState(false);
  const asmaOpen = useStore((s) => s.ui.asmaOpen);

  return (
    <div className="glass relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-black/10 px-4">
        <button onClick={() => patchUI({ tab: "chat" })} className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5" aria-label="Wapas">
          <ChevronLeft size={20} />
        </button>
        <span className="text-xl">🕌</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-extrabold tracking-tight text-[#2f3035]">Deen</h1>
          <p className="truncate text-xs text-[#80848e]">{h.d} {h.name} {h.y} Hijri</p>
        </div>
      </header>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="mx-auto max-w-2xl space-y-3">
          <AzaanAlertTop loc={loc} />
          <CelebrationBanner loc={loc} />
          {/* Hijri + next prayer hero */}
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#5865f2] to-[#9b7bff] p-5 text-white soft-shadow">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/75">Agli namaz</p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight">{PRAYER_NAMES[nx.key]}</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-white/90">{fmtCountdown(nx.at.getTime() - now.getTime())} <span className="text-sm font-medium">· {fmtTime(nx.at.getTime())}</span></p>
            <p className="mt-2 flex items-center gap-1 text-xs text-white/75"><MapPin size={12} /> {loc.name} · {now.toLocaleDateString("ur-Latn", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>

          <DailyAyat />
          <DailyHadees />

          {/* Asma-ul-Husna entry */}
          <button
            onClick={() => patchUI({ asmaOpen: true })}
            className="flex w-full items-center gap-4 rounded-2xl border border-[#d4af37]/30 bg-gradient-to-br from-[#fffdf3] to-white p-4 text-left transition hover:border-[#d4af37]/60 active:scale-[0.99] soft-shadow"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#d4af37]/15 font-quran text-[26px] text-[#9a7b1e]" dir="rtl" lang="ar">ٱللَّهُ</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold tracking-tight text-[#2f3035]">Allah ke 99 Naam ✨</span>
              <span className="block text-xs text-[#80848e]">Atif Aslam ki awaz · perfect sync · quiz · flashcards</span>
            </span>
            <ChevronLeft size={18} className="rotate-180 shrink-0 text-[#80848e]" />
          </button>
          <ContinueWatching />

          {/* Quran reader entry */}
          <button
            onClick={() => setQuranOpen(true)}
            className="flex w-full items-center gap-4 rounded-2xl border border-[#5865f2]/20 bg-white/70 p-4 text-left transition hover:border-[#5865f2]/40 hover:bg-white active:scale-[0.99] soft-shadow"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#5865f2]/10 font-quran text-2xl text-[#5865f2]" dir="rtl" lang="ar">ٱقْرَأْ</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold tracking-tight text-[#2f3035]">Quran-e-Pak</span>
              <span className="block text-xs text-[#80848e]">114 suratein · Urdu tarjume ke saath · Bookmarks</span>
            </span>
            <ChevronLeft size={18} className="rotate-180 shrink-0 text-[#80848e]" />
          </button>

          {/* Namaz timings */}
          <Card>
            <Title icon={<Moon size={17} className="text-[#5865f2]" />} text="Aaj ki namaz" />
            <div className="divide-y divide-black/5">
              {PRAYER_ORDER.map((k) => (
                <div key={k} className={`flex items-center justify-between rounded-lg px-2.5 py-2 ${isNext(k) ? "bg-[#5865f2]/[0.08]" : ""}`}>
                  <span className={`text-[15px] font-semibold ${isNext(k) ? "text-[#5865f2]" : "text-[#2f3035]"}`}>
                    {PRAYER_NAMES[k]}{isNext(k) && <span className="badge-pill ml-2" style={{ background: "#5865f2", color: "#fff" }}>Agli</span>}
                  </span>
                  <span className="text-[15px] font-bold tabular-nums text-[#5c5e66]">{fmtTime(times[k].getTime())}</span>
                </div>
              ))}
            </div>
          </Card>

          <AzaanToggle loc={loc} />
          <Tasbeeh />
          <Qibla loc={loc} />
          <DuaList />
          <p className="pb-2 text-center text-xs text-[#80848e]">Namaz ke auqaat takhmini hain — apni masjid se confirm karein 🌙</p>
        </div>
      </div>

      {quranOpen && <QuranReader onClose={() => setQuranOpen(false)} />}
      {asmaOpen && <AsmaPlayer onClose={() => patchUI({ asmaOpen: false })} />}
    </div>
  );
}
