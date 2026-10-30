"use client";
// Fun — Gumnam Paigham: asal sender sirf owner ko dikhta hai (header anonymity MessageItem me hai)
import { useStore } from "@/lib/store";
import type { Message } from "@/lib/types";

export default function GumnamMessage({ m }: { m: Message }) {
  const me = useStore((s) => s.me);
  const members = useStore((s) => s.members);

  const mine = m.from === me;
  const iAmOwner = members.find((x) => x.id === me)?.role === "owner";
  const senderName = members.find((x) => x.id === m.from)?.name || "Member";

  return (
    <div className="mt-1 max-w-sm">
      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#2f3035]">{m.text}</p>
      <p className="mt-1.5">
        {mine ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#5865f2]/10 px-2.5 py-1 text-xs font-semibold text-[#5865f2]">
            🕵️ Ye aapka gumnam paigham hai — dusron ko aapka naam nahi dikh raha
          </span>
        ) : iAmOwner ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f5a623]/15 px-2.5 py-1 text-xs font-semibold text-[#9a6a00]">
            👁 Owner view — asal sender: {senderName}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2.5 py-1 text-xs font-semibold text-[#5c5e66]">
            🕵️ Gumnam Dost
          </span>
        )}
      </p>
    </div>
  );
}
