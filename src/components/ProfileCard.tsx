"use client";
// Discord-Nitro-style ProfileCard + animated FX (light theme).
import { Crown } from "lucide-react";
import { useStore } from "@/lib/store";
import { BANNERS, FRAMES, NAME_STYLES } from "@/lib/profileAssets";
import { BADGES } from "@/lib/achievements";
import type { Member, ProfileStyle } from "@/lib/types";
import { DEFAULT_PROFILE_STYLE } from "@/lib/types";
import { Avatar, Badge, fmtLastSeen } from "@/components/ui";
import { visibleOnline, visibleLastSeen, visibleAbout } from "@/lib/prefs";

/** Animated banner effects */
export function FX({ id }: { id: string }) {
  if (!id || id === "none") return null;
  const n = id === "crescent" ? 0 : 14;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {id === "crescent" && (
        <svg viewBox="0 0 100 100" className="absolute -right-2 -top-2 h-24 w-24" style={{ animation: "fx-glow 3s infinite" }}>
          <path d="M64 14a38 38 0 1 0 22 68 30 30 0 1 1-22-68z" fill="#e8bd57" opacity=".9" />
        </svg>
      )}
      {Array.from({ length: n }).map((_, i) => {
        const l = (i * 41 + 7) % 96;
        const d = (i % 7) * 0.45;
        const dur = 2.5 + (i % 5) * 0.7;
        if (id === "sparkle")
          return <span key={i} className="absolute text-[#e8bd57]" style={{ left: `${l}%`, top: `${(i * 29) % 80}%`, fontSize: 8 + (i % 3) * 4, animation: `fx-twinkle ${dur}s ${d}s infinite` }}>✦</span>;
        if (id === "petals")
          return <span key={i} className="absolute h-2.5 w-1.5 rounded-[50%_0_50%_0] bg-[#ff9ab5]" style={{ left: `${l}%`, top: 0, animation: `fx-fall ${dur + 2}s ${d}s infinite linear` }} />;
        if (id === "fireflies")
          return <span key={i} className="absolute h-1.5 w-1.5 rounded-full bg-[#fff08a] shadow-[0_0_8px_#ffe94d]" style={{ left: `${l}%`, bottom: `${(i * 13) % 30}%`, animation: `fx-rise ${dur + 1}s ${d}s infinite` }} />;
        // rain
        return <span key={i} className="absolute h-0.5 w-5 rounded-full bg-white/80" style={{ left: `${l}%`, top: 0, transform: "rotate(65deg)", animation: `fx-fall ${dur}s ${d}s infinite linear` }} />;
      })}
    </div>
  );
}

function badgeInfo(id: string): { icon: string; name: string } {
  const b = BADGES.find((x) => x.id === id);
  return { icon: b?.icon ?? "🏅", name: b?.title ?? id };
}

export default function ProfileCard({
  m,
  style,
  name,
  about,
  avatar,
  children,
}: {
  m: Member;
  style?: ProfileStyle;
  name?: string;
  about?: string;
  avatar?: string;
  children?: React.ReactNode;
}) {
  const meId = useStore((s) => s.me);
  const st: ProfileStyle = style ?? m.style ?? DEFAULT_PROFILE_STYLE;
  const banner = BANNERS.find((b) => b.id === st.banner) ?? BANNERS[0];
  const ns = NAME_STYLES.find((x) => x.id === st.nameStyle);
  const frame = FRAMES.find((f) => f.id === st.frame);
  const isMe = m.id === meId;

  const shown = { ...m, avatar: avatar ?? m.avatar };
  const online = isMe ? m.online : visibleOnline(meId, m);
  const lastSeen = isMe ? m.lastSeen : visibleLastSeen(meId, m);
  const aboutText = about ?? (isMe ? m.about : visibleAbout(meId, m));

  return (
    <div
      className="overflow-hidden rounded-3xl border border-black/10 bg-white"
      style={{ boxShadow: `0 20px 50px -20px ${st.accent}66` }}
    >
      {/* Banner */}
      <div
        className={`relative h-28 ${banner.anim ? "banner-anim" : ""}`}
        style={{ background: banner.css, backgroundSize: banner.anim ? "200% 200%" : undefined }}
      >
        <FX id={st.effect} />
      </div>
      <div className="relative px-5 pb-5">
        <div className="-mt-12 flex items-end justify-between">
          <div className="rounded-full bg-white p-1.5">
            <span
              className="inline-block rounded-full"
              style={frame && frame.css !== "none" ? { boxShadow: frame.css } : undefined}
            >
              <Avatar m={shown} size={84} showDot meId={meId} />
            </span>
          </div>
          {st.badges.length > 0 && (
            <div className="mb-1 flex gap-1.5">
              {st.badges.slice(0, 4).map((b) => {
                const info = badgeInfo(b);
                return (
                  <span key={b} title={info.name} className="grid h-8 w-8 place-items-center rounded-full bg-black/[0.05] text-base shadow">
                    {info.icon}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h3
            className="text-xl font-extrabold leading-tight"
            style={ns?.css ? { backgroundImage: ns.css, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : { color: "#2f3035" }}
          >
            {name ?? m.name}
          </h3>
          <Badge role={m.role} />
          {m.role === "owner" && <Crown size={16} className="text-[#e8bd57]" />}
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-[#80848e]">
          <span className={`h-2 w-2 rounded-full ${online ? "bg-[#23a55a]" : "bg-[#80848e]/50"}`} />
          {online ? "Online hai" : lastSeen > 0 ? fmtLastSeen(lastSeen) : "Offline"}
        </p>
        {aboutText ? (
          <div className="mt-3 rounded-2xl bg-black/[0.04] p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#80848e]">About</p>
            <p className="mt-0.5 text-[15px] text-[#2f3035]">{aboutText}</p>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
