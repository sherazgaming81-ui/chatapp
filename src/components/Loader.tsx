"use client";
// Simple professional loader — black screen, naam + spinner. Koi playful animation nahi.
export default function Loader() {
  return (
    <div className="fixed inset-0 z-[300] grid place-items-center bg-[#050505]">
      <div className="flex flex-col items-center gap-4">
        <div className="text-2xl font-extrabold tracking-tight text-[#f4f6f8]">
          Chats<span className="text-[#4f8cff]">App</span>
        </div>
        <div
          className="h-8 w-8 rounded-full border-[3px] border-white/15 border-t-[#4f8cff]"
          style={{ animation: "ringspin 0.8s linear infinite" }}
          aria-label="Loading"
        />
      </div>
    </div>
  );
}
