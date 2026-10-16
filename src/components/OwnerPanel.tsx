"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Megaphone, Send, Users, MessageSquare, Wifi, AlertTriangle,
  BarChart3, Radio, Clock, Pin, Turtle, ShieldCheck, Ban, ScrollText,
  Sparkles, X, ChevronRight, Timer,
} from "lucide-react";
import { useStore, patchUI, toast } from "@/lib/store";
import { postAnnouncement, togglePin } from "@/lib/db";
import { Avatar, Badge } from "@/components/ui";
import {
  messagesPerDay, activeMembers, topContributors,
  broadcast, getSlowMode, setSlowMode,
  getBadWords, setBadWords, type BadWords,
  useAuditLog, fetchAuditServer, changeRole, ROLES,
  scheduleAnnouncement, cancelScheduled, useScheduled,
  CHANGELOG,
} from "@/lib/owner";
import type { Role } from "@/lib/types";

type Tab = "overview" | "broadcast" | "pins" | "slowmode" | "roles" | "automod" | "audit" | "new";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <BarChart3 size={15} /> },
  { id: "broadcast", label: "Broadcast", icon: <Radio size={15} /> },
  { id: "pins", label: "Pins", icon: <Pin size={15} /> },
  { id: "slowmode", label: "Slow Mode", icon: <Turtle size={15} /> },
  { id: "roles", label: "Roles", icon: <ShieldCheck size={15} /> },
  { id: "automod", label: "Auto-Mod", icon: <Ban size={15} /> },
  { id: "audit", label: "Audit Log", icon: <ScrollText size={15} /> },
  { id: "new", label: "What's New", icon: <Sparkles size={15} /> },
];

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="card relative overflow-hidden bg-white/80 p-4 backdrop-blur">
      <span className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-15" style={{ background: color }} />
      <span className="mb-2 grid h-10 w-10 place-items-center rounded-lg" style={{ background: color + "1f", color }}>{icon}</span>
      <p className="text-3xl font-extrabold tabular-nums text-[#2f3035]">{value}</p>
      <p className="text-xs font-semibold text-[#80848e]">{label}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-sm font-extrabold uppercase tracking-[0.08em] text-[#2f3035]">{children}</h2>;
}

