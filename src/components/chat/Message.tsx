"use client";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { Check, CheckCheck, Clock, Copy, Download, FileText, Forward, Info, Megaphone, MapPin, MoreHorizontal, Pencil, Pin, Reply, SmilePlus, Star, Timer, Trash2, X, Play, ExternalLink, Phone } from "lucide-react";
import { createContext, memo, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Message } from "@/data/types";
import { useStore } from "@/data/store";
import { canEdit, displayName, forwardMessage, isStaff, markDownloaded, me, react, toast, toggleStar, togglePin, votePoll, closePoll, getLinkPreview, deleteMessage } from "@/data/api";
import { GIFS, QUICK_REACTIONS } from "@/data/assets";
import { URL_RE, cn, fmtDateTime, fmtSize, fmtTime, highlight, haptic } from "@/lib/util";
import { Avatar, Btn, Sheet, useIsDesktop } from "../ui";
import { VideoNoteBubble, VoicePlayer } from "./Voice";
import { MapArt } from "./Attach";

export interface ChatCtx {
  query: string; currentId: string | null; mountedAt: number; dying: Set<string>;
  reply(m: Message): void; edit(m: Message): void; info(m: Message): void; forward(m: Message): void;
  menu(m: Message): void; view(m: Message): void; loc(l: NonNullable<Message["loc"]>): void; contact(c: NonNullable<Message["contact"]>): void;
  profile(id: string): void; jump(id: string): void; remove(m: Message, all: boolean): void;
}
export const ChatContext = createContext<ChatCtx>(null as unknown as ChatCtx);

export function Ticks({ status }: { status: Message["status"] }) {
  if (status === "queued") return <Clock size={13} className="opacity-70" />;
  const col = status === "read" ? "#53bdeb" : "currentColor";
  return (
    <span key={status} className="tick-pop inline-flex" style={{ color: col, opacity: status === "read" ? 1 : 0.7 }}>
      {status === "sent" ? <Check size={15} /> : <CheckCheck size={15} />}
    </span>
  );
}

function Rich({ text, query, cur }: { text: string; query: string; cur: boolean }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all text-[#53bdeb] underline underline-offset-2" onClick={(e) => e.stopPropagation()}>{p}</a>
          : highlight(p, query).map((h, k) => (h.h ? <mark key={i + "-" + k} className={cn("hl", cur && "cur")}>{h.t}</mark> : <span key={i + "-" + k}>{h.t}</span>))
      )}
    </>
  );
}

function LinkCard({ url }: { url: string }) {
  const p = getLinkPreview(url);
  return (
    <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="mt-1.5 block overflow-hidden rounded-xl bg-black/20 transition hover:bg-black/30">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.img} alt="" className="h-28 w-full object-cover" />
      <div className="px-3 py-2"><p className="truncate text-[11px] uppercase tracking-wide opacity-60">{p.host}</p><p className="truncate text-sm font-bold">{p.title}</p><p className="line-clamp-2 text-xs opacity-75">{p.desc}</p></div>
    </a>
  );
}

