"use client";
import { Hash, Volume2, ChevronDown, Settings, Mic, LogOut, Star, Plus } from "lucide-react";
import { useState } from "react";
import { useStore, patchUI } from "@/lib/store";
import { Avatar, Badge, fmtTime } from "@/components/ui";
import { signOut } from "@/lib/db";
import { isStaff } from "@/lib/types";
import ProfileSettings from "@/components/ProfileSettings";
import UnreadBadge from "@/components/UnreadBadge";

export default function Sidebar() {
  const chats = useStore((s) => s.chats);
  const messages = useStore((s) => s.messages);
  const members = useStore((s) => s.members);
  const meId = useStore((s) => s.me);
  const me = members.find((m) => m.id === meId);
  const activeChatId = useStore((s) => s.ui.activeChatId) || chats[0]?.id;
  const unread = useStore((s) => s.unread);
  const groups = chats.filter((c) => c.type === "group");
  const group = groups[0];
  const dms = chats.filter((c) => c.type === "dm");
  const [menu, setMenu] = useState(false);
  const settingsOpen = useStore((s) => s.ui.settingsOpen);
  const setSettingsOpen = (v: boolean) => patchUI({ settingsOpen: v });

  const pick = (id: string) => patchUI({ tab: "chat", starredOpen: false, activeChatId: id, replyTo: null, mobileDrawer: "none" });
  const lastMsg = (chatId: string) => messages.filter((m) => m.chatId === chatId && !m.deleted).slice(-1)[0];

  return (
    <aside className="glass flex w-60 shrink-0 flex-col rounded-2xl">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-black/10 px-4">
        <h2 className="truncate text-[15px] font-extrabold tracking-tight text-[#2f3035]">{group?.name || "ChatsApp"}</h2>
        <div className="flex shrink-0 items-center">
          <button onClick={() => patchUI({ starredOpen: true })} className="rounded-md p-1.5 text-[#80848e] hover:bg-black/5 hover:text-[#f5a623]" title="Starred messages">
            <Star size={17} />
          </button>
          <ChevronDown size={18} className="text-[#80848e]" />
        </div>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {groups.length > 0 && (
          <>
            <div className="flex items-center justify-between px-2 pb-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#80848e]">Groups</p>
              <button
                onClick={() => patchUI({ createGroupOpen: true })}
                className="rounded-md p-1 text-[#80848e] hover:bg-black/5 hover:text-[#5865f2]"
                title="Naya group banao"
                aria-label="Naya group banao"
              >
                <Plus size={15} strokeWidth={2.5} />
              </button>
            </div>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => pick(g.id)}
                className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[15px] font-medium ${
                  activeChatId === g.id ? "bg-[#5865f2] text-white soft-shadow" : "text-[#5c5e66] hover:bg-black/5 hover:text-[#2f3035]"
                }`}
              >
                <Hash size={18} className="shrink-0 opacity-70" />
                <span className="truncate">{g.name}</span>
                <UnreadBadge count={unread[g.id] || 0} />
              </button>
            ))}
            <button className="mb-3 flex w-full cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[15px] font-medium text-[#80848e]/50" title="Jald aa raha hai">
              <Volume2 size={18} className="shrink-0 opacity-70" />
              <span className="truncate">elaan-voice</span>
            </button>
          </>
        )}
        {dms.length > 0 && (
          <>
            <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#80848e]">Direct messages</p>
            {dms.map((dm) => {
              const other = members.find((m) => m.id === dm.otherId);
              const lm = lastMsg(dm.id);
              const active = activeChatId === dm.id;
              return (
                <button
                  key={dm.id}
                  onClick={() => pick(dm.id)}
                  className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left ${active ? "bg-[#5865f2] soft-shadow" : "hover:bg-black/5"}`}
                >
                  <Avatar
                    m={{ id: other?.id || dm.id, name: other?.name || dm.name, avatar: other?.avatar || dm.photo, online: !!other?.online }}
                    size={32}
                    showDot
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[14px] font-semibold ${active ? "text-white" : "text-[#2f3035]"}`}>{other?.name || dm.name}</span>
                    {lm && <span className={`block truncate text-xs ${active ? "text-white/70" : "text-[#80848e]"}`}>{lm.from === meId ? "Aap: " : ""}{lm.text || (lm.type === "image" ? "📷 Photo" : lm.type === "voice" ? "🎙️ Voice" : lm.type === "poll" ? "📊 Poll" : lm.type === "location" ? "📍 Location" : lm.type === "contact" ? "👤 Contact" : "")} · {fmtTime(lm.at)}</span>}
                  </span>
                  <UnreadBadge count={unread[dm.id] || 0} />
                </button>
              );
            })}
          </>
        )}
      </div>

      <div className="relative shrink-0 rounded-b-2xl border-t border-black/10 bg-black/[0.04] px-2.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <button onClick={() => setMenu((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-left hover:bg-black/5">
            {me && <Avatar m={me} size={36} showDot />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-[#2f3035]">{me?.name || "…"}{me && <Badge role={me.role} />}</span>
              <span className="block truncate text-xs text-[#80848e]">{me?.online ? "Online" : "Offline"}</span>
            </span>
          </button>
          <button className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5 hover:text-[#2f3035]" title="Mic"><Mic size={18} /></button>
          <button onClick={() => setSettingsOpen(true)} className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5 hover:text-[#2f3035]" title="Settings"><Settings size={18} /></button>
        </div>
        {settingsOpen && <ProfileSettings onClose={() => setSettingsOpen(false)} />}
        {menu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
            <div className="pop-in glass-strong absolute bottom-full left-2 z-50 mb-2 w-52 overflow-hidden rounded-xl p-1.5">
              {me && isStaff(me) && (
                <button onClick={() => { setMenu(false); patchUI({ tab: "owner" }); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#2f3035] hover:bg-[#5865f2] hover:text-white">
                  <Settings size={16} /> Owner dashboard
                </button>
              )}
              <button onClick={() => signOut()} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#ed4245] hover:bg-[#ed4245]/10">
                <LogOut size={16} /> Logout
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
