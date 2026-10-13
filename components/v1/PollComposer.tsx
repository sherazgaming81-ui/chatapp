'use client';

import { useState } from 'react';
import { backend } from '@/lib/backend';

export default function PollComposer({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [sending, setSending] = useState(false);

  const addOption = () => {
    if (options.length < 10) setOptions([...options, '']);
  };

  const send = async () => {
    if (!question.trim() || options.filter((o) => o.trim()).length < 2 || sending) return;
    setSending(true);
    try {
      await backend.createPoll(chatId, question.trim(), options);
      onClose();
    } catch {
      alert('Poll nahi ban saka');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-[#111b21] rounded-xl w-full max-w-md border border-[#222d34]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222d34]">
          <h2 className="text-white font-semibold text-lg">📊 Poll banao</h2>
          <button onClick={onClose} className="text-[#8696a0] hover:text-white text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-3">
          <input
            autoFocus
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Sawal likhein... (jaise: kal dars kitne baje?)"
            className="w-full bg-[#202c33] text-white rounded-lg px-4 py-2.5 outline-none placeholder-[#8696a0]"
          />
          {options.map((o, i) => (
            <input
              key={i}
              value={o}
              onChange={(e) => {
                const n = [...options];
                n[i] = e.target.value;
                setOptions(n);
              }}
              placeholder={`Option ${i + 1}`}
              className="w-full bg-[#202c33] text-white rounded-lg px-4 py-2.5 outline-none placeholder-[#8696a0]"
            />
          ))}
          {options.length < 10 && (
            <button onClick={addOption} className="text-[#00a884] text-sm hover:underline">
              + Option add karein
            </button>
          )}
          <button
            onClick={send}
            disabled={sending}
            className="w-full bg-[#00a884] text-[#0b141a] font-semibold rounded-full py-2.5 disabled:opacity-40 hover:bg-[#06cf9c] transition"
          >
            {sending ? 'Bhej rahe hain...' : 'Poll bhejein'}
          </button>
        </div>
      </div>
    </div>
  );
}
