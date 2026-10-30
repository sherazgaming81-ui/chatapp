"use client";
// Mega-2 — Status/Stories (pura WhatsApp wala system): 24h status, photo/text
// composer, doston ke updates ring ke sath, full-screen viewer (progress
// segments, 5s auto-advance, tap zones), apne status ke viewers + delete.
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Plus, Camera, Trash2, Eye, ChevronLeft, ChevronRight, Clock, Send } from "lucide-react";
import { useStore, patchUI } from "@/lib/store";
import { postStatus, markStatusSeen, deleteStatus, STATUS_TTL } from "@/lib/db";
import { Avatar, fmtTime } from "@/components/ui";
import type { Member, StatusItem } from "@/lib/types";

const BG_COLORS = ["#5865f2", "#23a55a", "#f5a623", "#ed4245", "#9b7bff", "#00b0f4", "#075e54"];

type Group = { userId: string; items: StatusItem[] };

/** Ring ka rang: unseen ho to sabz, sab dekhe hue hon to halka grey, status hi na ho to transparent */
export function statusRingBg(items: StatusItem[], meId: string): string {
  if (!items.length) return "transparent";
  return items.some((s) => !s.readBy.includes(meId)) ? "#23a55a" : "#c9ccd1";
}

/** Avatar status ring ke sath — chat list + status list dono ke liye */
export function RingAvatar({
  m, items, size = 44, meId, role, showDot = false, onRingClick,
}: {
  m: Pick<Member, "id" | "name" | "avatar" | "online" | "privacy">;
  items: StatusItem[];
  size?: number;
  meId: string;
  role?: Member["role"];
  showDot?: boolean;
  onRingClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <span
      onClick={onRingClick}
      className="shrink-0 rounded-full p-[2.5px]"
      style={{ background: statusRingBg(items, meId) }}
    >
      <Avatar m={m} size={size} showDot={showDot} meId={meId} role={role} />
    </span>
  );
}

function remainingLabel(at: number): string {
  const ms = STATUS_TTL - (Date.now() - at);
  if (ms <= 0) return "khatam ho gaya";
  const h = Math.floor(ms / 3600e3);
  if (h >= 1) return `${h} ghante baqi`;
  const m = Math.max(1, Math.floor(ms / 60000));
  return `${m} min baqi`;
}

