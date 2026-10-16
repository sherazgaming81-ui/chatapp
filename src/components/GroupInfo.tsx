"use client";
// D1 Group Info Page + D11 Insights + D12 Rules — slide-over panel
import { useEffect, useMemo, useRef, useState } from "react";
import {
  X, ChevronLeft, Pencil, Check, Images, FolderOpen, ScrollText,
  BarChart3, Camera, ShieldCheck, PartyPopper,
} from "lucide-react";
import { useStore, patchUI, toast } from "@/lib/store";
import {
  getGroupInsights, getChatCounts, setGroupDesc, setGroupRules, setGroupPhoto,
  getWelcomeEnabled, setWelcomeEnabled,
  type GroupInsights,
} from "@/lib/db";
import { Avatar, Badge, fmtTime, fmtFull, nameColor } from "@/components/ui";
import { isStaff } from "@/lib/types";
import MediaGallery from "@/components/MediaGallery";

function downscale(file: File, max = 512): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = rej;
    img.src = url;
  });
}

function fmtHour(h: number): string {
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${hh} ${ap}`;
}

function Insights({ chatId }: { chatId: string }) {
  const [ins, setIns] = useState<GroupInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const members = useStore((s) => s.members);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getGroupInsights(chatId).then((r) => { if (live) { setIns(r); setLoading(false); } });
    return () => { live = false; };
  }, [chatId]);

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name || "Member";

  return (
    <section className="rounded-2xl border border-black/[0.07] bg-white/60 p-4">
      <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#2f3035]">
        <BarChart3 size={16} className="text-[#5865f2]" /> Insights
        <span className="badge-pill" style={{ background: "#23a55a22", color: "#1a7a55" }}>live</span>
      </h3>
      {loading && <p className="mt-3 text-xs text-[#80848e]">Gin raha hoon… ⏳</p>}
      {!loading && (!ins || ins.total < 10) && (
        <p className="mt-3 text-xs leading-relaxed text-[#80848e]">📊 Abhi data jama ho raha hai — kuch din baad yahan insights dikhenge.</p>
      )}
      {!loading && ins && ins.total >= 10 && (
        <div className="mt-3 space-y-4">
          <div>
            <p className="mb-2 text-xs font-bold text-[#80848e]">Messages / din (aakhri 7 din)</p>
            <div className="flex h-28 items-end gap-1.5">
              {ins.perDay.map((d) => {
                const max = Math.max(1, ...ins.perDay.map((x) => x.count));
                return (
                  <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[10px] font-extrabold tabular-nums text-[#5865f2]">{d.count > 0 ? d.count : ""}</span>
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-[#5865f2] to-[#9b7bff]"
                      style={{ height: `${Math.max(5, (d.count / max) * 88)}px` }}
                      title={`${d.label}: ${d.count}`}
                    />
                    <span className="truncate text-[10px] font-semibold text-[#80848e]">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-[#80848e]">Active hours ⚡</p>
            {(() => {
              const top = ins.perHour.map((c, h) => ({ h, c })).sort((a, b) => b.c - a.c).slice(0, 3).filter((x) => x.c > 0);
              return top.length === 0
                ? <p className="text-xs text-[#80848e]">—</p>
                : <p className="text-[13px] font-bold text-[#2f3035]">{top.map((t) => fmtHour(t.h)).join(" · ")}</p>;
            })()}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-[#80848e]">Top contributors 🏆</p>
            <div className="space-y-1.5">
              {ins.top.map((t, i) => {
                const m = members.find((x) => x.id === t.id);
                if (!m) return null;
                const max = Math.max(1, ins.top[0]?.count || 1);
                return (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="w-4 text-xs font-extrabold text-[#80848e]">{i + 1}</span>
                    <Avatar m={m} size={26} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold" style={{ color: nameColor(m) }}>{m.name}</span>
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/[0.07]">
                      <div className="h-full rounded-full bg-[#5865f2]" style={{ width: `${(t.count / max) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right text-xs font-extrabold tabular-nums text-[#2f3035]">{t.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-[#80848e]">7 din me <b className="text-[#2f3035]">{ins.total}</b> messages · <b className="text-[#2f3035]">{ins.media}</b> media</p>
        </div>
      )}
    </section>
  );
}

