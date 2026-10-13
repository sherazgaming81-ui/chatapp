'use client';

// Usage:
//   import ChatInfoPanel from '@/components/v1/ChatInfoPanel';
//   <ChatInfoPanel chat={chat} meId={me.id} onClose={() => setInfoOpen(false)} />
//
// Props: { chat: Chat; meId: string; onClose: () => void }
// Slide-in right panel (desktop) / full-screen overlay (mobile) with group/user
// photo, name, description (edit affordance = "Tabdeel" button; parent wires the
// actual save via backend.setGroupDescription), member count and member list.
// If chat.adminIds includes meId and chat is a group, each member row shows
// "Admin banao" / "Nikalo" buttons with confirm() dialogs that call
// backend.makeAdmin / backend.removeMember. Non-admins get a plain read-only list.

import { useEffect } from 'react';
import { backend } from '@/lib/backend';
import type { Chat } from '@/lib/backend/types';
import Avatar from '@/components/Avatar';
import ChatNotifSettings from './ChatNotifSettings';
import SlowModeSetting from './SlowModeSetting';

function lastSeenText(lastSeen?: number): string {
  if (!lastSeen) return 'last seen —';
  const diff = Date.now() - lastSeen;
  if (diff < 60_000) return 'aakhri baar abhi';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `aakhri baar ${mins} min pehle`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `aakhri baar ${hrs} ghante pehle`;
  const d = new Date(lastSeen);
  return `aakhri baar ${d.toLocaleDateString('ur-PK', { day: 'numeric', month: 'short' })}`;
}

export default function ChatInfoPanel({
  chat,
  meId,
  onClose,
}: {
  chat: Chat;
  meId: string;
  onClose: () => void;
}) {
  const isGroup = chat.type === 'group';
  const isAdmin = isGroup && !!chat.adminIds?.includes(meId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const memberIds = chat.participants;

  const handleMakeAdmin = async (userId: string, name: string) => {
    if (!window.confirm(`"${name}" ko admin banana hai?`)) return;
    await backend.makeAdmin(chat.id, userId);
  };

  const handleRemove = async (userId: string, name: string) => {
    if (!window.confirm(`"${name}" ko group se nikalna hai? Ye action wapas nahi hoga.`)) return;
    await backend.removeMember(chat.id, userId);
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      {/* panel */}
      <style>{`@keyframes panel-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
      <aside className="absolute right-0 top-0 h-full w-full sm:w-[380px] bg-[#0b141a] border-l border-[#222d34] flex flex-col shadow-2xl" style={{ animation: 'panel-slide-in 0.25s ease-out' }}>
        {/* header */}
        <div className="flex items-center gap-4 px-4 py-3 bg-[#202c33] shrink-0">
          <button onClick={onClose} className="text-[#8696a0] hover:text-white text-2xl leading-none" aria-label="Band karein">
            ←
          </button>
          <h2 className="text-white font-semibold text-lg">{isGroup ? 'Group ki maloomat' : 'Rabatgi ki maloomat'}</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* photo + name */}
          <div className="flex flex-col items-center pt-8 pb-6 px-6 border-b border-[#222d34]">
            <Avatar name={chat.name} photoURL={chat.photoURL} size={120} />
            <h3 className="text-white text-xl font-semibold mt-4 text-center break-words">{chat.name}</h3>
            {isGroup && (
              <p className="text-[#8696a0] text-sm mt-1">
                Group · {memberIds.length} {memberIds.length === 1 ? 'member' : 'members'}
              </p>
            )}
          </div>

          {/* description */}
          <div className="px-6 py-5 border-b border-[#222d34]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[#8696a0] text-sm uppercase tracking-wide">Tafseel</p>
              {isAdmin && (
                <button
                  className="text-[#00a884] text-sm font-medium hover:text-[#06cf9c] transition"
                  title="Description tabdeel karein"
                  onClick={() => {
                    // Edit affordance: parent wires the save via backend.setGroupDescription(chat.id, newDesc)
                    // and re-renders with the updated chat object.
                    const next = window.prompt('Group ki tafseel likhein:', chat.description ?? '');
                    if (next === null) return;
                    void backend.setGroupDescription(chat.id, next.trim());
                  }}
                >
                  Tabdeel
                </button>
              )}
            </div>
            <p className="text-white text-[15px] whitespace-pre-wrap break-words">
              {chat.description?.trim() ? chat.description : 'Koi tafseel nahi hai'}
            </p>
          </div>

          {/* members */}
          {isGroup && (
            <div className="py-2">
              <p className="text-[#8696a0] text-sm uppercase tracking-wide px-6 pt-3 pb-1">
                Members — {memberIds.length}
              </p>
              <ul>
                {memberIds.map((uid) => {
                  const p = chat.participantProfiles[uid];
                  const name = p?.displayName ?? 'Unknown';
                  const admin = !!chat.adminIds?.includes(uid);
                  const isMe = uid === meId;
                  return (
                    <li key={uid} className="px-6 py-2.5 hover:bg-[#202c33] transition flex items-center gap-3">
                      <div className="relative shrink-0">
                        <Avatar name={name} photoURL={p?.photoURL} size={46} />
                        {p?.online && (
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#00a884] rounded-full border-2 border-[#0b141a]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">
                          {isMe ? 'Aap' : name}
                          {admin && (
                            <span className="ml-2 text-[11px] font-semibold text-[#00a884] border border-[#00a884]/40 rounded px-1.5 py-0.5 align-middle">
                              Admin
                            </span>
                          )}
                        </p>
                        <p className={`text-sm truncate ${p?.online ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                          {p?.online ? 'Online' : lastSeenText(p?.lastSeen)}
                        </p>
                      </div>
                      {isAdmin && !isMe && (
                        <div className="flex gap-1.5 shrink-0">
                          {!admin && (
                            <button
                              onClick={() => handleMakeAdmin(uid, name)}
                              className="text-[11px] font-semibold text-[#00a884] border border-[#00a884]/40 rounded-full px-2.5 py-1 hover:bg-[#00a884]/10 transition"
                            >
                              Admin banao
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(uid, name)}
                            className="text-[11px] font-semibold text-red-400 border border-red-400/40 rounded-full px-2.5 py-1 hover:bg-red-400/10 transition"
                          >
                            Nikalo
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {/* per-chat notification + slow mode settings */}
          <div className="py-2 border-t border-[#222d34]">
            <p className="text-[#8696a0] text-sm uppercase tracking-wide px-6 pt-3 pb-1">
              Chat settings
            </p>
            <div className="px-6 pb-2">
              <ChatNotifSettings chatId={chat.id} />
            </div>
            {isAdmin && isGroup && (
              <div className="px-6 pb-4">
                <SlowModeSetting chat={chat} onChange={() => {}} />
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
