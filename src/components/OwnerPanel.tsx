"use client";
import { useState } from "react";
import { ArrowLeft, Megaphone, Send, Users, MessageSquare, Wifi, AlertTriangle } from "lucide-react";
import { useStore, patchUI, toast } from "@/lib/store";
import { postAnnouncement } from "@/lib/db";
import { Avatar, Badge } from "@/components/ui";

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="card relative overflow-hidden bg-white/80 p-4 backdrop-blur">
      <span className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-15" style={{ background: color }} />
      <span className="mb-2 grid h-10 w-10 place-items-center rounded-lg" style={{ background: color + "1f", color }}>{icon}</span>
      <p className="text-3xl font-extrabold tabular-nums text-[#2f3035]">{value}</p>
      <p className="text-xs font-semibold text-[#80848e]">{label}</p>
    </div>
  );
}

export default function OwnerPanel() {
  const members = useStore((s) => s.members);
  const messages = useStore((s) => s.messages);
  const [elaan, setElaan] = useState("");
  const [q, setQ] = useState("");

  const visible = members.filter((m) => !m.banned);
  const banned = members.filter((m) => m.banned);
  const online = visible.filter((m) => m.online).length;
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayMsgs = messages.filter((m) => m.at >= todayStart && !m.deleted && m.type === "text").length;
  const weekMsgs = messages.filter((m) => m.at >= Date.now() - 7 * 864e5 && !m.deleted).length;

  const list = visible.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));

  const send = () => {
    if (!elaan.trim()) return;
    postAnnouncement(elaan.trim());
    setElaan("");
    toast("Elaan bhej diya", "Sab ko dikhega");
  };

  return (
    <div className="glass thin-scroll min-w-0 flex-1 overflow-y-auto rounded-2xl">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-black/10 bg-white/70 px-4 backdrop-blur">
        <button onClick={() => patchUI({ tab: "chat" })} className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5"><ArrowLeft size={20} /></button>
        <h1 className="text-[16px] font-extrabold tracking-tight text-[#2f3035]">Owner dashboard</h1>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<Users size={18} />} label="Kul members" value={visible.length} color="#23a55a" />
          <Stat icon={<Wifi size={18} />} label="Abhi online" value={online} color="#00b0f4" />
          <Stat icon={<MessageSquare size={18} />} label="Aaj ke messages" value={todayMsgs} color="#5865f2" />
          <Stat icon={<AlertTriangle size={18} />} label="Banned" value={banned.length} color="#ed4245" />
        </div>

        <div className="card bg-gradient-to-r from-[#5865f2]/[0.06] to-[#9b7bff]/[0.06] p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-[#5865f2]"><Megaphone size={16} /> Elaan bhejo</p>
          <textarea rows={3} value={elaan} onChange={(e) => setElaan(e.target.value)} placeholder="Sab ko kya batana hai…" className="field w-full resize-none px-3.5 py-3 text-[15px]" />
          <button onClick={send} disabled={!elaan.trim()} className="btn btn-blurple mt-2.5 flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-40">
            <Send size={15} /> Bhejo
          </button>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-[0.08em] text-[#2f3035]">Members · {visible.length}</h2>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dhoondo…" className="field w-40 px-3 py-1.5 text-sm" />
          </div>
          <div className="space-y-1.5">
            {list.map((m) => (
              <button key={m.id} onClick={() => patchUI({ profileId: m.id })} className="card flex w-full items-center gap-3 bg-white/70 px-3 py-2.5 text-left hover:border-[#5865f2]/40">
                <Avatar m={m} size={38} showDot />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[#2f3035]">{m.name}<Badge role={m.role} /></span>
                  <span className="block text-xs text-[#80848e]">
                    {m.mutedUntil !== undefined ? "🔇 muted" : m.online ? "Online" : "Offline"}
                    {m.warns.length > 0 && ` · ⚠️ ${m.warns.length}`}
                  </span>
                </span>
                <span className="text-xs font-semibold text-[#5865f2]">Manage →</span>
              </button>
            ))}
          </div>
          {banned.length > 0 && (
            <>
              <h2 className="mb-2 mt-5 text-sm font-extrabold uppercase tracking-[0.08em] text-[#ed4245]">Banned · {banned.length}</h2>
              <div className="space-y-1.5">
                {banned.map((m) => (
                  <button key={m.id} onClick={() => patchUI({ profileId: m.id })} className="card flex w-full items-center gap-3 border-[#ed4245]/25 bg-[#ed4245]/[0.04] px-3 py-2.5 text-left">
                    <Avatar m={m} size={38} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#2f3035]">{m.name}</span></span>
                    <span className="text-xs font-semibold text-[#23a55a]">Unban →</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <p className="pb-4 text-center text-xs text-[#80848e]">Pichle 7 din me {weekMsgs} messages · sab numbers real hain</p>
      </div>
    </div>
  );
}
