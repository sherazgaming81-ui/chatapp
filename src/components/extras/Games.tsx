"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Brain, Check, Circle as CircleI, Dices, Headphones, HelpCircle, Layers, FolderOpen, Search, Sticker, Trophy, X as XI, Puzzle, Wand2, Type, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/data/store";
import * as api from "@/data/api";
import { PAHELIS, QUIZ } from "@/data/deen";
import { cn } from "@/lib/util";
import { Avatar, Btn, Card, Page, Ring, Row, Toggle, inputCls } from "../ui";

export default function Games() {
  const scores = useStore((s) => s.scores);
  const off = useStore((s) => s.ui.offline);
  const queued = useStore((s) => s.messages.filter((m) => m.status === "queued").length);
  const tiles = [
    { p: "quiz", t: "Deen Quiz", d: "Timer + live scoreboard", i: <Brain />, c: "#2ccf8a", s: scores.quiz },
    { p: "ttt", t: "Tic-Tac-Toe", d: "Dost ke saath khelo", i: <CircleI />, c: "#4cc3ff", s: scores.ttt },
    { p: "paheli", t: "Roz ki Paheli", d: "Pehle jawab do, jeeto", i: <Puzzle />, c: "#e8bd57", s: scores.paheli },
    { p: "rooms", t: "Audio Rooms", d: "Live bayan aur mehfil", i: <Headphones />, c: "#ff6f91" },
    { p: "stickermaker", t: "Sticker banao", d: "Photo ya text se", i: <Wand2 />, c: "#c79bff" },
    { p: "stickerpacks", t: "Sticker packs", d: "Eid, Jummah, Roman Urdu", i: <Sticker />, c: "#ff8a5c" },
    { p: "files", t: "File manager", d: "Photos, videos, docs, audio", i: <FolderOpen />, c: "#5cd6c8" },
    { p: "search", t: "Global search", d: "Messages, files, members", i: <Search />, c: "#9bdc5a" },
  ];
  return (
    <div className="thin h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-4 safe-t">
        <h1 className="mb-1 text-2xl font-black tracking-tight">Khel aur Auzaar</h1><p className="mb-4 text-sm text-mute">Dosto ke saath khelo, banao, dhoondo</p>
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t, i) => (
            <motion.button key={t.p} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileTap={{ scale: 0.96 }} onClick={() => api.go(t.p)} className="relative overflow-hidden rounded-3xl border border-line bg-surface p-4 text-left transition hover:bg-surface2">
              <span className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-15" style={{ background: t.c }} />
              <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl" style={{ background: t.c + "26", color: t.c }}>{t.i}</span>
              <p className="font-extrabold">{t.t}</p><p className="text-xs text-mute">{t.d}</p>{t.s !== undefined && <p className="mt-1.5 text-xs font-bold" style={{ color: t.c }}>Score: {t.s}</p>}
            </motion.button>
          ))}
        </div>
        <Card title="Offline message queue" className="mt-5">
          <Row icon={<WifiOff size={18} />} title="Offline mode (test)" sub={`Net band karke message likho — ${queued} queue me`} right={<Toggle on={off} onChange={(v) => { api.setOffline(v); if (!v) api.flushQueue(); }} />} />
        </Card>
      </div>
    </div>
  );
}

