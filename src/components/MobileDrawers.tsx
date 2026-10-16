"use client";
import { X, Plus } from "lucide-react";
import { useStore, patchUI } from "@/lib/store";
import { Avatar, Badge, fmtTime } from "@/components/ui";

function Drawer({ side, onClose, children, title }: { side: "left" | "right"; onClose(): void; children: React.ReactNode; title: string }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} />
      <div className={`glass-strong fixed top-0 z-50 flex h-full w-[300px] flex-col shadow-2xl md:hidden ${side === "left" ? "left-0 rounded-r-2xl" : "right-0 rounded-l-2xl"}`}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-black/10 px-4">
          <h2 className="text-[15px] font-extrabold tracking-tight text-[#2f3035]">{title}</h2>
          <button onClick={onClose} className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5"><X size={18} /></button>
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </>
  );
}

export default function MobileDrawers() {
  const drawer = useStore((s) => s.ui.mobileDrawer);
  const chats = useStore((s) => s.chats);
  const messages = useStore((s) => s.messages);
  const members = useStore((s) => s.members);
  const meId = useStore((s) => s.me);
  const activeChatId = useStore((s) => s.ui.activeChatId) || chats[0]?.id;
  const close = () => patchUI({ mobileDrawer: "none" });
  const pick = (id: string) => patchUI({ tab: "chat", activeChatId: id, replyTo: null, mobileDrawer: "none" });
  const lastMsg = (chatId: string) => messages.filter((m) => m.chatId === chatId && !m.deleted).slice(-1)[0];

  if (drawer === "none") return null;

  if (drawer === "channels") {
    const groups = chats.filter((c) => c.type === "group");
    const dms = chats.filter((c) => c.type === "dm");
    return (
      <Drawer side="left" onClose={close} title="Chats">
        <button
          onClick={() => { close(); patchUI({ createGroupOpen: true }); }}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#5865f2]/10 px-3 py-2.5 text-sm font-extrabold text-[#5865f2] transition active:scale-[0.98]"
        >
          <Plus size={16} strokeWidth={2.5} /> Naya Group
        </button>
        {groups.map((group) => (
          <button key={group.id} onClick={() => pick(group.id)} className={`mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left ${activeChatId === group.id ? "bg-[#5865f2] soft-shadow" : "hover:bg-black/5"}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#5865f2] to-[#9b7bff] text-lg font-bold text-white">{(group.name || "G")[0]?.toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-sm font-bold ${activeChatId === group.id ? "text-white" : "text-[#2f3035]"}`}>{group.name}</span>
              <span className={`block text-xs ${activeChatId === group.id ? "text-white/70" : "text-[#80848e]"}`}>group</span>
            </span>
          </button>
        ))}
        {dms.length > 0 && <p className="px-2 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#80848e]">Direct messages</p>}
        {dms.map((dm) => {
          const other = members.find((m) => m.id === dm.otherId);
          const lm = lastMsg(dm.id);
          const active = activeChatId === dm.id;
          return (
            <button key={dm.id} onClick={() => pick(dm.id)} className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left ${active ? "bg-[#5865f2] soft-shadow" : "hover:bg-black/5"}`}>
              <Avatar m={{ id: other?.id || dm.id, name: other?.name || dm.name, avatar: other?.avatar || dm.photo, online: !!other?.online }} size={36} showDot />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-bold ${active ? "text-white" : "text-[#2f3035]"}`}>{other?.name || dm.name}</span>
                {lm && <span className={`block truncate text-xs ${active ? "text-white/70" : "text-[#80848e]"}`}>{lm.text?.slice(0, 30) || "media"} · {fmtTime(lm.at)}</span>}
              </span>
            </button>
          );
        })}
      </Drawer>
    );
  }

  const visible = members.filter((m) => !m.banned);
  const online = visible.filter((m) => m.online);
  const offline = visible.filter((m) => !m.online);
  const Row = ({ m }: { m: (typeof visible)[number] }) => (
    <button key={m.id} onClick={() => patchUI({ profileId: m.id, mobileDrawer: "none" })} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-black/5">
      <Avatar m={m} size={36} showDot />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[#2f3035]">{m.id === meId ? "Aap" : m.name}<Badge role={m.role} /></span>
        <span className="block text-xs text-[#80848e]">{m.online ? "Online" : "Offline"}</span>
      </span>
    </button>
  );
  return (
    <Drawer side="right" onClose={close} title={`Members · ${visible.length}`}>
      <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#80848e]">Online — {online.length}</p>
      {online.map((m) => <Row key={m.id} m={m} />)}
      <p className="px-2 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#80848e]">Offline — {offline.length}</p>
      {offline.map((m) => <Row key={m.id} m={m} />)}
    </Drawer>
  );
}
