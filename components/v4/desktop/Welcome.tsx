'use client';

/**
 * Welcome — koi chat select na ho to (WhatsApp Web style welcome screen).
 * Centered ChatsApp logo, "ChatsApp Web" heading, Hinglish subtitle, green button.
 */

import { Icon, ICONS } from './common';

export default function Welcome({ onNewChat }: { onNewChat(): void }) {
  return (
    <div className="v4wallpaper flex-1 h-full flex flex-col items-center justify-center text-center px-10 select-none animate-[v4welcomefade_.4s_ease-out]">
      <div className="relative">
        <img
          src="/logo.png"
          alt="ChatsApp"
          className="w-28 h-28 rounded-[28px] object-cover shadow-2xl"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          draggable={false}
        />
        <span className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center shadow-lg">
          <Icon d={ICONS.chat} size={18} className="text-white" />
        </span>
      </div>

      <h1 className="text-[32px] font-light text-[#e9edef] mt-8 mb-3 tracking-tight">ChatsApp Web</h1>
      <p className="text-[14.5px] text-[#8696a0] max-w-[460px] leading-relaxed">
        Ab aap apne doston ko seedha computer se message bhej aur receive kar sakte hain —
        tez, mehfooz aur bilkul WhatsApp jaisa.
      </p>

      <button
        onClick={onNewChat}
        className="mt-8 flex items-center gap-2.5 px-7 py-3 rounded-full bg-[#00a884] text-white text-[15px] font-medium hover:brightness-110 transition shadow-xl"
      >
        <Icon d={ICONS.pencil} size={18} />
        Nayi chat shuru karein
      </button>

      <div className="mt-12 flex items-center gap-2 text-[#8696a0]">
        <Icon d={ICONS.lock} size={15} />
        <p className="text-[13px]">Aapki baatein sirf aapki — private aur mehfooz</p>
      </div>
    </div>
  );
}