// ───────── I1 quiz ─────────
export function QuizPage() {
  const members = useStore((s) => s.members.filter((m) => m.id !== s.me && m.online && !m.banned).slice(0, 3));
  const meM = useStore((s) => s.members.find((m) => m.id === s.me)!);
  const qs = useMemo(() => [...QUIZ].sort(() => Math.random() - 0.5).slice(0, 6), []);
  const [i, setI] = useState(-1), [sel, setSel] = useState<number | null>(null), [t, setT] = useState(15), [score, setScore] = useState(0);
  const [rivals, setRivals] = useState<Record<string, number>>({});
  const done = i >= qs.length;
  useEffect(() => { if (i < 0 || done || sel !== null) return; const iv = setInterval(() => setT((x) => x - 1), 1000); return () => clearInterval(iv); }, [i, sel, done]);
  useEffect(() => { if (t <= 0 && sel === null && i >= 0 && !done) answer(-1); }, [t]); // eslint-disable-line
  const answer = (k: number) => {
    setSel(k);
    if (k === qs[i].a) setScore((s) => s + 10 + t);
    setRivals((r) => { const n = { ...r }; members.forEach((m) => { if (Math.random() < 0.6) n[m.id] = (n[m.id] ?? 0) + 10 + Math.floor(Math.random() * 10); }); return n; });
    setTimeout(() => { setSel(null); setT(15); setI((x) => x + 1); }, 1300);
  };
  useEffect(() => { if (done) { api.addScore("quiz", score); api.unlock("quiz"); const best = Math.max(0, ...Object.values(rivals)); if (score >= best) api.burstConfetti(); } }, [done]); // eslint-disable-line
  const board = [{ id: "me", name: "Aap", s: score, m: meM }, ...members.map((m) => ({ id: m.id, name: m.name.split(" ")[0], s: rivals[m.id] ?? 0, m }))].sort((a, b) => b.s - a.s);
  const Board = () => <Card title="Live scoreboard">{board.map((b, k) => <div key={b.id} className="flex items-center gap-3 px-4 py-2.5"><span className="w-5 font-black text-gold">{k + 1}</span><Avatar m={b.m} size={30} dot={false} /><span className={cn("flex-1 text-sm font-semibold", b.id === "me" && "text-accent")}>{b.name}</span><motion.span key={b.s} initial={{ scale: 1.5 }} animate={{ scale: 1 }} className="font-black tabular-nums">{b.s}</motion.span></div>)}</Card>;
  return (
    <Page title="Deen Quiz" sub={i >= 0 && !done ? `Sawal ${i + 1}/${qs.length}` : undefined}>
      {i < 0 && <div className="text-center"><div className="mx-auto mb-4 grid h-24 w-24 place-items-center rounded-full bg-accent/15 text-accent"><Brain size={44} /></div><h2 className="text-2xl font-black">Deen ka imtihan</h2><p className="mb-6 text-mute">6 sawal · har sawal 15 second · jaldi jawab = zyada number</p><Btn onClick={() => setI(0)}>Shuru karo</Btn><div className="mt-6 text-left"><Board /></div></div>}
      {i >= 0 && !done && (
        <>
          <div className="mb-4 flex items-center justify-between"><Ring value={t / 15} size={60} stroke={6} color={t <= 5 ? "var(--danger)" : "var(--accent)"}><span className="text-lg font-black tabular-nums">{Math.max(0, t)}</span></Ring><p className="text-lg font-black text-gold">{score} pts</p></div>
          <AnimatePresence mode="wait"><motion.div key={i} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <p className="mb-4 text-xl font-extrabold leading-snug">{qs[i].q}</p>
            <div className="space-y-2.5">{qs[i].o.map((o, k) => { const right = k === qs[i].a; return <motion.button whileTap={{ scale: 0.98 }} key={k} disabled={sel !== null} onClick={() => answer(k)} className={cn("flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left font-semibold transition", sel === null ? "border-line bg-surface hover:bg-surface2" : right ? "border-accent bg-accent/20" : sel === k ? "border-danger bg-danger/15" : "border-line bg-surface opacity-60")}><span className="grid h-7 w-7 place-items-center rounded-full bg-surface2 text-xs font-black">{"ABCD"[k]}</span><span className="flex-1">{o}</span>{sel !== null && right && <Check className="text-accent" />}{sel === k && !right && <XI className="text-danger" />}</motion.button>; })}</div>
          </motion.div></AnimatePresence>
          <div className="mt-5"><Board /></div>
        </>
      )}
      {done && <div className="text-center"><Trophy size={56} className="mx-auto mb-2 text-gold" /><h2 className="text-2xl font-black">{board[0].id === "me" ? "Mubarak! Aap jeet gaye 🎉" : "Shabash! Quiz mukammal"}</h2><p className="mb-5 text-mute">Aapka score: {score}</p><div className="text-left"><Board /></div><div className="flex gap-3"><Btn className="flex-1" onClick={() => { api.postSystem(`🧠 Quiz natija: ${board.map((b, k) => `${k + 1}. ${b.name} (${b.s})`).join(" · ")}`); api.toast("Group me bhej diya", "", "info", 1800); }}>Group me share karo</Btn><Btn variant="ghost" className="flex-1" onClick={() => { api.back(); setTimeout(() => api.go("quiz"), 250); }}>Dobara</Btn></div></div>}
    </Page>
  );
}

