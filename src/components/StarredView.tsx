"use client";
// B13 — starred messages page: list, tap → jump to message, unstar from list
import { Star, StarOff, ArrowLeft, SearchX } from "lucide-react";
import { useStore, patchUI, getState } from "@/lib/store";
import { toggleStar } from "@/lib/db";
import { Avatar, fmtTime, fmtDayLabel, nameColor } from "@/components/ui";
import type { Message } from "@/lib/types";

function jumpTo(msgId: string, chatId: string) {
  patchUI({ starredOpen: false, tab: "chat", activeChatId: chatId, replyTo: null, mobileDrawer: "none" });
  setTimeout(() => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1600);
    }
  }, 350);
}

function StarredRow({ m }: { m: Message }) {
  const member = getState().members.find((x) => x.id === m.from);
  const name = member?.name || "Member";
  return (
    <div className="card flex items-start gap-3 p-3.5">
      <button onClick={() => jumpTo(m.id, m.chatId)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <Avatar m={{ id: member?.id || m.from, name, avatar: member?.avatar, online: !!member?.online }} size={36} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-bold" style={{ color: member ? nameColor(member) : "#5c5e66" }}>{name}</span>
            <span className="text-[11px] text-[#80848e]">{fmtDayLabel(m.at)} {fmtTime(m.at)}</span>
          </span>
          <span className="block truncate text-sm text-[#2f3035]">
            {m.text || (m.type === "image" ? "📷 Photo" : m.type === "gif" ? "🎞️ GIF" : m.type === "voice" ? "🎙️ Voice note" : m.type === "poll" ? "📊 Poll" : m.type === "sticker" ? "🎨 Sticker" : m.type === "location" ? "📍 Location" : m.type === "contact" ? "👤 Contact" : "Message")}
          </span>
        </span>
      </button>
      <button
        onClick={() => toggleStar(m.id)}
        className="shrink-0 rounded-lg p-2 text-[#f5a623] hover:bg-black/5"
        title="Unstar"
      >
        <StarOff size={17} />
      </button>
    </div>
  );
}

export default function StarredView() {
  const messages = useStore((s) => s.messages);
  const ids = useStore((s) => s.starred);
  const items = ids
    .map((id) => messages.find((m) => m.id === id && !m.deleted))
    .filter(Boolean) as Message[];
  items.sort((a, b) => b.at - a.at);

  return (
    <div className="glass relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl">
      <header className="flex shrink-0 items-center gap-3 border-b border-black/10 px-4 py-3.5">
        <button onClick={() => patchUI({ starredOpen: false })} className="rounded-lg p-1.5 text-[#5c5e66] hover:bg-black/5" aria-label="Wapas">
          <ArrowLeft size={20} />
        </button>
        <Star size={18} className="text-[#f5a623]" />
        <h2 className="text-[15px] font-extrabold text-[#2f3035]">Starred messages</h2>
        <span className="badge-pill ml-auto">{items.length}</span>
      </header>
      <div className="thin-scroll min-h-0 flex-1 space-y-2 overflow-y-auto p-3 sm:p-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-[#f5a623]/15 text-[#f5a623]">
              <SearchX size={28} />
            </span>
            <p className="mt-4 text-[15px] font-bold text-[#2f3035]">Koi starred message nahi</p>
            <p className="mt-1 text-sm text-[#80848e]">Kisi message par star dabao — wo yahan save ho jayega</p>
          </div>
        ) : (
          items.map((m) => <StarredRow key={m.id} m={m} />)
        )}
      </div>
    </div>
  );
}
