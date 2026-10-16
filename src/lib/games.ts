"use client";
// ─────────────────────────────────────────────────────────────
// Phase 7 — Games & Fun: data layer
// Quiz sawal + paheliyan — sab mashhoor, pakki deeni maloomat.
// Koi doubtful sawal nahi rakha.
// ─────────────────────────────────────────────────────────────

export interface QuizQ { q: string; opts: string[]; correct: number }

/* 12 verified Deen quiz questions (Hinglish). Quiz me se 5 random aate hain. */
export const QUIZ_BANK: QuizQ[] = [
  { q: "Quran-e-Pak ki pehli surah kaunsi hai?", opts: ["Al-Baqarah", "Al-Fatiha", "Al-Ikhlas", "An-Naas"], correct: 1 },
  { q: "Quran me kul kitni suratein hain?", opts: ["110", "114", "116", "120"], correct: 1 },
  { q: "Din me kitni namazein farz hain?", opts: ["3", "4", "5", "6"], correct: 2 },
  { q: "Roza kis mahine me farz hai?", opts: ["Shawwal", "Zilhajj", "Shaban", "Ramzan"], correct: 3 },
  { q: "Pehli wahi kahan nazil hui?", opts: ["Ghar-e-Hira", "Masjid-e-Nabvi", "Ghar-e-Saur", "Badr"], correct: 0 },
  { q: "Quran kis Nabi par nazil hua?", opts: ["Hazrat Isa (A.S)", "Hazrat Musa (A.S)", "Hazrat Muhammad ﷺ", "Hazrat Ibrahim (A.S)"], correct: 2 },
  { q: "Baitullah (Khana Kaaba) kis shahar me hai?", opts: ["Madina", "Makkah", "Jerusalem", "Taif"], correct: 1 },
  { q: "Laylat-ul-Qadr kis mahine me aati hai?", opts: ["Ramzan", "Shawwal", "Rajab", "Zilhajj"], correct: 0 },
  { q: "Quran ki sab se lambi surah kaunsi hai?", opts: ["Aal-e-Imran", "An-Nisa", "Al-Baqarah", "Al-Maidah"], correct: 2 },
  { q: "Zakat ki sharah kitni hai?", opts: ["2.5%", "5%", "7.5%", "10%"], correct: 0 },
  { q: "Azaan dene wale ko kya kehte hain?", opts: ["Imam", "Khatib", "Moazzin", "Qari"], correct: 2 },
  { q: "Eid-ul-Fitr kis ke foran baad aati hai?", opts: ["Hajj ke", "Ramzan ke", "Shaban ke", "Moharram ke"], correct: 1 },
];

export interface QuizState {
  questions: QuizQ[];
  current: number;      // 0..4 — kaunsa sawal chal raha hai
  qEndsAt: number;      // is sawal ka timer khatam hone ka time (ms)
  done: boolean;
}
export function parseQuiz(caption?: string): QuizState | null {
  try {
    const d = JSON.parse(caption || "");
    if (d && Array.isArray(d.questions) && d.questions.length > 0 && typeof d.current === "number") return d as QuizState;
  } catch { /* ignore */ }
  return null;
}
export function pickQuizQuestions(): QuizQ[] {
  const pool = [...QUIZ_BANK];
  const out: QuizQ[] = [];
  while (out.length < 5 && pool.length > 0) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}
/** reactions se score: __quiz_<qidx>_<optidx> -> userIds[] */
export function quizScores(reactions: Record<string, string[]>, qs: QuizQ[]): { id: string; pts: number }[] {
  const pts: Record<string, number> = {};
  qs.forEach((q, qi) => {
    const key = `__quiz_${qi}_${q.correct}`;
    const winners = reactions[key] || [];
    winners.forEach((u) => { pts[u] = (pts[u] || 0) + 1; });
  });
  return Object.entries(pts).map(([id, p]) => ({ id, pts: p })).sort((a, b) => b.pts - a.pts);
}
export function quizAnswered(reactions: Record<string, string[]>, qidx: number, me: string): number {
  for (let o = 0; o < 4; o++) {
    const users = reactions[`__quiz_${qidx}_${o}`] || [];
    if (users.includes(me)) return o;
  }
  return -1;
}

