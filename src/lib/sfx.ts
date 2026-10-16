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

/** Epic launch — Scene 10 (Shuru karo!) finale: rocket rumble → fanfare → sparkle burst (~1.8s) */
export function sfxLaunch() {
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime;

    /* 1 — Rocket launch rumble: low noise + 60Hz sine, pitch rising, 0.8s */
    const rDur = 0.8;
    const nbuf = c.createBuffer(1, c.sampleRate * rDur, c.sampleRate);
    const ndata = nbuf.getChannelData(0);
    for (let i = 0; i < ndata.length; i++) ndata[i] = Math.random() * 2 - 1;
    const nsrc = c.createBufferSource();
    nsrc.buffer = nbuf;
    const nfilt = c.createBiquadFilter();
    nfilt.type = "lowpass";
    nfilt.frequency.setValueAtTime(120, t0);
    nfilt.frequency.exponentialRampToValueAtTime(700, t0 + rDur);
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.0001, t0);
    ng.gain.exponentialRampToValueAtTime(0.28, t0 + rDur * 0.5);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + rDur);
    nsrc.connect(nfilt).connect(ng).connect(c.destination);
    nsrc.start(t0);
    nsrc.stop(t0 + rDur);

    const r = c.createOscillator();
    r.type = "sine";
    r.frequency.setValueAtTime(60, t0);
    r.frequency.exponentialRampToValueAtTime(160, t0 + rDur);
    const rg = c.createGain();
    rg.gain.setValueAtTime(0.0001, t0);
    rg.gain.exponentialRampToValueAtTime(0.22, t0 + rDur * 0.4);
    rg.gain.exponentialRampToValueAtTime(0.0001, t0 + rDur);
    r.connect(rg).connect(c.destination);
    r.start(t0);
    r.stop(t0 + rDur);

    /* 2 — Triumphant fanfare: C-E-G-C major arpeggio, trumpet-ish sawtooth + lowpass, 0.6s */
    const f0 = t0 + rDur * 0.75;
    const notes = [261.63, 329.63, 392.0, 523.25]; // C4 E4 G4 C5
    const step = 0.12, noteDur = 0.34;
    notes.forEach((f, i) => {
      const t = f0 + i * step;
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f, t);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(1800, t);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.11, t + 0.03);
      g.gain.setValueAtTime(0.11, t + noteDur - 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + noteDur);
      o.connect(lp).connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + noteDur + 0.05);
    });

    /* 3 — Grand sparkle burst: white noise burst + high chime C7, quick decay */
    const s0 = f0 + notes.length * step + 0.12;
    const sbuf = c.createBuffer(1, c.sampleRate * 0.35, c.sampleRate);
    const sdata = sbuf.getChannelData(0);
    for (let i = 0; i < sdata.length; i++) sdata[i] = Math.random() * 2 - 1;
    const ssrc = c.createBufferSource();
    ssrc.buffer = sbuf;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(6000, s0);
    const sg = c.createGain();
    sg.gain.setValueAtTime(0.0001, s0);
    sg.gain.exponentialRampToValueAtTime(0.12, s0 + 0.02);
    sg.gain.exponentialRampToValueAtTime(0.0001, s0 + 0.3);
    ssrc.connect(hp).connect(sg).connect(c.destination);
    ssrc.start(s0);
    ssrc.stop(s0 + 0.35);

    [2093.0, 1567.98].forEach((f) => { // C7, G6
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(f, s0);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, s0);
      g.gain.exponentialRampToValueAtTime(0.1, s0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s0 + 0.45);
      o.connect(g).connect(c.destination);
      o.start(s0);
      o.stop(s0 + 0.5);
    });
  } catch { /* ignore */ }
}

/** 🎮 Scene 8: Games — 8-bit arcade! power-up sweep → 3 game blips → victory jingle. ~1.2s total. */
export function sfxGames() {
  const c = ac();
  if (!c) return;
  try {
    const sq = (freq: number, t0: number, dur: number, vol = 0.1) => {
      const o = c.createOscillator();
      o.type = "square";
      o.frequency.setValueAtTime(freq, t0);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(c.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    };
    let t = c.currentTime;

    // 1) retro arcade power-up: square sweep 200Hz → 800Hz, 0.3s
    {
      const o = c.createOscillator();
      o.type = "square";
      o.frequency.setValueAtTime(200, t);
      o.frequency.exponentialRampToValueAtTime(800, t + 0.3);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.11, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + 0.32);
    }
    t += 0.34;

    // 2) 3 quick game blips — har game icon ke liye (600/750/900Hz square, 0.08s each)
    sq(600, t, 0.08);
    sq(750, t + 0.09, 0.08);
    sq(900, t + 0.18, 0.08);
    t += 0.3;

    // 3) victory jingle: C5-E5-G5-C6 rapid (0.4s)
    const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;
    sq(C5, t, 0.09);
    sq(E5, t + 0.09, 0.09);
    sq(G5, t + 0.18, 0.09);
    sq(C6, t + 0.27, 0.14, 0.12);
  } catch { /* ignore */ }
}