// ───────── I2 tic-tac-toe ─────────
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const winner = (b: string[]) => { for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { w: b[l[0]], l }; return null; };
function bestMove(b: string[]) {
  const em = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  const tryW = (p: string) => em.find((i) => { const c = [...b]; c[i] = p; return winner(c)?.w === p; });
  const w = tryW("O") ?? tryW("X"); if (w !== undefined) return w;
  if (Math.random() < 0.25) return em[Math.floor(Math.random() * em.length)];
  return b[4] ? em[Math.floor(Math.random() * em.length)] : 4;
}
export function TttPage() {
  const friends = useStore((s) => s.members.filter((m) => m.id !== s.me && !m.banned));
  const [opp, setOpp] = useState<string>(friends[0]?.id ?? "");
  const [b, setB] = useState<string[]>(Array(9).fill(""));
  const [turn, setTurn] = useState<"X" | "O">("X");
  const [sc, setSc] = useState({ x: 0, o: 0, d: 0 });
  const res = winner(b), full = b.every(Boolean), over = !!res || full;
  const o = friends.find((f) => f.id === opp);
  const counted = useRef(false);
  useEffect(() => { if (turn === "O" && !over) { const t = setTimeout(() => { setB((c) => { const n = [...c]; n[bestMove(c)] = "O"; return n; }); setTurn("X"); }, 650); return () => clearTimeout(t); } }, [turn, over]); // eslint-disable-line
  useEffect(() => { if (over && !counted.current) { counted.current = true; if (res?.w === "X") { setSc((s) => ({ ...s, x: s.x + 1 })); api.addScore("ttt"); api.burstConfetti(); } else if (res?.w === "O") setSc((s) => ({ ...s, o: s.o + 1 })); else setSc((s) => ({ ...s, d: s.d + 1 })); } }, [over]); // eslint-disable-line
  const play = (i: number) => { if (b[i] || over || turn !== "X") return; const n = [...b]; n[i] = "X"; setB(n); setTurn("O"); };
  const reset = () => { setB(Array(9).fill("")); setTurn("X"); counted.current = false; };
  return (
    <Page title="Tic-Tac-Toe">
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-line bg-surface p-3"><div className="text-center"><p className="text-xs text-mute">Aap (X)</p><p className="text-2xl font-black text-accent">{sc.x}</p></div><div className="text-center"><p className="text-xs text-mute">Barabar</p><p className="text-lg font-black">{sc.d}</p></div><div className="flex items-center gap-2 text-center"><div><p className="text-xs text-mute">{o?.name.split(" ")[0]} (O)</p><p className="text-2xl font-black text-gold">{sc.o}</p></div></div></div>
      <select value={opp} onChange={(e) => { setOpp(e.target.value); reset(); }} className={cn(inputCls, "mb-4")}>{friends.map((f) => <option key={f.id} value={f.id}>{f.name} se khelo</option>)}</select>
      <p className="mb-3 text-center font-bold">{over ? (res ? (res.w === "X" ? "Aap jeet gaye! 🎉" : `${o?.name.split(" ")[0]} jeet gaya`) : "Barabar raha 🤝") : turn === "X" ? "Aapki baari" : `${o?.name.split(" ")[0]} soch raha hai…`}</p>
      <div className="mx-auto grid max-w-[320px] grid-cols-3 gap-2.5">{b.map((v, i) => <motion.button whileTap={{ scale: 0.92 }} key={i} onClick={() => play(i)} className={cn("grid aspect-square place-items-center rounded-2xl border text-5xl font-black", res?.l.includes(i) ? "border-gold bg-gold/15" : "border-line bg-surface")}>{v && <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} className={v === "X" ? "text-accent" : "text-gold"}>{v}</motion.span>}</motion.button>)}</div>
      <div className="mt-5 flex gap-3"><Btn className="flex-1" onClick={reset}>{over ? "Dobara khelo" : "Naya khel"}</Btn>{over && <Btn variant="ghost" className="flex-1" onClick={() => api.postSystem(`⭕❌ Tic-tac-toe: Aap ${sc.x} – ${sc.o} ${o?.name.split(" ")[0]}`)}>Group me share</Btn>}</div>
    </Page>
  );
}

