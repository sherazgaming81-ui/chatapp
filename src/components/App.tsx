"use client";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Moon, Settings } from "lucide-react";
import { getSession, onAuthChange, load, startRealtime, touchPresence } from "@/lib/db";
import VersionBanner from "@/components/VersionBanner";
import { useStore, patchUI, toast, update, getState } from "@/lib/store";
import { isStaff } from "@/lib/types";
import { trackActiveDay } from "@/lib/achievements";
import Login from "@/components/Login";
import Loader from "@/components/Loader";
import WelcomeSplash from "@/components/WelcomeSplash";
import ProfileWizard from "@/components/ProfileWizard";
import SetupChecklist, { isChecklistDone } from "@/components/SetupChecklist";
import AchievementToasts from "@/components/AchievementToasts";
import ServerRail from "@/components/ServerRail";
import Sidebar from "@/components/Sidebar";
import ChatView from "@/components/ChatView";
import MemberList from "@/components/MemberList";
import ProfileModal from "@/components/ProfileModal";
import OwnerPanel from "@/components/OwnerPanel";
import DeenPage from "@/components/DeenPage";
import StarredView from "@/components/StarredView";
import MediaViewer from "@/components/MediaViewer";
import GroupInfo from "@/components/GroupInfo";
import GlobalSearch from "@/components/GlobalSearch";
import CreateGroup from "@/components/CreateGroup";
import Toasts from "@/components/Toasts";
import GlobalVideoBar from "@/components/GlobalVideoBar";
import AppLock from "@/components/AppLock";
import { usePrefs } from "@/lib/prefs";

