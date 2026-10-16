"use client";
// Profile Studio — Nitro-style customization, sab free. 6 tabs + live preview.
import { useState } from "react";
import { motion } from "framer-motion";
import { X, Check, Sparkles, RotateCcw, Wand2 } from "lucide-react";
import { useStore, patchUI, toast } from "@/lib/store";
import { BANNERS, EFFECTS, FRAMES, NAME_STYLES } from "@/lib/profileAssets";
import { BADGES, getBadges } from "@/lib/achievements";
import { saveProfileStyle } from "@/lib/db";
import type { ProfileStyle } from "@/lib/types";
import { DEFAULT_PROFILE_STYLE } from "@/lib/types";
import ProfileCard, { FX } from "@/components/ProfileCard";

const TABS = [
  { v: "banner", l: "Banner" },
  { v: "effect", l: "Effects" },
  { v: "frame", l: "Frame" },
  { v: "name", l: "Naam style" },
  { v: "color", l: "Rang" },
  { v: "badge", l: "Badges" },
] as const;

type TabV = (typeof TABS)[number]["v"];
const COLS = ["#5865f2", "#2ccf8a", "#e8bd57", "#4cc3ff", "#ff6f91", "#c79bff", "#ff8a5c", "#9bdc5a"];

function Pick({ on, onClick, label, children }: { on: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`relative rounded-2xl border p-2 text-left transition ${on ? "border-[#e8bd57] bg-[#e8bd57]/10" : "border-black/10 bg-white hover:bg-black/[0.03]"}`}
    >
      {children}
      <p className="mt-1.5 px-1 text-xs font-semibold text-[#2f3035]">{label}</p>
      {on && (
        <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[#e8bd57] text-[#2a1d02]">
          <Check size={12} strokeWidth={4} />
        </span>
      )}
    </motion.button>
  );
}

