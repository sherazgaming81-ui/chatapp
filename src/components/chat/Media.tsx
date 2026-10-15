"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Crop, Image as ImageIcon, PenLine, RefreshCw, Send, Type, Undo2, X, Zap, ZapOff, Circle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn, fmtDateTime } from "@/lib/util";
import { Btn } from "../ui";

export const FILTERS = [
  { id: "none", name: "Asli", css: "none" },
  { id: "noor", name: "Noor", css: "brightness(1.08) contrast(1.1) saturate(1.2)" },
  { id: "sepia", name: "Purana", css: "sepia(.8) contrast(1.05)" },
  { id: "bw", name: "Siyah-Safaid", css: "grayscale(1) contrast(1.15)" },
  { id: "warm", name: "Garam", css: "sepia(.3) saturate(1.5) hue-rotate(-10deg) brightness(1.05)" },
  { id: "cool", name: "Thanda", css: "saturate(1.1) hue-rotate(15deg) brightness(1.02) contrast(1.05)" },
  { id: "fade", name: "Dhundla", css: "contrast(.85) brightness(1.15) saturate(.8)" },
  { id: "vivid", name: "Roshan", css: "saturate(1.9) contrast(1.15)" },
];

// ───────── camera (B2) ─────────
export function Camera({ onCapture, onClose }: { onCapture: (dataUrl: string) => void; onClose: () => void }) {
  const vid = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [flash, setFlash] = useState(false);
  const [filter, setFilter] = useState("none");
  const [err, setErr] = useState(false);
  const [shot, setShot] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let dead = false;
    stream.current?.getTracks().forEach((t) => t.stop());
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 } }, audio: false })
      .then((s) => { if (dead) { s.getTracks().forEach((t) => t.stop()); return; } stream.current = s; if (vid.current) { vid.current.srcObject = s; vid.current.play().catch(() => {}); } setErr(false); })
      .catch(() => setErr(true));
    if (!navigator.mediaDevices) setErr(true);
    return () => { dead = true; stream.current?.getTracks().forEach((t) => t.stop()); };
  }, [facing]);

  useEffect(() => {
    const t = stream.current?.getVideoTracks()[0];
    (t as any)?.applyConstraints?.({ advanced: [{ torch: flash }] }).catch(() => {});
  }, [flash]);

  const capture = () => {
    const v = vid.current; if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    ctx.filter = FILTERS.find((f) => f.id === filter)!.css;
    if (facing === "user") { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0);
    setShot(true); setTimeout(() => setShot(false), 160);
    onCapture(c.toDataURL("image/jpeg", 0.88));
  };
  const pick = (f?: File) => { if (!f) return; const r = new FileReader(); r.onload = () => onCapture(r.result as string); r.readAsDataURL(f); };
  const css = FILTERS.find((f) => f.id === filter)!.css;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[105] flex flex-col bg-black text-white">
      <div className="safe-t flex items-center justify-between px-3 py-3">
        <button onClick={onClose} className="rounded-full bg-white/10 p-2.5"><X size={20} /></button>
        <button onClick={() => setFlash((f) => !f)} className={cn("rounded-full p-2.5", flash ? "bg-[#ffd54a] text-black" : "bg-white/10")}>{flash ? <Zap size={20} /> : <ZapOff size={20} />}</button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {!err ? <video ref={vid} playsInline muted className={cn("h-full w-full object-cover", facing === "user" && "-scale-x-100")} style={{ filter: css }} /> : (
          <div className="grid h-full place-items-center px-8 text-center">
            <div><div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-white/10"><ImageIcon /></div>
              <p className="mb-1 font-semibold">Camera nahi khul saka</p><p className="mb-5 text-sm text-white/60">Permission do ya gallery se photo chuno</p>
              <Btn onClick={() => file.current?.click()}>Gallery se chuno</Btn></div>
          </div>
        )}
        <AnimatePresence>{(shot || (flash && shot)) && <motion.div initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white" />}</AnimatePresence>
      </div>
      <div className="safe-b bg-black/80 pb-3 pt-3">
        <div className="noscroll mb-4 flex gap-3 overflow-x-auto px-4">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className="flex shrink-0 flex-col items-center gap-1">
              <span className={cn("h-12 w-12 rounded-xl border-2", filter === f.id ? "border-accent" : "border-transparent")} style={{ background: "linear-gradient(135deg,#f6b26b,#3d7a64 55%,#1d3a6e)", filter: f.css }} />
              <span className={cn("text-[11px]", filter === f.id ? "text-accent" : "text-white/60")}>{f.name}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-around px-6">
          <button onClick={() => file.current?.click()} className="rounded-full bg-white/10 p-3"><ImageIcon size={22} /></button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={capture} disabled={err} className="grid h-[76px] w-[76px] place-items-center rounded-full border-4 border-white disabled:opacity-40"><span className="h-[58px] w-[58px] rounded-full bg-white" /></motion.button>
          <button onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} className="rounded-full bg-white/10 p-3"><RefreshCw size={22} /></button>
        </div>
      </div>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </motion.div>
  );
}

