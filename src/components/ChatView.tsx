"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Hash, Menu, Users, Pin, Search, Globe, ChevronUp, ChevronDown, X } from "lucide-react";
import { getState, useStore, patchUI } from "@/lib/store";
import { markRead, loadOlderMessages, refreshChat } from "@/lib/db";
import { Avatar, fmtDayHeader } from "@/components/ui";
import { usePrefs, wallpaperStyle, isDoodleWallpaper } from "@/lib/prefs";
import MessageItem from "@/components/MessageItem";
import Composer from "@/components/Composer";
import MobileDrawers from "@/components/MobileDrawers";

const EMPTY_ARR: string[] = [];

/* 2 — skeleton shimmer rows (chat switch par) */
function ChatSkeleton() {
  return (
    <div className="space-y-4 px-4 py-3" aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const mine = i % 3 === 0;
        return (
          <div key={i} className={`flex gap-3 ${mine ? "justify-end" : ""}`}>
            {!mine && <div className="skel h-10 w-10 shrink-0 !rounded-full" />}
            <div className="min-w-0 flex-1 space-y-2" style={{ maxWidth: "75%" }}>
              {!mine && <div className="skel h-3 w-24" />}
              <div className="skel h-4 w-full" />
              <div className="skel h-4" style={{ width: `${55 + ((i * 37) % 30)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ChatView() {
  const chats = useStore((s) => s.chats);
  const messages = useStore((s) => s.messages);
  const members = useStore((s) => s.members);
  const meId = useStore((s) => s.me);
  const typing = useStore((s) => s.ui.typing);
  const activeChatId = useStore((s) => s.ui.activeChatId) || chats[0]?.id;
  const prefs = usePrefs();
  const activeChat = chats.find((c) => c.id === activeChatId);
  const isDM = activeChat?.type === "dm";
  const dmOther = isDM ? members.find((m) => m.id === activeChat?.otherId) : null;
  const sc = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(true);

  /* 19 — lazy load purane messages (upar scroll par) */
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  /* 2 — chat switch par skeleton shimmer */
  const [skel, setSkel] = useState(false);
  const prevChatRef = useRef(activeChatId);
  useEffect(() => {
    if (prevChatRef.current !== activeChatId) {
      prevChatRef.current = activeChatId;
      setSkel(true);
      setHasMore(true);
      const t = setTimeout(() => setSkel(false), 550);
      return () => clearTimeout(t);
    }
  }, [activeChatId]);

  /* 13 — pull to refresh (mobile) */
  const [ptrY, setPtrY] = useState<number | null>(null);
  const [ptrPull, setPtrPull] = useState(0);
  const [ptrBusy, setPtrBusy] = useState(false);
  const onTouchStartPTR = (e: React.TouchEvent) => {
    const el = sc.current;
    if (el && el.scrollTop <= 0) setPtrY(e.touches[0].clientY);
    else setPtrY(null);
  };
  const onTouchMovePTR = (e: React.TouchEvent) => {
    if (ptrY === null || ptrBusy) return;
    const d = e.touches[0].clientY - ptrY;
    if (d > 0) setPtrPull(Math.min(110, d));
  };
  const onTouchEndPTR = async () => {
    if (ptrY === null) return;
    const pulled = ptrPull;
    setPtrY(null); setPtrPull(0);
    if (pulled > 70 && activeChatId && !ptrBusy) {
      setPtrBusy(true);
      try { await refreshChat(activeChatId); } catch { /* ignore */ }
      setPtrBusy(false);
    }
  };

  const msgs = useMemo(
    () => messages.filter((m) => m.chatId === activeChatId && m.type !== "system"),
    [messages, activeChatId]
  );

  // A9 — unread divider: lastRead per chat in localStorage
  const [lastReadId, setLastReadId] = useState<string | null>(null);
  useEffect(() => {
    try { setLastReadId(localStorage.getItem(`chatsapp:lastRead:${activeChatId}`)); } catch { setLastReadId(null); }
  }, [activeChatId]);

  // A9/A11/A17 — mark read shortly after viewing (also syncs read_by)
  useEffect(() => {
    if (!activeChatId) return;
    const t = setTimeout(() => markRead(activeChatId), 1200);
    return () => clearTimeout(t);
  }, [activeChatId, msgs.length]);

  useEffect(() => {
    if (stick && sc.current) sc.current.scrollTop = sc.current.scrollHeight;
  }, [msgs.length, stick, activeChatId]);

  const onScroll = () => {
    const el = sc.current;
    if (!el) return;
    setStick(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
    /* 19 — bilkul upar pahunche to purane messages lao (scroll position bachao) */
    if (el.scrollTop < 80 && hasMore && !loadingMoreRef.current && activeChatId && msgs.length > 0) {
      loadingMoreRef.current = true;
      setLoadingMore(true);
      const prevH = el.scrollHeight;
      const oldest = msgs[0].at;
      loadOlderMessages(activeChatId, oldest).then((more) => {
        setHasMore(more);
        requestAnimationFrame(() => {
          const el2 = sc.current;
          if (el2) el2.scrollTop = el2.scrollHeight - prevH;
        });
        setLoadingMore(false);
        loadingMoreRef.current = false;
      });
    }
  };

  // A8 — group by day for sticky headers
  const sections = useMemo(() => {
    const out: { key: string; label: string; msgs: typeof msgs }[] = [];
    msgs.forEach((m) => {
      const d = new Date(m.at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      let s = out.find((x) => x.key === key);
      if (!s) { s = { key, label: fmtDayHeader(m.at), msgs: [] }; out.push(s); }
      s.msgs.push(m);
    });
    return out;
  }, [msgs]);

  // A9 — first unread position
  const unreadInfo = useMemo(() => {
    if (!lastReadId) return null;
    const idx = msgs.findIndex((m) => m.id === lastReadId);
    const rest = (idx === -1 ? msgs : msgs.slice(idx + 1)).filter(
      (m) => m.from !== meId && !m.deleted && m.type !== "system" && m.type !== "announcement"
    );
    if (rest.length === 0) return null;
    return { id: rest[0].id, count: rest.length };
  }, [msgs, lastReadId, meId]);

  // A5 — in-chat search
  const [searchOn, setSearchOn] = useState(false);
  const [q, setQ] = useState("");
  const [qIdx, setQIdx] = useState(0);
  const matchIds = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return msgs
      .filter((m) => !m.deleted && ((m.text || "").toLowerCase().includes(needle) || (m.caption || "").toLowerCase().includes(needle)))
      .map((m) => m.id);
  }, [msgs, q]);
  useEffect(() => { setQIdx(0); }, [q, activeChatId]);
  const jumpMatch = (dir: number) => {
    if (matchIds.length === 0) return;
    const n = (qIdx + dir + matchIds.length) % matchIds.length;
    setQIdx(n);
    jumpTo(matchIds[n]);
  };

  const typer = members.find((m) => m.id === typing[0]);
  const pinIds = useStore((s) => (activeChatId && s.pins[activeChatId]) || EMPTY_ARR);
  const pinnedMsgs = useMemo(
    () => pinIds.map((id) => messages.find((m) => m.id === id && !m.deleted)).filter(Boolean) as typeof messages,
    [pinIds, messages]
  );
  const [pinIdx, setPinIdx] = useState(0);
  const jumpTo = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1600);
    }
  };
  // I15 — global search se jump
  const jumpToMsg = useStore((s) => s.ui.jumpToMsg);
  useEffect(() => {
    if (!jumpToMsg) return;
    const t = setTimeout(() => {
      jumpTo(jumpToMsg);
      patchUI({ jumpToMsg: null });
    }, 450);
    return () => clearTimeout(t);
  }, [jumpToMsg]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="glass relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-black/10 px-3 sm:px-4">
        <button onClick={() => patchUI({ mobileDrawer: "channels" })} className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5 md:hidden" aria-label="Channels">
          <Menu size={20} />
        </button>
        {isDM ? (
          <>
            {dmOther ? <Avatar m={dmOther} size={28} showDot /> : <span className="grid h-7 w-7 place-items-center rounded-full bg-[#5865f2] text-sm font-bold text-white">@</span>}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[16px] font-extrabold tracking-tight text-[#2f3035]">{dmOther?.name || activeChat?.name}</h1>
            </div>
          </>
        ) : (
          <button
            onClick={() => activeChatId && patchUI({ groupInfo: { chatId: activeChatId, view: "info" } })}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-black/[0.04] active:scale-[0.99]"
            aria-label="Group info kholo"
          >
            <Hash size={20} className="shrink-0 text-[#80848e]" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[16px] font-extrabold tracking-tight text-[#2f3035]">{activeChat?.name || "Chat"}</h1>
              <p className="truncate text-xs text-[#80848e]">Group info ke liye tap karo 👆</p>
            </div>
          </button>
        )}
        {typer && (
          <span className="hidden items-center gap-1.5 text-xs font-semibold text-[#23a55a] sm:flex">
            <span className="flex gap-0.5"><i className="tdot h-1.5 w-1.5 rounded-full bg-current" /><i className="tdot h-1.5 w-1.5 rounded-full bg-current" /><i className="tdot h-1.5 w-1.5 rounded-full bg-current" /></span>
            {typer.name.split(" ")[0]} likh raha hai…
          </span>
        )}
        <button onClick={() => patchUI({ globalSearchOpen: true })} className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5" aria-label="Global search" title="Poori app me talash">
          <Globe size={20} />
        </button>
        <button onClick={() => setSearchOn((v) => !v)} className={`rounded-md p-2 hover:bg-black/5 ${searchOn ? "text-[#5865f2]" : "text-[#5c5e66]"}`} aria-label="Search">
          <Search size={20} />
        </button>
        <button onClick={() => patchUI({ mobileDrawer: "members" })} className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5 md:hidden" aria-label="Members">
          <Users size={20} />
        </button>
        <button onClick={() => { const s = getState(); patchUI({ showMembers: !s.ui.showMembers }); }} className="hidden rounded-md p-2 text-[#5c5e66] hover:bg-black/5 md:block" aria-label="Members">
          <Users size={20} />
        </button>
      </header>

      {searchOn && (
        <div className="flex shrink-0 items-center gap-1 border-b border-black/10 px-3 py-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setSearchOn(false); setQ(""); }
              if (e.key === "Enter") jumpMatch(e.shiftKey ? -1 : 1);
            }}
            placeholder="Is chat me dhoondo…"
            className="field min-w-0 flex-1 px-3 py-1.5 text-sm"
          />
          <span className="w-12 shrink-0 text-center text-xs tabular-nums text-[#80848e]">
            {matchIds.length > 0 ? `${qIdx + 1}/${matchIds.length}` : q ? "0" : ""}
          </span>
          <button onClick={() => jumpMatch(-1)} disabled={matchIds.length === 0} className="rounded-md p-1.5 text-[#5c5e66] hover:bg-black/5 disabled:opacity-30" aria-label="Pichla"><ChevronUp size={18} /></button>
          <button onClick={() => jumpMatch(1)} disabled={matchIds.length === 0} className="rounded-md p-1.5 text-[#5c5e66] hover:bg-black/5 disabled:opacity-30" aria-label="Agla"><ChevronDown size={18} /></button>
          <button onClick={() => { setSearchOn(false); setQ(""); }} className="rounded-md p-1.5 text-[#5c5e66] hover:bg-black/5" aria-label="Band"><X size={18} /></button>
        </div>
      )}

      {pinnedMsgs.length > 0 && (
        <button
          onClick={() => { const p = pinnedMsgs[pinIdx % pinnedMsgs.length]; if (p) { jumpTo(p.id); setPinIdx((i) => i + 1); } }}
          className="flex shrink-0 items-center gap-2 border-b border-black/10 bg-[#5865f2]/[0.06] px-4 py-1.5 text-left text-[13px] transition hover:bg-[#5865f2]/[0.1]"
          title="Pin par jao"
        >
          <Pin size={14} className="shrink-0 text-[#5865f2]" />
          <span className="min-w-0 flex-1 truncate text-[#5c5e66]">
            {pinnedMsgs[pinIdx % pinnedMsgs.length]?.text?.slice(0, 80) || "📌"}
          </span>
          {pinnedMsgs.length > 1 && <span className="shrink-0 text-xs font-bold text-[#5865f2]">{(pinIdx % pinnedMsgs.length) + 1}/{pinnedMsgs.length}</span>}
        </button>
      )}

      {/* 15 — wallpaper blur layer (slider se control) */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {prefs.wallpaperBlur > 0 && (prefs.wallpaper !== "default" || prefs.wallpaperCustom) && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              ...wallpaperStyle(prefs.wallpaper, prefs.wallpaperCustom),
              filter: `blur(${prefs.wallpaperBlur}px)`,
              transform: "scale(1.08)",
            }}
          />
        )}
      <div
        ref={sc}
        onScroll={onScroll}
        onTouchStart={onTouchStartPTR}
        onTouchMove={onTouchMovePTR}
        onTouchEnd={onTouchEndPTR}
        className={`thin-scroll relative min-h-0 flex-1 overflow-y-auto py-3 ${isDoodleWallpaper(prefs.wallpaper) ? "chat-doodle" : ""}`}
        style={prefs.wallpaperBlur > 0 ? {} : wallpaperStyle(prefs.wallpaper, prefs.wallpaperCustom)}
      >
        {/* 13 — pull-to-refresh indicator */}
        {(ptrPull > 10 || ptrBusy) && (
          <div className="flex justify-center py-1" style={{ height: ptrBusy ? 36 : undefined, opacity: Math.min(1, ptrPull / 70) }}>
            <span className={`grid h-8 w-8 place-items-center rounded-full bg-white soft-shadow ${ptrBusy ? "ptr-spinner" : ""}`} style={{ transform: ptrBusy ? undefined : `rotate(${ptrPull * 2.4}deg)` }}>
              <ChevronDown size={18} className="text-[#5865f2]" />
            </span>
          </div>
        )}
        {/* 19 — purane load ho rahe hain */}
        {loadingMore && (
          <div className="flex justify-center gap-1.5 py-2">
            <i className="tdot h-1.5 w-1.5 rounded-full bg-[#80848e]" />
            <i className="tdot h-1.5 w-1.5 rounded-full bg-[#80848e]" />
            <i className="tdot h-1.5 w-1.5 rounded-full bg-[#80848e]" />
          </div>
        )}
        {skel ? (
          <ChatSkeleton />
        ) : msgs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-[#5865f2]/10">
              {isDM ? <span className="text-2xl">👋</span> : <Hash size={28} className="text-[#5865f2]" />}
            </div>
            <h3 className="mt-4 text-lg font-extrabold tracking-tight text-[#2f3035]">{isDM ? `Ye ${dmOther?.name || "dost"} se baat ki shuruaat hai` : `Welcome to ${activeChat?.name || "group"}!`}</h3>
            <p className="mt-1.5 max-w-xs text-sm text-[#80848e]">Pehla message bhejo — salaam se shuruaat karo 🌙</p>
          </div>
        ) : (
          sections.map((sec) => (
            <div key={sec.key}>
              <div className="sticky top-0 z-[5] flex justify-center py-1.5">
                <span key={sec.key} className="date-pill rounded-full border border-black/10 bg-white/85 px-3 py-1 text-[11px] font-bold text-[#5c5e66] shadow-sm backdrop-blur">{sec.label}</span>
              </div>
              {sec.msgs.map((m, i) => {
                const prev = sec.msgs[i - 1];
                const member = members.find((x) => x.id === m.from);
                const prevSame = !!prev && prev.from === m.from && m.at - prev.at < 5 * 60e3 && !prev.deleted && m.type !== "announcement" && prev.type !== "announcement";
                return (
                  <Fragment key={m.id}>
                    {unreadInfo && m.id === unreadInfo.id && (
                      <div className="flex justify-center py-2">
                        <button
                          onClick={() => jumpTo(m.id)}
                          className="unread-glow rounded-full bg-[#5865f2] px-3.5 py-1.5 text-xs font-bold text-white shadow transition hover:bg-[#4752c4]"
                        >
                          {unreadInfo.count} unread messages
                        </button>
                      </div>
                    )}
                    <MessageItem m={m} member={member} prevSame={prevSame} query={searchOn ? q : ""} />
                  </Fragment>
                );
              })}
            </div>
          ))
        )}
        {typer && (
          <div className="flex items-center gap-3 px-4 pt-2 sm:hidden">
            <Avatar m={typer} size={28} />
            <span className="flex gap-1 rounded-xl bg-black/[0.05] px-3 py-2"><i className="tdot h-1.5 w-1.5 rounded-full bg-[#80848e]" /><i className="tdot h-1.5 w-1.5 rounded-full bg-[#80848e]" /><i className="tdot h-1.5 w-1.5 rounded-full bg-[#80848e]" /></span>
          </div>
        )}
      </div>
      </div>

      {activeChatId && <Composer chatId={activeChatId} />}
      <MobileDrawers />
    </div>
  );
}
