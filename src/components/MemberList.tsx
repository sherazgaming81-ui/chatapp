"use client";
import { useStore, patchUI } from "@/lib/store";
import { Avatar, Badge, fmtLastSeen } from "@/components/ui";

export default function MemberList() {
  const members = useStore((s) => s.members);
  const show = useStore((s) => s.ui.showMembers);
  const meId = useStore((s) => s.me);
  if (!show) return null;

  const visible = members.filter((m) => !m.banned);
  const owner = visible.filter((m) => m.role === "owner");
  const staff = visible.filter((m) => m.role === "admin" || m.role === "mod");
  const online = visible.filter((m) => m.role === "member" && m.online);
  const offline = visible.filter((m) => m.role === "member" && !m.online);

  const Group = ({ title, list }: { title: string; list: typeof visible }) =>
    list.length === 0 ? null : (
      <div className="mb-5">
        <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#80848e]">{title} — {list.length}</p>
        {list.map((m) => (
          <button key={m.id} onClick={() => patchUI({ profileId: m.id })} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-black/5">
            <Avatar m={m} size={32} showDot />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[#2f3035]">{m.id === meId ? "Aap" : m.name}<Badge role={m.role} /></span>
              <span className="block truncate text-xs text-[#80848e]">{m.id === meId ? "Online" : m.online ? "Online" : fmtLastSeen(m.lastSeen)}</span>
            </span>
          </button>
        ))}
      </div>
    );

  return (
    <aside className="glass thin-scroll hidden w-60 shrink-0 overflow-y-auto rounded-2xl px-2 py-4 md:block">
      <Group title="Owner" list={owner} />
      <Group title="Staff" list={staff} />
      <Group title="Online" list={online} />
      <Group title="Offline" list={offline} />
    </aside>
  );
}
