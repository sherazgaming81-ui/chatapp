// sounds.ts — WebAudio-generated message tones, koi audio file nahi.
// Usage: import { playSound, SOUND_LABELS, type SoundId } from '@/lib/v1/sounds';
//   playSound('pop'); // SOUND_LABELS[id] for settings UI labels.

export type SoundId = 'default' | 'pop' | 'ding' | 'silent';

export const SOUND_LABELS: Record<SoundId, string> = {
  default: 'Default',
  pop: 'Pop',
  ding: 'Ding',
  silent: 'Khamosh',
};

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
  return ctx;
}

// Plays a single oscillator note with an exponential decay envelope.
function tone(
  ac: AudioContext,
  opts: {
    freq: number;
    type?: OscillatorType;
    startAt: number;
    duration: number;
    volume?: number;
  },
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const t0 = ac.currentTime + opts.startAt;
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(opts.freq, t0);
  const vol = opts.volume ?? 0.25;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + opts.duration + 0.05);
}

export function playSound(id: SoundId): void {
  if (id === 'silent') return;
  const ac = getContext();
  if (!ac) return;
  try {
    if (id === 'pop') {
      // Quick sine blip — choti si "pop"
      tone(ac, { freq: 660, type: 'sine', startAt: 0, duration: 0.12, volume: 0.3 });
    } else if (id === 'ding') {
      // Triangle bell — "ding" with a shimmer
      tone(ac, { freq: 880, type: 'triangle', startAt: 0, duration: 0.35, volume: 0.25 });
      tone(ac, { freq: 1320, type: 'triangle', startAt: 0, duration: 0.25, volume: 0.12 });
    } else {
      // default: soft two-tone — WhatsApp jaisa "du-dun"
      tone(ac, { freq: 523.25, type: 'sine', startAt: 0, duration: 0.16, volume: 0.25 });
      tone(ac, { freq: 659.25, type: 'sine', startAt: 0.14, duration: 0.22, volume: 0.25 });
    }
  } catch {
    // Audio play fail ho jaye to ignore — app crash nahi honi chahiye
  }
}