export default function ProfileStudio() {
  const open = useStore((s) => s.ui.studioOpen);
  const m = useStore((s) => s.members.find((x) => x.id === s.me));
  const [tab, setTab] = useState<TabV>("banner");
  const [st, setSt] = useState<ProfileStyle>(m?.style ?? DEFAULT_PROFILE_STYLE);
  const [saving, setSaving] = useState(false);

  if (!open || !m) return null;
  const close = () => patchUI({ studioOpen: false });
  const base: ProfileStyle = m.style ?? DEFAULT_PROFILE_STYLE;
  const dirty = JSON.stringify(st) !== JSON.stringify(base);
  const earned = getBadges(); // unlocked badge ids
  const set = (p: Partial<ProfileStyle>) => {
    setSt((s) => ({ ...s, ...p }));
    try { navigator.vibrate?.(6); } catch { /* ignore */ }
  };

  const save = async () => {
    setSaving(true);
    await saveProfileStyle(m.id, st);
    setSaving(false);
    close();
    toast("Profile saj gayi ✨", "Ab sab ko aisi hi dikhegi");
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" onClick={close} />
      <div className="pop-in fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[560px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white soft-shadow">
        {/* header */}
        <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-5 py-3.5">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-extrabold text-[#2f3035]">
              <Sparkles size={18} className="text-[#e8bd57]" /> Profile Studio
            </h3>
            <p className="text-xs text-[#80848e]">Apni profile ko sajao — sab kuch free</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={!dirty || saving} className="btn btn-blurple px-4 py-2 text-sm disabled:opacity-40">
              {saving ? "Save…" : "Save"}
            </button>
            <button onClick={close} className="rounded-full p-2 text-[#80848e] hover:bg-black/5"><X size={18} /></button>
          </div>
        </div>
        {/* live preview (sticky) */}
        <div className="shrink-0 border-b border-black/10 bg-[#f6f7f9] px-4 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#e8bd57]">
            <Wand2 size={13} /> Live preview
          </p>
          <div className="mx-auto max-w-[380px]">
            <ProfileCard m={m} style={st} />
          </div>
        </div>
        {/* tabs */}
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-black/10 px-4 py-2">
          {TABS.map((t) => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition ${tab === t.v ? "bg-[#5865f2] text-white" : "text-[#80848e] hover:bg-black/5"}`}
            >
              {t.l}
            </button>
          ))}
        </div>
        {/* tab content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "banner" && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {BANNERS.map((b) => (
                <Pick key={b.id} on={st.banner === b.id} onClick={() => set({ banner: b.id })} label={b.name}>
                  <div className={`h-14 rounded-lg ${b.anim ? "banner-anim" : ""}`} style={{ background: b.css, backgroundSize: b.anim ? "200% 200%" : undefined }} />
                </Pick>
              ))}
            </div>
          )}
          {tab === "effect" && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {EFFECTS.map((e) => (
                <Pick key={e.id} on={st.effect === e.id} onClick={() => set({ effect: e.id })} label={e.name}>
                  <div className="relative h-14 overflow-hidden rounded-lg bg-gradient-to-br from-[#eef1f4] to-[#dfe3ea]">
                    <FX id={e.id} />
                  </div>
                </Pick>
              ))}
            </div>
          )}
          {tab === "frame" && (
            <div className="grid grid-cols-3 gap-3">
              {FRAMES.map((f) => (
                <Pick key={f.id} on={st.frame === f.id} onClick={() => set({ frame: f.id })} label={f.name}>
                  <div className="grid h-16 place-items-center">
                    <span
                      className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#5865f2] to-[#9b7bff] font-bold text-white"
                      style={{ boxShadow: f.css === "none" ? undefined : f.css }}
                    >
                      {(m.name || "?")[0]?.toUpperCase()}
                    </span>
                  </div>
                </Pick>
              ))}
            </div>
          )}
          {tab === "name" && (
            <div className="grid grid-cols-2 gap-3">
              {NAME_STYLES.map((n) => (
                <Pick key={n.id} on={st.nameStyle === n.id} onClick={() => set({ nameStyle: n.id })} label={n.name}>
                  <p
                    className="py-2 text-center text-lg font-extrabold"
                    style={n.css ? { backgroundImage: n.css, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : { color: "#2f3035" }}
                  >
                    {m.name}
                  </p>
                </Pick>
              ))}
            </div>
          )}
          {tab === "color" && (
            <div>
              <p className="mb-3 text-sm text-[#80848e]">Profile ka khaas rang (shadow aur glow ke liye)</p>
              <div className="flex flex-wrap gap-3">
                {COLS.map((c) => (
                  <button
                    key={c}
                    onClick={() => set({ accent: c })}
                    className={`grid h-11 w-11 place-items-center rounded-full border-2 transition ${st.accent === c ? "scale-110 border-[#2f3035]" : "border-transparent"}`}
                    style={{ background: c }}
                    aria-label={c}
                  >
                    {st.accent === c && <Check size={18} className="text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>
          )}
          {tab === "badge" && (
            <div>
              <p className="mb-3 text-sm text-[#80848e]">Zyada se zyada 4 badges dikhao ({st.badges.length}/4)</p>
              {earned.length === 0 && <p className="text-sm text-[#80848e]">Abhi koi badge unlock nahi hua — achievements se kamao! 🏅</p>}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {earned.map((bid) => {
                  const info = BADGES.find((b) => b.id === bid);
                  if (!info) return null;
                  const on = st.badges.includes(bid);
                  return (
                    <button
                      key={bid}
                      onClick={() => set({ badges: on ? st.badges.filter((x) => x !== bid) : st.badges.length < 4 ? [...st.badges, bid] : st.badges })}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${on ? "border-[#e8bd57] bg-[#e8bd57]/10" : "border-black/10 bg-white"}`}
                    >
                      <span className="text-2xl">{info.icon}</span>
                      <span>
                        <span className="block text-sm font-bold text-[#2f3035]">{info.title}</span>
                        <span className="block text-[11px] text-[#80848e]">{info.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <button onClick={() => setSt(base)} className="btn btn-ghost mt-6 flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">
            <RotateCcw size={15} /> Wapas purani karo
          </button>
        </div>
      </div>
    </>
  );
}
