"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ArrowDown, ChevronDown, ChevronUp, Clock, Image as ImageIcon, MoreVertical, Megaphone, Palette, Phone, Pin, Search, Star, Timer, X, BellOff, Moon, Users, Palette as Pal, Info, ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/data/store";
import { deleteMessage, getActiveAnnouncement, go, markAllRead, setTab } from "@/data/api";
import { getWallpaper } from "@/data/assets";
import { getLocation } from "@/data/api";
import { prayerTimes, ramadanInfo, isEidDay } from "@/data/deen";
import type { Message } from "@/data/types";
import { cn, dayKey, fmtDay } from "@/lib/util";
import { Avatar, Hint, Marker, useIsDesktop } from "../ui";
import Composer from "./Composer";
import { ActionSheet, ChatContext, ForwardSheet, MessageInfo, MessageItem, TypingBubble, msgSnippet, type ChatCtx } from "./Message";
import { MediaViewer, type ViewItem } from "./Media";
import { ContactActions, LocationViewer } from "./Attach";
import { ProfileSheet } from "../profile/Profile";

function RamadanStrip() {
  const cfg = useStore((s) => s.settings.ramadan);
  const eid = useStore((s) => s.settings.eid);
  const [, t] = useState(0);
  useEffect(() => { const i = setInterval(() => t((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  const r = ramadanInfo(cfg);
  if (eid || isEidDay()) return <div className="bg-gradient-to-r from-[#1a7a55] via-[#c58b1f] to-[#1a7a55] py-1 text-center text-xs font-extrabold tracking-wide text-white">🌙 Eid Mubarak! Taqabbal Allahu minna wa minkum ✨</div>;
  if (!r.active) return null;
  const l = getLocation(), tm = prayerTimes(new Date(), l.lat, l.lng), now = Date.now();
  const target = now < tm.fajr.getTime() ? tm.fajr : now < tm.maghrib.getTime() ? tm.maghrib : new Date(tm.fajr.getTime() + 864e5);
  const lbl = now < tm.fajr.getTime() ? "Sehri khatam" : now < tm.maghrib.getTime() ? "Iftar" : "Sehri";
  const d = Math.max(0, target.getTime() - now), h = Math.floor(d / 3600e3), m = Math.floor((d % 3600e3) / 60e3), s = Math.floor((d % 60e3) / 1e3);
  return <button onClick={() => setTab("deen")} className="flex w-full items-center justify-center gap-2 bg-gradient-to-r from-[#3a2c0a] via-[#6b4f12] to-[#3a2c0a] py-1 text-xs font-bold text-[#ffe9a8]">🌙 Ramadan {r.day} · {lbl} me {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</button>;
}

export default function ChatView({ active }: { active: boolean }) {
  const desktop = useIsDesktop();
  const all = useStore((s) => s.messages);
  const blocked = useStore((s) => s.blocked);
  const meId = useStore((s) => s.me);
  const lastRead = useStore((s) => s.lastRead);
  const typing = useStore((s) => s.ui.typing);
  const settings = useStore((s) => s.settings);
  const members = useStore((s) => s.members);
  const branding = useStore((s) => s.owner.branding);
  const archived = useStore((s) => s.archived);
  const msgs = useMemo(() => all.filter((m) => !blocked.includes(m.from)), [all, blocked]);
  const online = members.filter((m) => m.online && !m.banned).length;
  const typer = members.find((m) => m.id === typing[0]);

  const sc = useRef<HTMLDivElement>(null);
  const mountedAt = useRef(Date.now());
  const [near, setNear] = useState(true);
  const [searchOn, setSearchOn] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [menuMsg, setMenuMsg] = useState<Message | null>(null);
  const [infoMsg, setInfoMsg] = useState<Message | null>(null);
  const [fwdMsg, setFwdMsg] = useState<Message | null>(null);
  const [viewer, setViewer] = useState<{ items: ViewItem[]; index: number } | null>(null);
  const [locView, setLocView] = useState<Message["loc"] | null>(null);
  const [contactView, setContactView] = useState<Message["contact"] | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [dying, setDying] = useState<Set<string>>(new Set());
  const [hmenu, setHmenu] = useState(false);
  const [annHidden, setAnnHidden] = useState<string | null>(null);
  const [pinIdx, setPinIdx] = useState(0);
  const [divider, setDivider] = useState<{ id: string; count: number } | null>(null);
  const lastCount = useRef(msgs.length);

  const firstUnread = useMemo(() => { const i = msgs.findIndex((m) => m.id === lastRead); const rest = msgs.slice(i + 1).filter((m) => m.from !== meId && m.type !== "system"); return { id: rest[0]?.id, count: rest.length }; }, [msgs, lastRead, meId]);

  // unread divider captured when chat becomes active
  useEffect(() => {
    if (active) { if (firstUnread.id && !divider) setDivider({ id: firstUnread.id, count: firstUnread.count }); }
    else if (divider) setDivider(null);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollBottom = (smooth = true) => { const e = sc.current; if (e) e.scrollTo({ top: e.scrollHeight, behavior: smooth ? "smooth" : "auto" }); };
  const jump = (id: string) => { const el = document.getElementById("m-" + id); el?.scrollIntoView({ behavior: "smooth", block: "center" }); if (el) { el.animate([{ background: "rgba(255,225,77,.28)" }, { background: "transparent" }], { duration: 1600 }); } };

  // initial position
  useEffect(() => {
    const t = setTimeout(() => { if (divider) document.getElementById("unread-divider")?.scrollIntoView({ block: "center" }); else scrollBottom(false); }, 60);
    return () => clearTimeout(t);
  }, [divider?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // new messages
  useEffect(() => {
    if (msgs.length > lastCount.current) {
      const last = msgs[msgs.length - 1];
      if (last.from === meId || near) setTimeout(() => scrollBottom(true), 40);
    }
    lastCount.current = msgs.length;
  }, [msgs.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (typing.length && near) setTimeout(() => scrollBottom(true), 40); }, [typing.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // mark read when bottom reached
  useEffect(() => {
    if (!active || !near || !firstUnread.count) return;
    const t = setTimeout(() => markAllRead(), 900);
    return () => clearTimeout(t);
  }, [active, near, firstUnread.count]);

  const matches = useMemo(() => (q.trim() ? msgs.filter((m) => !m.deleted && ((m.text ?? "") + " " + (m.caption ?? "")).toLowerCase().includes(q.toLowerCase())) : []), [msgs, q]);
  const curIdx = matches.length ? ((idx % matches.length) + matches.length) % matches.length : 0;
  const currentId = matches[curIdx]?.id ?? null;
  useEffect(() => { if (currentId) jump(currentId); }, [currentId, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const g: { key: string; at: number; items: Message[] }[] = [];
    msgs.forEach((m) => { const k = dayKey(m.at); const l = g[g.length - 1]; if (l && l.key === k) l.items.push(m); else g.push({ key: k, at: m.at, items: [m] }); });
    return g;
  }, [msgs]);

  const pins = msgs.filter((m) => m.pinned && !m.deleted);
  const ann = getActiveAnnouncement();
  const pin = pins.length ? pins[pinIdx % pins.length] : null;

  const ctx: ChatCtx = useMemo(() => ({
    query: q, currentId, mountedAt: mountedAt.current, dying,
    reply: (m) => { setEditing(null); setReplyTo(m); }, edit: (m) => { setReplyTo(null); setEditing(m); },
    info: setInfoMsg, forward: setFwdMsg, menu: setMenuMsg,
    view: (m) => {
      const items: ViewItem[] = msgs.filter((x) => (x.type === "image" || x.type === "video") && x.src && x.downloaded !== false && !x.deleted).map((x) => ({ id: x.id, src: x.src!, kind: x.type as "image" | "video", caption: x.caption, from: x.from, at: x.at }));
      setViewer({ items, index: Math.max(0, items.findIndex((i) => i.id === m.id)) });
    },
    loc: setLocView, contact: setContactView, profile: setProfileId, jump,
    remove: (m, allv) => { setDying((d) => new Set(d).add(m.id)); setTimeout(() => { deleteMessage(m.id, allv); setDying((d) => { const n = new Set(d); n.delete(m.id); return n; }); }, 340); },
  }), [q, currentId, dying, msgs]);

  const wp = settings.wallpaper === "custom" && settings.customWallpaper ? { img: settings.customWallpaper, tile: 0 } : (() => { const w = getWallpaper(settings.wallpaper); return { img: w.url, tile: w.tile ?? 0 }; })();

  const menuItems: { l: string; i: React.ReactNode; f: () => void }[] = [
    { l: "Group info", i: <Info size={17} />, f: () => go("group") },
    { l: "Search", i: <Search size={17} />, f: () => setSearchOn(true) },
    { l: "Media, links aur docs", i: <ImageIcon size={17} />, f: () => go("media") },
    { l: "Starred messages", i: <Star size={17} />, f: () => go("starred") },
    { l: "Scheduled messages", i: <Clock size={17} />, f: () => go("scheduled") },
    { l: "Pinned messages", i: <Pin size={17} />, f: () => go("pins") },
    { l: "Wallpaper", i: <Palette size={17} />, f: () => go("wallpaper") },
    { l: "Chat theme", i: <Pal size={17} />, f: () => go("chattheme") },
    { l: "Gayab hone wale messages", i: <Timer size={17} />, f: () => go("disappearing") },
    { l: "Mute notifications", i: <BellOff size={17} />, f: () => go("mute") },
    { l: archived ? "Unarchive karo" : "Chat archive karo", i: <Archive size={17} />, f: () => go("chatlist") },
  ];

  let prevM: Message | null = null;
  return (
    <ChatContext.Provider value={ctx}>
      <div className="relative flex h-full flex-col bg-bg">
        {/* header */}
        <header className="safe-t relative z-30 flex shrink-0 items-center gap-1 border-b border-line bg-surface/90 px-2 py-2 backdrop-blur">
          <AnimatePresence mode="wait" initial={false}>
            {searchOn ? (
              <motion.div key="s" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-1 items-center gap-1">
                <button onClick={() => { setSearchOn(false); setQ(""); }} className="rounded-full p-2 hover:bg-surface2"><ArrowLeft size={20} /></button>
                <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={(e) => { if (e.key === "Enter") setIdx((i) => i + (e.shiftKey ? -1 : 1)); }} placeholder="Chat me dhoondo…" className="min-w-0 flex-1 rounded-full bg-surface2 px-4 py-2 text-[15px] outline-none" />
                <span className="px-1 text-xs tabular-nums text-mute">{q ? `${matches.length ? curIdx + 1 : 0}/${matches.length}` : ""}</span>
                <button disabled={!matches.length} onClick={() => setIdx((i) => i - 1)} className="rounded-full p-2 hover:bg-surface2 disabled:opacity-30"><ChevronUp size={20} /></button>
                <button disabled={!matches.length} onClick={() => setIdx((i) => i + 1)} className="rounded-full p-2 hover:bg-surface2 disabled:opacity-30"><ChevronDown size={20} /></button>
              </motion.div>
            ) : (
              <motion.div key="h" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 items-center gap-1">
                <button onClick={() => go("chatlist")} className="rounded-full p-2 hover:bg-surface2 md:hidden" aria-label="Chats"><ArrowLeft size={20} /></button>
                <button onClick={() => go("group")} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1.5 py-1 text-left hover:bg-surface2/60">
                  <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-accent to-[#0b4a37] text-lg font-black text-accent-fg">{branding.logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={branding.logo} alt="" className="h-full w-full object-cover" /> : "م"}</span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 truncate text-[16px] font-bold leading-tight">{branding.name}{settings.groupMute && <BellOff size={13} className="text-mute" />}{settings.disappearing > 0 && <Timer size={13} className="text-mute" />}</span>
                    <span className="block truncate text-xs leading-tight text-mute">
                      {typer ? <span className="font-semibold text-accent">{typer.name.split(" ")[0]} likh raha hai…</span> : <><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />{online} online · {members.filter((m) => !m.banned).length} members</>}
                    </span>
                  </span>
                </button>
                <button onClick={() => setSearchOn(true)} className="rounded-full p-2.5 text-mute hover:bg-surface2 hover:text-fg" aria-label="Search"><Search size={20} /></button>
                <Hint id="call" text="Group call yahan se" side="bottom"><button onClick={() => go("call")} className="rounded-full p-2.5 text-mute hover:bg-surface2 hover:text-fg" aria-label="Call"><Phone size={20} /></button></Hint>
                <div className="relative">
                  <button onClick={() => setHmenu((h) => !h)} className="rounded-full p-2.5 text-mute hover:bg-surface2 hover:text-fg" aria-label="Menu"><MoreVertical size={20} /></button>
                  <AnimatePresence>
                    {hmenu && (<>
                      <div className="fixed inset-0 z-40" onClick={() => setHmenu(false)} />
                      <motion.div initial={{ opacity: 0, scale: 0.92, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }} style={{ transformOrigin: "top right" }} className="absolute right-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-2xl border border-line bg-surface py-1.5 shadow-2xl">
                        {menuItems.map((it) => <button key={it.l} onClick={() => { setHmenu(false); it.f(); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface2"><span className="text-mute">{it.i}</span>{it.l}</button>)}
                      </motion.div>
                    </>)}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <RamadanStrip />
        {/* C1 golden announcement banner */}
        <AnimatePresence>
          {ann && annHidden !== ann.id && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="relative z-20 overflow-hidden">
              <div className="shimmer flex items-center gap-3 border-b border-[#e8bd57]/50 px-3 py-2 text-[#2a1d02]" style={{ backgroundImage: "linear-gradient(100deg,#e8bd57,#fbe9a8 30%,#e8bd57 55%,#fbe9a8 80%,#e8bd57)" }}>
                <Megaphone size={20} className="shrink-0" />
                <button onClick={() => jump(ann.id)} className="min-w-0 flex-1 text-left"><p className="truncate text-[11px] font-black uppercase tracking-widest">Elaan{ann.title ? ` · ${ann.title}` : ""}</p><p className="truncate text-sm font-semibold">{ann.text}</p></button>
                <button onClick={() => setAnnHidden(ann.id)} className="rounded-full p-1 hover:bg-black/10"><X size={16} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* A14 pinned banner */}
        {pin && (
          <button onClick={() => { jump(pin.id); setPinIdx((i) => i + 1); }} className="relative z-20 flex items-center gap-3 border-b border-line bg-surface/90 px-3 py-2 text-left backdrop-blur">
            <span className="flex flex-col gap-0.5">{pins.map((p, i) => <span key={p.id} className={cn("h-3 w-0.5 rounded-full", i === pinIdx % pins.length ? "bg-accent" : "bg-line")} />)}</span>
            <Pin size={16} className="shrink-0 text-accent" />
            <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold text-accent">Pinned message{pins.length > 1 ? ` ${(pinIdx % pins.length) + 1}/${pins.length}` : ""}</span><span className="block truncate text-sm text-mute">{msgSnippet(pin)}</span></span>
          </button>
        )}

        {/* messages */}
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0" style={{ backgroundColor: getWallpaper(settings.wallpaper).color, backgroundImage: `url("${wp.img}")`, backgroundSize: wp.tile ? `${wp.tile}px` : "cover", backgroundPosition: "center" }} />
          <div className="absolute inset-0" style={{ background: `color-mix(in srgb, var(--bg) ${Math.round(settings.wallDim * 100)}%, transparent)` }} />
          <div ref={sc} className="thin absolute inset-0 overflow-y-auto overflow-x-hidden pb-3 pt-1" onScroll={(e) => { const t = e.currentTarget; setNear(t.scrollHeight - t.scrollTop - t.clientHeight < 140); }}>
            <div className="mx-auto max-w-4xl">
              {groups.map((g) => (
                <section key={g.key}>
                  <div className="sticky top-2 z-10 flex justify-center py-1.5"><span className="rounded-full bg-black/45 px-3.5 py-1 text-xs font-semibold text-white shadow backdrop-blur-md">{fmtDay(g.at)}</span></div>
                  {g.items.map((m) => {
                    const p = prevM; prevM = m;
                    const showHead = !p || p.from !== m.from || m.at - p.at > 5 * 60e3 || p.type === "system" || m.type === "system" || p.type === "announcement" || p.deleted === true;
                    return (
                      <div key={m.id}>
                        {divider?.id === m.id && (
                          <div id="unread-divider" className="my-3 flex justify-center">
                            <button onClick={() => jump(m.id)} className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-accent-fg shadow-lg">{divider.count} unread message{divider.count > 1 ? "s" : ""} ↓</button>
                          </div>
                        )}
                        <MessageItem m={m} showHead={showHead} compact={settings.compact} isNew={m.at > mountedAt.current} />
                      </div>
                    );
                  })}
                </section>
              ))}
              <AnimatePresence>{typing.length > 0 && <TypingBubble ids={typing} />}</AnimatePresence>
              <div className="h-2" />
            </div>
          </div>
          <AnimatePresence>
            {!near && (
              <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} onClick={() => scrollBottom()} className="absolute bottom-3 right-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-line bg-surface shadow-xl">
                <ArrowDown size={20} />{firstUnread.count > 0 && <span className="absolute -top-1.5 right-0 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg">{firstUnread.count}</span>}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <Composer replyTo={replyTo} editing={editing} onClearReply={() => setReplyTo(null)} onClearEdit={() => setEditing(null)} onSent={() => setTimeout(() => scrollBottom(true), 60)} />

        <ActionSheet m={desktop ? null : menuMsg} onClose={() => setMenuMsg(null)} />
        <MessageInfo m={infoMsg} onClose={() => setInfoMsg(null)} />
        <ForwardSheet m={fwdMsg} onClose={() => setFwdMsg(null)} />
        <LocationViewer loc={locView ?? null} onClose={() => setLocView(null)} />
        <ContactActions c={contactView ?? null} onClose={() => setContactView(null)} />
        <ProfileSheet id={profileId} onClose={() => setProfileId(null)} />
        <AnimatePresence>{viewer && <MediaViewer items={viewer.items} index={viewer.index} onClose={() => setViewer(null)} />}</AnimatePresence>
      </div>
    </ChatContext.Provider>
  );
}
void Moon; void Users;
