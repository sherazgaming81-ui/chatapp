// ProfileEditor — apni profile edit karein: cover + photo, naam, about.
// Props: { me: UserProfile; onClose: () => void }
// FAST optimistic UX: file pick karte hi URL.createObjectURL se INSTANT local
// preview (upload wait nahi karta). "Mehfooz karein" dabane par changed files
// backend.uploadMedia('profile-photos', file) se upload hoti hain, phir
// backend.updateProfile({ displayName, photoURL, coverURL, about }). Save par
// "Mehfooz ho gaya ✓" dikhakar onClose() hota hai.
// Example:
//   {editing && <ProfileEditor me={me} onClose={() => setEditing(false)} />}
'use client';

import { useRef, useState } from 'react';
import { backend } from '@/lib/backend';
import type { UserProfile } from '@/lib/backend/types';

type SaveStatus = 'idle' | 'uploading' | 'saving' | 'done' | 'error';

export default function ProfileEditor({ me, onClose }: { me: UserProfile; onClose: () => void }) {
  const [name, setName] = useState(me.displayName ?? '');
  const [about, setAbout] = useState(me.about ?? '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [err, setErr] = useState<string | null>(null);

  const photoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const pick = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPrev: (u: string | null) => void,
  ) => {
    const f = e.target.files?.[0] ?? null;
    if (f) {
      setFile(f);
      setPrev(URL.createObjectURL(f)); // instant local preview
    }
    e.target.value = '';
  };

  const save = async () => {
    setErr(null);
    setStatus('uploading');
    try {
      const patch: Partial<Pick<UserProfile, 'displayName' | 'about' | 'photoURL' | 'coverURL'>> = {
        displayName: name.trim() || me.displayName,
        about: about.trim(),
      };
      if (photoFile) {
        const { url } = await backend.uploadMedia('profile-photos', photoFile);
        patch.photoURL = url;
      }
      if (coverFile) {
        const { url } = await backend.uploadMedia('profile-photos', coverFile);
        patch.coverURL = url;
      }
      setStatus('saving');
      await backend.updateProfile(patch);
      setStatus('done');
      setTimeout(onClose, 900);
    } catch (e) {
      setStatus('error');
      setErr(e instanceof Error ? e.message : 'Mehfooz nahi ho saka, phir koshish karein.');
    }
  };

  const uploadingText = photoFile && coverFile ? 'Photos upload ho rahi hain...' : 'Photo upload ho rahi hai...';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-[#111b21] text-white sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#202c33] px-4 py-3 rounded-t-2xl">
          <h2 className="text-base font-semibold">Profile</h2>
          <button onClick={onClose} className="text-[#8696a0] hover:text-white text-xl leading-none" aria-label="Band karein">✕</button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-4 pb-4">
          {/* Cover photo */}
          <div className="relative mt-3 h-28 overflow-hidden rounded-xl bg-[#0b141a]">
            {(coverPreview || me.coverURL) && (
              <img src={coverPreview || me.coverURL} alt="Cover" className="h-full w-full object-cover" />
            )}
            <button
              onClick={() => coverInput.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-black/30 text-sm text-white hover:bg-black/45"
            >
              📷 Cover photo badlein
            </button>
            <input ref={coverInput} type="file" accept="image/*" className="hidden"
              onChange={(e) => pick(e, setCoverFile, setCoverPreview)} />
          </div>

          {/* Profile photo */}
          <div className="mt-3 flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[#202c33]">
              {(photoPreview || me.photoURL) ? (
                <img src={photoPreview || me.photoURL} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl text-[#8696a0]">👤</div>
              )}
            </div>
            <button
              onClick={() => photoInput.current?.click()}
              className="rounded-lg bg-[#202c33] px-3 py-2 text-sm text-[#00a884] hover:bg-[#2a3942]"
            >
              📷 Photo badlein
            </button>
            <input ref={photoInput} type="file" accept="image/*" className="hidden"
              onChange={(e) => pick(e, setPhotoFile, setPhotoPreview)} />
          </div>

          {/* Naam */}
          <label className="mt-4 block text-xs text-[#8696a0]">Apna naam</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Apna naam likhein"
            className="mt-1 w-full rounded-lg bg-[#202c33] px-3 py-2 text-sm text-white placeholder-[#8696a0] outline-none focus:ring-1 focus:ring-[#00a884]"
          />

          {/* About */}
          <label className="mt-3 block text-xs text-[#8696a0]">About</label>
          <input
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            maxLength={140}
            placeholder="Kuch apne baare mein likhein"
            className="mt-1 w-full rounded-lg bg-[#202c33] px-3 py-2 text-sm text-white placeholder-[#8696a0] outline-none focus:ring-1 focus:ring-[#00a884]"
          />

          {/* Status */}
          {status === 'uploading' && <p className="mt-3 text-sm text-[#8696a0]">⏳ {uploadingText}</p>}
          {status === 'saving' && <p className="mt-3 text-sm text-[#8696a0]">⏳ Mehfooz ho raha hai...</p>}
          {status === 'done' && <p className="mt-3 text-sm text-[#00a884]">Mehfooz ho gaya ✓</p>}
          {status === 'error' && err && <p className="mt-3 text-sm text-red-400">⚠️ {err}</p>}

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={onClose}
              disabled={status === 'uploading' || status === 'saving'}
              className="flex-1 rounded-lg bg-[#202c33] py-2.5 text-sm font-medium text-white hover:bg-[#2a3942] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={status === 'uploading' || status === 'saving' || status === 'done'}
              className="flex-1 rounded-lg bg-[#00a884] py-2.5 text-sm font-semibold text-white hover:bg-[#06cf9c] disabled:opacity-50"
            >
              {status === 'uploading' || status === 'saving' ? 'Ruk jayein...' : 'Mehfooz karein'}
            </button>
          </div>
          <button
            onClick={async () => { await backend.signOut(); onClose(); }}
            className="w-full mt-3 text-red-400 hover:text-red-300 text-sm py-2 transition"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
