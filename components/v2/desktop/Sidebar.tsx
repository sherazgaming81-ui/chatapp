'use client';

/**
 * Sidebar — desktop chat list panel.
 * Header (avatar, new chat/group, widget, settings) · search · tabs (All/Unread/Groups) · chat rows.
 */

import { useMemo, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat, UserProfile } from '@/lib/backend/types';
import Avatar from '@/components/Avatar';
import { fmtListTime } from '@/lib/format';
import { Icon, ICONS, Popover, Modal } from './common';

type Tab = 'all' | 'unread' | 'groups';

interface Props {
  me: UserProfile;
  chats: Chat[];
  selectedId: string | null;
  onSelect(id: string): void;
  onOpenSettings(): void;
  onOpenWidget(): void;
}

export default function Sidebar({ me, chats, selectedId, onSelect, onOpenSettings, onOpenWidget }: Props) {
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);

  const unreadCount = (c: Chat) => {
    const lm = c.lastMessage;
    if (!lm) return 0;
    return 0; // unread per-user tracking nahi hai v1 me — filter tab kaam karega jab data ho
  };

  const rows = useMemo(() => {
    let list = [...chats].sort((a, b) => (b.lastMessage?.createdAt ?? b.updatedAt ?? 0) - (a.lastMessage?.createdAt ?? a.updatedAt ?? 0));
    if (tab === 'groups') list = list.filter((c) => c.type === 'group');
    if (tab === 'unread') list = list.filter((c) => unreadCount(c) > 0);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || c.lastMessage?.text.toLowerCase().includes(q));
    return list;
  }, [chats, tab, query]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0">
        <button className="flex items-center gap-2.5 rounded-lg p-1 -ml-1 hover:bg-[var(--v2-hover)] transition" title={me.displayName}>
          <Avatar name={me.displayName} photoURL={me.photoURL} size={38} />
          <span className="text-[15px] font-semibold truncate max-w-[120px] hidden min-[1150px]:block">{me.displayName}</span>
        </button>
        <div className="flex items-center gap-0.5 text-[var(--v2-muted)]">
          <button
            onClick={onOpenWidget}
            className="p-2 rounded-full hover:bg-[var(--v2-hover)] transition"
            title="Recent chats widget"
          >
            <Icon d={ICONS.poll} size={21} />
          </button>
          <button
            onClick={() => setNewChatOpen(true)}
            className="p-2 rounded-full hover:bg-[var(--v2-hover)] transition"
            title="Nayi chat / group"
          >
            <Icon d={ICONS.userPlus} size={21} />
          </button>
          <div className="relative">
            <button
              onClick={() => setMenu((m) => !m)}
              className="p-2 rounded-full hover:bg-[var(--v2-hover)] transition"
              title="Menu"
            >
              <Icon d={ICONS.settings} size={21} />
            </button>
            {menu && (
              <Popover onClose={() => setMenu(false)} className="right-0 top-11">
                <MenuItem label="Settings" icon={ICONS.settings} onClick={() => { setMenu(false); onOpenSettings(); }} />
                <MenuItem label="Logout" icon={ICONS.logout} onClick={() => { setMenu(false); backend.signOut().catch(() => {}); }} />
              </Popover>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-2 shrink-0">
        <div className="flex items-center gap-2 bg-[var(--v2-input)] rounded-lg px-3 py-[7px]">
          <Icon d={ICONS.search} size={17} className="text-[var(--v2-muted)] shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ya nayi chat shuru karein"
            className="bg-transparent outline-none text-[13.5px] w-full text-[var(--v2-text)]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[var(--v2-muted)] hover:text-[var(--v2-text)]">
              <Icon d={ICONS.x} size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 px-3 pb-2.5 shrink-0">
        {([['all', 'All'], ['unread', 'Unread'], ['groups', 'Groups']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-[5px] rounded-full text-[13px] font-medium transition whitespace-nowrap ${
              tab === t
                ? 'bg-[var(--v2-accent-soft)] text-[var(--v2-accent)]'
                : 'bg-[var(--v2-input)] text-[var(--v2-muted)] hover:text-[var(--v2-text)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chat rows */}
      <div className="flex-1 overflow-y-auto v2scroll min-h-0">
        {rows.length === 0 && (
          <div className="px-6 py-10 text-center text-[13.5px] text-[var(--v2-muted)] leading-relaxed">
            {query ? 'Koi chat nahi mili.' : tab === 'groups' ? 'Abhi koi group nahi hai.' : 'Abhi koi chat nahi. Nayi chat shuru karein!'}
          </div>
        )}
        {rows.map((c, i) => (
          <ChatRow
            key={c.id}
            chat={c}
            meId={me.id}
            selected={c.id === selectedId}
            index={i}
            onSelect={() => onSelect(c.id)}
          />
        ))}
      </div>

      {newChatOpen && <NewChatModal meId={me.id} onClose={() => setNewChatOpen(false)} onDone={onSelect} />}
    </div>
  );
}

function MenuItem({ label, icon, onClick }: { label: string; icon: string; onClick(): void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[var(--v2-text)] hover:bg-[var(--v2-hover)] transition text-left"
    >
      <Icon d={icon} size={18} className="text-[var(--v2-muted)]" />
      {label}
    </button>
  );
}

function ChatRow({ chat, meId, selected, index, onSelect }: { chat: Chat; meId: string; selected: boolean; index: number; onSelect(): void }) {
  const lm = chat.lastMessage;
  const preview = lm
    ? lm.type === 'image'
      ? '📷 Photo'
      : lm.type === 'audio'
        ? '🎤 Voice message'
        : lm.type === 'poll'
          ? '📊 Poll'
          : lm.type === 'file'
            ? `📎 ${lm.text || 'File'}`
            : lm.text
    : 'Chat shuru karein';
  const unread = 0; // v1 backend me per-user unread nahi — tab ke liye placeholder

  return (
    <button
      onClick={onSelect}
      className={`v2rowin w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors relative ${
        selected ? 'bg-[var(--v2-active)]' : 'hover:bg-[var(--v2-hover)]'
      }`}
      style={{ animationDelay: `${Math.min(index, 14) * 30}ms` }}
    >
      <Avatar name={chat.name} photoURL={chat.photoURL} size={48} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] text-[var(--v2-text)] truncate font-normal">{chat.name}</span>
          {lm && (
            <span className={`text-[11.5px] shrink-0 ${unread > 0 ? 'text-[var(--v2-accent)] font-medium' : 'text-[var(--v2-muted)]'}`}>
              {fmtListTime(lm.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-[3px]">
          <span className="text-[13px] text-[var(--v2-muted)] truncate">
            {lm?.senderId === meId && lm.type === 'text' ? 'Aap: ' : ''}
            {preview}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            {unread > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--v2-accent)] text-white text-[11.5px] font-semibold flex items-center justify-center">
                {unread}
              </span>
            )}
          </span>
        </div>
      </div>
    </button>
  );
}

function NewChatModal({ meId, onClose, onDone }: { meId: string; onClose(): void; onDone(id: string): void }) {
  const [mode, setMode] = useState<'chat' | 'group'>('chat');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [picked, setPicked] = useState<UserProfile[]>([]);
  const [groupName, setGroupName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const search = async (v: string) => {
    setQ(v);
    if (v.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      const r = await backend.searchUsers(v.trim());
      setResults(r.filter((u) => u.id !== meId).slice(0, 12));
    } catch {
      setResults([]);
    }
  };

  const togglePick = (u: UserProfile) =>
    setPicked((p) => (p.some((x) => x.id === u.id) ? p.filter((x) => x.id !== u.id) : [...p, u]));

  const create = async () => {
    setBusy(true);
    setErr('');
    try {
      if (mode === 'chat') {
        const u = picked[0];
        if (!u) throw new Error('Kisi ko chunein');
        const id = await backend.getOrCreateDirectChat(u.id);
        onDone(id);
        onClose();
      } else {
        if (!groupName.trim()) throw new Error('Group ka naam likhein');
        if (picked.length === 0) throw new Error('Kam az kam 1 member chunein');
        const id = await backend.createGroup(groupName.trim(), picked.map((p) => p.id));
        onDone(id);
        onClose();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Nahi ho saka');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={mode === 'chat' ? 'Nayi chat' : 'Naya group'} onClose={onClose}>
      <div className="p-4">
        <div className="flex gap-2 mb-4">
          {(['chat', 'group'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setPicked([]); }}
              className={`flex-1 py-2 rounded-lg text-[14px] font-medium transition ${
                mode === m ? 'bg-[var(--v2-accent-soft)] text-[var(--v2-accent)]' : 'bg-[var(--v2-input)] text-[var(--v2-muted)]'
              }`}
            >
              {m === 'chat' ? 'Direct chat' : 'Group'}
            </button>
          ))}
        </div>
        {mode === 'group' && (
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group ka naam…"
            className="w-full bg-[var(--v2-input)] rounded-lg px-3.5 py-2.5 text-[14px] outline-none mb-3 text-[var(--v2-text)]"
          />
        )}
        <div className="flex items-center gap-2 bg-[var(--v2-input)] rounded-lg px-3 py-2 mb-2">
          <Icon d={ICONS.search} size={17} className="text-[var(--v2-muted)]" />
          <input
            value={q}
            onChange={(e) => search(e.target.value)}
            placeholder="Naam ya email se dhoondein…"
            className="bg-transparent outline-none text-[14px] w-full text-[var(--v2-text)]"
          />
        </div>
        {picked.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {picked.map((p) => (
              <button
                key={p.id}
                onClick={() => togglePick(p)}
                className="flex items-center gap-1.5 bg-[var(--v2-accent-soft)] text-[var(--v2-accent)] rounded-full pl-1 pr-2.5 py-1 text-[12.5px]"
              >
                <Avatar name={p.displayName} photoURL={p.photoURL} size={20} />
                {p.displayName}
                <Icon d={ICONS.x} size={13} />
              </button>
            ))}
          </div>
        )}
        <div className="max-h-[260px] overflow-y-auto v2scroll">
          {results.map((u) => {
            const isPicked = picked.some((p) => p.id === u.id);
            return (
              <button
                key={u.id}
                onClick={() => (mode === 'chat' ? (setPicked([u]), null) : togglePick(u))}
                className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition ${isPicked ? 'bg-[var(--v2-accent-soft)]' : 'hover:bg-[var(--v2-hover)]'}`}
              >
                <Avatar name={u.displayName} photoURL={u.photoURL} size={40} />
                <span className="text-left min-w-0">
                  <span className="block text-[14.5px] truncate text-[var(--v2-text)]">{u.displayName}</span>
                  <span className="block text-[12.5px] truncate text-[var(--v2-muted)]">{u.email}</span>
                </span>
                {isPicked && <Icon d={ICONS.check} size={18} className="ml-auto text-[var(--v2-accent)]" />}
              </button>
            );
          })}
          {q.trim().length >= 2 && results.length === 0 && (
            <p className="text-center text-[13px] text-[var(--v2-muted)] py-6">Koi user nahi mila.</p>
          )}
        </div>
        {err && <p className="text-[#ea0038] text-[13px] mt-2">{err}</p>}
        <button
          onClick={create}
          disabled={busy || picked.length === 0}
          className="w-full mt-4 py-2.5 rounded-full bg-[var(--v2-accent)] text-white text-[14.5px] font-medium hover:brightness-110 transition disabled:opacity-50"
        >
          {busy ? 'Ban raha hai…' : mode === 'chat' ? 'Chat shuru karein' : 'Group banayein'}
        </button>
      </div>
    </Modal>
  );
}
