"use client";
// Naya group banao — naam + description + members select
import { useMemo, useState } from "react";
import { X, Users, Check } from "lucide-react";
import { useStore, patchUI } from "@/lib/store";
import { createGroup } from "@/lib/groups";
import { Avatar, nameColor } from "@/components/ui";

export default function CreateGroup() {
  const open = useStore((s) => s.ui.createGroupOpen);
  const members = useStore((s) => s.members);
  const meId = useStore((s) => s.me);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(
    () => members.filter((m) => m.id !== meId && !m.banned)
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name)),
    [members, meId]
  );

  if (!open) return null;
  const close = () => { patchUI({ createGroupOpen: false }); setName(""); setDesc(""); setSel([]); setBusy(false); };
  const toggle = (id: string) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const id = await createGroup(name, desc, sel);
    setBusy(false);
    if (id) close();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={close} />
      <div className="pop-in fixed left-1/2 top-1/2 z-50 w-[380px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white soft-shadow">
        <div className="flex items-center gap-2 border-b border-black/10 px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#5865f2]/10 text-[#5865f2]"><Users size={18} /></span>
          <h3 className="flex-1 text-[16px] font-extrabold tracking-tight text-[#2f3035]">Naya Group</h3>
          <button onClick={close} className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5" aria-label="Band karo"><X size={18} /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto thin-scroll p-4">
          <label className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-[#80848e]">Group ka naam *</label>
          <input
            autoFocus
            value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
            placeholder="jaise: Madrasa Dost 🕌"
            className="field w-full px-3.5 py-2.5 text-sm"
          />
          <label className="mb-1 mt-3 block text-xs font-bold uppercase tracking-[0.08em] text-[#80848e]">Description (optional)</label>
          <textarea
            value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={200} rows={2}
            placeholder="Group kis liye hai…"
            className="field w-full px-3.5 py-2.5 text-sm"
          />
          <div className="mb-1 mt-3 flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-[0.08em] text-[#80848e]">Members</label>
            <span className="text-xs font-bold text-[#5865f2]">{sel.length} selected</span>
          </div>
          <div className="max-h-52 space-y-0.5 overflow-y-auto thin-scroll rounded-xl border border-black/[0.07] bg-black/[0.02] p-1.5">
            {sorted.length === 0 && <p className="p-3 text-center text-xs text-[#80848e]">Koi member nahi mila</p>}
            {sorted.map((m) => {
              const on = sel.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition ${on ? "bg-[#5865f2]/10" : "hover:bg-black/[0.04]"}`}
                >
                  <Avatar m={m} size={34} showDot />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold" style={{ color: nameColor(m) }}>{m.name}</span>
                    <span className="block text-[11px] text-[#80848e]">{m.online ? <span className="font-bold text-[#23a55a]">online</span> : "offline"}</span>
                  </span>
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${on ? "border-[#5865f2] bg-[#5865f2] text-white" : "border-black/20 text-transparent"}`}>
                    <Check size={14} strokeWidth={3} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2 border-t border-black/10 p-4">
          <button onClick={close} className="btn btn-ghost flex-1 px-4 py-2.5 text-sm">Rehne do</button>
          <button
            onClick={submit}
            disabled={!name.trim() || busy}
            className="btn btn-primary flex-1 px-4 py-2.5 text-sm disabled:opacity-50"
          >
            {busy ? "Ban raha hai…" : `Group banao${sel.length > 0 ? ` (${sel.length + 1})` : ""}`}
          </button>
        </div>
      </div>
    </>
  );
}
