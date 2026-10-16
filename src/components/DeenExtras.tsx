"use client";
import { useEffect, useRef, useState } from "react";
import { Share2, Copy, Check, Bell, BellOff, X } from "lucide-react";
import { fetchDailyAyah, dailyIndex, type DailyAyahData } from "@/lib/quran";
import { HADITH } from "@/lib/hadith";
import { hijri, prayerTimes, nextPrayer, PRAYER_NAMES, type PrayerKey } from "@/lib/deen";
import { sendText } from "@/lib/db";
import { MAIN_GROUP_ID } from "@/lib/supabase";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`glass rounded-2xl p-4 sm:p-5 ${className}`}>{children}</section>;
}
function Title({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <h2 className="mb-3 flex items-center gap-2 text-[15px] font-extrabold tracking-tight text-[#2f3035]">{icon}{text}</h2>;
}
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/[0.06] ${className}`} />;
}

// ───────── Daily Ayat ─────────
export function DailyAyat() {
  const [data, setData] = useState<DailyAyahData | null>(null);
  const [err, setErr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => { fetchDailyAyah().then(setData).catch(() => setErr(true)); }, []);

  const text = data ? `📖 Aaj ki Ayat\n\n${data.arabic}\n\n${data.urdu}\n\n— ${data.ref}` : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  const share = async () => {
    if (!data || !MAIN_GROUP_ID) return;
    await sendText(MAIN_GROUP_ID, text);
    setShared(true); setTimeout(() => setShared(false), 2000);
  };

  return (
    <Card className="border-[#5865f2]/20 bg-gradient-to-br from-[#5865f2]/[0.07] to-transparent">
      <Title icon={<span className="text-lg">📖</span>} text="Aaj ki Ayat" />
      {!data && !err && <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-4 w-2/3" /></div>}
      {err && <p className="text-sm text-[#80848e]">Internet check karo — ayat load nahi ho saki 🌐</p>}
      {data && (
        <>
          <p className="font-quran text-right text-[22px] leading-[2.1] text-[#1f2023]" dir="rtl" lang="ar">{data.arabic}</p>
          <p className="mt-2 text-right text-sm leading-relaxed text-[#5c5e66]" dir="rtl" lang="ur">{data.urdu}</p>
          <p className="mt-2 text-xs font-bold text-[#5865f2]">— {data.ref}</p>
          <div className="mt-3 flex gap-2">
            <button onClick={copy} className="flex items-center gap-1.5 rounded-lg bg-black/5 px-3 py-2 text-xs font-bold text-[#2f3035] transition hover:bg-black/10 active:scale-95">
              {copied ? <Check size={14} className="text-[#23a55a]" /> : <Copy size={14} />}{copied ? "Copy ho gaya!" : "Copy"}
            </button>
            <button onClick={share} className="flex items-center gap-1.5 rounded-lg bg-[#5865f2] px-3 py-2 text-xs font-bold text-white soft-shadow transition hover:bg-[#4752c4] active:scale-95">
              <Share2 size={14} />{shared ? "Bhej di! ✓" : "Group me bhejo"}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

// ───────── Daily Hadees ─────────
export function DailyHadees() {
  const h = HADITH[dailyIndex(HADITH.length)];
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const text = `📜 Aaj ki Hadees\n\n"${h.text}"\n\n— ${h.ref}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  const share = async () => {
    if (!MAIN_GROUP_ID) return;
    await sendText(MAIN_GROUP_ID, text);
    setShared(true); setTimeout(() => setShared(false), 2000);
  };
  return (
    <Card>
      <Title icon={<span className="text-lg">📜</span>} text="Aaj ki Hadees" />
      <p className="text-[15px] leading-relaxed text-[#2f3035]">"{h.text}"</p>
      <p className="mt-2 text-xs font-bold text-[#23a55a]">— {h.ref}</p>
      <div className="mt-3 flex gap-2">
        <button onClick={copy} className="flex items-center gap-1.5 rounded-lg bg-black/5 px-3 py-2 text-xs font-bold text-[#2f3035] transition hover:bg-black/10 active:scale-95">
          {copied ? <Check size={14} className="text-[#23a55a]" /> : <Copy size={14} />}{copied ? "Copy ho gaya!" : "Copy"}
        </button>
        <button onClick={share} className="flex items-center gap-1.5 rounded-lg bg-[#23a55a] px-3 py-2 text-xs font-bold text-white soft-shadow transition hover:bg-[#1d8a4c] active:scale-95">
          <Share2 size={14} />{shared ? "Bhej di! ✓" : "Group me bhejo"}
        </button>
      </div>
    </Card>
  );
}

