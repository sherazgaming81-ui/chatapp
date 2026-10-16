"use client";
// Phase 6 — F1 Welcome Splash. Pehli dafa app khulne par 3 slides.
import { useState } from "react";
import { ChevronLeft, ChevronRight, MessagesSquare, MoonStar, Zap } from "lucide-react";

const SLIDES = [
  {
    icon: MessagesSquare,
    color: "from-[#5865f2] to-[#9b7bff]",
    title: "Madrasa Group",
    body: "Apne madrasa doston se juro — elaan, baatein aur yaadein, sab ek jagah. Bina WhatsApp ke!",
  },
  {
    icon: MoonStar,
    color: "from-[#0e6b4a] to-[#23a55a]",
    title: "Deen, har din",
    body: "Quran-e-Pak, Allah ke 99 Naam, namaz timings, tasbeeh aur qibla — sab kuch isi app me. 🕌",
  },
  {
    icon: Zap,
    color: "from-[#f5a623] to-[#ed4245]",
    title: "Tez aur mehfooz",
    body: "Bijli jaisi speed, koi reload nahi. Aapki privacy aapke haath me — app lock aur controls ke sath. ⚡",
  },
];

export default function WelcomeSplash({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const S = SLIDES[idx];
  const Icon = S.icon;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#f4f5fa]">
      {/* top bar */}
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#5865f2] to-[#9b7bff] text-xl font-bold text-white soft-shadow">م</span>
          <span className="text-lg font-extrabold tracking-tight text-[#2f3035]">ChatsApp</span>
        </div>
        <button onClick={onDone} className="rounded-lg px-3 py-1.5 text-sm font-bold text-[#80848e] hover:bg-black/5">
          Skip
        </button>
      </div>

      {/* slides */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-[#2f3035] sm:text-4xl">
          Assalam-o-Alaikum! 🌙
        </h1>
        <div key={idx} className="pop-in">
          <div className={`mx-auto mb-6 grid h-24 w-24 place-items-center rounded-[28px] bg-gradient-to-br ${S.color} text-white soft-shadow`}>
            <Icon size={44} />
          </div>
          <h2 className="mb-3 text-2xl font-extrabold text-[#2f3035]">{S.title}</h2>
          <p className="mx-auto max-w-sm text-[15px] leading-relaxed text-[#5c5e66]">{S.body}</p>
        </div>

        {/* dots */}
        <div className="mt-8 flex gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === idx ? "w-7 bg-[#5865f2]" : "w-2 bg-black/15 hover:bg-black/25"}`}
            />
          ))}
        </div>
      </div>

      {/* bottom nav */}
      <div className="flex items-center justify-between gap-3 px-6 pb-10">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="grid h-12 w-12 place-items-center rounded-full border border-black/10 bg-white text-[#5c5e66] disabled:opacity-30"
          aria-label="Pichla"
        >
          <ChevronLeft size={22} />
        </button>
        {idx < SLIDES.length - 1 ? (
          <button
            onClick={() => setIdx((i) => i + 1)}
            className="btn btn-blurple flex flex-1 items-center justify-center gap-2 px-6 py-3.5 text-base"
          >
            Aage <ChevronRight size={18} />
          </button>
        ) : (
          <button onClick={onDone} className="btn btn-blurple flex flex-1 items-center justify-center gap-2 px-6 py-3.5 text-base">
            Shuru karo 🚀
          </button>
        )}
        <span className="w-12" />
      </div>
    </div>
  );
}
