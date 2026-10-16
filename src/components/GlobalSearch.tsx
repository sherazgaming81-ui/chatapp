"use client";
// I15 Global Search — messages + members, tap par jump
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Search, MessageSquare, Users } from "lucide-react";
import { useStore, patchUI } from "@/lib/store";
import { Avatar, fmtFull, nameColor } from "@/components/ui";
import type { Message } from "@/lib/types";

function Hi({ text, q }: { text: string; q: string }) {
  const t = text || "";
  if (!q.trim()) return <>{t.length > 90 ? t.slice(0, 90) + "…" : t}</>;
  const needle = q.trim().toLowerCase();
  const i = t.toLowerCase().indexOf(needle);
  if (i < 0) return <>{t.length > 90 ? t.slice(0, 90) + "…" : t}</>;
  const s = Math.max(0, i - 28);
  const e = Math.min(t.length, i + needle.length + 28);
  return (
    <>
      {(s > 0 ? "…" : "") + t.slice(s, i)}
      <mark className="rounded bg-[#5865f2]/25 px-0.5 font-bold text-inherit">{t.slice(i, i + needle.length)}</mark>
      {t.slice(i + needle.length, e) + (e < t.length ? "…" : "")}
    </>
  );
}

export default function GlobalSearch() {
  const open = useStore((s) => s.ui.globalSearchOpen);
  const messages = useStore((s) => s.messages);
  const members = useStore((s) => s.members);
  const chats = useStore((s) => s.chats);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"msgs" | "members">("msgs");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setTab("msgs");
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open ]);

  const msgHits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return messages
      .filter((m) => !m.deleted && ((m.text || "").toLowerCase().includes(needle) || (m.caption || "").toLowerCase().includes(needle)))
      .slice(-50)
      .reverse();
  }, [messages, q]);

  const memberHits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 1) return [];
    return members.filter((m) => m.name.toLowerCase().includes(needle)).slice(0, 20);
  }, [members, q]);

  if (!open) return null;
  const close = () => patchUI({ globalSearchOpen: false });

  const jump = (m: Message) => {
    close();
    patchUI({ activeChatId: m.chatId, jumpToMsg: m.id, mobileDrawer: "none" });
  };

  const chatName = (id: string) => chats.find((c) => c.id === id)?.name || "Chat";
  const senderOf = (id: string) => members.find((m) => m.id === id);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={close} />
      <div className="pop-in fixed left-1/2 top-[8%] z-50 w-[560px] max-w-[94vw] -translate-x-1/2 overflow-hidden rounded-2xl bg-white soft-shadow">
        <div className="flex items-center gap-2 border-b border-black/10 px-4 py-3">
          <Search size={18} className="shrink-0 text-[#5865f2]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Messages aur members talash karo…"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[#2f3035] outline-none placeholder:text-[#a0a3ab]"
          />
          <button onClick={close} className="rounded-lg p-1.5 text-[#80848e] hover:bg-black/5" aria-label="Band karo">
            <X size={18} />
          </button>
        </div>
        <div className="flex gap-1 border-b border-black/[0.06] px-3 pt-2">
          {([
            { id: "msgs", label: "Messages", icon: MessageSquare, n: msgHits.length },
            { id: "members", label: "Members", icon: Users, n: memberHits.length },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-t-xl px-3.5 py-2 text-[13px] font-extrabold transition ${tab === t.id ? "bg-[#5865f2]/[0.08] text-[#5865f2]" : "text-[#80848e] hover:bg-black/[0.04]"}`}
            >
              <t.icon size={15} /> {t.label}
              {q.trim().length >= 2 && <span className="rounded-full bg-black/[0.07] px-1.5 text-[11px] tabular-nums">{t.n}</span>}
            </button>
          ))}
        </div>

        <div className="thin-scroll max-h-[55vh] min-h-[180px] overflow-y-auto p-2">
          {q.trim().length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-[#a0a3ab]">Kam az kam 2 harf likho 🔍</p>
          ) : tab === "msgs" ? (
            msgHits.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-[#a0a3ab]">Koi message nahi mila 📭</p>
            ) : (
              msgHits.map((m) => {
                const s = senderOf(m.from);
                return (
                  <button
                    key={m.id}
                    onClick={() => jump(m)}
                    className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-black/[0.04] active:scale-[0.99]"
                  >
                    {s ? <Avatar m={s} size={34} /> : <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-black/10 text-sm">?</span>}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-[13px] font-extrabold" style={{ color: s ? nameColor(s) : "#2f3035" }}>
                          {s?.name || "Member"}
                        </span>
                        <span className="shrink-0 text-[11px] font-bold text-[#80848e]">{chatName(m.chatId)}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-[#a0a3ab]">{fmtFull(m.at)}</span>
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-[#5c5e66]">
                        <Hi text={m.text || m.caption || (m.type === "image" ? "📷 Photo" : m.type === "voice" ? "🎤 Voice" : m.type)} q={q} />
                      </span>
                    </span>
                  </button>
                );
              })
            )
          ) : memberHits.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-[#a0a3ab]">Koi member nahi mila 📭</p>
          ) : (
            memberHits.map((m) => (
              <button
                key={m.id}
                onClick={() => { close(); patchUI({ profileId: m.id }); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-black/[0.04] active:scale-[0.99]"
              >
                <Avatar m={m} size={38} showDot />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold" style={{ color: nameColor(m) }}>{m.name}</span>
                  <span className="block truncate text-xs text-[#80848e]">{m.online ? <span className="font-bold text-[#23a55a]">online</span> : m.about || "—"}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
