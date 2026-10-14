'use client';

/**
 * ProfilePanel — apni profile (rail me avatar click par slide-over).
 * Photo change (upload), naam, about — backend.updateProfile.
 */

import { useRef, useState } from 'react';
import { backend } from '@/lib/backend';
import type { UserProfile } from '@/lib/backend/types';
import Avatar from '@/components/Avatar';
import { Icon, ICONS, SectionTitle } from './common';
import PhotoViewer from './PhotoViewer';

interface Props {
  me: UserProfile;
  onClose(): void;
}

export default function ProfilePanel({ me, onClose }: Props) {
  const [name, setName] = useState(me.displayName);
  const [about, setAbout] = useState(me.about || '');
  const [editingName, setEditingName] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveName = async () => {
    setEditingName(false);
    if (name.trim() && name.trim() !== me.displayName) {
      try { await backend.updateProfile({ displayName: name.trim() }); } catch { setName(me.displayName); }
    } else setName(me.displayName);
  };

  const saveAbout = async () => {
    setEditingAbout(false);
    if (about !== me.about) {
      try { await backend.updateProfile({ about }); } catch { setAbout(me.about || ''); }
    }
  };

  const uploadPhoto = async (f: File) => {
    setUploading(true);
    try {
      // profile photos: v2 ki tarah 'profile-photos' bucket path use karo
      const res = await backend.uploadMedia('profile-photos', f);
      await backend.updateProfile({ photoURL: res.url });
    } catch {
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#111b21] animate-[v4slideL_.22s_ease-out]">
      <div className="flex items-center gap-4 px-4 py-3 bg-[#1f2c34] shrink-0">
        <button onClick={onClose} className="p-1.5 -ml-1 rounded-full text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942] transition" title="Band karein">
          <Icon d={ICONS.x} size={22} />
        </button>
        <h2 className="text-[16px] font-medium text-[#e9edef]">Profile</h2>
      </div>

      <div className="flex-1 overflow-y-auto v4scroll">
        <div className="flex flex-col items-center px-6 pt-8 pb-6">
          <button onClick={() => me.photoURL && setPhotoOpen(true)} className="relative group" title="Photo dekhein">
            <Avatar name={me.displayName} photoURL={me.photoURL} size={150} />
            {uploading && (
              <span className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <span className="w-8 h-8 rounded-full border-[3px] border-[#2a3942] border-t-[#00a884] animate-spin" />
              </span>
            )}
          </button>
          {photoOpen && me.photoURL && <PhotoViewer src={me.photoURL} caption={me.displayName} onClose={() => setPhotoOpen(false)} />}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-4 flex items-center gap-2 px-5 py-2 rounded-full bg-[#00a884]/15 text-[#00a884] text-[14px] font-medium hover:bg-[#00a884]/25 transition disabled:opacity-50"
          >
            <Icon d={ICONS.camera} size={17} />
            {uploading ? 'Upload ho raha hai…' : 'Photo badlein'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ''; }}
          />
        </div>

        <SectionTitle>Aapka naam</SectionTitle>
        <div className="px-6 pb-2">
          {editingName ? (
            <div className="flex items-center gap-2 bg-[#1f2c34] rounded-full px-4 py-1">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                maxLength={40}
                className="flex-1 bg-transparent outline-none text-[15px] text-[#e9edef] py-2"
              />
              <button onClick={saveName} className="p-1.5 text-[#00a884]"><Icon d={ICONS.check} size={19} /></button>
            </div>
          ) : (
            <button onClick={() => setEditingName(true)} className="w-full flex items-center gap-3 text-left group">
              <span className="flex-1 text-[15px] text-[#e9edef] truncate py-1">{me.displayName}</span>
              <Icon d={ICONS.pencil} size={17} className="text-[#8696a0] opacity-0 group-hover:opacity-100 transition" />
            </button>
          )}
          <p className="text-[12.5px] text-[#8696a0] mt-1 leading-relaxed">Yeh naam aapke contacts ko nazar aayega.</p>
        </div>

        <SectionTitle>About</SectionTitle>
        <div className="px-6 pb-6">
          {editingAbout ? (
            <div className="flex items-center gap-2 bg-[#1f2c34] rounded-full px-4 py-1">
              <input
                autoFocus
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveAbout()}
                maxLength={120}
                placeholder="Kuch apne baare me likhein…"
                className="flex-1 bg-transparent outline-none text-[15px] text-[#e9edef] py-2"
              />
              <button onClick={saveAbout} className="p-1.5 text-[#00a884]"><Icon d={ICONS.check} size={19} /></button>
            </div>
          ) : (
            <button onClick={() => setEditingAbout(true)} className="w-full flex items-center gap-3 text-left group">
              <span className="flex-1 text-[15px] text-[#e9edef] truncate py-1">{me.about || 'About add karein…'}</span>
              <Icon d={ICONS.pencil} size={17} className="text-[#8696a0] opacity-0 group-hover:opacity-100 transition" />
            </button>
          )}
        </div>

        <div className="px-6 pb-8">
          <div className="bg-[#1f2c34] rounded-xl p-4">
            <p className="text-[12.5px] text-[#8696a0] leading-relaxed">
              Email: <span className="text-[#d1d7db]">{me.email}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
