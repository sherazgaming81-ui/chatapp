"use client";
import { motion } from "framer-motion";
import { Bell, Check, Hand, Mic, MicOff, Plus, Search, Share2, Trash2, Upload, Radio, LogOut, Moon, Image as ImageIcon, Film, FileText, Headphones, CalendarClock, Sparkles, UserCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/data/store";
import * as api from "@/data/api";
import { BUILTIN_PACKS, photoArt, svgUri } from "@/data/assets";
import { cn, fmtDateTime, fmtDay, fmtSize, resizeImage } from "@/lib/util";
import { Avatar, Btn, Card, Chip, Empty, Field, Page, Row, Seg, Sheet, Toggle, inputCls } from "../ui";
import { VoicePlayer } from "../chat/Voice";
import { msgSnippet } from "../chat/Message";
import type { Message, Room } from "@/data/types";

// ───────── I4 / I5 sticker maker ─────────
function removeBg(img: HTMLImageElement, tol: number, outline: boolean): string {
  const S = 512, k = Math.min(S / img.width, S / img.height), w = Math.round(img.width * k), h = Math.round(img.height * k);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true })!; x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h), px = d.data;
  const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([a, b]) => { const i = (b * w + a) * 4; return [px[i], px[i + 1], px[i + 2]]; });
  const bg = [0, 1, 2].map((ch) => corners.reduce((s, c2) => s + c2[ch], 0) / 4);
  const dist = (i: number) => Math.hypot(px[i] - bg[0], px[i + 1] - bg[1], px[i + 2] - bg[2]);
  const seen = new Uint8Array(w * h), stack: number[] = [];
  const push = (a: number, b: number) => { if (a < 0 || b < 0 || a >= w || b >= h) return; const p = b * w + a; if (seen[p]) return; if (dist(p * 4) > tol) return; seen[p] = 1; stack.push(p); };
  for (let a = 0; a < w; a++) { push(a, 0); push(a, h - 1); } for (let b = 0; b < h; b++) { push(0, b); push(w - 1, b); }
  while (stack.length) { const p = stack.pop()!; const a = p % w, b = (p / w) | 0; push(a + 1, b); push(a - 1, b); push(a, b + 1); push(a, b - 1); }
  for (let p = 0; p < w * h; p++) if (seen[p]) px[p * 4 + 3] = 0;
  x.putImageData(d, 0, 0);
  // bounding box
  let x0 = w, y0 = h, x1 = 0, y1 = 0; for (let p = 0; p < w * h; p++) if (px[p * 4 + 3] > 10) { const a = p % w, b = (p / w) | 0; x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); }
  if (x1 <= x0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, pad = outline ? 14 : 4, fit = Math.min((S - pad * 2) / bw, (S - pad * 2) / bh);
  const out = document.createElement("canvas"); out.width = out.height = S; const o = out.getContext("2d")!;
  const dw = bw * fit, dh = bh * fit, dx = (S - dw) / 2, dy = (S - dh) / 2;
  if (outline) { const t = document.createElement("canvas"); t.width = t.height = S; const tc = t.getContext("2d")!; tc.drawImage(c, x0, y0, bw, bh, dx, dy, dw, dh); tc.globalCompositeOperation = "source-in"; tc.fillStyle = "#fff"; tc.fillRect(0, 0, S, S); for (let a = 0; a < 24; a++) o.drawImage(t, Math.cos((a / 24) * Math.PI * 2) * 9, Math.sin((a / 24) * Math.PI * 2) * 9); }
  o.drawImage(c, x0, y0, bw, bh, dx, dy, dw, dh);
  return out.toDataURL("image/png");
}
const FONTS = [["Impact, Haettenschweiler, sans-serif", "Mota"], ["'Comic Sans MS', 'Comic Neue', cursive", "Mazaaqiya"], ["Georgia, serif", "Classic"], ["'Courier New', monospace", "Typewriter"], ["'Brush Script MT', cursive", "Haath ka"]];
export function StickerMaker() {
  const packs = useStore((s) => s.stickerPacks);
  const [tab, setTab] = useState<"photo" | "text">("photo");
  const [out, setOut] = useState(""), [img, setImg] = useState<HTMLImageElement | null>(null), [tol, setTol] = useState(60), [ol, setOl] = useState(true), [busy, setBusy] = useState(false);
  const [text, setText] = useState("Kya baat hai!"), [font, setFont] = useState(0), [col, setCol] = useState("#ffffff"), [bg, setBg] = useState<"none" | "solid" | "grad">("grad");
  const file = useRef<HTMLInputElement>(null);
  const [pack, setPack] = useState(packs[0]?.id ?? "mine");
  useEffect(() => { if (tab === "photo" && img) { setBusy(true); const t = setTimeout(() => { setOut(removeBg(img, tol, ol)); setBusy(false); }, 30); return () => clearTimeout(t); } }, [img, tol, ol, tab]);
  useEffect(() => {
    if (tab !== "text") return;
    const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d")!;
    if (bg !== "none") { const g = x.createLinearGradient(0, 0, 512, 512); g.addColorStop(0, "#1f9d6b"); g.addColorStop(1, bg === "grad" ? "#2a5fb8" : "#1f9d6b"); x.fillStyle = "#fff"; x.beginPath(); x.roundRect(14, 14, 484, 484, 110); x.fill(); x.fillStyle = g; x.beginPath(); x.roundRect(30, 30, 452, 452, 96); x.fill(); }
    const words = text.split(" "); const lines: string[] = []; let cur = ""; words.forEach((wd) => { if ((cur + " " + wd).trim().length > 10 && cur) { lines.push(cur); cur = wd; } else cur = (cur + " " + wd).trim(); }); lines.push(cur);
    const fs = Math.min(110, 420 / Math.max(...lines.map((l) => l.length), 4) * 1.9); x.font = `900 ${fs}px ${FONTS[font][0]}`; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
    lines.forEach((l, i) => { const y = 256 + (i - (lines.length - 1) / 2) * fs * 1.1; x.lineWidth = fs * 0.2; x.strokeStyle = "#000000aa"; x.strokeText(l, 256, y); x.fillStyle = col; x.fillText(l, 256, y); });
    setOut(c.toDataURL("image/png"));
  }, [tab, text, font, col, bg]);
  const load = (f?: File) => { if (!f) return; const u = URL.createObjectURL(f); const i = new Image(); i.onload = () => setImg(i); i.src = u; };
  return (
    <Page title="Sticker banao">
      <Seg value={tab} onChange={setTab} className="mb-4" options={[{ v: "photo", l: "Photo se" }, { v: "text", l: "Text se" }]} />
      <div className="mb-4 grid h-64 place-items-center overflow-hidden rounded-3xl border border-line" style={{ backgroundImage: "conic-gradient(#2a3a36 25%, #1b2926 0 50%, #2a3a36 0 75%, #1b2926 0)", backgroundSize: "24px 24px" }}>
        {out && (tab === "text" || img) ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={out} alt="sticker" className={cn("h-60 w-60 object-contain", busy && "opacity-50")} /> : <button onClick={() => file.current?.click()} className="flex flex-col items-center gap-2 text-mute"><Upload size={34} /><span className="text-sm font-bold">Photo chuno</span></button>}
      </div>
      {tab === "photo" ? <>
        <div className="mb-3 flex gap-2"><Btn variant="soft" className="flex-1" onClick={() => file.current?.click()}><ImageIcon size={16} />{img ? "Doosri photo" : "Photo chuno"}</Btn></div>
        <Field label={`Background hatane ki taqat: ${tol}`} hint="Barhao agar background baqi reh jaye, ghatao agar cheez kat jaye"><input type="range" min={15} max={160} value={tol} onChange={(e) => setTol(+e.target.value)} className="w-full accent-[var(--accent)]" /></Field>
        <label className="mb-4 flex items-center justify-between rounded-xl bg-surface2 px-4 py-3"><span className="font-medium">Safaid outline</span><Toggle on={ol} onChange={setOl} /></label>
        <input ref={file} hidden type="file" accept="image/*" onChange={(e) => { load(e.target.files?.[0]); e.target.value = ""; }} />
      </> : <>
        <Field label="Text (Urdu/Hinglish)"><input value={text} onChange={(e) => setText(e.target.value)} maxLength={40} className={inputCls} /></Field>
        <div className="noscroll mb-3 flex gap-2 overflow-x-auto">{FONTS.map((f, i) => <Chip key={f[1]} active={font === i} onClick={() => setFont(i)}>{f[1]}</Chip>)}</div>
        <div className="mb-3 flex items-center gap-2">{["#ffffff", "#ffd23f", "#ff6f91", "#2ccf8a", "#4cc3ff", "#000000"].map((c) => <button key={c} onClick={() => setCol(c)} className={cn("h-8 w-8 rounded-full border-2", col === c ? "border-fg" : "border-transparent")} style={{ background: c }} />)}</div>
        <Seg value={bg} onChange={setBg} className="mb-4" options={[{ v: "none", l: "Bina bg" }, { v: "solid", l: "Rang" }, { v: "grad", l: "Gradient" }]} />
      </>}
      <Field label="Kis pack me save karein"><select value={pack} onChange={(e) => setPack(e.target.value)} className={inputCls}>{packs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <div className="grid grid-cols-2 gap-3"><Btn variant="soft" disabled={!out || (tab === "photo" && !img)} onClick={() => { api.saveToPack(pack, out); api.toast("Pack me save ho gaya", "", "info", 1800); }}>Pack me save</Btn><Btn disabled={!out || (tab === "photo" && !img)} onClick={() => { api.saveToPack(pack, out); api.sendMessage({ type: "sticker", src: out }); api.closeAll(); api.setTab("chat"); }}>Group me bhejo</Btn></div>
    </Page>
  );
}

// ───────── I6 packs + I18 I19 I20 ─────────
const card = (t: string, sub: string, a: string, b: string, e: string) => svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><g fill="#fff" opacity=".12"><circle cx="340" cy="60" r="90"/><circle cx="40" cy="270" r="80"/></g><text x="200" y="110" font-size="64" text-anchor="middle">${e}</text><text x="200" y="175" font-size="38" font-weight="900" text-anchor="middle" fill="#fff" font-family="Georgia,serif">${t}</text><text x="200" y="215" font-size="17" text-anchor="middle" fill="#ffffffcc" font-family="system-ui">${sub}</text><text x="200" y="270" font-size="13" text-anchor="middle" fill="#ffffff88" font-family="system-ui">— ChatsApp Madrasa Group</text></svg>`);
const CARDS = [["Jummah Mubarak", "Allah qubool farmaye", "#0f7a58", "#0a2a3a", "🕌"], ["Jummah Mubarak", "Durood shareef zyada padhein", "#8a5a10", "#2a1a05", "🌹"], ["Eid Mubarak", "Taqabbal Allahu minna wa minkum", "#1a7a55", "#c58b1f", "🌙"], ["Ramadan Kareem", "Rehmat aur maghfirat ka mahina", "#2b1a5a", "#0a2a3a", "⭐"]];
export function StickerPacks() {
  const custom = useStore((s) => s.stickerPacks);
  const [open, setOpen] = useState<string | null>(null), [nm, setNm] = useState(""), [mk, setMk] = useState(false);
  const all = [...BUILTIN_PACKS, ...custom];
  const p = all.find((x) => x.id === open);
  const eidLike = open === "eid" || open === "jummah";
  return (
    <Page title="Sticker packs" onBack={open ? () => setOpen(null) : undefined} right={!open ? <Btn small onClick={() => setMk(true)}><Plus size={14} />Nayi pack</Btn> : undefined}>
      {!p ? <>
        <div className="mb-4 overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-[#2d2308] to-[#0e1a2b] p-5 text-[#fff3cf]"><p className="mb-1 flex items-center gap-2 text-lg font-black"><Moon size={18} />Ramadan theme pack</p><p className="mb-3 text-sm opacity-80">Raat ka aasman wallpaper, zafran bubbles, Ramadan mode — ek tap me.</p><Btn variant="gold" small onClick={() => { api.applyRamadanPack(); api.toast("Ramadan pack lag gaya 🌙", "Chat me dekhein", "info"); }}><Sparkles size={15} />Pack lagao</Btn></div>
        <Card title="Packs">{all.map((k) => <Row key={k.id} icon={/* eslint-disable-next-line @next/next/no-img-element */ <img src={k.icon} alt="" className="h-7 w-7" />} title={k.name} sub={`${k.stickers.length} stickers${k.id === "eid" ? " · Eid special" : k.id === "jummah" ? " · Jummah special" : k.custom ? " · meri pack" : ""}`} onClick={() => setOpen(k.id)} />)}</Card>
      </> : <>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-black">{p.name}</h2><div className="flex gap-1.5">{p.custom && <Btn small variant="ghost" onClick={() => { const n = prompt("Nayi naam", p.name); if (n) api.renamePack(p.id, n); }}>Rename</Btn>}<Btn small variant="soft" onClick={async () => { const t = `ChatsApp sticker pack "${p.name}" — ${p.stickers.length} stickers`; try { navigator.share ? await navigator.share({ title: p.name, text: t }) : (await navigator.clipboard.writeText(t), api.toast("Pack ki detail copy", "", "info", 1600)); } catch { /* ignore */ } }}><Share2 size={14} />Share</Btn></div></div>
        <div className="grid grid-cols-4 gap-2 md:grid-cols-5">{p.stickers.map((s, i) => <div key={i} className="group relative"><button onClick={() => { api.sendMessage({ type: "sticker", src: s }); api.addRecentSticker(s); api.closeAll(); api.setTab("chat"); }} className="w-full rounded-xl bg-surface p-1.5 transition active:scale-90">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={s} alt="" className="aspect-square w-full" /></button>{p.custom && <button onClick={() => api.removeSticker(p.id, i)} className="absolute right-1 top-1 hidden rounded-full bg-black/70 p-1 text-white group-hover:block"><Trash2 size={12} /></button>}</div>)}</div>
        {!p.stickers.length && <Empty text="Is pack me abhi sticker nahi. Sticker banao tab se jodein." />}
        {p.custom && <div className="mt-4 flex gap-2"><Btn variant="soft" className="flex-1" onClick={() => api.go("stickermaker")}><Plus size={16} />Sticker banao</Btn><Btn variant="danger" onClick={() => { api.deletePack(p.id); setOpen(null); }}><Trash2 size={16} /></Btn></div>}
        {eidLike && <><h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-mute">Greeting cards</h3><div className="grid grid-cols-2 gap-3">{CARDS.filter((_, i) => (open === "jummah" ? i < 2 : i >= 2)).map(([t, s, a, b, e]) => { const u = card(t, s, a, b, e); return /* eslint-disable-next-line @next/next/no-img-element */ <button key={t + s} onClick={() => { api.sendMessage({ type: "image", src: u, caption: t, size: 40000 }); api.closeAll(); api.setTab("chat"); }} className="overflow-hidden rounded-2xl border border-line"><img src={u} alt={t} className="w-full" /></button>; })}</div></>}
      </>}
      <Sheet open={mk} onClose={() => setMk(false)} title="Nayi sticker pack"><input value={nm} onChange={(e) => setNm(e.target.value)} placeholder="Pack ka naam" className={cn(inputCls, "mb-3")} /><Btn className="w-full" disabled={!nm.trim()} onClick={() => { api.createPack(nm.trim()); setNm(""); setMk(false); }}>Banao</Btn></Sheet>
    </Page>
  );
}

// ───────── I10-12 rooms ─────────
export function RoomsPage() {
  const rooms = useStore((s) => s.rooms), members = useStore((s) => s.members);
  const [mk, setMk] = useState(false), [title, setTitle] = useState(""), [at, setAt] = useState("");
  const live = rooms.filter((r) => r.live), soon = rooms.filter((r) => !r.live);
  return (
    <Page title="Audio rooms" right={<Btn small onClick={() => setMk(true)}><Plus size={14} />Naya room</Btn>}>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-mute">Abhi live</h3>
      {live.length === 0 ? <Empty text="Koi room live nahi" icon={<Headphones size={34} />} /> : live.map((r) => <button key={r.id} onClick={() => api.go("room", { id: r.id })} className="mb-3 flex w-full items-center gap-3 rounded-3xl border border-accent/40 bg-gradient-to-br from-accent/15 to-surface p-4 text-left"><span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-fg"><Radio /><span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-danger" /></span><span className="min-w-0 flex-1"><span className="block truncate font-extrabold">{r.title}</span><span className="text-xs text-mute">Host: {members.find((m) => m.id === r.host)?.name} · {r.speakers.length + r.listeners.length} log</span></span><span className="flex -space-x-2">{r.speakers.slice(0, 3).map((s) => <Avatar key={s} id={s} size={28} dot={false} className="rounded-full ring-2 ring-surface" />)}</span></button>)}
      <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-mute">Aane wale</h3>
      {soon.length === 0 ? <Empty text="Koi room schedule nahi" /> : soon.map((r) => <div key={r.id} className="mb-3 rounded-2xl border border-line bg-surface p-4"><div className="flex items-start gap-3"><CalendarClock className="mt-0.5 text-gold" /><div className="flex-1"><p className="font-extrabold">{r.title}</p><p className="text-xs text-mute">{r.startsAt ? fmtDateTime(r.startsAt) : ""} · Host: {members.find((m) => m.id === r.host)?.name}</p></div></div>
        <div className="mt-3 flex items-center justify-between"><span className="flex items-center gap-2 text-sm"><Bell size={15} className="text-gold" />Yaad dilao</span><Toggle on={!!r.remind} onChange={(v) => { api.patchRoom(r.id, (x) => ({ ...x, remind: v })); api.toast(v ? "Reminder laga diya" : "Reminder hata diya", r.title, "info", 1600); }} /></div>
        {r.host === "me" && <Btn small className="mt-3 w-full" onClick={() => { api.patchRoom(r.id, (x) => ({ ...x, live: true })); api.go("room", { id: r.id }); }}>Abhi shuru karo</Btn>}</div>)}
      <Sheet open={mk} onClose={() => setMk(false)} title="Naya audio room"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Room ka naam (jaise: Raat ki mehfil)" className={cn(inputCls, "mb-3")} /><Field label="Schedule (khali = abhi live)"><input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className={inputCls} /></Field><Btn className="w-full" disabled={!title.trim()} onClick={() => { const t = at ? new Date(at).getTime() : undefined; api.createRoom(title.trim(), t && t > Date.now() ? t : undefined); setMk(false); setTitle(""); setAt(""); }}>{at ? "Schedule karo" : "Live shuru karo"}</Btn></Sheet>
    </Page>
  );
}

export function RoomPage({ id }: { id: string }) {
  const r = useStore((s) => s.rooms.find((x) => x.id === id));
  const meId = useStore((s) => s.me);
  const members = useStore((s) => s.members);
  const [sp, setSp] = useState("");
  useEffect(() => { if (r && !r.speakers.includes(meId) && !r.listeners.includes(meId)) api.patchRoom(id, (x) => ({ ...x, listeners: [...x.listeners, meId] })); }, []); // eslint-disable-line
  useEffect(() => { const i = setInterval(() => { const a = r?.speakers.filter((s) => !r.mutedSp.includes(s)) ?? []; setSp(a.length ? a[Math.floor(Math.random() * a.length)] : ""); }, 1400); return () => clearInterval(i); }, [r?.speakers.length, r?.mutedSp.length]); // eslint-disable-line
  if (!r) return <Page title="Room"><Empty text="Room khatam ho gaya" /></Page>;
  const host = r.host === meId, isSp = r.speakers.includes(meId), raised = r.hands.includes(meId);
  const patch = (f: (x: Room) => Room) => api.patchRoom(id, f);
  const leave = () => { patch((x) => ({ ...x, speakers: x.speakers.filter((s) => s !== meId || host), listeners: x.listeners.filter((s) => s !== meId), hands: x.hands.filter((h) => h !== meId) })); api.back(); };
  return (
    <Page title={r.title} sub={`${r.speakers.length} speakers · ${r.listeners.length} listeners`}>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-mute">Bolne wale</h3>
      <div className="mb-6 grid grid-cols-3 gap-4">{r.speakers.map((s) => { const m = members.find((x) => x.id === s); const muted = r.mutedSp.includes(s); return m ? (
        <div key={s} className="flex flex-col items-center text-center"><motion.div animate={sp === s && !muted ? { boxShadow: ["0 0 0 0 rgba(44,207,138,.7)", "0 0 0 12px rgba(44,207,138,0)"] } : {}} transition={{ repeat: Infinity, duration: 1 }} className="relative rounded-full"><Avatar m={m} size={68} dot={false} />{muted && <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-danger text-white"><MicOff size={12} /></span>}{s === r.host && <span className="absolute -left-1 -top-1 text-lg">👑</span>}</motion.div><p className="mt-1.5 text-xs font-bold">{m.name.split(" ")[0]}</p>
          {(host || s === meId) && <div className="mt-1 flex gap-1"><button onClick={() => patch((x) => ({ ...x, mutedSp: muted ? x.mutedSp.filter((k) => k !== s) : [...x.mutedSp, s] }))} className="rounded-full bg-surface2 p-1.5">{muted ? <Mic size={13} /> : <MicOff size={13} />}</button>{host && s !== meId && <button onClick={() => patch((x) => ({ ...x, speakers: x.speakers.filter((k) => k !== s), listeners: [...x.listeners, s] }))} className="rounded-full bg-surface2 px-2 text-[10px] font-bold">Utaro</button>}</div>}</div>) : null; })}</div>
      {host && r.hands.length > 0 && <Card title={`Haath uthe hue (${r.hands.length})`}>{r.hands.map((h) => { const m = members.find((x) => x.id === h); return m ? <div key={h} className="flex items-center gap-3 px-4 py-2.5"><Avatar m={m} size={34} dot={false} /><span className="flex-1 text-sm font-semibold">{m.name}</span><Btn small onClick={() => patch((x) => ({ ...x, hands: x.hands.filter((k) => k !== h), listeners: x.listeners.filter((k) => k !== h), speakers: [...x.speakers, h] }))}><UserCheck size={14} />Bolne do</Btn></div> : null; })}</Card>}
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-mute">Sunne wale</h3>
      <div className="mb-6 flex flex-wrap gap-3">{r.listeners.map((l) => { const m = members.find((x) => x.id === l); return m ? <div key={l} className="relative flex flex-col items-center"><Avatar m={m} size={46} dot={false} />{r.hands.includes(l) && <span className="absolute -right-1 -top-1 text-base">✋</span>}<p className="mt-1 text-[11px]">{m.name.split(" ")[0]}</p></div> : null; })}</div>
      <div className="sticky bottom-0 flex gap-3 bg-bg/90 py-3 backdrop-blur"><Btn variant="danger" onClick={leave}><LogOut size={16} />Chhodo</Btn>{!isSp && <Btn variant={raised ? "soft" : "primary"} className="flex-1" onClick={() => patch((x) => ({ ...x, hands: raised ? x.hands.filter((h) => h !== meId) : [...x.hands, meId] }))}><Hand size={16} />{raised ? "Haath neecha karo" : "Haath uthao (bolna hai)"}</Btn>}{host && <Btn variant="ghost" onClick={() => { api.endRoom(id); api.back(); }}>Room khatam</Btn>}</div>
    </Page>
  );
}

// ───────── I13 I14 files ─────────
export function FilesPage() {
  const msgs = useStore((s) => s.messages), members = useStore((s) => s.members);
  const [tab, setTab] = useState<"photos" | "videos" | "docs" | "audio">("photos"), [q, setQ] = useState("");
  const live = msgs.filter((m) => !m.deleted);
  const sets = { photos: live.filter((m) => m.type === "image"), videos: live.filter((m) => m.type === "video" || m.type === "videonote"), docs: live.filter((m) => m.type === "doc"), audio: live.filter((m) => m.type === "voice") };
  const match = (m: Message) => { const n = (m.fileName ?? m.caption ?? "") + " " + m.type + " " + fmtDay(m.at) + " " + (members.find((x) => x.id === m.from)?.name ?? ""); return n.toLowerCase().includes(q.toLowerCase()); };
  const list = sets[tab].filter(match);
  return (
    <Page title="File manager">
      <div className="relative mb-3"><Search size={17} className="absolute left-3.5 top-3.5 text-mute" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Naam, type (pdf, photo), tarikh (Kal) ya sender" className={cn(inputCls, "pl-10")} /></div>
      <Seg value={tab} onChange={setTab} className="mb-4" options={[{ v: "photos", l: `Photos ${sets.photos.length}` }, { v: "videos", l: `Video ${sets.videos.length}` }, { v: "docs", l: `Docs ${sets.docs.length}` }, { v: "audio", l: `Audio ${sets.audio.length}` }]} />
      {!list.length ? <Empty text="Kuch nahi mila" icon={<FileText size={34} />} /> : tab === "photos" ? <div className="grid grid-cols-3 gap-1.5">{list.map((m) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={m.id} src={m.src} alt="" className="aspect-square w-full rounded-xl object-cover" />)}</div> : (
        <Card>{list.map((m) => tab === "audio" ? <div key={m.id} className="flex items-center gap-3 px-4 py-3"><VoicePlayer m={m} /><span className="text-xs text-mute">{members.find((x) => x.id === m.from)?.name.split(" ")[0]} · {fmtDay(m.at)}</span></div> : <Row key={m.id} icon={tab === "docs" ? <FileText size={18} /> : <Film size={18} />} title={m.fileName ?? (m.type === "videonote" ? "Video note" : "Video")} sub={`${fmtSize(m.size ?? 0)} · ${fmtDay(m.at)} · ${members.find((x) => x.id === m.from)?.name.split(" ")[0]}`} />)}</Card>)}
    </Page>
  );
}

// ───────── I15 global search ─────────
export function GlobalSearch() {
  const msgs = useStore((s) => s.messages), members = useStore((s) => s.members);
  const [q, setQ] = useState(""), [type, setType] = useState<"sab" | "msgs" | "files" | "members">("sab"), [from, setFrom] = useState(""), [when, setWhen] = useState<"sab" | "aaj" | "hafta" | "mahina">("sab");
  const ql = q.trim().toLowerCase();
  const inWhen = (m: Message) => when === "sab" || Date.now() - m.at < { aaj: 864e5, hafta: 6048e5, mahina: 2592e6 }[when];
  const base = msgs.filter((m) => !m.deleted && m.type !== "system" && (!from || m.from === from) && inWhen(m));
  const rm = ql ? base.filter((m) => ["text", "announcement", "cmd", "image"].includes(m.type) && ((m.text ?? "") + (m.caption ?? "")).toLowerCase().includes(ql)) : [];
  const rf = ql ? base.filter((m) => ["doc", "image", "video", "voice"].includes(m.type) && ((m.fileName ?? "") + " " + (m.caption ?? "") + " " + m.type).toLowerCase().includes(ql)) : [];
  const rmem = ql ? members.filter((m) => (m.name + m.about).toLowerCase().includes(ql)) : [];
  const jump = (id: string) => { api.closeAll(); api.setTab("chat"); setTimeout(() => document.getElementById("m-" + id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 350); };
  return (
    <Page title="Global search">
      <div className="relative mb-3"><Search size={17} className="absolute left-3.5 top-3.5 text-mute" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Messages, files, members…" className={cn(inputCls, "pl-10")} /></div>
      <div className="noscroll mb-2 flex gap-2 overflow-x-auto">{([["sab", "Sab"], ["msgs", "Messages"], ["files", "Files"], ["members", "Members"]] as const).map(([v, l]) => <Chip key={v} active={type === v} onClick={() => setType(v)}>{l}</Chip>)}</div>
      <div className="mb-4 grid grid-cols-2 gap-2"><select value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls}><option value="">Sab senders</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select><select value={when} onChange={(e) => setWhen(e.target.value as typeof when)} className={inputCls}><option value="sab">Kabhi bhi</option><option value="aaj">Aaj</option><option value="hafta">7 din</option><option value="mahina">30 din</option></select></div>
      {!ql ? <Empty text="Kuch likho dhoondne ke liye" icon={<Search size={34} />} /> : <>
        {(type === "sab" || type === "msgs") && <Card title={`Messages (${rm.length})`}>{rm.length ? rm.map((m) => <Row key={m.id} title={<span className="line-clamp-2">{msgSnippet(m)}</span>} sub={`${members.find((x) => x.id === m.from)?.name} · ${fmtDateTime(m.at)}`} onClick={() => jump(m.id)} />) : <p className="p-4 text-center text-sm text-mute">Koi message nahi</p>}</Card>}
        {(type === "sab" || type === "files") && <Card title={`Files (${rf.length})`}>{rf.length ? rf.map((m) => <Row key={m.id} icon={<FileText size={18} />} title={m.fileName ?? m.caption ?? m.type} sub={`${m.type} · ${fmtDay(m.at)}`} onClick={() => jump(m.id)} />) : <p className="p-4 text-center text-sm text-mute">Koi file nahi</p>}</Card>}
        {(type === "sab" || type === "members") && <Card title={`Members (${rmem.length})`}>{rmem.length ? rmem.map((m) => <Row key={m.id} icon={<Avatar m={m} size={32} dot={false} />} title={m.name} sub={m.about} onClick={() => api.go("profile-view", { id: m.id })} />) : <p className="p-4 text-center text-sm text-mute">Koi member nahi</p>}</Card>}
      </>}
    </Page>
  );
}
void Check; void photoArt; void resizeImage;
