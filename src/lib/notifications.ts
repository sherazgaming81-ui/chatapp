"use client";
// ═══════════════════════════════════════════════════════════════════════════
// Notifications center — data layer
// SIRF asal events, mojooda CRM data se derive karke. Koi fake notification
// NAHI banti: har item kisi asal DB row (post / contact / report) se ata hai.
// Owner-only data hai (crm tables par owner RLS) — bell sirf owner ko dikhta
// hai, aur RLS khud bhi data members ko nahi deti.
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from "./supabase";
import { listContacts, listPosts, KIND_LABEL } from "./crm";

export type NotifSection = "crm" | "posting" | "report";
export type NotifKind = "failed_post" | "partner_posted" | "new_contact" | "daily_report";

export interface NotifItem {
  id: string;
  kind: NotifKind;
  text: string;
  at: number; // ms epoch — sorting + "seen" badge ke liye
  section: NotifSection;
  contactId?: string; // new_contact par — click par CRM drawer khulta hai
}

const clip = (s: string, n = 60) => (s.length > n ? s.slice(0, n).trimEnd() + "…" : s);

export async function fetchNotifications(): Promise<NotifItem[]> {
  const items: NotifItem[] = [];
  try {
    const [posts, contacts] = await Promise.all([listPosts(), listContacts()]);
    const contactName = (id: string | null) => contacts.find((c) => c.id === id)?.name || "A partner";

    // 1) Failed posts — recent first
    posts
      .filter((p) => p.status === "failed")
      .sort((a, b) => (b.postedAt || b.scheduledAt) - (a.postedAt || a.scheduledAt))
      .slice(0, 5)
      .forEach((p) =>
        items.push({
          id: `failed-${p.id}`,
          kind: "failed_post",
          text: `Post failed on ${p.platform}: “${clip(p.body)}”`,
          at: p.postedAt || p.scheduledAt || p.createdAt,
          section: "posting",
        })
      );

    // 2) Partner posts marked posted (one-tap completion)
    posts
      .filter((p) => p.crmContactId && p.status === "posted")
      .sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0))
      .slice(0, 5)
      .forEach((p) =>
        items.push({
          id: `partner-${p.id}`,
          kind: "partner_posted",
          text: `${contactName(p.crmContactId)} marked a ${p.platform} post as posted: “${clip(p.body, 45)}”`,
          at: p.postedAt || p.scheduledAt || p.createdAt,
          section: "posting",
        })
      );

    // 3) New contacts added today
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    contacts
      .filter((c) => c.createdAt >= dayStart.getTime())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
      .forEach((c) =>
        items.push({
          id: `contact-${c.id}`,
          kind: "new_contact",
          text: `New ${KIND_LABEL[c.kind].toLowerCase()} added: ${c.name || "—"}`,
          at: c.createdAt,
          section: "crm",
          contactId: c.id,
        })
      );

    // 4) Latest daily report (sab se recent row — ek hi item)
    try {
      const { data } = await supabase()
        .from("crm_daily_reports")
        .select("day")
        .order("day", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.day) {
        const at = new Date(`${data.day}T20:00:00`).getTime();
        items.push({
          id: `report-${data.day}`,
          kind: "daily_report",
          text: `Daily report saved for ${data.day}`,
          at: Number.isFinite(at) ? at : Date.now(),
          section: "report",
        });
      }
    } catch { /* table na ho to item hi nahi — fake kuch nahi */ }
  } catch { /* koi data na mile to khaali list — crash nahi */ }

  return items.sort((a, b) => b.at - a.at).slice(0, 15);
}

/** "Mark all as seen" ka timestamp — localStorage me rehta hai */
const SEEN_KEY = "chatsapp:notif:seenAt";
export function getNotifSeenAt(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}
export function setNotifSeenAt(ms: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(ms));
  } catch { /* ignore */ }
}