function RulesCard({ chatId, canEdit }: { chatId: string; canEdit: boolean }) {
  const rules = useStore((s) => s.groupRules[chatId]);
  const members = useStore((s) => s.members);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = () => { setText(rules?.text || ""); setEditing(true); };
  const save = async () => {
    setSaving(true);
    await setGroupRules(chatId, text.trim());
    setSaving(false);
    setEditing(false);
    toast("Rules save ho gaye", "Sab members ko foran dikhenge");
  };
  const byName = rules?.updatedBy ? members.find((m) => m.id === rules.updatedBy)?.name : "";

  return (
    <section className="rounded-2xl border border-[#b8860b]/25 bg-[#fffbe8] p-4">
      <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#2f3035]">
        <ScrollText size={16} className="text-[#b8860b]" /> Group Rules
        {canEdit && !editing && (
          <button onClick={startEdit} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[#b8860b] hover:bg-[#b8860b]/10">
            <Pencil size={13} /> Edit
          </button>
        )}
      </h3>
      {editing ? (
        <div className="mt-2">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={"1. Adab se baat karo\n2. …"}
            className="field w-full text-sm"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#80848e] hover:bg-black/5">Cancel</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-1 rounded-lg bg-[#b8860b] px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-50">
              <Check size={14} /> {saving ? "Save…" : "Save"}
            </button>
          </div>
        </div>
      ) : rules?.text ? (
        <div className="mt-2">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#2f3035]">{rules.text}</p>
          {(rules.updatedAt > 0) && (
            <p className="mt-2 text-[11px] text-[#80848e]">Aakhri tabdeeli: {fmtFull(rules.updatedAt)}{byName ? ` · ${byName}` : ""}</p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-[#80848e]">
          {canEdit ? "Abhi koi rules nahi — Edit dabakar likho ✍️" : "Abhi koi rules nahi hain."}
        </p>
      )}
    </section>
  );
}

/* ───────── F9 — auto welcome message toggle (staff only) ───────── */
function WelcomeToggle({ chatId }: { chatId: string }) {
  const [on, setOn] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { getWelcomeEnabled(chatId).then(setOn).catch(() => {}); }, [chatId]);
  const toggle = async () => {
    setBusy(true);
    const next = !on;
    await setWelcomeEnabled(chatId, next);
    setOn(next);
    setBusy(false);
    toast(next ? "Welcome message on 🎉" : "Welcome message off", next ? "Naye members ko khush amdeed milegi" : "");
  };
  return (
    <section className="flex items-center gap-3 rounded-2xl border border-black/[0.07] bg-white/60 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#23a55a]/10 text-[#1a7a55]">
        <PartyPopper size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-[#2f3035]">Welcome message</p>
        <p className="text-xs text-[#80848e]">Naye member par auto khush amdeed</p>
      </div>
      <button
        onClick={toggle} disabled={busy}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-[#23a55a]" : "bg-black/20"} disabled:opacity-60`}
        aria-label="Welcome toggle"
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
      </button>
    </section>
  );
}

function Panel({ chatId, view }: { chatId: string; view: "info" | "media" | "files" }) {
  const chats = useStore((s) => s.chats);
  const members = useStore((s) => s.members);
  const messages = useStore((s) => s.messages);
  const meId = useStore((s) => s.me);
  const desc = useStore((s) => s.groupDescs[chatId] || "");
  const chat = chats.find((c) => c.id === chatId);
  const me = members.find((m) => m.id === meId);
  const canEdit = isStaff(me);

  const [counts, setCounts] = useState({ messages: 0, media: 0 });
  const [editDesc, setEditDesc] = useState(false);
  const [descText, setDescText] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    getChatCounts(chatId).then((c) => { if (live) setCounts(c); });
    return () => { live = false; };
  }, [chatId]);

  const sorted = useMemo(
    () => [...members].sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name)),
    [members]
  );
  const photos = useMemo(
    () => messages.filter((m) => m.chatId === chatId && m.type === "image" && m.src && !m.deleted).slice(-6).reverse(),
    [messages, chatId]
  );

  if (!chat) return null;
  const close = () => patchUI({ groupInfo: null });
  const setView = (v: "info" | "media" | "files") => patchUI({ groupInfo: { chatId, view: v } });

  const saveDesc = async () => {
    setSavingDesc(true);
    await setGroupDesc(chatId, descText.trim());
    setSavingDesc(false);
    setEditDesc(false);
    toast("Description save ho gayi");
  };
  const pickPhoto = async (f?: File | null) => {
    if (!f) return;
    try {
      const url = await downscale(f);
      await setGroupPhoto(chatId, url);
      toast("Group photo update ho gayi 📷");
    } catch { toast("Photo nahi lagi", "Dobara koshish karo"); }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] sm:hidden" onClick={close} />
      <aside className="slide-in-right fixed bottom-0 right-0 top-0 z-40 flex w-full flex-col bg-[#f4f4f6] soft-shadow sm:w-[400px] sm:border-l sm:border-black/10">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-black/10 bg-white/80 px-3 backdrop-blur">
          {view !== "info" ? (
            <button onClick={() => setView("info")} className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5" aria-label="Wapas">
              <ChevronLeft size={20} />
            </button>
          ) : (
            <button onClick={close} className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5 sm:hidden" aria-label="Band karo">
              <X size={20} />
            </button>
          )}
          <h2 className="min-w-0 flex-1 truncate text-[16px] font-extrabold tracking-tight text-[#2f3035]">
            {view === "media" ? "Media" : view === "files" ? "Files" : "Group info"}
          </h2>
          <button onClick={close} className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5" aria-label="Band karo">
            <X size={20} />
          </button>
        </header>

        {view !== "info" ? (
          <MediaGallery chatId={chatId} mode={view} />
        ) : (
          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mx-auto max-w-md space-y-4">
              {/* photo + name */}
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  {chat.photo ? (
                    <img src={chat.photo} alt="" className="h-20 w-20 rounded-3xl object-cover soft-shadow" draggable={false} />
                  ) : (
                    <span className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-[#5865f2] to-[#9b7bff] text-3xl font-extrabold text-white soft-shadow">
                      {(chat.name || "G")[0]?.toUpperCase()}
                    </span>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => photoRef.current?.click()}
                      className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-[#5865f2] text-white soft-shadow transition active:scale-95"
                      aria-label="Photo badlo"
                    >
                      <Camera size={15} />
                    </button>
                  )}
                  <input ref={photoRef} hidden type="file" accept="image/*" onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xl font-extrabold tracking-tight text-[#2f3035]">{chat.name}</h3>
                  <p className="text-xs text-[#80848e]">Madrasa doston ka group 🕌</p>
                </div>
              </div>

              {/* description */}
              <section className="rounded-2xl border border-black/[0.07] bg-white/60 p-4">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#2f3035]">
                  About
                  {canEdit && !editDesc && (
                    <button onClick={() => { setDescText(desc); setEditDesc(true); }} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[#5865f2] hover:bg-[#5865f2]/10">
                      <Pencil size={13} /> Edit
                    </button>
                  )}
                </h3>
                {editDesc ? (
                  <div className="mt-2">
                    <textarea autoFocus value={descText} onChange={(e) => setDescText(e.target.value)} rows={3} placeholder="Group ke baare me likho…" className="field w-full text-sm" />
                    <div className="mt-2 flex justify-end gap-2">
                      <button onClick={() => setEditDesc(false)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#80848e] hover:bg-black/5">Cancel</button>
                      <button onClick={saveDesc} disabled={savingDesc} className="flex items-center gap-1 rounded-lg bg-[#5865f2] px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-50">
                        <Check size={14} /> {savingDesc ? "Save…" : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[#5c5e66]">{desc || <span className="text-[#a0a3ab]">Koi description nahi{canEdit ? " — Edit dabakar likho" : ""}.</span>}</p>
                )}
              </section>

              {/* counts */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { l: "Members", v: String(members.length) },
                  { l: "Messages", v: String(counts.messages) },
                  { l: "Media", v: String(counts.media) },
                ].map((s) => (
                  <div key={s.l} className="rounded-2xl border border-black/[0.07] bg-white/60 p-3 text-center">
                    <p className="text-lg font-extrabold tabular-nums text-[#2f3035]">{s.v}</p>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#80848e]">{s.l}</p>
                  </div>
                ))}
              </div>

              {/* media + files buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setView("media")} className="flex items-center justify-center gap-2 rounded-2xl bg-[#5865f2]/[0.08] p-3.5 text-sm font-extrabold text-[#5865f2] transition hover:bg-[#5865f2]/[0.14] active:scale-[0.98]">
                  <Images size={18} /> Media
                </button>
                <button onClick={() => setView("files")} className="flex items-center justify-center gap-2 rounded-2xl bg-[#23a55a]/[0.08] p-3.5 text-sm font-extrabold text-[#1a7a55] transition hover:bg-[#23a55a]/[0.14] active:scale-[0.98]">
                  <FolderOpen size={18} /> Files
                </button>
              </div>

              {/* media preview strip */}
              {photos.length > 0 && (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-[#2f3035]">Media preview</h3>
                    <button onClick={() => setView("media")} className="text-xs font-bold text-[#5865f2]">Sab dekho →</button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {photos.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { patchUI({ viewer: { msgId: m.id } }); }}
                        className="aspect-square overflow-hidden rounded-xl bg-black/[0.05] transition active:scale-95"
                      >
                        <img src={m.src} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* D12 rules */}
              <RulesCard chatId={chatId} canEdit={canEdit} />

              {/* F9 welcome message toggle (staff only) */}
              {canEdit && <WelcomeToggle chatId={chatId} />}

              {/* D11 insights */}
              <Insights chatId={chatId} />

              {/* members */}
              <section className="rounded-2xl border border-black/[0.07] bg-white/60 p-4">
                <h3 className="text-sm font-extrabold text-[#2f3035]">Members · {members.length}</h3>
                <div className="mt-2 max-h-72 space-y-0.5 overflow-y-auto thin-scroll">
                  {sorted.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => patchUI({ profileId: m.id })}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-black/[0.04] active:scale-[0.99]"
                    >
                      <Avatar m={m} size={36} showDot />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[14px] font-bold" style={{ color: nameColor(m) }}>{m.name}</span>
                          <Badge role={m.role} />
                        </span>
                        <span className="block text-[11px] text-[#80848e]">{m.online ? <span className="font-bold text-[#23a55a]">online</span> : m.about || "—"}</span>
                      </span>
                      {m.id === meId && <ShieldCheck size={15} className="shrink-0 text-[#5865f2]" />}
                    </button>
                  ))}
                </div>
              </section>
              <p className="pb-2 text-center text-[11px] text-[#a0a3ab]">ChatsApp · Madrasa Group 🕌</p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

export default function GroupInfo() {
  const gi = useStore((s) => s.ui.groupInfo);
  if (!gi) return null;
  return <Panel chatId={gi.chatId} view={gi.view} />;
}
