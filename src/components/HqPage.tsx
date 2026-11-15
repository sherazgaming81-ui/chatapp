"use client";
// ═══════════════════════════════════════════════════════════════════════════
// Business HQ — OWNER only (Symbiote Systems control room)
// Tabs: CRM (pipeline board) · Outreach (email/DM queues) · Posting · Report
// Data: src/lib/crm.ts → supabase/crm-upgrade.sql tables.
// Members never render this page (owner check in App.tsx + guard here).
// UI language: English only (owner rule).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, X, Plus, Send, Mail, MessageCircle, CalendarClock, BarChart3, LayoutGrid, List, Trash2, Check, Copy, Link2, Download, Upload, Search, FileText, Info, ArrowLeftRight, Clock, ListTodo, CalendarDays, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { useStore, toast } from "@/lib/store";
import {
  CRM_KINDS, CRM_STAGES, KIND_LABEL, STAGE_LABEL, PRIORITY_LABEL,
  listContacts, createContact, updateContact, moveStage, deleteContact,
  listOutreach, canSendTo, recordOutreach, outreachTemplate,
  listPosts, queuePost, setPostStatus, deletePost,
  getDailyReport, upsertDailyReport, computeTodayStats, todayKey, subscribeCrm, crmTablesReady,
  getThreadsAccount, getThreadsAccounts, type SocialAccountStatus,
  computeLeadScore, LEAD_SCORE_RULE, addActivity, listActivities,
  exportContactsCsv, importContactsCsv,
  type CrmContact, type CrmKind, type CrmStage, type CrmPriority, type CrmActivity, type CrmOutreach, type CrmPost, type OutreachChannel, type PostPlatform,
} from "@/lib/crm";
import { supabase } from "@/lib/supabase";
import NotificationsBell from "@/components/NotificationsBell";
import {
  listTasks, createTask, updateTask, completeTask, reopenTask, deleteTask, tasksTableReady,
  type CrmTask, type TaskPriority,
} from "@/lib/tasks";

type HqTab = "crm" | "tasks" | "outreach" | "posting" | "report";

const KIND_COLOR: Record<CrmKind, string> = {
  client: "bg-[#23a55a]/20 text-[#4ade80]",
  partner: "bg-[#4f8cff]/20 text-[#8dbcff]",
  affiliate: "bg-[#f5a623]/20 text-[#fbbf24]",
  lead: "bg-white/10 text-[#b6bcc7]",
};

const inputCls = "field w-full px-3 py-2 text-sm";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#93A0B4]";

