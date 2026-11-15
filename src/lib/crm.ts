"use client";
// ═══════════════════════════════════════════════════════════════════════════
// Business HQ — CRM data layer (supabase/crm-upgrade.sql wali tables par)
// ═══════════════════════════════════════════════════════════════════════════
// Tables: crm_contacts, crm_outreach_log, crm_posts, crm_daily_reports
//
// DEDUPE LOCK: instagram_username / email par DB-level UNIQUE index hai.
// Yahan create/update par unique-violation (Postgres 23505) ko pakar kar
// dostana error dete hain: "ye username/email pehle se hai".
//
// GRACEFUL FALLBACK: agar migration abhi nahi lagi (tables nahi hain) to
// saari list functions KHAALI list dengi aur app crash nahi karegi — HQ page
// par "CRM tables abhi nahi lage" wali note ajayegi.
import { supabase } from "./supabase";

export type CrmKind = "client" | "partner" | "affiliate" | "lead";
export type CrmStage = "new" | "contacted" | "replied" | "meeting" | "client" | "done" | "lost";
export type OutreachChannel = "email" | "dm" | "whatsapp";
export type PostPlatform = "threads" | "instagram" | "facebook";
export type PostStatus = "queued" | "posted" | "failed";

export const CRM_STAGES: CrmStage[] = ["new", "contacted", "replied", "meeting", "client", "done", "lost"];
export const CRM_KINDS: CrmKind[] = ["client", "partner", "affiliate", "lead"];

export const STAGE_LABEL: Record<CrmStage, string> = {
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  meeting: "Meeting",
  client: "Client",
  done: "Done",
  lost: "Lost",
};
export const KIND_LABEL: Record<CrmKind, string> = {
  client: "Client",
  partner: "Partner",
  affiliate: "Affiliate",
  lead: "Lead",
};

export interface CrmContact {
  id: string;
  kind: CrmKind;
  name: string;
  instagramUsername: string | null;
  email: string | null;
  whatsapp: string | null;
  stage: CrmStage;
  notes: string;
  source: string;
  createdAt: number; // ms epoch
  updatedAt: number;
  lastContactedAt: number | null;
}

export interface CrmOutreach {
  id: string;
  contactId: string;
  channel: OutreachChannel;
  template: string;
  body: string;
  sentAt: number;
}

export interface CrmPost {
  id: string;
  platform: PostPlatform;
  body: string;
  scheduledAt: number;
  status: PostStatus;
  postedAt: number | null;
  createdAt: number;
  /** Kis connected account se jayegi — null = default (pehla connected) */
  socialAccountId: string | null;
  /** Kis partner ki post hai (one-tap) — null = owner ki apni post */
  crmContactId: string | null;
}

export interface CrmDailyReport {
  day: string; // YYYY-MM-DD
  leadsNew: number;
  emailsSent: number;
  dmsQueued: number;
  replies: number;
  stageMoves: number;
  summary: string;
}

/** Tables mojood hain ya nahi — HQ page is se "migration baqi" note dikhati hai */
export let crmTablesReady = true;

// ── helpers ────────────────────────────────────────────────────────────────
const toMs = (v: any): number => {
  if (!v) return 0;
  const t = typeof v === "number" ? v : Date.parse(v);
  return Number.isFinite(t) ? t : 0;
};
const clean = (v?: string | null): string | null => {
  const s = (v || "").trim();
  return s ? s : null;
};
export const normIg = (v?: string | null): string | null => {
  const s = clean(v)?.replace(/^@+/, "").toLowerCase();
  return s || null;
};
export const normEmail = (v?: string | null): string | null => {
  const s = clean(v)?.toLowerCase();
  return s || null;
};

