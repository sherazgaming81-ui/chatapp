"use client";
import { Briefcase, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useStore, patchUI } from "@/lib/store";
import { Avatar } from "@/components/ui";
import { useSidebarCollapsed, setSidebarCollapsed } from "@/lib/shell";
import NotificationsBell from "@/components/NotificationsBell";

export default function ServerRail() {
  const chats = useStore((s) => s.chats);
  const members = useStore((s) => s.members);
  const meId = useStore((s) => s.me);
  const tab = useStore((s) => s.ui.tab);
  const sidebarCollapsed = useSidebarCollapsed();
  const isOwnerUser = members.find((m) => m.id === meId)?.role === "owner";
  const activeChatId = useStore((s) => s.ui.activeChatId) || chats[0]?.id;
  const group = chats.find((c) => c.type === "group");
  const dms = chats.filter((c) => c.type === "dm");

  const pick = (id: string) => patchUI({ tab: "chat", activeChatId: id, replyTo: null });

  return (
    <nav className="panel flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto rounded-2xl py-3 no-scrollbar" aria-label="Chats">
      {/* Sidebar collapse toggle (desktop) — state localStorage me persist */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[#93A0B4] transition hover:bg-white/[0.06] hover:text-[#f4f6f8]"
      >
        {sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
      </button>
      <div className="h-0.5 w-8 rounded-full bg-white/15" />

      {group && (
        <button onClick={() => pick(group.id)} title={group.name} className="group relative">
          <span className={`grid h-12 w-12 place-items-center overflow-hidden bg-gradient-to-br from-[#4f8cff] to-[#3b76d6] text-2xl font-bold text-white soft-shadow transition-all duration-200 ${activeChatId === group.id ? "rounded-2xl" : "rounded-full group-hover:rounded-2xl"}`}>
            {group.photo ? (
              <img src={group.photo} alt="" className={`h-12 w-12 object-cover transition-all duration-200 ${activeChatId === group.id ? "rounded-2xl" : "rounded-full group-hover:rounded-2xl"}`} draggable={false} />
            ) : "M"}
          </span>
          {activeChatId === group.id && tab === "chat" && <span className="absolute -left-[13px] top-1/2 h-10 w-1 -translate-y-1/2 rounded-r-full bg-[#4f8cff]" />}
        </button>
      )}

      {dms.length > 0 && <div className="my-1 h-0.5 w-8 rounded-full bg-white/15" />}

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
            {active && tab === "chat" && <span className="absolute -left-[13px] top-1/2 h-10 w-1 -translate-y-1/2 rounded-r-full bg-[#4f8cff]" />}
          </button>
        );
      })}

      {/* Business HQ — bilkul neeche, sirf owner ko */}
      {isOwnerUser && (
        <>
          <div className="mt-auto" />
          <div className="h-0.5 w-8 rounded-full bg-white/15" />
          <NotificationsBell placement="rail" />
          <button onClick={() => patchUI({ tab: "hq" })} title="Business HQ" className="group relative">
            <span className={`grid h-12 w-12 place-items-center bg-gradient-to-br from-[#4f8cff] to-[#3b76d6] text-white transition-all duration-200 ${tab === "hq" ? "rounded-2xl glow-accent" : "rounded-full soft-shadow group-hover:rounded-2xl"}`}>
              <Briefcase size={21} />
            </span>
            {tab === "hq" && <span className="absolute -left-[13px] top-1/2 h-10 w-1 -translate-y-1/2 rounded-r-full bg-[#4f8cff]" />}
          </button>
        </>
      )}

    </nav>
  );
}