/* Phase 2 helpers */
const PRIORITY_DOT: Record<CrmPriority, string> = {
  high: "bg-[#ed4245]",
  medium: "bg-[#f5a623]",
  low: "bg-[#93A0B4]",
};
const fmtNum = (n: number) => (Number(n) || 0).toLocaleString("en-US");
/** ms epoch → datetime-local input value (local time) */
const toLocalInput = (ms: number): string => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function HqPage() {
  const meId = useStore((s) => s.me);
  const me = useStore((s) => s.members.find((m) => m.id === s.me));
  const isOwner = me?.role === "owner";

  const [tab, setTab] = useState<HqTab>("crm");
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [outreach, setOutreach] = useState<CrmOutreach[]>([]);
  const [posts, setPosts] = useState<CrmPost[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [tablesReady, setTablesReady] = useState(true);
  const [taskTablesReady, setTaskTablesReady] = useState(true);
  const [selected, setSelected] = useState<CrmContact | null>(null);
  const refreshTimer = useRef<any>(null);

  // Command Center / notifications se ane wala navigation signal
  const hqNav = useStore((s) => s.ui.hqNav);
  const [pendingContactId, setPendingContactId] = useState<string | null>(null);
  const [formNonce, setFormNonce] = useState(0);
  const [taskFormNonce, setTaskFormNonce] = useState(0);
  useEffect(() => {
    if (!hqNav) return;
    setTab(hqNav.section);
    if (hqNav.contactId) setPendingContactId(hqNav.contactId);
    if (hqNav.newContact) {
      // "Add Lead" → CRM form; "Add Task" → Tasks form (alag nonce, cross-talk nahi)
      if (hqNav.section === "tasks") setTaskFormNonce((n) => n + 1);
      else setFormNonce((n) => n + 1);
    }
  }, [hqNav]);
  // contacts load ho jayen to pending contact ka drawer khol do
  useEffect(() => {
    if (!pendingContactId) return;
    const c = contacts.find((x) => x.id === pendingContactId);
    if (c) {
      setSelected(c);
      setPendingContactId(null);
    }
  }, [pendingContactId, contacts]);

  const refresh = useCallback(async () => {
    const [c, o, p, t] = await Promise.all([listContacts(), listOutreach(), listPosts(), listTasks()]);
    setContacts(c);
    setOutreach(o);
    setPosts(p);
    setTasks(t);
    setTablesReady(crmTablesReady);
    setTaskTablesReady(tasksTableReady);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    refresh();
    // Realtime — refresh when the CRM tables change (light debounce)
    const off = subscribeCrm(() => {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(refresh, 400);
    });
    // crm_tasks ka apna channel (subscribeCrm use nahi karta) — table na ho
    // to bhi crash nahi, sirf events nahi ayenge
    let taskChannel: any = null;
    try {
      taskChannel = supabase()
        .channel("crm-tasks-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "crm_tasks" }, () => {
          clearTimeout(refreshTimer.current);
          refreshTimer.current = setTimeout(refresh, 400);
        })
        .subscribe();
    } catch { /* ignore */ }
    return () => {
      off();
      if (taskChannel) { try { supabase().removeChannel(taskChannel); } catch { /* ignore */ } }
    };
  }, [isOwner, refresh]);

  // fresh copy of the selected contact (drawer stays current after stage changes)
  const selectedLive = selected ? contacts.find((c) => c.id === selected.id) || null : null;

  if (!isOwner) {
    return (
      <div className="panel flex flex-1 items-center justify-center rounded-2xl p-8 text-center">
        <p className="text-sm font-semibold text-[#93A0B4]">This section is for the owner only.</p>
      </div>
    );
  }

  const stats = computeTodayStats(contacts, outreach, posts);

  return (
    <div className="panel relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl">
      <header className="glass-bar flex h-14 shrink-0 items-center gap-2 border-b border-[#27334D] px-3 sm:px-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#4f8cff] to-[#3b76d6] text-white glow-accent">
          <Briefcase size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-extrabold tracking-tight text-[#f4f6f8]">Business HQ</h1>
          <p className="truncate text-xs text-[#93A0B4]">Symbiote Systems — CRM · Tasks · Outreach · Posting · Report (owner only)</p>
        </div>
        <span className="hidden shrink-0 rounded-full bg-white/[0.06] px-3 py-1 text-xs font-bold text-[#b6bcc7] sm:block">
          {contacts.length} contacts · {stats.postsQueued} posts queued
        </span>
        <NotificationsBell placement="header" />
      </header>

      {/* HQ tabs */}
      <div className="flex shrink-0 gap-1 border-b border-[#27334D] px-3 py-2">
        {([
          { id: "crm", label: "CRM", icon: LayoutGrid },
          { id: "tasks", label: "Tasks", icon: ListTodo },
          { id: "outreach", label: "Outreach", icon: Send },
          { id: "posting", label: "Posting", icon: CalendarClock },
          { id: "report", label: "Daily Report", icon: BarChart3 },
        ] as { id: HqTab; label: string; icon: any }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold transition ${tab === t.id ? "bg-[#4f8cff] text-white glow-accent" : "text-[#93A0B4] hover:bg-white/[0.06] hover:text-[#f4f6f8]"}`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {!tablesReady && !loading && (
        <div className="mx-3 mt-3 shrink-0 rounded-xl border border-[#f5a623]/30 bg-[#f5a623]/10 px-4 py-3 text-[13px] font-semibold text-[#fbbf24]">
          The CRM tables aren't in the database yet — run <span className="font-mono">supabase/crm-upgrade.sql</span> first. Lists will appear empty until then; the app itself works fine.
        </div>
      )}

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => <div key={i} className="skel h-16 w-full" />)}
          </div>
        ) : tab === "crm" ? (
          <CrmBoard contacts={contacts} onAdd={async (c) => { setContacts((p) => [c, ...p]); }} onSelect={setSelected} formNonce={formNonce} refresh={refresh} />
        ) : tab === "tasks" ? (
          <TasksTab tasks={tasks} contacts={contacts} posts={posts} tablesReady={taskTablesReady} formNonce={taskFormNonce} onSelectContact={setSelected} refresh={refresh} />
        ) : tab === "outreach" ? (
          <OutreachTab contacts={contacts} outreach={outreach} refresh={refresh} />
        ) : tab === "posting" ? (
          <PostingTab posts={posts} contacts={contacts} refresh={refresh} />
        ) : (
          <ReportTab contacts={contacts} outreach={outreach} posts={posts} />
        )}
      </div>

      {selectedLive && (
        <ContactDrawer
          contact={selectedLive}
          outreach={outreach.filter((o) => o.contactId === selectedLive.id)}
          tasks={tasks.filter((t) => t.contactId === selectedLive.id)}
          onClose={() => setSelected(null)}
          refresh={refresh}
        />
      )}
    </div>
  );
}

/* ─────────────────────────── CRM BOARD ─────────────────────────── */
function CrmBoard({ contacts, onAdd, onSelect, formNonce = 0, refresh }: { contacts: CrmContact[]; onAdd: (c: CrmContact) => void; onSelect: (c: CrmContact) => void; formNonce?: number; refresh: () => Promise<void> }) {
  const [formOpen, setFormOpen] = useState(false);
  // Command Center "Add Lead" — signal aye to form khol do
  useEffect(() => {
    if (formNonce > 0) setFormOpen(true);
  }, [formNonce]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CrmKind>("lead");
  const [ig, setIg] = useState("");
  const [email, setEmail] = useState("");
  const [wa, setWa] = useState("");
  const [source, setSource] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Phase 2 — view, filters, drag-and-drop, import
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | CrmKind>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | CrmPriority>("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<CrmStage | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    setErr("");
    if (!name.trim() && !ig.trim() && !email.trim()) { setErr("Give at least one of: name, Instagram username, or email."); return; }
    setBusy(true);
    try {
      const c = await createContact({ kind, name: name.trim() || ig.trim() || email.trim(), instagramUsername: ig, email, whatsapp: wa, source: source.trim() || "manual" });
      onAdd(c);
      setName(""); setIg(""); setEmail(""); setWa(""); setSource("");
      setFormOpen(false);
      toast("Contact added", c.name);
    } catch (e: any) {
      // The dedupe lock's friendly error shows up here
      setErr(e?.message || "Couldn't add the contact");
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => contacts.filter((c) => {
    if (kindFilter !== "all" && c.kind !== kindFilter) return false;
    if (priorityFilter !== "all" && c.priority !== priorityFilter) return false;
    const q = query.trim().toLowerCase();
    if (q) {
      const hay = `${c.name} ${c.instagramUsername || ""} ${c.email || ""} ${c.whatsapp || ""} ${c.tags.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [contacts, kindFilter, priorityFilter, query]);

  // Metrics — sab asal data se (koi fake number nahi)
  const metrics = useMemo(() => {
    const total = contacts.length;
    const pipelineValue = contacts.filter((c) => c.stage !== "done" && c.stage !== "lost").reduce((s, c) => s + (c.dealValue || 0), 0);
    const won = contacts.filter((c) => c.stage === "client" || c.stage === "done").length;
    const lost = contacts.filter((c) => c.stage === "lost").length;
    const conversion = total ? Math.round((won / total) * 100) : 0;
    return { total, pipelineValue, won, lost, conversion };
  }, [contacts]);

  // Follow-ups due: follow_up_at aaj ya pehle, aur stage done/lost nahi
  const dueFollowUps = useMemo(() => {
    const now = Date.now();
    return contacts
      .filter((c) => c.followUpAt && c.followUpAt <= now && c.stage !== "done" && c.stage !== "lost")
      .sort((a, b) => (a.followUpAt || 0) - (b.followUpAt || 0));
  }, [contacts]);

  const dropOnStage = async (stage: CrmStage) => {
    const id = dragId;
    setDragId(null);
    setDropStage(null);
    if (!id) return;
    const c = contacts.find((x) => x.id === id);
    if (!c || c.stage === stage) return;
    try {
      await moveStage(id, stage);
      toast("Stage changed", `${c.name} → ${STAGE_LABEL[stage]}`);
      refresh();
    } catch (e: any) {
      toast("Couldn't move the card", e?.message || "");
    }
  };

  const doImport = async (f: File) => {
    setImporting(true);
    try {
      const text = await f.text();
      const res = await importContactsCsv(text, contacts);
      toast("Import finished", `${res.imported} imported · ${res.skipped} duplicates skipped · ${res.errors} errors`);
      refresh();
    } catch {
      toast("Import failed", "Couldn't read that file");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const metricCards: [string, string][] = [
    ["Total contacts", fmtNum(metrics.total)],
    ["Pipeline value", fmtNum(metrics.pipelineValue)],
    ["Conversion rate", `${metrics.conversion}%`],
    ["Clients won", fmtNum(metrics.won)],
    ["Lost", fmtNum(metrics.lost)],
  ];

  return (
    <div className="p-3 sm:p-4">
      {/* Metrics row — real data only */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {metricCards.map(([label, v]) => (
          <div key={label} className="rounded-2xl border border-[#27334D] bg-[#1B2638] px-3.5 py-3">
            <p className="text-xl font-extrabold tracking-tight text-[#f4f6f8]">{v}</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#93A0B4]">{label}</p>
          </div>
        ))}
      </div>

      {/* Follow-ups due strip */}
      {dueFollowUps.length > 0 && (
        <div className="mb-4 rounded-2xl border border-[#f5a623]/30 bg-[#f5a623]/10 px-4 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-extrabold text-[#fbbf24]"><Clock size={14} /> Follow-ups due ({dueFollowUps.length})</p>
          <div className="flex flex-wrap gap-2">
            {dueFollowUps.map((c) => (
              <button key={c.id} onClick={() => onSelect(c)} className="rounded-full border border-[#f5a623]/30 bg-black/20 px-3 py-1.5 text-xs font-bold text-[#f4f6f8] transition hover:border-[#f5a623]/60">
                {c.name} <span className="font-semibold text-[#fbbf24]">· {new Date(c.followUpAt!).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-[13px] font-semibold text-[#93A0B4]">Pipeline — drag a card to change its stage, or click to open details. Duplicate usernames and emails are blocked by the database itself.</p>
        <button onClick={() => setFormOpen((v) => !v)} className="btn btn-blurple flex shrink-0 items-center gap-1.5 px-3.5 py-2 text-[13px]">
          <Plus size={15} /> New contact
        </button>
      </div>

      {/* Toolbar: search + filters + view toggle + import/export */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-[260px]">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#93A0B4]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputCls} pl-8`} placeholder="Search name, @username, email, tag…" />
        </div>
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as "all" | CrmKind)} className="field px-2.5 py-2 text-[13px]">
          <option value="all">All types</option>
          {CRM_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as "all" | CrmPriority)} className="field px-2.5 py-2 text-[13px]">
          <option value="all">All priorities</option>
          {(["high", "medium", "low"] as CrmPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-[#27334D]">
          <button onClick={() => setView("kanban")} className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold transition ${view === "kanban" ? "bg-[#4f8cff] text-white" : "text-[#93A0B4] hover:bg-white/[0.06]"}`} title="Kanban view"><LayoutGrid size={14} /> Kanban</button>
          <button onClick={() => setView("list")} className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold transition ${view === "list" ? "bg-[#4f8cff] text-white" : "text-[#93A0B4] hover:bg-white/[0.06]"}`} title="List view"><List size={14} /> List</button>
        </div>
        <span className="mx-0.5 hidden h-6 w-px bg-[#27334D] sm:block" />
        <button onClick={() => exportContactsCsv(contacts)} className="btn btn-ghost flex items-center gap-1.5 px-3 py-2 text-[13px]"><Download size={14} /> Export CSV</button>
        <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn btn-ghost flex items-center gap-1.5 px-3 py-2 text-[13px] disabled:opacity-60"><Upload size={14} /> {importing ? "Importing…" : "Import CSV"}</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); }} />
      </div>

      {formOpen && (
        <div className="pop-in mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className={labelCls}>Name</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Ahmed Raza" /></div>
            <div><label className={labelCls}>Type</label>
              <select value={kind} onChange={(e) => setKind(e.target.value as CrmKind)} className={inputCls}>
                {CRM_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Instagram username</label><input value={ig} onChange={(e) => setIg(e.target.value)} className={inputCls} placeholder="without @" /></div>
            <div><label className={labelCls}>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="name@example.com" /></div>
            <div><label className={labelCls}>WhatsApp</label><input value={wa} onChange={(e) => setWa(e.target.value)} className={inputCls} placeholder="+92..." /></div>
            <div><label className={labelCls}>Source</label><input value={source} onChange={(e) => setSource(e.target.value)} className={inputCls} placeholder="instagram / website / referral" /></div>
          </div>
          {err && <p className="mt-3 rounded-lg bg-[#ed4245]/15 px-3 py-2 text-[13px] font-bold text-[#ff8589]">{err}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={submit} disabled={busy} className="btn btn-blurple px-4 py-2 text-sm disabled:opacity-60">{busy ? "Adding…" : "Add contact"}</button>
            <button onClick={() => setFormOpen(false)} className="btn btn-ghost px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {view === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-2 thin-scroll">
          {CRM_STAGES.map((stage) => {
            const list = filtered.filter((c) => c.stage === stage);
            const stageValue = list.reduce((s, c) => s + (c.dealValue || 0), 0);
            return (
              <div
                key={stage}
                onDragOver={(e) => { e.preventDefault(); if (dropStage !== stage) setDropStage(stage); }}
                onDragLeave={() => { if (dropStage === stage) setDropStage(null); }}
                onDrop={(e) => { e.preventDefault(); dropOnStage(stage); }}
                className={`flex w-[240px] shrink-0 flex-col rounded-2xl border p-2.5 transition ${dropStage === stage ? "border-[#4f8cff] bg-[#4f8cff]/[0.07]" : "border-white/[0.07] bg-white/[0.02]"}`}
              >
                <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#93A0B4]">
                  {STAGE_LABEL[stage]} — {list.length}
                  {stageValue > 0 && <span className="normal-case tracking-normal text-[#8dbcff]"> · {fmtNum(stageValue)}</span>}
                </p>
                <div className="min-h-[40px] space-y-2">
                  {list.map((c) => {
                    const score = computeLeadScore(c);
                    const overdue = c.followUpAt ? c.followUpAt <= Date.now() : false;
                    return (
                      <div
                        key={c.id}
                        draggable
                        onDragStart={(e) => { setDragId(c.id); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", c.id); } catch { /* ignore */ } }}
                        onDragEnd={() => { setDragId(null); setDropStage(null); }}
                        onClick={() => onSelect(c)}
                        className={`w-full cursor-pointer rounded-xl border border-[#27334D] bg-[#1B2638] p-3 text-left transition hover:border-[#4f8cff]/50 ${dragId === c.id ? "opacity-50" : ""}`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[c.priority]}`} title={`${PRIORITY_LABEL[c.priority]} priority`} />
                          <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#f4f6f8]">{c.name || "—"}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${KIND_COLOR[c.kind]}`}>{KIND_LABEL[c.kind]}</span>
                        </span>
                        {c.instagramUsername && <span className="mt-1 block truncate text-xs text-[#93A0B4]">@{c.instagramUsername}</span>}
                        {c.email && <span className="block truncate text-xs text-[#93A0B4]">{c.email}</span>}
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {c.dealValue > 0 && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-[#b6bcc7]">{fmtNum(c.dealValue)}</span>}
                          {score > 0 && <span className="rounded-full bg-[#4f8cff]/15 px-2 py-0.5 text-[10px] font-bold text-[#8dbcff]">Score {score}</span>}
                          {c.followUpAt && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${overdue ? "bg-[#ed4245]/15 text-[#ff8589]" : "bg-white/[0.06] text-[#93A0B4]"}`}>
                              Follow-up {new Date(c.followUpAt).toLocaleDateString()}
                            </span>
                          )}
                        </span>
                        {c.source && <span className="mt-1.5 block text-[11px] text-[#93A0B4]/70">via {c.source}</span>}
                      </div>
                    );
                  })}
                  {list.length === 0 && <p className="px-1 py-2 text-xs text-[#93A0B4]/60">Empty — drop cards here</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.07] thin-scroll">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#27334D] text-[11px] uppercase tracking-[0.08em] text-[#93A0B4]">
                <th className="px-3.5 py-2.5 font-bold">Name</th>
                <th className="px-3 py-2.5 font-bold">Type</th>
                <th className="px-3 py-2.5 font-bold">Stage</th>
                <th className="px-3 py-2.5 font-bold">Priority</th>
                <th className="px-3 py-2.5 font-bold">Deal value</th>
                <th className="px-3 py-2.5 font-bold">Score</th>
                <th className="px-3 py-2.5 font-bold">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const overdue = c.followUpAt ? c.followUpAt <= Date.now() : false;
                return (
                  <tr key={c.id} onClick={() => onSelect(c)} className="cursor-pointer border-b border-white/[0.04] transition hover:bg-white/[0.03]">
                    <td className="px-3.5 py-2.5">
                      <span className="font-bold text-[#f4f6f8]">{c.name || "—"}</span>
                      {(c.instagramUsername || c.email) && <span className="block text-xs text-[#93A0B4]">{c.instagramUsername ? `@${c.instagramUsername}` : c.email}</span>}
                    </td>
                    <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${KIND_COLOR[c.kind]}`}>{KIND_LABEL[c.kind]}</span></td>
                    <td className="px-3 py-2.5 text-[#b6bcc7]">{STAGE_LABEL[c.stage]}</td>
                    <td className="px-3 py-2.5"><span className="flex items-center gap-1.5 text-[#b6bcc7]"><span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[c.priority]}`} />{PRIORITY_LABEL[c.priority]}</span></td>
                    <td className="px-3 py-2.5 text-[#b6bcc7]">{c.dealValue > 0 ? fmtNum(c.dealValue) : "—"}</td>
                    <td className="px-3 py-2.5 text-[#b6bcc7]">{computeLeadScore(c) || "—"}</td>
                    <td className={`px-3 py-2.5 ${overdue ? "font-bold text-[#ff8589]" : "text-[#b6bcc7]"}`}>{c.followUpAt ? new Date(c.followUpAt).toLocaleDateString() : "—"}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-3.5 py-6 text-center text-[13px] text-[#93A0B4]">No contacts match the current search/filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────── Partner one-tap posting link ───────────
   Partner/affiliate contacts only. The signed link comes from a SERVER
   route (the HMAC secret never reaches the client) — the owner copies it
   and sends it to the partner; on that page the partner sees their ready
   posts and posts them one-tap (no OAuth — the one-tap model). */
function PartnerThreadsLink({ contactId }: { contactId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    setUrl(null); setErr("");
    (async () => {
      try {
        const { data } = await supabase().auth.getSession();
        const token = data.session?.access_token;
        if (!token) { if (live) setErr("Session not found — please log in again."); return; }
        const r = await fetch("/api/partners/connect-link", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ contactId }),
        });
        const j: any = await r.json().catch(() => null);
        if (!live) return;
        if (r.ok && j?.url) setUrl(j.url);
        else if (j?.error === "not_configured") setErr("Server setup is incomplete (POSTING_CRON_SECRET) — finish the steps in THREADS-SETUP.md first.");
        else setErr("Couldn't generate the link — please try again.");
      } catch { if (live) setErr("Couldn't generate the link — check your connection."); }
    })();
    return () => { live = false; };
  }, [contactId]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Link copied", "Send it to the partner on WhatsApp");
      setTimeout(() => setCopied(false), 2000);
    } catch { toast("Couldn't copy", "Select the link and copy it manually"); }
  };

  return (
    <div className="mt-6">
      <label className={labelCls}>Partner posting link (one-tap)</label>
      <p className="mb-2 text-xs leading-relaxed text-[#93A0B4]">
        Send this signed link to the partner — on that page they'll see today's ready posts, post each one with "Post on Threads", and mark it as posted. No account connection needed. (Partners/affiliates only.)
      </p>
      {err ? (
        <p className="rounded-lg bg-[#ed4245]/15 px-3 py-2 text-[13px] font-bold text-[#ff8589]">{err}</p>
      ) : url ? (
        <div className="flex items-center gap-2">
          <input readOnly value={url} onFocus={(e) => e.target.select()} className={`${inputCls} flex-1 font-mono text-xs`} />
          <button onClick={copy} className="btn btn-blurple flex shrink-0 items-center gap-1.5 px-3 py-2 text-[13px]">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-[13px] text-[#93A0B4]"><Link2 size={14} /> Generating link…</p>
      )}
    </div>
  );
}

/* ─────────────────────────── CONTACT DRAWER ─────────────────────────── */
function ContactDrawer({ contact, outreach, tasks, onClose, refresh }: { contact: CrmContact; outreach: CrmOutreach[]; tasks: CrmTask[]; onClose: () => void; refresh: () => Promise<void> }) {
  const [notes, setNotes] = useState(contact.notes);
  const [busy, setBusy] = useState(false);
  // Phase 2 fields
  const [dealValue, setDealValue] = useState(contact.dealValue ? String(contact.dealValue) : "");
  const [priority, setPriority] = useState<CrmPriority>(contact.priority);
  const [tags, setTags] = useState<string[]>(contact.tags);
  const [tagInput, setTagInput] = useState("");
  const [followUp, setFollowUp] = useState(contact.followUpAt ? toLocalInput(contact.followUpAt) : "");
  const [source, setSource] = useState(contact.source);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

  useEffect(() => {
    setNotes(contact.notes);
    setDealValue(contact.dealValue ? String(contact.dealValue) : "");
    setPriority(contact.priority);
    setTags(contact.tags);
    setTagInput("");
    setFollowUp(contact.followUpAt ? toLocalInput(contact.followUpAt) : "");
    setSource(contact.source);
    setNoteText("");
  }, [contact.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true;
    listActivities(contact.id).then((a) => { if (live) setActivities(a); }).catch(() => {});
    return () => { live = false; };
  }, [contact.id]);

  const saveDetails = async () => {
    setBusy(true);
    try {
      await updateContact(contact.id, {
        notes,
        source: source.trim(),
        dealValue: Number(dealValue) || 0,
        priority,
        tags,
        followUpAt: followUp ? new Date(followUp).getTime() : null,
      });
      toast("Details saved", "");
      refresh();
    } catch (e: any) { toast("Couldn't save", e?.message || ""); }
    setBusy(false);
  };
  const changeStage = async (stage: CrmStage) => {
    try {
      await moveStage(contact.id, stage);
      toast("Stage changed", STAGE_LABEL[stage]);
      refresh();
      listActivities(contact.id).then(setActivities).catch(() => {});
    } catch (e: any) { toast("Stage couldn't be changed", e?.message || ""); }
  };
  const remove = async () => {
    try { await deleteContact(contact.id); toast("Contact deleted", contact.name); onClose(); refresh(); }
    catch (e: any) { toast("Couldn't delete", e?.message || ""); }
  };

  const addTag = (raw: string) => {
    const t = raw.trim().replace(/,+$/, "").trim();
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) setTags((p) => [...p, t]);
    setTagInput("");
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setNoteBusy(true);
    try {
      await addActivity(contact.id, "note", noteText.trim());
      setNoteText("");
      setActivities(await listActivities(contact.id));
      toast("Note added", "");
    } catch { toast("Couldn't add the note", ""); }
    setNoteBusy(false);
  };

  const score = computeLeadScore(contact);

  // Unified timeline: activities + outreach log, newest first
  type TimelineItem = { key: string; at: number; kind: string; title: string; body: string };
  const timeline: TimelineItem[] = [
    ...activities.map((a): TimelineItem => ({
      key: `a-${a.id}`,
      at: a.createdAt,
      kind: a.kind,
      title: a.kind === "stage" ? "Stage" : a.kind === "outreach" ? "Outreach" : a.kind === "system" ? "System" : "Note",
      body: a.body,
    })),
    ...outreach.map((o): TimelineItem => ({
      key: `o-${o.id}`,
      at: o.sentAt,
      kind: "outreach-log",
      title: `${o.channel} — first message`,
      body: o.body,
    })),
  ].sort((x, y) => y.at - x.at);

  const timelineIcon = (kind: string) =>
    kind === "stage" ? <ArrowLeftRight size={13} /> :
    kind === "note" ? <FileText size={13} /> :
    kind === "system" ? <Info size={13} /> :
    <Send size={13} />;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <div className="pop-in fixed inset-x-3 bottom-3 top-auto z-50 max-h-[86dvh] overflow-y-auto rounded-2xl border border-white/10 bg-[#141C2B] p-5 soft-shadow sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-4 sm:w-[400px] thin-scroll">
        <div className="mb-1 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-extrabold text-[#f4f6f8]">{contact.name || "—"}</h3>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${KIND_COLOR[contact.kind]}`}>{KIND_LABEL[contact.kind]}</span>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#93A0B4] hover:bg-white/[0.06] hover:text-[#f4f6f8]" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="mt-3 space-y-1.5 text-sm text-[#b6bcc7]">
          {contact.instagramUsername && <p>Instagram: <span className="font-semibold text-[#f4f6f8]">@{contact.instagramUsername}</span></p>}
          {contact.email && <p>Email: <span className="font-semibold text-[#f4f6f8]">{contact.email}</span></p>}
          {contact.whatsapp && <p>WhatsApp: <span className="font-semibold text-[#f4f6f8]">{contact.whatsapp}</span></p>}
          <p className="text-xs text-[#93A0B4]">Added: {new Date(contact.createdAt).toLocaleDateString()}{contact.lastContactedAt ? ` · Last contacted: ${new Date(contact.lastContactedAt).toLocaleDateString()}` : ""}</p>
        </div>

        {/* Lead score */}
        <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#93A0B4]">Lead score</p>
            <p className="text-sm font-extrabold text-[#f4f6f8]">{score}<span className="text-xs font-bold text-[#93A0B4]"> / 100</span></p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div className="h-full rounded-full bg-[#4f8cff] transition-all" style={{ width: `${score}%` }} />
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-semibold text-[#8dbcff]">How is this calculated?</summary>
            <p className="mt-1 text-xs leading-relaxed text-[#93A0B4]">{LEAD_SCORE_RULE}</p>
          </details>
        </div>

        <label className={`${labelCls} mt-5`}>Stage</label>
        <div className="flex flex-wrap gap-1.5">
          {CRM_STAGES.map((s) => (
            <button key={s} onClick={() => changeStage(s)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${contact.stage === s ? "bg-[#4f8cff] text-white" : "bg-white/[0.06] text-[#93A0B4] hover:text-[#f4f6f8]"}`}>
              {STAGE_LABEL[s]}
            </button>
          ))}
        </div>

        {/* Phase 2 fields */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Deal value</label><input type="number" min="0" step="any" value={dealValue} onChange={(e) => setDealValue(e.target.value)} className={inputCls} placeholder="0" /></div>
          <div><label className={labelCls}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as CrmPriority)} className={inputCls}>
              {(["low", "medium", "high"] as CrmPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Source</label><input value={source} onChange={(e) => setSource(e.target.value)} className={inputCls} placeholder="instagram / website / referral" /></div>
          <div><label className={labelCls}>Follow-up date</label><input type="datetime-local" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className={inputCls} /></div>
        </div>

        <label className={`${labelCls} mt-4`}>Tags</label>
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2">
          {tags.map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-full bg-[#4f8cff]/15 px-2 py-0.5 text-xs font-bold text-[#8dbcff]">
              {t}
              <button onClick={() => setTags((p) => p.filter((x) => x !== t))} className="text-[#8dbcff]/70 hover:text-[#f4f6f8]" aria-label={`Remove tag ${t}`}><X size={11} /></button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }}
            onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
            className="min-w-[110px] flex-1 bg-transparent text-sm text-[#f4f6f8] outline-none placeholder:text-[#93A0B4]/60"
            placeholder={tags.length ? "Add tag…" : "Type a tag, press Enter…"}
          />
        </div>

        <label className={`${labelCls} mt-4`}>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} placeholder="Notes about this person…" />
        <button onClick={saveDetails} disabled={busy} className="btn btn-blurple mt-2 px-4 py-2 text-sm disabled:opacity-60">{busy ? "Saving…" : "Save details"}</button>

        {(contact.kind === "partner" || contact.kind === "affiliate") && (
          <PartnerThreadsLink contactId={contact.id} />
        )}

        {/* Tasks linked to this contact + quick add (Phase 3) */}
        <DrawerTasks contact={contact} tasks={tasks} refresh={refresh} />

        {/* Add note → activity */}
        <label className={`${labelCls} mt-6`}>Add a note</label>
        <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} className={inputCls} placeholder="Called them, they asked for the demo link…" />
        <button onClick={addNote} disabled={noteBusy || !noteText.trim()} className="btn btn-ghost mt-2 px-4 py-2 text-sm disabled:opacity-60">{noteBusy ? "Adding…" : "Add note"}</button>

        {/* Activity timeline — activities + outreach log merged */}
        <label className={`${labelCls} mt-6`}>Activity timeline</label>
        {timeline.length === 0 ? (
          <p className="text-[13px] text-[#93A0B4]">Nothing yet — notes, stage changes and sent messages will appear here.</p>
        ) : (
          <div className="space-y-2">
            {timeline.map((it) => (
              <div key={it.key} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#8dbcff]">
                  {timelineIcon(it.kind)} {it.title} <span className="font-semibold normal-case tracking-normal text-[#93A0B4]">· {new Date(it.at).toLocaleString()}</span>
                </p>
                {it.body && <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#b6bcc7]">{it.body}</p>}
              </div>
            ))}
          </div>
        )}

        <button onClick={remove} className="mt-6 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-[#ff8589] transition hover:bg-[#ed4245]/10">
          <Trash2 size={15} /> Delete contact
        </button>
      </div>
    </>
  );
}

/* ─────────── Drawer tasks — is contact ki tasks + quick add (Phase 3) ─────────── */
function DrawerTasks({ contact, tasks, refresh }: { contact: CrmContact; tasks: CrmTask[]; refresh: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const open = tasks.filter((t) => t.status === "open").sort((a, b) => (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER));
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const now = Date.now();

  const add = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await createTask({ title: title.trim(), contactId: contact.id, dueAt: due ? new Date(due).getTime() : null });
      setTitle(""); setDue("");
      toast("Task added", contact.name);
      refresh();
    } catch (e: any) { toast("Couldn't add the task", e?.message || ""); }
    setBusy(false);
  };
  const toggle = async (t: CrmTask) => {
    try {
      if (t.status === "open") await completeTask(t.id); else await reopenTask(t.id);
      refresh();
    } catch (e: any) { toast("Couldn't update the task", e?.message || ""); }
  };

  return (
    <div className="mt-6">
      <label className={labelCls}>Tasks {tasks.length > 0 && <span className="normal-case tracking-normal text-[#93A0B4]">({open.length} open{doneCount ? ` · ${doneCount} done` : ""})</span>}</label>
      {open.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {open.map((t) => {
            const overdue = t.dueAt !== null && t.dueAt < now;
            return (
              <div key={t.id} className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                <input type="checkbox" checked={false} onChange={() => toggle(t)} className="h-4 w-4 shrink-0 cursor-pointer accent-[#4f8cff]" title="Mark done" />
                <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`} title={`${PRIORITY_LABEL[t.priority]} priority`} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#f4f6f8]">{t.title}</span>
                {t.dueAt !== null && <span className={`shrink-0 text-[11px] font-bold ${overdue ? "text-[#ff8589]" : "text-[#93A0B4]"}`}>{new Date(t.dueAt).toLocaleDateString()}</span>}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} className={`${inputCls} flex-1`} placeholder={`New task for ${contact.name.split(" ")[0] || "this contact"}…`} />
        <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={`${inputCls} w-[168px] shrink-0`} title="Due date (optional)" />
      </div>
      <button onClick={add} disabled={busy || !title.trim()} className="btn btn-ghost mt-2 flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-60">
        <ListTodo size={14} /> {busy ? "Adding…" : "Add task"}
      </button>
    </div>
  );
}

/* ─────────────────────────── OUTREACH TAB ─────────────────────────── */
function OutreachTab({ contacts, outreach, refresh }: { contacts: CrmContact[]; outreach: CrmOutreach[]; refresh: () => Promise<void> }) {
  const queueFor = (channel: OutreachChannel) =>
    contacts.filter((c) =>
      (c.stage === "new" || c.stage === "contacted") &&
      canSendTo(c.id, channel, outreach) &&
      (channel === "email" ? !!c.email : channel === "dm" ? !!c.instagramUsername : !!c.whatsapp)
    );

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <p className="text-[13px] font-semibold text-[#93A0B4]">
        Today's queues — anyone who has already received a first message on a channel never appears in that queue again (dedupe lock). Pressing "Mark sent" logs it and moves the stage to Contacted.
        <br />Note: actual sending will connect via the Gmail/social connectors — for now the message is prepared and the log is kept.
      </p>
      <QueueList title="Email queue" channel="email" list={queueFor("email")} refresh={refresh} />
      <QueueList title="Instagram DM queue" channel="dm" list={queueFor("dm")} refresh={refresh} />
      <QueueList title="WhatsApp queue" channel="whatsapp" list={queueFor("whatsapp")} refresh={refresh} />
    </div>
  );
}

function QueueList({ title, channel, list, refresh }: { title: string; channel: OutreachChannel; list: CrmContact[]; refresh: () => Promise<void> }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const markSent = async (c: CrmContact) => {
    setBusyId(c.id);
    try {
      await recordOutreach(c.id, channel, outreachTemplate(c, channel), "first-touch");
      if (c.stage === "new") { try { await moveStage(c.id, "contacted"); } catch { /* ignore */ } }
      toast("Marked as sent", `${c.name} — ${channel}`);
      refresh();
    } catch (e: any) {
      toast("Couldn't do it", e?.message || "");
    }
    setBusyId(null);
  };
  return (
    <section>
      <h3 className="mb-2 text-sm font-extrabold text-[#f4f6f8]">{title} <span className="text-[#93A0B4]">({list.length})</span></h3>
      {list.length === 0 ? (
        <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[13px] text-[#93A0B4]">The queue is empty — everyone eligible has already received a first message on this channel, or there are no eligible contacts.</p>
      ) : (
        <div className="space-y-2">
          {list.map((c) => (
            <div key={c.id} className="rounded-2xl border border-[#27334D] bg-[#1B2638] p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-[#f4f6f8]">{c.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${KIND_COLOR[c.kind]}`}>{KIND_LABEL[c.kind]}</span>
                <span className="text-xs text-[#93A0B4]">{channel === "email" ? c.email : channel === "dm" ? `@${c.instagramUsername}` : c.whatsapp}</span>
                <button onClick={() => markSent(c)} disabled={busyId === c.id} className="btn btn-blurple ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-60">
                  {channel === "email" ? <Mail size={13} /> : <MessageCircle size={13} />} {busyId === c.id ? "Working…" : "Mark sent"}
                </button>
              </div>
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-black/25 px-3 py-2 text-[13px] leading-relaxed text-[#b6bcc7]">{outreachTemplate(c, channel)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────── POSTING TAB ─────────────────────────── */
/* ─────────── Connect Threads card (owner's own account — optional) ───────
   Connect your own Threads account via OAuth — queued Threads posts then
   publish from that account through the API. The token never reaches the
   client — only the username/status comes back. */
function ThreadsCard() {
  const [account, setAccount] = useState<SocialAccountStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [param, setParam] = useState<string | null>(null);

  const load = useCallback(async () => {
    setAccount(await getThreadsAccount());
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    try {
      const p = new URLSearchParams(window.location.search).get("threads");
      if (p) {
        setParam(p);
        // clean the param so a refresh doesn't show a stale message
        const url = new URL(window.location.href);
        url.searchParams.delete("threads");
        window.history.replaceState({}, "", url.toString());
      }
    } catch { /* ignore */ }
  }, [load]);

  const disconnect = async () => {
    setBusy(true);
    try {
      const { data } = await supabase().auth.getSession();
      const token = data.session?.access_token;
      if (!token) { toast("Session not found", "Please log in again"); setBusy(false); return; }
      const r = await fetch("/api/threads/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        toast("Threads disconnected", "");
        setAccount(null);
      } else {
        toast("Disconnect failed", "Please try again");
      }
    } catch { toast("Disconnect failed", "Check your connection"); }
    setBusy(false);
  };

  return (
    <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[#f4f6f8]">Threads account (yours — optional)</p>
          {!loaded ? (
            <p className="text-[13px] text-[#93A0B4]">Checking…</p>
          ) : account ? (
            <p className="text-[13px] text-[#b6bcc7]">
              <span className="font-bold text-[#4ade80]">● Connected</span>
              {account.username ? <> — <span className="font-bold text-[#f4f6f8]">@{account.username}</span></> : null}
              {account.tokenExpiresAt ? <span className="text-[#93A0B4]"> · token expires {new Date(account.tokenExpiresAt).toLocaleDateString()}</span> : null}
            </p>
          ) : (
            <p className="text-[13px] text-[#93A0B4]">No Threads account connected — your own API posts won't publish until one is connected. Partner one-tap posts don't need this.</p>
          )}
        </div>
        {account ? (
          <button onClick={disconnect} disabled={busy} className="btn btn-ghost px-4 py-2 text-sm text-[#ff8589] disabled:opacity-60">
            {busy ? "Working…" : "Disconnect"}
          </button>
        ) : (
          <a href="/api/threads/connect" className="btn btn-blurple px-4 py-2 text-sm">Connect Threads</a>
        )}
      </div>
      {param === "connected" && (
        <p className="mt-3 rounded-lg bg-[#23a55a]/15 px-3 py-2 text-[13px] font-bold text-[#4ade80]">Threads connected — queued posts will now publish from this account.</p>
      )}
      {param === "not_configured" && (
        <p className="mt-3 rounded-lg bg-[#f5a623]/15 px-3 py-2 text-[13px] font-bold text-[#fbbf24]">The Threads app isn't configured on the server yet — complete the steps in THREADS-SETUP.md first (Meta app + Vercel env).</p>
      )}
      {param === "error" && (
        <p className="mt-3 rounded-lg bg-[#ed4245]/15 px-3 py-2 text-[13px] font-bold text-[#ff8589]">Connection failed — please try again. If it keeps failing, re-check THREADS-SETUP.md.</p>
      )}
    </div>
  );
}

function PostingTab({ posts, contacts, refresh }: { posts: CrmPost[]; contacts: CrmContact[]; refresh: () => Promise<void> }) {
  const [platform, setPlatform] = useState<PostPlatform>("threads");
  const [body, setBody] = useState("");
  const [accountId, setAccountId] = useState(""); // "" = default (first connected)
  const [partnerId, setPartnerId] = useState(""); // "" = owner's own post; otherwise a one-tap partner post
  const [accounts, setAccounts] = useState<SocialAccountStatus[]>([]);
  const partners = contacts.filter((ct) => ct.kind === "partner" || ct.kind === "affiliate");
  const partnerOf = (id: string | null) => (id ? contacts.find((ct) => ct.id === id) || null : null);
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 3600e3);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => { getThreadsAccounts().then(setAccounts).catch(() => {}); }, []);

  const accountName = (a: SocialAccountStatus) => a.label || (a.username ? `@${a.username}` : "Threads account");
  const accountOf = (id: string | null) => (id ? accounts.find((a) => a.id === id) || null : null);

  const add = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await queuePost(platform, body, new Date(when).getTime() || Date.now(), platform === "threads" ? accountId || null : null, partnerId || null);
      setBody("");
      toast("Post queued", platform);
      refresh();
    } catch (e: any) { toast("Couldn't queue the post", e?.message || ""); }
    setBusy(false);
  };

  const badge = (s: CrmPost["status"]) =>
    s === "posted" ? "bg-[#23a55a]/20 text-[#4ade80]" : s === "failed" ? "bg-[#ed4245]/20 text-[#ff8589]" : "bg-[#f5a623]/20 text-[#fbbf24]";

  return (
    <div className="p-3 sm:p-4">
      <div className="mb-4 rounded-xl border border-[#4f8cff]/30 bg-[#4f8cff]/10 px-4 py-3 text-[13px] font-bold text-[#8dbcff]">
        Posts will go out WITHOUT approval (owner's order) — whatever is queued here goes live on schedule. Threads posts publish via the Threads API from the selected account (Default = the first connected account). Partner posts are different: the partner posts those themselves, one-tap, from their signed page.
      </div>
      <ThreadsCard />
      {accounts.length > 0 && (
        <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-2 text-sm font-extrabold text-[#f4f6f8]">Connected Threads accounts ({accounts.length})</p>
          <div className="space-y-1.5">
            {accounts.map((a) => {
              const linked = a.crmContactId ? contacts.find((ct) => ct.id === a.crmContactId) : null;
              return (
                <p key={a.id} className="flex flex-wrap items-center gap-2 text-[13px] text-[#b6bcc7]">
                  <span className="font-bold text-[#4ade80]">●</span>
                  <span className="font-bold text-[#f4f6f8]">{accountName(a)}</span>
                  {a.username && a.label && <span className="text-[#93A0B4]">@{a.username}</span>}
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#93A0B4]">
                    {linked ? `${KIND_LABEL[linked.kind]}: ${linked.name}` : a.crmContactId ? "Partner" : "Owner (default)"}
                  </span>
                </p>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[#93A0B4]">Partners don't connect accounts — open a partner's contact in the CRM and send them their signed posting link instead.</p>
        </div>
      )}
      <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[150px_1fr_200px_190px]">
          <div><label className={labelCls}>Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as PostPlatform)} className={inputCls}>
              <option value="threads">Threads</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>
          <div><label className={labelCls}>Post text</label><input value={body} onChange={(e) => setBody(e.target.value)} className={inputCls} placeholder="Write the post…" /></div>
          <div><label className={labelCls}>Schedule</label><input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Threads account</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls} disabled={platform !== "threads"}>
              <option value="">Default (first connected)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{accountName(a)}{a.username && a.label ? ` (@${a.username})` : ""}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className={labelCls}>Partner (one-tap — optional)</label>
            <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={inputCls}>
              <option value="">None — my own post</option>
              {partners.map((ct) => (
                <option key={ct.id} value={ct.id}>{ct.name} ({KIND_LABEL[ct.kind]})</option>
              ))}
            </select>
          </div>
          <p className="flex items-end pb-1 text-xs leading-relaxed text-[#93A0B4]">
            If you pick a partner, the post goes to their signed page — they'll post it themselves with "Post on Threads" and mark it as posted (it will NOT go via the API).
          </p>
        </div>
        <button onClick={add} disabled={busy || !body.trim()} className="btn btn-blurple mt-3 px-4 py-2 text-sm disabled:opacity-60">{busy ? "Queueing…" : "Add to queue"}</button>
      </div>

      <div className="space-y-2">
        {posts.length === 0 && <p className="text-[13px] text-[#93A0B4]">No posts in the queue yet.</p>}
        {posts.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#27334D] bg-[#1B2638] px-3.5 py-3">
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#b6bcc7]">{p.platform}</span>
            {p.socialAccountId && accountOf(p.socialAccountId) && (
              <span className="rounded-full bg-[#4f8cff]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8dbcff]">{accountName(accountOf(p.socialAccountId)!)}</span>
            )}
            {p.crmContactId && (
              <span className="rounded-full bg-[#f5a623]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#fbbf24]" title="One-tap — the partner posts this themselves">
                {partnerOf(p.crmContactId)?.name || "Partner"} · One-tap — the partner posts this themselves
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-sm text-[#f4f6f8]">{p.body}</span>
            <span className="text-xs text-[#93A0B4]">{new Date(p.scheduledAt).toLocaleString()}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge(p.status)}`}>{p.status}</span>
            {p.status === "queued" && (
              <>
                <button onClick={async () => { await setPostStatus(p.id, "posted"); refresh(); }} className="rounded-md p-1.5 text-[#4ade80] hover:bg-white/[0.06]" title="Mark as posted"><Check size={15} /></button>
                <button onClick={async () => { await setPostStatus(p.id, "failed"); refresh(); }} className="rounded-md p-1.5 text-[#ff8589] hover:bg-white/[0.06]" title="Mark as failed"><X size={15} /></button>
              </>
            )}
            <button onClick={async () => { await deletePost(p.id); refresh(); }} className="rounded-md p-1.5 text-[#93A0B4] hover:bg-white/[0.06] hover:text-[#ff8589]" title="Delete"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── TASKS TAB (Phase 3) ─────────────────────────── */
const startOfTodayMs = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dayKeyOf = (ms: number): string => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const fmtDue = (ms: number) => new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function TasksTab({ tasks, contacts, posts, tablesReady, formNonce = 0, onSelectContact, refresh }: {
  tasks: CrmTask[]; contacts: CrmContact[]; posts: CrmPost[]; tablesReady: boolean; formNonce?: number;
  onSelectContact: (c: CrmContact) => void; refresh: () => Promise<void>;
}) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [contactId, setContactId] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);

  // Command Center "Add Task" — signal aye to form khol do
  useEffect(() => { if (formNonce > 0) { setEditingId(null); setFormOpen(true); } }, [formNonce]);

  const contactOf = (id: string | null) => (id ? contacts.find((c) => c.id === id) || null : null);

  const resetForm = () => { setTitle(""); setContactId(""); setDue(""); setPriority("medium"); setNotes(""); setEditingId(null); };

  const startEdit = (t: CrmTask) => {
    setEditingId(t.id);
    setTitle(t.title);
    setContactId(t.contactId || "");
    setDue(t.dueAt ? toLocalInput(t.dueAt) : "");
    setPriority(t.priority);
    setNotes(t.notes);
    setFormOpen(true);
  };

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const input = { title: title.trim(), contactId: contactId || null, dueAt: due ? new Date(due).getTime() : null, priority, notes: notes.trim() };
      if (editingId) { await updateTask(editingId, input); toast("Task updated", input.title); }
      else { await createTask(input); toast("Task added", input.title); }
      resetForm();
      setFormOpen(false);
      refresh();
    } catch (e: any) { toast(editingId ? "Couldn't update the task" : "Couldn't add the task", e?.message || ""); }
    setBusy(false);
  };

  const toggle = async (t: CrmTask) => {
    try {
      if (t.status === "open") await completeTask(t.id); else await reopenTask(t.id);
      refresh();
    } catch (e: any) { toast("Couldn't update the task", e?.message || ""); }
  };

  const remove = async (t: CrmTask) => {
    if (!window.confirm(`Delete this task?\n\n“${t.title}”`)) return;
    try { await deleteTask(t.id); toast("Task deleted", t.title); refresh(); }
    catch (e: any) { toast("Couldn't delete the task", e?.message || ""); }
  };

  // Groups — Overdue = guzre hue din (aaj ke din wale Today me rehte hain;
  // un ka waqt guzar jaye to row par due label red ho jata hai)
  const groups = useMemo(() => {
    const t0 = startOfTodayMs();
    const t1 = t0 + 86400e3;
    const open = tasks.filter((t) => t.status === "open");
    const byDue = (a: CrmTask, b: CrmTask) => (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER) || b.createdAt - a.createdAt;
    return {
      overdue: open.filter((t) => t.dueAt !== null && t.dueAt < t0).sort(byDue),
      today: open.filter((t) => t.dueAt !== null && t.dueAt >= t0 && t.dueAt < t1).sort(byDue),
      upcoming: open.filter((t) => t.dueAt !== null && t.dueAt >= t1).sort(byDue),
      noDue: open.filter((t) => t.dueAt === null).sort((a, b) => b.createdAt - a.createdAt),
      completed: tasks.filter((t) => t.status === "done").sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)),
    };
  }, [tasks]);

  const renderRow = (t: CrmTask) => {
    const contact = contactOf(t.contactId);
    const overdue = t.status === "open" && t.dueAt !== null && t.dueAt < Date.now();
    return (
      <div key={t.id} className="rounded-2xl border border-[#27334D] bg-[#1B2638] px-3.5 py-3">
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={t.status === "done"}
            onChange={() => toggle(t)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#4f8cff]"
            title={t.status === "done" ? "Reopen" : "Mark done"}
          />
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`} title={`${PRIORITY_LABEL[t.priority]} priority`} />
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${t.status === "done" ? "text-[#93A0B4] line-through" : "text-[#f4f6f8]"}`}>{t.title}</p>
            {t.notes && <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-[#93A0B4]">{t.notes}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {contact && (
                <button onClick={() => onSelectContact(contact)} className="rounded-full bg-[#4f8cff]/15 px-2 py-0.5 text-[11px] font-bold text-[#8dbcff] transition hover:bg-[#4f8cff]/25" title="Open contact">
                  {contact.name}
                </button>
              )}
              {t.dueAt !== null && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${overdue ? "bg-[#ed4245]/15 text-[#ff8589]" : "bg-white/[0.06] text-[#93A0B4]"}`}>
                  {overdue ? "Overdue · " : "Due "}{fmtDue(t.dueAt)}
                </span>
              )}
              {t.status === "done" && t.completedAt && (
                <span className="rounded-full bg-[#23a55a]/15 px-2 py-0.5 text-[11px] font-bold text-[#4ade80]">Done {new Date(t.completedAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
          <button onClick={() => startEdit(t)} className="rounded-md p-1.5 text-[#93A0B4] transition hover:bg-white/[0.06] hover:text-[#f4f6f8]" title="Edit task"><Pencil size={14} /></button>
          <button onClick={() => remove(t)} className="rounded-md p-1.5 text-[#93A0B4] transition hover:bg-white/[0.06] hover:text-[#ff8589]" title="Delete task"><Trash2 size={14} /></button>
        </div>
      </div>
    );
  };

  const groupSection = (label: string, list: CrmTask[], accent = "text-[#f4f6f8]") =>
    list.length === 0 ? null : (
      <section key={label}>
        <h3 className={`mb-2 text-sm font-extrabold ${accent}`}>{label} <span className="text-[#93A0B4]">({list.length})</span></h3>
        <div className="space-y-2">{list.map(renderRow)}</div>
      </section>
    );

  return (
    <div className="p-3 sm:p-4">
      {!tablesReady && (
        <div className="mb-4 rounded-xl border border-[#f5a623]/30 bg-[#f5a623]/10 px-4 py-3 text-[13px] font-semibold text-[#fbbf24]">
          The tasks table isn't in the database yet — run <span className="font-mono">supabase/tasks-phase3.sql</span> first. The Tasks tab will stay empty until then.
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-[13px] font-semibold text-[#93A0B4]">Everything you have to do — linked to CRM contacts, with due dates and priorities. The calendar also shows CRM follow-ups and scheduled posts.</p>
        <div className="flex shrink-0 overflow-hidden rounded-lg border border-[#27334D]">
          <button onClick={() => setView("list")} className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold transition ${view === "list" ? "bg-[#4f8cff] text-white" : "text-[#93A0B4] hover:bg-white/[0.06]"}`} title="List view"><List size={14} /> List</button>
          <button onClick={() => setView("calendar")} className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold transition ${view === "calendar" ? "bg-[#4f8cff] text-white" : "text-[#93A0B4] hover:bg-white/[0.06]"}`} title="Calendar view"><CalendarDays size={14} /> Calendar</button>
        </div>
        <button onClick={() => { if (formOpen && !editingId) { setFormOpen(false); } else { resetForm(); setFormOpen(true); } }} className="btn btn-blurple flex shrink-0 items-center gap-1.5 px-3.5 py-2 text-[13px]">
          <Plus size={15} /> New task
        </button>
      </div>

      {formOpen && (
        <div className="pop-in mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-3 text-sm font-extrabold text-[#f4f6f8]">{editingId ? "Edit task" : "New task"}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2"><label className={labelCls}>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Send the demo link" /></div>
            <div><label className={labelCls}>Contact (optional)</label>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)} className={inputCls}>
                <option value="">No contact</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name} ({KIND_LABEL[c.kind]})</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={inputCls}>
                {(["low", "medium", "high"] as TaskPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Due date & time (optional)</label><input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} /></div>
            <div className="sm:col-span-2 lg:col-span-3"><label className={labelCls}>Notes (optional)</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Anything to remember…" /></div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={submit} disabled={busy || !title.trim()} className="btn btn-blurple px-4 py-2 text-sm disabled:opacity-60">{busy ? "Saving…" : editingId ? "Save changes" : "Add task"}</button>
            <button onClick={() => { resetForm(); setFormOpen(false); }} className="btn btn-ghost px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {view === "calendar" ? (
        <CalendarView tasks={tasks} contacts={contacts} posts={posts} onSelectContact={onSelectContact} onShowList={() => setView("list")} />
      ) : (
        <div className="space-y-6">
          {groupSection("Overdue", groups.overdue, "text-[#ff8589]")}
          {groupSection("Today", groups.today)}
          {groupSection("Upcoming", groups.upcoming)}
          {groupSection("No due date", groups.noDue)}
          {tasks.length === 0 && (
            <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-6 text-center text-[13px] text-[#93A0B4]">No tasks yet — press "New task" to add your first one.</p>
          )}
          {groups.completed.length > 0 && (
            <section>
              <button onClick={() => setCompletedOpen((v) => !v)} className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-[#93A0B4] transition hover:text-[#f4f6f8]">
                {completedOpen ? <ChevronRight size={14} className="rotate-90 transition" /> : <ChevronRight size={14} className="transition" />}
                Completed <span>({groups.completed.length})</span>
              </button>
              {completedOpen && <div className="space-y-2">{groups.completed.map(renderRow)}</div>}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────── Calendar — month grid: tasks + CRM follow-ups + scheduled posts ─────────── */
type CalItem = { key: string; at: number; type: "task" | "followup" | "post"; label: string; done?: boolean; contact?: CrmContact };

function CalendarView({ tasks, contacts, posts, onSelectContact, onShowList }: {
  tasks: CrmTask[]; contacts: CrmContact[]; posts: CrmPost[]; onSelectContact: (c: CrmContact) => void; onShowList: () => void;
}) {
  const nowD = new Date();
  const [cursor, setCursor] = useState({ y: nowD.getFullYear(), m: nowD.getMonth() });
  const [selected, setSelected] = useState(() => startOfTodayMs());

  // Teeno asal sources se din ke hisab se items
  const byDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    const push = (ms: number, item: CalItem) => {
      const k = dayKeyOf(ms);
      const arr = map.get(k) || [];
      arr.push(item);
      map.set(k, arr);
    };
    tasks.forEach((t) => { if (t.dueAt !== null) push(t.dueAt, { key: `t-${t.id}`, at: t.dueAt, type: "task", label: t.title, done: t.status === "done" }); });
    contacts.forEach((c) => { if (c.followUpAt !== null && c.stage !== "done" && c.stage !== "lost") push(c.followUpAt, { key: `f-${c.id}`, at: c.followUpAt, type: "followup", label: `Follow-up: ${c.name}`, contact: c }); });
    posts.forEach((p) => { if (p.status === "queued") push(p.scheduledAt, { key: `p-${p.id}`, at: p.scheduledAt, type: "post", label: `${p.platform}: ${p.body}` }); });
    map.forEach((arr) => arr.sort((a, b) => a.at - b.at));
    return map;
  }, [tasks, contacts, posts]);

  // Month grid — Monday first, 6 weeks (42 cells), pichle/aglay mahine ke din muted
  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(cursor.y, cursor.m, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, [cursor]);

  const moveMonth = (delta: number) => setCursor((c) => { const d = new Date(c.y, c.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayMs = startOfTodayMs();
  const agenda = byDay.get(dayKeyOf(selected)) || [];

  const dotCls = (type: CalItem["type"]) => (type === "task" ? "bg-[#4f8cff]" : type === "followup" ? "bg-[#f5a623]" : "bg-[#23a55a]");
  const badgeCls = (type: CalItem["type"]) =>
    type === "task" ? "bg-[#4f8cff]/15 text-[#8dbcff]" : type === "followup" ? "bg-[#f5a623]/15 text-[#fbbf24]" : "bg-[#23a55a]/15 text-[#4ade80]";
  const typeLabel = (type: CalItem["type"]) => (type === "task" ? "Task" : type === "followup" ? "Follow-up" : "Post");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-base font-extrabold text-[#f4f6f8]">{monthLabel}</p>
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#93A0B4]">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#4f8cff]" /> Tasks</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f5a623]" /> Follow-ups</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#23a55a]" /> Scheduled posts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => moveMonth(-1)} className="btn btn-ghost px-2.5 py-1.5" title="Previous month"><ChevronLeft size={15} /></button>
          <button onClick={() => { setCursor({ y: nowD.getFullYear(), m: nowD.getMonth() }); setSelected(todayMs); }} className="btn btn-ghost px-3 py-1.5 text-[13px]">Today</button>
          <button onClick={() => moveMonth(1)} className="btn btn-ghost px-2.5 py-1.5" title="Next month"><ChevronRight size={15} /></button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#27334D]">
        <div className="grid grid-cols-7 border-b border-[#27334D] bg-[#1B2638]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <p key={d} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#93A0B4]">{d}</p>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const ms = d.getTime();
            const items = byDay.get(dayKeyOf(ms)) || [];
            const inMonth = d.getMonth() === cursor.m;
            const isToday = ms === todayMs;
            const isSel = ms === selected;
            return (
              <button
                key={i}
                onClick={() => setSelected(ms)}
                className={`min-h-[64px] border-b border-r border-white/[0.04] p-1.5 text-left align-top transition sm:min-h-[76px] ${i % 7 === 6 ? "border-r-0" : ""} ${isSel ? "bg-[#4f8cff]/[0.08]" : "hover:bg-white/[0.03]"} ${inMonth ? "" : "opacity-40"}`}
              >
                <span className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${isToday ? "bg-[#4f8cff] text-white" : "text-[#b6bcc7]"}`}>{d.getDate()}</span>
                {items.length > 0 && (
                  <span className="mt-1 flex flex-wrap items-center gap-1 px-0.5">
                    {items.slice(0, 3).map((it) => <span key={it.key} className={`h-1.5 w-1.5 rounded-full ${dotCls(it.type)} ${it.done ? "opacity-40" : ""}`} />)}
                    <span className="text-[10px] font-bold text-[#93A0B4]">{items.length}</span>
                  </span>
                )}
                {items.length > 0 && (
                  <span className="mt-0.5 hidden truncate px-0.5 text-[10px] font-semibold text-[#93A0B4] lg:block">{items[0].label}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day agenda — teeno sources, time ke sath */}
      <div className="mt-4">
        <h3 className="mb-2 text-sm font-extrabold text-[#f4f6f8]">
          {new Date(selected).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          <span className="text-[#93A0B4]"> ({agenda.length})</span>
        </h3>
        {agenda.length === 0 ? (
          <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[13px] text-[#93A0B4]">Nothing scheduled for this day — no tasks, follow-ups or posts.</p>
        ) : (
          <div className="space-y-2">
            {agenda.map((it) => (
              <button
                key={it.key}
                onClick={() => { if (it.type === "followup" && it.contact) onSelectContact(it.contact); else if (it.type === "task") onShowList(); }}
                className={`flex w-full flex-wrap items-center gap-2 rounded-2xl border border-[#27334D] bg-[#1B2638] px-3.5 py-3 text-left ${it.type === "post" ? "cursor-default" : "transition hover:border-[#4f8cff]/50"}`}
              >
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeCls(it.type)}`}>{typeLabel(it.type)}</span>
                <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${it.done ? "text-[#93A0B4] line-through" : "text-[#f4f6f8]"}`}>{it.label}</span>
                <span className="text-xs font-bold text-[#93A0B4]">{new Date(it.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── REPORT TAB ─────────────────────────── */
function ReportTab({ contacts, outreach, posts }: { contacts: CrmContact[]; outreach: CrmOutreach[]; posts: CrmPost[] }) {
  const stats = useMemo(() => computeTodayStats(contacts, outreach, posts), [contacts, outreach, posts]);
  const [summary, setSummary] = useState("");
  const [saved, setSaved] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDailyReport().then((r) => { if (r) { setSummary(r.summary); setSaved(r.day); } }).catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await upsertDailyReport({
        day: todayKey(),
        leadsNew: stats.leadsNew,
        emailsSent: stats.emailsSent,
        dmsQueued: stats.dmsQueued,
        replies: stats.replies,
        stageMoves: contacts.filter((c) => c.stage !== "new" && c.updatedAt >= new Date().setHours(0, 0, 0, 0)).length,
        summary,
      });
      setSaved(todayKey());
      toast("Daily report saved", todayKey());
    } catch (e: any) { toast("Report couldn't be saved", e?.message || ""); }
    setBusy(false);
  };

  const cards: [string, number][] = [
    ["New leads/contacts today", stats.leadsNew],
    ["Emails sent today", stats.emailsSent],
    ["DMs sent today", stats.dmsQueued],
    ["WhatsApp sent today", stats.whatsappSent],
    ["Posts queued", stats.postsQueued],
    ["Posts posted today", stats.postsPosted],
    ["Stage: Replied (today)", stats.replies],
    ["Total contacts", stats.totalContacts],
  ];

  return (
    <div className="p-3 sm:p-4">
      <p className="mb-3 text-[13px] font-semibold text-[#93A0B4]">Today ({todayKey()}) — counted from the data itself. Write the summary and save it each night; this is the daily CRM update.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, v]) => (
          <div key={label} className="rounded-2xl border border-[#27334D] bg-[#1B2638] p-4">
            <p className="text-3xl font-extrabold tracking-tight text-[#f4f6f8]">{v}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#93A0B4]">{label}</p>
          </div>
        ))}
      </div>
      <label className={`${labelCls} mt-5`}>Today's summary</label>
      <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} className={inputCls} placeholder="What happened today, what's next tomorrow…" />
      <div className="mt-2 flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn btn-blurple px-4 py-2 text-sm disabled:opacity-60">{busy ? "Saving…" : "Save report"}</button>
        {saved && <span className="text-xs font-semibold text-[#4ade80]">Last saved: {saved}</span>}
      </div>
    </div>
  );
}
