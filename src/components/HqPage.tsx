"use client";
// ═══════════════════════════════════════════════════════════════════════════
// Business HQ — sirf OWNER ke liye (Symbiote Systems ka control room)
// Tabs: CRM (pipeline board) · Outreach (email/DM queues) · Posting · Report
// Data: src/lib/crm.ts → supabase/crm-upgrade.sql wali tables.
// Members ko ye page kabhi render hi nahi hota (App.tsx me owner check +
// yahan bhi guard hai).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, X, Plus, Send, Mail, MessageCircle, CalendarClock, BarChart3, LayoutGrid, Trash2, Check, Copy, Link2 } from "lucide-react";
import { useStore, toast } from "@/lib/store";
import {
  CRM_KINDS, CRM_STAGES, KIND_LABEL, STAGE_LABEL,
  listContacts, createContact, updateContact, moveStage, deleteContact,
  listOutreach, canSendTo, recordOutreach, outreachTemplate,
  listPosts, queuePost, setPostStatus, deletePost,
  getDailyReport, upsertDailyReport, computeTodayStats, todayKey, subscribeCrm, crmTablesReady,
  getThreadsAccount, getThreadsAccounts, type SocialAccountStatus,
  type CrmContact, type CrmKind, type CrmStage, type CrmOutreach, type CrmPost, type OutreachChannel, type PostPlatform,
} from "@/lib/crm";
import { supabase } from "@/lib/supabase";

type HqTab = "crm" | "outreach" | "posting" | "report";

const KIND_COLOR: Record<CrmKind, string> = {
  client: "bg-[#23a55a]/20 text-[#4ade80]",
  partner: "bg-[#4f8cff]/20 text-[#8dbcff]",
  affiliate: "bg-[#f5a623]/20 text-[#fbbf24]",
  lead: "bg-white/10 text-[#b6bcc7]",
};

const inputCls = "field w-full px-3 py-2 text-sm";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b93a1]";

