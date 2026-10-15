"use client";
import { motion } from "framer-motion";
import { BookOpen, Calculator, Compass, HandHeart, MapPin, Moon, MoonStar, Sparkles, Landmark, BellRing, Navigation, Settings2, Star, X, Bell, Hourglass } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/data/store";
import { burstConfetti, getLocation, go, patchSettings, saveLocation, seeHint, toast, triggerAzaan } from "@/data/api";
import { HIJRI_MONTHS, PRAYER_NAMES, hijri, isEidDay, moonInfo, prayerTimes, ramadanInfo, type PrayerKey } from "@/data/deen";
import { cn } from "@/lib/util";
import { Btn, Marker, Seg, Sheet, inputCls } from "../ui";

export function useNow(ms = 1000) { const [n, setN] = useState(() => Date.now()); useEffect(() => { const i = setInterval(() => setN(Date.now()), ms); return () => clearInterval(i); }, [ms]); return n; }
export const hms = (d: number) => { d = Math.max(0, d); const h = Math.floor(d / 3600e3), m = Math.floor((d % 3600e3) / 60e3), s = Math.floor((d % 60e3) / 1e3); return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; };
const f12 = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function MoonSvg({ phase, size = 56 }: { phase: number; size?: number }) {
  // phase 0..1 (0 new, .5 full). Draw lit part via two arcs.
  const k = Math.cos(phase * 2 * Math.PI), waxing = phase < 0.5;
  const rx = Math.abs(k) * 40;
  const d = `M50 10 A40 40 0 0 ${waxing ? 1 : 0} 50 90 A${rx} 40 0 0 ${(waxing ? k > 0 : k < 0) ? 0 : 1} 50 10`;
  return <svg width={size} height={size} viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#1b2a38" stroke="#ffffff22" /><path d={d} fill="#f6e9b8" /></svg>;
}

