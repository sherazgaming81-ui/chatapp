"use client";
// ═══════════════════════════════════════════════════════════════════════════
// Notifications center — bell + panel. Items lib/notifications.ts se atay
// hain (asal CRM events only). Badge = last-seen timestamp se naye items.
// Click → mutaliqa HQ tab (Posting / CRM / Report) khulta hai.
// Owner-only: ServerRail me sirf owner ko render hota hai, HQ page khud
// owner-only hai.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, XCircle, CheckCircle2, UserPlus, BarChart3, CheckCheck, AlertTriangle, Clock, CalendarClock } from "lucide-react";
import { patchUI } from "@/lib/store";
import { subscribeCrm } from "@/lib/crm";
import { fetchNotifications, getNotifSeenAt, setNotifSeenAt, type NotifItem, type NotifKind } from "@/lib/notifications";

const KIND_ICON: Record<NotifKind, { icon: any; cls: string }> = {
  failed_post: { icon: XCircle, cls: "text-[#ff8589]" },
  partner_posted: { icon: CheckCircle2, cls: "text-[#4ade80]" },
  new_contact: { icon: UserPlus, cls: "text-[#8dbcff]" },
  daily_report: { icon: BarChart3, cls: "text-[#fbbf24]" },
  task_overdue: { icon: AlertTriangle, cls: "text-[#ff8589]" },
  task_today: { icon: Clock, cls: "text-[#fbbf24]" },
  followup_today: { icon: CalendarClock, cls: "text-[#8dbcff]" },
};

export function relTime(at: number): string {
  const diff = Date.now() - at;
  if (diff < 60e3) return "just now";
  const m = Math.floor(diff / 60e3);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(at).toLocaleDateString();
}

export default function NotificationsBell({ placement }: { placement: "rail" | "header" }) {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<number>(() => getNotifSeenAt());
  const timer = useRef<any>(null);

  const load = useCallback(async () => {
    setItems(await fetchNotifications());
  }, []);

  useEffect(() => {
    load();
    const off = subscribeCrm(() => {
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 500);
    });
    const iv = setInterval(load, 60e3);
    return () => {
      off();
      clearInterval(iv);
      clearTimeout(timer.current);
    };
  }, [load]);

  const unseen = items.filter((i) => i.at > seenAt).length;

  const markAllSeen = () => {
    const now = Date.now();
    setNotifSeenAt(now);
    setSeenAt(now);
  };

  const go = (item: NotifItem) => {
    setOpen(false);
    patchUI({
      tab: "hq",
      hqNav: { section: item.section, contactId: item.contactId, nonce: Date.now() },
    });
  };

  const panel =
    placement === "rail"
      ? "fixed bottom-4 left-24 top-auto"
      : "absolute right-0 top-[calc(100%+10px)]";

  return (
    <div className={placement === "header" ? "relative shrink-0" : ""}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative grid place-items-center rounded-full text-[#b6bcc7] transition hover:bg-white/[0.06] hover:text-[#f4f6f8] ${placement === "rail" ? "h-12 w-12" : "h-10 w-10"}`}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={placement === "rail" ? 21 : 19} />
        {unseen > 0 && (
          <span className="unread-pop absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ed4245] px-1 text-[10px] font-extrabold text-white ring-2 ring-[#141C2B]">
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />
          <div className={`pop-in glass-strong z-[90] w-[320px] max-w-[88vw] overflow-hidden rounded-2xl ${panel}`}>
            <div className="flex items-center justify-between border-b border-[#27334D] px-4 py-3">
              <p className="text-sm font-extrabold text-[#f4f6f8]">Notifications</p>
              {items.length > 0 && (
                <button onClick={markAllSeen} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-[#8dbcff] hover:bg-white/[0.06]">
                  <CheckCheck size={14} /> Mark all as seen
                </button>
              )}
            </div>
            <div className="thin-scroll max-h-[380px] overflow-y-auto p-1.5">
              {items.length === 0 ? (
                <p className="px-3 py-8 text-center text-[13px] text-[#93A0B4]">
                  Nothing yet — failed posts, partner completions, new contacts, overdue tasks, follow-ups and daily reports will show up here.
                </p>
              ) : (
                items.map((item) => {
                  const K = KIND_ICON[item.kind];
                  const fresh = item.at > seenAt;
                  return (
                    <button
                      key={item.id}
                      onClick={() => go(item)}
                      className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.05]"
                    >
                      <K.icon size={17} className={`mt-0.5 shrink-0 ${K.cls}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[13px] leading-snug ${fresh ? "font-bold text-[#f4f6f8]" : "font-medium text-[#b6bcc7]"}`}>{item.text}</span>
                        <span className="mt-0.5 block text-[11px] font-semibold text-[#93A0B4]">{relTime(item.at)}</span>
                      </span>
                      {fresh && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#4f8cff]" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
