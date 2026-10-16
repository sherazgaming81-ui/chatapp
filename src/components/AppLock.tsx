"use client";
// E6 — App Lock screen. PIN set ho to app khulne par + 5 min inactive ke baad lock.
import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, Delete } from "lucide-react";
import { hasPin, verifyPin, clearPin } from "@/lib/prefs";
import { signOut } from "@/lib/db";
import { toast } from "@/lib/store";

const IDLE_MS = 5 * 60 * 1000; // 5 min

export default function AppLock() {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const idleTimer = useRef(0);

  const doLock = useCallback(() => {
    if (hasPin()) {
      setPin("");
      setErr("");
      setLocked(true);
    }
  }, []);

  // initial: PIN hai to lock karo
  useEffect(() => {
    if (hasPin()) setLocked(true);
  }, []);

  // inactivity: 5 min baad lock
  useEffect(() => {
    if (!hasPin()) return;
    const reset = () => {
      window.clearTimeout(idleTimer.current);
      if (!document.hidden) {
        idleTimer.current = window.setTimeout(() => doLock(), IDLE_MS);
      }
    };
    const onVis = () => {
      if (document.hidden) {
        window.clearTimeout(idleTimer.current);
      } else {
        // wapas aye aur timer guzar gaya ho to foran lock
        reset();
      }
    };
    ["pointerdown", "keydown", "touchstart", "wheel"].forEach((e) =>
      window.addEventListener(e, reset, { passive: true })
    );
    document.addEventListener("visibilitychange", onVis);
    reset();
    return () => {
      window.clearTimeout(idleTimer.current);
      ["pointerdown", "keydown", "touchstart", "wheel"].forEach((e) => window.removeEventListener(e, reset));
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [doLock, locked]);

  const digit = (d: string) => {
    setErr("");
    const cur = (pin + d).slice(0, 4);
    setPin(cur);
    if (cur.length === 4) check(cur);
  };
  const check = async (p: string) => {
    setBusy(true);
    const ok = await verifyPin(p);
    setBusy(false);
    if (ok) {
      setLocked(false);
      setPin("");
    } else {
      setErr("Ghalat PIN — dobara try karo");
      setPin("");
    }
  };

  const forgot = async () => {
    if (!window.confirm("PIN bhool gaye? Logout karke Google se dobara login karo — PIN reset ho jayega.")) return;
    clearPin();
    toast("PIN reset ho gaya", "Dobara login karo");
    await signOut();
  };

  if (!locked) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-[#2b2d31] via-[#313338] to-[#1e1f22] px-6">
      <span className="lock-pop grid h-20 w-20 place-items-center rounded-3xl bg-[#5865f2] soft-shadow">
        <Lock size={36} className="text-white" />
      </span>
      <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-white">ChatsApp</h2>
      <p className="mt-1 text-sm text-white/60">Jaari rakhne ke liye PIN dalo</p>

      <div className="mt-6 flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`grid h-14 w-14 place-items-center rounded-2xl border-2 text-2xl font-extrabold text-white transition ${pin[i] ? "border-[#5865f2] bg-[#5865f2]/20" : "border-white/15 bg-white/5"}`}
          >
            {pin[i] ? "•" : ""}
          </span>
        ))}
      </div>
      {err && <p className="mt-3 text-sm font-bold text-[#f47fff]">{err}</p>}

      <div className="mt-6 grid w-full max-w-[280px] grid-cols-3 gap-2.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) =>
          k === "" ? <span key={i} /> : k === "del" ? (
            <button key={i} onClick={() => { setPin(pin.slice(0, -1)); setErr(""); }} className="grid h-14 place-items-center rounded-2xl bg-white/5 text-white/70 transition hover:bg-white/10 active:scale-95">
              <Delete size={20} />
            </button>
          ) : (
            <button key={i} onClick={() => digit(k)} disabled={busy} className="grid h-14 place-items-center rounded-2xl bg-white/5 text-xl font-extrabold text-white transition hover:bg-[#5865f2]/40 active:scale-95 disabled:opacity-50">
              {k}
            </button>
          )
        )}
      </div>

      <button onClick={forgot} className="mt-6 text-sm font-bold text-white/50 hover:text-white/80">
        PIN bhool gaye?
      </button>
    </div>
  );
}
