// PrivacySettings — kaun aapka last seen, profile photo aur online status dekhe.
// Props: { me: UserProfile }
// Teen rows hain, har row tap par 'everyone' ("Sab") aur 'nobody' ("Koi nahi")
// ke darmiyan cycle karti hai. Init me.privacy se hota hai (defaults: everyone).
// Har change optimistic hai — pehle UI update, phir backend.updatePrivacy(patch),
// fail ho to wapas revert.
// Example:
//   <PrivacySettings me={me} />
'use client';

import { useState } from 'react';
import { backend } from '@/lib/backend';
import type { PrivacySettings as PrivacySettingsType, PrivacyLevel, UserProfile } from '@/lib/backend/types';

const DEFAULTS: PrivacySettingsType = { lastSeen: 'everyone', photo: 'everyone', online: 'everyone' };

const LEVEL_LABEL: Record<PrivacyLevel, string> = {
  everyone: 'Sab',
  nobody: 'Koi nahi',
};

const ROWS: { key: keyof PrivacySettingsType; label: string }[] = [
  { key: 'lastSeen', label: 'Last seen kaun dekhe' },
  { key: 'photo', label: 'Profile photo kaun dekhe' },
  { key: 'online', label: 'Online status kaun dekhe' },
];

export default function PrivacySettings({ me }: { me: UserProfile }) {
  const [privacy, setPrivacy] = useState<PrivacySettingsType>({ ...DEFAULTS, ...(me.privacy ?? {}) });
  const [saving, setSaving] = useState<string | null>(null);

  const toggle = async (key: keyof PrivacySettingsType) => {
    const prev = privacy[key];
    const next: PrivacyLevel = prev === 'everyone' ? 'nobody' : 'everyone';
    setPrivacy((p) => ({ ...p, [key]: next })); // optimistic
    setSaving(key);
    try {
      await backend.updatePrivacy({ [key]: next });
    } catch {
      setPrivacy((p) => ({ ...p, [key]: prev })); // revert on failure
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-xl bg-[#111b21] text-white">
      <div className="bg-[#202c33] px-4 py-3 rounded-t-xl">
        <h2 className="text-base font-semibold">Privacy</h2>
      </div>
      <div className="divide-y divide-[#202c33]">
        {ROWS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#202c33]/60"
          >
            <div>
              <p className="text-sm">{label}</p>
              <p className="text-xs text-[#8696a0]">
                {saving === key ? 'Mehfooz ho raha hai...' : `Filhaal: ${LEVEL_LABEL[privacy[key]]}`}
              </p>
            </div>
            <span className="flex items-center gap-2">
              <span className={`text-xs font-medium ${privacy[key] === 'everyone' ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                {LEVEL_LABEL[privacy[key]]}
              </span>
              <span className="text-[#8696a0]">›</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
