"use client";
// Favorites system — GIF/Sticker favorites.
// Local: localStorage (unlimited, persists across sessions).
// Cloud: Supabase `user_favorites` table (sync on login, per user).

import { supabase } from "./supabase";

export interface FavoriteItem {
  id: string;
  url: string;
  preview: string;
  title: string;
  type: "gif" | "sticker";
}

const LS_KEY = "chatsapp_favorites";
const EVT = "chatsapp:favorites-changed";

/* ---------- local storage ---------- */

function loadLocal(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => x && x.id && x.url) : [];
  } catch {
    return [];
  }
}

function saveLocal(items: FavoriteItem[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    /* quota — keep in-memory only */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVT));
  }
}

/* ---------- public API ---------- */

export function getFavorites(type?: "gif" | "sticker"): FavoriteItem[] {
  const all = loadLocal();
  return type ? all.filter((f) => f.type === type) : all;
}

export function isFavorite(id: string): boolean {
  return loadLocal().some((f) => f.id === id);
}

export function getFavoriteCount(type?: "gif" | "sticker"): number {
  return getFavorites(type).length;
}

export function addFavorite(item: FavoriteItem): void {
  const all = loadLocal();
  if (all.some((f) => f.id === item.id)) return;
  all.unshift(item);
  saveLocal(all);
  void pushToCloud(item);
}

export function removeFavorite(id: string): void {
  const all = loadLocal().filter((f) => f.id !== id);
  saveLocal(all);
  void removeFromCloud(id);
}

/** Toggle — returns true if now favorited. */
export function toggleFavorite(item: FavoriteItem): boolean {
  if (isFavorite(item.id)) {
    removeFavorite(item.id);
    return false;
  }
  addFavorite(item);
  return true;
}

/** Re-render hook for components. */
export function subscribeFavorites(fn: () => void): () => void {
  const h = () => fn();
  window.addEventListener(EVT, h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener(EVT, h);
    window.removeEventListener("storage", h);
  };
}

/* ---------- Supabase sync ---------- */

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase().auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function pushToCloud(item: FavoriteItem) {
  const uid = await currentUserId();
  if (!uid) return;
  try {
    await supabase().from("user_favorites").upsert(
      {
        user_id: uid,
        item_id: item.id,
        url: item.url,
        preview: item.preview,
        title: item.title,
        type: item.type,
      },
      { onConflict: "user_id,item_id" }
    );
  } catch {
    /* table may not exist yet — local still works */
  }
}

async function removeFromCloud(itemId: string) {
  const uid = await currentUserId();
  if (!uid) return;
  try {
    await supabase().from("user_favorites").delete().eq("user_id", uid).eq("item_id", itemId);
  } catch {
    /* ignore */
  }
}

/**
 * Sync on login: push local favorites up, pull cloud favorites down, merge.
 * Safe to call anytime — no-ops when logged out or table missing.
 */
export async function syncFavoritesOnLogin(): Promise<void> {
  const uid = await currentUserId();
  if (!uid) return;
  try {
    const sb = supabase();
    // push local up
    const local = loadLocal();
    if (local.length > 0) {
      await sb.from("user_favorites").upsert(
        local.map((f) => ({
          user_id: uid,
          item_id: f.id,
          url: f.url,
          preview: f.preview,
          title: f.title,
          type: f.type,
        })),
        { onConflict: "user_id,item_id" }
      );
    }
    // pull cloud down + merge
    const { data, error } = await sb
      .from("user_favorites")
      .select("item_id,url,preview,title,type")
      .eq("user_id", uid);
    if (error || !data) return;
    const seen = new Set(local.map((f) => f.id));
    const merged = [...local];
    for (const row of data) {
      if (!row.item_id || !row.url || seen.has(row.item_id)) continue;
      seen.add(row.item_id);
      merged.push({
        id: row.item_id,
        url: row.url,
        preview: row.preview || row.url,
        title: row.title || "",
        type: row.type === "sticker" ? "sticker" : "gif",
      });
    }
    saveLocal(merged);
  } catch {
    /* offline / table missing — local still works */
  }
}

/* ---------- SQL for parent to run once in Supabase ----------
create table if not exists user_favorites (
  user_id uuid not null,
  item_id text not null,
  url text not null,
  preview text,
  title text,
  type text not null default 'gif',
  created_at timestamptz default now(),
  primary key (user_id, item_id)
);
alter table user_favorites enable row level security;
create policy "own favorites" on user_favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
----------------------------------------------------------- */