// ───────── Celebrations (Ramadan / Eid) ─────────
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    cv.width = cv.offsetWidth; cv.height = cv.offsetHeight;
    const colors = ["#5865f2", "#23a55a", "#f0b429", "#ec48bd", "#35ed7e"];
    const ps = Array.from({ length: 90 }, () => ({
      x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.5,
      w: 5 + Math.random() * 6, h: 8 + Math.random() * 8,
      c: colors[Math.floor(Math.random() * colors.length)],
      vy: 1.5 + Math.random() * 2.5, vx: -1 + Math.random() * 2,
      r: Math.random() * Math.PI, vr: -0.1 + Math.random() * 0.2,
    }));
    let raf = 0; let frames = 0;
    const tick = () => {
      frames++;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of ps) {
        p.y += p.vy; p.x += p.vx + Math.sin(frames / 20 + p.r); p.r += p.vr;
        if (p.y > cv.height + 20) { p.y = -20; p.x = Math.random() * cv.width; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (frames < 60 * 8) raf = requestAnimationFrame(tick); // ~8 seconds
      else ctx.clearRect(0, 0, cv.width, cv.height);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
}

export function CelebrationBanner({ loc }: { loc: { lat: number; lng: number } }) {
  const h = hijri();
  const [showConfetti, setShowConfetti] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const isEid = (h.m === 10 && h.d <= 3) || (h.m === 12 && h.d >= 10 && h.d <= 13);
    if (isEid) { setShowConfetti(true); const t = setTimeout(() => setShowConfetti(false), 9000); return () => clearTimeout(t); }
  }, [h.m, h.d]);
  // Ramadan me Sehri/Iftar countdown ke liye har minute tick
  useEffect(() => {
    if (h.m !== 9) return;
    const i = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(i);
  }, [h.m]);

  if (h.m === 9) {
    const now = new Date();
    const times = prayerTimes(now, loc.lat, loc.lng);
    const sehriEnd = times.fajr.getTime(), iftar = times.maghrib.getTime();
    const t = now.getTime();
    let label = "", target = 0;
    if (t < sehriEnd) { label = "Sehri ka waqt khatm hone me"; target = sehriEnd; }
    else if (t < iftar) { label = "Iftar me"; target = iftar; }
    else { const tm = new Date(t + 864e5); label = "Sehri (kal) me"; target = prayerTimes(tm, loc.lat, loc.lng).fajr.getTime(); }
    const ms = target - t;
    const hh = Math.floor(ms / 3600e3), mm = Math.floor((ms % 3600e3) / 60e3);
    return (
      <div className="relative overflow-hidden rounded-2xl soft-shadow" style={{ background: "linear-gradient(135deg, #141b3d 0%, #2b3a8f 60%, #5865f2 100%)" }}>
        <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full" style={{ background: "radial-gradient(circle, rgba(240,180,41,0.35) 0%, transparent 70%)" }} aria-hidden />
        <div className="relative p-5 text-white">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌙</span>
            <p className="text-xl font-extrabold tracking-tight">Ramadan Mubarak!</p>
            <span className="badge-pill ml-auto" style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}>{h.d} Ramadan</span>
          </div>
          <p className="mt-1 text-sm text-white/80">Roza, Taraweeh aur duaon ka mahina 🤲</p>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-white/10 px-4 py-2.5">
            <span className="text-[13px] font-semibold text-white/85">{label}</span>
            <span className="text-lg font-extrabold tabular-nums">{hh > 0 ? `${hh}h ` : ""}{mm}m</span>
          </div>
          <p className="mt-2 text-[11px] text-white/60">🌙 Ramadan mode — ibadat par tawajjoh do</p>
        </div>
      </div>
    );
  }
  const eidFitr = h.m === 10 && h.d <= 3;
  const eidAdha = h.m === 12 && h.d >= 10 && h.d <= 13;
  if (!eidFitr && !eidAdha) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#23a55a] to-[#35ed7e] p-5 text-white soft-shadow">
      {showConfetti && <Confetti />}
      <p className="text-2xl">🎉</p>
      <p className="mt-1 text-xl font-extrabold tracking-tight">{eidFitr ? "Eid-ul-Fitr Mubarak!" : "Eid-ul-Adha Mubarak!"}</p>
      <p className="mt-0.5 text-sm text-white/85">Taqabbal Allahu minna wa minkum 🤲</p>
    </div>
  );
}

