"use client";
// Phase 6 — F5 Setup Checklist. Welcome ke baad: naam → photo → notifications.
import { useEffect, useState } from "react";
import { Check, User, Camera, Bell, X } from "lucide-react";
import confetti from "canvas-confetti";
import { useStore, toast } from "@/lib/store";

const DONE_KEY = "chatsapp:checklist:done";
export const isChecklistDone = () => {
  try { return localStorage.getItem(DONE_KEY) === "1"; } catch { return true; }
};
export const markChecklistDone = () => {
  try { localStorage.setItem(DONE_KEY, "1"); } catch { /* ignore */ }
};

interface Step { id: string; icon: any; title: string; desc: string; done: boolean; action: string; }

export default function SetupChecklist({ onDone, onOpenProfile }: { onDone: () => void; onOpenProfile: () => void }) {
  const me = useStore((s) => s.members.find((m) => m.id === s.me));
  const [notif, setNotif] = useState(() => typeof Notification !== "undefined" ? Notification.permission : "denied");
  const [fired, setFired] = useState(false);

  // permission change detect (user bahar se allow kare to)
  useEffect(() => {
    const iv = setInterval(() => {
      if (typeof Notification !== "undefined" && Notification.permission !== notif) setNotif(Notification.permission);
    }, 1500);
    return () => clearInterval(iv);
  }, [notif]);

  const askNotif = async () => {
    try {
      const p = await Notification.requestPermission();
      setNotif(p);
      if (p === "granted") toast("Notifications on! 🔔", "Elaan sab se pehle milega");
      else toast("Notifications off hain", "Settings se on kar sakte ho");
    } catch { toast("Ijazat nahi mili", "Browser settings check karo"); }
  };

  const steps: Step[] = [
    { id: "naam", icon: User, title: "Apna naam set karo", desc: "Dost aapko pehchan sakein", done: !!(me?.name && me.name !== "Member"), action: "Naam set karo" },
    { id: "photo", icon: Camera, title: "Profile photo lagao", desc: "Apni pehchan dikhao", done: !!me?.avatar, action: "Photo lagao" },
    { id: "notif", icon: Bell, title: "Notifications on karo", desc: "Elaan foran milega", done: notif === "granted", action: "On karo" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  useEffect(() => {
    if (allDone && !fired) {
      setFired(true);
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 }, colors: ["#5865f2", "#23a55a", "#d4af37"] });
      setTimeout(() => { markChecklistDone(); onDone(); toast("MashaAllah! Setup mukammal 🎉", ""); }, 1400);
    }
  }, [allDone, fired, onDone]);

  if (allDone) {
    return (
      <div className="fixed inset-0 z-[95] grid place-items-center bg-black/30 px-5">
        <div className="pop-in rounded-3xl bg-white p-8 text-center soft-shadow">
          <p className="text-5xl">🎉</p>
          <h2 className="mt-3 text-xl font-extrabold text-[#2f3035]">MashaAllah! Setup mukammal!</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/30 px-5">
      <div className="pop-in w-full max-w-md rounded-3xl bg-white p-6 soft-shadow sm:p-7">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-[#2f3035]">Setup Checklist ✅</h2>
            <p className="mt-0.5 text-sm text-[#80848e]">{doneCount}/3 mukammal</p>
          </div>
          <button onClick={() => { markChecklistDone(); onDone(); }} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#80848e] hover:bg-black/5" aria-label="Skip">
            <X size={14} /> Skip
          </button>
        </div>
        {/* progress */}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full bg-gradient-to-r from-[#5865f2] to-[#23a55a] transition-all duration-500" style={{ width: `${(doneCount / 3) * 100}%` }} />
        </div>

        <div className="mt-4 space-y-2.5">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.id} className={`flex items-center gap-3 rounded-2xl border p-3.5 ${s.done ? "border-[#23a55a]/30 bg-[#23a55a]/[0.06]" : "border-black/10 bg-black/[0.02]"}`}>
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${s.done ? "bg-[#23a55a]/15 text-[#1a7a55]" : "bg-[#5865f2]/10 text-[#5865f2]"}`}>
                  {s.done ? <Check size={20} /> : <Icon size={20} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#2f3035]">{s.title}</p>
                  <p className="text-xs text-[#80848e]">{s.desc}</p>
                </div>
                {!s.done && (
                  <button
                    onClick={() => (s.id === "notif" ? askNotif() : onOpenProfile())}
                    className="shrink-0 rounded-xl bg-[#5865f2] px-3.5 py-2 text-xs font-bold text-white transition active:scale-95"
                  >
                    {s.action}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
