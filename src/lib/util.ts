export const cn = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");
export const uid = (p = "x") => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtTime = (t: number) => { const d = new Date(t); let h = d.getHours(); const m = d.getMinutes(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return `${h}:${String(m).padStart(2, "0")} ${ap}`; };
export const dayKey = (t: number) => new Date(t).toDateString();
export function fmtDay(t: number) {
  const d = new Date(t), n = new Date();
  if (d.toDateString() === n.toDateString()) return "Aaj";
  const y = new Date(n.getTime() - 864e5);
  if (d.toDateString() === y.toDateString()) return "Kal";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== n.getFullYear() ? " " + d.getFullYear() : ""}`;
}
export const fmtDateTime = (t: number) => `${fmtDay(t)}, ${fmtTime(t)}`;
export const fmtSize = (b: number) => (b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : b >= 1e6 ? (b / 1e6).toFixed(1) + " MB" : b >= 1e3 ? Math.round(b / 1e3) + " KB" : b + " B");
export const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export function ago(t: number) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "abhi abhi";
  if (s < 3600) return `${Math.floor(s / 60)} min pehle`;
  if (s < 86400) return `${Math.floor(s / 3600)} ghante pehle`;
  return `${Math.floor(s / 86400)} din pehle`;
}
export const hmToMin = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };
export function inWindow(from: string, to: string, d = new Date()) {
  const n = d.getHours() * 60 + d.getMinutes(), a = hmToMin(from), b = hmToMin(to);
  return a <= b ? n >= a && n < b : n >= a || n < b;
}
export function haptic(ms: number | number[] = 12) { try { navigator.vibrate?.(ms); } catch { /* noop */ } }
export const fileToDataUrl = (f: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f); });
export async function resizeImage(file: File | Blob, max = 1280, q = 0.82): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", q);
  } finally { URL.revokeObjectURL(url); }
}
export function highlight(text: string, q: string) {
  if (!q) return [{ t: text, h: false }];
  const out: { t: string; h: boolean }[] = [];
  const low = text.toLowerCase(), ql = q.toLowerCase();
  let i = 0;
  while (i < text.length) {
    const j = low.indexOf(ql, i);
    if (j < 0) { out.push({ t: text.slice(i), h: false }); break; }
    if (j > i) out.push({ t: text.slice(i, j), h: false });
    out.push({ t: text.slice(j, j + q.length), h: true });
    i = j + q.length;
  }
  return out;
}
export const URL_RE = /(https?:\/\/[^\s]+)/g;
