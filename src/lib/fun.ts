"use client";
// ─────────────────────────────────────────────────────────────
// Fun Features — payload parsers + Truth/Dare banks + text FX detect
// Payloads Message.caption me JSON string ki surat me aate hain (db.ts dekho).
// ─────────────────────────────────────────────────────────────

export type FxKind = "hearts" | "confetti" | "stars";

/* ───────── Spin Wheel ───────── */
export interface SpinPayload {
  options: string[];
  result: number | null;
  spunBy: string | null;
  t?: string;
}
export function parseSpin(caption?: string): SpinPayload | null {
  try {
    const d = JSON.parse(caption || "");
    if (
      d &&
      Array.isArray(d.options) &&
      d.options.length >= 2 &&
      d.options.every((o: unknown) => typeof o === "string") &&
      (d.result === null || (typeof d.result === "number" && d.result >= 0 && d.result < d.options.length)) &&
      (d.spunBy === null || typeof d.spunBy === "string")
    ) {
      return { options: d.options as string[], result: d.result, spunBy: d.spunBy ?? null, t: typeof d.t === "string" ? d.t : undefined };
    }
  } catch { /* ignore */ }
  return null;
}

/* ───────── Lafz Silsila ───────── */
export interface SilsilaWord { w: string; by: string }
export interface SilsilaPayload {
  words: SilsilaWord[];
  scores: Record<string, number>;
  lastBy: string | null;
  done: boolean;
  winner: string | null;
  endedBy?: string | null;
  t?: string;
}
export function parseSilsila(caption?: string): SilsilaPayload | null {
  try {
    const d = JSON.parse(caption || "");
    if (
      d &&
      Array.isArray(d.words) &&
      d.words.length > 0 &&
      d.words.every((x: any) => x && typeof x.w === "string" && typeof x.by === "string") &&
      d.scores &&
      typeof d.scores === "object" &&
      !Array.isArray(d.scores) &&
      Object.values(d.scores).every((v) => typeof v === "number") &&
      typeof d.done === "boolean"
    ) {
      return {
        words: d.words as SilsilaWord[],
        scores: d.scores as Record<string, number>,
        lastBy: typeof d.lastBy === "string" ? d.lastBy : null,
        done: d.done,
        winner: typeof d.winner === "string" ? d.winner : null,
        endedBy: typeof d.endedBy === "string" ? d.endedBy : null,
        t: typeof d.t === "string" ? d.t : undefined,
      };
    }
  } catch { /* ignore */ }
  return null;
}

/* ───────── Truth or Dare ───────── */
export interface TruthDarePayload {
  mode: "truth" | "dare";
  q: string;
  t?: string;
}
export function parseTruthDare(caption?: string): TruthDarePayload | null {
  try {
    const d = JSON.parse(caption || "");
    if (d && (d.mode === "truth" || d.mode === "dare") && typeof d.q === "string" && d.q.trim()) {
      return { mode: d.mode, q: d.q, t: typeof d.t === "string" ? d.t : undefined };
    }
  } catch { /* ignore */ }
  return null;
}

/* ───────── Gumnam Paigham ───────── */
export interface GumnamPayload {
  body: string;
  t?: string;
}
export function parseGumnam(caption?: string): GumnamPayload | null {
  try {
    const d = JSON.parse(caption || "");
    if (d && typeof d.body === "string" && d.body.trim()) {
      return { body: d.body, t: typeof d.t === "string" ? d.t : undefined };
    }
  } catch { /* ignore */ }
  return null;
}

/* ───────── Super Reaction ───────── */
export interface SuperPayload {
  emoji: string;
  kind: FxKind;
  target: string | null;
  t?: string;
}
export function parseSuper(caption?: string): SuperPayload | null {
  try {
    const d = JSON.parse(caption || "");
    if (
      d &&
      typeof d.emoji === "string" &&
      d.emoji &&
      (d.kind === "hearts" || d.kind === "confetti" || d.kind === "stars")
    ) {
      return {
        emoji: d.emoji,
        kind: d.kind,
        target: typeof d.target === "string" ? d.target : null,
        t: typeof d.t === "string" ? d.t : undefined,
      };
    }
  } catch { /* ignore */ }
  return null;
}

/* ───────── Truth bank (family-friendly, deen-safe) ───────── */
export const TRUTH_BANK: string[] = [
  "Apni zindagi ki sab se funny harkat batao jo aaj tak kisi ko nahi batayi",
  "Bachpan ki wo konsi baat hai jo yaad karke aaj bhi hansi aati hai?",
  "Agar ek din ke liye invisible ho jao to sab se pehle kya karoge?",
  "Apni sab se ajeeb aadat batao jo doston ko nahi pata",
  "Zindagi me sab se zyada dar kab laga tha aur kyun?",
  "Agar lottery lag jaye to sab se pehla kaam kya karoge?",
  "Madrasa ya school ki sab se yaadgar shararat batao",
  "Wo konsa khana hai jo tum roz kha sakte ho aur kabhi bore nahi hote?",
  "Apne baare me ek aisi baat batao jo sun kar sab hairaan ho jayein",
  "Sab se mushkil din zindagi ka konsa tha aur us se kya seekha?",
  "Agar waqt me peeche ja sako to konsi ek ghalti theek karoge?",
  "Doston me se kis ki konsi aadat tum apnana chahte ho?",
  "Phone me sab se zyada waqt kis app par guzarta hai? Sach batao",
  "Wo konsa sapna hai jo tum har surat poora karna chahte ho?",
];

/* ───────── Dare bank (family-friendly, deen-safe) ───────── */
export const DARE_BANK: string[] = [
  "Group me apni bachpan ki koi funny photo bhejo",
  "Agli 3 messages sirf emoji me likho — koi lafz nahi",
  "Kisi mashhoor dialogue ki acting karke voice note bhejo",
  "Agla message ultay harfon me likho (aakhri harf sab se pehle)",
  "Apne baare me 3 baatein likho — 2 sach, 1 jhoot; dost guess karenge",
  "Ek paheli poochho — jo jawab na de paya, agli baari dare usi ka",
  "Apni gallery ki aakhri share karne layak photo group me bhejo",
  "10 push-ups karke batao — jhoot mat bolna!",
  "Kisi dost ki awaaz ki naqal karke voice note bhejo (naam mat batana, dost guess karenge)",
  "Urdu me khud bana kar sher ki do lines likho",
  "Apne pasandeeda khane ki tareef shayari ke andaz me likho",
  "Aankhein band karke apna poora naam type karke bhejo",
  "Group ke kisi ek dost ki dil se tareef me 3 lines likho",
  "Agli subah Fajr ke baad group me sab se pehle 'Assalam-o-Alaikum' tum ne bhejna hai",
];

export function pickTruthDare(mode: "truth" | "dare"): string {
  const bank = mode === "truth" ? TRUTH_BANK : DARE_BANK;
  return bank[Math.floor(Math.random() * bank.length)];
}

/* ───────── Chat Effects: text se auto full-screen effect ───────── */
export function detectTextFx(text: string): { kind: FxKind; emoji: string } | null {
  if (!text) return null;
  const low = text.toLowerCase();
  if (text.includes("🎉") || low.includes("mubarak")) return { kind: "confetti", emoji: "🎉" };
  if (low.includes("mashallah") || low.includes("masha allah")) return { kind: "hearts", emoji: "❤️" };
  if (low.includes("subhanallah")) return { kind: "stars", emoji: "✨" };
  return null;
}