function DownloadRing({ m }: { m: Message }) {
  const [p, setP] = useState<number | null>(null);
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (iv.current) clearInterval(iv.current); }, []);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (p !== null) { if (iv.current) clearInterval(iv.current); setP(null); toast("Download radd", "", "info", 1800); return; }
    let v = 2; setP(v);
    iv.current = setInterval(() => { v += 3 + Math.random() * 7; if (v >= 100) { if (iv.current) clearInterval(iv.current); markDownloaded(m.id); } else setP(v); }, 140);
  };
  const C = 2 * Math.PI * 22;
  return (
    <button onClick={toggle} className="absolute inset-0 grid place-items-center bg-black/35 backdrop-blur-md">
      <span className="relative grid h-14 w-14 place-items-center rounded-full bg-black/55 text-white">
        {p !== null && <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56"><circle cx="28" cy="28" r="22" fill="none" stroke="#ffffff33" strokeWidth="3" /><circle cx="28" cy="28" r="22" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - p / 100)} /></svg>}
        {p === null ? <Download size={22} /> : <X size={20} />}
      </span>
      {p === null && m.size && <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">{fmtSize(m.size)}</span>}
    </button>
  );
}

function PollCard({ m }: { m: Message }) {
  const p = m.poll!;
  const members = useStore((s) => s.members);
  const meId = useStore((s) => s.me);
  const total = Object.values(p.votes).length;
  const [, tick] = useState(0);
  useEffect(() => { if (!p.closesAt || p.closed) return; const i = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(i); }, [p.closesAt, p.closed]);
  const left = p.closesAt ? Math.max(0, p.closesAt - Date.now()) : 0;
  const lbl = p.closed ? "Band ho gaya" : p.closesAt ? `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")} baqi` : "Khula hai";
  return (
    <div className="w-[270px] max-w-full">
      <p className="mb-2.5 text-[15px] font-bold leading-snug">{p.q}</p>
      <div className="space-y-1.5">
        {p.options.map((o) => {
          const voters = Object.entries(p.votes).filter(([, v]) => v.includes(o.id)).map(([u]) => u);
          const pct = total ? Math.round((voters.length / total) * 100) : 0;
          const mine = p.votes[meId]?.includes(o.id);
          return (
            <button key={o.id} disabled={p.closed} onClick={() => { votePoll(m.id, o.id); haptic(8); }} className="relative block w-full overflow-hidden rounded-xl bg-black/20 text-left">
              <motion.span className={cn("absolute inset-y-0 left-0", mine ? "bg-accent/45" : "bg-white/15")} initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 140, damping: 20 }} />
              <span className="relative flex items-center gap-2.5 px-3 py-2.5">
                <span className={cn("grid h-5 w-5 shrink-0 place-items-center border-2", p.multi ? "rounded-md" : "rounded-full", mine ? "border-accent bg-accent text-accent-fg" : "border-current opacity-60")}>{mine && <Check size={12} strokeWidth={4} />}</span>
                {o.img && /* eslint-disable-next-line @next/next/no-img-element */ <img src={o.img} alt="" className="h-9 w-9 rounded-lg object-cover" />}
                <span className="min-w-0 flex-1 text-sm font-medium">{o.text}</span>
                {!p.anonymous && voters.length > 0 && <span className="flex -space-x-1.5">{voters.slice(0, 3).map((v) => <Avatar key={v} m={members.find((x) => x.id === v)} size={16} dot={false} className="ring-1 ring-black/30 rounded-full" />)}</span>}
                <span className="w-9 text-right text-sm font-bold tabular-nums">{pct}%</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] opacity-75">
        <span>{total} vote · {p.anonymous ? "Gumnaam" : "Khula"}{p.multi ? " · Multi" : ""}</span><span className="flex items-center gap-1"><Timer size={11} />{lbl}</span>
      </div>
      {!p.closed && m.from === meId && <button onClick={() => closePoll(m.id)} className="mt-2 w-full rounded-lg bg-black/25 py-1.5 text-xs font-bold">Poll band karo</button>}
    </div>
  );
}

function Quote({ id }: { id: string }) {
  const q = useStore((s) => s.messages.find((m) => m.id === id));
  const sender = useStore((s) => s.members.find((m) => m.id === q?.from));
  const ctx = useContext(ChatContext);
  if (!q) return null;
  const txt = q.deleted ? "Ye message delete ho gaya" : q.text || q.caption || (({ image: "📷 Photo", voice: "🎙️ Voice note", sticker: "Sticker", gif: "GIF", video: "🎬 Video", doc: "📄 " + (q.fileName ?? "Document"), location: "📍 Location", contact: "👤 Contact", poll: "📊 " + (q.poll?.q ?? "Poll"), videonote: "⭕ Video note" } as Record<string, string>)[q.type] ?? "Message");
  return (
    <button onClick={(e) => { e.stopPropagation(); ctx.jump(id); }} className="mb-1.5 block w-full overflow-hidden rounded-lg bg-black/20 text-left" style={{ borderLeft: `3px solid ${sender?.color ?? "var(--accent)"}` }}>
      <span className="block px-2.5 py-1"><span className="block text-xs font-bold" style={{ color: sender?.color }}>{displayName(sender)}</span><span className="line-clamp-2 text-[13px] opacity-80">{txt}</span></span>
    </button>
  );
}

export const msgSnippet = (m: Message) => m.text || m.caption || ({ image: "📷 Photo", voice: "🎙️ Voice note", sticker: "Sticker", gif: "GIF", video: "🎬 Video", doc: "📄 " + (m.fileName ?? "Document"), location: "📍 Location", contact: "👤 Contact", poll: "📊 Poll", videonote: "⭕ Video note" } as Record<string, string>)[m.type] || "Message";

function Meta({ m, mine, overlay }: { m: Message; mine: boolean; overlay?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap align-bottom text-[11px] opacity-80", overlay && "rounded-full bg-black/55 px-1.5 py-0.5 text-white opacity-100")}>
      {m.expiresAt && <Timer size={11} />}{m.pinned && <Pin size={11} />}{m.starred && <Star size={11} fill="currentColor" />}
      {m.edited && <span className="italic">edited</span>}
      {fmtTime(m.at)}
      {mine && <Ticks status={m.status} />}
    </span>
  );
}

function Body({ m, mine, ctx }: { m: Message; mine: boolean; ctx: ChatCtx }) {
  const cur = ctx.currentId === m.id;
  const url = m.text?.match(URL_RE)?.[0];
  switch (m.type) {
    case "text":
    case "cmd":
      return (
        <div className="whitespace-pre-wrap break-words text-[15px] leading-[1.4]">
          {m.type === "cmd" && <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-accent">/{m.cmd}</p>}
          <Rich text={m.text ?? ""} query={ctx.query} cur={cur} />
          <span className="float-right ml-3 mt-1.5"><Meta m={m} mine={mine} /></span>
          {url && <div className="clear-both"><LinkCard url={url} /></div>}
        </div>
      );
    case "image":
    case "video":
      return (
        <div className="w-[250px] max-w-full">
          <div className="relative overflow-hidden rounded-xl bg-black/30">
            {m.type === "image" ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.src} alt="" draggable={false} className={cn("aspect-[4/3] w-full cursor-zoom-in object-cover transition", !m.downloaded && "scale-110 blur-xl")} onClick={() => m.downloaded && ctx.view(m)} />
              : <button onClick={() => ctx.view(m)} className="relative block aspect-video w-full bg-black"><video src={m.src} preload="metadata" className="h-full w-full object-cover" /><span className="absolute inset-0 grid place-items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-black/60 text-white"><Play fill="white" size={22} /></span></span></button>}
            {!m.downloaded && <DownloadRing m={m} />}
            {!m.caption && <span className="absolute bottom-1.5 right-1.5"><Meta m={m} mine={mine} overlay /></span>}
          </div>
          {m.caption && <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-snug"><Rich text={m.caption} query={ctx.query} cur={cur} /><span className="float-right ml-3 mt-1"><Meta m={m} mine={mine} /></span></p>}
        </div>
      );
    case "doc":
      return (
        <div className="w-[250px] max-w-full">
          <button onClick={() => toast("Download", `${m.fileName} download ho rahi hai…`, "info", 2000)} className="flex w-full items-center gap-3 rounded-xl bg-black/20 p-2.5 text-left">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#e0584a] text-white"><FileText size={22} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{m.fileName}</span><span className="text-xs opacity-70">{fmtSize(m.size ?? 0)} · {(m.fileName?.split(".").pop() ?? "file").toUpperCase()}</span></span>
            <Download size={18} className="opacity-70" />
          </button>
          <div className="mt-1 text-right"><Meta m={m} mine={mine} /></div>
        </div>
      );
    case "voice": return (<div><VoicePlayer m={m} mine={mine} /><div className="text-right"><Meta m={m} mine={mine} /></div></div>);
    case "videonote": return (<div className="relative"><VideoNoteBubble m={m} /><span className="absolute bottom-1 right-1"><Meta m={m} mine={mine} overlay /></span></div>);
    case "location":
      return (
        <div className="w-[250px] max-w-full">
          <button onClick={() => ctx.loc(m.loc!)} className="block w-full overflow-hidden rounded-xl text-left">
            <div className="h-28"><MapArt /></div>
            <div className="flex items-center gap-2 bg-black/20 px-3 py-2"><MapPin size={16} className="text-[#ff5a4d]" /><span className="truncate text-sm font-semibold">{m.loc!.label}</span></div>
          </button>
          <div className="mt-1 text-right"><Meta m={m} mine={mine} /></div>
        </div>
      );
    case "contact":
      return (
        <div className="w-[240px] max-w-full">
          <button onClick={() => ctx.contact(m.contact!)} className="flex w-full items-center gap-3 rounded-xl bg-black/20 p-3 text-left">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-lg font-bold text-accent-fg">{m.contact!.name[0]}</span>
            <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{m.contact!.name}</span><span className="flex items-center gap-1 text-xs opacity-70"><Phone size={11} />{m.contact!.phone}</span></span>
          </button>
          <div className="mt-1 text-right"><Meta m={m} mine={mine} /></div>
        </div>
      );
    case "poll": return (<div><PollCard m={m} /><div className="text-right"><Meta m={m} mine={mine} /></div></div>);
    default: return null;
  }
}

function MenuList({ actions, onDone, dense }: { actions: Action[]; onDone: () => void; dense?: boolean }) {
  return (
    <>
      {actions.map((a) => (
        <button key={a.k} onClick={() => { onDone(); a.run(); }} className={cn("flex w-full items-center gap-3 px-4 text-left transition hover:bg-surface2", dense ? "py-2 text-sm" : "py-3 text-[15px]", a.danger && "text-danger")}>
          <span className={a.danger ? "" : "text-mute"}>{a.icon}</span>{a.label}
        </button>
      ))}
    </>
  );
}
interface Action { k: string; label: string; icon: ReactNode; danger?: boolean; run: () => void }

export function buildActions(m: Message, ctx: ChatCtx, openReact?: () => void): Action[] {
  const mine = m.from === me().id;
  const text = m.text || m.caption;
  const a: Action[] = [{ k: "reply", label: "Reply", icon: <Reply size={18} />, run: () => ctx.reply(m) }];
  if (openReact) a.push({ k: "react", label: "React", icon: <SmilePlus size={18} />, run: openReact });
  a.push({ k: "fwd", label: "Forward", icon: <Forward size={18} />, run: () => ctx.forward(m) });
  a.push({ k: "star", label: m.starred ? "Unstar" : "Star", icon: <Star size={18} />, run: () => toggleStar(m.id) });
  if (text) a.push({ k: "copy", label: "Copy", icon: <Copy size={18} />, run: () => { navigator.clipboard?.writeText(text); toast("Copy ho gaya", "", "info", 1600); } });
  if (canEdit(m)) a.push({ k: "edit", label: "Edit (15 min tak)", icon: <Pencil size={18} />, run: () => ctx.edit(m) });
  if (isStaff(me())) a.push({ k: "pin", label: m.pinned ? "Unpin" : "Pin", icon: <Pin size={18} />, run: () => togglePin(m.id) });
  if (mine) a.push({ k: "info", label: "Info", icon: <Info size={18} />, run: () => ctx.info(m) });
  a.push({ k: "del", label: "Delete", icon: <Trash2 size={18} />, danger: true, run: () => ctx.menu({ ...m, id: "del:" + m.id }) });
  return a;
}

/** A4 mobile: WhatsApp-style bottom action sheet */
export function ActionSheet({ m, onClose }: { m: Message | null; onClose: () => void }) {
  const ctx = useContext(ChatContext);
  const [reacting, setReacting] = useState(false);
  const isDel = m?.id.startsWith("del:");
  const real = m ? (isDel ? { ...m, id: m.id.slice(4) } : m) : null;
  useEffect(() => { if (!m) setReacting(false); }, [m]);
  const mine = real?.from === me().id;
  return (
    <Sheet open={!!m} onClose={onClose} noPad>
      {real && !isDel && (
        <div className="pb-3">
          <div className="flex justify-around px-3 py-3">
            {QUICK_REACTIONS.map((e) => <motion.button key={e} whileTap={{ scale: 1.4 }} onClick={() => { react(real.id, e); haptic(10); onClose(); }} className="grid h-11 w-11 place-items-center rounded-full bg-surface2 text-2xl">{e}</motion.button>)}
          </div>
          <div className="mx-4 mb-2 truncate rounded-xl bg-surface2 px-3 py-2 text-sm text-mute">{msgSnippet(real)}</div>
          <MenuList actions={buildActions(real, ctx)} onDone={onClose} />
        </div>
      )}
      {real && isDel && (
        <div className="pb-4">
          <p className="px-5 pb-3 pt-1 font-bold">Message delete karein?</p>
          <MenuList onDone={onClose} actions={[
            { k: "me", label: "Mere liye delete", icon: <Trash2 size={18} />, run: () => ctx.remove(real, false) },
            ...(mine || isStaff(me()) ? [{ k: "all", label: "Sab ke liye delete", icon: <Trash2 size={18} />, danger: true, run: () => ctx.remove(real, true) }] : []),
          ]} />
          <button onClick={onClose} className="w-full px-4 py-3 text-left text-[15px] text-mute">Raho, rehne do</button>
        </div>
      )}
    </Sheet>
  );
}

function DesktopMenu({ m, anchor, onClose }: { m: Message; anchor: DOMRect; onClose: () => void }) {
  const ctx = useContext(ChatContext);
  const [del, setDel] = useState(false);
  const mine = m.from === me().id;
  const h = 360;
  const top = anchor.bottom + h > window.innerHeight ? Math.max(8, anchor.top - h) : anchor.bottom + 6;
  const left = Math.min(window.innerWidth - 220, Math.max(8, anchor.right - 208));
  const acts = buildActions(m, { ...ctx, menu: () => setDel(true) });
  return (
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="fixed z-[71] w-52 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-2xl" style={{ top, left }}>
        {!del ? <MenuList dense actions={acts.filter((x) => x.k !== "del")} onDone={onClose} /> : null}
        {!del && <div className="my-1 h-px bg-line" />}
        {!del ? <button onClick={() => setDel(true)} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-danger hover:bg-surface2"><Trash2 size={17} />Delete</button> : (
          <>
            <MenuList dense onDone={onClose} actions={[{ k: "me", label: "Mere liye delete", icon: <Trash2 size={17} />, run: () => ctx.remove(m, false) }, ...(mine || isStaff(me()) ? [{ k: "all", label: "Sab ke liye delete", icon: <Trash2 size={17} />, danger: true, run: () => ctx.remove(m, true) }] : [])]} />
            <button onClick={onClose} className="w-full px-4 py-2 text-left text-sm text-mute hover:bg-surface2">Raho</button>
          </>
        )}
      </motion.div>
    </>
  );
}

export const MessageItem = memo(function MessageItem({ m, showHead, compact, isNew }: { m: Message; showHead: boolean; compact: boolean; isNew: boolean }) {
  const ctx = useContext(ChatContext);
  const desktop = useIsDesktop();
  const sender = useStore((s) => s.members.find((x) => x.id === m.from));
  const meId = useStore((s) => s.me);
  const nick = useStore((s) => s.settings.nickname);
  const mine = m.from === meId;
  const x = useMotionValue(0);
  const iconOp = useTransform(x, [0, 50], [0, 1]);
  const iconSc = useTransform(x, [0, 60], [0.5, 1.15]);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pos = useRef<[number, number]>([0, 0]);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const dying = ctx.dying.has(m.id);
  const isCur = ctx.currentId === m.id;

  if (m.type === "system" || m.deleted) {
    return (
      <div id={"m-" + m.id} className="my-2 flex justify-center px-6">
        <span className="rounded-full bg-black/35 px-3.5 py-1 text-center text-xs text-white/85 backdrop-blur">{m.deleted && m.type !== "system" ? <span className="italic">🚫 Ye message delete kar diya gaya</span> : m.deleted ? <span className="italic">🛡️ Auto-mod ne ek message hata diya</span> : m.text}</span>
      </div>
    );
  }

  const bare = m.type === "sticker" || m.type === "gif" || m.type === "videonote";
  const isAnn = m.type === "announcement";
  const name = mine ? (nick || "Aap") : displayName(sender);
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    pos.current = [e.clientX, e.clientY];
    press.current = setTimeout(() => { haptic(18); ctx.menu(m); }, 430);
  };
  const cancel = () => { if (press.current) clearTimeout(press.current); press.current = null; };
  const onMove = (e: React.PointerEvent) => { if (Math.hypot(e.clientX - pos.current[0], e.clientY - pos.current[1]) > 9) cancel(); };

  const gifUrl = m.type === "gif" ? (m.src?.startsWith("gif:") ? GIFS[+m.src.slice(4)]?.url : GIFS.find((g) => g.id === m.src)?.url ?? m.src) : null;

  return (
    <motion.div id={"m-" + m.id}
      initial={isNew ? { opacity: 0, scale: 0.6, y: 36, x: mine ? 30 : -30 } : false}
      animate={dying ? { opacity: 0, scale: 0.5, height: 0, marginTop: 0, marginBottom: 0 } : { opacity: 1, scale: 1, y: 0, x: 0 }}
      transition={dying ? { duration: 0.32, ease: "easeIn" } : { type: "spring", stiffness: 430, damping: 17, mass: 0.9 }}
      style={{ transformOrigin: mine ? "bottom right" : "bottom left", overflow: dying ? "hidden" : "visible" }}
      className={cn("group relative flex px-2.5 md:px-6", mine ? "justify-end" : "justify-start", compact ? (showHead ? "mt-1.5" : "mt-px") : (showHead ? "mt-3" : "mt-1"))}>
      {isCur && <span className="pointer-events-none absolute inset-x-0 inset-y-0 bg-yellow-300/10" />}
      {/* swipe reply icon */}
      {!desktop && <motion.span style={{ opacity: iconOp, scale: iconSc }} className="absolute left-5 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white"><Reply size={16} /></motion.span>}
      <motion.div className={cn("relative flex max-w-[86%] items-end gap-1.5 md:max-w-[66%]", mine && "flex-row-reverse")}
        drag={desktop ? false : "x"} dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0, right: 0.35 }} dragSnapToOrigin style={{ x }}
        onDragEnd={(_, i) => { if (i.offset.x > 58) { haptic(12); ctx.reply(m); } }}
        onPointerDown={onDown} onPointerUp={cancel} onPointerCancel={cancel} onPointerMove={onMove}
        onContextMenu={(e) => { e.preventDefault(); if (desktop) setAnchor(new DOMRect(e.clientX, e.clientY, 0, 0)); else ctx.menu(m); }}>
        {!mine && (showHead ? <Avatar m={sender} size={compact ? 28 : 34} onClick={() => ctx.profile(m.from)} className="mb-0.5 self-start" /> : <span className={compact ? "w-7" : "w-[34px]"} />)}
        <div className="min-w-0">
          {isAnn ? (
            <div className="bub gold w-[min(340px,100%)] px-3.5 py-3" style={{ animation: "none" }}>
              <div className="mb-1 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-[#ffd979]"><Megaphone size={14} />Elaan · {name}</div>
              {m.title && <p className="mb-1 text-base font-extrabold">{m.title}</p>}
              <p className="whitespace-pre-wrap text-[15px] leading-snug"><Rich text={m.text ?? ""} query={ctx.query} cur={isCur} /></p>
              <div className="mt-1.5 text-right"><Meta m={m} mine={mine} /></div>
            </div>
          ) : bare ? (
            <div className="relative">
              {m.type === "sticker" && /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.src} alt="sticker" draggable={false} className="h-[150px] w-[150px] drop-shadow-lg" />}
              {m.type === "gif" && <div className="overflow-hidden rounded-2xl">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={gifUrl ?? ""} alt="gif" draggable={false} className="w-[220px]" /></div>}
              {m.type === "videonote" && <Body m={m} mine={mine} ctx={ctx} />}
              {m.type !== "videonote" && <span className="absolute bottom-1 right-1"><Meta m={m} mine={mine} overlay /></span>}
            </div>
          ) : (
            <div className={cn("bub px-2.5 py-1.5", mine ? "out" : "in", showHead && "tail", compact && "!py-1")}>
              {!mine && showHead && <p className="mb-0.5 flex items-center gap-1.5 text-[13px] font-bold leading-tight" style={{ color: sender?.color }}>{name}{sender && sender.role !== "member" && <span className="rounded bg-white/10 px-1 text-[9px] uppercase tracking-wider opacity-80">{sender.role}</span>}</p>}
              {m.forwarded && <p className="mb-0.5 flex items-center gap-1 text-[12px] italic opacity-70"><Forward size={12} />Forward kiya hua</p>}
              {m.replyTo && <Quote id={m.replyTo} />}
              <Body m={m} mine={mine} ctx={ctx} />
            </div>
          )}
          {Object.keys(m.reactions).length > 0 && (
            <div className={cn("-mt-1.5 flex flex-wrap gap-1", mine ? "justify-end pr-2" : "pl-2")}>
              {Object.entries(m.reactions).map(([e, u]) => (
                <motion.button key={e} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 16 }} onClick={() => react(m.id, e)} className={cn("flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs shadow", u.includes(meId) ? "border-accent bg-surface2" : "border-line bg-surface")}>
                  <span>{e}</span>{u.length > 1 && <span className="font-bold text-mute">{u.length}</span>}
                </motion.button>
              ))}
            </div>
          )}
        </div>
        {/* desktop hover toolbar — Discord style */}
        {desktop && (
          <div className={cn("pointer-events-none absolute -top-4 z-20 flex items-center gap-0.5 rounded-lg border border-line bg-surface px-1 py-0.5 opacity-0 shadow-xl transition group-hover:pointer-events-auto group-hover:opacity-100", mine ? "right-6" : "left-12")}>
            {QUICK_REACTIONS.slice(0, 3).map((e) => <button key={e} onClick={() => react(m.id, e)} className="rounded-md px-1 py-0.5 text-base hover:bg-surface2">{e}</button>)}
            <button onClick={() => ctx.reply(m)} className="rounded-md p-1.5 text-mute hover:bg-surface2 hover:text-fg" title="Reply"><Reply size={16} /></button>
            <button onClick={(e) => setAnchor((e.currentTarget as HTMLElement).getBoundingClientRect())} className="rounded-md p-1.5 text-mute hover:bg-surface2 hover:text-fg" title="Aur options"><MoreHorizontal size={17} /></button>
          </div>
        )}
      </motion.div>
      {anchor && <DesktopMenu m={m} anchor={anchor} onClose={() => setAnchor(null)} />}
    </motion.div>
  );
});

