// components/v1/GroupDescriptionEditor.tsx
// Group ki description/tafseel edit karne ka component.
//
// Props:
//   chat: Chat — group jiski description edit ho rahi hai (chat.description ?? "" se prefill).
//   onSave: (desc: string) => void — parent isay backend.setGroupDescription se wire kare.
//
// Example:
//   <GroupDescriptionEditor chat={chat} onSave={(desc) => backend.setGroupDescription(chat.id, desc)} />
//
// Behaviour:
// - Textarea chat.description se prefilled hoti hai.
// - "Mehfooz karein" → onSave(trimmed text). "Mansookh" → asl text par wapas.
'use client';

import { useState } from 'react';
import type { Chat } from '@/lib/backend/types';

export default function GroupDescriptionEditor({
  chat,
  onSave,
}: {
  chat: Chat;
  onSave: (desc: string) => void;
}) {
  const original = chat.description ?? '';
  const [desc, setDesc] = useState(original);
  const [saving, setSaving] = useState(false);

  const dirty = desc !== original;

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await Promise.resolve(onSave(desc.trim()));
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => setDesc(original);

  return (
    <div className="bg-[#111b21] rounded-xl border border-[#222d34] p-4 w-full">
      <h3 className="text-white font-semibold text-base mb-1">Group ki Tafseel</h3>
      <p className="text-[#8696a0] text-xs mb-3">Naye members ko group ke usool nazar ayenge.</p>

      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Group ke usool likhein, jaise: sirf deeni guftagu"
        rows={3}
        maxLength={500}
        className="w-full bg-[#202c33] text-white rounded-lg px-3 py-2.5 text-sm outline-none placeholder-[#8696a0] resize-none mb-1 focus:ring-1 focus:ring-[#00a884]"
      />
      <p className="text-[#8696a0] text-[11px] mb-3 text-right">{desc.length}/500</p>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="bg-[#00a884] hover:bg-[#06cf9c] disabled:opacity-40 disabled:cursor-not-allowed text-[#0b141a] font-semibold text-sm rounded-lg px-4 py-2"
        >
          {saving ? 'Mehfooz ho raha...' : 'Mehfooz karein'}
        </button>
        {dirty && (
          <button
            onClick={cancel}
            className="bg-[#202c33] hover:bg-[#2a3942] text-white text-sm rounded-lg px-4 py-2"
          >
            Mansookh
          </button>
        )}
      </div>
    </div>
  );
}