function rowToContact(r: any): CrmContact {
  return {
    id: r.id,
    kind: (r.kind || "lead") as CrmKind,
    name: r.name || "",
    instagramUsername: r.instagram_username || null,
    email: r.email || null,
    whatsapp: r.whatsapp || null,
    stage: (r.stage || "new") as CrmStage,
    notes: r.notes || "",
    source: r.source || "",
    createdAt: toMs(r.created_at),
    updatedAt: toMs(r.updated_at),
    lastContactedAt: r.last_contacted_at ? toMs(r.last_contacted_at) : null,
  };
}
function rowToOutreach(r: any): CrmOutreach {
  return { id: r.id, contactId: r.contact_id, channel: r.channel, template: r.template || "", body: r.body || "", sentAt: toMs(r.sent_at) };
}
function rowToPost(r: any): CrmPost {
  return {
    id: r.id,
    platform: r.platform,
    body: r.body || "",
    scheduledAt: toMs(r.scheduled_at),
    status: (r.status || "queued") as PostStatus,
    postedAt: r.posted_at ? toMs(r.posted_at) : null,
    createdAt: toMs(r.created_at),
    socialAccountId: r.social_account_id || null,
    crmContactId: r.crm_contact_id || null,
  };
}

/** Postgres unique-violation ko dostana dedupe error me badlo */
export class CrmDuplicateError extends Error {
  field: "instagram" | "email" | "generic";
  constructor(field: "instagram" | "email" | "generic", msg: string) {
    super(msg);
    this.field = field;
  }
}
function mapError(e: any): Error {
  const msg = String(e?.message || e || "");
  const code = String(e?.code || "");
  if (code === "23505" || /duplicate key|unique/i.test(msg)) {
    if (/ig_unique|instagram/i.test(msg)) return new CrmDuplicateError("instagram", "This Instagram username already exists — duplicates aren't allowed.");
    if (/email_unique|email/i.test(msg)) return new CrmDuplicateError("email", "This email already exists — duplicates aren't allowed.");
    return new CrmDuplicateError("generic", "This contact already exists (duplicate username or email).");
  }
  return e instanceof Error ? e : new Error(msg || "Something went wrong");
}
const isMissingTable = (e: any) => {
  const m = String(e?.message || "");
  return /relation .* does not exist|schema cache|Could not find the table/i.test(m) || String(e?.code || "") === "42P01";
};

// ── contacts ───────────────────────────────────────────────────────────────
export async function listContacts(): Promise<CrmContact[]> {
  try {
    const { data, error } = await supabase().from("crm_contacts").select("*").order("created_at", { ascending: false }).limit(1000);
    if (error) throw error;
    crmTablesReady = true;
    return (data || []).map(rowToContact);
  } catch (e) {
    if (isMissingTable(e)) { crmTablesReady = false; return []; }
    return [];
  }
}

export interface ContactInput {
  kind: CrmKind;
  name: string;
  instagramUsername?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  stage?: CrmStage;
  notes?: string;
  source?: string;
}

export async function createContact(input: ContactInput): Promise<CrmContact> {
  const row = {
    kind: input.kind,
    name: input.name.trim(),
    instagram_username: normIg(input.instagramUsername),
    email: normEmail(input.email),
    whatsapp: clean(input.whatsapp),
    stage: input.stage || "new",
    notes: input.notes || "",
    source: input.source || "manual",
  };
  const { data, error } = await supabase().from("crm_contacts").insert(row).select("*").single();
  if (error) throw mapError(error);
  return rowToContact(data);
}

export async function updateContact(id: string, patch: Partial<ContactInput> & { lastContactedAt?: number | null }): Promise<CrmContact> {
  const row: Record<string, any> = {};
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.instagramUsername !== undefined) row.instagram_username = normIg(patch.instagramUsername);
  if (patch.email !== undefined) row.email = normEmail(patch.email);
  if (patch.whatsapp !== undefined) row.whatsapp = clean(patch.whatsapp);
  if (patch.stage !== undefined) row.stage = patch.stage;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.source !== undefined) row.source = patch.source;
  if (patch.lastContactedAt !== undefined) row.last_contacted_at = patch.lastContactedAt ? new Date(patch.lastContactedAt).toISOString() : null;
  const { data, error } = await supabase().from("crm_contacts").update(row).eq("id", id).select("*").single();
  if (error) throw mapError(error);
  return rowToContact(data);
}

export async function moveStage(id: string, stage: CrmStage): Promise<CrmContact> {
  return updateContact(id, { stage });
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase().from("crm_contacts").delete().eq("id", id);
  if (error) throw mapError(error);
}

