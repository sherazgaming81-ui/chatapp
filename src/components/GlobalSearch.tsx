"use client";
// ═══════════════════════════════════════════════════════════════════════════
// Command Center (Ctrl/Cmd+K) — actions + conversations + CRM contacts +
// messages + members, aik hi palette me. Har action asal state/navigation
// se wired hai; jo cheez asal me nahi ho sakti wo palette me hai hi nahi.
// Keyboard: ↑/↓ navigate, Enter select, Esc close. Mouse bhi chalta hai.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Search, MessageSquare, Users, Hash, UserPlus, Send, BarChart3, Briefcase, CornerDownLeft, ListTodo, TrendingUp } from "lucide-react";
import { useStore, patchUI } from "@/lib/store";
import { Avatar, fmtFull, nameColor } from "@/components/ui";
import { listContacts, KIND_LABEL, type CrmContact } from "@/lib/crm";
import type { ChatMeta, Member, Message } from "@/lib/types";

function Hi({ text, q }: { text: string; q: string }) {
  const t = text || "";
  if (!q.trim()) return <>{t.length > 90 ? t.slice(0, 90) + "…" : t}</>;
  const needle = q.trim().toLowerCase();
  const i = t.toLowerCase().indexOf(needle);
  if (i < 0) return <>{t.length > 90 ? t.slice(0, 90) + "…" : t}</>;
  const s = Math.max(0, i - 28);
  const e = Math.min(t.length, i + needle.length + 28);
  return (
    <>
      {(s > 0 ? "…" : "") + t.slice(s, i)}
      <mark className="rounded bg-[#4f8cff]/25 px-0.5 font-bold text-inherit">{t.slice(i, i + needle.length)}</mark>
      {t.slice(i + needle.length, e) + (e < t.length ? "…" : "")}
    </>
  );
}

type Item =
  | { kind: "action"; key: string; label: string; hint: string; icon: any; run: () => void }
  | { kind: "chat"; key: string; chat: ChatMeta; run: () => void }
  | { kind: "contact"; key: string; contact: CrmContact; run: () => void }
  | { kind: "message"; key: string; msg: Message; run: () => void }
  | { kind: "member"; key: string; member: Member; run: () => void };

interface Section {
  title: string;
  items: Item[];
}

