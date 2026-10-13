'use client';

import { useState } from 'react';
import { backend, isDemoMode } from '@/lib/backend';

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.6 2.8-.1.1C3.5 21.3 7.5 24 12 24z" />
      <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.5 0 10.2 0 12s.5 3.5 1.4 5.2l3.8-2.8z" />
      <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.7 1.4 6.8l3.8 2.9c1-2.9 3.7-5 6.8-5z" />
    </svg>
  );
}

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async () => {
    setLoading(true);
    setError('');
    try {
      await backend.signInWithGoogle();
    } catch {
      setError('Login nahi ho saka. Dobara try karein.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b141a] px-4">
      <div className="w-full max-w-sm bg-[#111b21] rounded-2xl p-8 shadow-2xl border border-[#222d34]">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-full bg-[#00a884] flex items-center justify-center">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.5 14.1c-.2.6-1.3 1.2-1.9 1.2-.5.1-1.1.2-3.7-.8-3.1-1.3-5.1-4.5-5.3-4.7-.1-.2-1.2-1.7-1.2-3.2s.8-2.3 1-2.6c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5s.8 1.9.8 2c.1.1.1.3 0 .5-.3.6-.6.8-.4 1.1.6 1.1 1.4 1.9 2.5 2.4.3.2.5.1.7-.1l.8-.9c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.4 0 .1 0 .5-.4 1.8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">Chat</h1>
        </div>
        <p className="text-center text-[#8696a0] text-sm mb-8">
          WhatsApp jaisa messenger — sirf Google se login
        </p>
        <button
          onClick={login}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-medium rounded-full py-3 px-4 hover:bg-gray-100 transition disabled:opacity-60"
        >
          <GoogleIcon />
          {loading ? 'Login ho raha hai...' : 'Google se continue karein'}
        </button>
        {error && <p className="text-red-400 text-sm text-center mt-4">{error}</p>}
        {isDemoMode && (
          <p className="text-[#8696a0] text-xs text-center mt-6 leading-relaxed">
            Demo mode chal raha hai (backend keys nahi lagi). Supabase ya Firebase connect karne par asli Google login aur real-time chat chalegi.
          </p>
        )}
      </div>
      <p className="text-[#8696a0] text-xs mt-8">🔒 Aapki chats end-to-end jaisi private rahengi</p>
    </div>
  );
}
