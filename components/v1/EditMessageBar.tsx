/**
 * EditMessageBar — inline edit bar that replaces the composer while editing.
 *
 * Usage:
 *   const [editing, setEditing] = useState<ChatMessage | null>(null);
 *   {editing ? (
 *     <EditMessageBar
 *       message={editing}
 *       onSave={(text) => { await backend.editMessage(editing.id, text); setEditing(null); }}
 *       onCancel={() => setEditing(null)}
 *     />
 *   ) : (
 *     <MessageInput ... />
 *   )}
 *
 * Prefilled textarea, "Mehfooz karein" (save) and "Mansookh" (cancel) buttons.
 * Esc cancels. Parent wires onSave → backend.editMessage.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/lib/backend/types';

export interface EditMessageBarProps {
  message: ChatMessage;
  onSave: (text: string) => void;
  onCancel: () => void;
}

export function EditMessageBar({ message, onSave, onCancel }: EditMessageBarProps) {
  const [text, setText] = useState(message.text);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    areaRef.current?.focus();
    // Put caret at end.
    const len = areaRef.current?.value.length ?? 0;
    areaRef.current?.setSelectionRange(len, len);
  }, []);

  const canSave = text.trim().length > 0 && text.trim() !== message.text.trim();

  const save = () => {
    if (!canSave) return;
    onSave(text.trim());
  };

  return (
    <div className="bg-[#1f2c34] px-3 py-2 border-t border-[#222d34]">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[#00a884] text-xl">✏️</span>
        <span className="text-[#00a884] text-sm font-medium">Message mein tabdeeli</span>
        <span className="flex-1" />
        <button
          onClick={onCancel}
          className="text-[#8696a0] hover:text-white text-xl leading-none"
          aria-label="Mansookh"
        >
          ×
        </button>
      </div>
      <textarea
        ref={areaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
          else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            save();
          }
        }}
        rows={3}
        className="w-full bg-[#2a3942] text-white rounded-lg px-3 py-2 text-sm outline-none resize-none focus:ring-1 focus:ring-[#00a884]"
      />
      <div className="flex justify-end gap-2 mt-2">
        <button
          onClick={onCancel}
          className="px-4 py-1.5 rounded-lg text-sm text-[#8696a0] hover:text-white hover:bg-[#2a3942] transition-colors"
        >
          Mansookh
        </button>
        <button
          onClick={save}
          disabled={!canSave}
          className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[#00a884] text-[#0b141a] hover:bg-[#06cf9c] disabled:opacity-40 disabled:hover:bg-[#00a884] transition-colors"
        >
          Mehfooz karein
        </button>
      </div>
    </div>
  );
}

export default EditMessageBar;
