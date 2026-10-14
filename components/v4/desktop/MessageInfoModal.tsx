'use client';

/**
 * MessageInfoModal — WhatsApp style message info.
 * Bheja / deliver / parha ke exact waqt (v3 getMessageInfo) + parhne walon ki
 * list (getMessageReaders) with avatars.
 */

import { useEffect, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat, ChatMessage, MessageInfo, ReaderInfo } from '@/lib/backend/types';
import Avatar from '@/components/Avatar';
import { fmtTime } from '@/lib/format';
import { Icon, ICONS, Modal, SectionTitle, backendV3, v4call } from './common';

interface Props {
  message: ChatMessage;
  chat: Chat;
  onClose(): void;
}

export default function MessageInfoModal({ message: m, chat, onClose }: Props) {
  const [readers, setReaders] = useState<ReaderInfo[] | null>(null);
  const [info, setInfo] = useState<MessageInfo | null>(null);

  useEffect(() => {
    backend.getMessageReaders(chat.id, m.id).then(setReaders).catch(() => setReaders([]));
    v4call(() => backendV3.getMessageInfo(m.id)).then((r) => { if (r) setInfo(r); });
  }, [chat.id, m.id]);

  const deliveredTo = (m.readBy || []).filter((u) => u !== m.senderId);
  const others = chat.participants.filter((p) => p !== m.senderId);

  return (
    <Modal title="Message info" onClose={onClose}>
      <div className="px-5 py-4">
        <p className="text-[13.5px] text-[#e9edef] bg-[#1f2c34] rounded-xl px-4 py-3 mb-4 break-words">
          {m.text || `[${m.type}]`}
        </p>
        <div className="space-y-2.5 text-[13.5px]">
          <InfoRow icon={ICONS.check} label="Bheja gaya" value={fmtTime(info?.sentAt ?? m.createdAt)} />
          <InfoRow
            icon={ICONS.check}
            label="Deliver hua"
            value={info?.deliveredAt ? fmtTime(info.deliveredAt) : `${deliveredTo.length}/${others.length} members`}
          />
          <InfoRow
            icon={ICONS.check}
            label="Parha gaya"
            value={info?.readAt ? fmtTime(info.readAt) : readers ? `${readers.length} members` : '…'}
          />
        </div>
        <SectionTitle>Parhne wale</SectionTitle>
        {!readers && <p className="text-[13px] text-[#8696a0] px-6">Load ho raha hai…</p>}
        {readers && readers.length === 0 && <p className="text-[13px] text-[#8696a0] px-6 pb-4">Abhi kisi ne nahi parha.</p>}
        <div className="max-h-[240px] overflow-y-auto v4scroll px-6 pb-4 -mx-0">
          {readers?.map((r) => (
            <div key={r.userId} className="flex items-center gap-3 py-2 border-b border-[#222d34] last:border-0">
              <Avatar name={r.displayName} size={38} />
              <span className="text-[14px] text-[#e9edef] truncate flex-1">{r.displayName}</span>
              <span className="text-[12px] text-[#8696a0] shrink-0">{fmtTime(r.readAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <Icon d={icon} size={17} className="text-[#8696a0]" />
      <span className="text-[#8696a0]">{label}</span>
      <span className="ml-auto text-[#e9edef] font-medium">{value}</span>
    </div>
  );
}
