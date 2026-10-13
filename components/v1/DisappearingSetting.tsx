// DisappearingSetting — disappearing messages ka timer picker.
// Props: { current: number; onChange: (seconds: number) => void }
// Radio list: 0 "Band", 86400 "24 ghante", 604800 "7 din", 7776000 "90 din".
// Select karne par turant onChange(seconds) hota hai; parent isko
// backend.setDisappearingAfter(seconds) par wire kare.
// "Naye messages itne waqt baad auto-delete honge (sirf aap ke liye setting)".
// Example:
//   <DisappearingSetting current={me.disappearingAfter ?? 0}
//     onChange={(s) => backend.setDisappearingAfter(s)} />
'use client';

const OPTIONS: { seconds: number; label: string }[] = [
  { seconds: 0, label: 'Band' },
  { seconds: 86400, label: '24 ghante' },
  { seconds: 604800, label: '7 din' },
  { seconds: 7776000, label: '90 din' },
];

export default function DisappearingSetting({
  current,
  onChange,
}: {
  current: number;
  onChange: (seconds: number) => void;
}) {
  return (
    <div className="rounded-xl bg-[#111b21] text-white">
      <div className="bg-[#202c33] px-4 py-3 rounded-t-xl">
        <h2 className="text-base font-semibold">Disappearing messages</h2>
      </div>
      <p className="px-4 pt-3 text-xs leading-relaxed text-[#8696a0]">
        Naye messages itne waqt baad auto-delete honge (sirf aap ke liye setting)
      </p>
      <div className="py-2">
        {OPTIONS.map(({ seconds, label }) => {
          const active = current === seconds;
          return (
            <button
              key={seconds}
              onClick={() => onChange(seconds)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#202c33]/60"
              role="radio"
              aria-checked={active}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                  active ? 'border-[#00a884]' : 'border-[#8696a0]'
                }`}
              >
                {active && <span className="h-2.5 w-2.5 rounded-full bg-[#00a884]" />}
              </span>
              <span className={`text-sm ${active ? 'text-white font-medium' : 'text-[#d1d7db]'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
