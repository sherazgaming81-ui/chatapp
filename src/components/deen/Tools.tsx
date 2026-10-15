"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Droplet, Footprints, Heart, Mic, Moon, Navigation, Plus, RefreshCw, RotateCcw, Scissors, Shirt, Sun, Target, Tent, Trash2, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useStore } from "@/data/store";
import { burstConfetti, getLocation, patchSettings, tasbeehTap, toast, unlock } from "@/data/api";
import { DUAS, GUIDE, HIJRI_MONTHS, TASBEEH_PRESETS, distanceKm, hijri, moonInfo, qiblaBearing } from "@/data/deen";
import { cn, haptic, uid } from "@/lib/util";
import { Btn, Card, Field, Page, Ring, Row, Seg, Toggle, inputCls } from "../ui";
import { MapArt } from "../chat/Attach";
import { MoonSvg } from "./Deen";

// ───────── C5 Tasbeeh ─────────
export function Tasbeeh() {
  const stats = useStore((s) => s.tasbeeh);
  const hap = useStore((s) => s.settings.haptics);
  const [pid, setPid] = useState(TASBEEH_PRESETS[0].id);
  const [count, setCount] = useState(0), [rounds, setRounds] = useState(0), [done, setDone] = useState(false);
  const p = TASBEEH_PRESETS.find((x) => x.id === pid)!;
  const tap = () => {
    if (done) return;
    const n = count + 1;
    tasbeehTap(); if (hap) haptic(n >= p.target ? [30, 60, 30, 60, 60] : 10);
    if (n >= p.target) { setCount(p.target); setDone(true); setRounds((r) => r + 1); burstConfetti(); unlock("tasbeeh"); toast("Mashallah! 🎉", `${p.name} x${p.target} mukammal`, "info"); setTimeout(() => { setCount(0); setDone(false); }, 1600); }
    else setCount(n);
  };
  return (
    <Page title="Tasbeeh" sub={`Aaj: ${stats.today} · Kul: ${stats.total}`} right={<button onClick={() => { setCount(0); setDone(false); }} className="rounded-full p-2 hover:bg-surface2"><RotateCcw size={20} /></button>}>
      <div className="noscroll -mx-1 mb-6 flex gap-2 overflow-x-auto px-1">
        {TASBEEH_PRESETS.map((t) => <button key={t.id} onClick={() => { setPid(t.id); setCount(0); setDone(false); }} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-bold", pid === t.id ? "bg-accent text-accent-fg" : "bg-surface2 text-mute")}>{t.name} ×{t.target}</button>)}
      </div>
      <div className="flex flex-col items-center">
        <p className="arabic mb-4 text-4xl">{p.ar}</p>
        <motion.button whileTap={{ scale: 0.93 }} onClick={tap} className="relative select-none rounded-full outline-none" aria-label="Ginti barhao">
          <Ring value={count / p.target} size={260} stroke={12} color={done ? "var(--gold)" : "var(--accent)"}>
            <div className="grid h-[210px] w-[210px] place-items-center rounded-full bg-gradient-to-br from-surface2 to-surface shadow-inner"><div><p className="text-7xl font-black tabular-nums">{count}</p><p className="text-sm text-mute">/ {p.target}</p></div></div>
          </Ring>
        </motion.button>
        <p className="mt-5 text-sm text-mute">Dabate jao · {rounds} daur mukammal</p>
      </div>
    </Page>
  );
}

// ───────── C6 Duas ─────────
export function Duas() {
  const [tab, setTab] = useState<"subah" | "shaam" | "sab">("sab");
  const list = DUAS.filter((d) => tab === "sab" || d.time === tab || d.time === "dono");
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [tab]);
  const d = list[Math.min(i, list.length - 1)];
  const go = (n: number) => setI((v) => Math.max(0, Math.min(list.length - 1, v + n)));
  return (
    <Page title="Duaein" sub="Card ko swipe karein">
      <Seg value={tab} onChange={setTab} className="mb-5" options={[{ v: "sab", l: "Sab" }, { v: "subah", l: "Subah" }, { v: "shaam", l: "Shaam" }]} />
      <div className="relative mx-auto h-[480px] max-w-md">
        {[2, 1].map((k) => list[i + k] && <div key={k} className="absolute inset-x-0 top-0 h-full rounded-[28px] border border-line bg-surface" style={{ transform: `translateY(${k * 12}px) scale(${1 - k * 0.05})`, opacity: 1 - k * 0.3 }} />)}
        <AnimatePresence mode="popLayout">
          {d && (
            <motion.div key={d.id} drag="x" dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, inf) => { if (inf.offset.x < -80) go(1); else if (inf.offset.x > 80) go(-1); }} initial={{ opacity: 0, scale: 0.9, x: 60 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, x: -120, rotate: -6 }} transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="absolute inset-0 cursor-grab overflow-y-auto rounded-[28px] border border-gold/30 bg-gradient-to-b from-[#1d2a22] to-surface p-6 shadow-xl active:cursor-grabbing" style={{ touchAction: "pan-y" }}>
              <p className="text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-gold">{d.title}</p>
              <p className="arabic mt-4 text-center text-[26px]">{d.ar}</p>
              <p className="mt-4 text-center text-[15px] font-medium italic text-accent">{d.rom}</p>
              <div className="my-4 h-px bg-line" />
              <p className="text-center text-[15px] leading-relaxed">{d.tr}</p>
              <p className="mt-4 text-center text-xs text-mute">📚 {d.src}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-4 flex items-center justify-center gap-4">
        <button disabled={i === 0} onClick={() => go(-1)} className="rounded-full bg-surface2 p-3 disabled:opacity-30"><ChevronLeft /></button>
        <div className="flex gap-1.5">{list.map((_, k) => <span key={k} className={cn("h-2 rounded-full transition-all", k === i ? "w-6 bg-accent" : "w-2 bg-line")} />)}</div>
        <button disabled={i >= list.length - 1} onClick={() => go(1)} className="rounded-full bg-surface2 p-3 disabled:opacity-30"><ChevronRight /></button>
      </div>
    </Page>
  );
}

// ───────── C4 Qibla ─────────
export function Qibla() {
  const loc = getLocation();
  const bearing = qiblaBearing(loc.lat, loc.lng);
  const [heading, setHeading] = useState<number | null>(null);
  const [asked, setAsked] = useState(false);
  const start = async () => {
    setAsked(true);
    const DOE = (window as any).DeviceOrientationEvent;
    try { if (DOE?.requestPermission) { const r = await DOE.requestPermission(); if (r !== "granted") return; } } catch { return; }
    const h = (e: any) => { const v = e.webkitCompassHeading ?? (e.alpha != null ? 360 - e.alpha : null); if (v != null) setHeading(v); };
    window.addEventListener("deviceorientationabsolute", h as any, true); window.addEventListener("deviceorientation", h as any, true);
  };
  const rot = heading != null ? -heading : 0;
  const aligned = heading != null && Math.abs(((bearing - heading + 540) % 360) - 180) < 5;
  useEffect(() => { if (aligned) haptic(30); }, [aligned]);
  return (
    <Page title="Qibla ki simt" sub={`${loc.name} se Kaaba tak`}>
      <div className="flex flex-col items-center">
        <div className="relative my-4 h-[300px] w-[300px]">
          <motion.svg viewBox="0 0 300 300" className="absolute inset-0" animate={{ rotate: rot }} transition={{ type: "spring", stiffness: 60, damping: 18 }}>
            <circle cx="150" cy="150" r="140" fill="var(--surface)" stroke="var(--line)" strokeWidth="2" />
            {Array.from({ length: 72 }).map((_, i) => <line key={i} x1="150" y1="14" x2="150" y2={i % 6 === 0 ? 30 : 22} stroke={i === 0 ? "#ff6b5e" : "var(--mute)"} strokeWidth={i % 6 === 0 ? 2.5 : 1} transform={`rotate(${i * 5} 150 150)`} />)}
            {[["N", 0], ["E", 90], ["S", 180], ["W", 270]].map(([l, a]) => <text key={l as string} x="150" y="58" textAnchor="middle" fontSize="18" fontWeight="800" fill={l === "N" ? "#ff6b5e" : "var(--fg)"} transform={`rotate(${a} 150 150) `}>{l}</text>)}
            <g transform={`rotate(${bearing} 150 150)`}>
              <line x1="150" y1="150" x2="150" y2="48" stroke="var(--gold)" strokeWidth="4" strokeLinecap="round" />
              <g transform="translate(150 34)"><rect x="-13" y="-13" width="26" height="26" rx="4" fill="#111" stroke="var(--gold)" strokeWidth="2" /><rect x="-13" y="-5" width="26" height="4" fill="var(--gold)" /></g>
            </g>
            <circle cx="150" cy="150" r="8" fill="var(--accent)" />
          </motion.svg>
        </div>
        <p className={cn("text-3xl font-black tabular-nums", aligned && "text-accent")}>{bearing.toFixed(1)}°</p>
        <p className="mb-5 text-sm text-mute">{aligned ? "Bilkul sahi simt! ✅" : heading != null ? "Phone ghumao jab tak Kaaba upar na aaye" : "Shimal (N) se ghari ki simt me"}</p>
        {heading == null && <Btn onClick={start}><Navigation size={18} />{asked ? "Compass dobara chalao" : "Live compass chalao"}</Btn>}
        {asked && heading == null && <p className="mt-3 max-w-xs text-center text-xs text-mute">Agar aapke device me compass sensor nahi (jaise PC), to upar ke dial par sunehri tir Qibla ki simt dikhata hai.</p>}
      </div>
    </Page>
  );
}

// ───────── C10 Zakat ─────────
export function Zakat() {
  const [step, setStep] = useState(0);
  const [v, setV] = useState({ cash: "", gold: "", silver: "", biz: "", debt: "", goldRate: "30000", silverRate: "300" });
  const n = (k: keyof typeof v) => parseFloat(v[k]) || 0;
  const assets = n("cash") + n("gold") * n("goldRate") + n("silver") * n("silverRate") + n("biz");
  const net = Math.max(0, assets - n("debt"));
  const nisab = 612.36 * n("silverRate");
  const due = net >= nisab ? net * 0.025 : 0;
  const steps: { t: string; f: ReactNode }[] = [
    { t: "Naqd rakam", f: <Field label="Cash + bank balance (Rs)"><input inputMode="decimal" value={v.cash} onChange={(e) => setV({ ...v, cash: e.target.value })} placeholder="0" className={inputCls} /></Field> },
    { t: "Sona", f: <><Field label="Sona (gram me)"><input inputMode="decimal" value={v.gold} onChange={(e) => setV({ ...v, gold: e.target.value })} placeholder="0" className={inputCls} /></Field><Field label="Aaj ka rate (Rs / gram)" hint="Apne shehar ka aaj ka rate daalein"><input inputMode="decimal" value={v.goldRate} onChange={(e) => setV({ ...v, goldRate: e.target.value })} className={inputCls} /></Field></> },
    { t: "Chandi", f: <><Field label="Chandi (gram me)"><input inputMode="decimal" value={v.silver} onChange={(e) => setV({ ...v, silver: e.target.value })} placeholder="0" className={inputCls} /></Field><Field label="Aaj ka rate (Rs / gram)"><input inputMode="decimal" value={v.silverRate} onChange={(e) => setV({ ...v, silverRate: e.target.value })} className={inputCls} /></Field></> },
    { t: "Tijarat / investment", f: <Field label="Tijarati maal, shares, kisi ko diya hua qarz (Rs)"><input inputMode="decimal" value={v.biz} onChange={(e) => setV({ ...v, biz: e.target.value })} placeholder="0" className={inputCls} /></Field> },
    { t: "Qarz", f: <Field label="Aap par jo qarz hai (Rs)" hint="Ye total se minus hoga"><input inputMode="decimal" value={v.debt} onChange={(e) => setV({ ...v, debt: e.target.value })} placeholder="0" className={inputCls} /></Field> },
  ];
  const result = step >= steps.length;
  return (
    <Page title="Zakat calculator" sub="Qadam ba qadam">
      <div className="mb-5 flex gap-1.5">{[...steps, 0].map((_, i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-accent" : "bg-surface2")} />)}</div>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
          {!result ? <><h3 className="mb-4 text-xl font-extrabold">{step + 1}. {steps[step].t}</h3>{steps[step].f}</> : (
            <div className="text-center">
              <p className="text-sm text-mute">Aapki zakat wajib hai</p>
              <p className={cn("my-2 text-5xl font-black", due ? "text-gold" : "text-mute")}>Rs {Math.round(due).toLocaleString("en-IN")}</p>
              <p className="mb-5 text-sm text-mute">{due ? "Kul qabil-e-zakat maal ka 2.5%" : "Aapka maal nisab se kam hai — zakat wajib nahi"}</p>
              <Card className="text-left"><Row title="Kul maal" right={<b>Rs {Math.round(assets).toLocaleString("en-IN")}</b>} /><Row title="Qarz minus" right={<b>- Rs {Math.round(n("debt")).toLocaleString("en-IN")}</b>} /><Row title="Net maal" right={<b>Rs {Math.round(net).toLocaleString("en-IN")}</b>} /><Row title="Nisab (612.36g chandi)" right={<b>Rs {Math.round(nisab).toLocaleString("en-IN")}</b>} /></Card>
              <p className="text-xs text-mute">Ye sirf andaza hai. Pakka masla kisi mufti sahab se poochh lein.</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      <div className="mt-6 flex gap-3">
        {step > 0 && <Btn variant="ghost" className="flex-1" onClick={() => setStep(step - 1)}>Peeche</Btn>}
        {!result ? <Btn className="flex-1" onClick={() => setStep(step + 1)}>{step === steps.length - 1 ? "Hisaab karo" : "Aage"}</Btn> : <Btn className="flex-1" onClick={() => { setStep(0); }}>Dobara karo</Btn>}
      </div>
    </Page>
  );
}

// ───────── C11 Masjids ─────────
const MASJIDS = [["Jamia Masjid Noor", 0.004, 0.006], ["Masjid-e-Bilal", -0.006, 0.003], ["Madni Masjid", 0.009, -0.004], ["Masjid Al-Falah", -0.003, -0.009], ["Masjid-e-Ibrahim", 0.013, 0.011], ["Masjid-e-Aqsa (mohalla)", -0.011, 0.012]] as const;
export function Masjids() {
  const loc = getLocation();
  const items = useMemo(() => MASJIDS.map(([name, dy, dx], i) => ({ i, name, lat: loc.lat + dy, lng: loc.lng + dx, d: distanceKm(loc, { lat: loc.lat + dy, lng: loc.lng + dx }), x: 200 + dx * 9000, y: 130 - dy * 9000 })).sort((a, b) => a.d - b.d), [loc.lat, loc.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sel, setSel] = useState(0);
  const s = items[sel];
  return (
    <Page title="Qareebi masjid" sub={`${loc.name} ke aas-paas`} flush>
      <div className="h-[300px] bg-surface"><MapArt big pins={[{ x: 200, y: 130, label: "Aap", active: false }, ...items.map((m, k) => ({ x: Math.max(30, Math.min(370, m.x)), y: Math.max(60, Math.min(235, m.y)), label: k === sel ? m.name : undefined, active: true }))]} /></div>
      <div className="mx-auto max-w-2xl p-4">
        <div className="mb-4 rounded-2xl border border-accent/40 bg-accent/10 p-4"><p className="font-extrabold">{s.name}</p><p className="text-sm text-mute">{s.d < 1 ? Math.round(s.d * 1000) + " meter" : s.d.toFixed(1) + " km"} door · paidal {Math.max(1, Math.round(s.d * 12))} min</p>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-accent"><Navigation size={15} />Raasta dikhao</a></div>
        <Card>{items.map((m, k) => <Row key={m.name} icon={<MapPin size={18} />} title={m.name} sub={`${m.d < 1 ? Math.round(m.d * 1000) + " m" : m.d.toFixed(1) + " km"} door`} onClick={() => setSel(k)} right={k === sel ? <Check className="text-accent" size={18} /> : undefined} />)}</Card>
        <p className="text-center text-xs text-mute">Demo nuqta: aas-paas ki masjidein namuna hain. Asli talash ke liye Google Maps khulta hai.</p>
        <a href={`https://www.google.com/maps/search/mosque/@${loc.lat},${loc.lng},15z`} target="_blank" rel="noreferrer" className="mt-3 block rounded-xl bg-surface2 py-3 text-center font-semibold">Google Maps par asli masjid dhoondo</a>
      </div>
    </Page>
  );
}

// ───────── C13 Hajj / Umrah ─────────
const ICON: Record<string, ReactNode> = { shirt: <Shirt />, mic: <Mic />, refresh: <RefreshCw />, droplet: <Droplet />, footprints: <Footprints />, scissors: <Scissors />, tent: <Tent />, sun: <Sun />, moon: <Moon />, target: <Target />, heart: <Heart /> };
export function Hajj() {
  const [tab, setTab] = useState<"umrah" | "hajj">("umrah");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const steps = GUIDE[tab];
  const cnt = steps.filter((_, i) => done[tab + i]).length;
  return (
    <Page title="Hajj aur Umrah guide" sub={`${cnt}/${steps.length} marahil mukammal`}>
      <Seg value={tab} onChange={setTab} className="mb-5" options={[{ v: "umrah", l: "Umrah" }, { v: "hajj", l: "Hajj" }]} />
      <div className="relative pl-2">
        <div className="absolute bottom-4 left-[29px] top-4 w-0.5 bg-line" />
        {steps.map((s, i) => (
          <motion.div key={tab + i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="relative mb-4 flex gap-4">
            <button onClick={() => setDone({ ...done, [tab + i]: !done[tab + i] })} className={cn("relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 transition", done[tab + i] ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface text-accent")}>{done[tab + i] ? <Check /> : ICON[s.i]}</button>
            <div className="flex-1 rounded-2xl border border-line bg-surface p-4"><p className="text-xs font-bold text-gold">Qadam {i + 1}</p><p className="font-extrabold">{s.t}</p><p className="mt-1 text-sm leading-relaxed text-mute">{s.d}</p></div>
          </motion.div>
        ))}
      </div>
    </Page>
  );
}

// ───────── C14 Moon ─────────
export function MoonPage() {
  const m = moonInfo(), h = hijri();
  const daysLeft = Math.ceil(m.toNew);
  return (
    <Page title="Chaand aur Islamic mahina">
      <div className="mb-5 flex flex-col items-center rounded-3xl bg-gradient-to-b from-[#0c1a2e] to-surface p-6 text-center">
        <MoonSvg phase={m.phase} size={150} />
        <p className="mt-3 text-xl font-black">{m.name}</p>
        <p className="text-sm text-mute">Roshni: {Math.round(m.illum * 100)}% · Umar: {m.age.toFixed(1)} din</p>
      </div>
      <Card title="Maujooda Islamic mahina"><Row title={`${h.d} ${HIJRI_MONTHS[h.m - 1]} ${h.y} AH`} sub={`Naya chaand taqreeban ${daysLeft} din me`} /></Card>
      <Card title="Hijri mahine">{HIJRI_MONTHS.map((n, i) => <Row key={n} title={`${i + 1}. ${n}`} right={i + 1 === h.m ? <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-bold text-gold">Abhi</span> : undefined} />)}</Card>
      <Card title="Chaand dekhne ki dua"><div className="p-4"><p className="arabic text-center text-xl">اللَّهُمَّ أَهِلَّهُ عَلَيْنَا بِالْأَمْنِ وَالْإِيمَانِ وَالسَّلَامَةِ وَالْإِسْلَامِ</p><p className="mt-2 text-center text-sm italic text-accent">Allahumma ahillahu alayna bil amni wal imani was salamati wal islam</p></div></Card>
      <p className="text-center text-xs text-mute">Chaand ki halat hisabi andaza hai; mahine ka aagaz shari rooyat par hota hai.</p>
    </Page>
  );
}

// ───────── C12 Dhikr reminders ─────────
export function DhikrReminders() {
  const list = useStore((s) => s.settings.dhikr);
  const set = (fn: (l: typeof list) => typeof list) => patchSettings({ dhikr: fn(list) });
  return (
    <Page title="Dhikr ki yaad-dahani" sub="Narm, roz ki yaad-dahani">
      <Card>{list.map((d) => (
        <div key={d.id} className="flex items-center gap-3 px-4 py-3">
          <input type="time" value={d.time} onChange={(e) => set((l) => l.map((x) => (x.id === d.id ? { ...x, time: e.target.value } : x)))} className="rounded-lg bg-surface2 px-2 py-1.5 text-sm font-bold" />
          <input value={d.label} onChange={(e) => set((l) => l.map((x) => (x.id === d.id ? { ...x, label: e.target.value } : x)))} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
          <Toggle on={d.on} onChange={(v) => set((l) => l.map((x) => (x.id === d.id ? { ...x, on: v } : x)))} />
          <button onClick={() => set((l) => l.filter((x) => x.id !== d.id))} className="text-mute hover:text-danger"><Trash2 size={17} /></button>
        </div>))}</Card>
      <div className="flex gap-3"><Btn variant="soft" className="flex-1" onClick={() => set((l) => [...l, { id: uid("d"), time: "12:00", label: "Naya dhikr", on: true }])}><Plus size={16} />Naya reminder</Btn><Btn variant="ghost" className="flex-1" onClick={() => toast("Dhikr ka waqt 🤲", "SubhanAllah wa bihamdihi — 100 baar", "info", 6000)}>Test karo</Btn></div>
      <p className="mt-4 text-xs text-mute">Do Not Disturb ke waqt reminders nahi aate.</p>
    </Page>
  );
}
void Moon; void useRef;
