"use client";
import { useState } from "react";
import { X, AtSign, VolumeX, Volume2, AlertTriangle, Gavel, ShieldCheck, Crown, MessageCircle } from "lucide-react";
import { useStore, patchUI, toast } from "@/lib/store";
import { setMute, setBan, addWarn, setRole, sendText } from "@/lib/db";
import { openDM } from "@/lib/groups";
import { Avatar, Badge, nameColor, fmtLastSeen } from "@/components/ui";
import { visibleOnline, visibleLastSeen, visibleAbout } from "@/lib/prefs";
import { isStaff } from "@/lib/types";

const MUTE_OPTS = [
  { l: "10 minute", v: 10 * 60e3 },
  { l: "1 ghanta", v: 3600e3 },
  { l: "1 din", v: 86400e3 },
  { l: "Hamesha", v: null },
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
      <div className="pop-in fixed left-1/2 top-1/2 z-50 w-[340px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white soft-shadow">
        <div className="h-20 bg-gradient-to-r from-[#5865f2] to-[#9b7bff]" />
        <button onClick={close} className="absolute right-3 top-3 rounded-full bg-black/30 p-1.5 text-white hover:bg-black/50"><X size={16} /></button>
        <div className="-mt-10 px-5 pb-5">
          <Avatar m={m} size={72} showDot meId={meId} />
          <h3 className="mt-2 text-xl font-extrabold tracking-tight" style={{ color: nameColor(m) }}>{m.name}<Badge role={m.role} /></h3>
          {(() => {
            // E1 privacy respect
            const on = isMe ? m.online : visibleOnline(meId, m);
            const ls = isMe ? m.lastSeen : visibleLastSeen(meId, m);
            return <p className="text-xs text-[#80848e]">{on ? "● Online" : ls > 0 ? `○ ${fmtLastSeen(ls)}` : "○ Offline"}</p>;
          })()}
          {(() => {
            const about = isMe ? m.about : visibleAbout(meId, m);
            return about ? (
              <div className="mt-3 rounded-xl bg-black/[0.04] p-3">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#80848e]">About</p>
                <p className="text-sm text-[#2f3035]">{about}</p>
              </div>
            ) : null;
          })()}
          {m.warns.length > 0 && <p className="mt-2 text-xs font-semibold text-[#b36b00]">⚠️ {m.warns.length} warning{m.warns.length > 1 ? "s" : ""}</p>}

          <div className="mt-4 space-y-2">
            {!isMe && (
              <button onClick={() => openDM(m.id)} className="btn btn-primary flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">
                <MessageCircle size={15} /> Message karo
              </button>
            )}
            {!isMe && activeChatId && (
              <button onClick={() => { sendText(activeChatId, `@${m.name} `); close(); }} className="btn btn-ghost flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">
                <AtSign size={15} /> Mention karo
              </button>
            )}
            {canMod && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setMuteOpen((v) => !v)} className={`btn flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm ${muted ? "btn-green" : "btn-ghost"}`}>
                    {muted ? <Volume2 size={15} /> : <VolumeX size={15} />} {muted ? "Unmute" : "Mute"}
                  </button>
                  <button onClick={() => { const r = warnText.trim() || "Group rules torhe"; addWarn(m.id, r); setWarnText(""); toast("Warning de di", m.name); }} className="btn btn-ghost flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm">
                    <AlertTriangle size={15} /> Warn
                  </button>
                </div>
                {muteOpen && (
                  <div className="grid grid-cols-2 gap-2">
                    {MUTE_OPTS.map((o) => (
                      <button key={o.l} onClick={() => { setMute(m.id, o.v === null ? null : Date.now() + o.v); setMuteOpen(false); toast("Mute kar diya", `${m.name} · ${o.l}`); }} className="btn btn-ghost px-3 py-2 text-xs">{o.l}</button>
                    ))}
                  </div>
                )}
                {muted && (
                  <button onClick={() => { setMute(m.id, undefined); toast("Unmute kar diya", m.name); }} className="btn btn-ghost w-full px-4 py-2 text-xs">Mute hatao</button>
                )}
                <input value={warnText} onChange={(e) => setWarnText(e.target.value)} placeholder="Warning ki wajah…" className="field min-w-0 w-full px-3 py-2 text-sm" />
                {me?.role === "owner" && m.role !== "admin" && (
                  <button onClick={() => { setRole(m.id, "admin"); toast("Admin bana diya", m.name); }} className="btn btn-ghost flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">
                    <Crown size={15} /> Admin banao
                  </button>
                )}
                {me?.role === "owner" && m.role === "admin" && (
                  <button onClick={() => { setRole(m.id, "member"); toast("Admin hataya", m.name); }} className="btn btn-ghost flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">
                    <ShieldCheck size={15} /> Member wapas karo
                  </button>
                )}
                {!m.banned ? (
                  <button onClick={() => patchUI({ confirmBan: m.id })} className="btn btn-danger flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">
                    <Gavel size={15} /> Ban karo
                  </button>
                ) : (
                  <button onClick={() => { setBan(m.id, false); toast("Unban kar diya", m.name); }} className="btn btn-green flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">
                    <ShieldCheck size={15} /> Unban karo
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {confirmBan === m.id && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => patchUI({ confirmBan: null })} />
          <div className="pop-in fixed left-1/2 top-1/2 z-[70] w-[320px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 soft-shadow">
            <h3 className="text-lg font-extrabold text-[#2f3035]">Ban karein?</h3>
            <p className="mt-1 text-sm text-[#5c5e66]"><b className="text-[#2f3035]">{m.name}</b> group me message nahi bhej payega.</p>
            <input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Wajah (optional)…" className="field mt-3 w-full px-3 py-2.5 text-sm" />
            <div className="mt-4 flex gap-2">
              <button onClick={() => patchUI({ confirmBan: null })} className="btn btn-ghost flex-1 px-4 py-2.5 text-sm">Rehne do</button>
              <button onClick={() => { setBan(m.id, true, banReason.trim()); patchUI({ confirmBan: null, profileId: null }); toast("Ban kar diya", m.name); }} className="btn btn-danger flex-1 px-4 py-2.5 text-sm">Ban karo</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