/** Chaand scene — deep night ambience + moonlight shimmer + soft glow swell (~2s, dreamy) */
export function sfxMoon() {
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime;
    const dur = 2;

    // 1. Deep night ambience — 55Hz sine, barely audible slow swell
    const low = c.createOscillator();
    low.type = "sine";
    low.frequency.value = 55;
    const lowG = c.createGain();
    lowG.gain.setValueAtTime(0.0001, t0);
    lowG.gain.exponentialRampToValueAtTime(0.05, t0 + 1);
    lowG.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    low.connect(lowG).connect(c.destination);
    low.start(t0);
    low.stop(t0 + dur + 0.1);

    // 2. Moonlight shimmer — A5 sine with 4Hz tremolo (1.5s)
    const shimmer = c.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = 880; // A5
    const shimG = c.createGain();
    shimG.gain.setValueAtTime(0.0001, t0);
    shimG.gain.exponentialRampToValueAtTime(0.09, t0 + 0.2);
    shimG.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
    const lfo = c.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 4;
    const lfoG = c.createGain();
    lfoG.gain.value = 0.05;
    lfo.connect(lfoG).connect(shimG.gain);
    shimmer.connect(shimG).connect(c.destination);
    shimmer.start(t0);
    shimmer.stop(t0 + 1.7);
    lfo.start(t0);
    lfo.stop(t0 + 1.7);

    // 3. Soft glow swell — filtered noise, bandpass 3000Hz, slow attack 1s
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 3000;
    filt.Q.value = 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.1, t0 + 1);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g).connect(c.destination);
    src.start(t0);
    src.stop(t0 + dur);
  } catch { /* ignore */ }
}
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
/** Scene 2: Madrasa Group — 4 chat bubbles, har bubble ke sath ek bouncy pop.
 *  Pitch upar jata hai har bar (C5 → D5 → E5 → G5) — dosti wali playful feel. */
export function sfxChatBubbles() {
  const c = ac();
  if (!c) return;
  try {
    const notes = [523.25, 587.33, 659.25, 783.99]; // C5 D5 E5 G5
    notes.forEach((f, i) => {
      const t0 = c.currentTime + i * 0.35;
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(f, t0);
      o.frequency.exponentialRampToValueAtTime(f * 1.35, t0 + 0.09);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(g).connect(c.destination);
      o.start(t0);
      o.stop(t0 + 0.25);
    });
  } catch { /* ignore */ }
}

/** Scene 5 (Stickers): 3 bouncy boing pops (ascending) + sparkle "ta-da!" arpeggio */
export function sfxStickers() {
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime;
    // 3 bouncy pops — E5, G5, C6, cartoonish boing (pitch up phir thoda down)
    const pops = [659.25, 783.99, 1046.5];
    pops.forEach((base, i) => {
      const t = t0 + i * 0.28;
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 1.6, t + 0.07); // bend up
      o.frequency.exponentialRampToValueAtTime(base * 0.95, t + 0.16); // boing wobble
      o.frequency.exponentialRampToValueAtTime(base * 1.25, t + 0.24); // settle up
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + 0.3);
    });
    // ta-da! sparkle arpeggio — C6, E6, G6, C7
    const notes = [1046.5, 1318.51, 1567.98, 2093.0];
    notes.forEach((f, i) => {
      const t = t0 + 0.84 + i * 0.075;
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(f, t);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + 0.22);
    });
  } catch { /* ignore */ }
}

