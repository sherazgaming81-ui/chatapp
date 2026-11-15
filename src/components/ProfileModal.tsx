"use client";
// ProfileSheet — member par tap → profile modal.
// Actions: Mention, DM, (staff: Mute/Warn/Ban/Role). Self: Edit.
import { useState } from "react";
import { X, AtSign, VolumeX, Volume2, AlertTriangle, Gavel, ShieldCheck, Crown, MessageCircle, Pencil } from "lucide-react";
import { useStore, patchUI, toast } from "@/lib/store";
import { setMute, setBan, addWarn, setRole, sendText } from "@/lib/db";
import { openDM } from "@/lib/groups";
import { Avatar } from "@/components/ui";
import ProfileCard from "@/components/ProfileCard";
import { isStaff } from "@/lib/types";

const MUTE_OPTS = [
  { l: "10 minutes", v: 10 * 60e3 },
  { l: "1 hour", v: 3600e3 },
  { l: "1 day", v: 86400e3 },
  { l: "Forever", v: null },
];

export default function ProfileModal() {
  const profileId = useStore((s) => s.ui.profileId);
  const members = useStore((s) => s.members);
  const meId = useStore((s) => s.me);
  const activeChatId = useStore((s) => s.ui.activeChatId);
  const confirmBan = useStore((s) => s.ui.confirmBan);
  const [warnText, setWarnText] = useState("");
  const [muteOpen, setMuteOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [photoZoom, setPhotoZoom] = useState(false);

  if (!profileId) return null;
  const m = members.find((x) => x.id === profileId);
  if (!m) return null;
  const me = members.find((x) => x.id === meId);
  const canMod = isStaff(me) && m.id !== meId && m.role !== "owner";
  const isMe = m.id === meId;
  const close = () => patchUI({ profileId: null, confirmBan: null });
  const muted = m.mutedUntil !== undefined && (m.mutedUntil === null || m.mutedUntil > Date.now());

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={close} />
      <div className="pop-in fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[400px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto">
        <button onClick={close} className="absolute right-3 top-3 z-10 rounded-full bg-black/30 p-1.5 text-white hover:bg-white/[0.06]0" aria-label="Close">
          <X size={16} />
        </button>
        <ProfileCard m={m}>
          {/* photo zoom (avatar par tap) */}
          {m.avatar && (
            <button onClick={() => setPhotoZoom(true)} className="mt-2 text-xs font-bold text-[#8dbcff] hover:underline">
              View full photo 🔍
            </button>
          )}
          {m.warns.length > 0 && <p className="mt-2 text-xs font-semibold text-[#b36b00]">⚠️ {m.warns.length} warning{m.warns.length > 1 ? "s" : ""}</p>}

          <div className="mt-4 space-y-2">
            {isMe ? (
              <button onClick={() => { close(); patchUI({ settingsOpen: true }); }} className="btn btn-ghost flex w-full items-center justify-center gap-1.5 px-3 py-2.5 text-sm">
                <Pencil size={15} /> Edit
              </button>
            ) : (
              <>
                <button onClick={() => openDM(m.id)} className="btn btn-primary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">
                  <MessageCircle size={15} /> Send DM
                </button>
                {activeChatId && (
                  <button onClick={() => { sendText(activeChatId, `@${m.name} `); close(); }} className="btn btn-ghost flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">
                    <AtSign size={15} /> Mention
                  </button>
                )}
              </>
            )}
            {canMod && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setMuteOpen((v) => !v)} className={`btn flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm ${muted ? "btn-green" : "btn-ghost"}`}>
                    {muted ? <Volume2 size={15} /> : <VolumeX size={15} />} {muted ? "Unmute" : "Mute"}
                  </button>
                  <button onClick={() => { const r = warnText.trim() || "Broke group rules"; addWarn(m.id, r); setWarnText(""); toast("Warning sent", m.name); }} className="btn btn-ghost flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm">
                    <AlertTriangle size={15} /> Warn
                  </button>
                </div>
                {muteOpen && (
                  <div className="grid grid-cols-2 gap-2">
                    {MUTE_OPTS.map((o) => (
                      <button key={o.l} onClick={() => { setMute(m.id, o.v === null ? null : Date.now() + o.v); setMuteOpen(false); toast("Muted", `${m.name} · ${o.l}`); }} className="btn btn-ghost px-3 py-2 text-xs">{o.l}</button>
                    ))}
                  </div>
                )}
                {muted && (
                  <button onClick={() => { setMute(m.id, undefined); toast("Unmuted", m.name); }} className="btn btn-ghost w-full px-4 py-2 text-xs">Remove mute</button>
                )}
                <input value={warnText} onChange={(e) => setWarnText(e.target.value)} placeholder="Reason for the warning…" className="field min-w-0 w-full px-3 py-2 text-sm" />
                {me?.role === "owner" && m.role !== "admin" && (
                  <button onClick={() => { setRole(m.id, "admin"); toast("Made admin", m.name); }} className="btn btn-ghost flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">
                    <Crown size={15} /> Make admin
                  </button>
                )}
                {me?.role === "owner" && m.role === "admin" && (
                  <button onClick={() => { setRole(m.id, "member"); toast("Admin removed", m.name); }} className="btn btn-ghost flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">
                    <ShieldCheck size={15} /> Restore member
                  </button>
                )}
                {!m.banned ? (
                  <button onClick={() => patchUI({ confirmBan: m.id })} className="btn btn-danger flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">
                    <Gavel size={15} /> Ban
                  </button>
                ) : (
                  <button onClick={() => { setBan(m.id, false); toast("Unbanned", m.name); }} className="btn btn-green flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">
                    <ShieldCheck size={15} /> Unban
                  </button>
                )}
              </>
            )}
          </div>
        </ProfileCard>
      </div>

      {photoZoom && m.avatar && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/95" onClick={() => setPhotoZoom(false)} />
          <div className="pointer-events-none fixed inset-0 z-[81] grid place-items-center p-6" onClick={() => setPhotoZoom(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.avatar} alt={m.name} className="photo-zoom-in max-h-[85vh] max-w-[92vw] rounded-2xl object-contain soft-shadow" draggable={false} />
          </div>
          <button onClick={() => setPhotoZoom(false)} className="fixed right-4 top-4 z-[82] rounded-full bg-white/10 p-2.5 text-white backdrop-blur hover:bg-white/20" aria-label="Close">
            <X size={20} />
          </button>
        </>
      )}

      {confirmBan === m.id && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => patchUI({ confirmBan: null })} />
          <div className="pop-in fixed left-1/2 top-1/2 z-[70] w-[320px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 soft-shadow">
            <h3 className="text-lg font-extrabold text-[#f4f6f8]">Ban this member?</h3>
            <p className="mt-1 text-sm text-[#b6bcc7]"><b className="text-[#f4f6f8]">{m.name}</b> won't be able to message in this group.</p>
            <input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Reason (optional)…" className="field mt-3 w-full px-3 py-2.5 text-sm" />
            <div className="mt-4 flex gap-2">
              <button onClick={() => patchUI({ confirmBan: null })} className="btn btn-ghost flex-1 px-4 py-2.5 text-sm">Cancel</button>
              <button onClick={() => { setBan(m.id, true, banReason.trim()); patchUI({ confirmBan: null, profileId: null }); toast("Banned", m.name); }} className="btn btn-danger flex-1 px-4 py-2.5 text-sm">Ban</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// re-export taake purane imports na tooten
export { Avatar };
