"use client";
import { useCallback, useEffect, useState } from "react";
import Loader from "./Loader";
import Shell from "./Shell";
import { hydrate } from "@/data/store";
import { startEngine } from "@/data/engine";
import { update } from "@/data/store";
import { getSession, onAuthChange, signInWithGoogle, loadRealData } from "@/data/supabase";

function LoginScreen() {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-8" style={{ background: "radial-gradient(120% 90% at 50% 10%, #0e2a22 0%, #0a1311 55%, #060b0a 100%)" }}>
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6" style={{ background: "linear-gradient(135deg,#2ccf8a,#1a9e6b)", boxShadow: "0 18px 50px -12px rgba(44,207,138,.55)" }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" fill="#06281d" opacity=".9"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" stroke="#2ccf8a" strokeWidth="2.4" strokeLinecap="round"/></svg>
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">ChatsApp</h1>
      <p className="text-sm mb-10" style={{ color: "#8fa9a0" }}>Baatein, ab aur qareeb</p>
      <button
        disabled={busy}
        onClick={async () => { setBusy(true); try { await signInWithGoogle(); } catch { setBusy(false); } }}
        className="flex items-center gap-3 px-7 py-3.5 rounded-2xl font-semibold text-[15px] text-white active:scale-[.98] transition disabled:opacity-60"
        style={{ background: "linear-gradient(135deg,#2ccf8a,#1a9e6b)", boxShadow: "0 14px 40px -10px rgba(44,207,138,.5)" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#fff" opacity=".8" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#fff" opacity=".6" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#fff" opacity=".4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
        {busy ? "Khul raha hai…" : "Google se login karo"}
      </button>
      <p className="text-xs mt-6 text-center leading-relaxed" style={{ color: "#5d7a71" }}>Madrasa Group me shamil hone ke liye<br />Google se login zaroori hai</p>
    </div>
  );
}

export default function ClientRoot() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const done = useCallback(() => setLoading(false), []);

  useEffect(() => {
    hydrate();
    try {
      const v = sessionStorage.getItem("chatsapp:justUpdated");
      if (v) { sessionStorage.removeItem("chatsapp:justUpdated"); update((s) => ({ ui: { ...s.ui, changelog: true } })); }
    } catch { /* ignore */ }
    setMounted(true);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

    let stopEngine: (() => void) | null = null;
    let cancelled = false;

    const boot = async (session: any) => {
      if (!session?.user) { if (!cancelled) setAuthed(false); return; }
      try {
        await loadRealData(session.user.id, session.user.email || "");
      } catch (e) { console.warn("load failed", e); }
      // only show Shell AFTER real data is in the store (prevents me() crash)
      if (!cancelled) { setAuthed(true); stopEngine = startEngine(); }
    };

    getSession().then((s) => { if (!cancelled) boot(s); });
    const unsub = onAuthChange((s) => { if (!cancelled) boot(s); });

    return () => { cancelled = true; unsub(); stopEngine?.(); };
  }, []);

  return (
    <>
      {mounted && authed === true && <Shell />}
      {mounted && authed === false && <LoginScreen />}
      {loading && <Loader onDone={done} />}
    </>
  );
}