export function TypingBubble({ ids }: { ids: string[] }) {
  const sender = useStore((s) => s.members.find((m) => m.id === ids[0]));
  if (!sender) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 12, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="mt-2 flex items-end gap-1.5 px-2.5 md:px-6">
      <Avatar m={sender} size={30} />
      <div className="bub in tail px-3.5 py-2.5">
        <p className="mb-1 text-[12px] font-bold" style={{ color: sender.color }}>{displayName(sender)} likh raha hai…</p>
        <span className="flex gap-1"><i className="tdot" /><i className="tdot" /><i className="tdot" /></span>
      </div>
    </motion.div>
  );
}

/** A17 */
export function MessageInfo({ m, onClose }: { m: Message | null; onClose: () => void }) {
  const members = useStore((s) => s.members);
  const readers = (m?.readBy ?? []).map((r) => ({ ...r, mem: members.find((x) => x.id === r.id)! })).filter((r) => r.mem);
  const rest = members.filter((x) => x.id !== "me" && !x.banned && !readers.some((r) => r.id === x.id));
  return (
    <Sheet open={!!m} onClose={onClose} title="Message info">
      {m && (
        <>
          <div className="bub out mb-4 ml-auto w-fit max-w-full px-3 py-2 text-[15px]">{msgSnippet(m)}<div className="mt-1 text-right text-[11px] opacity-70">{fmtDateTime(m.at)}</div></div>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#53bdeb]"><CheckCheck size={14} />Dekha gaya ({readers.length})</p>
          <div className="mb-4 overflow-hidden rounded-2xl border border-line">
            {readers.length ? readers.map((r) => (
              <div key={r.id} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0"><Avatar m={r.mem} size={36} /><div className="flex-1"><p className="text-sm font-semibold">{displayName(r.mem)}</p></div><span className="text-xs text-mute">{fmtDateTime(r.at)}</span></div>
            )) : <p className="p-4 text-center text-sm text-mute">Abhi kisi ne nahi dekha</p>}
          </div>
          {m.status !== "queued" && rest.length > 0 && (
            <>
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-mute"><CheckCheck size={14} />Pohnch gaya ({m.status === "read" || m.status === "delivered" ? rest.length : 0})</p>
              <div className="overflow-hidden rounded-2xl border border-line">{rest.slice(0, 5).map((r) => <div key={r.id} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-0"><Avatar m={r} size={30} /><p className="text-sm">{displayName(r)}</p></div>)}</div>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

export function ForwardSheet({ m, onClose }: { m: Message | null; onClose: () => void }) {
  return (
    <Sheet open={!!m} onClose={onClose} title="Forward kahan karein?">
      <div className="mb-4 truncate rounded-xl bg-surface2 px-3 py-2 text-sm text-mute">{m && msgSnippet(m)}</div>
      <button onClick={() => { if (m) { forwardMessage(m.id); toast("Forward ho gaya", "Madrasa Group me", "info", 2200); } onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-surface2">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-lg font-bold text-accent-fg">M</span><span><span className="block font-semibold">Madrasa Group</span><span className="text-xs text-mute">Is group me dobara bhejo</span></span>
      </button>
      <button onClick={() => { if (m) toggleStar(m.id); toast(m?.starred ? "Unstar hua" : "Star ho gaya", "Starred list me dekhein", "info", 2000); onClose(); }} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-surface2">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-gold/20 text-gold"><Star size={20} /></span><span><span className="block font-semibold">Mere liye (Starred)</span><span className="text-xs text-mute">Apne mehfooz messages me rakho</span></span>
      </button>
      <Btn variant="ghost" className="mt-3 w-full" onClick={onClose}>Radd karo</Btn>
    </Sheet>
  );
}
void ExternalLink; void deleteMessage;
