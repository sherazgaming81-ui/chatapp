// ═══════════════════════════════════════════════════════════════════════════
// SERVER-ONLY Supabase admin client (service role — RLS bypass)
// ═══════════════════════════════════════════════════════════════════════════
// SIRF Next.js route handlers (src/app/api/**) me import karo.
// Client components me KABHI import na karo — service role key browser me
// jana sakht mana hai. Key env se ati hai: SUPABASE_SERVICE_ROLE_KEY
// (Vercel project env me owner khud dalta hai — chat/code me kabhi nahi).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("supabaseAdmin sirf server par istemal ho sakta hai");
  }
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL env missing hai");
  }
  admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