/* ───────── H2 — Overview + 7-day chart ───────── */
function OverviewTab() {
  const members = useStore((s) => s.members);
  const messages = useStore((s) => s.messages);
  const [q, setQ] = useState("");

  const visible = members.filter((m) => !m.banned);
  const banned = members.filter((m) => m.banned);
  const online = visible.filter((m) => m.online).length;
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayMsgs = messages.filter((m) => m.at >= todayStart && !m.deleted && m.type === "text").length;
  const weekMsgs = messages.filter((m) => m.at >= Date.now() - 7 * 864e5 && !m.deleted).length;
  const active = activeMembers(7);
  const days = messagesPerDay(7);
  const maxDay = Math.max(1, ...days.map((d) => d.count));
  const top = topContributors(5);
  const list = visible.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Users size={18} />} label="Kul members" value={visible.length} color="#23a55a" />
        <Stat icon={<Wifi size={18} />} label="Abhi online" value={online} color="#00b0f4" />
        <Stat icon={<MessageSquare size={18} />} label="Aaj ke messages" value={todayMsgs} color="#5865f2" />
        <Stat icon={<AlertTriangle size={18} />} label="Banned" value={banned.length} color="#ed4245" />
      </div>

      <div className="card bg-white/80 p-4">
        <SectionTitle>📊 Aakhri 7 din — messages</SectionTitle>
        {weekMsgs === 0 ? (
          <p className="py-4 text-center text-sm text-[#80848e]">📊 Abhi data jama ho raha hai</p>
        ) : (
          <div className="flex h-32 items-end gap-2">
            {days.map((d, i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="text-[11px] font-bold tabular-nums text-[#5c5e66]">{d.count}</span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-[#5865f2] to-[#9b7bff]"
                  style={{ height: `${Math.max(4, (d.count / maxDay) * 90)}px` }}
                />
                <span className="text-[10px] font-semibold text-[#80848e]">{d.label}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-[#80848e]">7 din me <b className="text-[#2f3035]">{weekMsgs}</b> messages · <b className="text-[#2f3035]">{active}</b> active members</p>
      </div>

      {top.length > 0 && (
        <div className="card bg-white/80 p-4">
          <SectionTitle>🏆 Top contributors</SectionTitle>
          <div className="space-y-2">
            {top.map((t, i) => {
              const m = members.find((x) => x.id === t.id) || { id: t.id, name: t.name, online: false, avatar: undefined };
              const max = top[0]?.count || 1;
              return (
                <div key={t.id} className="flex items-center gap-3">
                  <span className="w-6 text-sm font-extrabold text-[#80848e]">{i + 1}</span>
                  <Avatar m={m} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[#2f3035]">{t.name}</span>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                      <span className="block h-full rounded-full bg-[#5865f2]" style={{ width: `${(t.count / max) * 100}%` }} />
                    </span>
                  </span>
                  <span className="text-xs font-bold tabular-nums text-[#5c5e66]">{t.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>Members · {visible.length}</SectionTitle>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dhoondo…" className="field w-40 px-3 py-1.5 text-sm" />
        </div>
        <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {list.map((m) => (
            <button key={m.id} onClick={() => patchUI({ profileId: m.id })} className="card flex w-full items-center gap-3 bg-white/70 px-3 py-2.5 text-left hover:border-[#5865f2]/40">
              <Avatar m={m} size={38} showDot />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[#2f3035]">{m.name}<Badge role={m.role} /></span>
                <span className="block text-xs text-[#80848e]">
                  {m.mutedUntil !== undefined ? "🔇 muted" : m.online ? "Online" : "Offline"}
                  {m.warns.length > 0 && ` · ⚠️ ${m.warns.length}`}
                </span>
              </span>
              <span className="text-xs font-semibold text-[#5865f2]">Manage →</span>
            </button>
          ))}
        </div>
      </div>
      <p className="pb-4 text-center text-xs text-[#80848e]">Sab numbers 100% real hain — Supabase se 🌱</p>
    </div>
  );
}

/* ───────── H3 + H4 — Broadcast + Scheduled ───────── */
function BroadcastTab() {
  const chats = useStore((s) => s.chats);
  const [text, setText] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [schedText, setSchedText] = useState("");
  const [schedAt, setSchedAt] = useState("");
  const [schedChats, setSchedChats] = useState<string[]>([]);
  const scheduled = useScheduled();

  const toggle = (id: string, arr: string[], set: (v: string[]) => void) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const sendBroadcast = async () => {
    if (!text.trim() || sel.length === 0) { toast("Kuch likho + chat select karo", ""); return; }
    const n = await broadcast(text.trim(), sel);
    toast(`Broadcast ho gaya 📢`, `${n} chats me bheja`);
    setText(""); setSel([]);
  };

  const schedule = () => {
    if (!schedText.trim() || schedChats.length === 0 || !schedAt) { toast("Sab bharo", "Text + time + chats"); return; }
    const at = new Date(schedAt).getTime();
    if (Number.isNaN(at) || at <= Date.now()) { toast("Sahi time do", "Mustaqbil ka waqt"); return; }
    scheduleAnnouncement(schedText.trim(), schedChats, at);
    setSchedText(""); setSchedAt(""); setSchedChats([]);
  };

  return (
    <div className="space-y-5">
      <div className="card bg-gradient-to-r from-[#5865f2]/[0.06] to-[#9b7bff]/[0.06] p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-[#5865f2]"><Megaphone size={16} /> Elaan bhejo (foran)</p>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Sab ko kya batana hai…" className="field w-full resize-none px-3.5 py-3 text-[15px]" />
        <p className="mb-1.5 mt-2 text-xs font-bold text-[#5c5e66]">Kahan bhejna hai:</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => toggle(c.id, sel, setSel)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${sel.includes(c.id) ? "bg-[#5865f2] text-white" : "bg-black/[0.06] text-[#5c5e66]"}`}
            >
              {c.type === "group" ? "👥" : "💬"} {c.name}
            </button>
          ))}
        </div>
        <button onClick={sendBroadcast} disabled={!text.trim() || sel.length === 0} className="btn btn-blurple mt-1 flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-40">
          <Send size={15} /> {sel.length > 0 ? `${sel.length} me bhejo` : "Bhejo"}
        </button>
      </div>

      <div className="card bg-white/80 p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-[#9b7bff]"><Timer size={16} /> Schedule karo ⏰</p>
        <textarea rows={2} value={schedText} onChange={(e) => setSchedText(e.target.value)} placeholder="Elaan likho…" className="field w-full resize-none px-3.5 py-2.5 text-[15px]" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} className="field px-3 py-2 text-sm" />
          <button onClick={schedule} className="btn rounded-xl bg-[#9b7bff] px-4 py-2 text-sm font-bold text-white">Schedule</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => toggle(c.id, schedChats, setSchedChats)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${schedChats.includes(c.id) ? "bg-[#9b7bff] text-white" : "bg-black/[0.06] text-[#5c5e66]"}`}
            >
              {c.type === "group" ? "👥" : "💬"} {c.name}
            </button>
          ))}
        </div>
        {scheduled.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-xs font-bold text-[#5c5e66]">Scheduled ({scheduled.length}):</p>
            {scheduled.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-xl bg-black/[0.04] px-3 py-2">
                <Clock size={14} className="shrink-0 text-[#9b7bff]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[#2f3035]">{s.text}</span>
                  <span className="block text-[11px] text-[#80848e]">{new Date(s.at).toLocaleString()} · {s.chatIds.length} chats</span>
                </span>
                <button onClick={() => { cancelScheduled(s.id); toast("Cancel ho gaya", ""); }} className="rounded-lg p-1.5 text-[#ed4245] hover:bg-[#ed4245]/10"><X size={15} /></button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-[#80848e]">App khuli ho to us waqt auto-post hoga ⏰</p>
      </div>
    </div>
  );
}

/* ───────── H5 — Pin Manager ───────── */
function PinsTab() {
  const pins = useStore((s) => s.pins);
  const messages = useStore((s) => s.messages);
  const chats = useStore((s) => s.chats);
  const [filter, setFilter] = useState<string>("all");

  const entries = Object.entries(pins).flatMap(([chatId, ids]) =>
    ids.map((id) => ({ chatId, id, msg: messages.find((m) => m.id === id) }))
  );
  const shown = filter === "all" ? entries : entries.filter((e) => e.chatId === filter);
  const chatName = (id: string) => chats.find((c) => c.id === id)?.name || "Chat";

  const jump = (chatId: string, msgId: string) => {
    patchUI({ tab: "chat", activeChatId: chatId, jumpToMsg: msgId });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilter("all")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter === "all" ? "bg-[#5865f2] text-white" : "bg-black/[0.06] text-[#5c5e66]"}`}>
          Sab ({entries.length})
        </button>
        {Object.keys(pins).map((cid) => (
          <button key={cid} onClick={() => setFilter(cid)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter === cid ? "bg-[#5865f2] text-white" : "bg-black/[0.06] text-[#5c5e66]"}`}>
            {chatName(cid)} ({pins[cid].length})
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="py-8 text-center text-sm text-[#80848e]">Koi pinned message nahi 📌</p>}
      {shown.map((e) => (
        <div key={e.id} className="card flex items-center gap-3 bg-white/80 px-3 py-2.5">
          <Pin size={16} className="shrink-0 text-[#5865f2]" />
          <button onClick={() => jump(e.chatId, e.id)} className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-bold text-[#2f3035]">{e.msg?.text?.slice(0, 80) || "(media)"}</span>
            <span className="block text-[11px] text-[#80848e]">{chatName(e.chatId)}</span>
          </button>
          <button onClick={() => jump(e.chatId, e.id)} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#5865f2] hover:bg-[#5865f2]/10">Jump →</button>
          <button onClick={() => { togglePin(e.chatId, e.id); toast("Unpin ho gaya", ""); }} className="rounded-lg p-1.5 text-[#ed4245] hover:bg-[#ed4245]/10"><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}

/* ───────── H9 — Slow Mode ───────── */
const SLOW_OPTS = [0, 10, 30, 60, 300];
function SlowModeTab() {
  const chats = useStore((s) => s.chats).filter((c) => c.type === "group");
  const [vals, setVals] = useState<Record<string, number>>({});
  useEffect(() => {
    (async () => {
      const out: Record<string, number> = {};
      for (const c of chats) out[c.id] = await getSlowMode(c.id);
      setVals(out);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = async (chatId: string, sec: number) => {
    await setSlowMode(chatId, sec);
    setVals((v) => ({ ...v, [chatId]: sec }));
    toast(sec > 0 ? `Slow mode ON 🐢` : "Slow mode OFF", sec > 0 ? `Har ${sec}s me 1 message` : "");
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#5c5e66]">Har member kitne waqfe se 1 message bhej sake. Owner/Admin/Mod par lagoo nahi hota. 🐢</p>
      {chats.map((c) => (
        <div key={c.id} className="card bg-white/80 p-4">
          <p className="mb-2 text-sm font-extrabold text-[#2f3035]">👥 {c.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {SLOW_OPTS.map((sec) => (
              <button
                key={sec}
                onClick={() => set(c.id, sec)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${(vals[c.id] || 0) === sec ? "bg-[#5865f2] text-white" : "bg-black/[0.06] text-[#5c5e66]"}`}
              >
                {sec === 0 ? "Off" : sec < 60 ? `${sec}s` : `${sec / 60}min`}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────── H14 — Role Manager ───────── */
function RolesTab() {
  const members = useStore((s) => s.members);
  const me = useStore((s) => s.me);
  const [q, setQ] = useState("");
  const list = members.filter((m) => !m.banned && m.id !== me && m.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="card bg-[#5865f2]/[0.05] p-3">
        {ROLES.map((r) => (
          <p key={r.id} className="py-0.5 text-xs text-[#5c5e66]"><b className="text-[#2f3035]">{r.label}</b> — {r.desc}</p>
        ))}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Member dhoondo…" className="field w-full px-3 py-2 text-sm" />
      <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
        {list.map((m) => (
          <div key={m.id} className="card flex items-center gap-3 bg-white/70 px-3 py-2.5">
            <Avatar m={m} size={36} />
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#2f3035]">{m.name}</span>
            <select
              value={m.role}
              onChange={(e) => changeRole(m.id, e.target.value as Role)}
              className="field px-2 py-1.5 text-xs font-bold"
            >
              {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── H15 — Auto-Mod ───────── */
function AutoModTab() {
  const chats = useStore((s) => s.chats).filter((c) => c.type === "group");
  const [chatId, setChatId] = useState(chats[0]?.id || "");
  const [words, setWords] = useState("");
  const [action, setAction] = useState<BadWords["action"]>("warn");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!chatId) return;
    setLoaded(false);
    getBadWords(chatId).then((bw) => {
      setWords(bw.words.join(", "));
      setAction(bw.action);
      setLoaded(true);
    });
  }, [chatId]);

  const save = async () => {
    if (!chatId) return;
    await setBadWords(chatId, words.split(",").map((w) => w.trim()), action);
    toast("Auto-mod save ho gaya 🛡️", "");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {chats.map((c) => (
          <button key={c.id} onClick={() => setChatId(c.id)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${chatId === c.id ? "bg-[#5865f2] text-white" : "bg-black/[0.06] text-[#5c5e66]"}`}>
            👥 {c.name}
          </button>
        ))}
      </div>
      {loaded && chatId && (
        <div className="card space-y-3 bg-white/80 p-4">
          <div>
            <p className="mb-1.5 text-xs font-bold text-[#5c5e66]">Banned lafz (comma se alag karo):</p>
            <textarea rows={3} value={words} onChange={(e) => setWords(e.target.value)} placeholder="lafz1, lafz2, lafz3…" className="field w-full resize-none px-3 py-2.5 text-sm" />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-[#5c5e66]">Koi banned lafz bheje to:</p>
            <div className="flex gap-1.5">
              {(["warn", "delete", "both"] as const).map((a) => (
                <button key={a} onClick={() => setAction(a)} className={`rounded-full px-4 py-1.5 text-xs font-bold ${action === a ? "bg-[#ed4245] text-white" : "bg-black/[0.06] text-[#5c5e66]"}`}>
                  {a === "warn" ? "⚠️ Warn karo" : a === "delete" ? "🗑️ Delete karo" : "⚠️🗑️ Dono"}
                </button>
              ))}
            </div>
          </div>
          <button onClick={save} className="btn btn-blurple px-5 py-2.5 text-sm">Save karo</button>
          <p className="text-[11px] text-[#80848e]">Staff (owner/admin/mod) par auto-mod lagoo nahi hota.</p>
        </div>
      )}
    </div>
  );
}

/* ───────── H16 — Audit Log ───────── */
const ACTION_META: Record<string, { icon: string; color: string }> = {
  ban: { icon: "🔨", color: "#ed4245" }, unban: { icon: "✅", color: "#23a55a" },
  mute: { icon: "🔇", color: "#f0a020" }, unmute: { icon: "🔊", color: "#23a55a" },
  warn: { icon: "⚠️", color: "#f0a020" }, role: { icon: "🛡️", color: "#5865f2" },
  slowmode: { icon: "🐢", color: "#00b0f4" }, automod: { icon: "🛡️", color: "#9b7bff" },
  broadcast: { icon: "📢", color: "#5865f2" },
};
function AuditTab() {
  const log = useAuditLog();
  const [filter, setFilter] = useState("all");
  useEffect(() => { fetchAuditServer(); }, []);

  const actions = ["all", ...Array.from(new Set(log.map((e) => e.action)))];
  const shown = filter === "all" ? log : log.filter((e) => e.action === filter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {actions.map((a) => (
          <button key={a} onClick={() => setFilter(a)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter === a ? "bg-[#5865f2] text-white" : "bg-black/[0.06] text-[#5c5e66]"}`}>
            {a === "all" ? `Sab (${log.length})` : `${ACTION_META[a]?.icon || "•"} ${a}`}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="py-8 text-center text-sm text-[#80848e]">Koi action abhi tak nahi 📋</p>}
      <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
        {shown.map((e) => {
          const meta = ACTION_META[e.action] || { icon: "•", color: "#80848e" };
          return (
            <div key={e.id} className="card flex items-start gap-2.5 bg-white/70 px-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm" style={{ background: meta.color + "1f" }}>{meta.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-[#2f3035]">
                  <b>{e.byName}</b> ne <b style={{ color: meta.color }}>{e.action}</b>
                  {e.targetName && <> → <b>{e.targetName}</b></>}
                </span>
                {e.reason && <span className="block truncate text-xs text-[#80848e]">{e.reason}</span>}
                <span className="block text-[10px] text-[#a0a3ab]">{new Date(e.at).toLocaleString()}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── G10 — What's New ───────── */
function WhatsNewTab() {
  return (
    <div className="space-y-3">
      {CHANGELOG.map((c) => (
        <div key={c.v} className="card bg-white/80 p-4">
          <p className="flex items-center justify-between">
            <span className="text-sm font-extrabold text-[#5865f2]">{c.v}</span>
            <span className="text-[11px] text-[#80848e]">{c.date}</span>
          </p>
          <ul className="mt-1.5 space-y-1">
            {c.items.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#2f3035]">
                <Sparkles size={13} className="mt-0.5 shrink-0 text-[#d4af37]" />{it}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ═══════════ MAIN ═══════════ */
export default function OwnerPanel() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="glass thin-scroll min-w-0 flex-1 overflow-y-auto rounded-2xl">
      <div className="sticky top-0 z-10 border-b border-black/10 bg-white/70 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-4">
          <button onClick={() => patchUI({ tab: "chat" })} className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5"><ArrowLeft size={20} /></button>
          <h1 className="text-[16px] font-extrabold tracking-tight text-[#2f3035]">Owner dashboard 👑</h1>
        </div>
        <div className="thin-scroll flex gap-1 overflow-x-auto px-3 pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${tab === t.id ? "bg-[#5865f2] text-white" : "bg-black/[0.05] text-[#5c5e66] hover:bg-black/[0.08]"}`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        {tab === "overview" && <OverviewTab />}
        {tab === "broadcast" && <BroadcastTab />}
        {tab === "pins" && <PinsTab />}
        {tab === "slowmode" && <SlowModeTab />}
        {tab === "roles" && <RolesTab />}
        {tab === "automod" && <AutoModTab />}
        {tab === "audit" && <AuditTab />}
        {tab === "new" && <WhatsNewTab />}
        {tab === "broadcast" && (
          <div className="card bg-gradient-to-r from-[#5865f2]/[0.06] to-[#9b7bff]/[0.06] p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-[#5865f2]"><Megaphone size={16} /> Quick elaan (main group)</p>
            <QuickElaan />
          </div>
        )}
      </div>
    </div>
  );
}

function QuickElaan() {
  const [elaan, setElaan] = useState("");
  const send = () => {
    if (!elaan.trim()) return;
    postAnnouncement(elaan.trim());
    setElaan("");
    toast("Elaan bhej diya", "Sab ko dikhega");
  };
  return (
    <div className="flex gap-2">
      <input value={elaan} onChange={(e) => setElaan(e.target.value)} placeholder="Foran elaan…" className="field min-w-0 flex-1 px-3.5 py-2.5 text-[15px]" />
      <button onClick={send} disabled={!elaan.trim()} className="btn btn-blurple flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-40">
        <Send size={15} />
      </button>
    </div>
  );
}
