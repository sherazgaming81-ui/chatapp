"use client";
import { useStore } from "@/lib/store";

export default function Toasts() {
  const toasts = useStore((s) => s.ui.toasts);
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[90] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div key={t.id} className="toast-in card pointer-events-auto w-full bg-[#111114]/95 p-4 backdrop-blur">
          <p className="text-sm font-bold text-[#f4f6f8]">{t.title}</p>
          {t.body && <p className="mt-0.5 text-[13px] text-[#b6bcc7]">{t.body}</p>}
        </div>
      ))}
    </div>
  );
}
