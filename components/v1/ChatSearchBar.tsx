// ChatSearchBar — 'use client'
// Expandable in-chat search row with debounced backend search + results dropdown.
//
// Props:
//   chatId: string                      — the active chat id (search scope)
//   onJumpToMessage: (messageId: string) => void — called when user taps a result
//
// Example:
//   <ChatSearchBar chatId={activeChatId} onJumpToMessage={(id) => scrollToMessage(id)} />
//
// Behaviour:
//   - Debounces input 300ms, then calls backend.searchInChat(chatId, query)
//   - Dropdown shows sender name + text snippet + time for each match
//   - Tap a result -> onJumpToMessage(id), Esc clears the input
//   - "Kuch nahi mila" when the search returns no matches
'use client';

import { useEffect, useRef, useState } from 'react';
import { backend } from '@/lib/backend';
import type { ChatMessage } from '@/lib/backend/types';

interface ChatSearchBarProps {
  chatId: string;
  onJumpToMessage: (messageId: string) => void;
}

function snippet(text: string, query: string, maxLen = 60): string {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  let s = text;
  if (idx > 12) s = '…' + text.slice(Math.max(0, idx - 20), idx + 40);
  if (s.length > maxLen) s = s.slice(0, maxLen) + '…';
  return s;
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatSearchBar({ chatId, onJumpToMessage }: ChatSearchBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchIdRef = useRef(0);

  // Focus the input whenever the row expands
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else {
      setQuery('');
      setResults([]);
      setSearched(false);
    }
  }, [open ]);

  // Reset when the active chat changes
  useEffect(() => {
    setQuery('');
    setResults([]);
    setSearched(false);
  }, [chatId]);

  // Debounced search (300ms)
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    const myId = ++searchIdRef.current;
    setLoading(true);
    const t = setTimeout(() => {
      backend
        .searchInChat(chatId, q)
        .then((hits) => {
          if (searchIdRef.current === myId) {
            setResults(hits);
            setSearched(true);
            setLoading(false);
          }
        })
        .catch(() => {
          if (searchIdRef.current === myId) {
            setResults([]);
            setSearched(true);
            setLoading(false);
          }
        });
    }, 300);
    return () => clearTimeout(t);
  }, [query, chatId]);

  const clear = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    inputRef.current?.focus();
  };

  const pick = (m: ChatMessage) => {
    onJumpToMessage(m.id);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Chat me dhoondein"
        title="Chat me dhoondein"
        className="p-2 rounded-full text-[#aebac1] hover:bg-[#374045] hover:text-white transition-colors"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
      </button>
    );
  }

  return (
    <div className="relative flex-1 min-w-0">
      <div className="flex items-center gap-2 bg-[#111b21] border border-[#2a3942] rounded-full px-3 py-1.5">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#8696a0" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              clear();
            }
          }}
          placeholder="Is chat me dhoondein"
          className="flex-1 min-w-0 bg-transparent outline-none text-white placeholder-[#8696a0] text-sm"
        />
        {loading ? (
          <span className="w-4 h-4 border-2 border-[#2a3942] border-t-[#00a884] rounded-full animate-spin" aria-label="Dhoondh rahe hain" />
        ) : query ? (
          <button onClick={clear} aria-label="Saaf karein" className="text-[#8696a0] hover:text-white text-lg leading-none">
            ✕
          </button>
        ) : null}
        <button onClick={() => setOpen(false)} aria-label="Band karein" className="text-[#8696a0] hover:text-white text-sm">
          ✕
        </button>
      </div>

      {(searched || loading) && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-[#111b21] border border-[#2a3942] rounded-xl shadow-2xl overflow-hidden z-50 max-h-72 overflow-y-auto">
          {loading && results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#8696a0]">Dhoondh rahe hain…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#8696a0]">Kuch nahi mila</p>
          ) : (
            <ul>
              {results.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => pick(m)}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#202c33] transition-colors border-b border-[#2a3942]/50 last:border-0"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-medium text-[#00a884] truncate">{m.senderName}</span>
                      <span className="text-[11px] text-[#8696a0] shrink-0">{fmtTime(m.createdAt)}</span>
                    </div>
                    <p className="text-sm text-[#d1d7db] truncate mt-0.5">
                      {m.type === 'text' ? snippet(m.text, query) : `[${m.type}] ${snippet(m.fileName ?? m.text, query)}`}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
