// components/v1/ScheduledComposer.tsx
// Scheduled messages composer + list for one chat.
//
// Props:
//   chatId: string — the chat the scheduled message belongs to.
//
// Example:
//   <ScheduledComposer chatId={chat.id} />
//
// Behaviour:
// - Type a message, pick date+time (min = ab se 5 minute baad), "Schedule karein"
//   dabayein → backend.scheduleMessage(chatId, { type: 'text', text }, sendAt).
// - Neeche ussi chat ke scheduled messages ki list hoti hai (backend
//   .getScheduledMessages() se, chatId par filtered). Har item par Hinglish me
//   bhejne ka waqt dikhta hai ("kal 10:30 AM") aur "Mansookh karein" button se
//   backend.cancelScheduledMessage(id) hota hai (optimistic remove).
'use client';

import { useCallback, useEffect, useState } from 'react';
import { backend } from '@/lib/backend';
import type { ScheduledMessage } from '@/lib/backend/types';

// datetime-local input ki value ke liye Date → "YYYY-MM-DDTHH:MM"
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// Waqt ko Hinglish me format karein: "aaj 10:30 AM", "kal 10:30 AM", ya "13 Oct, 10:30 AM"
function formatSendTime(sendAt: number, now: number): string {
  const d = new Date(sendAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const time = `${h}:${pad(d.getMinutes())} ${ampm}`;

  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return `aaj ${time}`;
  if (diffDays === 1) return `kal ${time}`;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}, ${time}`;
}

export default function ScheduledComposer({ chatId }: { chatId: string }) {
  const [text, setText] = useState('');
  const [when, setWhen] = useState('');
  const [items, setItems] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minDate = toLocalInputValue(new Date(Date.now() + 5 * 60 * 1000));

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const all = await backend.getScheduledMessages();
      setItems(all.filter((m) => m.chatId === chatId).sort((a, b) => a.sendAt - b.sendAt));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load nahi ho saka');
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    load();
  }, [load]);

  const schedule = async () => {
    const trimmed = text.trim();
    if (!trimmed || !when || saving) return;
    const sendAt = new Date(when).getTime();
    if (Number.isNaN(sendAt) || sendAt < Date.now() + 60 * 1000) {
      setError('Waqt kam az kam 5 minute baad ka chunein');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await backend.scheduleMessage(chatId, { type: 'text', text: trimmed }, sendAt);
      setText('');
      setWhen('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Schedule nahi ho saka');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: string) => {
    const prev = items;
    setItems((list) => list.filter((m) => m.id !== id)); // optimistic remove
    try {
      await backend.cancelScheduledMessage(id);
    } catch (e) {
      setItems(prev);
      setError(e instanceof Error ? e.message : 'Mansookh nahi ho saka');
    }
  };

  return (
    <div className="bg-[#111b21] rounded-xl border border-[#222d34] p-4 w-full">
      <h3 className="text-white font-semibold text-base mb-1">Scheduled Paigham</h3>
      <p className="text-[#8696a0] text-xs mb-3">Paigham likhein aur waqt chunein — wo khud bheja jayega.</p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paigham likhein"
        rows={2}
        className="w-full bg-[#202c33] text-white rounded-lg px-3 py-2.5 text-sm outline-none placeholder-[#8696a0] resize-none mb-2 focus:ring-1 focus:ring-[#00a884]"
      />
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="datetime-local"
          value={when}
          min={minDate}
          onChange={(e) => setWhen(e.target.value)}
          className="flex-1 bg-[#202c33] text-white rounded-lg px-3 py-2.5 text-sm outline-none [color-scheme:dark]"
        />
        <button
          onClick={schedule}
          disabled={!text.trim() || !when || saving}
          className="bg-[#00a884] hover:bg-[#06cf9c] disabled:opacity-40 disabled:cursor-not-allowed text-[#0b141a] font-semibold text-sm rounded-lg px-4 py-2.5 whitespace-nowrap"
        >
          {saving ? 'Rukhein...' : 'Schedule karein'}
        </button>
      </div>

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

      <div className="mt-4">
        <h4 className="text-[#8696a0] text-xs font-semibold uppercase tracking-wide mb-2">Scheduled</h4>
        {loading ? (
          <p className="text-[#8696a0] text-sm">Load ho raha hai...</p>
        ) : items.length === 0 ? (
          <p className="text-[#8696a0] text-sm">Koi scheduled paigham nahi hai.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((m) => (
              <li
                key={m.id}
                className="bg-[#202c33] rounded-lg px-3 py-2.5 flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-white text-sm truncate">{m.input.text}</p>
                  <p className="text-[#00a884] text-xs mt-0.5">{formatSendTime(m.sendAt, Date.now())}</p>
                </div>
                <button
                  onClick={() => cancel(m.id)}
                  className="text-[#8696a0] hover:text-red-400 text-xs shrink-0 mt-0.5"
                >
                  Mansookh karein
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