export default function HqPage() {
  const meId = useStore((s) => s.me);
  const me = useStore((s) => s.members.find((m) => m.id === s.me));
  const isOwner = me?.role === "owner";

  const [tab, setTab] = useState<HqTab>("crm");
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [outreach, setOutreach] = useState<CrmOutreach[]>([]);
  const [posts, setPosts] = useState<CrmPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [tablesReady, setTablesReady] = useState(true);
  const [selected, setSelected] = useState<CrmContact | null>(null);
  const refreshTimer = useRef<any>(null);

  const refresh = useCallback(async () => {
    const [c, o, p] = await Promise.all([listContacts(), listOutreach(), listPosts()]);
    setContacts(c);
    setOutreach(o);
    setPosts(p);
    setTablesReady(crmTablesReady);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    refresh();
    // Realtime (Upgrade 10) — crm tables par change aye to refresh (halka debounce)
    const off = subscribeCrm(() => {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(refresh, 400);
    });
    return off;
  }, [isOwner, refresh]);

  // selected contact ki taza copy (stage change ke baad drawer update rahe)
  const selectedLive = selected ? contacts.find((c) => c.id === selected.id) || null : null;

  if (!isOwner) {
    return (
      <div className="panel flex flex-1 items-center justify-center rounded-2xl p-8 text-center">
        <p className="text-sm font-semibold text-[#8b93a1]">Ye section sirf owner ke liye hai.</p>
      </div>
    );
  }

  const stats = computeTodayStats(contacts, outreach, posts);

  return (
    <div className="panel relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-3 sm:px-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#4f8cff] to-[#3b76d6] text-white soft-shadow">
          <Briefcase size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-extrabold tracking-tight text-[#f4f6f8]">Business HQ</h1>
          <p className="truncate text-xs text-[#8b93a1]">Symbiote Systems — CRM · Outreach · Posting · Report (sirf owner)</p>
        </div>
        <span className="hidden shrink-0 rounded-full bg-white/[0.06] px-3 py-1 text-xs font-bold text-[#b6bcc7] sm:block">
          {contacts.length} contacts · {stats.postsQueued} posts queued
        </span>
      </header>

      {/* HQ tabs */}
      <div className="flex shrink-0 gap-1 border-b border-white/10 px-3 py-2">
        {([
          { id: "crm", label: "CRM", icon: LayoutGrid },
          { id: "outreach", label: "Outreach", icon: Send },
          { id: "posting", label: "Posting", icon: CalendarClock },
          { id: "report", label: "Daily Report", icon: BarChart3 },
        ] as { id: HqTab; label: string; icon: any }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-bold transition ${tab === t.id ? "bg-[#4f8cff] text-white soft-shadow" : "text-[#8b93a1] hover:bg-white/[0.06] hover:text-[#f4f6f8]"}`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {!tablesReady && !loading && (
        <div className="mx-3 mt-3 shrink-0 rounded-xl border border-[#f5a623]/30 bg-[#f5a623]/10 px-4 py-3 text-[13px] font-semibold text-[#fbbf24]">
          CRM tables abhi database me nahi lage — pehle <span className="font-mono">supabase/crm-upgrade.sql</span> chalana hai (Round 2). Tab tak lists khaali dikhengi, app theek chalegi.
        </div>
      )}

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => <div key={i} className="skel h-16 w-full" />)}
          </div>
        ) : tab === "crm" ? (
          <CrmBoard contacts={contacts} onAdd={async (c) => { setContacts((p) => [c, ...p]); }} onSelect={setSelected} />
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
          onClose={() => setSelected(null)}
          refresh={refresh}
        />
      )}
    </div>
  );
}

/* ─────────────────────────── CRM BOARD ─────────────────────────── */
function CrmBoard({ contacts, onAdd, onSelect }: { contacts: CrmContact[]; onAdd: (c: CrmContact) => void; onSelect: (c: CrmContact) => void }) {
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CrmKind>("lead");
  const [ig, setIg] = useState("");
  const [email, setEmail] = useState("");
  const [wa, setWa] = useState("");
  const [source, setSource] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    if (!name.trim() && !ig.trim() && !email.trim()) { setErr("Naam, username ya email — kam az kam aik cheez do."); return; }
    setBusy(true);
    try {
      const c = await createContact({ kind, name: name.trim() || ig.trim() || email.trim(), instagramUsername: ig, email, whatsapp: wa, source: source.trim() || "manual" });
      onAdd(c);
      setName(""); setIg(""); setEmail(""); setWa(""); setSource("");
      setFormOpen(false);
      toast("Contact add ho gaya", c.name);
    } catch (e: any) {
      // Dedupe lock ka dostana error yahin dikhta hai
      setErr(e?.message || "Add nahi hua");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[#8b93a1]">Pipeline — card par click karo, details khulengi. Repeat username/email database khud rokta hai.</p>
        <button onClick={() => setFormOpen((v) => !v)} className="btn btn-blurple flex shrink-0 items-center gap-1.5 px-3.5 py-2 text-[13px]">
          <Plus size={15} /> Naya contact
        </button>
      </div>

      {formOpen && (
        <div className="pop-in mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className={labelCls}>Naam</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Masalan: Ahmed Raza" /></div>
            <div><label className={labelCls}>Type</label>
              <select value={kind} onChange={(e) => setKind(e.target.value as CrmKind)} className={inputCls}>
                {CRM_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Instagram username</label><input value={ig} onChange={(e) => setIg(e.target.value)} className={inputCls} placeholder="@ ke baghair" /></div>
            <div><label className={labelCls}>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="name@example.com" /></div>
            <div><label className={labelCls}>WhatsApp</label><input value={wa} onChange={(e) => setWa(e.target.value)} className={inputCls} placeholder="+92..." /></div>
            <div><label className={labelCls}>Source</label><input value={source} onChange={(e) => setSource(e.target.value)} className={inputCls} placeholder="instagram / website / referral" /></div>
          </div>
          {err && <p className="mt-3 rounded-lg bg-[#ed4245]/15 px-3 py-2 text-[13px] font-bold text-[#ff8589]">{err}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={submit} disabled={busy} className="btn btn-blurple px-4 py-2 text-sm disabled:opacity-60">{busy ? "Add ho raha…" : "Add karo"}</button>
            <button onClick={() => setFormOpen(false)} className="btn btn-ghost px-4 py-2 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2 thin-scroll">
        {CRM_STAGES.map((stage) => {
          const list = contacts.filter((c) => c.stage === stage);
          return (
            <div key={stage} className="flex w-[240px] shrink-0 flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2.5">
              <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b93a1]">{STAGE_LABEL[stage]} — {list.length}</p>
              <div className="space-y-2">
                {list.map((c) => (
                  <button key={c.id} onClick={() => onSelect(c)} className="w-full rounded-xl border border-white/[0.07] bg-[#111114] p-3 text-left transition hover:border-[#4f8cff]/50">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#f4f6f8]">{c.name || "—"}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${KIND_COLOR[c.kind]}`}>{KIND_LABEL[c.kind]}</span>
                    </span>
                    {c.instagramUsername && <span className="mt-1 block truncate text-xs text-[#8b93a1]">@{c.instagramUsername}</span>}
                    {c.email && <span className="block truncate text-xs text-[#8b93a1]">{c.email}</span>}
                    {c.source && <span className="mt-1.5 block text-[11px] text-[#8b93a1]/70">via {c.source}</span>}
                  </button>
                ))}
                {list.length === 0 && <p className="px-1 py-2 text-xs text-[#8b93a1]/60">Khaali</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────── Partner Threads connect link ───────────
   Sirf partner/affiliate contacts ke liye. Signed link SERVER route se
   ata hai (HMAC secret client par kabhi nahi ata) — owner ye link copy
   karke partner ko bhejta hai, partner us se apna Threads jodta hai. */
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
        if (!token) { if (live) setErr("Session nahi mila — dobara login karo."); return; }
        const r = await fetch("/api/partners/connect-link", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ contactId }),
        });
        const j: any = await r.json().catch(() => null);
        if (!live) return;
        if (r.ok && j?.url) setUrl(j.url);
        else if (j?.error === "not_configured") setErr("Server par setup abhi baqi hai (POSTING_CRON_SECRET) — pehle THREADS-SETUP.md mukammal karo.");
        else setErr("Link nahi bana — dobara try karo.");
      } catch { if (live) setErr("Link nahi bana — network check karo."); }
    })();
    return () => { live = false; };
  }, [contactId]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Link copy ho gaya", "Partner ko WhatsApp par bhej do");
      setTimeout(() => setCopied(false), 2000);
    } catch { toast("Copy nahi hua", "Link select karke haath se copy karo"); }
  };

  return (
    <div className="mt-6">
      <label className={labelCls}>Threads connect link (partner ke liye)</label>
      <p className="mb-2 text-xs leading-relaxed text-[#8b93a1]">
        Ye signed link partner ko bhejo — wo is se apna Threads account connect karega, phir us ki posts usi ke account se jayengi. (Ye feature sirf partners/affiliates ke liye hai.)
      </p>
      {err ? (
        <p className="rounded-lg bg-[#ed4245]/15 px-3 py-2 text-[13px] font-bold text-[#ff8589]">{err}</p>
      ) : url ? (
        <div className="flex items-center gap-2">
          <input readOnly value={url} onFocus={(e) => e.target.select()} className={`${inputCls} flex-1 font-mono text-xs`} />
          <button onClick={copy} className="btn btn-blurple flex shrink-0 items-center gap-1.5 px-3 py-2 text-[13px]">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copy!" : "Copy"}
          </button>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-[13px] text-[#8b93a1]"><Link2 size={14} /> Link ban raha hai…</p>
      )}
    </div>
  );
}

