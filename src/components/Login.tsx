"use client";
import { useState } from "react";
import { signInWithGoogle } from "@/lib/db";

export default function Login() {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } finally {
      setTimeout(() => setBusy(false), 4000);
    }
  };
  return (
    <div className="flex h-full w-full items-center justify-center px-6">
      <div className="pop-in glass-strong w-full max-w-md rounded-3xl p-8 text-center sm:p-10">
        <div
          className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-[#5865f2] to-[#9b7bff] soft-shadow"
          style={{ animation: "floaty 4s ease-in-out infinite" }}
        >
          <span className="text-4xl font-bold text-white">م</span>
        </div>
        <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.14em] text-[#5865f2]">Madrasa doston ke liye</p>
        <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-[#2f3035] sm:text-5xl">
          Baatein,
          <br />
          <span className="bg-gradient-to-r from-[#5865f2] to-[#9b7bff] bg-clip-text text-transparent">ab aur qareeb</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xs text-[15px] leading-relaxed text-[#5c5e66]">
          Apne madrasa group se juro — elaan, baatein aur dost, sab ek jagah.
        </p>
        <button
          onClick={go}
          disabled={busy}
          className="btn btn-blurple mx-auto mt-8 flex w-full items-center justify-center gap-3 px-6 py-3.5 text-base disabled:opacity-70"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <path fill="#fff" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.6 2.8c2.2-2 3.8-5 3.8-8.6z" />
            <path fill="#fff" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-3.7 2.9C3.4 21.4 7.4 24 12 24z" opacity=".9" />
            <path fill="#fff" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4L1.4 6.8C.5 8.5 0 10.2 0 12s.5 3.5 1.4 5.2l3.8-2.8z" opacity=".8" />
            <path fill="#fff" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.6 1.4 6.8l3.8 2.9c1-2.9 3.7-5 6.8-5z" opacity=".85" />
          </svg>
          {busy ? "Khul raha hai…" : "Google se login"}
        </button>
        <p className="mt-5 text-xs text-[#80848e]">Sirf Google account se — koi password yaad rakhne ki zaroorat nahi.</p>
      </div>
    </div>
  );
}