export default function DeenHome() {
  const now = useNow();
  const cfg = useStore((s) => s.settings.ramadan);
  const eidForced = useStore((s) => s.settings.eid);
  const introSeen = useStore((s) => s.onboarding.hints["deen-intro"]);
  const [loc, setLoc] = useState(getLocation());
  const [rs, setRs] = useState(false);
  const t = prayerTimes(new Date(now), loc.lat, loc.lng);
  const order: PrayerKey[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
  let nextKey: PrayerKey = "fajr", nextAt = new Date(prayerTimes(new Date(now + 864e5), loc.lat, loc.lng).fajr);
  for (const k of order) { if (k !== "sunrise" && t[k].getTime() > now) { nextKey = k; nextAt = t[k]; break; } }
  const cur = [...order].reverse().find((k) => t[k].getTime() <= now) ?? "isha";
  const h = hijri(new Date(now)), r = ramadanInfo(cfg, new Date(now)), moon = moonInfo(new Date(now));
  const eid = eidForced || isEidDay(new Date(now));
  const locate = () => navigator.geolocation?.getCurrentPosition((p) => { const l = { lat: p.coords.latitude, lng: p.coords.longitude, name: "Meri jagah" }; saveLocation(l); setLoc(l); toast("Location set", "Namaz ke auqaat update ho gaye", "info"); }, () => toast("Location nahi mili", "Permission do ya default (Karachi) rakho", "info"));
  const odd = [21, 23, 25, 27, 29].find((n) => n >= r.day) ?? 29;
  const lqTarget = (() => { const d = new Date(now); d.setDate(d.getDate() + Math.max(0, odd - r.day - (now > t.maghrib.getTime() ? 1 : 0))); const m = prayerTimes(d, loc.lat, loc.lng).maghrib; return m.getTime() < now ? m.getTime() + 864e5 : m.getTime(); })();
  const tools = [
    { p: "quran", l: "Quran", i: <BookOpen />, c: "#2ccf8a" }, { p: "dua", l: "Duaein", i: <HandHeart />, c: "#e8bd57" }, { p: "tasbeeh", l: "Tasbeeh", i: <Sparkles />, c: "#c79bff" },
    { p: "qibla", l: "Qibla", i: <Compass />, c: "#4cc3ff" }, { p: "zakat", l: "Zakat", i: <Calculator />, c: "#ff8a5c" }, { p: "masjids", l: "Masjid", i: <Landmark />, c: "#5cd6c8" },
    { p: "hajj", l: "Hajj/Umrah", i: <MapPin />, c: "#ff6f91" }, { p: "moon", l: "Chaand", i: <Moon />, c: "#f6e9b8" }, { p: "dhikr", l: "Yaad-dahani", i: <BellRing />, c: "#9bdc5a" },
  ];
  return (
    <div className="thin h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-4 safe-t">
        <div className="mb-4 flex items-center justify-between">
          <div><h1 className="text-2xl font-black tracking-tight">Deen</h1><p className="text-sm text-mute">{h.d} {HIJRI_MONTHS[h.m - 1]} {h.y} AH</p></div>
          <div className="flex gap-2">
            <button onClick={locate} className="flex items-center gap-1.5 rounded-full bg-surface2 px-3 py-2 text-xs font-semibold"><Navigation size={14} />{loc.name}</button>
            <button onClick={() => setRs(true)} className="rounded-full bg-surface2 p-2" aria-label="Ramadan settings"><Settings2 size={18} /></button>
          </div>
        </div>

        {/* F8 intro card */}
        {!introSeen && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative mb-4 overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-[#3a2c0a] to-[#1b2a22] p-5 text-[#fff3cf]">
            <button onClick={() => seeHint("deen-intro")} className="absolute right-3 top-3 rounded-full bg-black/20 p-1.5"><X size={16} /></button>
            <p className="text-lg font-extrabold">Deen page me namaz times, Quran aur duaein hain 🕌</p>
            <p className="mt-1 text-sm opacity-80">Qibla, tasbeeh, zakat calculator aur bohat kuch — sab ek jagah.</p>
          </motion.div>
        )}

        {/* next prayer hero */}
        <div className="relative mb-4 overflow-hidden rounded-3xl p-5 text-white" style={{ background: "linear-gradient(135deg,#0f5a43,#0a2a3a 70%)" }}>
          <svg className="absolute -right-6 -top-6 h-40 w-40 opacity-20" viewBox="0 0 100 100"><path d="M64 14a38 38 0 1 0 22 68 30 30 0 1 1-22-68z" fill="#e8bd57" /></svg>
          <p className="text-xs font-bold uppercase tracking-widest opacity-70">Agli namaz</p>
          <p className="mt-1 text-4xl font-black">{PRAYER_NAMES[nextKey]}</p>
          <p className="text-lg font-semibold opacity-90">{f12(nextAt)} · <span className="tabular-nums">{hms(nextAt.getTime() - now)}</span> baqi</p>
          <div className="mt-4 grid grid-cols-6 gap-1.5">
            {order.map((k) => (
              <div key={k} className={cn("rounded-xl px-1 py-2 text-center", cur === k ? "bg-white text-[#0a3a2c]" : "bg-white/10")}>
                <p className="text-[10px] font-bold uppercase leading-tight">{PRAYER_NAMES[k].replace("Tulu-e-Aftab", "Tulu")}</p><p className="mt-0.5 text-[11px] font-bold tabular-nums">{f12(t[k]).replace(" ", "\u00A0")}</p>
              </div>
            ))}
          </div>
          <button onClick={() => triggerAzaan(PRAYER_NAMES[nextKey])} className="mt-3 text-xs font-semibold underline opacity-80">Azaan alert ka demo dekho</button>
        </div>

        {/* C3 Ramadan */}
        {r.active && (
          <div className="mb-4 overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-[#2d2308] via-[#1a2a22] to-[#0e1a2b] p-5 text-[#fff3cf]">
            <div className="flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-extrabold"><MoonStar size={18} />Ramadan Mubarak · Din {r.day}/30</p><span className="text-xs opacity-70">{r.left} din baqi</span></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gold" style={{ width: `${(r.day / 30) * 100}%` }} /></div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-black/25 p-3 text-center"><p className="text-[11px] uppercase tracking-wider opacity-70">Sehri khatam (Fajr)</p><p className="mt-1 text-xl font-black tabular-nums">{f12(t.fajr)}</p><p className="text-xs opacity-70 tabular-nums">{now < t.fajr.getTime() ? hms(t.fajr.getTime() - now) : "ho chuki"}</p></div>
              <div className="rounded-2xl bg-black/25 p-3 text-center"><p className="text-[11px] uppercase tracking-wider opacity-70">Iftar (Maghrib)</p><p className="mt-1 text-xl font-black tabular-nums">{f12(t.maghrib)}</p><p className="text-xs opacity-70 tabular-nums">{now < t.maghrib.getTime() ? hms(t.maghrib.getTime() - now) : "ho chuka"}</p></div>
            </div>
            {/* C9 Laylatul Qadr */}
            {r.day >= 20 && (
              <div className="mt-3 rounded-2xl border border-gold/50 bg-gradient-to-r from-gold/20 to-transparent p-4">
                <p className="flex items-center gap-2 text-sm font-extrabold"><Star size={16} fill="currentColor" />Laylatul Qadr — {odd}vi raat</p>
                <p className="mt-1 flex items-center gap-2 text-2xl font-black tabular-nums"><Hourglass size={20} />{hms(lqTarget - now)}</p>
                <p className="mt-1 text-xs opacity-75">Aakhri 10 raaton ki taaq raaton me Shab-e-Qadr talash karein. Dua: &ldquo;Allahumma innaka afuwwun tuhibbul afwa fa&apos;fu anni&rdquo;</p>
              </div>
            )}
          </div>
        )}
        {eid && (
          <div className="mb-4 rounded-3xl bg-gradient-to-r from-[#1a7a55] to-[#c58b1f] p-5 text-center text-white"><p className="text-2xl font-black">🌙 Eid Mubarak! 🌙</p><p className="text-sm opacity-90">Taqabbal Allahu minna wa minkum</p><Btn variant="gold" small className="mt-3" onClick={burstConfetti}>Jashn manao 🎉</Btn></div>
        )}

        {/* C14 moon */}
        <button onClick={() => go("moon")} className="mb-4 flex w-full items-center gap-4 rounded-3xl border border-line bg-surface p-4 text-left">
          <MoonSvg phase={moon.phase} size={56} />
          <div className="flex-1"><p className="text-xs font-bold uppercase tracking-wider text-mute">Chaand ki halat</p><p className="font-bold">{moon.name}</p><p className="text-xs text-mute">Roshni {Math.round(moon.illum * 100)}% · {HIJRI_MONTHS[h.m - 1]} ka {h.d}vaan din</p></div>
        </button>

        <h2 className="mb-2 mt-5 flex items-center text-xs font-bold uppercase tracking-wider text-mute">Deen ke auzaar<Marker id="deen-tools" text="Quran, tasbeeh, qibla aur zakat — sab yahan hain" /></h2>
        <div className="grid grid-cols-3 gap-3">
          {tools.map((x, i) => (
            <motion.button key={x.p} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileTap={{ scale: 0.94 }} onClick={() => go(x.p)} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface py-4 transition hover:bg-surface2">
              <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: x.c + "26", color: x.c }}>{x.i}</span><span className="text-[13px] font-bold">{x.l}</span>
            </motion.button>
          ))}
        </div>
      </div>
      <Sheet open={rs} onClose={() => setRs(false)} title="Ramadan aur Eid settings">
        <p className="mb-2 text-sm font-semibold">Ramadan mode</p>
        <Seg value={cfg.mode} onChange={(v) => patchSettings({ ramadan: { ...cfg, mode: v } })} options={[{ v: "auto", l: "Khud-ba-khud" }, { v: "on", l: "Chalu" }, { v: "off", l: "Band" }]} className="mb-3" />
        {cfg.mode === "on" && <><p className="mb-1.5 text-xs text-mute">Ramadan ka pehla roza (tarikh)</p><input type="date" value={cfg.start} onChange={(e) => patchSettings({ ramadan: { ...cfg, start: e.target.value } })} className={cn(inputCls, "mb-3")} /><p className="mb-3 text-xs text-mute">Tip: 20 din pehle ki tarikh rakhein to Laylatul Qadr countdown dikhega.</p></>}
        <label className="flex items-center justify-between rounded-xl bg-surface2 px-4 py-3"><span className="text-[15px] font-medium">Eid mode (confetti + festive theme)</span><input type="checkbox" checked={eidForced} onChange={(e) => { patchSettings({ eid: e.target.checked }); if (e.target.checked) burstConfetti(); }} className="h-5 w-5 accent-[var(--accent)]" /></label>
      </Sheet>
      <Bell className="hidden" />
    </div>
  );
}
