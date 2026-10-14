'use client';

import { useEffect, useRef, useState } from 'react';
import { backend } from '@/lib/backend';
import {
  BellIcon,
  CameraIcon,
  ChatsAppLogo,
  ChevronRightIcon,
  GiftIcon,
  ImageIcon,
  MicIcon,
  SendIcon,
} from './icons';
import VoiceRecorder from './VoiceRecorder';
import type { UserProfile, V5Backend } from './v5types';
import { MAIN_GROUP_NAME, setOnboardingDone } from './v5types';
import './v5-mobile.css';

const b = backend as unknown as V5Backend;

const STEP_TITLES = [
  'Khush Aamdeed',
  'Aapka Naam',
  'Profile Photo',
  'Group Tour',
  'Voice Note',
  'Photo Bhejein',
  'Notifications',
  'Mubarak!',
];

/**
 * Onboarding — madrasa doston ke liye super-simple 8-step flow.
 * Steps 4-6 me asli group me pehle messages bheje jate hain (join msg,
 * voice note, photo) taake tour real lage. End par localStorage flag.
 */
export default function Onboarding({ user, onDone }: { user: UserProfile; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user.displayName || '');
  const [photoURL, setPhotoURL] = useState<string | null>(user.photoURL || null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [joinText, setJoinText] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const guideFileRef = useRef<HTMLInputElement>(null);
  const [guidePhoto, setGuidePhoto] = useState<{ url: string; file: File } | null>(null);

  const toastTimer = useRef<number | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  };

  // group id pehle se le lo (tour steps me kaam ayega)
  useEffect(() => {
    b.ensureMemberAutoJoin()
      .then(id => setGroupId(id))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setJoinText(`${name || 'Naya dost'} ne join kar lia hai ✨`);
  }, [step, name]);

  function finish() {
    setOnboardingDone();
    try { localStorage.setItem(`v5_onboarding_complete_${user.id}`, '1'); } catch { /* ignore */ }
    onDone();
  }

  async function saveName() {
    const n = name.trim();
    if (!n) {
      showToast('Apna naam to likhein 😊');
      return;
    }
    setBusy(true);
    try {
      await backend.updateProfile({ displayName: n });
      setStep(2);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Naam save nahi ho saka');
    } finally {
      setBusy(false);
    }
  }

  async function savePhotoAndNext(skip: boolean) {
    setBusy(true);
    try {
      let url = photoURL;
      if (!skip && photoFile && groupId) {
        const up = await backend.uploadMedia(groupId, photoFile);
        url = up.url;
      }
      // skip → Google wali pic rehne do (user.photoURL pehle se set hai)
      await backend.updateProfile(skip ? {} : { photoURL: url || undefined });
      setStep(3);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Photo save nahi ho saki');
    } finally {
      setBusy(false);
    }
  }

  async function sendJoinMessage() {
    const t = joinText.trim();
    if (!t) {
      showToast('Kuch likhein to sahi 😊');
      return;
    }
    if (!groupId) {
      showToast('Group tayyar ho raha hai, ek second…');
      return;
    }
    setBusy(true);
    try {
      const { sent } = b.sendMessageOptimistic(groupId, { type: 'text', text: t }, { id: user.id, displayName: user.displayName });
      await sent;
      showToast('Bhej diya! 🎉');
      window.setTimeout(() => setStep(4), 900);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Message nahi bheja ja saka');
    } finally {
      setBusy(false);
    }
  }

  async function sendVoiceGuide(blob: Blob, dur: number) {
    if (!groupId) return;
    try {
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
      const up = await backend.uploadMedia(groupId, file);
      const { sent } = b.sendMessageOptimistic(groupId, {
        type: 'audio',
        text: '',
        mediaURL: up.url,
        duration: dur,
        fileName: file.name,
        fileSize: file.size,
      }, { id: user.id, displayName: user.displayName });
      await sent;
      showToast('Voice note bhej diya! 🎙️');
      window.setTimeout(() => setStep(5), 900);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Voice note nahi bheja ja saka');
    }
  }

  async function pickGuidePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setGuidePhoto({ url: URL.createObjectURL(f), file: f });
  }

  async function sendGuidePhoto() {
    if (!guidePhoto || !groupId) return;
    setBusy(true);
    try {
      const up = await backend.uploadMedia(groupId, guidePhoto.file);
      const { sent } = b.sendMessageOptimistic(groupId, {
        type: 'image',
        text: '',
        mediaURL: up.url,
        fileName: guidePhoto.file.name,
        fileSize: guidePhoto.file.size,
      }, { id: user.id, displayName: user.displayName });
      await sent;
      showToast('Photo bhej di! 📸');
      window.setTimeout(() => setStep(6), 900);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Photo nahi bheji ja saki');
    } finally {
      setBusy(false);
    }
  }

  async function enableNotifications() {
    try {
      if ('Notification' in window) {
        await Notification.requestPermission();
      }
    } catch { /* ignore */ }
    setStep(7);
  }

  return (
    <div className="v5-onb">
      {step === 7 && <Confetti />}

      <div className="v5-onb-body">
        {/* ---------- STEP 0: Welcome ---------- */}
        {step === 0 && (
          <div className="v5-onb-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <ChatsAppLogo size={96} />
            <div className="v5-onb-title">Assalam-o-Alaikum! 👋</div>
            <div className="v5-onb-sub">
              ChatsApp me <b style={{ color: '#e9edef' }}>khush aamdeed</b>!
              <br />
              Ab sab dost ek hi group me baat karein ge.
            </div>
            <div className="v5-onb-promo">✨ ye sheraz ne banaya hai</div>
            <button className="v5-btn-primary v5-touch" onClick={() => setStep(1)} style={{ marginTop: 10 }}>
              Shuru karein <ChevronRightIcon size={20} />
            </button>
          </div>
        )}

        {/* ---------- STEP 1: Naam ---------- */}
        {step === 1 && (
          <div className="v5-onb-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div className="v5-onb-title">Aapka naam kya hai?</div>
            <div className="v5-onb-sub">Group me sab aapko isi naam se pehchanein ge.</div>
            <input
              className="v5-onb-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Apna naam likhein"
              maxLength={30}
              autoFocus
              enterKeyHint="next"
              onKeyDown={e => e.key === 'Enter' && saveName()}
            />
            <button className="v5-btn-primary v5-touch" onClick={saveName} disabled={busy}>
              {busy ? 'Save ho raha hai…' : 'Aage barhein'} <ChevronRightIcon size={20} />
            </button>
          </div>
        )}

        {/* ---------- STEP 2: Photo ---------- */}
        {step === 2 && (
          <div className="v5-onb-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div className="v5-onb-title">Profile photo lagayein</div>
            <div className="v5-onb-sub">Doston ko pehchanne me asani hogi 😊</div>
            <button className="v5-onb-photo v5-touch" onClick={() => fileRef.current?.click()} aria-label="Photo chunein">
              {photoURL ? (
                <img src={photoURL} alt="profile" />
              ) : (
                <CameraIcon size={40} color="#00a884" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                setPhotoFile(f);
                setPhotoURL(URL.createObjectURL(f));
              }}
            />
            <button className="v5-btn-primary v5-touch" onClick={() => savePhotoAndNext(false)} disabled={busy}>
              {busy ? 'Save ho rahi hai…' : photoURL ? 'Ye wali rakhein ✓' : 'Photo chunein'}
            </button>
            <button className="v5-btn-ghost v5-touch" onClick={() => savePhotoAndNext(true)} disabled={busy}>
              Skip karo
            </button>
            <div className="v5-onb-sub" style={{ fontSize: 12.5 }}>Skip karne par Google wali photo lag jayegi</div>
          </div>
        )}

        {/* ---------- STEP 3: Group Tour + join message ---------- */}
        {step === 3 && (
          <div className="v5-onb-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="v5-onb-title" style={{ fontSize: 22 }}>Ye raha {MAIN_GROUP_NAME} 🎉</div>
            <div className="v5-onb-sub">Sab dost yahin baat karte hain. Pehle apna taaruf bhejein:</div>
            <div className="v5-tour-mock">
              <div className="v5-tour-mock-head">
                <span className="v5-avatar" style={{ width: 30, height: 30, fontSize: 14 }}>M</span>
                {MAIN_GROUP_NAME}
              </div>
              <div className="v5-tour-mock-msgs">
                <div className="v5-tour-bubble">Assalam-o-Alaikum sab ko! 👋</div>
                <div className="v5-tour-bubble">Walaikum Assalam! Khush aamdeed 🎉</div>
                <div className="v5-tour-bubble mine">{joinText || '…'}</div>
              </div>
            </div>
            <div className="v5-tour-spot" style={{ width: '100%', maxWidth: 340 }}>
              <div className="v5-input-pill" style={{ borderRadius: 16 }}>
                <input
                  className="v5-input"
                  value={joinText}
                  onChange={e => setJoinText(e.target.value)}
                  placeholder="Apna taaruf likhein…"
                  maxLength={120}
                  style={{ fontSize: 15 }}
                />
              </div>
            </div>
            <button className="v5-btn-primary v5-touch" onClick={sendJoinMessage} disabled={busy}>
              <SendIcon size={20} /> {busy ? 'Bheja ja raha hai…' : 'Bhej do'}
            </button>
          </div>
        )}

        {/* ---------- STEP 4: Voice guide ---------- */}
        {step === 4 && (
          <div className="v5-onb-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div
              className="v5-fcard-icon"
              style={{ width: 76, height: 76 }}
            >
              <MicIcon size={36} color="#00e6a8" />
            </div>
            <div className="v5-onb-title" style={{ fontSize: 22 }}>Voice note bhej kar dekhein</div>
            <div className="v5-onb-sub">
              Mic dabate hi recording shuru — rokne par <b style={{ color: '#e9edef' }}>bhejo ✓</b> ya <b style={{ color: '#e9edef' }}>delete 🗑</b> chunein.
              <br />Ye asli voice note group me jayega!
            </div>
            <div style={{ width: '100%', maxWidth: 340 }}>
              <VoiceRecorder
                onSend={sendVoiceGuide}
                onCancel={() => showToast('Koi baat nahi, phir try karein 😊')}
                onError={msg => showToast(msg)}
              />
            </div>
            <button className="v5-btn-ghost v5-touch" onClick={() => setStep(5)}>
              Abhi skip karo
            </button>
          </div>
        )}

        {/* ---------- STEP 5: Photo guide ---------- */}
        {step === 5 && (
          <div className="v5-onb-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="v5-fcard-icon" style={{ width: 76, height: 76 }}>
              <ImageIcon size={36} color="#00e6a8" />
            </div>
            <div className="v5-onb-title" style={{ fontSize: 22 }}>Photo bhejna seekhein</div>
            <div className="v5-onb-sub">Koi achi si photo chunein aur group me bhejein 📸</div>
            {guidePhoto ? (
              <img
                src={guidePhoto.url}
                alt="preview"
                style={{ width: '100%', maxWidth: 300, borderRadius: 14, maxHeight: 220, objectFit: 'cover' }}
              />
            ) : (
              <button className="v5-onb-photo v5-touch" onClick={() => guideFileRef.current?.click()} aria-label="Photo chunein">
                <ImageIcon size={40} color="#00a884" />
              </button>
            )}
            <input
              ref={guideFileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={pickGuidePhoto}
            />
            {guidePhoto ? (
              <button className="v5-btn-primary v5-touch" onClick={sendGuidePhoto} disabled={busy}>
                <SendIcon size={20} /> {busy ? 'Bheji ja rahi hai…' : 'Bhej do'}
              </button>
            ) : (
              <button className="v5-btn-primary v5-touch" onClick={() => guideFileRef.current?.click()}>
                Photo chunein
              </button>
            )}
            <button className="v5-btn-ghost v5-touch" onClick={() => setStep(6)}>
              Skip karo
            </button>
          </div>
        )}

        {/* ---------- STEP 6: Notifications ---------- */}
        {step === 6 && (
          <div className="v5-onb-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="v5-fcard-icon" style={{ width: 76, height: 76 }}>
              <BellIcon size={36} color="#00e6a8" />
            </div>
            <div className="v5-onb-title" style={{ fontSize: 22 }}>Koi message miss na ho 🔔</div>
            <div className="v5-onb-sub">
              Notifications on karein taake naye messages ki khabar foran mile.
            </div>
            <button className="v5-btn-primary v5-touch" onClick={enableNotifications}>
              <BellIcon size={20} /> Allow karo
            </button>
            <button className="v5-btn-ghost v5-touch" onClick={() => setStep(7)}>
              Abhi nahi
            </button>
          </div>
        )}

        {/* ---------- STEP 7: Mubarak ---------- */}
        {step === 7 && (
          <div className="v5-onb-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="v5-fcard-icon" style={{ width: 92, height: 92 }}>
              <GiftIcon size={44} color="#00e6a8" />
            </div>
            <div className="v5-onb-title" style={{ fontSize: 30 }}>Tayyar ho! 🎉</div>
            <div className="v5-onb-sub">
              <b style={{ color: '#e9edef' }}>{name || 'Dost'}</b>, aap {MAIN_GROUP_NAME} ka hissa ban gaye!
              <br />
              Milte hain group me ✨
            </div>
            <button className="v5-btn-primary v5-touch" onClick={finish} style={{ marginTop: 8 }}>
              Chat kholo <ChevronRightIcon size={20} />
            </button>
          </div>
        )}
      </div>

      {/* progress dots */}
      <div className="v5-onb-dots" aria-label={`Step ${step + 1} of ${STEP_TITLES.length}`}>
        {STEP_TITLES.map((t, i) => (
          <span key={t} className={`v5-onb-dot${i === step ? ' active' : ''}`} />
        ))}
      </div>

      {toast && <div className="v5-toast">{toast}</div>}
    </div>
  );
}

/** CSS confetti — ~70 tukre */
function Confetti() {
  const [pieces] = useState(() => {
    const colors = ['#00a884', '#35e0b0', '#53bdeb', '#f6c344', '#f15c6d', '#e9edef'];
    return Array.from({ length: 70 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      dur: 2.4 + Math.random() * 2,
      color: colors[i % colors.length],
      w: 6 + Math.random() * 6,
    }));
  });
  return (
    <div className="v5-confetti" aria-hidden>
      {pieces.map(p => (
        <i
          key={p.id}
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.w,
            height: p.w * 1.5,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}