// ───────── Azaan reminder — PREMIUM (Claude version se behtar) ─────────
// Arabic prayer names — universal standard, zero ambiguity.
const AR_PRAYER: Record<PrayerKey, string> = {
  fajr: "الفجر", sunrise: "الشروق", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء",
};
const ALERT_ORDER: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

// tiny shared store so AlertTop + Toggle stay in sync
interface AzaanState { enabled: boolean; alert: PrayerKey | null; snoozedUntil: number }
let azaanState: AzaanState = { enabled: false, alert: null, snoozedUntil: 0 };
const azaanListeners = new Set<() => void>();
function setAzaan(p: Partial<AzaanState>) {
  azaanState = { ...azaanState, ...p };
  azaanListeners.forEach((l) => l());
}
function useAzaan() {
  const [, t] = useState(0);
  useEffect(() => {
    const l = () => t((x) => x + 1);
    azaanListeners.add(l);
    return () => { azaanListeners.delete(l); };
  }, []);
  return azaanState;
}
try { azaanState.enabled = localStorage.getItem("chatsapp:azaan") === "1"; } catch { /* ignore */ }

const azaanTimers: number[] = [];
export function scheduleAzaan(loc: { lat: number; lng: number }) {
  azaanTimers.forEach(clearTimeout);
  azaanTimers.length = 0;
  if (!azaanState.enabled) return;
  const now = new Date();
  const times = prayerTimes(now, loc.lat, loc.lng);
  ALERT_ORDER.forEach((k) => {
    const ms = times[k].getTime() - now.getTime();
    if (ms > 2000 && ms < 12 * 3600e3) {
      azaanTimers.push(window.setTimeout(() => {
        if (Date.now() >= azaanState.snoozedUntil) setAzaan({ alert: k });
      }, ms));
    }
  });
}

// soft bell-like chime (Web Audio) — gentle, reverent
function playChime() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    const notes = [392, 523.25, 659.25, 783.99]; // G4 C5 E5 G5 — soft major arpeggio
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle"; o.frequency.value = f;
      const t0 = ctx.currentTime + i * 0.55;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
      o.connect(g).connect(ctx.destination);
      o.start(t0); o.stop(t0 + 1.7);
    });
    try { navigator.vibrate?.([150, 120, 150, 120, 300]); } catch { /* ignore */ }
    setTimeout(() => ctx.close().catch(() => {}), 5000);
  } catch { /* ignore */ }
}

