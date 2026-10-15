"use client";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Moon, Pause, Play, Reply, SkipForward, Sun, Camera, Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/data/store";
import * as api from "@/data/api";
import { cn } from "@/lib/util";
import { Btn, Field, Logo, Page, inputCls } from "../ui";
import { ProfileCard, cropSquare } from "../profile/Profile";
import { requestNotifications } from "../settings/Settings";

// ───────── F7 explainer video (30s motion graphics) ─────────
const SCENES = [
  { cap: "Ye app kya hai?", sub: "Madrasa dostoun ka apna private group" },
  { cap: "Baatein", sub: "Chat, voice notes, stickers aur polls" },
  { cap: "Deen page", sub: "Namaz ke auqaat, Quran, duaein, qibla" },
  { cap: "Elaan aur nazm", sub: "Owner ke golden elaan, safe aur saaf group" },
  { cap: "Khel aur mazaa", sub: "Quiz, paheli, tic-tac-toe aur audio rooms" },
  { cap: "Chalo shuru karein!", sub: "Baatein, ab aur qareeb" },
];
export function Explainer({ onEnd, autoPlay = true }: { onEnd?: () => void; autoPlay?: boolean }) {
  const [t, setT] = useState(0), [play, setPlay] = useState(autoPlay);
  const raf = useRef(0), last = useRef(0);
  useEffect(() => {
    if (!play) return;
    last.current = performance.now();
    const tick = (n: number) => { const dt = (n - last.current) / 1000; last.current = n; setT((x) => { const v = x + dt; if (v >= 30) { setPlay(false); onEnd?.(); return 30; } return v; }); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [play]); // eslint-disable-line
  const sc = Math.min(5, Math.floor(t / 5));
  const seek = (e: React.MouseEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); setT(Math.max(0, Math.min(29.9, ((e.clientX - r.left) / r.width) * 30))); };
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-black shadow-2xl">
      <div className="relative aspect-video w-full overflow-hidden" style={{ background: ["linear-gradient(135deg,#0f5a43,#0a1311)", "linear-gradient(135deg,#0a2a3a,#0a1311)", "linear-gradient(135deg,#2b1a5a,#0a2a3a)", "linear-gradient(135deg,#6b4f12,#1a1204)", "linear-gradient(135deg,#7a2a4a,#0a1311)", "linear-gradient(135deg,#0f5a43,#0a2a3a)"][sc], transition: "background .6s" }} onClick={() => setPlay(!play)}>
        <div key={sc} className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white">
          <Scene n={sc} />
          <h3 className="ex-in mt-3 text-2xl font-black md:text-3xl" style={{ animationDelay: ".5s" }}>{SCENES[sc].cap}</h3>
          <p className="ex-in text-sm text-white/75 md:text-base" style={{ animationDelay: ".8s" }}>{SCENES[sc].sub}</p>
        </div>
        {!play && <div className="absolute inset-0 grid place-items-center bg-black/30"><span className="grid h-16 w-16 place-items-center rounded-full bg-white/90 text-black"><Play fill="black" /></span></div>}
        <div className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold text-white tabular-nums">0:{String(Math.floor(t)).padStart(2, "0")} / 0:30</div>
      </div>
      <div className="flex items-center gap-3 bg-[#0d1513] px-3 py-2.5">
        <button onClick={() => { if (t >= 29.9) setT(0); setPlay(!play); }} className="text-white">{play ? <Pause size={20} /> : <Play size={20} />}</button>
        <div className="relative h-2 flex-1 cursor-pointer rounded-full bg-white/15" onClick={seek}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${(t / 30) * 100}%` }} />
          {SCENES.map((_, i) => i > 0 && <span key={i} className="absolute top-0 h-full w-px bg-black/60" style={{ left: `${(i / 6) * 100}%` }} />)}
        </div>
        <button onClick={() => { setT(0); setPlay(true); }} className="text-xs font-bold text-white/70">Dobara</button>
      </div>
    </div>
  );
}
function Scene({ n }: { n: number }) {
  if (n === 0 || n === 5) return <div className="ex-pop"><Logo size={92} /></div>;
  if (n === 1) return <div className="flex w-56 flex-col gap-2">{[["Assalamu Alaikum! 👋", false], ["Walaikum salam bhai", true], ["Aaj dars me aa rahe ho?", false], ["Pakka! 🤲 ✓✓", true]].map(([t, o], i) => <div key={i} className={cn(o ? "ex-r self-end bg-[#0f5a43]" : "ex-l self-start bg-[#1c2a27]", "rounded-2xl px-3 py-2 text-left text-sm")} style={{ animationDelay: `${i * 0.7}s` }}>{t as string}</div>)}</div>;
  if (n === 2) return <div className="flex items-center gap-4"><svg className="ex-pop" width="86" height="86" viewBox="0 0 100 100"><path d="M64 14a38 38 0 1 0 22 68 30 30 0 1 1-22-68z" fill="#e8bd57" /></svg><div className="ex-in space-y-1.5 rounded-2xl bg-white/10 p-3 text-left text-sm font-bold" style={{ animationDelay: ".4s" }}>{["Fajr 5:12", "Zuhr 12:30", "Asr 4:05", "Maghrib 6:41"].map((x) => <p key={x}>🕌 {x}</p>)}</div></div>;
  if (n === 3) return <div className="ex-in w-60 overflow-hidden rounded-2xl text-left text-[#2a1d02]" style={{ backgroundImage: "linear-gradient(100deg,#e8bd57,#fbe9a8,#e8bd57)" }}><div className="p-3"><p className="text-[10px] font-black uppercase tracking-widest">📣 Elaan</p><p className="font-bold">Kal Jummah ke baad halqa hai!</p></div></div>;
  return <div className="flex gap-3 text-4xl">{["🧠", "🧩", "⭕", "🎧"].map((e, i) => <span key={e} className="ex-pop" style={{ animationDelay: `${i * 0.25}s` }}>{e}</span>)}</div>;
}

// ───────── F2 tour carousel ─────────
const SLIDES = [
  { t: "Chat", d: "Ek hi group, saare dost. Messages, voice notes, stickers, polls — sab kuch yahan.", c: "#2ccf8a" },
  { t: "Deen page", d: "Namaz ke auqaat, Quran, duaein, tasbeeh aur qibla — apni deen ki duniya.", c: "#e8bd57" },
  { t: "Profile", d: "Apni profile ko banner, effects aur badges se sajao.", c: "#c79bff" },
  { t: "Elaan", d: "Owner ke golden elaan sab se upar dikhte hain — koi nahi chhootega.", c: "#ff8a5c" },
  { t: "Settings", d: "Theme, wallpaper, privacy aur notifications — sab aapke control me.", c: "#4cc3ff" },
];
function Illus({ i, c }: { i: number; c: string }) {
  return (
    <svg viewBox="0 0 240 180" className="mx-auto h-44 w-full max-w-xs float-y">
      <rect x="10" y="10" width="220" height="160" rx="24" fill={c} opacity=".12" />
      {i === 0 && <><rect x="30" y="34" width="110" height="38" rx="14" fill="#1c2a27" /><rect x="100" y="84" width="110" height="38" rx="14" fill="#0f5a43" /><rect x="30" y="134" width="70" height="26" rx="12" fill="#1c2a27" /><path d="M170 108l6 6 12-13" stroke="#53bdeb" strokeWidth="3.5" fill="none" strokeLinecap="round" /></>}
      {i === 1 && <><path d="M60 140V90a60 60 0 0 1 120 0v50z" fill={c} opacity=".85" /><rect x="116" y="26" width="8" height="30" fill={c} /><path d="M120 20a12 12 0 1 0 8 20a9 9 0 1 1-8-20z" fill="#fff3cf" /><rect x="105" y="105" width="30" height="35" rx="15" fill="#0a1311" /><rect x="30" y="100" width="22" height="40" fill={c} opacity=".6" /><rect x="188" y="100" width="22" height="40" fill={c} opacity=".6" /></>}
      {i === 2 && <><rect x="40" y="30" width="160" height="120" rx="18" fill="#121f1c" /><rect x="40" y="30" width="160" height="42" rx="18" fill={c} /><circle cx="76" cy="84" r="22" fill="#2ccf8a" stroke="#121f1c" strokeWidth="5" /><rect x="108" y="90" width="70" height="8" rx="4" fill="#ffffff55" /><rect x="60" y="122" width="120" height="8" rx="4" fill="#ffffff33" /><circle cx="170" cy="50" r="6" fill="#fff" opacity=".8" /></>}
      {i === 3 && <><rect x="26" y="52" width="188" height="56" rx="14" fill={c} /><path d="M52 66l22 8v14l-22 8z" fill="#2a1d02" /><rect x="86" y="68" width="100" height="8" rx="4" fill="#2a1d02" opacity=".7" /><rect x="86" y="84" width="70" height="8" rx="4" fill="#2a1d02" opacity=".45" /><rect x="40" y="124" width="120" height="28" rx="12" fill="#1c2a27" /></>}
      {i === 4 && <>{[0, 1, 2].map((k) => <g key={k}><rect x="40" y={40 + k * 38} width="160" height="14" rx="7" fill="#ffffff22" /><circle cx={80 + k * 40} cy={47 + k * 38} r="11" fill={c} /></g>)}</>}
    </svg>
  );
}
export function Tour({ onDone, label = "Aage" }: { onDone: () => void; label?: string }) {
  const [i, setI] = useState(0);
  const go = (d: number) => setI((v) => Math.max(0, Math.min(SLIDES.length - 1, v + d)));
  return (
    <div className="flex flex-col items-center">
      <motion.div className="w-full cursor-grab touch-pan-y active:cursor-grabbing" drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.3} onDragEnd={(_, inf) => { if (inf.offset.x < -60) go(1); else if (inf.offset.x > 60) go(-1); }}>
        <AnimatePresence mode="wait"><motion.div key={i} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="text-center">
          <Illus i={i} c={SLIDES[i].c} /><h2 className="mt-4 text-3xl font-black">{SLIDES[i].t}</h2><p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-mute">{SLIDES[i].d}</p>
        </motion.div></AnimatePresence>
      </motion.div>
      <div className="my-6 flex gap-2">{SLIDES.map((_, k) => <button key={k} onClick={() => setI(k)} className={cn("h-2 rounded-full transition-all", k === i ? "w-7 bg-accent" : "w-2 bg-line")} />)}</div>
      <div className="flex w-full max-w-xs gap-3">{i > 0 && <Btn variant="ghost" onClick={() => go(-1)}><ChevronLeft size={18} /></Btn>}<Btn className="flex-1" onClick={() => (i === SLIDES.length - 1 ? onDone() : go(1))}>{i === SLIDES.length - 1 ? label : "Aage"}<ChevronRight size={18} /></Btn></div>
    </div>
  );
}

// ───────── F13 gesture tutorial ─────────
export function GestureDemo({ onDone }: { onDone?: () => void }) {
  const x = useMotionValue(0);
  const op = useTransform(x, [0, 50], [0, 1]);
  const [ok, setOk] = useState(false);
  return (
    <div className="rounded-3xl bg-bg2 p-5">
      <div className="relative py-4">
        <motion.span style={{ opacity: op }} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-accent p-2 text-accent-fg"><Reply size={16} /></motion.span>
        <motion.div drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0, right: 0.4 }} dragSnapToOrigin style={{ x }} onDragEnd={(_, i) => { if (i.offset.x > 55) { setOk(true); onDone?.(); } }} className="bub in tail ml-12 w-fit cursor-grab px-3.5 py-2.5 text-[15px] active:cursor-grabbing">
          <p className="mb-0.5 text-[13px] font-bold text-sky-400">Ahmed Raza</p>Assalamu Alaikum! Is message ko right swipe karo 👉
        </motion.div>
      </div>
      <AnimatePresence>{ok && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex items-center gap-2 rounded-xl bg-accent/15 p-3 text-sm font-bold text-accent"><Check size={18} />Shabash! Aise hi reply hota hai.</motion.div>}</AnimatePresence>
    </div>
  );
}

export function TourPage() { return <Page title="App tour"><div className="py-4"><Tour onDone={api.back} label="Mukammal" /></div></Page>; }
export function ExplainerPage() { return <Page title="Ye app kya hai"><Explainer autoPlay /></Page>; }
export function GesturePage() { return <Page title="Swipe-to-reply"><p className="mb-4 text-center text-lg font-extrabold">Try karo! Is message ko right swipe karo.</p><GestureDemo /><p className="mt-4 text-center text-sm text-mute">PC par: message par hover karke Reply icon dabayein, ya mouse se kheench kar right le jayein.</p></Page>;
}

// ───────── main onboarding flow ─────────
const STEPS = ["welcome", "video", "tour", "theme", "profile", "notif", "gesture", "deen", "done"] as const;
export default function Onboarding() {
  const [si, setSi] = useState(0);
  const step = STEPS[si];
  const me = useStore((s) => s.members.find((m) => m.id === s.me)!);
  const theme = useStore((s) => s.settings.theme);
  const [sub, setSub] = useState(0);
  const [name, setName] = useState(me.name === "Abdullah" ? "" : me.name), [about, setAbout] = useState(""), [avatar, setAvatar] = useState<string | undefined>(me.avatar);
  const file = useRef<HTMLInputElement>(null);
  const [gesture, setGesture] = useState(false);
  const next = useCallback(() => setSi((v) => Math.min(STEPS.length - 1, v + 1)), []);
  const pct = Math.round((si / (STEPS.length - 1)) * 100);
  useEffect(() => { if (step === "done") { api.burstConfetti(); api.patchOnboarding({ tourSeen: true, videoSeen: true }); } }, [step]);
  const pick = (t: "dark" | "light" | "amoled") => { api.patchSettings({ theme: t }); api.setChecklist("theme"); api.patchOnboarding({ darkPrompted: true }); };
  const finish = () => { api.setChecklist("theme"); api.finishOnboarding(); api.setTab("chat"); };
  return (
    <div className="fixed inset-0 flex flex-col bg-bg text-fg" style={{ backgroundImage: "radial-gradient(circle at 50% -10%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 55%)" }}>
      {step !== "welcome" && (
        <div className="safe-t mx-auto w-full max-w-md px-5 pt-4"><div className="mb-1 flex justify-between text-xs font-bold text-mute"><span>Setup</span><span>{pct}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-surface2"><motion.div className="h-full rounded-full bg-accent" animate={{ width: `${pct}%` }} /></div></div>
      )}
      <div className="thin flex min-h-0 flex-1 flex-col overflow-y-auto"><div className="m-auto w-full max-w-md px-5 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={step + (step === "profile" ? sub : "")} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ type: "spring", stiffness: 320, damping: 32 }}>
            {step === "welcome" && (
              <div className="text-center"><motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, -8, 8, 0] }} transition={{ type: "spring", stiffness: 200, damping: 12 }} className="mx-auto mb-5 w-fit"><Logo size={110} /></motion.div>
                <h1 className="text-4xl font-black tracking-tight">Chats<span className="text-accent">App</span></h1><p className="mt-2 text-lg text-mute">Baatein, ab aur qareeb</p>
                <p className="mx-auto mt-6 max-w-xs text-[15px] leading-relaxed text-mute">Madrasa ke dostoun ka apna private group — chat, deen aur mazaa, sab ek jagah.</p>
                <Btn className="mt-8 w-full !py-3.5 text-lg" onClick={next}>Shuru karein</Btn></div>
            )}
            {step === "video" && (<div><h2 className="mb-1 text-2xl font-black">Ye app kya hai?</h2><p className="mb-4 text-sm text-mute">30 second ki chhoti si jhalak</p><Explainer onEnd={() => api.patchOnboarding({ videoSeen: true })} /><div className="mt-5 flex gap-3"><Btn variant="ghost" className="flex-1" onClick={next}><SkipForward size={16} />Chhod do</Btn><Btn className="flex-1" onClick={next}>Aage</Btn></div></div>)}
            {step === "tour" && <Tour onDone={next} />}
            {step === "theme" && (
              <div><h2 className="text-2xl font-black">Apna theme chuno</h2>
                <div className="my-4 flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4"><Moon className="shrink-0 text-gold" /><p className="flex-1 text-sm font-semibold">Raat ko aankhein bachao 🌙 — dark mode try karo?</p>{theme !== "dark" && <Btn small variant="gold" onClick={() => pick("dark")}>Haan</Btn>}</div>
                <div className="grid grid-cols-3 gap-3">{([["dark", "Dark", "#0a1311", "#0f5a43"], ["light", "Light", "#f4f1e9", "#d3f5df"], ["amoled", "AMOLED", "#000", "#0b4a37"]] as const).map(([k, l, bg, b]) => <button key={k} onClick={() => pick(k)} className={cn("rounded-2xl border-2 p-2 transition", theme === k ? "border-accent" : "border-line")}><div className="mb-2 flex h-24 flex-col justify-end gap-1 rounded-xl p-2" style={{ background: bg }}><span className="h-3 w-3/4 rounded-full" style={{ background: k === "light" ? "#fff" : "#1c2a27" }} /><span className="ml-auto h-3 w-2/3 rounded-full" style={{ background: b }} /></div><p className="flex items-center justify-center gap-1 text-sm font-bold">{k === "light" ? <Sun size={14} /> : <Moon size={14} />}{l}</p></button>)}</div>
                <Btn className="mt-6 w-full" onClick={next}>Aage</Btn></div>
            )}
            {step === "profile" && (
              <div><h2 className="text-2xl font-black">Apni profile banao</h2><p className="mb-4 text-sm text-mute">Qadam {sub + 1}/3 — {["Photo", "Naam", "About"][sub]}</p>
                <div className="mb-4 scale-[0.92]"><ProfileCard m={me} name={name || "Aapka naam"} about={about || "Apne baare me kuch likho…"} avatar={avatar} /></div>
                {sub === 0 && <div className="flex gap-3"><Btn variant="soft" className="flex-1" onClick={() => file.current?.click()}><Camera size={17} />Photo lagao</Btn><Btn className="flex-1" onClick={() => { if (avatar) api.setProfile({ avatar }); setSub(1); }}>{avatar ? "Aage" : "Baad me"}</Btn></div>}
                {sub === 1 && <><Field label="Aapka naam"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Jaise: Abdullah" className={inputCls} /></Field><Btn className="w-full" disabled={!name.trim()} onClick={() => { api.setProfile({ name: name.trim() }); setSub(2); }}>Aage</Btn></>}
                {sub === 2 && <><Field label="About"><input value={about} onChange={(e) => setAbout(e.target.value)} maxLength={90} placeholder="Jaise: Chai aur Quran ☕📖" className={inputCls} /></Field><div className="flex gap-3"><Btn variant="ghost" className="flex-1" onClick={() => { setSub(0); next(); }}>Chhod do</Btn><Btn className="flex-1" disabled={!about.trim()} onClick={() => { api.setProfile({ about: about.trim() }); setSub(0); next(); }}>Mukammal</Btn></div></>}
                <input ref={file} hidden type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setAvatar(await cropSquare(f)); e.target.value = ""; }} />
              </div>
            )}
            {step === "notif" && (
              <div className="text-center"><div className="mx-auto mb-5 grid h-24 w-24 place-items-center rounded-full bg-accent/15 text-accent"><Bell size={44} /></div><h2 className="text-2xl font-black">Notifications on karein?</h2>
                <ul className="mx-auto my-5 max-w-xs space-y-3 text-left text-[15px]">{["Naye messages ki foran khabar", "Namaz ke waqt ki yaad-dahani", "Owner ke zaroori elaan miss nahi honge"].map((t) => <li key={t} className="flex gap-3"><Check size={18} className="mt-0.5 shrink-0 text-accent" />{t}</li>)}</ul>
                <Btn className="w-full" onClick={async () => { await requestNotifications(); next(); }}>Haan, on karo</Btn><button onClick={next} className="mt-3 text-sm font-semibold text-mute">Abhi nahi</button></div>
            )}
            {step === "gesture" && (<div><h2 className="mb-1 text-2xl font-black">Swipe-to-reply</h2><p className="mb-4 text-sm text-mute">Try karo! Is message ko right swipe karo.</p><GestureDemo onDone={() => { setGesture(true); api.patchOnboarding({ gestureDone: true }); }} /><p className="mt-3 text-xs text-mute">PC par: mouse se kheencho, ya message par hover karke Reply dabayein.</p><Btn className="mt-5 w-full" onClick={next}>{gesture ? "Aage" : "Chhod do"}</Btn></div>)}
            {step === "deen" && (<div className="text-center"><div className="relative mx-auto mb-5 overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-[#3a2c0a] to-[#1b2a22] p-6 text-[#fff3cf]"><p className="text-xl font-extrabold">Deen page me namaz times, Quran aur duaein hain 🕌</p><div className="mt-4 flex flex-wrap justify-center gap-2">{["Namaz auqaat", "Quran", "Duaein", "Tasbeeh", "Qibla", "Zakat"].map((c) => <span key={c} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{c}</span>)}</div></div><Btn className="w-full" onClick={next}>Wah, chalo!</Btn></div>)}
            {step === "done" && (<div className="text-center"><motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 12 }} className="mx-auto mb-5 grid h-28 w-28 place-items-center rounded-full bg-gold/20 text-6xl">🎉</motion.div><h2 className="text-3xl font-black">Mubarak ho!</h2><p className="mt-1 text-mute">Setup 100% mukammal</p><p className="mx-auto mt-4 max-w-xs text-[15px]">Aap Madrasa Group me aa gaye hain. Group me aapka swagat kiya jayega.</p><Btn className="mt-8 w-full !py-3.5 text-lg" onClick={finish}>Group me chalo</Btn></div>)}
          </motion.div>
        </AnimatePresence>
      </div></div>
      {step !== "welcome" && step !== "done" && si > 0 && <div className="safe-b pb-3 text-center"><button onClick={() => setSi((v) => Math.max(0, v - 1))} className="text-xs font-semibold text-mute">← Peeche jao</button></div>}
    </div>
  );
}