/** Lock click-clack — Private DMs scene: pehle low thud, phir metallic click, phir soft shimmer. ~0.8s */
export function sfxLock() {
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime;

    // Click 1 — low thud (150Hz square, 0.08s)
    const o1 = c.createOscillator();
    o1.type = "square";
    o1.frequency.setValueAtTime(150, t0);
    const g1 = c.createGain();
    g1.gain.setValueAtTime(0.0001, t0);
    g1.gain.exponentialRampToValueAtTime(0.16, t0 + 0.012);
    g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
    o1.connect(g1).connect(c.destination);
    o1.start(t0);
    o1.stop(t0 + 0.1);

    // Click 2 — metallic click (800Hz triangle + noise burst, 0.05s)
    const t1 = t0 + 0.12;
    const o2 = c.createOscillator();
    o2.type = "triangle";
    o2.frequency.setValueAtTime(800, t1);
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.0001, t1);
    g2.gain.exponentialRampToValueAtTime(0.14, t1 + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.05);
    o2.connect(g2).connect(c.destination);
    o2.start(t1);
    o2.stop(t1 + 0.07);

    const nbuf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate);
    const ndata = nbuf.getChannelData(0);
    for (let i = 0; i < ndata.length; i++) ndata[i] = Math.random() * 2 - 1;
    const nsrc = c.createBufferSource();
    nsrc.buffer = nbuf;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3000;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.0001, t1);
    ng.gain.exponentialRampToValueAtTime(0.07, t1 + 0.006);
    ng.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.05);
    nsrc.connect(hp).connect(ng).connect(c.destination);
    nsrc.start(t1);
    nsrc.stop(t1 + 0.06);

    // Shimmer — soft reassuring high sine (2000Hz, quick fade)
    const t2 = t0 + 0.28;
    const o3 = c.createOscillator();
    o3.type = "sine";
    o3.frequency.setValueAtTime(2000, t2);
    const g3 = c.createGain();
    g3.gain.setValueAtTime(0.0001, t2);
    g3.gain.exponentialRampToValueAtTime(0.05, t2 + 0.05);
    g3.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.45);
    o3.connect(g3).connect(c.destination);
    o3.start(t2);
    o3.stop(t2 + 0.5);
  } catch { /* ignore */ }
}

/** ✨ Profile Studio SFX — glamorous makeover: shimmer sweep + pentatonic sparkle + final ding */
export function sfxStudio() {
  const c = ac();
  if (!c) return;
  try {
    // 1 — Magical shimmer sweep: high-passed noise sweep up, 0.5s
    const dur = 0.5;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(1200, c.currentTime);
    hp.frequency.exponentialRampToValueAtTime(8000, c.currentTime + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    src.connect(hp).connect(g).connect(c.destination);
    src.start();
    src.stop(c.currentTime + dur);

    // 2 — Sparkle notes: random pentatonic plinks (A5, C6, D6, E6, G6)
    const penta = [880, 1046.5, 1174.66, 1318.51, 1567.98];
    for (let i = 0; i < 5; i++) {
      const f = penta[Math.floor(Math.random() * penta.length)];
      const t0 = c.currentTime + 0.25 + i * 0.13;
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      const og = c.createGain();
      og.gain.setValueAtTime(0.0001, t0);
      og.gain.exponentialRampToValueAtTime(0.14, t0 + 0.015);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(og).connect(c.destination);
      o.start(t0);
      o.stop(t0 + 0.25);
    }

    // 3 — Final ding: B5 sine + B6 harmonic, ~1s decay
    const t1 = c.currentTime + 0.92;
    const ding = c.createOscillator();
    ding.type = "sine";
    ding.frequency.value = 987.77; // B5
    const dg = c.createGain();
    dg.gain.setValueAtTime(0.0001, t1);
    dg.gain.exponentialRampToValueAtTime(0.16, t1 + 0.02);
    dg.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.9);
    ding.connect(dg).connect(c.destination);
    ding.start(t1);
    ding.stop(t1 + 0.95);
    // harmonic B6
    const harm = c.createOscillator();
    harm.type = "sine";
    harm.frequency.value = 1975.53; // B6
    const hg = c.createGain();
    hg.gain.setValueAtTime(0.0001, t1);
    hg.gain.exponentialRampToValueAtTime(0.06, t1 + 0.02);
    hg.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.7);
    harm.connect(hg).connect(c.destination);
    harm.start(t1);
    harm.stop(t1 + 0.75);
  } catch { /* ignore */ }
}

/** Cache for generated reverb impulse response (Welcome) */
let welcomeIR: AudioBuffer | null = null;

/** Warm welcoming chime — Scene 1 (Welcome): soft C5→E5→G5 arpeggio, reverb-ish decay, ~1.2s */
export function sfxWelcome() {
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + 0.01;
    // Dry + wet (reverb) bus
    const master = c.createGain();
    master.gain.value = 0.55;
    master.connect(c.destination);
    if (!welcomeIR) {
      const len = Math.floor(c.sampleRate * 0.9);
      welcomeIR = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = welcomeIR.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
      }
    }
    const conv = c.createConvolver();
    conv.buffer = welcomeIR;
    const wet = c.createGain();
    wet.gain.value = 0.35;
    master.connect(conv);
    conv.connect(wet);
    wet.connect(c.destination);

    const notes = [523.25, 659.25, 783.99]; // C5 → E5 → G5
    notes.forEach((freq, i) => {
      const t = t0 + i * 0.18;
      // sine + octave shimmer = warmth
      const parts: Array<[number, number]> = [[freq, 1], [freq * 2, 0.22]];
      for (const [f, amp] of parts) {
        const o = c.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.24 * amp, t + 0.15); // slow attack
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85); // long soft decay
        o.connect(g);
        g.connect(master);
        o.start(t);
        o.stop(t + 0.95);
      }
    });
  } catch { /* ignore */ }
}