function fmtCountdownShort(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Prominent alert — Deen page ke TOP par render hota hai
export function AzaanAlertTop({ loc }: { loc: { lat: number; lng: number } }) {
  const { alert, enabled } = useAzaan();
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (!alert) return;
    playChime();
    const i = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(i);
  }, [alert]);
  if (!alert || !enabled) return null;
  const nx = nextPrayer(loc.lat, loc.lng, new Date());
  // alert wali namaz ke baad wali = next (agar alert abhi ki hai to next alag hogi)
  return (
    <div className="pop-in relative overflow-hidden rounded-2xl soft-shadow" style={{ background: "linear-gradient(135deg, #1a2350 0%, #2b3a8f 55%, #5865f2 100%)" }}>
      {/* pulsing glow rings */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="azaan-pulse absolute left-1/2 top-8 h-24 w-24 -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.35) 0%, transparent 70%)" }} />
        <div className="azaan-pulse2 absolute left-1/2 top-8 h-36 w-36 -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)" }} />
      </div>
      <button onClick={() => setAzaan({ alert: null })} className="absolute right-2.5 top-2.5 rounded-full bg-white/15 p-1.5 text-white/80 transition hover:bg-white/25" aria-label="Band karo">
        <X size={15} />
      </button>
      <div className="relative px-5 pb-5 pt-6 text-center text-white">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/70">Namaz ka waqt ho gaya 🕌</p>
        <p className="font-quran mt-2 text-[44px] leading-tight text-white" dir="rtl" lang="ar">{AR_PRAYER[alert]}</p>
        <p className="mt-1 text-xl font-extrabold tracking-tight">{PRAYER_NAMES[alert]}</p>
        <p className="mt-1 text-[13px] text-white/75">Hayya 'alas-salah — namaz ki taraf aao 🤲</p>
        <p className="mt-2.5 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white/90">
          Agli: {PRAYER_NAMES[nx.key]} · {fmtCountdownShort(nx.at.getTime() - nowTick)} me
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button onClick={() => setAzaan({ alert: null })} className="rounded-xl bg-white py-2.5 text-[13px] font-extrabold text-[#2b3a8f] transition hover:bg-white/90 active:scale-95">Abhi parho 🤲</button>
          <button onClick={() => { setAzaan({ alert: null, snoozedUntil: Date.now() + 10 * 60e3 }); }} className="rounded-xl bg-white/20 py-2.5 text-[13px] font-bold text-white transition hover:bg-white/30 active:scale-95">10 min baad</button>
          <button onClick={() => { setAzaan({ alert: null, enabled: false }); try { localStorage.setItem("chatsapp:azaan", "0"); } catch {} azaanTimers.forEach(clearTimeout); }} className="rounded-xl bg-white/10 py-2.5 text-[13px] font-bold text-white/85 transition hover:bg-white/20 active:scale-95">Band karo</button>
        </div>
      </div>
    </div>
  );
}

// Toggle card — settings area me
export function AzaanToggle({ loc }: { loc: { lat: number; lng: number } }) {
  const { enabled } = useAzaan();
  useEffect(() => { scheduleAzaan(loc); }, [enabled, loc.lat, loc.lng]); // eslint-disable-line
  const toggle = () => {
    const v = !azaanState.enabled;
    try { localStorage.setItem("chatsapp:azaan", v ? "1" : "0"); } catch { /* ignore */ }
    if (!v) { azaanTimers.forEach(clearTimeout); setAzaan({ enabled: false, alert: null }); }
    else setAzaan({ enabled: true });
  };
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`grid h-10 w-10 place-items-center rounded-xl ${enabled ? "bg-[#5865f2]/10 text-[#5865f2]" : "bg-black/5 text-[#80848e]"}`}>
            {enabled ? <Bell size={18} /> : <BellOff size={18} />}
          </span>
          <div>
            <p className="text-[15px] font-bold text-[#2f3035]">Namaz reminder</p>
            <p className="text-xs text-[#80848e]">{enabled ? "Har namaz par khubsurat alert milega" : "Waqt par yaad dilayenge"}</p>
          </div>
        </div>
        <button
          onClick={toggle} role="switch" aria-checked={enabled}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-[#5865f2]" : "bg-black/15"}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-6" : "left-1"}`} />
        </button>
      </div>
    </Card>
  );
}