// ── outreach log (first-touch dedupe) ─────────────────────────────────────
export async function listOutreach(contactId?: string): Promise<CrmOutreach[]> {
  try {
    let q = supabase().from("crm_outreach_log").select("*").order("sent_at", { ascending: false }).limit(1000);
    if (contactId) q = q.eq("contact_id", contactId);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(rowToOutreach);
  } catch {
    return [];
  }
}

/** Is bande ko is channel par pehla message ja sakta hai? Log ho to NAHI (repeat band). */
export function canSendTo(contactId: string, channel: OutreachChannel, log: CrmOutreach[]): boolean {
  return !log.some((o) => o.contactId === contactId && o.channel === channel);
}

export async function recordOutreach(contactId: string, channel: OutreachChannel, body: string, template = ""): Promise<CrmOutreach> {
  const { data, error } = await supabase()
    .from("crm_outreach_log")
    .insert({ contact_id: contactId, channel, body, template })
    .select("*")
    .single();
  if (error) {
    // UNIQUE(contact_id, channel) — matlab pehle hi bheja ja chuka hai
    if (String(error.code || "") === "23505") throw new CrmDuplicateError("generic", "A first message has already been sent on this channel — repeats aren't allowed.");
    throw mapError(error);
  }
  // last_contacted_at bhi update kar do (best-effort)
  try { await updateContact(contactId, { lastContactedAt: Date.now() }); } catch { /* ignore */ }
  return rowToOutreach(data);
}

/** Personalized ready message — naam + kind ke hisab se (simple template) */
export function outreachTemplate(c: CrmContact, channel: OutreachChannel): string {
  const first = (c.name || "bhai").split(" ")[0];
  if (channel === "email") {
    return `Assalam-o-Alaikum ${first},\n\nMain Sheraz hoon, Symbiote Systems se. Hum businesses ke liye AI websites, chatbots aur voice agents banate hain — jo customers ko 24/7 jawab dein aur bookings khud lein.\n\nAap ke liye aik chhota sa demo bana kar dikhaun? Sirf 2 minute lagenge, phir aap ki marzi.\n\n— Sheraz, Symbiote Systems`;
  }
  if (channel === "whatsapp") {
    return `Assalam-o-Alaikum ${first} bhai, main Sheraz — Symbiote Systems se. Hum aap jaisi businesses ke liye AI website + chatbot banate hain jo customers ko khud jawab de aur bookings le. Aik 2-minute ka demo dikha dun? Phir aap ki marzi.`;
  }
  // dm (Instagram)
  return `Assalam-o-Alaikum ${first}! Main Sheraz hoon, Symbiote Systems se — hum businesses ke liye AI website + chatbot banate hain jo DMs/customers ko 24/7 khud jawab de. Aap ke liye aik chhota demo dikhaun? 🙌`;
}

// ── posts queue ────────────────────────────────────────────────────────────
export async function listPosts(): Promise<CrmPost[]> {
  try {
    const { data, error } = await supabase().from("crm_posts").select("*").order("scheduled_at", { ascending: true }).limit(500);
    if (error) throw error;
    return (data || []).map(rowToPost);
  } catch {
    return [];
  }
}

export async function queuePost(
  platform: PostPlatform,
  body: string,
  scheduledAt: number,
  socialAccountId?: string | null,
  crmContactId?: string | null
): Promise<CrmPost> {
  const { data, error } = await supabase()
    .from("crm_posts")
    .insert({
      platform,
      body: body.trim(),
      scheduled_at: new Date(scheduledAt).toISOString(),
      status: "queued",
      social_account_id: socialAccountId || null,
      crm_contact_id: crmContactId || null,
    })
    .select("*")
    .single();
  if (error) throw mapError(error);
  return rowToPost(data);
}

export async function setPostStatus(id: string, status: PostStatus): Promise<void> {
  const patch: Record<string, any> = { status };
  if (status === "posted") patch.posted_at = new Date().toISOString();
  const { error } = await supabase().from("crm_posts").update(patch).eq("id", id);
  if (error) throw mapError(error);
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase().from("crm_posts").delete().eq("id", id);
  if (error) throw mapError(error);
}