// ───────── I3 paheli ─────────
export function PaheliPage() {
  const idx = Math.floor(Date.now() / 864e5) % PAHELIS.length;
  const p = PAHELIS[idx];
  const members = useStore((s) => s.members.filter((m) => m.id !== s.me && m.online && !m.banned));
  const [ans, setAns] = useState(""), [feed, setFeed] = useState<{ id: string; t: string; ok?: boolean }[]>([]), [winnerId, setWinner] = useState<string | null>(null), [hint, setHint] = useState(false);
  const wrongs = ["pata nahi", "dimaag ghoom gaya", "kitab?", "chhat?", "pankha?", "darwaza?", "chai?"];
  useEffect(() => {
    if (winnerId) return;
    const iv = setInterval(() => { setFeed((f) => { const m = members[Math.floor(Math.random() * members.length)]; if (!m) return f; const ok = f.length >= 5 && Math.random() < 0.5; if (ok) setWinner(m.id); return [{ id: m.id, t: ok ? p.a[0] : wrongs[Math.floor(Math.random() * wrongs.length)], ok }, ...f].slice(0, 8); }); }, 2800);
    return () => clearInterval(iv);
  }, [winnerId]); // eslint-disable-line
  useEffect(() => { if (winnerId) { const w = members.find((m) => m.id === winnerId); if (winnerId === "me") { api.addScore("paheli"); api.burstConfetti(); api.postSystem("🧩 Aaj ki paheli: Aap ne sab se pehle hal ki! 🎉"); } else if (w) api.postSystem(`🧩 Aaj ki paheli ka winner: ${w.name}!`); } }, [winnerId]); // eslint-disable-line
  const submit = () => { const a = ans.trim().toLowerCase(); if (!a || winnerId) return; const ok = p.a.includes(a); setFeed((f) => [{ id: "me", t: a, ok }, ...f]); setAns(""); if (ok) setWinner("me"); else api.toast("Galat jawab", "Dobara koshish karo", "info", 1500); };
  const w = winnerId === "me" ? "Aap" : members.find((m) => m.id === winnerId)?.name;
  return (
    <Page title="Roz ki Paheli">
      <div className="mb-4 rounded-3xl border border-gold/40 bg-gradient-to-br from-[#2d2308] to-surface p-5"><p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-gold"><HelpCircle size={15} />Aaj ki paheli</p><p className="text-lg font-bold leading-snug">{p.q}</p>{hint && <p className="mt-3 text-sm text-gold">💡 {p.hint}</p>}</div>
      {winnerId ? <div className="mb-4 rounded-2xl bg-accent/15 p-4 text-center"><Trophy className="mx-auto mb-1 text-gold" /><p className="font-extrabold">{w} ne paheli hal kar di!</p><p className="text-sm text-mute">Jawab: {p.a[0]}</p></div> : (
        <div className="mb-4 flex gap-2"><input value={ans} onChange={(e) => setAns(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Apna jawab likho…" className={inputCls} /><Btn onClick={submit}>Jawab</Btn></div>)}
      {!hint && !winnerId && <button onClick={() => setHint(true)} className="mb-4 text-sm font-semibold text-gold">Ishara chahiye?</button>}
      <Card title="Dosto ke jawab (live)">{feed.length === 0 ? <p className="p-5 text-center text-sm text-mute">Abhi koi jawab nahi…</p> : feed.map((f, k) => { const m = [...members].find((x) => x.id === f.id); return <div key={k} className="flex items-center gap-3 px-4 py-2.5">{f.id === "me" ? <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/20 text-xs font-black text-accent">Aap</span> : <Avatar m={m} size={32} dot={false} />}<span className="flex-1 text-sm">{f.t}</span>{f.ok && <Check className="text-accent" size={18} />}</div>; })}</Card>
    </Page>
  );
}
void Dices; void Layers; void Type;