/* ─────────────────────────── CONTACT DRAWER ─────────────────────────── */
function ContactDrawer({ contact, outreach, onClose, refresh }: { contact: CrmContact; outreach: CrmOutreach[]; onClose: () => void; refresh: () => Promise<void> }) {
  const [notes, setNotes] = useState(contact.notes);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNotes(contact.notes); }, [contact.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveNotes = async () => {
    setBusy(true);
    try { await updateContact(contact.id, { notes }); toast("Notes save", ""); refresh(); }
    catch (e: any) { toast("Save nahi hua", e?.message || ""); }
    setBusy(false);
  };
  const changeStage = async (stage: CrmStage) => {
    try { await moveStage(contact.id, stage); toast("Stage badla", STAGE_LABEL[stage]); refresh(); }
    catch (e: any) { toast("Stage nahi badla", e?.message || ""); }
  };
  const remove = async () => {
    try { await deleteContact(contact.id); toast("Contact delete", contact.name); onClose(); refresh(); }
    catch (e: any) { toast("Delete nahi hua", e?.message || ""); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <div className="pop-in fixed inset-x-3 bottom-3 top-auto z-50 max-h-[86dvh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-5 soft-shadow sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-4 sm:w-[400px] thin-scroll">
        <div className="mb-1 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-extrabold text-[#f4f6f8]">{contact.name || "—"}</h3>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${KIND_COLOR[contact.kind]}`}>{KIND_LABEL[contact.kind]}</span>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#8b93a1] hover:bg-white/[0.06] hover:text-[#f4f6f8]" aria-label="Band karo"><X size={18} /></button>
        </div>

        <div className="mt-3 space-y-1.5 text-sm text-[#b6bcc7]">
          {contact.instagramUsername && <p>📸 @{contact.instagramUsername}</p>}
          {contact.email && <p>✉️ {contact.email}</p>}
          {contact.whatsapp && <p>💬 {contact.whatsapp}</p>}
          {contact.source && <p className="text-xs text-[#8b93a1]">Source: {contact.source}</p>}
          <p className="text-xs text-[#8b93a1]">Add hua: {new Date(contact.createdAt).toLocaleDateString()}{contact.lastContactedAt ? ` · Aakhri rabta: ${new Date(contact.lastContactedAt).toLocaleDateString()}` : ""}</p>
        </div>

        <label className={`${labelCls} mt-5`}>Stage</label>
        <div className="flex flex-wrap gap-1.5">
          {CRM_STAGES.map((s) => (
            <button key={s} onClick={() => changeStage(s)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${contact.stage === s ? "bg-[#4f8cff] text-white" : "bg-white/[0.06] text-[#8b93a1] hover:text-[#f4f6f8]"}`}>
              {STAGE_LABEL[s]}
            </button>
          ))}
        </div>

        <label className={`${labelCls} mt-5`}>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className={inputCls} placeholder="Is bande ke baare me notes…" />
        <button onClick={saveNotes} disabled={busy} className="btn btn-blurple mt-2 px-4 py-2 text-sm disabled:opacity-60">Notes save karo</button>

        {(contact.kind === "partner" || contact.kind === "affiliate") && (
          <PartnerThreadsLink contactId={contact.id} />
        )}

        <label className={`${labelCls} mt-6`}>Outreach timeline (first-touch log)</label>
        {outreach.length === 0 ? (
          <p className="text-[13px] text-[#8b93a1]">Abhi koi message nahi gaya — Outreach tab se pehla message bhejo.</p>
        ) : (
          <div className="space-y-2">
            {outreach.map((o) => (
              <div key={o.id} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#8dbcff]">{o.channel} · {new Date(o.sentAt).toLocaleString()}</p>
                <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#b6bcc7]">{o.body}</p>
              </div>
            ))}
          </div>
        )}

        <button onClick={remove} className="mt-6 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-[#ff8589] transition hover:bg-[#ed4245]/10">
          <Trash2 size={15} /> Contact delete karo
        </button>
      </div>
    </>
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
      <p className="text-[13px] font-semibold text-[#8b93a1]">
        Aaj ki queues — jo banda aik channel par pehle hi ja chuka hai, wo queue me dobara NAHI aata (dedupe lock). "Mark sent" dabate hi log ho jata hai aur stage Contacted ho jati hai.
        <br />Note: asal bhejna Round 2 me Gmail/social connectors se lagega — abhi message tayyar + log pakka hota hai.
      </p>
      <QueueList title="✉️ Email queue" channel="email" list={queueFor("email")} refresh={refresh} />
      <QueueList title="📸 Instagram DM queue" channel="dm" list={queueFor("dm")} refresh={refresh} />
      <QueueList title="💬 WhatsApp queue" channel="whatsapp" list={queueFor("whatsapp")} refresh={refresh} />
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
      toast("Sent mark ho gaya", `${c.name} — ${channel}`);
      refresh();
    } catch (e: any) {
      toast("Nahi hua", e?.message || "");
    }
    setBusyId(null);
  };
  return (
    <section>
      <h3 className="mb-2 text-sm font-extrabold text-[#f4f6f8]">{title} <span className="text-[#8b93a1]">({list.length})</span></h3>
      {list.length === 0 ? (
        <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[13px] text-[#8b93a1]">Queue khaali hai — sab ko is channel par pehla message ja chuka hai, ya eligible contacts nahi hain.</p>
      ) : (
        <div className="space-y-2">
          {list.map((c) => (
            <div key={c.id} className="rounded-2xl border border-white/[0.07] bg-[#111114] p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-[#f4f6f8]">{c.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${KIND_COLOR[c.kind]}`}>{KIND_LABEL[c.kind]}</span>
                <span className="text-xs text-[#8b93a1]">{channel === "email" ? c.email : channel === "dm" ? `@${c.instagramUsername}` : c.whatsapp}</span>
                <button onClick={() => markSent(c)} disabled={busyId === c.id} className="btn btn-blurple ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-60">
                  {channel === "email" ? <Mail size={13} /> : <MessageCircle size={13} />} {busyId === c.id ? "Ho raha…" : "Mark sent"}
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
/* ─────────── Connect Threads card ───────────
   OAuth se apna Threads account joro — phir queue ki Threads posts usi
   account se API se publish hongi (permission connect ke waqt milti hai).
   Token client ko kabhi nahi dikhta — sirf username/status ata hai. */
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
        // param saaf kar do taake refresh par purana message na dikhe
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
      if (!token) { toast("Session nahi mila", "Dobara login karo"); setBusy(false); return; }
      const r = await fetch("/api/threads/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        toast("Threads disconnect ho gaya", "");
        setAccount(null);
      } else {
        toast("Disconnect nahi hua", "Dobara try karo");
      }
    } catch { toast("Disconnect nahi hua", "Network check karo"); }
    setBusy(false);
  };

  return (
    <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[#f4f6f8]">Threads account</p>
          {!loaded ? (
            <p className="text-[13px] text-[#8b93a1]">Check ho raha hai…</p>
          ) : account ? (
            <p className="text-[13px] text-[#b6bcc7]">
              <span className="font-bold text-[#4ade80]">● Connected</span>
              {account.username ? <> — <span className="font-bold text-[#f4f6f8]">@{account.username}</span></> : null}
              {account.tokenExpiresAt ? <span className="text-[#8b93a1]"> · token expiry {new Date(account.tokenExpiresAt).toLocaleDateString()}</span> : null}
            </p>
          ) : (
            <p className="text-[13px] text-[#8b93a1]">Koi Threads account connected nahi — posts publish nahi hongi jab tak connect na ho.</p>
          )}
        </div>
        {account ? (
          <button onClick={disconnect} disabled={busy} className="btn btn-ghost px-4 py-2 text-sm text-[#ff8589] disabled:opacity-60">
            {busy ? "Ho raha…" : "Disconnect"}
          </button>
        ) : (
          <a href="/api/threads/connect" className="btn btn-blurple px-4 py-2 text-sm">Connect Threads</a>
        )}
      </div>
      {param === "connected" && (
        <p className="mt-3 rounded-lg bg-[#23a55a]/15 px-3 py-2 text-[13px] font-bold text-[#4ade80]">Threads connect ho gaya — ab queue ki posts is account se jayengi.</p>
      )}
      {param === "not_configured" && (
        <p className="mt-3 rounded-lg bg-[#f5a623]/15 px-3 py-2 text-[13px] font-bold text-[#fbbf24]">Server par Threads app abhi configure nahi hai — pehle THREADS-SETUP.md wale steps mukammal karo (Meta app + Vercel env).</p>
      )}
      {param === "error" && (
        <p className="mt-3 rounded-lg bg-[#ed4245]/15 px-3 py-2 text-[13px] font-bold text-[#ff8589]">Connect nahi hua — dobara try karo. Masla rahe to THREADS-SETUP.md dobara check karo.</p>
      )}
    </div>
  );
}

function PostingTab({ posts, contacts, refresh }: { posts: CrmPost[]; contacts: CrmContact[]; refresh: () => Promise<void> }) {
  const [platform, setPlatform] = useState<PostPlatform>("threads");
  const [body, setBody] = useState("");
  const [accountId, setAccountId] = useState(""); // "" = default (pehla connected)
  const [accounts, setAccounts] = useState<SocialAccountStatus[]>([]);
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
      await queuePost(platform, body, new Date(when).getTime() || Date.now(), platform === "threads" ? accountId || null : null);
      setBody("");
      toast("Post queue ho gayi", platform);
      refresh();
    } catch (e: any) { toast("Queue nahi hui", e?.message || ""); }
    setBusy(false);
  };

  const badge = (s: CrmPost["status"]) =>
    s === "posted" ? "bg-[#23a55a]/20 text-[#4ade80]" : s === "failed" ? "bg-[#ed4245]/20 text-[#ff8589]" : "bg-[#f5a623]/20 text-[#fbbf24]";

  return (
    <div className="p-3 sm:p-4">
      <div className="mb-4 rounded-xl border border-[#4f8cff]/30 bg-[#4f8cff]/10 px-4 py-3 text-[13px] font-bold text-[#8dbcff]">
        Posts bina approval jayengi (owner order) — queue me jo dala, wahi schedule par live hoga. Threads posts select kiye hue account se Threads API se publish hoti hain (Default = sab se pehla connected account — owner ka ya partner ka).
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
                  {a.username && a.label && <span className="text-[#8b93a1]">@{a.username}</span>}
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8b93a1]">
                    {linked ? `${KIND_LABEL[linked.kind]}: ${linked.name}` : a.crmContactId ? "Partner" : "Owner (default)"}
                  </span>
                </p>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[#8b93a1]">Partner ko jorna ho to CRM me us ka contact kholo — wahan us ka signed connect link milega.</p>
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
          <div><label className={labelCls}>Post text</label><input value={body} onChange={(e) => setBody(e.target.value)} className={inputCls} placeholder="Post ka text…" /></div>
          <div><label className={labelCls}>Schedule</label><input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Threads account</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls} disabled={platform !== "threads"}>
              <option value="">Default (pehla connected)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{accountName(a)}{a.username && a.label ? ` (@${a.username})` : ""}</option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={add} disabled={busy || !body.trim()} className="btn btn-blurple mt-3 px-4 py-2 text-sm disabled:opacity-60">{busy ? "Queue ho rahi…" : "Queue me dalo"}</button>
      </div>

      <div className="space-y-2">
        {posts.length === 0 && <p className="text-[13px] text-[#8b93a1]">Abhi koi post queue me nahi.</p>}
        {posts.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-[#111114] px-3.5 py-3">
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#b6bcc7]">{p.platform}</span>
            {p.socialAccountId && accountOf(p.socialAccountId) && (
              <span className="rounded-full bg-[#4f8cff]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8dbcff]">{accountName(accountOf(p.socialAccountId)!)}</span>
            )}
            <span className="min-w-0 flex-1 truncate text-sm text-[#f4f6f8]">{p.body}</span>
            <span className="text-xs text-[#8b93a1]">{new Date(p.scheduledAt).toLocaleString()}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge(p.status)}`}>{p.status}</span>
            {p.status === "queued" && (
              <>
                <button onClick={async () => { await setPostStatus(p.id, "posted"); refresh(); }} className="rounded-md p-1.5 text-[#4ade80] hover:bg-white/[0.06]" title="Posted mark karo"><Check size={15} /></button>
                <button onClick={async () => { await setPostStatus(p.id, "failed"); refresh(); }} className="rounded-md p-1.5 text-[#ff8589] hover:bg-white/[0.06]" title="Failed mark karo"><X size={15} /></button>
              </>
            )}
            <button onClick={async () => { await deletePost(p.id); refresh(); }} className="rounded-md p-1.5 text-[#8b93a1] hover:bg-white/[0.06] hover:text-[#ff8589]" title="Delete"><Trash2 size={15} /></button>
          </div>
        ))}
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
      toast("Daily report save", todayKey());
    } catch (e: any) { toast("Report save nahi hui", e?.message || ""); }
    setBusy(false);
  };

  const cards: [string, number][] = [
    ["Aaj naye leads/contacts", stats.leadsNew],
    ["Aaj emails sent", stats.emailsSent],
    ["Aaj DMs sent", stats.dmsQueued],
    ["Aaj WhatsApp sent", stats.whatsappSent],
    ["Posts queued", stats.postsQueued],
    ["Aaj posts posted", stats.postsPosted],
    ["Stage: Replied (aaj)", stats.replies],
    ["Total contacts", stats.totalContacts],
  ];

  return (
    <div className="p-3 sm:p-4">
      <p className="mb-3 text-[13px] font-semibold text-[#8b93a1]">Aaj ({todayKey()}) ka hisab — data se khud gina gaya. Roz raat summary likh kar save kar do, yahi daily CRM update hai.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, v]) => (
          <div key={label} className="rounded-2xl border border-white/[0.07] bg-[#111114] p-4">
            <p className="text-3xl font-extrabold tracking-tight text-[#f4f6f8]">{v}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#8b93a1]">{label}</p>
          </div>
        ))}
      </div>
      <label className={`${labelCls} mt-5`}>Aaj ki summary</label>
      <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} className={inputCls} placeholder="Aaj kya hua, kal kya karna hai…" />
      <div className="mt-2 flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn btn-blurple px-4 py-2 text-sm disabled:opacity-60">{busy ? "Save ho raha…" : "Report save karo"}</button>
        {saved && <span className="text-xs font-semibold text-[#4ade80]">Aakhri save: {saved}</span>}
      </div>
    </div>
  );
}
