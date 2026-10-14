'use client';

/**
 * IconRail — far-left navigation rail (WhatsApp Web new dark UI).
 * 64px, #1f2c34. Top: chats, groups, settings. Bottom: profile avatar.
 * Active icon par green pill highlight.
 */

import Avatar from '@/components/Avatar';
import type { UserProfile } from '@/lib/backend/types';
import { Icon, ICONS } from './common';

export type RailTab = 'chats' | 'groups' | 'settings';

interface Props {
  me: UserProfile;
  tab: RailTab;
  onTab(t: RailTab): void;
  onProfile(): void;
}

export default function IconRail({ me, tab, onTab, onProfile }: Props) {
  return (
    <nav className="w-16 shrink-0 bg-[#1f2c34] flex flex-col items-center py-3 z-40" aria-label="Navigation">
      <div className="flex flex-col items-center gap-1.5 flex-1">
        <RailBtn
          active={tab === 'chats'}
          title="Chats"
          onClick={() => onTab('chats')}
        >
          <Icon d={ICONS.chat} size={24} />
        </RailBtn>
        <RailBtn
          active={tab === 'groups'}
          title="Groups"
          onClick={() => onTab('groups')}
        >
          <Icon d={ICONS.groups} size={24} />
        </RailBtn>
        <RailBtn
          active={tab === 'settings'}
          title="Settings"
          onClick={() => onTab('settings')}
        >
          <Icon d={ICONS.settings} size={24} />
        </RailBtn>
      </div>
      <button
        onClick={onProfile}
        className="mt-2 rounded-full ring-2 ring-transparent hover:ring-[#00a884]/60 transition p-[2px]"
        title={me.displayName}
      >
        <Avatar name={me.displayName} photoURL={me.photoURL} size={38} />
      </button>
    </nav>
  );
}

function RailBtn({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="relative w-12 h-12 rounded-full flex items-center justify-center transition group"
    >
      {/* green pill highlight */}
      <span
        className={`absolute inset-x-1 inset-y-[7px] rounded-full transition-all duration-200 ${
          active ? 'bg-[#00a884]/20 scale-100 opacity-100' : 'bg-[#8696a0]/0 scale-75 opacity-0 group-hover:bg-[#8696a0]/15 group-hover:scale-100 group-hover:opacity-100'
        }`}
      />
      <span className={`relative transition-colors ${active ? 'text-[#00a884]' : 'text-[#8696a0] group-hover:text-[#d1d7db]'}`}>
        {children}
      </span>
    </button>
  );
}
