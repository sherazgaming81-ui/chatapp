"use client";
import type { Member } from "@/lib/types";

const HUES = [235, 320, 160, 200, 25, 275, 0, 190];
export function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return HUES[Math.abs(h) % HUES.length];
}
// darker variants for light backgrounds
export function nameColor(m: Member): string {
  if (m.role === "owner") return "#b4238f";
  if (m.role === "admin") return "#4752c4";
  if (m.role === "mod") return "#0078a8";
  return `hsl(${hueFor(m.id)} 60% 38%)`;
}

export function Avatar({ m, size = 40, showDot = false }: { m: Pick<Member, "id" | "name" | "avatar" | "online">; size?: number; showDot?: boolean }) {
  const initial = (m.name || "?").trim()[0]?.toUpperCase() || "?";
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span
        className="grid h-full w-full place-items-center overflow-hidden rounded-full font-bold text-white soft-shadow"
        style={{
          fontSize: size * 0.42,
          background: m.avatar ? undefined : `linear-gradient(135deg, hsl(${hueFor(m.id)} 65% 55%), hsl(${(hueFor(m.id) + 40) % 360} 65% 45%))`,
        }}
      >
        {m.avatar ? <img src={m.avatar} alt="" className="h-full w-full object-cover" draggable={false} /> : initial}
      </span>
      {showDot && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full border-[3px] border-white"
          style={{ width: size * 0.34, height: size * 0.34, background: m.online ? "#23a55a" : "#80848e" }}
        />
      )}
    </span>
  );
}

export function fmtTime(at: number): string {
  const d = new Date(at);
  let h = d.getHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${ap}`;
}
export function fmtDayLabel(at: number): string {
  const d = new Date(at);
  const now = new Date();
  const day = (x: Date) => x.getFullYear() * 1000 + Math.floor(x.getMonth() * 30 + x.getDate());
  const diff = day(now) - day(d);
  if (diff <= 0) return "aaj";
  if (diff === 1) return "kal";
  return d.toLocaleDateString("ur-Latn", { day: "numeric", month: "short" });
}
export function fmtDayHeader(at: number): string {
  const d = new Date(at);
  const now = new Date();
  const day = (x: Date) => x.getFullYear() * 1000 + Math.floor(x.getMonth() * 30 + x.getDate());
  const diff = day(now) - day(d);
  if (diff <= 0) return "Aaj";
  if (diff === 1) return "Kal";
  return d.toLocaleDateString("ur-Latn", { day: "numeric", month: "short" });
}
export function fmtFull(at: number): string {
  return `${fmtDayLabel(at)} ${fmtTime(at)}`;
}
export function fmtLastSeen(at: number): string {
  if (!at) return "kabhi nahi";
  const mins = Math.floor((Date.now() - at) / 60000);
  if (mins < 1) return "abhi";
  if (mins < 60) return `${mins} min pehle`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ghante pehle`;
  return fmtDayLabel(at);
}

// verbatim badge-pill from the brief
export function Badge({ role }: { role: Member["role"] }) {
  if (role === "member") return null;
  const label = role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Mod";
  const bg = role === "owner" ? "#ec48bd" : role === "admin" ? "#5865f2" : "#00b0f4";
  return (
    <span className="badge-pill ml-1.5 inline-block align-middle" style={{ background: bg, color: "#fff" }}>
      {label}
    </span>
  );
}
