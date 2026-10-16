"use client";
// Chaand Page — live moon phase, Hijri mahina, chaand dekhne ki dua. WHITE theme.
import { ChevronLeft, Moon } from "lucide-react";
import { HIJRI_MONTHS, hijri, moonInfo } from "@/lib/deen";

export function MoonSvg({ phase, size = 56 }: { phase: number; size?: number }) {
  // phase 0..1 (0 new, .5 full). Roshni wala hissa do arcs se.
  const k = Math.cos(phase * 2 * Math.PI), waxing = phase < 0.5;
  const rx = Math.abs(k) * 40;
  const d = `M50 10 A40 40 0 0 ${waxing ? 1 : 0} 50 90 A${rx} 40 0 0 ${(waxing ? k > 0 : k < 0) ? 0 : 1} 50 10`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="40" fill="#e8ecf1" stroke="#00000014" />
      <path d={d} fill="#f2c94c" />
    </svg>
  );
}

const MOON_DUA_AR = "اللَّهُمَّ أَهِلَّهُ عَلَيْنَا بِالْأَمْنِ وَالْإِيمَانِ وَالسَّلَامَةِ وَالْإِسْلَامِ";
const MOON_DUA_ROM = "Allahumma ahillahu alayna bil amni wal imani was salamati wal islam";
const MOON_DUA_TR = "Aye Allah! Is chaand ko hum par aman, iman, salamti aur Islam ke saath tulu farma.";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white/70 p-4 soft-shadow">
      <h3 className="mb-3 text-[15px] font-extrabold tracking-tight text-[#2f3035]">{title}</h3>
      {children}
    </section>
  );
}

export default function MoonPage({ onClose }: { onClose: () => void }) {
  const m = moonInfo(), h = hijri();
  const daysLeft = Math.ceil(m.toNew);
  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#f4f5fa]">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-black/10 bg-white/80 px-4 backdrop-blur">
        <button onClick={onClose} className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5" aria-label="Wapas">
          <ChevronLeft size={20} />
        </button>
        <Moon size={18} className="text-[#5865f2]" />
        <h1 className="text-[16px] font-extrabold tracking-tight text-[#2f3035]">Chaand aur Islamic mahina</h1>
      </header>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="mx-auto max-w-2xl space-y-3">
          {/* hero */}
          <div className="flex flex-col items-center rounded-2xl bg-gradient-to-b from-[#eef1fb] to-white p-6 text-center soft-shadow">
            <div className="moon-float"><MoonSvg phase={m.phase} size={130} /></div>
            <p className="mt-3 text-xl font-extrabold tracking-tight text-[#2f3035]">{m.name}</p>
            <p className="text-sm text-[#5c5e66]">Roshni: {Math.round(m.illum * 100)}% · Umar: {m.age.toFixed(1)} din</p>
          </div>

          <Card title="Maujooda Islamic mahina">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-[#5865f2]/[0.07] px-3.5 py-3">
              <span className="text-[15px] font-bold text-[#2f3035]">{h.d} {HIJRI_MONTHS[h.m - 1]} {h.y} Hijri</span>
              <span className="text-xs text-[#80848e]">Naya chaand ~{daysLeft} din me</span>
            </div>
          </Card>

          <Card title="Hijri mahine">
            <div className="divide-y divide-black/5">
              {HIJRI_MONTHS.map((n, i) => (
                <div key={n} className="flex items-center justify-between px-2.5 py-2">
                  <span className={`text-[15px] ${i + 1 === h.m ? "font-extrabold text-[#5865f2]" : "font-medium text-[#2f3035]"}`}>
                    {i + 1}. {n}
                  </span>
                  {i + 1 === h.m && (
                    <span className="rounded-full bg-[#5865f2]/10 px-2.5 py-0.5 text-xs font-bold text-[#5865f2]">Abhi</span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Chaand dekhne ki dua">
            <p className="text-center font-quran text-[22px] leading-loose text-[#2f3035]" dir="rtl" lang="ar">{MOON_DUA_AR}</p>
            <p className="mt-2.5 text-center text-sm italic leading-relaxed text-[#5865f2]">{MOON_DUA_ROM}</p>
            <p className="mt-2 text-center text-sm leading-relaxed text-[#5c5e66]">{MOON_DUA_TR}</p>
          </Card>

          <p className="pb-2 text-center text-xs text-[#80848e]">
            Chaand ki halat hisabi andaza hai; mahine ka aagaz shari rooyat par hota hai. 🌙
          </p>
        </div>
      </div>
    </div>
  );
}
