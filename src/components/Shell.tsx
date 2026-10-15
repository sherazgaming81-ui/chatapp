"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Fingerprint, Gamepad2, MessageCircle, Moon, Shield, User, Delete, WifiOff, Loader2, X, Check, RefreshCw, Sparkles, Ban, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/data/store";
import { back, burstConfetti, dismissAzaan, dismissChangelog, dismissRemoteOverlay, dismissToast, go, me, setTab, triggerAzaan, NEXT_VERSION } from "@/data/api";
import { CHAT_THEMES } from "@/data/assets";
import { hijri, isEidDay, ramadanInfo } from "@/data/deen";
import { cn } from "@/lib/util";
import { Avatar, Btn, Confetti, Logo, Sheet, useIsDesktop } from "./ui";
import { PAGES } from "./pages";
import ChatView from "./chat/Chat";
import DeenHome from "./deen/Deen";
import Games from "./extras/Games";
import Owner from "./owner/Owner";
import Settings from "./settings/Settings";
import Onboarding from "./onboarding/Onboarding";

const TABS = [
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "deen", label: "Deen", icon: Moon },
  { id: "khel", label: "Khel", icon: Gamepad2 },
  { id: "owner", label: "Owner", icon: Shield },
  { id: "me", label: "Mera", icon: User },
] as const;

