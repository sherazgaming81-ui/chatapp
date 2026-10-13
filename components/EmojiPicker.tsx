'use client';

const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','😘','😎','🤔','😐','😑','😴','😷','🤒','😭','😡',
  '👍','👎','👏','🙏','👋','✌️','🤝','💪','👀','🧠','❤️','💔','💯','🔥','🎉',
  '🎂','⚽','🏏','🎮','🚗','✈️','☕','🍕','🍲','🌙','☀️','🌧️','⭐','✅','❌',
  '⏰','💡','🎵','📷','🎤','💼','🏠','👨‍👩‍👧','🐱','🐶','🌹','🍀','🕌','🇵🇰',
];

export default function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-14 left-2 z-50 bg-[#233138] rounded-xl p-3 shadow-2xl border border-[#2a3942] w-[300px]">
        <div className="grid grid-cols-8 gap-1 max-h-[240px] overflow-y-auto">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => onPick(e)}
              className="text-2xl p-1.5 rounded-lg hover:bg-[#2a3942] transition"
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