// ── daily report ───────────────────────────────────────────────────────────
export function todayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function getDailyReport(day = todayKey()): Promise<CrmDailyReport | null> {
  try {
    const { data, error } = await supabase().from("crm_daily_reports").select("*").eq("day", day).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      day: data.day,
      leadsNew: data.leads_new || 0,
      emailsSent: data.emails_sent || 0,
      dmsQueued: data.dms_queued || 0,
      replies: data.replies || 0,
      stageMoves: data.stage_moves || 0,
      summary: data.summary || "",
    };
  } catch {
    return null;
  }
}

export async function upsertDailyReport(r: CrmDailyReport): Promise<void> {
  const { error } = await supabase()
    .from("crm_daily_reports")
    .upsert(
      {
        day: r.day,
        leads_new: r.leadsNew,
        emails_sent: r.emailsSent,
        dms_queued: r.dmsQueued,
        replies: r.replies,
        stage_moves: r.stageMoves,
        summary: r.summary,
      },
      { onConflict: "day" }
    );
  if (error) throw mapError(error);
}

/** Aaj ke counters mojooda data se gin lo (report tab ke liye) */
export function computeTodayStats(contacts: CrmContact[], outreach: CrmOutreach[], posts: CrmPost[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const t0 = start.getTime();
  return {
    leadsNew: contacts.filter((c) => c.createdAt >= t0).length,
    emailsSent: outreach.filter((o) => o.channel === "email" && o.sentAt >= t0).length,
    dmsQueued: outreach.filter((o) => o.channel === "dm" && o.sentAt >= t0).length,
    whatsappSent: outreach.filter((o) => o.channel === "whatsapp" && o.sentAt >= t0).length,
    postsQueued: posts.filter((p) => p.status === "queued").length,
    postsPosted: posts.filter((p) => p.status === "posted" && (p.postedAt || 0) >= t0).length,
    replies: contacts.filter((c) => c.stage === "replied" && c.updatedAt >= t0).length,
    totalContacts: contacts.length,
    totalClients: contacts.filter((c) => c.kind === "client" || c.stage === "client").length,
  };
}

// ── social accounts (Connect Threads) ─────────────────────────────────────
// SECURITY: client sirf SAFE columns select karta hai (id, platform,
// username, token_expires_at, label, crm_contact_id) — access_token column
// client query me KABHI select nahi hota. Token sirf server routes
// (service role) parhte/likhte hain.
export interface SocialAccountStatus {
  id: string;
  platform: string;
  username: string | null;
  tokenExpiresAt: number | null;
  /** Account ka label (partner ka naam) — owner ke default account par null */
  label: string | null;
  /** Kis CRM contact (partner/affiliate) se linked hai — owner default par null */
  crmContactId: string | null;
}

const SOCIAL_SAFE_COLUMNS = "id, platform, username, token_expires_at, label, crm_contact_id";
function rowToSocialAccount(r: any): SocialAccountStatus {
  return {
    id: r.id,
    platform: r.platform,
    username: r.username || null,
    tokenExpiresAt: r.token_expires_at ? toMs(r.token_expires_at) : null,
    label: r.label || null,
    crmContactId: r.crm_contact_id || null,
  };
}

export async function getThreadsAccount(): Promise<SocialAccountStatus | null> {
  try {
    const { data, error } = await supabase()
      .from("social_accounts")
      .select(SOCIAL_SAFE_COLUMNS)
      .eq("platform", "threads")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return rowToSocialAccount(data);
  } catch {
    // table abhi nahi lagi (SQL baqi) ya RLS — "not connected" jaisa behave karo
    return null;
  }
}

/** Saare connected Threads accounts (owner default + partners) — Posting tab
 *  ki list aur account-select ke liye. Sirf SAFE columns (token kabhi nahi). */
export async function getThreadsAccounts(): Promise<SocialAccountStatus[]> {
  try {
    const { data, error } = await supabase()
      .from("social_accounts")
      .select(SOCIAL_SAFE_COLUMNS)
      .eq("platform", "threads")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map(rowToSocialAccount);
  } catch {
    return [];
  }
}

/** Realtime — crm_contacts / outreach / posts par koi change aye to callback */
export function subscribeCrm(onChange: () => void): () => void {
  try {
    const ch = supabase()
      .channel("crm-hq-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_contacts" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_outreach_log" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_posts" }, onChange)
      .subscribe();
    return () => {
      try { supabase().removeChannel(ch); } catch { /* ignore */ }
    };
  } catch {
    return () => {};
  }
}
