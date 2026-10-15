"use client";
import { motion } from "framer-motion";
import { BellRing, Check, Clock, HardDrive, Megaphone, MessageSquare, Pin, Send, ShieldAlert, Trash2, Users, Wifi, CalendarClock } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/data/store";
import * as api from "@/data/api";
import { cn, fmtDateTime, fmtSize, ago, inWindow } from "@/lib/util";
import { Avatar, Btn, Card, Empty, Field, Row, Tabs, inputCls } from "../ui";
import { InsightsCharts } from "../group/Group";
import { msgSnippet } from "../chat/Message";
import { ModerationTab, CommandsTab, RolesTab } from "./OwnerMod";
import { RemoteTab } from "./OwnerRemote";

type T = "home" | "elaan" | "mod" | "remote" | "cmd" | "roles" | "logs";

export default function Owner() {
  const [tab, setTab] = useState<T>("home");
  const alerts = useStore((s) => s.owner.alerts.filter((a) => !a.seen).length);
  const avail = useStore((s) => !!s.owner.available);
  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="safe-t shrink-0 border-b border-line bg-surface/80 px-4 pt-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between"><h1 className="text-2xl font-black tracking-tight">Owner dashboard</h1>{(alerts > 0 || avail) && <span className="flex items-center gap-1.5 rounded-full bg-danger/15 px-3 py-1 text-xs font-bold text-danger"><BellRing size={13} />{alerts + (avail ? 1 : 0)} alert</span>}</div>
          <Tabs value={tab} onChange={setTab} tabs={[{ v: "home", l: "Home" }, { v: "elaan", l: "Elaan" }, { v: "mod", l: "Moderation" }, { v: "remote", l: "Remote", badge: avail ? 1 : 0 }, { v: "cmd", l: "Commands" }, { v: "roles", l: "Roles/Invite" }, { v: "logs", l: "Logs", badge: alerts }]} />
        </div>
      </div>
      <div className="thin min-h-0 flex-1 overflow-y-auto px-4 py-4"><div className="mx-auto max-w-3xl">
        {tab === "home" && <Home go={setTab} />}{tab === "elaan" && <Elaan />}{tab === "mod" && <ModerationTab />}{tab === "remote" && <RemoteTab />}{tab === "cmd" && <CommandsTab />}{tab === "roles" && <RolesTab />}{tab === "logs" && <Logs />}
      </div></div>
    </div>
  );
}

function Stat({ icon, label, value, sub, c }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; c: string }) {
  return <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl border border-line bg-surface p-4"><span className="absolute -right-3 -top-3 h-16 w-16 rounded-full opacity-20" style={{ background: c }} /><span className="mb-2 grid h-9 w-9 place-items-center rounded-xl" style={{ background: c + "26", color: c }}>{icon}</span><p className="text-3xl font-black tabular-nums">{value}</p><p className="text-xs font-semibold text-mute">{label}</p>{sub && <p className="text-[11px] text-mute">{sub}</p>}</motion.div>;
}