/** Shield activate — Scene 9 (Privacy): deep thoom → D4→A4 affirm → secure seal.
 * Mood: strong, protective, fortress — mehfooz feel. Total ~1s. */
export function sfxShield(delay = 0) {
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + delay;

    // 1 — Deep protective "thoom" (80Hz + 120Hz low sines, 0.3s)
    const g1 = c.createGain();
    g1.gain.setValueAtTime(0.0001, t0);
    g1.gain.exponentialRampToValueAtTime(0.28, t0 + 0.03);
    g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    for (const f of [80, 120]) {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(f, t0);
      o.frequency.exponentialRampToValueAtTime(f * 0.82, t0 + 0.28);
      o.connect(g1).connect(c.destination);
      o.start(t0);
      o.stop(t0 + 0.35);
    }

    // 2 — Affirming perfect 5th: D4 → A4 (warm triangle, 0.2s each)
    const tones: Array<[number, number]> = [
      [293.66, 0.34], // D4
      [440.0, 0.56],  // A4
    ];
    for (const [freq, start] of tones) {
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(freq, t0 + start);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0 + start);
      g.gain.exponentialRampToValueAtTime(0.14, t0 + start + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + 0.2);
      o.connect(g).connect(c.destination);
      o.start(t0 + start);
      o.stop(t0 + start + 0.24);
    }

    // 3 — Secure "seal": filtered click + low shimmer
    const t2 = t0 + 0.78;
    const oc = c.createOscillator();
    oc.type = "square";
    oc.frequency.setValueAtTime(320, t2);
    const fc = c.createBiquadFilter();
    fc.type = "lowpass";
    fc.frequency.value = 900;
    const gc = c.createGain();
    gc.gain.setValueAtTime(0.0001, t2);
    gc.gain.exponentialRampToValueAtTime(0.1, t2 + 0.008);
    gc.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.06);
    oc.connect(fc).connect(gc).connect(c.destination);
    oc.start(t2);
    oc.stop(t2 + 0.08);
    const os = c.createOscillator();
    os.type = "sine";
    os.frequency.setValueAtTime(1568, t2); // G6 shimmer
    const gs = c.createGain();
    gs.gain.setValueAtTime(0.0001, t2);
    gs.gain.exponentialRampToValueAtTime(0.05, t2 + 0.04);
    gs.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.22);
    os.connect(gs).connect(c.destination);
    os.start(t2);
    os.stop(t2 + 0.25);
  } catch { /* ignore */ }
}

/** Spiritual pad + bell chime + 5 namaz ticks — Deen scene (scene 4). Roohani, calm. ~2s. */
export function sfxDeen() {
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime;

    // 1 — Ethereal pad: A2 + E3 (perfect fifth), slow swell in, gentle release
    const padGain = c.createGain();
    padGain.gain.setValueAtTime(0.0001, t0);
    padGain.gain.exponentialRampToValueAtTime(0.07, t0 + 0.7);
    padGain.gain.setValueAtTime(0.07, t0 + 1.2);
    padGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.0);
    padGain.connect(c.destination);
    const padParts: Array<[number, number]> = [[110, 1], [165, 0.7], [220, 0.35]];
    padParts.forEach(([freq, amp]) => {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = freq;
      const g = c.createGain();
      g.gain.value = amp;
      o.connect(g).connect(padGain);
      o.start(t0);
      o.stop(t0 + 2.05);
    });

    // 2 — Gentle bell chime (E6 + soft octave), 2s decay — masjid ki khamoshi jaisi
    const bellT = t0 + 0.15;
    const bellParts: Array<[number, number]> = [[1318.51, 0.09], [2637.02, 0.03]];
    bellParts.forEach(([freq, amp]) => {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, bellT);
      g.gain.exponentialRampToValueAtTime(amp, bellT + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, bellT + 2.0);
      o.connect(g).connect(c.destination);
      o.start(bellT);
      o.stop(bellT + 2.05);
    });

    // 3 — Five soft ticks, ek har namaz ke liye — 0.1s apart, dheere dheere
    for (let i = 0; i < 5; i++) {
      const tt = t0 + 0.7 + i * 0.1;
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = 880;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.06, tt + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.09);
      o.connect(g).connect(c.destination);
      o.start(tt);
      o.stop(tt + 0.12);
    }
  } catch { /* ignore */ }
}
