'use client';

import { useEffect, useState } from 'react';
import { backend } from '@/lib/backend';
import type { UserProfile } from '@/lib/backend/types';
import Avatar from './Avatar';

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-[#111b21] rounded-xl w-full max-w-md max-h-[80vh] flex flex-col border border-[#222d34]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222d34]">
          <h2 className="text-white font-semibold text-lg">{title}</h2>
          <button onClick={onClose} className="text-[#8696a0] hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function NewChatModal({ onClose, onChatCreated }: { onClose: () => void; onChatCreated: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await backend.searchUsers(q);
        if (alive) setUsers(res);
      } finally {
        if (alive) setLoading(false);
      }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const start = async (u: UserProfile) => {
    const id = await backend.getOrCreateDirectChat(u.id);
    onChatCreated(id);
    onClose();
  };

  return (
    <ModalShell title="New chat" onClose={onClose}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Naam ya email se dhoondein..."
        className="w-full bg-[#202c33] text-white rounded-lg px-4 py-2.5 outline-none placeholder-[#8696a0] mb-3"
      />
      {loading && <p className="text-[#8696a0] text-sm">Dhoond rahe hain...</p>}
      <div className="space-y-1">
        {users.map((u) => (
          <button key={u.id} onClick={() => start(u)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#202c33] transition text-left">
            <Avatar name={u.displayName} photoURL={u.photoURL} size={44} />
            <div className="min-w-0">
              <p className="text-white font-medium truncate">{u.displayName}</p>
              <p className="text-[#8696a0] text-sm truncate">{u.about}</p>
            </div>
          </button>
        ))}
        {!loading && users.length === 0 && (
          <p className="text-[#8696a0] text-sm text-center py-6">Koi user nahi mila</p>
        )}
      </div>
    </ModalShell>
  );
}

export function NewGroupModal({ onClose, onChatCreated }: { onClose: () => void; onChatCreated: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const res = await backend.searchUsers(q);
      if (alive) setUsers(res);
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const toggle = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  };

  const create = async () => {
    if (!name.trim() || selected.size === 0) return;
    const id = await backend.createGroup(name.trim(), [...selected]);
    onChatCreated(id);
    onClose();
  };

  return (
    <ModalShell title={step === 1 ? 'Group members chunein' : 'Group ka naam'} onClose={onClose}>
      {step === 1 ? (
        <>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Members dhoondein..."
            className="w-full bg-[#202c33] text-white rounded-lg px-4 py-2.5 outline-none placeholder-[#8696a0] mb-3"
          />
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {users.map((u) => (
              <button key={u.id} onClick={() => toggle(u.id)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#202c33] transition text-left">
                <Avatar name={u.displayName} photoURL={u.photoURL} size={44} />
                <p className="text-white font-medium truncate flex-1">{u.displayName}</p>
                <div className={`w-5 h-5 rounded-full border-2 ${selected.has(u.id) ? 'bg-[#00a884] border-[#00a884]' : 'border-[#8696a0]'}`} />
              </button>
            ))}
          </div>
          <button
            disabled={selected.size === 0}
            onClick={() => setStep(2)}
            className="mt-4 w-full bg-[#00a884] text-[#0b141a] font-semibold rounded-full py-2.5 disabled:opacity-40 hover:bg-[#06cf9c] transition"
          >
            Agay ({selected.size} selected)
          </button>
        </>
      ) : (
        <>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group ka naam likhein..."
            className="w-full bg-[#202c33] text-white rounded-lg px-4 py-2.5 outline-none placeholder-[#8696a0] mb-4"
          />
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 bg-[#202c33] text-white rounded-full py-2.5 hover:bg-[#2a3942] transition">Peeche</button>
            <button
              disabled={!name.trim()}
              onClick={create}
              className="flex-1 bg-[#00a884] text-[#0b141a] font-semibold rounded-full py-2.5 disabled:opacity-40 hover:bg-[#06cf9c] transition"
            >
              Group banao
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

export function ProfileModal({ me, onClose }: { me: UserProfile; onClose: () => void }) {
  const [name, setName] = useState(me.displayName);
  const [about, setAbout] = useState(me.about);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await backend.updateProfile({ displayName: name.trim() || me.displayName, about: about.trim() });
    setSaving(false);
    onClose();
  };

  return (
    <ModalShell title="Profile" onClose={onClose}>
      <div className="flex flex-col items-center mb-5">
        <Avatar name={name} photoURL={me.photoURL} size={110} />
        <p className="text-[#8696a0] text-xs mt-2 break-all">{me.email}</p>
      </div>
      <label className="text-[#8696a0] text-xs">Aapka naam</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-[#202c33] text-white rounded-lg px-4 py-2.5 outline-none mb-4 mt-1"
      />
      <label className="text-[#8696a0] text-xs">About</label>
      <input
        value={about}
        onChange={(e) => setAbout(e.target.value)}
        className="w-full bg-[#202c33] text-white rounded-lg px-4 py-2.5 outline-none mb-5 mt-1"
      />
      <button
        onClick={save}
        disabled={saving}
        className="w-full bg-[#00a884] text-[#0b141a] font-semibold rounded-full py-2.5 disabled:opacity-40 hover:bg-[#06cf9c] transition"
      >
        {saving ? 'Save ho raha hai...' : 'Save karein'}
      </button>
      <button
        onClick={async () => { await backend.signOut(); onClose(); }}
        className="w-full mt-3 text-red-400 hover:text-red-300 text-sm py-2 transition"
      >
        Log out
      </button>
    </ModalShell>
  );
}
