"use client";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ArrowLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/util";
import { useStore } from "@/data/store";
import { avatarUri, FRAMES } from "@/data/assets";
import { back, seeHint } from "@/data/api";
import type { Member } from "@/data/types";

export function useIsDesktop() {
  const [d, setD] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 768px)");
    const f = () => setD(q.matches);
    f(); q.addEventListener("change", f);
    return () => q.removeEventListener("change", f);
  }, []);
  return d;
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <path d="M32 6C17 6 6 16 6 29c0 7 3.5 13 9 17l-2 11 11-5c3 .8 5.5 1 8 1 15 0 26-10 26-24S47 6 32 6z" fill="#2ccf8a" />
      <path d="M21 30l8 8 15-16" fill="none" stroke="#04140d" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Avatar({ m, id, size = 40, dot = true, onClick, className }: { m?: Member; id?: string; size?: number; dot?: boolean; onClick?: () => void; className?: string }) {
  const mem = useStore((s) => m ?? s.members.find((x) => x.id === id));
  if (!mem) return <div style={{ width: size, height: size }} className="rounded-full bg-surface2" />;
  const frame = FRAMES.find((f) => f.id === mem.style?.frame)?.css;
  return (
    <div className={cn("relative shrink-0", onClick && "cursor-pointer", className)} style={{ width: size, height: size }} onClick={onClick}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mem.avatar || avatarUri(mem.name, mem.color)} alt={mem.name} draggable={false} className="h-full w-full rounded-full object-cover" style={frame && size >= 36 ? { boxShadow: frame } : undefined} />
      {dot && mem.online && !mem.banned && (
        <span className="absolute bottom-0 right-0 rounded-full border-2 border-bg bg-accent" style={{ width: Math.max(9, size * 0.26), height: Math.max(9, size * 0.26) }} />
      )}
    </div>
  );
}

export function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={on} disabled={disabled} onClick={(e) => { e.stopPropagation(); onChange(!on); }}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300", on ? "bg-accent" : "bg-surface2 ring-1 ring-inset ring-line", disabled && "opacity-40")}>
      <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 32 }} className={cn("absolute top-1 h-5 w-5 rounded-full shadow", on ? "right-1 bg-accent-fg" : "left-1 bg-mute")} />
    </button>
  );
}

