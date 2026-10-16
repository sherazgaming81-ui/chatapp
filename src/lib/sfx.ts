"use client";
// Web Audio API se motion-graphics style SFX — koi external file nahi.
// Lazy AudioContext (SSR safe), whoosh = filtered noise sweep, pop = sine blip.

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Soft whoosh — scene transition par */
export function playWhoosh() {
  const c = ac();
  if (!c) return;
  try {
    const dur = 0.45;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = "bandpass";
    filt.Q.value = 1.2;
    filt.frequency.setValueAtTime(300, c.currentTime);
    filt.frequency.exponentialRampToValueAtTime(2400, c.currentTime + dur * 0.7);
    filt.frequency.exponentialRampToValueAtTime(500, c.currentTime + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    src.connect(filt).connect(g).connect(c.destination);
    src.start();
    src.stop(c.currentTime + dur);
  } catch { /* ignore */ }
}

/** Subtle pop — elements appear hone par */
export function playPop(delay = 0) {
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(520, t0);
    o.frequency.exponentialRampToValueAtTime(880, t0 + 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + 0.2);
  } catch { /* ignore */ }
}