// ───────── media caption editor (B3) ─────────
type Stroke = { c: string; w: number; pts: [number, number][] };
type TextLayer = { t: string; x: number; y: number; c: string; s: number };
const PEN = ["#ffffff", "#ff4d4d", "#ffd23f", "#2ccf8a", "#4cc3ff", "#c79bff", "#000000"];
const ASPECTS: { id: string; l: string; r: number | null }[] = [{ id: "o", l: "Asli", r: null }, { id: "1", l: "1:1", r: 1 }, { id: "43", l: "4:3", r: 4 / 3 }, { id: "169", l: "16:9", r: 16 / 9 }, { id: "916", l: "9:16", r: 9 / 16 }];

export function MediaEditor({ src, onSend, onClose }: { src: string; onSend: (dataUrl: string, caption: string) => void; onClose: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<"pen" | "text" | "crop" | null>("pen");
  const [color, setColor] = useState(PEN[1]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [texts, setTexts] = useState<TextLayer[]>([]);
  const [asp, setAsp] = useState("o");
  const [caption, setCaption] = useState("");
  const [draft, setDraft] = useState("");
  const cur = useRef<Stroke | null>(null);
  const dragT = useRef<number>(-1);

  useEffect(() => { const i = new Image(); i.onload = () => setImg(i); i.src = src; }, [src]);

  const dims = useCallback(() => {
    if (!img) return { w: 0, h: 0, sx: 0, sy: 0, sw: 0, sh: 0 };
    const r = ASPECTS.find((a) => a.id === asp)!.r ?? img.width / img.height;
    let sw = img.width, sh = img.width / r;
    if (sh > img.height) { sh = img.height; sw = img.height * r; }
    const k = Math.min(1, 1280 / Math.max(sw, sh));
    return { w: Math.round(sw * k), h: Math.round(sh * k), sx: (img.width - sw) / 2, sy: (img.height - sh) / 2, sw, sh };
  }, [img, asp]);

  const draw = useCallback(() => {
    const c = cv.current; if (!c || !img) return;
    const d = dims(); c.width = d.w; c.height = d.h;
    const x = c.getContext("2d")!;
    x.drawImage(img, d.sx, d.sy, d.sw, d.sh, 0, 0, d.w, d.h);
    x.lineCap = "round"; x.lineJoin = "round";
    strokes.forEach((s) => { x.strokeStyle = s.c; x.lineWidth = s.w * d.w; x.beginPath(); s.pts.forEach(([px, py], i) => (i ? x.lineTo(px * d.w, py * d.h) : x.moveTo(px * d.w, py * d.h))); if (s.pts.length === 1) x.lineTo(s.pts[0][0] * d.w + 0.1, s.pts[0][1] * d.h); x.stroke(); });
    texts.forEach((t) => { x.font = `800 ${t.s * d.w}px system-ui,sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.lineWidth = t.s * d.w * 0.14; x.strokeStyle = "rgba(0,0,0,.7)"; x.strokeText(t.t, t.x * d.w, t.y * d.h); x.fillStyle = t.c; x.fillText(t.t, t.x * d.w, t.y * d.h); });
  }, [img, dims, strokes, texts]);
  useEffect(draw, [draw]);

  const pt = (e: React.PointerEvent): [number, number] => { const r = cv.current!.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  const down = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = pt(e);
    if (tool === "pen") { cur.current = { c: color, w: 0.008, pts: [p] }; setStrokes((s) => [...s, cur.current!]); }
    else if (tool === "text") { const i = texts.findIndex((t) => Math.hypot(t.x - p[0], t.y - p[1]) < 0.12); dragT.current = i; }
  };
  const move = (e: React.PointerEvent) => {
    const p = pt(e);
    if (tool === "pen" && cur.current) { cur.current.pts.push(p); setStrokes((s) => [...s]); }
    else if (tool === "text" && dragT.current >= 0) setTexts((ts) => ts.map((t, i) => (i === dragT.current ? { ...t, x: p[0], y: p[1] } : t)));
  };
  const up = () => { cur.current = null; dragT.current = -1; };
  const addText = () => { if (!draft.trim()) return; setTexts((t) => [...t, { t: draft.trim(), x: 0.5, y: 0.5, c: color, s: 0.07 }]); setDraft(""); };
  const undo = () => { if (tool === "text" && texts.length) setTexts((t) => t.slice(0, -1)); else setStrokes((s) => s.slice(0, -1)); };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[108] flex flex-col bg-[#0a0a0a] text-white">
      <div className="safe-t flex items-center gap-1 px-2 py-2.5">
        <button onClick={onClose} className="rounded-full p-2.5 hover:bg-white/10"><X size={22} /></button>
        <div className="flex-1" />
        {([["pen", PenLine], ["text", Type], ["crop", Crop]] as const).map(([k, I]) => <button key={k} onClick={() => setTool(tool === k ? null : k)} className={cn("rounded-full p-2.5", tool === k ? "bg-accent text-accent-fg" : "hover:bg-white/10")}><I size={20} /></button>)}
        <button onClick={undo} className="rounded-full p-2.5 hover:bg-white/10"><Undo2 size={20} /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-2">
        <canvas ref={cv} onPointerDown={down} onPointerMove={move} onPointerUp={up} className="max-h-full max-w-full touch-none rounded-lg shadow-2xl" style={{ cursor: tool === "pen" ? "crosshair" : "default" }} />
      </div>
      <div className="px-3">
        {(tool === "pen" || tool === "text") && (
          <div className="mb-2 flex items-center justify-center gap-2.5">
            {PEN.map((c) => <button key={c} onClick={() => setColor(c)} className={cn("h-7 w-7 rounded-full border-2 transition", color === c ? "scale-125 border-white" : "border-white/30")} style={{ background: c }} />)}
          </div>
        )}
        {tool === "text" && (
          <div className="mb-2 flex gap-2"><input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addText()} placeholder="Photo par likho…" className="flex-1 rounded-full bg-white/10 px-4 py-2 text-sm outline-none" /><Btn small onClick={addText}>Lagao</Btn></div>
        )}
        {tool === "crop" && <div className="mb-2 flex justify-center gap-2">{ASPECTS.map((a) => <button key={a.id} onClick={() => setAsp(a.id)} className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold", asp === a.id ? "bg-accent text-accent-fg" : "bg-white/10")}>{a.l}</button>)}</div>}
      </div>
      <div className="safe-b flex items-center gap-2 px-3 pb-3 pt-1">
        <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption likho…" className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-3 text-[15px] outline-none placeholder:text-white/50" />
        <button onClick={() => cv.current && onSend(cv.current.toDataURL("image/jpeg", 0.86), caption)} className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-fg"><Send size={20} /></button>
      </div>
    </motion.div>
  );
}

// ───────── full-screen viewer (A7) ─────────
export interface ViewItem { id: string; src: string; kind: "image" | "video"; caption?: string; from?: string; at?: number }
export function MediaViewer({ items, index, onClose }: { items: ViewItem[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  const [z, setZ] = useState({ s: 1, x: 0, y: 0 });
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef({ d: 0, s: 1, x: 0, y: 0, px: 0, py: 0 });
  const lastTap = useRef(0);
  const it = items[i];
  const go = useCallback((d: number) => { setI((v) => Math.max(0, Math.min(items.length - 1, v + d))); setZ({ s: 1, x: 0, y: 0 }); }, [items.length]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [go, onClose]);
  const dist = () => { const a = [...pts.current.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };
  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start.current = { d: pts.current.size === 2 ? dist() : 0, s: z.s, x: z.x, y: z.y, px: e.clientX, py: e.clientY };
    const now = Date.now(); if (now - lastTap.current < 280 && pts.current.size === 1) setZ((v) => (v.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 })); lastTap.current = now;
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2 && start.current.d) { setZ((v) => ({ ...v, s: Math.max(1, Math.min(6, start.current.s * (dist() / start.current.d))) })); return; }
    const dx = e.clientX - start.current.px, dy = e.clientY - start.current.py;
    if (z.s > 1) setZ((v) => ({ ...v, x: start.current.x + dx, y: start.current.y + dy }));
    else setDrag({ x: dx, y: dy });
  };
  const onUp = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId);
    if (z.s === 1 && !pts.current.size) {
      if (drag.y > 110) onClose(); else if (drag.x < -80) go(1); else if (drag.x > 80) go(-1);
      setDrag({ x: 0, y: 0 });
    }
    if (z.s < 1.05) setZ({ s: 1, x: 0, y: 0 });
  };
  if (!it) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[115] flex flex-col bg-black text-white" style={{ backgroundColor: `rgba(0,0,0,${1 - Math.min(0.6, Math.abs(drag.y) / 400)})` }}>
      <div className="safe-t absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-3 py-3">
        <button onClick={onClose} className="rounded-full bg-white/10 p-2.5"><X size={22} /></button>
        <div className="text-center text-xs text-white/70">{it.at ? fmtDateTime(it.at) : ""}<br />{i + 1} / {items.length}</div>
        <span className="w-10" />
      </div>
      <div className="relative flex-1 touch-none select-none overflow-hidden" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onWheel={(e) => setZ((v) => { const s = Math.max(1, Math.min(6, v.s * (e.deltaY < 0 ? 1.15 : 0.87))); return s === 1 ? { s, x: 0, y: 0 } : { ...v, s }; })}>
        <div className="grid h-full w-full place-items-center" style={{ transform: `translate(${z.s > 1 ? z.x : drag.x}px, ${z.s > 1 ? z.y : drag.y}px) scale(${z.s})`, transition: pts.current.size ? "none" : "transform .25s ease" }}>
          {it.kind === "video" ? <video src={it.src} controls autoPlay playsInline className="max-h-full max-w-full" onPointerDown={(e) => e.stopPropagation()} /> :
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.src} alt="" draggable={false} className="max-h-full max-w-full object-contain" />}
        </div>
        {i > 0 && <button onClick={() => go(-1)} className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 md:block"><ChevronLeft /></button>}
        {i < items.length - 1 && <button onClick={() => go(1)} className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 md:block"><ChevronRight /></button>}
      </div>
      {it.caption && <div className="safe-b bg-gradient-to-t from-black/80 to-transparent px-5 pb-5 pt-6 text-center text-[15px]">{it.caption}</div>}
    </motion.div>
  );
}
void Circle;
