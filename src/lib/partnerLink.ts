// ═══════════════════════════════════════════════════════════════════════════
// SERVER-ONLY — Partner Threads connect links (signed invite)
// ═══════════════════════════════════════════════════════════════════════════
// Owner CRM se partner ko aik link bhejta hai:
//   /threads/connect?c=<crm_contact_id>&s=<signature>
// Partner us link se (bina ChatsApp login ke) apna Threads account jodta
// hai. Signature HMAC-SHA256 hai — key env POSTING_CRON_SECRET hai (alag
// secret NAHI banaya, wahi server secret dobara istemal hota hai).
// Bina sahi signature ke link kaam nahi karta — koi ghair banda kisi aur
// ke contact par apna account nahi jod sakta.
// Client components me KABHI import na karo (secret server par rehta hai).
import { createHmac, timingSafeEqual } from "crypto";

function secret(): string | null {
  const s = process.env.POSTING_CRON_SECRET;
  return s && s.length >= 8 ? s : null;
}

function sign(contactId: string, key: string): string {
  return createHmac("sha256", key).update(`partner-connect:${contactId}`).digest("hex");
}

/** Signed partner connect path banao. Secret missing ho to null. */
export function signPartnerLink(contactId: string): string | null {
  const key = secret();
  if (!key || !contactId) return null;
  const s = sign(contactId, key);
  return `/threads/connect?c=${encodeURIComponent(contactId)}&s=${s}`;
}

/** Signature verify karo — timing-safe compare. */
export function verifyPartnerLink(contactId: string, sig: string): boolean {
  const key = secret();
  if (!key || !contactId || !sig) return false;
  const expected = sign(contactId, key);
  if (expected.length !== sig.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(sig, "utf8"));
  } catch {
    return false;
  }
}
