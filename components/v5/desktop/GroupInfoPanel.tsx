'use client';

/**
 * GroupInfoPanel — right slide-over (WhatsApp Web style).
 * Group avatar/name/description (owner edit) · members with Owner/Member badges
 * (owner quick actions: mute/warn/ban via executeCommand) · group rules
 * (owner edit) · media grid · theme picker entry (owner).
 */

import { useEffect, useMemo, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat, ChatMessage, UserProfile } from '@/lib/backend/types';
import Avatar from '@/components/Avatar';
import { Icon, ICONS, SectionTitle, runOwnerCommand, useMemberRoles, fmtSeenHinglish, RoleBadge } from './common';

interface Props {
  chat: Chat;
  me: UserProfile;
  ownerId: string | null;
  amOwner: boolean;
  onClose(): void;
  onOpenThemes(): void;
}

const RULES_KEY = 'v5-group-rules';
const DEFAULT_RULES = [
  'Ek doosre ki izzat karein — gali ya badtameezi mana hai.',
  'Namaz ke waqton me ghair-zaroori messages se parhez karein.',
  'Quran-o-Hadees ke peghamat baghair tehqeeq forward na karein.',
  'Kisi ki zaati maloomat (number, tasveer) ijazat ke baghair share na karein.',
  'Owner ki hidayat par amal karein.',
];

function loadRules(): string[] {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {}
  return DEFAULT_RULES;
}