export default function Shell() {
  const settings = useStore((s) => s.settings);
  const onboarding = useStore((s) => s.onboarding);
  const nav = useStore((s) => s.nav);
  const role = useStore((s) => s.members.find((m) => m.id === s.me)?.role);
  const unread = useStore((s) => { const i = s.messages.findIndex((m) => m.id === s.lastRead); return s.messages.slice(i + 1).filter((m) => m.from !== s.me && m.type !== "system").length; });
  const confetti = useStore((s) => s.ui.confetti);
  const [unlocked, setUnlocked] = useState(false);
  const desktop = useIsDesktop();

  // theme + chat theme + ramadan
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = settings.theme;
    const t = CHAT_THEMES.find((x) => x.id === settings.chatTheme) ?? CHAT_THEMES[0];
    const light = settings.theme === "light";
    el.style.setProperty("--bub-out", light ? t.outL : t.out);
    el.style.setProperty("--accent", light ? t.accentL : t.accent);
    el.dataset.ramadan = ramadanInfo(settings.ramadan).active ? "1" : "0";
    el.dataset.eid = settings.eid || isEidDay() ? "1" : "0";
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", settings.theme === "light" ? "#f4f1e9" : settings.theme === "amoled" ? "#000000" : "#0a1311");
  }, [settings.theme, settings.chatTheme, settings.ramadan, settings.eid]);

  // Esc closes top page
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && nav.stack.length && !document.querySelector("[data-sheet]")) back(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [nav.stack.length]);

  const lockOn = settings.appLock.on && !unlocked;
  const tabs = TABS.filter((t) => t.id !== "owner" || role === "owner" || role === "admin");
  const banned = useStore((s) => s.members.find((m) => m.id === s.me)?.banned);

  if (!onboarding.done) return (<><Onboarding /><Overlays /><Confetti trigger={confetti} /></>);

  return (
    <div className="fixed inset-0 flex bg-bg text-fg">
      <style>{`html[data-ramadan="1"] body{background-image:radial-gradient(circle at 85% -10%,rgba(232,189,87,.14),transparent 42%),radial-gradient(circle at 0% 105%,rgba(44,207,138,.09),transparent 45%)}`}</style>
      {/* desktop rail */}
      <nav className="hidden w-[76px] shrink-0 flex-col items-center gap-1.5 border-r border-line bg-surface py-4 md:flex">
        <div className="mb-3"><Logo size={36} /></div>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} title={t.label} className={cn("relative grid h-12 w-14 place-items-center rounded-2xl transition", nav.tab === t.id ? "bg-accent/15 text-accent" : "text-mute hover:bg-surface2 hover:text-fg")}>
            <t.icon size={22} />
            <span className="text-[10px] font-semibold leading-none">{t.label}</span>
            {t.id === "chat" && unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg">{unread}</span>}
          </button>
        ))}
      </nav>
      <main className="relative flex min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          <div className={cn("absolute inset-0", nav.tab !== "chat" && "hidden")}><ChatView active={nav.tab === "chat" && nav.stack.length === 0} /></div>
          {nav.tab === "deen" && <div className="absolute inset-0"><DeenHome /></div>}
          {nav.tab === "khel" && <div className="absolute inset-0"><Games /></div>}
          {nav.tab === "owner" && <div className="absolute inset-0"><Owner /></div>}
          {nav.tab === "me" && <div className="absolute inset-0"><Settings /></div>}
        </div>
        {/* mobile bottom nav */}
        <nav className="safe-b flex shrink-0 border-t border-line bg-surface md:hidden">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition", nav.tab === t.id ? "text-accent" : "text-mute")}>
              <motion.span animate={{ scale: nav.tab === t.id ? 1.15 : 1, y: nav.tab === t.id ? -1 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}><t.icon size={21} /></motion.span>
              {t.label}
              {t.id === "chat" && unread > 0 && <span className="absolute left-1/2 top-1 ml-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg">{unread}</span>}
            </button>
          ))}
        </nav>
      </main>

      {/* stacked pages */}
      <AnimatePresence>
        {nav.stack.map((p, i) => {
          const C = PAGES[p.page];
          if (!C) return null;
          return (
            <motion.div key={i + p.page} className="fixed inset-0 z-50 md:flex md:justify-end" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
              {desktop && <motion.div className="absolute inset-0 bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => i === nav.stack.length - 1 && back()} />}
              <motion.div className="relative h-full w-full bg-bg shadow-2xl md:w-[600px] md:border-l md:border-line" initial={{ x: desktop ? 80 : "100%", opacity: desktop ? 0 : 1 }} animate={{ x: 0, opacity: 1 }} exit={{ x: desktop ? 80 : "100%", opacity: desktop ? 0 : 1 }} transition={{ type: "spring", stiffness: 400, damping: 40 }}>
                <C {...(p.props ?? {})} />
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <Overlays />
      <Confetti trigger={confetti} />
      <AnimatePresence>{banned && <BannedScreen />}</AnimatePresence>
      <AnimatePresence>{lockOn && <LockScreen onUnlock={() => setUnlocked(true)} />}</AnimatePresence>
      <WarnWatcher />
    </div>
  );
}

function Overlays() {
  const toasts = useStore((s) => s.ui.toasts);
  const ach = useStore((s) => s.ui.achievement);
  const azaan = useStore((s) => s.ui.azaan);
  const remote = useStore((s) => s.ui.remoteOverlay);
  const changelog = useStore((s) => s.ui.changelog);
  const offline = useStore((s) => s.ui.offline);
  const version = useStore((s) => s.owner.currentVersion);
  const syncing = useStore((s) => s.ui.syncing);
  return (
    <>
      {/* A15 toasts */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[150] flex flex-col items-center gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))]">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.button key={t.id} layout initial={{ y: -80, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -60, opacity: 0, scale: 0.95 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}
              onClick={() => { dismissToast(t.id); if (t.kind === "msg") setTab("chat"); }}
              className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 text-left shadow-2xl backdrop-blur">
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", t.kind === "msg" ? "bg-accent text-accent-fg" : "bg-gold/20 text-gold")}>{t.kind === "msg" ? <MessageCircle size={18} /> : <Sparkles size={18} />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{t.title}</span>{t.body && <span className="block truncate text-[13px] text-mute">{t.body}</span>}</span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* F6 minecraft-style achievement */}
      <AnimatePresence>
        {ach && (
          <motion.div key={ach.id} initial={{ y: -120 }} animate={{ y: 0 }} exit={{ y: -120 }} transition={{ type: "spring", stiffness: 300, damping: 26 }} className="pointer-events-none fixed inset-x-0 top-0 z-[160] flex justify-center px-3 pt-[max(12px,env(safe-area-inset-top))]">
            <div className="flex w-full max-w-sm items-center gap-3 border-2 border-[#555] bg-[#1b1b1b] px-3 py-2.5 shadow-[0_6px_0_#000a]" style={{ imageRendering: "pixelated", borderRadius: 4 }}>
              <div className="grid h-12 w-12 shrink-0 place-items-center border-2 border-[#3a3a3a] bg-[#2d2d2d] text-2xl" style={{ borderRadius: 2 }}>{ach.icon}</div>
              <div className="min-w-0 font-mono">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#ffff55]">Achievement Unlocked!</div>
                <div className="truncate text-sm font-bold text-white">{ach.title}</div>
                <div className="truncate text-[11px] text-[#aaa]">{ach.desc}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* I17 offline banner (global) */}
      <AnimatePresence>
        {offline && (
          <motion.div initial={{ y: -40 }} animate={{ y: 0 }} exit={{ y: -40 }} className="pointer-events-none fixed inset-x-0 top-0 z-[140] flex justify-center">
            <div className="mt-[env(safe-area-inset-top)] flex items-center gap-2 rounded-b-2xl bg-[#c9792b] px-4 py-1.5 text-xs font-bold text-white shadow-lg"><WifiOff size={14} /> Offline ho — messages jud jayenge</div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{syncing && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed bottom-20 right-3 z-[90] md:bottom-4"><Loader2 className="animate-spin text-accent" size={18} /></motion.div>}</AnimatePresence>

      <AnimatePresence>{azaan && <AzaanAlert key={azaan.at} name={azaan.name} />}</AnimatePresence>

      {/* G8 remote reload/push overlay */}
      <AnimatePresence>
        {remote && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[250] grid place-items-center bg-[#0a1311]/95 px-6 text-center backdrop-blur">
            <div className="max-w-sm">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }} className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full border-4 border-accent/30 border-t-accent"><RefreshCw className="text-accent" size={22} /></motion.div>
              <h2 className="text-xl font-extrabold text-white">{remote.kind === "push" ? "Naya version aa raha hai" : "App refresh ho raha hai"}</h2>
              <p className="mt-2 text-[15px] text-[#b6cbc3]">{remote.message}</p>
              <p className="mt-4 text-xs text-[#6f8a80]">Cache saaf ho raha hai… thodi der ruko</p>
              <button onClick={dismissRemoteOverlay} className="mt-5 text-xs text-[#6f8a80] underline">Chhupao</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* G10 changelog */}
      <Sheet open={changelog} onClose={dismissChangelog} title={`Kya naya hai — v${version}`}>
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gold/10 p-3.5 text-gold"><Sparkles /><p className="text-sm font-semibold">App naye version par update ho gayi. Ye naya kya hai:</p></div>
        <ul className="mb-5 space-y-3">
          {(version === NEXT_VERSION.version ? NEXT_VERSION.notes : ["Behtar performance", "Chhoti bugs theek ki gayi"]).map((n, i) => (
            <motion.li key={n} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.07 }} className="flex gap-3 text-[15px]"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-accent-fg"><Check size={12} /></span>{n}</motion.li>
          ))}
        </ul>
        <Btn className="w-full" onClick={() => { dismissChangelog(); burstConfetti(); }}>Shukriya, chalo!</Btn>
      </Sheet>
    </>
  );
}

function AzaanAlert({ name }: { name: string }) {
  useEffect(() => {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      [523, 659, 784, 1047].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.type = "sine"; g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.35); g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.35 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.35 + 0.9); o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.35); o.stop(ctx.currentTime + i * 0.35 + 1); });
      navigator.vibrate?.([200, 100, 200]);
      return () => { ctx.close().catch(() => {}); };
    } catch { /* ignore */ }
  }, []);
  return (
    <motion.div initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[220] grid place-items-center overflow-hidden px-6 text-center" style={{ background: "radial-gradient(circle at 50% 30%, #1b5a45, #0a1311 70%)" }}>
      {Array.from({ length: 26 }).map((_, i) => <span key={i} className="absolute rounded-full bg-white" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 80}%`, width: 2 + (i % 3), height: 2 + (i % 3), animation: `twinkle ${2 + (i % 4)}s ${i * 0.15}s infinite` }} />)}
      <div className="relative">
        <svg viewBox="0 0 100 100" width="120" height="120" className="mx-auto" style={{ animation: "glow 3s infinite" }}><path d="M64 14a38 38 0 1 0 22 68 30 30 0 1 1-22-68z" fill="#e8bd57" /></svg>
        <h1 className="mt-6 text-3xl font-extrabold text-white">Namaz ka waqt ho gaya 🕌</h1>
        <p className="mt-2 text-5xl font-black text-[#e8bd57]">{name}</p>
        <p className="mt-3 text-[#a8c4b9]">&ldquo;Namaz ki taraf aao, kamyabi ki taraf aao&rdquo;</p>
        <div className="mt-8 flex justify-center gap-3">
          <Btn variant="gold" onClick={dismissAzaan}>Ji, namaz ko chalein</Btn>
          <Btn variant="ghost" className="!text-white" onClick={() => { dismissAzaan(); setTimeout(() => triggerAzaan(name), 5 * 60e3); }}>5 min baad</Btn>
        </div>
      </div>
    </motion.div>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const pin = useStore((s) => s.settings.appLock.pin);
  const [v, setV] = useState("");
  const [err, setErr] = useState(false);
  const [scan, setScan] = useState(false);
  const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const m = me();
  useEffect(() => {
    if (v.length === 4) {
      if (v === pin) onUnlock();
      else { setErr(true); navigator.vibrate?.(120); setTimeout(() => { setV(""); setErr(false); }, 500); }
    }
  }, [v, pin, onUnlock]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (/^\d$/.test(e.key)) setV((x) => (x.length < 4 ? x + e.key : x)); if (e.key === "Backspace") setV((x) => x.slice(0, -1)); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  const bio = () => { setScan(true); setTimeout(onUnlock, 1100); };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="fixed inset-0 z-[230] flex flex-col items-center justify-center bg-bg px-6">
      <Avatar m={m} size={72} dot={false} />
      <h2 className="mt-4 text-xl font-bold">ChatsApp locked hai</h2>
      <p className="mb-6 text-sm text-mute">{touch ? "Fingerprint lagayein ya PIN daalein" : "Apna 4-digit PIN daalein"}</p>
      <motion.div animate={err ? { x: [-10, 10, -8, 8, 0] } : {}} className="mb-8 flex gap-3">
        {[0, 1, 2, 3].map((i) => <span key={i} className={cn("h-4 w-4 rounded-full border-2 transition", i < v.length ? "border-accent bg-accent" : "border-mute", err && "!border-danger !bg-danger")} />)}
      </motion.div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <button key={d} onClick={() => setV((x) => (x.length < 4 ? x + d : x))} className="h-16 w-16 rounded-full bg-surface text-2xl font-semibold active:bg-surface2">{d}</button>)}
        {touch ? <button onClick={bio} className={cn("grid h-16 w-16 place-items-center rounded-full text-accent", scan && "animate-pulse")}><Fingerprint size={30} /></button> : <span />}
        <button onClick={() => setV((x) => (x.length < 4 ? x + "0" : x))} className="h-16 w-16 rounded-full bg-surface text-2xl font-semibold active:bg-surface2">0</button>
        <button onClick={() => setV((x) => x.slice(0, -1))} className="grid h-16 w-16 place-items-center rounded-full text-mute"><Delete size={24} /></button>
      </div>
    </motion.div>
  );
}

function BannedScreen() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[240] grid place-items-center bg-bg px-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-danger/15 text-danger"><Ban size={38} /></div>
        <h2 className="text-2xl font-extrabold">Aap ban ho chuke hain</h2>
        <p className="mt-2 text-mute">Owner ne aapko is group se ban kar diya hai. Ye foran lagu hua — koi reload nahi chahiye. Agar ghalti lagti hai to Owner se rabta karein.</p>
        <Btn variant="ghost" className="mt-6" onClick={() => import("@/data/api").then((a) => a.unbanMember(a.me().id))}>(Demo) Unban karo</Btn>
      </div>
    </motion.div>
  );
}

function WarnWatcher() {
  const warns = useStore((s) => s.members.find((m) => m.id === s.me)?.warns ?? []);
  const prev = useRef(warns.length);
  const [show, setShow] = useState(false);
  useEffect(() => { if (warns.length > prev.current) setShow(true); prev.current = warns.length; }, [warns.length]);
  const last = warns[warns.length - 1];
  return (
    <Sheet open={show} onClose={() => setShow(false)} title="Aapko warning mili hai">
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-danger/10 p-4 text-danger"><AlertTriangle /><div><p className="font-bold">Warning {warns.length}/3</p><p className="text-sm">{last?.reason}</p></div></div>
      <p className="mb-4 text-sm text-mute">3 warnings par aap automatic mute ho jayenge. Meharbani karke group ke rules ka khayal rakhein.</p>
      <Btn className="w-full" onClick={() => setShow(false)}>Samajh gaya</Btn>
    </Sheet>
  );
}

export { go };
