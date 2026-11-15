"use client";
// ═══════════════════════════════════════════════════════════════════════════
// Business HQ — Tasks data layer (supabase/tasks-phase3.sql wali table par)
// ═══════════════════════════════════════════════════════════════════════════
// Table: crm_tasks (title, notes, contact_id → crm_contacts, due_at,
// priority low/medium/high, status open/done, completed_at).
//
// Contact ka NAAM yahan store nahi hota — caller apni contacts list
// (lib/crm.ts listContacts) se client-side resolve karta hai, taake naam
// hamesha fresh rahe.
//
// GRACEFUL FALLBACK: agar migration abhi nahi lagi (table nahi hai) to
// listTasks KHAALI list degi aur tasksTableReady=false ho jayega — HQ ka
// Tasks tab ek note dikha dega, app crash nahi karegi (crm.ts wala pattern).
import { supabase } from "./supabase";

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "open" | "done";

export const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

export interface CrmTask {
  id: string;
  title: string;
  notes: string;
  contactId: string | null;
  dueAt: number | null; // ms epoch
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: number; // ms epoch
  completedAt: number | null; // ms epoch
}

export interface TaskInput {
  title: string;
  notes?: string;
  contactId?: string | null;
  dueAt?: number | null; // ms epoch
  priority?: TaskPriority;
}

/** Table mojood hai ya nahi — Tasks tab is se "migration baqi" note dikhata hai */
export let tasksTableReady = true;

// ── helpers (crm.ts wala hi pattern) ───────────────────────────────────────
const toMs = (v: any): number => {
  if (!v) return 0;
  const t = typeof v === "number" ? v : Date.parse(v);
  return Number.isFinite(t) ? t : 0;
};
const isMissingTable = (e: any) => {
  const m = String(e?.message || "");
  return /relation .* does not exist|schema cache|Could not find the table/i.test(m) || String(e?.code || "") === "42P01";
};
function friendlyError(e: any): Error {
  if (isMissingTable(e)) return new Error("The tasks table isn't in the database yet — run supabase/tasks-phase3.sql first.");
  return e instanceof Error ? e : new Error(String(e?.message || e || "Something went wrong"));
}

function rowToTask(r: any): CrmTask {
  return {
    id: r.id,
    title: r.title || "",
    notes: r.notes || "",
    contactId: r.contact_id || null,
    dueAt: r.due_at ? toMs(r.due_at) : null,
    priority: (["low", "medium", "high"].includes(r.priority) ? r.priority : "medium") as TaskPriority,
    status: (r.status === "done" ? "done" : "open") as TaskStatus,
    createdAt: toMs(r.created_at),
    completedAt: r.completed_at ? toMs(r.completed_at) : null,
  };
}

// ── CRUD ───────────────────────────────────────────────────────────────────
/** Saari tasks — pehle due wali (bina due wali aakhir me), phir nayi pehle */
export async function listTasks(): Promise<CrmTask[]> {
  try {
    const { data, error } = await supabase()
      .from("crm_tasks")
      .select("*")
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    tasksTableReady = true;
    return (data || []).map(rowToTask);
  } catch (e) {
    if (isMissingTable(e)) tasksTableReady = false;
    return [];
  }
}

export async function createTask(input: TaskInput): Promise<CrmTask> {
  const row = {
    title: input.title.trim(),
    notes: input.notes || "",
    contact_id: input.contactId || null,
    due_at: input.dueAt ? new Date(input.dueAt).toISOString() : null,
    priority: input.priority || "medium",
    status: "open",
  };
  const { data, error } = await supabase().from("crm_tasks").insert(row).select("*").single();
  if (error) throw friendlyError(error);
  return rowToTask(data);
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<CrmTask> {
  const row: Record<string, any> = {};
  if (patch.title !== undefined) row.title = patch.title.trim();
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.contactId !== undefined) row.contact_id = patch.contactId || null;
  if (patch.dueAt !== undefined) row.due_at = patch.dueAt ? new Date(patch.dueAt).toISOString() : null;
  if (patch.priority !== undefined) row.priority = patch.priority;
  const { data, error } = await supabase().from("crm_tasks").update(row).eq("id", id).select("*").single();
  if (error) throw friendlyError(error);
  return rowToTask(data);
}

/** Task complete karo — status done + completed_at abhi */
export async function completeTask(id: string): Promise<CrmTask> {
  const { data, error } = await supabase()
    .from("crm_tasks")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw friendlyError(error);
  return rowToTask(data);
}

/** Completed task ko wapas open karo */
export async function reopenTask(id: string): Promise<CrmTask> {
  const { data, error } = await supabase()
    .from("crm_tasks")
    .update({ status: "open", completed_at: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw friendlyError(error);
  return rowToTask(data);
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase().from("crm_tasks").delete().eq("id", id);
  if (error) throw friendlyError(error);
}