export function Btn({ children, onClick, variant = "primary", className, disabled, type = "button", small }: { children: ReactNode; onClick?: (e: any) => void; variant?: "primary" | "ghost" | "danger" | "gold" | "soft"; className?: string; disabled?: boolean; type?: "button" | "submit"; small?: boolean }) {
  const v = {
    primary: "bg-accent text-accent-fg hover:brightness-110",
    ghost: "bg-transparent text-fg ring-1 ring-inset ring-line hover:bg-surface2",
    soft: "bg-surface2 text-fg hover:brightness-110",
    danger: "bg-danger text-white hover:brightness-110",
    gold: "bg-gradient-to-r from-[#f6dd8d] to-[#e8bd57] text-[#3a2a05] hover:brightness-105",
  }[variant];
  return (
    <motion.button whileTap={{ scale: 0.96 }} type={type} onClick={onClick} disabled={disabled}
      className={cn("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-40", small ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-[15px]", v, className)}>
      {children}
    </motion.button>
  );
}

export function Sheet({ open, onClose, title, children, wide, full, noPad }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean; full?: boolean; noPad?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  const onDragEnd = (_: unknown, i: PanInfo) => { if (i.offset.y > 110 || i.velocity.y > 600) onClose(); };
  return (
    <AnimatePresence>
      {open && (
        <div data-sheet className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto md:items-center md:p-6">
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className={cn("relative flex w-full flex-col overflow-hidden rounded-t-[28px] border border-line bg-surface shadow-2xl md:rounded-3xl", wide ? "md:max-w-2xl" : "md:max-w-md", full ? "h-[92dvh] md:h-[86dvh]" : "max-h-[88dvh]")}
            initial={{ y: "100%", opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.5 }} dragListener={false}
            onDragEnd={onDragEnd}>
          <SheetHandle onClose={onClose} />
            {title && (
              <div className="flex items-center justify-between px-5 pb-2 pt-1">
                <h3 className="text-lg font-bold">{title}</h3>
                <button onClick={onClose} className="rounded-full p-1.5 text-mute hover:bg-surface2"><X size={20} /></button>
              </div>
            )}
            <div className={cn("thin min-h-0 flex-1 overflow-y-auto", !noPad && "px-5 pb-6 pt-1")}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
function SheetHandle({ onClose }: { onClose: () => void }) {
  const ref = useRef<number | null>(null);
  return (
    <div className="flex shrink-0 cursor-grab touch-none justify-center py-2.5 md:hidden"
      onPointerDown={(e) => { ref.current = e.clientY; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerUp={(e) => { if (ref.current !== null && e.clientY - ref.current > 60) onClose(); ref.current = null; }}>
      <span className="h-1.5 w-10 rounded-full bg-line" style={{ background: "var(--mute)", opacity: 0.4 }} />
    </div>
  );
}

export function Confirm({ open, onClose, onYes, title, body, yes = "Haan", danger }: { open: boolean; onClose: () => void; onYes: () => void; title: string; body?: string; yes?: string; danger?: boolean }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {body && <p className="mb-5 text-sm leading-relaxed text-mute">{body}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onClose}>Nahi</Btn>
        <Btn variant={danger ? "danger" : "primary"} className="flex-1" onClick={() => { onYes(); onClose(); }}>{yes}</Btn>
      </div>
    </Sheet>
  );
}

export function Page({ title, children, right, onBack, sub, flush }: { title: string; children: ReactNode; right?: ReactNode; onBack?: () => void; sub?: string; flush?: boolean }) {
  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="safe-t flex shrink-0 items-center gap-2 border-b border-line bg-surface/80 px-2 py-2.5 backdrop-blur">
        <button onClick={onBack ?? back} className="rounded-full p-2 text-fg hover:bg-surface2" aria-label="Wapas"><ArrowLeft size={22} /></button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-bold leading-tight">{title}</h2>
          {sub && <p className="truncate text-xs text-mute">{sub}</p>}
        </div>
        {right}
      </header>
      <div className={cn("thin min-h-0 flex-1 overflow-y-auto", !flush && "px-4 py-4 md:px-6")}>
        <div className={cn(!flush && "mx-auto w-full max-w-2xl")}>{children}</div>
      </div>
    </div>
  );
}

export function Row({ icon, title, sub, right, onClick, danger, chevron }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void; danger?: boolean; chevron?: boolean }) {
  const C = onClick ? "button" : "div";
  return (
    <C onClick={onClick} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition", onClick && "hover:bg-surface2 active:bg-surface2")}>
      {icon && <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface2", danger ? "text-danger" : "text-accent")}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[15px] font-medium", danger && "text-danger")}>{title}</span>
        {sub && <span className="mt-0.5 block text-xs leading-snug text-mute">{sub}</span>}
      </span>
      {right}
      {(chevron ?? !!onClick) && !right && <ChevronRight size={18} className="text-mute" />}
    </C>
  );
}

export function Card({ children, className, title, right }: { children: ReactNode; className?: string; title?: string; right?: ReactNode }) {
  return (
    <section className={cn("mb-4 overflow-hidden rounded-2xl border border-line bg-surface", className)}>
      {title && <div className="flex items-center justify-between px-4 pb-1 pt-3"><h3 className="text-xs font-bold uppercase tracking-wider text-mute">{title}</h3>{right}</div>}
      <div className={cn(title && "divide-y divide-line")}>{children}</div>
    </section>
  );
}

export function Seg<T extends string | number>({ options, value, onChange, className }: { options: { v: T; l: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn("flex rounded-xl bg-surface2 p-1", className)}>
      {options.map((o) => (
        <button key={String(o.v)} onClick={() => onChange(o.v)} className={cn("relative flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition", value === o.v ? "text-accent-fg" : "text-mute hover:text-fg")}>
          {value === o.v && <motion.span layoutId={"seg" + options.map((x) => x.v).join("")} className="absolute inset-0 rounded-lg bg-accent" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
          <span className="relative">{o.l}</span>
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { v: T; l: string; badge?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="noscroll -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
      {tabs.map((t) => (
        <button key={t.v} onClick={() => onChange(t.v)} className={cn("relative shrink-0 px-3.5 py-3 text-sm font-semibold transition", value === t.v ? "text-accent" : "text-mute hover:text-fg")}>
          {t.l}
          {!!t.badge && <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 text-[10px] text-white">{t.badge}</span>}
          {value === t.v && <motion.span layoutId="tabline" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label?: string; children: ReactNode; hint?: string }) {
  return (
    <label className="mb-3 block">
      {label && <span className="mb-1.5 block text-xs font-semibold text-mute">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-mute">{hint}</span>}
    </label>
  );
}
export const inputCls = "w-full rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-mute/70 focus:border-accent";

export function Empty({ icon, text }: { icon?: ReactNode; text: string }) {
  return <div className="flex flex-col items-center gap-3 px-6 py-14 text-center text-mute">{icon && <div className="opacity-60">{icon}</div>}<p className="text-sm">{text}</p></div>;
}

export function Ring({ value, size = 64, stroke = 6, color = "var(--accent)", children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: "stroke-dashoffset .35s ease" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Bars({ data, labels, height = 120, color = "var(--accent)", highlight }: { data: number[]; labels?: string[]; height?: number; color?: string; highlight?: number }) {
  const mx = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((v, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <motion.div initial={{ height: 0 }} animate={{ height: `${(v / mx) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 18, delay: i * 0.03 }} className="w-full min-w-[4px] rounded-t-md" style={{ background: i === highlight ? "var(--gold)" : color, opacity: i === highlight ? 1 : 0.8 }} title={String(v)} />
          {labels && <span className="text-[10px] text-mute">{labels[i]}</span>}
        </div>
      ))}
    </div>
  );
}

/** F3 + F4: spotlight hint with pulsing ring */
export function Hint({ id, text, children, side = "top", className }: { id: string; text: string; children: ReactNode; side?: "top" | "bottom" | "left"; className?: string }) {
  const seen = useStore((s) => s.onboarding.hints[id]);
  const ready = useStore((s) => s.onboarding.done);
  const show = ready && !seen;
  return (
    <div className={cn("relative inline-flex", className)} onClickCapture={() => show && seeHint(id)}>
      {children}
      {show && (
        <>
          <span className="pointer-events-none absolute -inset-1.5 z-30 rounded-full border-2 border-gold hint-ping" />
          <span className="pointer-events-none absolute -inset-1.5 z-30 rounded-full border-2 border-gold" />
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            className={cn("absolute z-40 w-max max-w-[210px] rounded-xl bg-gold px-3 py-2 text-xs font-bold text-[#2a1d02] shadow-xl", side === "top" ? "bottom-full right-0 mb-3" : side === "bottom" ? "right-0 top-full mt-3" : "right-full top-1/2 mr-3 -translate-y-1/2")}
            onClick={(e) => { e.stopPropagation(); seeHint(id); }}>
            {text} <span className="opacity-60">✕</span>
          </motion.div>
        </>
      )}
    </div>
  );
}

/** F4: pulsing dot on new features, tap → tooltip */
export function Marker({ id, text }: { id: string; text: string }) {
  const seen = useStore((s) => s.onboarding.markers[id]);
  const done = useStore((s) => s.onboarding.done);
  const [open, setOpen] = useState(false);
  if (seen || !done) return null;
  return (
    <span className="relative inline-block">
      <button onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); if (open) import("@/data/api").then((a) => a.seeMarker(id)); }} className="relative ml-1.5 grid h-3.5 w-3.5 place-items-center" aria-label="Naya">
        <span className="absolute h-3.5 w-3.5 rounded-full bg-gold/60 hint-ping" /><span className="h-2 w-2 rounded-full bg-gold" />
      </button>
      {open && <span className="absolute left-0 top-5 z-30 w-48 rounded-xl bg-gold p-2.5 text-xs font-semibold text-[#2a1d02] shadow-xl">{text}</span>}
    </span>
  );
}

export function Chip({ children, active, onClick, className }: { children: ReactNode; active?: boolean; onClick?: () => void; className?: string }) {
  return <button onClick={onClick} className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition", active ? "bg-accent text-accent-fg" : "bg-surface2 text-mute hover:text-fg", className)}>{children}</button>;
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = { owner: "bg-gold/20 text-gold", admin: "bg-accent/20 text-accent", mod: "bg-sky-400/20 text-sky-400", member: "bg-surface2 text-mute" };
  const name: Record<string, string> = { owner: "Owner", admin: "Admin", mod: "Mod", member: "Member" };
  return <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", map[role])}>{name[role]}</span>;
}

export function Confetti({ trigger }: { trigger: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!trigger) return;
    const c = ref.current!, ctx = c.getContext("2d")!;
    c.width = window.innerWidth; c.height = window.innerHeight;
    const cols = ["#2ccf8a", "#e8bd57", "#ff6f91", "#4cc3ff", "#fff3cf", "#9bdc5a"];
    const ps = Array.from({ length: 150 }, () => ({ x: c.width / 2 + (Math.random() - 0.5) * 120, y: c.height * 0.55, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 18 - 6, r: Math.random() * 6 + 3, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, c: cols[Math.floor(Math.random() * cols.length)], moon: Math.random() < 0.08 }));
    let raf = 0, t = 0;
    const tick = () => {
      t++; ctx.clearRect(0, 0, c.width, c.height);
      ps.forEach((p) => { p.vy += 0.42; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - t / 170); if (p.moon) { ctx.font = "20px serif"; ctx.fillText("🌙", 0, 0); } else ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); });
      if (t < 170) raf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, c.width, c.height);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [trigger]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[120]" />;
}

export function MoonDot() { return <span className="inline-block h-2 w-2 rounded-full bg-gold" />; }