export default function App() {
  const session = useStore((s) => s.session);
  const loading = useStore((s) => s.loading);
  const tab = useStore((s) => s.ui.tab);
  const starredOpen = useStore((s) => s.ui.starredOpen);
  const me = useStore((s) => s.members.find((m) => m.id === s.me));
  const meId = useStore((s) => s.me);
  const prefs = usePrefs();
  const started = useRef(false);

  // WhatsApp-style: browser tab title me total unread count — (3) ChatsApp
  const totalUnread = useStore((s) => Object.values(s.unread).reduce((a, b) => a + (b || 0), 0));
  useEffect(() => {
    try {
      document.title = totalUnread > 0 ? `(${totalUnread}) ChatsApp` : "ChatsApp";
    } catch { /* ignore */ }
  }, [totalUnread]);

  // Phase 6 — onboarding state
  const [welcomeSeen, setWelcomeSeen] = useState(() => {
    try { return localStorage.getItem("chatsapp:welcome:seen") === "1"; } catch { return true; }
  });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const onboardChecked = useRef(false);

  const dismissWelcome = () => {
    try { localStorage.setItem("chatsapp:welcome:seen", "1"); } catch { /* ignore */ }
    setWelcomeSeen(true);
  };

  /* 20 — offline indicator */
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    try { setIsOnline(navigator.onLine); } catch { /* ignore */ }
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  /* 7 — keyboard shortcuts (desktop): Ctrl/Cmd+K = search, Esc = band karo ⌨️ */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      // Ctrl/Cmd + K → global search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        patchUI({ globalSearchOpen: true });
        return;
      }
      if (e.key !== "Escape") return;
      const s = getState().ui;
      // upar se neeche: jo khula ho wo band
      if (s.viewer) patchUI({ viewer: null });
      else if (s.groupInfo) patchUI({ groupInfo: null });
      else if (s.globalSearchOpen) patchUI({ globalSearchOpen: false });
      else if (s.createGroupOpen) patchUI({ createGroupOpen: false });
      else if (s.settingsOpen) patchUI({ settingsOpen: false });
      else if (s.profileId) patchUI({ profileId: null, confirmBan: null });
      else if (s.infoMsg) patchUI({ infoMsg: null });
      else if (s.confirmBan) patchUI({ confirmBan: null });
      else if (!typing && s.starredOpen) patchUI({ starredOpen: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* 3 — ripple effect (saare .btn par) */
  useEffect(() => {
    const h = (e: PointerEvent) => {
      const t = (e.target as HTMLElement).closest?.(".btn") as HTMLElement | null;
      if (!t) return;
      const r = t.getBoundingClientRect();
      const s = Math.max(r.width, r.height);
      const ink = document.createElement("span");
      ink.className = "ripple-ink";
      ink.style.width = ink.style.height = `${s}px`;
      ink.style.left = `${e.clientX - r.left - s / 2}px`;
      ink.style.top = `${e.clientY - r.top - s / 2}px`;
      t.appendChild(ink);
      setTimeout(() => ink.remove(), 650);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, []);

  useEffect(() => {
    let rt: { stop(): void; sendTyping(): void } | null = null;
    let cancelled = false;
    (window as any).__sendTyping = () => rt?.sendTyping();

    const boot = async (sess: any) => {
      if (!sess?.user || started.current) return;
      started.current = true;
      const t0 = Date.now();
      try {
        await load(sess.user.id, sess.user.email || "");
      } catch {
        toast("Load nahi hua", "Dobara try karo");
      }
      if (cancelled) return;
      // premium loader stays a full 3s from boot — identical on mobile and web
      const wait = Math.max(0, 3000 - (Date.now() - t0));
      setTimeout(() => {
        if (cancelled) return;
        try {
          rt = startRealtime();
        } catch { /* ignore */ }
        // Phase 8 — scheduled announcements checker
        import("@/lib/owner").then((m) => { try { m.startScheduler(); } catch { /* ignore */ } }).catch(() => {});
      }, wait);
    };

    getSession().then((s) => {
      if (s?.user) boot(s);
      else update({ loading: false }); // logged out → straight to login
    });
    const off = onAuthChange((s) => {
      if (s?.user) {
        boot(s);
      } else if (started.current) {
        // real sign-out (was logged in before) → reset to login, NO reload loop
        started.current = false;
        rt?.stop();
        rt = null;
        update({ session: false, loading: false, me: "", members: [], messages: [], chats: [], starred: [], groupRules: {}, groupDescs: {}, unread: {}, ui: { ...getState().ui, activeChatId: null, profileId: null, viewer: null, starredOpen: false, groupInfo: null, globalSearchOpen: false, jumpToMsg: null, settingsOpen: false, createGroupOpen: false } });
        onboardChecked.current = false;
        setWizardOpen(false);
        setChecklistOpen(false);
      }
      // initial null (login page) → do nothing, just show Login
    });
    const onVis = () => touchPresence(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      off();
      document.removeEventListener("visibilitychange", onVis);
      rt?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───────── Phase 6 — onboarding flow ───────── */
  useEffect(() => {
    if (!session || loading || onboardChecked.current) return;
    onboardChecked.current = true;
    trackActiveDay(); // F6 sathi badge
    try {
      const wizDone = localStorage.getItem(`chatsapp:wizard:done:${meId}`) === "1";
      const isNew = localStorage.getItem(`chatsapp:newuser:${meId}`) === "1";
      if (isNew && !wizDone) {
        setWizardOpen(true);
        return;
      }
      if (!isChecklistDone()) setChecklistOpen(true);
    } catch { /* ignore */ }
  }, [session, loading, meId]);

  const finishWizard = () => {
    try {
      localStorage.setItem(`chatsapp:wizard:done:${meId}`, "1");
      localStorage.removeItem(`chatsapp:newuser:${meId}`);
    } catch { /* ignore */ }
    setWizardOpen(false);
    if (!isChecklistDone()) setChecklistOpen(true);
  };

  if (!session) return (
    <>
      {!welcomeSeen && <WelcomeSplash onDone={dismissWelcome} />}
      <Login />
    </>
  );
  if (loading) return <Loader />;

  const owner = isStaff(me);
  const showOwner = tab === "owner" && owner;
  const showDeen = tab === "deen";
  const main = starredOpen ? <StarredView /> : showDeen ? <DeenPage /> : showOwner ? <OwnerPanel /> : <ChatView />;
  const compactCls = prefs.compact ? "compact" : "";

  return (
    <div className={`flex h-full min-w-0 flex-1 flex-col ${compactCls}`}>
      {/* 13 — naya version banner (silent update, koi force reload nahi) */}
      <VersionBanner />
      {/* 20 — offline banner */}
      {!isOnline && (
        <div className="offline-banner z-[100] flex shrink-0 items-center justify-center gap-2 bg-[#ed4245] px-4 py-2 text-sm font-bold text-white">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          Offline ho — reconnecting… 📡
        </div>
      )}
      <div className={`flex min-h-0 min-w-0 flex-1 ${compactCls}`}>
      {/* desktop: discord 3-column layout */}
      <div className="hidden min-w-0 flex-1 gap-3 md:flex">
        <ServerRail />
        {!showDeen && <Sidebar />}
        <div className="flex min-w-0 flex-1 flex-col">{main}</div>
        {!showDeen && <MemberList />}
      </div>
      {/* mobile: single column + drawers (handled inside ChatView/Sidebar) */}
      <div className="flex min-w-0 flex-1 flex-col md:hidden">
        {!showDeen && (
          <button onClick={() => patchUI({ tab: "deen" })} className="mx-3 mb-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#23a55a]/15 to-[#23a55a]/5 px-4 py-2.5 text-sm font-bold text-[#1a7a55]">
            <span className="text-lg">🕌</span> Deen — namaz, tasbeeh, qibla
          </button>
        )}
        {main}
        {/* 12 — mobile bottom navigation */}
        <nav className="mobile-nav grid shrink-0 grid-cols-3" aria-label="Navigation">
          <button
            onClick={() => patchUI({ tab: "chat" })}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold transition ${tab === "chat" && !showDeen ? "text-[#5865f2]" : "text-[#80848e]"}`}
          >
            <MessageCircle size={21} />
            Chats
          </button>
          <button
            onClick={() => patchUI({ tab: "deen" })}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold transition ${showDeen ? "text-[#5865f2]" : "text-[#80848e]"}`}
          >
            <Moon size={21} />
            Deen
          </button>
          <button
            onClick={() => patchUI({ settingsOpen: true })}
            className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold text-[#80848e] transition active:text-[#5865f2]"
          >
            <Settings size={21} />
            Settings
          </button>
        </nav>
      </div>
      <ProfileModal />
      <MediaViewer />
      <GroupInfo />
      <GlobalSearch />
      <CreateGroup />
      <Toasts />
      {/* ★ Asma-ul-Husna mini-player — video chal rahi ho aur player band ho to */}
      <GlobalVideoBar />
      {/* ★ E6 — App Lock */}
      <AppLock />
      {/* ★ Phase 6 — onboarding */}
      <AchievementToasts />
      {!welcomeSeen && <WelcomeSplash onDone={dismissWelcome} />}
      {wizardOpen && <ProfileWizard onDone={finishWizard} />}
      {checklistOpen && !wizardOpen && (
        <SetupChecklist onDone={() => setChecklistOpen(false)} onOpenProfile={() => patchUI({ settingsOpen: true })} />
      )}
      </div>
    </div>
  );
}