/* ───────── Tic-Tac-Toe ───────── */
export interface TTTState {
  challenger: string;
  opponent: string;
  accepted: boolean;
  board: string[]; // 9 cells: "" | "X" | "O"
  turn: string;    // userId jiski baari hai
  winner: string | null; // userId | "draw" | null
}
export function parseTTT(caption?: string): TTTState | null {
  try {
    const d = JSON.parse(caption || "");
    if (d && typeof d.challenger === "string" && Array.isArray(d.board)) return d as TTTState;
  } catch { /* ignore */ }
  return null;
}
const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export function tttWinner(board: string[]): string | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every((x) => x) ? "draw" : null;
}

/* ───────── Daily Paheli ───────── */
export interface Riddle { q: string; a: string; alt: string[] }
export const RIDDLE_BANK: Riddle[] = [
  { q: "Wo kya hai jo din me 5 baar bulata hai lekin khud bolta nahi?", a: "azaan", alt: ["azan", "aazaan"] },
  { q: "Wo kaunsi raat hai jo hazaar mahino se behtar hai?", a: "laylat-ul-qadr", alt: ["shab-e-qadr", "qadr", "laylatul qadr", "shab e qadr"] },
  { q: "Wo kaunsi jagah hai jahan duniya bhar ke Musalman ek hi taraf muh karke khare hote hain?", a: "kaaba", alt: ["khana kaaba", "baitullah", "kaba"] },
  { q: "Wo kya hai jo paani se hota hai lekin paani nahi hai?", a: "wuzu", alt: ["wudu", "wazu"] },
  { q: "Wo kaunsa mahina hai jiske aate hi shaitan qaid kar diye jate hain?", a: "ramzan", alt: ["ramadan", "ramzaan"] },
  { q: "Wo kaunsi kitab hai jisme 114 suratein hain?", a: "quran", alt: ["quran-e-pak", "quran pak", "qur'an"] },
  { q: "Wo kaunsa safar hai jo ek raat me Masjid-e-Haram se Masjid-e-Aqsa tak hua?", a: "mairaj", alt: ["meraj", "miraj", "shab-e-mairaj"] },
  { q: "Kis Nabi ne kashti (ark) banai thi?", a: "hazrat nooh", alt: ["nooh", "noah", "hazrat noah"] },
  { q: "Wo kaunsa pathar hai jo Jannat se aya aur Kaabe me laga hai?", a: "hajr-e-aswad", alt: ["sang-e-aswad", "black stone", "hajre aswad"] },
  { q: "Quran ki kaunsi surah me Bismillah nahi parhi jati?", a: "surah tauba", alt: ["tauba", "baraat", "surah baraat"] },
  { q: "Musalmanon ki do Eid kaunsi hain?", a: "eid-ul-fitr aur eid-ul-adha", alt: ["eid ul fitr eid ul adha", "do eid", "eidain"] },
  { q: "Roza kholne ko kya kehte hain?", a: "iftar", alt: ["iftari", "roza kholna"] },
  { q: "Sehri kis waqt ki jati hai?", a: "fajar se pehle", alt: ["subah se pehle", "fajr se pehle"] },
  { q: "Taraweeh ki namaz kis mahine me parhi jati hai?", a: "ramzan", alt: ["ramadan"] },
  { q: "Quran ka dil kis surah ko kaha gaya hai?", a: "surah yaseen", alt: ["yaseen", "yasin"] },
  { q: "Quran ki sab se chhoti surah kaunsi hai?", a: "surah kausar", alt: ["kausar", "al-kausar"] },
  { q: "Pehle kalme ko kya kehte hain?", a: "kalma tayyab", alt: ["kalima tayyab", "pehla kalma"] },
  { q: "Hajj ke mahine ko kya kehte hain?", a: "zilhajj", alt: ["dhul hijjah", "zil hajj"] },
  { q: "Wo kaunsi namaz hai jo safar me chhoti kar di jati hai?", a: "qasar", alt: ["qasr"] },
  { q: "Juma ke din ki khaas namaz kaunsi hai?", a: "namaz-e-juma", alt: ["juma", "jummah"] },
  { q: "Roze ki halat me subah khaye jane wale khane ko kya kehte hain?", a: "sehri", alt: ["sahri", "suhoor"] },
  { q: "Wo farishta jo wahi lata tha?", a: "hazrat jibrael", alt: ["jibrael", "jibreel", "gabriel"] },
];
export function dailyRiddle(): { riddle: Riddle; idx: number } {
  const now = new Date();
  const day = Math.floor(now.getTime() / 864e5);
  const idx = day % RIDDLE_BANK.length;
  return { riddle: RIDDLE_BANK[idx], idx };
}
export interface RiddleState {
  q: string; a: string; alt: string[];
  day: string; // YYYY-MM-DD
  solved: boolean; winner: string | null;
}
export function parseRiddle(caption?: string): RiddleState | null {
  try {
    const d = JSON.parse(caption || "");
    if (d && typeof d.q === "string" && typeof d.a === "string") return d as RiddleState;
  } catch { /* ignore */ }
  return null;
}
export function normAnswer(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z\u0600-\u06FF0-9\s-]/g, "").replace(/\s+/g, " ");
}
export function isRiddleAnswer(text: string, r: RiddleState): boolean {
  const t = normAnswer(text);
  if (!t) return false;
  if (t === normAnswer(r.a)) return true;
  return r.alt.some((x) => t === normAnswer(x));
}