export default function GlobalSearch() {
  const open = useStore((s) => s.ui.globalSearchOpen);
  const messages = useStore((s) => s.messages);
  const members = useStore((s) => s.members);
  const chats = useStore((s) => s.chats);
  const meId = useStore((s) => s.me);
  const isOwner = members.find((m) => m.id === meId)?.role === "owner";
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      // CRM contacts sirf owner ke liye load karo (RLS bhi owner-only hai)
      if (isOwner) listContacts().then(setContacts).catch(() => setContacts([]));
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  const close = () => patchUI({ globalSearchOpen: false });
  const nav = (patch: Parameters<typeof patchUI>[0]) => {
    close();
    patchUI(patch);
  };

  const sections = useMemo<Section[]>(() => {
    const needle = q.trim().toLowerCase();
    const out: Section[] = [];

    // ── Actions ──
    const actions: Item[] = [];
    if (isOwner) {
      actions.push(
        { kind: "action", key: "a-lead", label: "Add Lead", hint: "Business HQ · CRM — new contact form", icon: UserPlus, run: () => nav({ tab: "hq", hqNav: { section: "crm", newContact: true, nonce: Date.now() } }) },
        { kind: "action", key: "a-task", label: "Add Task", hint: "Business HQ · Tasks — new task form", icon: ListTodo, run: () => nav({ tab: "hq", hqNav: { section: "tasks", newContact: true, nonce: Date.now() } }) },
        { kind: "action", key: "a-post", label: "Create Post", hint: "Business HQ · Posting — queue a post", icon: Send, run: () => nav({ tab: "hq", hqNav: { section: "posting", nonce: Date.now() } }) },
        { kind: "action", key: "a-analytics", label: "Open Analytics", hint: "Business HQ · Analytics — KPIs & charts from real data", icon: TrendingUp, run: () => nav({ tab: "hq", hqNav: { section: "analytics", nonce: Date.now() } }) },
        { kind: "action", key: "a-report", label: "Open Daily Report", hint: "Business HQ · Reports", icon: BarChart3, run: () => nav({ tab: "hq", hqNav: { section: "report", nonce: Date.now() } }) },
        { kind: "action", key: "a-hq", label: "Open Business HQ", hint: "CRM · Outreach · Posting · Report", icon: Briefcase, run: () => nav({ tab: "hq" }) },
      );
    }
    actions.push({
      kind: "action", key: "a-group", label: "New Group", hint: "Create a new group chat", icon: Users,
      run: () => nav({ createGroupOpen: true }),
    });
    const shownActions = needle ? actions.filter((a) => a.kind === "action" && a.label.toLowerCase().includes(needle)) : actions;
    if (shownActions.length) out.push({ title: "Actions", items: shownActions });

    // ── Conversations ──
    const chatItems: Item[] = [...chats]
      .sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0))
      .filter((c) => !needle || c.name.toLowerCase().includes(needle))
      .slice(0, needle ? 8 : 6)
      .map((c) => ({
        kind: "chat" as const,
        key: `chat-${c.id}`,
        chat: c,
        run: () => nav({ tab: "chat", starredOpen: false, activeChatId: c.id, replyTo: null, mobileDrawer: "none" }),
      }));
    if (chatItems.length) out.push({ title: "Conversations", items: chatItems });

    // ── Contacts (CRM) ──
    if (isOwner && needle.length >= 1) {
      const contactItems: Item[] = contacts
        .filter((c) =>
          c.name.toLowerCase().includes(needle) ||
          (c.instagramUsername || "").toLowerCase().includes(needle) ||
          (c.email || "").toLowerCase().includes(needle)
        )
        .slice(0, 6)
        .map((c) => ({
          kind: "contact" as const,
          key: `contact-${c.id}`,
          contact: c,
          run: () => nav({ tab: "hq", hqNav: { section: "crm", contactId: c.id, nonce: Date.now() } }),
        }));
      if (contactItems.length) out.push({ title: "Contacts", items: contactItems });
    }

    // ── Messages ──
    if (needle.length >= 2) {
      const msgItems: Item[] = messages
        .filter((m) => !m.deleted && ((m.text || "").toLowerCase().includes(needle) || (m.caption || "").toLowerCase().includes(needle)))
        .slice(-10)
        .reverse()
        .map((m) => ({
          kind: "message" as const,
          key: `msg-${m.id}`,
          msg: m,
          run: () => nav({ tab: "chat", activeChatId: m.chatId, jumpToMsg: m.id, mobileDrawer: "none" }),
        }));
      if (msgItems.length) out.push({ title: "Messages", items: msgItems });

      // ── Members ──
      const memberItems: Item[] = members
        .filter((m) => m.name.toLowerCase().includes(needle))
        .slice(0, 6)
        .map((m) => ({
          kind: "member" as const,
          key: `member-${m.id}`,
          member: m,
          run: () => nav({ profileId: m.id }),
        }));
      if (memberItems.length) out.push({ title: "Members", items: memberItems });
    }

    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, chats, contacts, messages, members, isOwner]);

  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  useEffect(() => {
    setActive(0);
  }, [q, open]);

  useEffect(() => {
    if (active >= flat.length) setActive(Math.max(0, flat.length - 1));
  }, [flat.length, active]);

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const chatName = (id: string) => chats.find((c) => c.id === id)?.name || "Chat";
  const senderOf = (id: string) => members.find((m) => m.id === id);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[active]?.run();
    } else if (e.key === "Escape") {
      close();
    }
  };

  let idx = -1;
  const renderItem = (item: Item) => {
    idx += 1;
    const myIdx = idx;
    const isActive = myIdx === active;
    const cls = `flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${isActive ? "bg-[#4f8cff]/[0.14]" : "hover:bg-white/[0.05]"}`;
    const common = {
      "data-active": isActive,
      onMouseEnter: () => setActive(myIdx),
      onClick: () => item.run(),
      className: cls,
    } as const;

    if (item.kind === "action") {
      const Icon = item.icon;
      return (
        <button key={item.key} {...common}>
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg bg-[#4f8cff]/15 text-[#8dbcff]">
            <Icon size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-bold text-[#f4f6f8]">{item.label}</span>
            <span className="block truncate text-xs text-[#93A0B4]">{item.hint}</span>
          </span>
          {isActive && <CornerDownLeft size={14} className="mt-1 shrink-0 text-[#93A0B4]" />}
        </button>
      );
    }
    if (item.kind === "chat") {
      const other = item.chat.type === "dm" ? members.find((m) => m.id === item.chat.otherId) : undefined;
      return (
        <button key={item.key} {...common}>
          {other ? (
            <Avatar m={other} size={34} showDot />
          ) : (
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#4f8cff] to-[#3b76d6] text-white">
              <Hash size={16} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-bold text-[#f4f6f8]">{other?.name || item.chat.name}</span>
            <span className="block truncate text-xs text-[#93A0B4]">{item.chat.type === "group" ? "Group" : "Direct message"}</span>
          </span>
        </button>
      );
    }
    if (item.kind === "contact") {
      const c = item.contact;
      return (
        <button key={item.key} {...common}>
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[#4f8cff]/15 text-[13px] font-extrabold text-[#8dbcff]">
            {(c.name || "?").trim()[0]?.toUpperCase() || "?"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-[14px] font-bold text-[#f4f6f8]">{c.name || "—"}</span>
              <span className="shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#93A0B4]">{KIND_LABEL[c.kind]}</span>
            </span>
            <span className="block truncate text-xs text-[#93A0B4]">
              {[c.instagramUsername ? `@${c.instagramUsername}` : "", c.email || ""].filter(Boolean).join(" · ") || "CRM contact"}
            </span>
          </span>
        </button>
      );
    }
    if (item.kind === "message") {
      const m = item.msg;
      const s = senderOf(m.from);
      return (
        <button key={item.key} {...common}>
          {s ? <Avatar m={s} size={34} /> : <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-white/10 text-sm">?</span>}
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="truncate text-[13px] font-extrabold" style={{ color: s ? nameColor(s) : "#f4f6f8" }}>
                {s?.name || "Member"}
              </span>
              <span className="shrink-0 text-[11px] font-bold text-[#93A0B4]">{chatName(m.chatId)}</span>
              <span className="ml-auto shrink-0 text-[11px] text-[#93A0B4]">{fmtFull(m.at)}</span>
            </span>
            <span className="mt-0.5 block text-[13px] leading-snug text-[#b6bcc7]">
              <Hi text={m.text || m.caption || (m.type === "image" ? "📷 Photo" : m.type === "voice" ? "🎤 Voice" : m.type)} q={q} />
            </span>
          </span>
        </button>
      );
    }
    const m = item.member;
    return (
      <button key={item.key} {...common}>
        <Avatar m={m} size={34} showDot />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold" style={{ color: nameColor(m) }}>{m.name}</span>
          <span className="block truncate text-xs text-[#93A0B4]">{m.online ? <span className="font-bold text-[#23a55a]">online</span> : m.about || "Member"}</span>
        </span>
      </button>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={close} />
      <div className="pop-in glass-strong fixed left-1/2 top-[8%] z-50 w-[580px] max-w-[94vw] overflow-hidden rounded-2xl soft-shadow" role="dialog" aria-label="Command center">
        <div className="glass-bar flex items-center gap-2 border-b border-[#27334D] px-4 py-3">
          <Search size={18} className="shrink-0 text-[#8dbcff]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search or type a command…"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[#f4f6f8] outline-none placeholder:text-[#93A0B4]"
          />
          <kbd className="hidden shrink-0 rounded-md border border-[#27334D] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-bold text-[#93A0B4] sm:block">Ctrl K</kbd>
          <button onClick={close} className="rounded-lg p-1.5 text-[#93A0B4] hover:bg-white/[0.06]" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div ref={listRef} className="thin-scroll max-h-[58vh] min-h-[180px] overflow-y-auto p-2">
          {flat.length === 0 ? (
            <p className="flex flex-col items-center gap-2 px-3 py-10 text-center text-sm text-[#93A0B4]">
              <MessageSquare size={20} className="text-[#93A0B4]/60" />
              Nothing found — try a name, a contact, or a word from a message.
            </p>
          ) : (
            sections.map((sec) => (
              <div key={sec.title} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#93A0B4]">{sec.title}</p>
                {sec.items.map(renderItem)}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-[#27334D] px-4 py-2 text-[11px] font-semibold text-[#93A0B4]">
          <span>↑↓ Navigate</span>
          <span>Enter Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </>
  );
}
