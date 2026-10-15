"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return client;
}

export const OWNER_EMAIL = "sherazgaming81@gmail.com";
export const MAIN_GROUP_ID = "madrasa"; // is_main_group=true wali chat
