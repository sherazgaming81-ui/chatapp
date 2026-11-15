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
      <p className="text-3xl font-extrabold tabular-nums text-[#f4f6f8]">{value}</p>
      <p className="text-xs font-semibold text-[#8b93a1]">{label}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-sm font-extrabold uppercase tracking-[0.08em] text-[#f4f6f8]">{children}</h2>;
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
        <Stat icon={<Users size={18} />} label="Total members" value={visible.length} color="#23a55a" />
        <Stat icon={<Wifi size={18} />} label="Online now" value={online} color="#00b0f4" />
        <Stat icon={<MessageSquare size={18} />} label="Messages today" value={todayMsgs} color="#4f8cff" />
        <Stat icon={<AlertTriangle size={18} />} label="Banned" value={banned.length} color="#ed4245" />
      </div>

      <div className="card bg-white/80 p-4">
        <SectionTitle>📊 Last 7 days — messages</SectionTitle>
        {weekMsgs === 0 ? (
          <p className="py-4 text-center text-sm text-[#8b93a1]">📊 Data is still being collected</p>
        ) : (
          <div className="flex h-32 items-end gap-2">
            {days.map((d, i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="text-[11px] font-bold tabular-nums text-[#b6bcc7]">{d.count}</span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-[#4f8cff] to-[#3b76d6]"
                  style={{ height: `${Math.max(4, (d.count / maxDay) * 90)}px` }}
                />
                <span className="text-[10px] font-semibold text-[#8b93a1]">{d.label}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-[#8b93a1]"><b className="text-[#f4f6f8]">{weekMsgs}</b> messages · <b className="text-[#f4f6f8]">{active}</b> active members in the last 7 days</p>
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
                  <span className="w-6 text-sm font-extrabold text-[#8b93a1]">{i + 1}</span>
                  <Avatar m={m} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[#f4f6f8]">{t.name}</span>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
                      <span className="block h-full rounded-full bg-[#4f8cff]" style={{ width: `${(t.count / max) * 100}%` }} />
                    </span>
                  </span>
                  <span className="text-xs font-bold tabular-nums text-[#b6bcc7]">{t.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>Members · {visible.length}</SectionTitle>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="field w-40 px-3 py-1.5 text-sm" />
        </div>
        <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {list.map((m) => (
            <button key={m.id} onClick={() => patchUI({ profileId: m.id })} className="card flex w-full items-center gap-3 bg-white/70 px-3 py-2.5 text-left hover:border-[#4f8cff]/40">
              <Avatar m={m} size={38} showDot />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[#f4f6f8]">{m.name}<Badge role={m.role} /></span>
                <span className="block text-xs text-[#8b93a1]">
                  {m.mutedUntil !== undefined ? "🔇 muted" : m.online ? "Online" : "Offline"}
                  {m.warns.length > 0 && ` · ⚠️ ${m.warns.length}`}
                </span>
              </span>
              <span className="text-xs font-semibold text-[#8dbcff]">Manage →</span>
            </button>
          ))}
        </div>
      </div>
      <p className="pb-4 text-center text-xs text-[#8b93a1]">All numbers are 100% real — straight from Supabase 🌱</p>
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
    if (!text.trim() || sel.length === 0) { toast("Write something and select chats", ""); return; }
    const n = await broadcast(text.trim(), sel);
    toast(`Broadcast sent 📢`, `Sent to ${n} chats`);
    setText(""); setSel([]);
  };

  const schedule = () => {
    if (!schedText.trim() || schedChats.length === 0 || !schedAt) { toast("Fill everything in", "Text + time + chats"); return; }
    const at = new Date(schedAt).getTime();
    if (Number.isNaN(at) || at <= Date.now()) { toast("Pick a valid time", "Choose a time in the future"); return; }
    scheduleAnnouncement(schedText.trim(), schedChats, at);
    setSchedText(""); setSchedAt(""); setSchedChats([]);
  };

  return (
    <div className="space-y-5">
      <div className="card bg-gradient-to-r from-[#4f8cff]/[0.06] to-[#3b76d6]/[0.06] p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-[#8dbcff]"><Megaphone size={16} /> Send an announcement (instant)</p>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What do you want to tell everyone…" className="field w-full resize-none px-3.5 py-3 text-[15px]" />
        <p className="mb-1.5 mt-2 text-xs font-bold text-[#b6bcc7]">Where to send:</p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => toggle(c.id, sel, setSel)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${sel.includes(c.id) ? "bg-[#4f8cff] text-white" : "bg-black/[0.06] text-[#b6bcc7]"}`}
            >
              {c.type === "group" ? "👥" : "💬"} {c.name}
            </button>
          ))}
        </div>
        <button onClick={sendBroadcast} disabled={!text.trim() || sel.length === 0} className="btn btn-blurple mt-1 flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-40">
          <Send size={15} /> {sel.length > 0 ? `Send to ${sel.length}` : "Send"}
        </button>
      </div>

      <div className="card bg-white/80 p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-[#8dbcff]"><Timer size={16} /> Schedule ⏰</p>
        <textarea rows={2} value={schedText} onChange={(e) => setSchedText(e.target.value)} placeholder="Write an announcement…" className="field w-full resize-none px-3.5 py-2.5 text-[15px]" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} className="field px-3 py-2 text-sm" />
          <button onClick={schedule} className="btn rounded-xl bg-[#8dbcff] px-4 py-2 text-sm font-bold text-white">Schedule</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => toggle(c.id, schedChats, setSchedChats)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${schedChats.includes(c.id) ? "bg-[#8dbcff] text-white" : "bg-black/[0.06] text-[#b6bcc7]"}`}
            >
              {c.type === "group" ? "👥" : "💬"} {c.name}
            </button>
          ))}
        </div>
        {scheduled.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-xs font-bold text-[#b6bcc7]">Scheduled ({scheduled.length}):</p>
            {scheduled.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
                <Clock size={14} className="shrink-0 text-[#8dbcff]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[#f4f6f8]">{s.text}</span>
                  <span className="block text-[11px] text-[#8b93a1]">{new Date(s.at).toLocaleString()} · {s.chatIds.length} chats</span>
                </span>
                <button onClick={() => { cancelScheduled(s.id); toast("Cancelled", ""); }} className="rounded-lg p-1.5 text-[#ed4245] hover:bg-[#ed4245]/10"><X size={15} /></button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-[#8b93a1]">If the app is open, it will auto-post at that time ⏰</p>
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
        <button onClick={() => setFilter("all")} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter === "all" ? "bg-[#4f8cff] text-white" : "bg-black/[0.06] text-[#b6bcc7]"}`}>
          All ({entries.length})
        </button>
        {Object.keys(pins).map((cid) => (
          <button key={cid} onClick={() => setFilter(cid)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter === cid ? "bg-[#4f8cff] text-white" : "bg-black/[0.06] text-[#b6bcc7]"}`}>
            {chatName(cid)} ({pins[cid].length})
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="py-8 text-center text-sm text-[#8b93a1]">No pinned messages 📌</p>}
      {shown.map((e) => (
        <div key={e.id} className="card flex items-center gap-3 bg-white/80 px-3 py-2.5">
          <Pin size={16} className="shrink-0 text-[#8dbcff]" />
          <button onClick={() => jump(e.chatId, e.id)} className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-bold text-[#f4f6f8]">{e.msg?.text?.slice(0, 80) || "(media)"}</span>
            <span className="block text-[11px] text-[#8b93a1]">{chatName(e.chatId)}</span>
          </button>
          <button onClick={() => jump(e.chatId, e.id)} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#8dbcff] hover:bg-[#4f8cff]/15">Jump →</button>
          <button onClick={() => { togglePin(e.chatId, e.id); toast("Unpinned", ""); }} className="rounded-lg p-1.5 text-[#ed4245] hover:bg-[#ed4245]/10"><X size={15} /></button>
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
    toast(sec > 0 ? `Slow mode ON 🐢` : "Slow mode OFF", sec > 0 ? `1 message every ${sec}s` : "");
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#b6bcc7]">How often each member can send 1 message. Doesn't apply to Owner/Admin/Mod. 🐢</p>
      {chats.map((c) => (
        <div key={c.id} className="card bg-white/80 p-4">
          <p className="mb-2 text-sm font-extrabold text-[#f4f6f8]">👥 {c.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {SLOW_OPTS.map((sec) => (
              <button
                key={sec}
                onClick={() => set(c.id, sec)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${(vals[c.id] || 0) === sec ? "bg-[#4f8cff] text-white" : "bg-black/[0.06] text-[#b6bcc7]"}`}
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
      <div className="card bg-[#4f8cff]/[0.05] p-3">
        {ROLES.map((r) => (
          <p key={r.id} className="py-0.5 text-xs text-[#b6bcc7]"><b className="text-[#f4f6f8]">{r.label}</b> — {r.desc}</p>
        ))}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a member…" className="field w-full px-3 py-2 text-sm" />
      <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
        {list.map((m) => (
          <div key={m.id} className="card flex items-center gap-3 bg-white/70 px-3 py-2.5">
            <Avatar m={m} size={36} />
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#f4f6f8]">{m.name}</span>
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
    toast("Auto-mod saved 🛡️", "");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {chats.map((c) => (
          <button key={c.id} onClick={() => setChatId(c.id)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${chatId === c.id ? "bg-[#4f8cff] text-white" : "bg-black/[0.06] text-[#b6bcc7]"}`}>
            👥 {c.name}
          </button>
        ))}
      </div>
      {loaded && chatId && (
        <div className="card space-y-3 bg-white/80 p-4">
          <div>
            <p className="mb-1.5 text-xs font-bold text-[#b6bcc7]">Banned words (separate with commas):</p>
            <textarea rows={3} value={words} onChange={(e) => setWords(e.target.value)} placeholder="word1, word2, word3…" className="field w-full resize-none px-3 py-2.5 text-sm" />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-[#b6bcc7]">If someone sends a banned word:</p>
            <div className="flex gap-1.5">
              {(["warn", "delete", "both"] as const).map((a) => (
                <button key={a} onClick={() => setAction(a)} className={`rounded-full px-4 py-1.5 text-xs font-bold ${action === a ? "bg-[#ed4245] text-white" : "bg-black/[0.06] text-[#b6bcc7]"}`}>
                  {a === "warn" ? "⚠️ Warn" : a === "delete" ? "🗑️ Delete" : "⚠️🗑️ Both"}
                </button>
              ))}
            </div>
          </div>
          <button onClick={save} className="btn btn-blurple px-5 py-2.5 text-sm">Save</button>
          <p className="text-[11px] text-[#8b93a1]">Auto-mod doesn't apply to staff (owner/admin/mod).</p>
        </div>
      )}
    </div>
  );
}

/* ───────── H16 — Audit Log ───────── */
const ACTION_META: Record<string, { icon: string; color: string }> = {
  ban: { icon: "🔨", color: "#ed4245" }, unban: { icon: "✅", color: "#23a55a" },
  mute: { icon: "🔇", color: "#f0a020" }, unmute: { icon: "🔊", color: "#23a55a" },
  warn: { icon: "⚠️", color: "#f0a020" }, role: { icon: "🛡️", color: "#4f8cff" },
  slowmode: { icon: "🐢", color: "#00b0f4" }, automod: { icon: "🛡️", color: "#8dbcff" },
  broadcast: { icon: "📢", color: "#4f8cff" },
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
          <button key={a} onClick={() => setFilter(a)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter === a ? "bg-[#4f8cff] text-white" : "bg-black/[0.06] text-[#b6bcc7]"}`}>
            {a === "all" ? `All (${log.length})` : `${ACTION_META[a]?.icon || "•"} ${a}`}
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="py-8 text-center text-sm text-[#8b93a1]">No actions yet 📋</p>}
      <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
        {shown.map((e) => {
          const meta = ACTION_META[e.action] || { icon: "•", color: "#80848e" };
          return (
            <div key={e.id} className="card flex items-start gap-2.5 bg-white/70 px-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm" style={{ background: meta.color + "1f" }}>{meta.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-[#f4f6f8]">
                  <b>{e.byName}</b> <b style={{ color: meta.color }}>{e.action}</b>
                  {e.targetName && <> → <b>{e.targetName}</b></>}
                </span>
                {e.reason && <span className="block truncate text-xs text-[#8b93a1]">{e.reason}</span>}
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
            <span className="text-sm font-extrabold text-[#8dbcff]">{c.v}</span>
            <span className="text-[11px] text-[#8b93a1]">{c.date}</span>
          </p>
          <ul className="mt-1.5 space-y-1">
            {c.items.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[#f4f6f8]">
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
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#111114]/70 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-4">
          <button onClick={() => patchUI({ tab: "chat" })} className="rounded-md p-2 text-[#b6bcc7] hover:bg-white/[0.06]"><ArrowLeft size={20} /></button>
          <h1 className="text-[16px] font-extrabold tracking-tight text-[#f4f6f8]">Owner dashboard 👑</h1>
        </div>
        <div className="thin-scroll flex gap-1 overflow-x-auto px-3 pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${tab === t.id ? "bg-[#4f8cff] text-white" : "bg-white/[0.05] text-[#b6bcc7] hover:bg-black/[0.08]"}`}
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
          <div className="card bg-gradient-to-r from-[#4f8cff]/[0.06] to-[#3b76d6]/[0.06] p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-[#8dbcff]"><Megaphone size={16} /> Quick announcement (main group)</p>
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
    toast("Announcement sent", "Everyone will see it");
  };
  return (
    <div className="flex gap-2">
      <input value={elaan} onChange={(e) => setElaan(e.target.value)} placeholder="Instant announcement…" className="field min-w-0 flex-1 px-3.5 py-2.5 text-[15px]" />
      <button onClick={send} disabled={!elaan.trim()} className="btn btn-blurple flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-40">
        <Send size={15} />
      </button>
    </div>
  );
}
