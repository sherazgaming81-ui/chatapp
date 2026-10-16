"use client";
import { X, Plus, VolumeX, Volume2, Pin, PinOff, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useStore, patchUI, update, getState, toast } from "@/lib/store";
import { Avatar, Badge, fmtTime } from "@/components/ui";
import UnreadBadge from "@/components/UnreadBadge";
import { toggleMuteChat, isChatMuted, togglePinChat, isChatPinned } from "@/lib/prefs";
import { deleteGroup } from "@/lib/groups";
import { supabase } from "@/lib/supabase";

/* 4 — swipeable chat row (mobile): swipe left = actions (mute/pin/delete) */
function SwipeRow({ children, onMute, muted, onPin, pinned, onDelete, canDelete }: {
  children: React.ReactNode;
  onMute(): void; muted: boolean;
  onPin(): void; pinned: boolean;
  onDelete(): void; canDelete: boolean;
}) {
  const [dx, setDx] = useState(0);
  const [open, setOpen] = useState(false);
  const sx = useRef<number | null>(null);
  const W = 168; // actions width
  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* actions behind */}
      <div className="absolute inset-y-0 right-0 flex items-stretch" style={{ width: W }}>
        <button onClick={() => { onMute(); setOpen(false); setDx(0); }} className="flex w-14 flex-col items-center justify-center gap-0.5 bg-[#80848e]/15 text-[#5c5e66]" title={muted ? "Unmute" : "Mute"}>
          {muted ? <Volume2 size={17} /> : <VolumeX size={17} />}
          <span className="text-[9px] font-bold">{muted ? "Unmute" : "Mute"}</span>
        </button>
        <button onClick={() => { onPin(); setOpen(false); setDx(0); }} className="flex w-14 flex-col items-center justify-center gap-0.5 bg-[#5865f2]/15 text-[#5865f2]" title={pinned ? "Unpin" : "Pin"}>
          {pinned ? <PinOff size={17} /> : <Pin size={17} />}
          <span className="text-[9px] font-bold">{pinned ? "Unpin" : "Pin"}</span>
        </button>
        {canDelete && (
          <button onClick={() => { onDelete(); setOpen(false); setDx(0); }} className="flex w-14 flex-col items-center justify-center gap-0.5 bg-[#ed4245]/15 text-[#ed4245]" title="Delete">
            <Trash2 size={17} />
            <span className="text-[9px] font-bold">Delete</span>
          </button>
        )}
      </div>
      <div
        className="relative bg-transparent transition-transform"
        style={{ transform: `translateX(${open ? -W : dx}px)` }}
        onTouchStart={(e) => { sx.current = e.touches[0].clientX; }}
        onTouchMove={(e) => {
          if (sx.current === null) return;
          const d = e.touches[0].clientX - sx.current;
          setDx(Math.min(0, Math.max(-W, open ? -W + d : d)));
        }}
        onTouchEnd={() => {
          sx.current = null;
          setOpen(dx < -50);
          setDx(0);
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** DM delete: sirf apni participation hatao (dusron ka data safe) */
async function deleteDM(chatId: string): Promise<void> {
  if (!confirm("Ye DM delete karein?")) return;
  try {
    const s = getState();
    try { await supabase().from("chat_participants").delete().eq("chat_id", chatId).eq("user_id", s.me); } catch { /* ignore */ }
    const cur = getState();
    update({
      chats: cur.chats.filter((c) => c.id !== chatId),
      messages: cur.messages.filter((m) => m.chatId !== chatId),
    });
    const pins = { ...cur.pins }; delete pins[chatId];
    update({ pins });
    patchUI({ activeChatId: cur.chats.find((c) => c.id !== chatId)?.id || null });
    toast("DM delete ho gayi 🗑️");
  } catch { toast("Delete nahi hua", "Dobara koshish karo"); }
}

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
  const unread = useStore((s) => s.unread);
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
        {groups.map((group) => {
          const isOwner = members.find((x) => x.id === meId)?.role === "owner";
          return (
          <SwipeRow
            key={group.id}
            muted={isChatMuted(group.id)}
            onMute={() => { toggleMuteChat(group.id); toast(isChatMuted(group.id) ? "Mute kar diya 🔇" : "Unmute kar diya 🔊"); }}
            pinned={isChatPinned(group.id)}
            onPin={() => { togglePinChat(group.id); toast(isChatPinned(group.id) ? "Pin kar diya 📌" : "Unpin kar diya"); }}
            canDelete={isOwner}
            onDelete={() => deleteGroup(group.id)}
          >
          <button onClick={() => pick(group.id)} className={`mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left ${activeChatId === group.id ? "bg-[#5865f2] soft-shadow" : "hover:bg-black/5"}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#5865f2] to-[#9b7bff] text-lg font-bold text-white">{(group.name || "G")[0]?.toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-sm font-bold ${activeChatId === group.id ? "text-white" : "text-[#2f3035]"}`}>{group.name}</span>
              <span className={`block text-xs ${activeChatId === group.id ? "text-white/70" : "text-[#80848e]"}`}>group</span>
            </span>
            {isChatMuted(group.id) && <VolumeX size={14} className="shrink-0 text-[#80848e]" />}
            <UnreadBadge count={unread[group.id] || 0} />
          </button>
          </SwipeRow>
          );
        })}
        {dms.length > 0 && <p className="px-2 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#80848e]">Direct messages</p>}
        {dms.map((dm) => {
          const other = members.find((m) => m.id === dm.otherId);
          const lm = lastMsg(dm.id);
          const active = activeChatId === dm.id;
          return (
            <SwipeRow
              key={dm.id}
              muted={isChatMuted(dm.id)}
              onMute={() => { toggleMuteChat(dm.id); toast(isChatMuted(dm.id) ? "Mute kar diya 🔇" : "Unmute kar diya 🔊"); }}
              pinned={isChatPinned(dm.id)}
              onPin={() => { togglePinChat(dm.id); toast(isChatPinned(dm.id) ? "Pin kar diya 📌" : "Unpin kar diya"); }}
              canDelete
              onDelete={() => deleteDM(dm.id)}
            >
            <button onClick={() => pick(dm.id)} className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left ${active ? "bg-[#5865f2] soft-shadow" : "hover:bg-black/5"}`}>
              <Avatar m={{ id: other?.id || dm.id, name: other?.name || dm.name, avatar: other?.avatar || dm.photo, online: !!other?.online }} size={36} showDot />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-bold ${active ? "text-white" : "text-[#2f3035]"}`}>{other?.name || dm.name}</span>
                {lm && <span className={`block truncate text-xs ${active ? "text-white/70" : "text-[#80848e]"}`}>{lm.text?.slice(0, 30) || "media"} · {fmtTime(lm.at)}</span>}
              </span>
              {isChatMuted(dm.id) && <VolumeX size={14} className="shrink-0 text-[#80848e]" />}
              <UnreadBadge count={unread[dm.id] || 0} />
            </button>
            </SwipeRow>
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