/* ───────── Stickers (CSS-based, koi external image nahi) ───────── */
export interface Sticker { id: string; text: string; emoji: string; bg: string; fg: string }
export const STICKERS: Sticker[] = [
  { id: "salam", text: "Assalam-o-Alaikum!", emoji: "🤲", bg: "linear-gradient(135deg,#0e6b4a,#1a9e6b)", fg: "#fff" },
  { id: "mashallah", text: "MashaAllah! 🌟", emoji: "🌟", bg: "linear-gradient(135deg,#d4af37,#f5d76e)", fg: "#5c430a" },
  { id: "subhanallah", text: "SubhanAllah", emoji: "✨", bg: "linear-gradient(135deg,#5865f2,#8b9cf7)", fg: "#fff" },
  { id: "jazakallah", text: "JazakAllah Khair", emoji: "🤝", bg: "linear-gradient(135deg,#0e6b4a,#083a27)", fg: "#ffe9a8" },
  { id: "alhamdulillah", text: "Alhamdulillah", emoji: "🙏", bg: "linear-gradient(135deg,#7b2ff7,#b98cff)", fg: "#fff" },
  { id: "inshallah", text: "InshaAllah", emoji: "🤞", bg: "linear-gradient(135deg,#ff8c42,#ffb37e)", fg: "#fff" },
  { id: "ameen", text: "Ameen 🤲", emoji: "🤲", bg: "linear-gradient(135deg,#1a1a2e,#3a3a5e)", fg: "#ffe9a8" },
  { id: "lol", text: "Hahaha! 😂", emoji: "😂", bg: "linear-gradient(135deg,#ffd93d,#ffb800)", fg: "#5c3d00" },
  { id: "wah", text: "Wah wah! 👏", emoji: "👏", bg: "linear-gradient(135deg,#00b4d8,#90e0ef)", fg: "#083a5e" },
  { id: "shabash", text: "Shabash! 🎉", emoji: "🎉", bg: "linear-gradient(135deg,#e0245e,#ff7aa8)", fg: "#fff" },
  { id: "fikar", text: "Fikar not! 😎", emoji: "😎", bg: "linear-gradient(135deg,#2f3035,#5c5e66)", fg: "#fff" },
  { id: "deen", text: "Deen first! 🕌", emoji: "🕌", bg: "linear-gradient(135deg,#0e6b4a,#d4af37)", fg: "#fff" },
  { id: "dua", text: "Dua me yaad rakhna", emoji: "💚", bg: "linear-gradient(135deg,#ff6b9d,#ffa8c5)", fg: "#fff" },
  { id: "sabar", text: "Sabar karo! 🧘", emoji: "🧘", bg: "linear-gradient(135deg,#4a90d9,#a8d5ff)", fg: "#fff" },
  { id: "eid", text: "Eid Mubarak! 🌙", emoji: "🌙", bg: "linear-gradient(135deg,#1a1a40,#4a4a8a)", fg: "#ffe9a8" },
  { id: "goodnight", text: "Shab bakhair! 🌃", emoji: "🌃", bg: "linear-gradient(135deg,#0f2027,#2c5364)", fg: "#cfe8ff" },
];
export function getSticker(id: string): Sticker | null {
  return STICKERS.find((s) => s.id === id) || null;
}