export default function GroupInfoPanel({ chat, me, ownerId, amOwner, onClose, onOpenThemes }: Props) {
  const [desc, setDesc] = useState(chat.description || '');
  const [editingDesc, setEditingDesc] = useState(false);
  const [rules, setRules] = useState<string[]>(loadRules);
  const [editingRules, setEditingRules] = useState(false);
  const [rulesDraft, setRulesDraft] = useState('');
  const [media, setMedia] = useState<ChatMessage[]>([]);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  useEffect(() => {
    const unsub = backend.onMessages(chat.id, (msgs) =>
      setMedia(msgs.filter((m) => m.type === 'image' && m.mediaURL).slice(-24).reverse()),
    );
    return unsub;
  }, [chat.id]);

  const membersKey = useMemo(() => Object.keys(chat.participantProfiles || {}).join(','), [chat.participantProfiles]);
  const roleMap = useMemberRoles(chat.id, membersKey);

  const members = useMemo(() => {
    const list = Object.entries(chat.participantProfiles || {}).map(([id, p]) => ({
      id,
      name: id === me.id ? (me.displayName || p.displayName || 'Aap') : p.displayName || 'Koi',
      photoURL: id === me.id ? me.photoURL : p.photoURL,
      online: !!p.online,
      lastSeen: p.lastSeen ?? 0,
      role: roleMap[id] || (ownerId != null && id === ownerId ? 'Owner' : 'Member'),
    }));
    list.sort((a, b) => (a.role === 'Owner' ? -1 : b.role === 'Owner' ? 1 : a.name.localeCompare(b.name)));
    return list;
  }, [chat.participantProfiles, chat.participants, me, ownerId, roleMap]);

  const saveDesc = async () => {
    setEditingDesc(false);
    try { await backend.setGroupDescription(chat.id, desc); } catch {}
  };

  const saveRules = () => {
    const lines = rulesDraft.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length) {
      setRules(lines);
      try { localStorage.setItem(RULES_KEY, JSON.stringify(lines)); } catch {}
    }
    setEditingRules(false);
  };

  const [modMsg, setModMsg] = useState<string | null>(null);

  const modAction = async (action: string, userId: string, name: string) => {
    setActionBusy(userId + action);
    try {
      // mute ke liye default 10m — poora command input se bhi chal sakta hai
      const full = action === '/mute' ? `/mute @${name} 10m` : `${action} @${name}`;
      const res = await runOwnerCommand(chat.id, full);
      setModMsg(res.text);
      setTimeout(() => setModMsg(null), 3000);
    } catch (e) {
      setModMsg(e instanceof Error ? e.message : 'Nahi ho saka');
      setTimeout(() => setModMsg(null), 3000);
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <aside className="relative w-[340px] xl:w-[380px] shrink-0 bg-[#111b21] border-l border-[#222d34] flex flex-col h-full animate-[v4slideL_.2s_ease-out] z-30">
      <header className="h-[60px] shrink-0 bg-[#1f2c34] flex items-center gap-4 px-4">
        <button onClick={onClose} className="p-1.5 rounded-full text-[#8696a0] hover:bg-[#2a3942] hover:text-white transition" aria-label="Band karein">
          <Icon d={ICONS.x} size={20} />
        </button>
        <h2 className="text-[16px] font-medium text-[#e9edef]">Group info</h2>
      </header>

      <div className="flex-1 overflow-y-auto v4scroll">
        {/* identity */}
        <div className="flex flex-col items-center px-6 pt-6 pb-4 bg-[#1f2c34]/40">
          <Avatar name={chat.name || 'Madrasa Group'} photoURL={chat.photoURL} size={110} />
          <h3 className="mt-3 text-[19px] font-medium text-[#e9edef] text-center">{chat.name || 'Madrasa Group'}</h3>
          <p className="text-[13px] text-[#8696a0] mt-1">Group · {members.length} members</p>
        </div>

        {/* description */}
        <div className="px-6 py-4 border-b border-[#222d34]">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[13px] text-[#8696a0]">Description</p>
            {amOwner && !editingDesc && (
              <button onClick={() => setEditingDesc(true)} className="p-1.5 text-[#8696a0] hover:text-[#00a884]" title="Edit karein">
                <Icon d={ICONS.edit} size={16} />
              </button>
            )}
          </div>
          {editingDesc ? (
            <div className="flex gap-2">
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="flex-1 bg-[#1f2c34] rounded-lg px-3 py-2 text-[13.5px] text-[#e9edef] outline-none focus:ring-1 focus:ring-[#00a884]"
                placeholder="Group ke baare me likhein…"
                autoFocus
              />
              <button onClick={saveDesc} className="p-2 text-[#00a884]"><Icon d={ICONS.check} size={18} /></button>
            </div>
          ) : (
            <p className="text-[14px] text-[#e9edef] leading-relaxed">{desc || 'Madrasse ke doston ka group — baat cheet aur announcements ke liye.'}</p>
          )}
        </div>

        {/* theme (owner) */}
        {amOwner && (
          <button onClick={onOpenThemes} className="w-full flex items-center gap-4 px-6 py-3.5 text-left hover:bg-[#1f2c34] transition border-b border-[#222d34]">
            <Icon d={ICONS.image} size={20} className="text-[#8696a0]" />
            <span>
              <span className="block text-[14.5px] text-[#e9edef]">Chat theme</span>
              <span className="block text-[12.5px] text-[#8696a0]">Background badlein (sirf owner)</span>
            </span>
          </button>
        )}

        {/* members */}
        <SectionTitle>Members · {members.length}</SectionTitle>
        <div className="pb-2">
          {members.map((mb) => (
            <div key={mb.id} className="flex items-center gap-3 px-6 py-2.5 hover:bg-[#1f2c34] transition group">
              <Avatar name={mb.name} photoURL={mb.photoURL} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14.5px] text-[#e9edef] truncate">{mb.name}</span>
                  <RoleBadge role={mb.role} small />
                </div>
                <p className="text-[12.5px] text-[#8696a0] truncate">
                  {mb.id === me.id ? 'Aap' : fmtSeenHinglish(mb.lastSeen, mb.online)}
                </p>
              </div>
              {amOwner && mb.role !== 'Owner' && mb.id !== me.id && (
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    title="Mute"
                    disabled={actionBusy != null}
                    onClick={() => modAction('/mute', mb.id, mb.name)}
                    className="p-1.5 rounded-full text-[#8696a0] hover:bg-[#2a3942] hover:text-[#ffd447]"
                  >
                    <Icon d={ICONS.mute} size={16} />
                  </button>
                  <button
                    title="Warn"
                    disabled={actionBusy != null}
                    onClick={() => modAction('/warn', mb.id, mb.name)}
                    className="p-1.5 rounded-full text-[#8696a0] hover:bg-[#2a3942] hover:text-[#ff9f1c]"
                  >
                    <Icon d={ICONS.info} size={16} />
                  </button>
                  <button
                    title="Ban"
                    disabled={actionBusy != null}
                    onClick={() => { if (confirm(`${mb.name} ko ban karein?`)) modAction('/ban', mb.id, mb.name); }}
                    className="p-1.5 rounded-full text-[#8696a0] hover:bg-[#2a3942] hover:text-[#ea0038]"
                  >
                    <Icon d={ICONS.x} size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* rules */}
        <div className="border-t border-[#222d34]">
          <div className="flex items-center justify-between px-6 pt-5 pb-1">
            <p className="text-[13px] font-medium text-[#00a884]">Group Rules</p>
            {amOwner && !editingRules && (
              <button onClick={() => { setRulesDraft(rules.join('\n')); setEditingRules(true); }} className="p-1.5 text-[#8696a0] hover:text-[#00a884]" title="Edit karein">
                <Icon d={ICONS.edit} size={16} />
              </button>
            )}
          </div>
          <div className="px-6 pb-5">
            {editingRules ? (
              <div className="space-y-2">
                <textarea
                  value={rulesDraft}
                  onChange={(e) => setRulesDraft(e.target.value)}
                  rows={6}
                  className="w-full bg-[#1f2c34] rounded-xl px-3 py-2.5 text-[13.5px] text-[#e9edef] outline-none focus:ring-1 focus:ring-[#00a884] v4scroll"
                  placeholder="Har line par ek rule…"
                />
                <div className="flex gap-2">
                  <button onClick={saveRules} className="flex-1 bg-[#00a884] hover:bg-[#06cf9c] text-white text-[13.5px] font-medium rounded-xl py-2 transition">Save</button>
                  <button onClick={() => setEditingRules(false)} className="px-4 text-[13.5px] text-[#8696a0] hover:text-white">Cancel</button>
                </div>
              </div>
            ) : (
              <ol className="space-y-2">
                {rules.map((r, i) => (
                  <li key={i} className="flex gap-2.5 text-[13.5px] text-[#d1d7db] leading-relaxed">
                    <span className="text-[#00a884] font-medium shrink-0">{i + 1}.</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* media */}
        {media.length > 0 && (
          <div className="border-t border-[#222d34]">
            <SectionTitle>Media</SectionTitle>
            <div className="grid grid-cols-3 gap-1 px-4 pb-6">
              {media.map((m) => (
                <a key={m.id} href={m.mediaURL} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden bg-[#1f2c34] hover:opacity-85 transition">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.mediaURL} alt="" className="w-full h-full object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {modMsg && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1f2c34] border border-[#2a3942] text-[#e9edef] text-[13px] rounded-full px-5 py-2.5 shadow-2xl animate-[v4pop_.18s_ease-out] max-w-[92%] truncate">
          {modMsg}
        </div>
      )}
    </aside>
  );
}
