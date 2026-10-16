"use client";
import { useEffect, useRef, useState } from "react";
import { getSession, onAuthChange, load, startRealtime, touchPresence } from "@/lib/db";
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
        update({ session: false, loading: false, me: "", members: [], messages: [], chats: [], starred: [], groupRules: {}, groupDescs: {}, ui: { ...getState().ui, activeChatId: null, profileId: null, viewer: null, starredOpen: false, groupInfo: null, globalSearchOpen: false, jumpToMsg: null, settingsOpen: false, createGroupOpen: false } });
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
    <div className={`flex h-full min-w-0 flex-1 ${compactCls}`}>
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
  );
}
