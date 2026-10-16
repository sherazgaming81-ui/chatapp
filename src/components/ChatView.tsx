"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Hash, Menu, Users, Pin } from "lucide-react";
import { getState, useStore, patchUI } from "@/lib/store";
import { Avatar } from "@/components/ui";
import MessageItem from "@/components/MessageItem";
import Composer from "@/components/Composer";
import MobileDrawers from "@/components/MobileDrawers";

const EMPTY_ARR: string[] = [];

export default function ChatView() {
  const chats = useStore((s) => s.chats);
  const messages = useStore((s) => s.messages);
  const members = useStore((s) => s.members);
  const typing = useStore((s) => s.ui.typing);
  const activeChatId = useStore((s) => s.ui.activeChatId) || chats[0]?.id;
  const activeChat = chats.find((c) => c.id === activeChatId);
  const isDM = activeChat?.type === "dm";
  const dmOther = isDM ? members.find((m) => m.id === activeChat?.otherId) : null;
  const sc = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(true);

  const msgs = useMemo(
    () => messages.filter((m) => m.chatId === activeChatId && m.type !== "system"),
    [messages, activeChatId]
  );

  useEffect(() => {
    if (stick && sc.current) sc.current.scrollTop = sc.current.scrollHeight;
  }, [msgs.length, stick, activeChatId]);

  const onScroll = () => {
    const el = sc.current;
    if (!el) return;
    setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
  };

  const typer = members.find((m) => m.id === typing[0]);
  const pinIds = useStore((s) => (activeChatId && s.pins[activeChatId]) || EMPTY_ARR);
  const pinnedMsgs = useMemo(
    () => pinIds.map((id) => messages.find((m) => m.id === id && !m.deleted)).filter(Boolean) as typeof messages,
    [pinIds, messages]
  );
  const [pinIdx, setPinIdx] = useState(0);
  const jumpTo = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1600);
    }
  };

  return (
    <div className="glass relative flex min-w-0 flex-1 flex-col rounded-2xl">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-black/10 px-3 sm:px-4">
        <button onClick={() => patchUI({ mobileDrawer: "channels" })} className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5 md:hidden" aria-label="Channels">
          <Menu size={20} />
        </button>
        {isDM ? (
          dmOther ? <Avatar m={dmOther} size={28} showDot /> : <span className="grid h-7 w-7 place-items-center rounded-full bg-[#5865f2] text-sm font-bold text-white">@</span>
        ) : (
          <Hash size={20} className="shrink-0 text-[#80848e]" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-extrabold tracking-tight text-[#2f3035]">{isDM ? dmOther?.name || activeChat?.name : activeChat?.name || "Chat"}</h1>
          {!isDM && <p className="truncate text-xs text-[#80848e]">Madrasa doston ka group</p>}
        </div>
        {typer && (
          <span className="hidden items-center gap-1.5 text-xs font-semibold text-[#23a55a] sm:flex">
            <span className="flex gap-0.5"><i className="tdot h-1.5 w-1.5 rounded-full bg-current" /><i className="tdot h-1.5 w-1.5 rounded-full bg-current" /><i className="tdot h-1.5 w-1.5 rounded-full bg-current" /></span>
            {typer.name.split(" ")[0]} likh raha hai…
          </span>
        )}
        <button onClick={() => patchUI({ mobileDrawer: "members" })} className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5 md:hidden" aria-label="Members">
          <Users size={20} />
        </button>
        <button onClick={() => { const s = getState(); patchUI({ showMembers: !s.ui.showMembers }); }} className="hidden rounded-md p-2 text-[#5c5e66] hover:bg-black/5 md:block" aria-label="Members">
          <Users size={20} />
        </button>
      </header>

      {pinnedMsgs.length > 0 && (
        <button
          onClick={() => { const p = pinnedMsgs[pinIdx % pinnedMsgs.length]; if (p) { jumpTo(p.id); setPinIdx((i) => i + 1); } }}
          className="flex shrink-0 items-center gap-2 border-b border-black/10 bg-[#5865f2]/[0.06] px-4 py-1.5 text-left text-[13px] transition hover:bg-[#5865f2]/[0.1]"
          title="Pin par jao"
        >
          <Pin size={14} className="shrink-0 text-[#5865f2]" />
          <span className="min-w-0 flex-1 truncate text-[#5c5e66]">
            {pinnedMsgs[pinIdx % pinnedMsgs.length]?.text?.slice(0, 80) || "📌"}
          </span>
          {pinnedMsgs.length > 1 && <span className="shrink-0 text-xs font-bold text-[#5865f2]">{(pinIdx % pinnedMsgs.length) + 1}/{pinnedMsgs.length}</span>}
        </button>
      )}

      <div ref={sc} onScroll={onScroll} className="thin-scroll min-h-0 flex-1 overflow-y-auto py-3">
        {msgs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-[#5865f2]/10">
              {isDM ? <span className="text-2xl">👋</span> : <Hash size={28} className="text-[#5865f2]" />}
            </div>
            <h3 className="mt-4 text-lg font-extrabold tracking-tight text-[#2f3035]">{isDM ? `Ye ${dmOther?.name || "dost"} se baat ki shuruaat hai` : `Welcome to ${activeChat?.name || "group"}!`}</h3>
            <p className="mt-1.5 max-w-xs text-sm text-[#80848e]">Pehla message bhejo — salaam se shuruaat karo 🌙</p>
          </div>
        ) : (
          msgs.map((m, i) => {
            const prev = msgs[i - 1];
            const member = members.find((x) => x.id === m.from);
            const prevSame = !!prev && prev.from === m.from && m.at - prev.at < 5 * 60e3 && !prev.deleted && m.type !== "announcement" && prev.type !== "announcement";
            return <MessageItem key={m.id} m={m} member={member} prevSame={prevSame} />;
          })
        )}
        {typer && (
          <div className="flex items-center gap-3 px-4 pt-2 sm:hidden">
            <Avatar m={typer} size={28} />
            <span className="flex gap-1 rounded-xl bg-black/[0.05] px-3 py-2"><i className="tdot h-1.5 w-1.5 rounded-full bg-[#80848e]" /><i className="tdot h-1.5 w-1.5 rounded-full bg-[#80848e]" /><i className="tdot h-1.5 w-1.5 rounded-full bg-[#80848e]" /></span>
          </div>
        )}
      </div>

      {activeChatId && <Composer chatId={activeChatId} />}
      <MobileDrawers />
    </div>
  );
}
