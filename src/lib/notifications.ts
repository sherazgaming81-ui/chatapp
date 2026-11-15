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
import { listTasks } from "./tasks";

export type NotifSection = "crm" | "tasks" | "posting" | "report";
export type NotifKind = "failed_post" | "partner_posted" | "new_contact" | "daily_report" | "task_overdue" | "task_today" | "followup_today";

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
    const [posts, contacts, tasks] = await Promise.all([listPosts(), listContacts(), listTasks()]);
    const contactName = (id: string | null) => contacts.find((c) => c.id === id)?.name || "A partner";
    const taskContactName = (id: string | null) => (id ? contacts.find((c) => c.id === id)?.name || null : null);

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

    // 4) Overdue tasks (open, due_at guzar chuka) — sab se purani pehle, top 3
    const nowMs = Date.now();
    tasks
      .filter((t) => t.status === "open" && t.dueAt !== null && t.dueAt < nowMs)
      .sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0))
      .slice(0, 3)
      .forEach((t) => {
        const cn = taskContactName(t.contactId);
        items.push({
          id: `task-overdue-${t.id}`,
          kind: "task_overdue",
          text: `Task overdue: “${clip(t.title, 45)}”${cn ? ` — ${cn}` : ""}`,
          at: t.dueAt || t.createdAt,
          section: "tasks",
        });
      });

    // 5) Tasks due today (open, due_at aaj ke din ke andar) — top 3
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    tasks
      .filter((t) => t.status === "open" && t.dueAt !== null && t.dueAt >= dayStart.getTime() && t.dueAt <= dayEnd.getTime())
      .sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0))
      .slice(0, 3)
      .forEach((t) => {
        const cn = taskContactName(t.contactId);
        items.push({
          id: `task-today-${t.id}`,
          kind: "task_today",
          text: `Task due today: “${clip(t.title, 45)}”${cn ? ` — ${cn}` : ""}`,
          at: t.dueAt || t.createdAt,
          section: "tasks",
        });
      });

    // 6) Follow-ups due today (follow_up_at aaj, stage done/lost nahi) — top 3
    contacts
      .filter((c) => c.followUpAt !== null && c.followUpAt >= dayStart.getTime() && c.followUpAt <= dayEnd.getTime() && c.stage !== "done" && c.stage !== "lost")
      .sort((a, b) => (a.followUpAt || 0) - (b.followUpAt || 0))
      .slice(0, 3)
      .forEach((c) =>
        items.push({
          id: `followup-${c.id}`,
          kind: "followup_today",
          text: `Follow-up due today: ${c.name || "—"}`,
          at: c.followUpAt || c.createdAt,
          section: "crm",
          contactId: c.id,
        })
      );

    // 7) Latest daily report (sab se recent row — ek hi item)
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
