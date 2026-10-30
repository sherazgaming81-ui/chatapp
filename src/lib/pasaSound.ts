"use client";
// ─────────────────────────────────────────────────────────────
// Pasa (Ludo) sounds — WebAudio oscillator beeps, koi external
// file nahi. Mute state localStorage "pasa_muted" me rehta hai.
// Saare functions best-effort hain: try/catch, kabhi throw nahi.
// ─────────────────────────────────────────────────────────────

const MUTE_KEY = "pasa_muted";

export function isPasaMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPasaMuted(b: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, b ? "1" : "0");
  } catch {
    /* ignore */
  }
}

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    let c: AudioContext | null = ctx;
    if (!c) { c = new AC(); ctx = c; }
    if (c && c.state === "suspended") c.resume().catch(() => {});
    return c;
  } catch {
    return null;
  }
}

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  /** freq sweep ka end (capture zap ke liye) */
  slideTo?: number;
}

/** ek tone — `at` seconds offset par, `dur` seconds lamba */
function tone(freq: number, dur: number, at = 0, opts: ToneOpts = {}): void {
  try {
    if (isPasaMuted()) return;
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime + at;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = opts.type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) {
      try {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.slideTo), t0 + dur);
      } catch {
        /* ignore */
      }
    }
    const vol = opts.gain ?? 0.12;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch {
    /* ignore */
  }
}

/** 🎲 pasa girne ki kharkharahat — chhote tez clicks */
export function playDice(): void {
  try {
    if (isPasaMuted()) return;
    for (let i = 0; i < 5; i++) {
      tone(1400 + Math.random() * 900, 0.035, i * 0.055, { type: "square", gain: 0.05 });
    }
    tone(700, 0.06, 0.3, { type: "square", gain: 0.06 });
  } catch {
    /* ignore */
  }
}

/** goti chali — ek short "tuk" blip */
export function playMove(): void {
  try {
    tone(210, 0.07, 0, { type: "square", gain: 0.1 });
    tone(150, 0.05, 0.055, { type: "square", gain: 0.07 });
  } catch {
    /* ignore */
  }
}

/** 💥 capture — neeche girti hui zap */
export function playCapture(): void {
  try {
    tone(820, 0.26, 0, { type: "sawtooth", gain: 0.11, slideTo: 90 });
    tone(1200, 0.1, 0.02, { type: "square", gain: 0.05, slideTo: 300 });
  } catch {
    /* ignore */
  }
}

/** 🏆 jeet — chhoti si ascending dhun */
export function playWin(): void {
  try {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone(f, 0.16, i * 0.13, { type: "triangle", gain: 0.13 }));
    tone(1318.5, 0.3, notes.length * 0.13, { type: "triangle", gain: 0.1 });
  } catch {
    /* ignore */
  }
}

/** 🔔 tumhari bari — halka ding */
export function playTurn(): void {
  try {
    tone(880, 0.14, 0, { type: "sine", gain: 0.1 });
    tone(1318.5, 0.18, 0.1, { type: "sine", gain: 0.07 });
  } catch {
    /* ignore */
  }
}