export default function StatusView() {
  const statuses = useStore((s) => s.statuses);
  const members = useStore((s) => s.members);
  const meId = useStore((s) => s.me);
  const me = members.find((m) => m.id === meId);

  // 24h se purane yahan bhi safe filter (db bhi karta hai)
  const active = useMemo(
    () => statuses.filter((s) => Date.now() - s.at < STATUS_TTL).slice().sort((a, b) => a.at - b.at),
    [statuses]
  );

  const myItems = useMemo(() => active.filter((s) => s.from === meId), [active, meId]);

  const otherGroups = useMemo<Group[]>(() => {
    const map = new Map<string, StatusItem[]>();
    for (const s of active) {
      if (s.from === meId) continue;
      const arr = map.get(s.from) || [];
      arr.push(s);
      map.set(s.from, arr);
    }
    return Array.from(map.entries())
      .map(([userId, items]) => ({ userId, items }))
      .sort((a, b) => (b.items[b.items.length - 1]?.at || 0) - (a.items[a.items.length - 1]?.at || 0));
  }, [active, meId]);

  const allGroups = useMemo<Group[]>(
    () => [...(myItems.length ? [{ userId: meId, items: myItems }] : []), ...otherGroups],
    [myItems, otherGroups, meId]
  );

  /* ── Composer state ── */
  const [mode, setMode] = useState<"none" | "photo" | "text">("none");
  const [photoSrc, setPhotoSrc] = useState("");
  const [caption, setCaption] = useState("");
  const [textBody, setTextBody] = useState("");
  const [textBg, setTextBg] = useState(BG_COLORS[0]);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Viewer state ── */
  const [viewer, setViewer] = useState<{ userId: string; idx: number } | null>(null);
  const [viewersOpen, setViewersOpen] = useState(false);

  const vGroupIdx = viewer ? allGroups.findIndex((g) => g.userId === viewer.userId) : -1;
  const vGroup = vGroupIdx >= 0 ? allGroups[vGroupIdx] : undefined;
  const vItem = vGroup && viewer ? vGroup.items[Math.min(viewer.idx, vGroup.items.length - 1)] : undefined;
  const vMember = vGroup ? members.find((m) => m.id === vGroup.userId) : undefined;
  const isMine = !!viewer && viewer.userId === meId;

  // Viewer ka group khatam/delete ho jaye to band kar do, idx out-of-range ho to clamp
  useEffect(() => {
    if (!viewer) return;
    if (!vGroup) { setViewer(null); setViewersOpen(false); return; }
    if (viewer.idx > vGroup.items.length - 1) setViewer({ userId: viewer.userId, idx: vGroup.items.length - 1 });
  }, [viewer, vGroup]);

  const goNext = () => {
    if (!viewer || !vGroup) return;
    if (viewer.idx + 1 < vGroup.items.length) setViewer({ userId: viewer.userId, idx: viewer.idx + 1 });
    else if (vGroupIdx + 1 < allGroups.length) setViewer({ userId: allGroups[vGroupIdx + 1].userId, idx: 0 });
    else { setViewer(null); setViewersOpen(false); }
  };
  const goPrev = () => {
    if (!viewer || !vGroup) return;
    if (viewer.idx > 0) setViewer({ userId: viewer.userId, idx: viewer.idx - 1 });
    else if (vGroupIdx > 0) {
      const prev = allGroups[vGroupIdx - 1];
      setViewer({ userId: prev.userId, idx: prev.items.length - 1 });
    }
  };

  // Dusre ka status dikhte hi seen mark karo (har status par effect ek dafa chalta hai)
  useEffect(() => {
    if (vItem && vItem.from !== meId) void markStatusSeen(vItem.id);
  }, [vItem?.id, vItem?.from, meId]);

  // 5 second auto-advance (viewers sheet khuli ho to ruka rahe)
  useEffect(() => {
    if (!viewer || !vItem || viewersOpen) return;
    const t = setTimeout(() => goNext(), 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer?.userId, viewer?.idx, vItem?.id, viewersOpen, allGroups.length]);

  /* ── Photo pick — Composer.pickImage wala tareeqa (canvas, max 1280, JPEG 0.82) ── */
  const pickPhoto = async (f: File | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    const img = new Image();
    const url = URL.createObjectURL(f);
    try {
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      const max = 1280;
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * sc);
      cv.height = Math.round(img.height * sc);
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      setPhotoSrc(cv.toDataURL("image/jpeg", 0.82));
      setCaption("");
      setMode("photo");
    } catch { /* photo load nahi hui */ } finally {
      URL.revokeObjectURL(url);
    }
  };

  const sendPhoto = async () => {
    if (!photoSrc || sending) return;
    setSending(true);
    const ok = await postStatus(caption, { src: photoSrc });
    setSending(false);
    if (ok) { setMode("none"); setPhotoSrc(""); setCaption(""); }
  };

  const sendText = async () => {
    if (!textBody.trim() || sending) return;
    setSending(true);
    const ok = await postStatus(textBody, { bg: textBg });
    setSending(false);
    if (ok) { setMode("none"); setTextBody(""); }
  };

  const onDeleteCurrent = async () => {
    if (!vItem || !vGroup || !viewer) return;
    const id = vItem.id;
    const wasLastInGroup = viewer.idx >= vGroup.items.length - 1;
    const groupLen = vGroup.items.length;
    await deleteStatus(id);
    setViewersOpen(false);
    if (groupLen <= 1) {
      if (vGroupIdx + 1 < allGroups.length) setViewer({ userId: allGroups[vGroupIdx + 1].userId, idx: 0 });
      else setViewer(null);
    } else if (wasLastInGroup) {
      setViewer({ userId: viewer.userId, idx: viewer.idx - 1 });
    }
    // warna same idx agle status ko dikhayega
  };

  const openViewer = (userId: string) => { setViewersOpen(false); setViewer({ userId, idx: 0 }); };
  const closeViewer = () => { setViewer(null); setViewersOpen(false); };

  const firstMine = myItems[0];

  return (
    <div className="glass relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl">
      <header className="flex shrink-0 items-center gap-3 border-b border-black/10 px-4 py-3.5">
        <h2 className="text-[15px] font-extrabold text-[#2f3035]">Status</h2>
        <span className="text-xs text-[#80848e]">24 ghante me khatam ho jata hai</span>
        <button onClick={() => patchUI({ tab: "chat" })} className="ml-auto rounded-lg p-1.5 text-[#5c5e66] hover:bg-black/5" aria-label="Band karo">
          <X size={20} />
        </button>
      </header>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {/* ── Mera Status ── */}
        <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#80848e]">Mera Status</p>
        {myItems.length === 0 ? (
          <button
            onClick={() => setMode("text")}
            className="flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-white p-3 text-left soft-shadow hover:bg-black/[0.02]"
          >
            <span className="relative shrink-0">
              {me && <Avatar m={me} size={44} meId={meId} role={me.role} />}
              <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-[#23a55a] text-white">
                <Plus size={12} strokeWidth={3} />
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-[#2f3035]">Mera Status</span>
              <span className="block truncate text-[13px] text-[#80848e]">Tap karke status lagao</span>
            </span>
          </button>
        ) : (
          <button
            onClick={() => openViewer(meId)}
            className="flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-white p-3 text-left soft-shadow hover:bg-black/[0.02]"
          >
            {firstMine?.src ? (
              <img src={firstMine.src} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" draggable={false} />
            ) : (
              <span
                className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full px-1 text-center text-[10px] font-bold leading-tight text-white"
                style={{ background: firstMine?.bg || "#5865f2" }}
              >
                {(firstMine?.body || "").slice(0, 18)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-[#2f3035]">Mera Status</span>
              <span className="flex items-center gap-1.5 truncate text-[13px] text-[#80848e]">
                <Clock size={13} className="shrink-0" />
                {myItems.length} status · {firstMine ? remainingLabel(firstMine.at) : ""}
              </span>
            </span>
            <span className="shrink-0 text-[13px] text-[#80848e]">{firstMine ? fmtTime(firstMine.at) : ""}</span>
          </button>
        )}

        {/* ── Add Status composer ── */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-bold text-[#2f3035] soft-shadow hover:bg-black/[0.02]"
          >
            <Camera size={17} className="text-[#5865f2]" /> 📷 Photo
          </button>
          <button
            onClick={() => setMode(mode === "text" ? "none" : "text")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold soft-shadow ${mode === "text" ? "border-[#5865f2] bg-[#5865f2]/10 text-[#5865f2]" : "border-black/10 bg-white text-[#2f3035] hover:bg-black/[0.02]"}`}
          >
            ✍️ Text
          </button>
          <input ref={fileRef} hidden type="file" accept="image/*" onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
        </div>

        {mode === "photo" && photoSrc && (
          <div className="pop-in mt-3 rounded-2xl border border-black/10 bg-white p-3 soft-shadow">
            <img src={photoSrc} alt="" className="max-h-64 w-full rounded-xl object-contain bg-black/[0.03]" draggable={false} />
            <div className="mt-3 flex items-center gap-2">
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Caption likho (optional)…"
                maxLength={200}
                className="field min-w-0 flex-1 px-3.5 py-2.5 text-[15px]"
              />
              <button onClick={() => { setMode("none"); setPhotoSrc(""); }} className="rounded-lg p-2.5 text-[#80848e] hover:bg-black/5" aria-label="Cancel">
                <X size={18} />
              </button>
              <button onClick={() => void sendPhoto()} disabled={sending} className="btn btn-blurple flex items-center gap-1.5 px-4 py-2.5 text-sm disabled:opacity-50">
                <Send size={15} /> Bhejo
              </button>
            </div>
          </div>
        )}

        {mode === "text" && (
          <div className="pop-in mt-3 rounded-2xl border border-black/10 bg-white p-3 soft-shadow">
            <div
              className="grid min-h-[150px] place-items-center rounded-xl px-5 py-6 text-center transition-colors"
              style={{ background: textBg }}
            >
              <span className="whitespace-pre-wrap break-words text-xl font-extrabold leading-snug text-white">
                {textBody.trim() || "Apna status likho…"}
              </span>
            </div>
            <textarea
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
              placeholder="Status likho…"
              maxLength={300}
              rows={2}
              autoFocus
              className="field mt-3 w-full resize-none px-3.5 py-2.5 text-[15px]"
            />
            <div className="mt-3 flex items-center gap-2">
              {BG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setTextBg(c)}
                  className="h-8 w-8 shrink-0 rounded-full transition"
                  style={{ background: c, boxShadow: textBg === c ? "0 0 0 2px #fff, 0 0 0 4px #2f3035" : "0 0 0 1px rgba(0,0,0,0.12)" }}
                  aria-label={`Rang ${c}`}
                />
              ))}
              <button onClick={() => void sendText()} disabled={sending || !textBody.trim()} className="btn btn-blurple ml-auto flex items-center gap-1.5 px-4 py-2.5 text-sm disabled:opacity-50">
                <Send size={15} /> Bhejo
              </button>
            </div>
          </div>
        )}

        {/* ── Doston ke updates ── */}
        <p className="px-1 pb-2 pt-5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#80848e]">Doston ke updates</p>
        {otherGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-8 text-center">
            <p className="text-sm font-bold text-[#2f3035]">Abhi kisi dost ne status nahi lagaya</p>
            <p className="mt-1 text-[13px] text-[#80848e]">Pehle tum hi lagao, dost dekh kar lagayenge 😊</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {otherGroups.map((g) => {
              const member = members.find((m) => m.id === g.userId);
              const latest = g.items[g.items.length - 1];
              const unseen = g.items.some((s) => !s.readBy.includes(meId));
              return (
                <button
                  key={g.userId}
                  onClick={() => openViewer(g.userId)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-white p-3 text-left soft-shadow hover:bg-black/[0.02]"
                >
                  <RingAvatar
                    m={{ id: member?.id || g.userId, name: member?.name || "Member", avatar: member?.avatar, online: !!member?.online, privacy: member?.privacy }}
                    items={g.items}
                    size={44}
                    meId={meId}
                    role={member?.role}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-[#2f3035]">{member?.name || "Member"}</span>
                    <span className="block truncate text-[13px] text-[#80848e]">
                      {g.items.length} status{unseen ? " · naya hai" : ""} · {latest ? fmtTime(latest.at) : ""}
                    </span>
                  </span>
                  <ChevronRight size={17} className="shrink-0 text-[#80848e]" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── VIEWER (full-screen media viewer) ── */}
      {viewer && vGroup && vItem && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black/90">
          {/* progress segments */}
          <div className="flex shrink-0 gap-1.5 px-3 pt-3">
            {vGroup.items.map((s, i) => (
              <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
                <span className="block h-full rounded-full bg-white" style={{ width: i <= (viewer.idx >= vGroup.items.length ? vGroup.items.length - 1 : viewer.idx) ? "100%" : "0%" }} />
              </span>
            ))}
          </div>

          {/* header */}
          <div className="flex shrink-0 items-center gap-2.5 px-3 py-3">
            <Avatar
              m={{ id: vMember?.id || vGroup.userId, name: vMember?.name || "Member", avatar: vMember?.avatar, online: !!vMember?.online, privacy: vMember?.privacy }}
              size={38}
              meId={meId}
              role={vMember?.role}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-bold text-white">{isMine ? "Mera Status" : vMember?.name || "Member"}</span>
              <span className="block text-xs text-white/60">{fmtTime(vItem.at)} · {remainingLabel(vItem.at)}</span>
            </span>
            <button onClick={closeViewer} className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Band karo">
              <X size={22} />
            </button>
          </div>

          {/* body + tap zones */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
            <button onClick={goPrev} className="absolute inset-y-0 left-0 z-[1] w-1/3 cursor-default" aria-label="Pichla status" />
            <button onClick={goNext} className="absolute inset-y-0 right-0 z-[1] w-1/3 cursor-default" aria-label="Agla status" />
            <ChevronLeft size={26} className="pointer-events-none absolute left-2 top-1/2 z-[2] -translate-y-1/2 text-white/40" />
            <ChevronRight size={26} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/40" />

            <div className="pointer-events-none relative z-[2] flex max-h-full w-full max-w-md flex-col items-center">
              {vItem.src ? (
                <>
                  <img src={vItem.src} alt="" className="max-h-[78vh] w-auto max-w-full rounded-2xl object-contain" draggable={false} />
                  {vItem.body && <p className="mt-3 max-w-full whitespace-pre-wrap break-words text-center text-[15px] font-medium text-white">{vItem.body}</p>}
                </>
              ) : (
                <div
                  className="grid min-h-[300px] w-full place-items-center rounded-2xl px-6 py-10 text-center"
                  style={{ background: vItem.bg || "#5865f2", maxHeight: "78vh" }}
                >
                  <span className="whitespace-pre-wrap break-words text-2xl font-extrabold leading-snug text-white">{vItem.body}</span>
                </div>
              )}
            </div>
          </div>

          {/* footer — sirf apne status par viewers + delete */}
          {isMine && (
            <div className="relative z-[3] flex shrink-0 items-center justify-center gap-2 px-4 pb-5">
              <button
                onClick={() => setViewersOpen(true)}
                className="flex items-center gap-2 rounded-full bg-white/12 px-4 py-2.5 text-sm font-bold text-white backdrop-blur hover:bg-white/20"
                style={{ background: "rgba(255,255,255,0.14)" }}
              >
                <Eye size={17} /> {vItem.readBy.length} ne dekha
              </button>
              <button
                onClick={() => void onDeleteCurrent()}
                className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
                style={{ background: "#ed4245" }}
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
          )}

          {/* viewers sheet */}
          {viewersOpen && (
            <div className="absolute inset-0 z-[4] flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setViewersOpen(false)}>
              <div
                className="pop-in max-h-[65vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 soft-shadow sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-2">
                  <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-[#2f3035]"><Eye size={17} className="text-[#5865f2]" /> Dekhne wale</h3>
                  <button onClick={() => setViewersOpen(false)} className="rounded-lg p-1.5 text-[#80848e] hover:bg-black/5" aria-label="Band karo">
                    <X size={18} />
                  </button>
                </div>
                {vItem.readBy.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[#80848e]">Abhi kisi ne nahi dekha</p>
                ) : (
                  <div className="space-y-1">
                    {vItem.readBy.map((uid) => {
                      const vm = members.find((m) => m.id === uid);
                      if (!vm) return null;
                      return (
                        <div key={uid} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-black/[0.03]">
                          <Avatar m={vm} size={38} meId={meId} role={vm.role} />
                          <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#2f3035]">{vm.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
