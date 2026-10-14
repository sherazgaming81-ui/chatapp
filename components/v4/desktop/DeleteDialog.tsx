'use client';

/**
 * DeleteDialog — WhatsApp jaisa delete dialog.
 * "Sirf mere liye" / "Sab ke liye" (sirf apne messages, 2 din ke andar) / Cancel.
 */

import { Icon, ICONS } from './common';

export const DELETE_FOR_EVERYONE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; // 2 din

export function canDeleteForEveryone(senderId: string, meId: string, createdAt: number): boolean {
  return senderId === meId && Date.now() - createdAt < DELETE_FOR_EVERYONE_WINDOW_MS;
}

interface Props {
  preview: string;
  count?: number;
  allowForEveryone: boolean;
  busy?: boolean;
  onPick(choice: 'me' | 'everyone'): void;
  onClose(): void;
}

export default function DeleteDialog({ preview, count = 1, allowForEveryone, busy, onPick, onClose }: Props) {
  const n = count > 1 ? `${count} messages` : 'yeh message';
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/60 animate-[v4fade_.15s_ease-out]" onClick={onClose} />
      <div className="relative bg-[#111b21] text-[#e9edef] rounded-2xl shadow-2xl border border-[#222d34] w-full max-w-[380px] overflow-hidden animate-[v4pop_.18s_ease-out]">
        <div className="px-5 pt-5 pb-2">
          <div className="w-12 h-12 rounded-full bg-[#ea0038]/10 text-[#ea0038] flex items-center justify-center mb-3">
            <Icon d={ICONS.trash} size={22} />
          </div>
          <h2 className="text-[17px] font-medium mb-1.5">
            {count > 1 ? `${count} messages delete karein?` : 'Message delete karein?'}
          </h2>
          <p className="text-[13.5px] text-[#8696a0] leading-relaxed bg-[#1f2c34] rounded-xl px-3 py-2 mt-2 break-words max-h-[76px] overflow-hidden">
            “{preview}”
          </p>
          {!allowForEveryone && (
            <p className="text-[12.5px] text-[#8696a0] leading-relaxed mt-2.5">
              Time limit khatam ho chuki hai — ab sirf apne liye delete ho sakta hai.
            </p>
          )}
        </div>
        <div className="p-3 pt-2 flex flex-col gap-1">
          {allowForEveryone && (
            <button
              onClick={() => onPick('everyone')}
              disabled={busy}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-[#ea0038] font-medium text-[14.5px] hover:bg-[#ea0038]/10 transition disabled:opacity-50"
            >
              <Icon d={ICONS.trash} size={19} />
              Sab ke liye delete karein
            </button>
          )}
          <button
            onClick={() => onPick('me')}
            disabled={busy}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-[14.5px] hover:bg-[#1f2c34] transition disabled:opacity-50"
          >
            <Icon d={ICONS.user} size={19} className="text-[#8696a0]" />
            Sirf mere liye delete karein
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="w-full px-4 py-3 rounded-xl text-[14.5px] font-medium text-[#00a884] hover:bg-[#00a884]/10 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <p className="text-center text-[11.5px] text-[#8696a0] px-2">
            {allowForEveryone
              ? `“Sab ke liye” dabane par ${n} sab members ke paas se hat jayega.`
              : `“Mere liye” dabane par ${n} sirf aapke paas se hatega.`}
          </p>
        </div>
      </div>
    </div>
  );
}
