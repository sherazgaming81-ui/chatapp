'use client';

/**
 * ProfilePicEditor — desktop profile photo section.
 * Upload ke liye shared ProfilePicButton (mobile + desktop dono par same),
 * fullscreen view (PhotoViewer) aur remove desktop wrapper me.
 */

import { useState } from 'react';
import { backend } from '@/lib/backend';
import ProfilePicButton from '../shared/ProfilePicButton';
import { Icon, ICONS } from './common';
import PhotoViewer from './PhotoViewer';

interface Props {
  name: string;
  photoURL?: string;
  size?: number;
  /** chhota inline variant (wizard waghera ke liye) */
  compact?: boolean;
}

export default function ProfilePicEditor({ name, photoURL, size = 110, compact }: Props) {
  const [msg, setMsg] = useState('');
  const [viewer, setViewer] = useState(false);
  const [removing, setRemoving] = useState(false);

  const flash = (t: string) => {
    setMsg(t);
    setTimeout(() => setMsg(''), 2600);
  };

  // shared button ka onUpload — mobile wala flow: profile-photos path par upload
  const upload = async (f: File) => {
    if (!f.type.startsWith('image/')) throw new Error('Sirf image file chunein');
    const { url } = await backend.uploadMedia('profile-photos', f);
    await backend.updateProfile({ photoURL: url });
    flash('Profile photo update ho gayi.');
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await backend.updateProfile({ photoURL: '' });
      flash('Profile photo hata di gayi.');
    } catch {
      flash('Nahi ho saka.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className={compact ? 'flex items-center gap-4' : 'flex flex-col items-center'}>
      <ProfilePicButton photoURL={photoURL} name={name} size={compact ? 64 : size} onUpload={upload} />
      <div className={compact ? 'flex flex-col gap-1.5 items-start' : 'flex items-center gap-4 mt-3'}>
        {photoURL && (
          <button
            onClick={() => setViewer(true)}
            className="flex items-center gap-1.5 text-[12.5px] text-[var(--v2-accent)] font-medium hover:underline"
          >
            <Icon d={ICONS.search} size={14} />
            Bari photo dekhein
          </button>
        )}
        {photoURL && (
          <button
            onClick={remove}
            disabled={removing}
            className="text-[12.5px] text-[#ea0038] font-medium hover:underline disabled:opacity-50"
          >
            {removing ? 'Hata rahe hain…' : 'Photo hatayein'}
          </button>
        )}
        {!compact && !photoURL && (
          <p className="text-[12px] text-[var(--v2-muted)]">Photo lagane ke liye camera button dabayein</p>
        )}
      </div>
      {msg && <p className="text-[12.5px] text-[var(--v2-muted)] mt-2">{msg}</p>}
      {viewer && photoURL && <PhotoViewer src={photoURL} caption={name} onClose={() => setViewer(false)} />}
    </div>
  );
}
