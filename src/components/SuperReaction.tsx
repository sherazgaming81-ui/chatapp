"use client";
// Fun — Super Reaction (sirf owner): modal (emoji + style + live preview) aur SuperPill
import { useState } from "react";
import { Eye, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { sendSuperReaction, type SuperFxKind } from "@/lib/db";
import { parseSuper } from "@/lib/fun";
import FxOverlay from "@/components/FxOverlay";
import type { Message } from "@/lib/types";

const EMOJIS = ["❤️", "🎉", "⭐", "🔥", "💖", "👏"];
const KINDS: { kind: SuperFxKind; label: string; desc: string }[] = [
  { kind: "hearts", label: "Dil ki barish", desc: "Dil neeche se upar urte hain ❤️" },
  { kind: "confetti", label: "Confetti blast", desc: "Poori screen par confetti 🎉" },
  { kind: "stars", label: "Sitaray", desc: "Sitaray upar urte chamakte hain ⭐" },
];

export function SuperReactionModal({ m, onClose }: { m: Message; onClose: () => void }) {
  const [emoji, setEmoji] = useState("❤️");
  const [kind, setKind] = useState<SuperFxKind>("hearts");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (busy) return;
    setBusy(true);
    await sendSuperReaction(m.chatId, emoji, kind, m.id);
    setBusy(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="pop-in fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[340px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-black/10 bg-white p-5 soft-shadow">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-[#2f3035]">⭐ Super Reaction</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#80848e] hover:bg-black/5"><X size={18} /></button>
        </div>
        <p className="mt-0.5 text-sm text-[#80848e]">Poori chat ko full-screen effect dikhega — bilkul waisa jo preview me dikhta hai.</p>

        <p className="mb-1.5 mt-4 text-xs font-bold uppercase tracking-[0.06em] text-[#80848e]">Emoji chuno</p>
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`grid h-11 w-11 place-items-center rounded-xl border text-[22px] transition active:scale-95 ${
                emoji === e ? "border-[#5865f2] bg-[#5865f2]/10" : "border-black/10 hover:border-black/25"
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        <p className="mb-1.5 mt-4 text-xs font-bold uppercase tracking-[0.06em] text-[#80848e]">Style</p>
        <div className="space-y-1.5">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              onClick={() => setKind(k.kind)}
              className={`block w-full rounded-lg border px-3 py-2 text-left transition ${
                kind === k.kind ? "border-[#5865f2] bg-[#5865f2]/10" : "border-black/10 hover:border-black/25"
              }`}
            >
              <span className="block text-sm font-bold text-[#2f3035]">{k.label}</span>
              <span className="block text-xs text-[#80848e]">{k.desc}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={() => setPreview(true)} className="btn btn-ghost flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-sm">
            <Eye size={16} /> Preview
          </button>
          <button onClick={send} disabled={busy} className="btn btn-blurple flex-1 px-3 py-2.5 text-sm disabled:opacity-60">
            Bhejo ⭐
          </button>
        </div>
      </div>
      {preview && <FxOverlay kind={kind} emoji={emoji} onDone={() => setPreview(false)} />}
    </>
  );
}

export function SuperPill({ m }: { m: Message }) {
  const members = useStore((s) => s.members);
  const data = parseSuper(m.caption);
  const name = members.find((x) => x.id === m.from)?.name || "Owner";
  return (
    <div className="mt-1 flex justify-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f5a623]/40 bg-[#f5a623]/10 px-3 py-1.5 text-[13px] font-bold text-[#2f3035]">
        ⭐ {name} ne Super Reaction bheja {data?.emoji || "⭐"}
      </span>
    </div>
  );
}