function Home({ go }: { go: (t: T) => void }) {
  const members = useStore((s) => s.members), msgs = useStore((s) => s.messages), st = useStore((s) => s.storage);
  const alerts = useStore((s) => s.owner.alerts), avail = useStore((s) => s.owner.available);
  const today = msgs.filter((m) => new Date(m.at).toDateString() === new Date().toDateString() && m.type !== "system").length;
  return (
    <>
      {avail && <button onClick={() => go("remote")} className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-gold/50 bg-gradient-to-r from-gold/20 to-transparent p-4 text-left"><BellRing className="text-gold" /><span><span className="block font-extrabold text-gold">Naya version tayyar hai!</span><span className="text-sm text-mute">v{avail.version} — Remote tab me jakar push karein</span></span></button>}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<Users size={18} />} label="Kul members" value={members.length} sub={`${members.filter((m) => m.banned).length} banned`} c="#2ccf8a" />
        <Stat icon={<MessageSquare size={18} />} label="Aaj ke messages" value={today + 38} c="#4cc3ff" />
        <Stat icon={<Wifi size={18} />} label="Abhi online" value={members.filter((m) => m.online && !m.banned).length} c="#e8bd57" />
        <Stat icon={<HardDrive size={18} />} label="Storage" value={fmtSize(st.media + st.docs + st.voice)} c="#ff8a5c" />
      </div>
      <Card title="Admin alerts" right={alerts.some((a) => !a.seen) ? <button onClick={api.markAlertsSeen} className="text-xs font-bold text-accent">Sab dekh liye</button> : undefined}>
        {alerts.length === 0 ? <p className="p-5 text-center text-sm text-mute">Koi alert nahi — sab theek hai ✅</p> : alerts.slice(0, 4).map((a) => <Row key={a.id} icon={<ShieldAlert size={18} />} title={<span className={cn(!a.seen && "font-bold")}>{a.text}</span>} sub={ago(a.at)} right={!a.seen ? <span className="h-2.5 w-2.5 rounded-full bg-danger" /> : <span />} />)}
      </Card>
      <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-mute">Analytics</h3>
      <InsightsCharts />
    </>
  );
}

function Elaan() {
  const draft = useStore((s) => s.owner.announceDraft);
  const sched = useStore((s) => s.scheduled.filter((x) => x.kind === "announcement"));
  const pins = useStore((s) => s.messages.filter((m) => m.pinned && !m.deleted));
  const [title, setTitle] = useState("");
  const [at, setAt] = useState("");
  return (
    <>
      <Card title="Broadcast composer"><div className="p-4">
        <Field label="Sarkhi (optional)"><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="Jaise: Zaroori elaan" className={inputCls} /></Field>
        <Field label="Elaan ka matn"><textarea rows={4} value={draft} onChange={(e) => api.setAnnounceDraft(e.target.value)} placeholder="Apna elaan yahan likho…" className={cn(inputCls, "resize-none")} /></Field>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-mute">Live preview — chat me aisa dikhega</p>
        <div className="mb-3 overflow-hidden rounded-2xl p-3" style={{ background: "var(--bg2)" }}>
          <div className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[#2a1d02]" style={{ backgroundImage: "linear-gradient(100deg,#e8bd57,#fbe9a8 40%,#e8bd57)" }}><Megaphone size={16} /><p className="truncate text-sm font-semibold">{draft || "Elaan yahan dikhega…"}</p></div>
          <div className="bub gold w-fit max-w-full px-3.5 py-3"><p className="mb-1 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-[#ffd979]"><Megaphone size={13} />Elaan · Aap</p>{title && <p className="mb-1 font-extrabold">{title}</p>}<p className="whitespace-pre-wrap text-[15px]">{draft || "…"}</p></div>
        </div>
        <Btn className="w-full" disabled={!draft.trim()} onClick={() => { api.postAnnouncement(title.trim(), draft.trim()); api.setAnnounceDraft(""); setTitle(""); api.toast("Elaan bhej diya", "Sab ko golden banner dikhega", "info"); }}><Send size={16} />Abhi bhejo</Btn>
        <div className="mt-3 flex gap-2"><input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className={inputCls} /><Btn variant="soft" disabled={!draft.trim() || !at} onClick={() => { const t = new Date(at).getTime(); if (t < Date.now() + 3000) return api.toast("Aage ka waqt chuno", "", "info"); api.scheduleMessage(draft.trim(), t, "announcement"); api.setAnnounceDraft(""); setAt(""); }}><CalendarClock size={16} />Schedule</Btn></div>
      </div></Card>
      <Card title={`Scheduled elaan (${sched.length})`}>{sched.length === 0 ? <p className="p-5 text-center text-sm text-mute">Koi scheduled elaan nahi</p> : sched.map((x) => <Row key={x.id} icon={<Clock size={18} />} title={x.text} sub={fmtDateTime(x.at)} right={<button onClick={() => api.cancelScheduled(x.id)} className="text-danger"><Trash2 size={17} /></button>} />)}</Card>
      <Card title={`Pin manager (${pins.length})`}>{pins.length === 0 ? <p className="p-5 text-center text-sm text-mute">Koi pinned message nahi</p> : pins.map((m) => <Row key={m.id} icon={<Pin size={18} />} title={msgSnippet(m)} sub={fmtDateTime(m.at)} right={<Btn small variant="ghost" onClick={() => api.togglePin(m.id)}>Unpin</Btn>} />)}</Card>
    </>
  );
}

function Logs() {
  const audit = useStore((s) => s.owner.audit), hist = useStore((s) => s.owner.history), members = useStore((s) => s.members), alerts = useStore((s) => s.owner.alerts);
  const [f, setF] = useState("sab");
  const kinds = ["sab", ...Array.from(new Set(audit.map((a) => a.kind)))];
  const list = audit.filter((a) => f === "sab" || a.kind === f);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "Koi";
  void inWindow; void Avatar; void Empty; void Check;
  return (
    <>
      <Card title="Audit log"><div className="noscroll flex gap-1.5 overflow-x-auto px-4 py-3">{kinds.map((k) => <button key={k} onClick={() => setF(k)} className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-bold", f === k ? "bg-accent text-accent-fg" : "bg-surface2 text-mute")}>{k}</button>)}</div>
        {list.slice(0, 60).map((a) => <Row key={a.id} title={<span><b>{name(a.by)}</b> — {a.action}{a.target ? <span className="text-mute"> · {a.target}</span> : null}</span>} sub={fmtDateTime(a.at)} />)}</Card>
      <Card title="Reload / version history">{hist.map((h) => <Row key={h.id} title={<span><b>{h.kind === "push" ? "Push" : "Reload"}</b> · v{h.version} · {h.scope}</span>} sub={`${name(h.by)} · ${fmtDateTime(h.at)}${h.note ? " · " + h.note : ""}`} />)}</Card>
      <Card title="Saare alerts">{alerts.length === 0 ? <p className="p-5 text-center text-sm text-mute">Koi alert nahi</p> : alerts.map((a) => <Row key={a.id} icon={<ShieldAlert size={18} />} title={a.text} sub={fmtDateTime(a.at)} />)}</Card>
    </>
  );
}
