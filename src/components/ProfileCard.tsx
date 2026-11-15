"use client";
// ProfileCard — saaf professional card (banner/effects/frames/badges wali
// sajawat business cleanup me remove ho gayi). Props API pehle jaisi hai:
// style prop ab ignore hota hai (purane callers na tooten).
import { Crown } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Member, ProfileStyle } from "@/lib/types";
import { Avatar, Badge, fmtLastSeen } from "@/components/ui";
import { visibleOnline, visibleLastSeen, visibleAbout } from "@/lib/prefs";

export default function ProfileCard({
  m,
  name,
  about,
  avatar,
  children,
}: {
  m: Member;
  style?: ProfileStyle; // legacy — ignore
  name?: string;
  about?: string;
  avatar?: string;
  children?: React.ReactNode;
}) {
  const meId = useStore((s) => s.me);
  const isMe = m.id === meId;

  const shown = { ...m, avatar: avatar ?? m.avatar };
  const online = isMe ? m.online : visibleOnline(meId, m);
  const lastSeen = isMe ? m.lastSeen : visibleLastSeen(meId, m);
  const aboutText = about ?? (isMe ? m.about : visibleAbout(meId, m));

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111114] soft-shadow">
      <div className="px-5 py-5">
        <div className="flex items-center gap-4">
          <Avatar m={shown} size={72} showDot meId={meId} role={m.role} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-xl font-extrabold leading-tight text-[#f4f6f8]">
                {name ?? m.name}
              </h3>
              <Badge role={m.role} />
              {m.role === "owner" && <Crown size={16} className="text-[#e8bd57]" />}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-[#8b93a1]">
              <span className={`h-2 w-2 rounded-full ${online ? "bg-[#23a55a]" : "bg-[#80848e]/50"}`} />
              {online ? "Online hai" : lastSeen > 0 ? fmtLastSeen(lastSeen) : "Offline"}
            </p>
          </div>
        </div>
        {aboutText ? (
          <div className="mt-4 rounded-xl bg-white/[0.04] p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8b93a1]">About</p>
            <p className="mt-0.5 text-[15px] text-[#f4f6f8]">{aboutText}</p>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
