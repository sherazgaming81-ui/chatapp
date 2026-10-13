'use client';

// Usage:
//   import MemberDirectory from '@/components/v1/MemberDirectory';
//   <MemberDirectory chat={chat} />
//
// Props: { chat: Chat }
// Searchable member list (read-only): search input ("Naam dhoondein") filters by
// displayName; each row shows avatar, name, and presence — green "Online" or
// muted "aakhri baar ...". No admin actions here (ChatInfoPanel covers those).

import { useMemo, useState } from 'react';
import type { Chat } from '@/lib/backend/types';
import Avatar from '@/components/Avatar';

function lastSeenText(lastSeen?: number): string {
  if (!lastSeen) return 'aakhri baar —';
  const diff = Date.now() - lastSeen;
  if (diff < 60_000) return 'aakhri baar abhi';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `aakhri baar ${mins} min pehle`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `aakhri baar ${hrs} ghante pehle`;
  const d = new Date(lastSeen);
  return `aakhri baar ${d.toLocaleDateString('ur-PK', { day: 'numeric', month: 'short' })}`;
}

export default function MemberDirectory({ chat }: { chat: Chat }) {
  const [q, setQ] = useState('');

  const members = useMemo(() => {
    const query = q.trim().toLowerCase();
    const ids = chat.participants.filter((uid) => {
      const p = chat.participantProfiles[uid];
      return !query || (p?.displayName ?? '').toLowerCase().includes(query);
    });
    return ids.map((uid) => {
      const p = chat.participantProfiles[uid];
      return { uid, name: p?.displayName ?? 'Unknown', photoURL: p?.photoURL, online: !!p?.online, lastSeen: p?.lastSeen };
    });
  }, [chat, q]);

  return (
    <div className="bg-[#0b141a] rounded-xl border border-[#222d34] overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="11" cy="11" r="7" stroke="#8696a0" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="#8696a0" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Naam dhoondein"
            className="w-full bg-[#202c33] text-white rounded-full pl-10 pr-4 py-2.5 outline-none placeholder-[#8696a0] text-[15px] focus:ring-1 focus:ring-[#00a884]"
          />
          {q && (
            <button
              onClick={() => setQ('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8696a0] hover:text-white"
              aria-label="Search saaf karein"
            >
              ×
            </button>
          )}
        </div>
        <p className="text-[#8696a0] text-xs mt-2 px-1">
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </p>
      </div>

      <ul className="max-h-[60vh] overflow-y-auto pb-2">
        {members.map((m) => (
          <li key={m.uid} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#202c33]/60 transition">
            <div className="relative shrink-0">
              <Avatar name={m.name} photoURL={m.photoURL} size={44} />
              {m.online && (
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#00a884] rounded-full border-2 border-[#0b141a]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{m.name}</p>
              <p className={`text-sm truncate ${m.online ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                {m.online ? 'Online' : lastSeenText(m.lastSeen)}
              </p>
            </div>
            {m.online && <span className="w-2 h-2 rounded-full bg-[#00a884] shrink-0" />}
          </li>
        ))}
        {members.length === 0 && (
          <li className="text-center text-[#8696a0] text-sm py-10 px-6">
            "{q}" se koi member nahi mila
          </li>
        )}
      </ul>
    </div>
  );
}
