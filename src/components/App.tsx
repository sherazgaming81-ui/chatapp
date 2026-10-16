"use client";
import { useEffect, useRef } from "react";
import { getSession, onAuthChange, load, startRealtime, touchPresence } from "@/lib/db";
import { useStore, patchUI, toast, update } from "@/lib/store";
import { isStaff } from "@/lib/types";
import Login from "@/components/Login";
import Loader from "@/components/Loader";
import ServerRail from "@/components/ServerRail";
import Sidebar from "@/components/Sidebar";
import ChatView from "@/components/ChatView";
import MemberList from "@/components/MemberList";
import ProfileModal from "@/components/ProfileModal";
import OwnerPanel from "@/components/OwnerPanel";
import Toasts from "@/components/Toasts";

export default function App() {
  const session = useStore((s) => s.session);
  const loading = useStore((s) => s.loading);
  const tab = useStore((s) => s.ui.tab);
  const me = useStore((s) => s.members.find((m) => m.id === s.me));
  const started = useRef(false);

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
      }, wait);
    };

    getSession().then((s) => {
      if (s?.user) boot(s);
      else update({ loading: false }); // logged out → straight to login
    });
    const off = onAuthChange((s) => {
      if (s?.user) boot(s);
      else {
        started.current = false;
        rt?.stop();
        window.location.reload();
      }
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

  if (!session) return <Login />;
  if (loading) return <Loader />;

  const owner = isStaff(me);
  const showOwner = tab === "owner" && owner;

  return (
    <div className="flex h-full min-w-0 flex-1">
      {/* desktop: discord 3-column layout */}
      <div className="hidden min-w-0 flex-1 gap-3 md:flex">
        <ServerRail />
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">{showOwner ? <OwnerPanel /> : <ChatView />}</div>
        <MemberList />
      </div>
      {/* mobile: single column + drawers (handled inside ChatView/Sidebar) */}
      <div className="flex min-w-0 flex-1 flex-col md:hidden">{showOwner ? <OwnerPanel /> : <ChatView />}</div>
      <ProfileModal />
      <Toasts />
    </div>
  );
}
