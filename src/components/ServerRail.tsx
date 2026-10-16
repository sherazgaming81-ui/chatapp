"use client";
import { useStore, patchUI } from "@/lib/store";
import { Avatar } from "@/components/ui";

export default function ServerRail() {
  const chats = useStore((s) => s.chats);
  const members = useStore((s) => s.members);
  const tab = useStore((s) => s.ui.tab);
  const activeChatId = useStore((s) => s.ui.activeChatId) || chats[0]?.id;
  const group = chats.find((c) => c.type === "group");
  const dms = chats.filter((c) => c.type === "dm");

  const pick = (id: string) => patchUI({ tab: "chat", activeChatId: id, replyTo: null });

  return (
    <nav className="glass flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto rounded-2xl py-3 no-scrollbar" aria-label="Chats">
      {group && (
        <button onClick={() => pick(group.id)} title={group.name} className="group relative">
          <span className={`grid h-12 w-12 place-items-center overflow-hidden bg-gradient-to-br from-[#5865f2] to-[#9b7bff] text-2xl font-bold text-white soft-shadow transition-all duration-200 ${activeChatId === group.id ? "rounded-2xl" : "rounded-full group-hover:rounded-2xl"}`}>
            {group.photo ? (
              <img src={group.photo} alt="" className={`h-12 w-12 object-cover transition-all duration-200 ${activeChatId === group.id ? "rounded-2xl" : "rounded-full group-hover:rounded-2xl"}`} draggable={false} />
            ) : "م"}
          </span>
          {activeChatId === group.id && <span className="absolute -left-[13px] top-1/2 h-10 w-1 -translate-y-1/2 rounded-r-full bg-[#5865f2]" />}
        </button>
      )}

      {dms.length > 0 && <div className="my-1 h-0.5 w-8 rounded-full bg-black/15" />}

      {/* Deen tab */}
      <button onClick={() => patchUI({ tab: "deen" })} title="Deen" className="group relative">
        <span className={`grid h-12 w-12 place-items-center bg-gradient-to-br from-[#23a55a] to-[#1a7a55] text-2xl soft-shadow transition-all duration-200 ${tab === "deen" ? "rounded-2xl" : "rounded-full group-hover:rounded-2xl"}`}>
          🕌
        </span>
        {tab === "deen" && <span className="absolute -left-[13px] top-1/2 h-10 w-1 -translate-y-1/2 rounded-r-full bg-[#5865f2]" />}
      </button>

      {dms.map((dm) => {
        const other = members.find((m) => m.id === dm.otherId);
        const active = activeChatId === dm.id;
        return (
          <button key={dm.id} onClick={() => pick(dm.id)} title={other?.name || dm.name} className="group relative">
            <span className={`block transition-all duration-200 ${active ? "rounded-2xl" : "rounded-full group-hover:rounded-2xl"}`}>
              <Avatar
                m={{ id: other?.id || dm.id, name: other?.name || dm.name, avatar: other?.avatar || dm.photo, online: !!other?.online }}
                size={48}
                showDot
              />
            </span>
            {active && <span className="absolute -left-[13px] top-1/2 h-10 w-1 -translate-y-1/2 rounded-r-full bg-[#5865f2]" />}
          </button>
        );
      })}
    </nav>
  );
}
