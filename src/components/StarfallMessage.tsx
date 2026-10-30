"use client";
// 🚀 Starfall: Galaxy Defender — source ka CORE port: sirf game + mechanics.
// Fazool UI nahi: koi settings/ship-select/achievements/pages nahi, koi sound/music nahi,
// koi storage nahi. Ship FIXED Vanguard (Interceptor), difficulty FIXED Veteran, speed FIXED 1 —
// source ke saare speed/stat values verbatim. Har viewer apni LOCAL run khelta hai;
// game over / victory par best score + best wave payload me jama hota hai.
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store";
import { parseStarfall } from "@/lib/games";
import { submitStarfallScore } from "@/lib/db";
import type { Message } from "@/lib/types";

/* ───────────────── engine data (source se verbatim) ───────────────── */
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randi = (a: number, b: number) => Math.floor(rand(a, b + 1));
const dist2 = (ax: number, ay: number, bx: number, by: number) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const fmt = (n: number) => Math.floor(n).toLocaleString("en-US");
const TAU = Math.PI * 2;
const W = 960, H = 640;

// FIXED ship: pehla/default hull — Vanguard (Balanced Interceptor). Baqi hulls nahi lane.
const SHIP = { id: "vanguard", name: "Vanguard", role: "Balanced Interceptor", hp: 110, speed: 272, fireRate: 7.5, damage: 10, dashCd: 2.1, radius: 16, color: "#38e1ff", accent: "#a78bfa" };
// FIXED difficulty: Veteran — saare multipliers 1
const DIFF = { hp: 1.0, speed: 1.0, dmg: 1.0, fire: 1.0, score: 1.0 };

interface EnemyDef { name: string; code: string; hp: number; speed: number; radius: number; score: number; color: string; damage: number }
const ENEMY_TYPES: Record<string, EnemyDef> = {
  scout:   { name: "Scout",   code: "S", hp: 16,  speed: 118, radius: 13, score: 100, color: "#7dd3fc", damage: 10 },
  weaver:  { name: "Weaver",  code: "W", hp: 24,  speed: 92,  radius: 14, score: 150, color: "#c4b5fd", damage: 12 },
  shooter: { name: "Shooter", code: "G", hp: 30,  speed: 66,  radius: 15, score: 200, color: "#6ee7b7", damage: 12 },
  tank:    { name: "Tank",    code: "T", hp: 95,  speed: 38,  radius: 24, score: 350, color: "#fda4af", damage: 18 },
  dasher:  { name: "Dasher",  code: "D", hp: 26,  speed: 74,  radius: 14, score: 220, color: "#fcd34d", damage: 16 },
  carrier: { name: "Carrier", code: "C", hp: 80,  speed: 44,  radius: 24, score: 400, color: "#f0abfc", damage: 14 },
  drone:   { name: "Drone",   code: "d", hp: 9,   speed: 148, radius: 9,  score: 60,  color: "#fda4af", damage: 8 },
  elite:   { name: "Elite",   code: "E", hp: 120, speed: 62,  radius: 21, score: 600, color: "#fb7185", damage: 16 },
};
interface PickupDef { name: string; code: string; color: string; dur: number }
const PICKUPS: Record<string, PickupDef> = {
  rapid:  { name: "Rapid Fire", code: "R", color: "#38e1ff", dur: 10 },
  spread: { name: "Spread Shot", code: "S", color: "#a78bfa", dur: 12 },
  pierce: { name: "Piercing Rounds", code: "P", color: "#f471b5", dur: 10 },
  shield: { name: "Aegis Shield", code: "◈", color: "#60a5fa", dur: 14 },
  repair: { name: "Repair Kit", code: "+", color: "#34d399", dur: 0 },
  bomb:   { name: "Nova Cell", code: "✸", color: "#fbbf24", dur: 0 },
  slow:   { name: "Chrono Field", code: "◔", color: "#93c5fd", dur: 6 },
  drone:  { name: "Wing Drone", code: "⬢", color: "#fda4af", dur: 20 },
};

type Effects = { rapid: number; spread: number; pierce: number; shield: number; slow: number; drone: number };
interface PlayerMods { damage: number; fireRate: number; speed: number; dashCd: number; maxHp: number; magnet: number; armor: number; novaGain: number }
interface Player {
  ship: typeof SHIP; x: number; y: number; vx: number; vy: number; radius: number;
  hp: number; shield: number; fireTimer: number; dashTimer: number; dashActive: number;
  invuln: number; weaponTier: number; tilt: number; thrust: number; dead: boolean; respawnTimer: number;
  effects: Effects; permaDrone: boolean; mods: PlayerMods;
  maxHp(): number; effDamage(): number; effFireRate(): number; effSpeed(): number; effDashCd(): number;
}
interface UpgradeDef { id: string; name: string; icon: string; desc: string; apply: (p: Player) => void }
const UPGRADES: UpgradeDef[] = [
  { id: "dmg",  name: "Heavy Caliber",   icon: "⚔", desc: "+18% damage per shot. Reliable, always good.", apply: (p) => { p.mods.damage *= 1.18; } },
  { id: "rate", name: "Overclocked Guns", icon: "»", desc: "+14% fire rate. More lead, more combo.", apply: (p) => { p.mods.fireRate *= 1.14; } },
  { id: "hull", name: "Reinforced Hull", icon: "⬡", desc: "+22 max hull and repair 22 now.", apply: (p) => { p.mods.maxHp += 22; p.hp = Math.min(p.maxHp(), p.hp + 22); } },
  { id: "dash", name: "Ion Thrusters",   icon: "»", desc: "Dash recharges 22% faster.", apply: (p) => { p.mods.dashCd *= 0.78; } },
  { id: "speed", name: "Vector Sails",   icon: "➤", desc: "+9% movement speed. Dodge everything.", apply: (p) => { p.mods.speed *= 1.09; } },
  { id: "drone", name: "Permanent Wingman", icon: "⬢", desc: "A loyal drone joins you for the rest of the run.", apply: (p) => { p.permaDrone = true; } },
  { id: "magnet", name: "Tractor Array", icon: "◎", desc: "Power cores drift toward you from much farther away.", apply: (p) => { p.mods.magnet += 90; } },
  { id: "plating", name: "Reactive Plating", icon: "▣", desc: "Take 12% less damage from all sources.", apply: (p) => { p.mods.armor *= 0.88; } },
  { id: "nova", name: "Nova Siphon",     icon: "✸", desc: "Nova Bomb charges 35% faster from kills.", apply: (p) => { p.mods.novaGain *= 1.35; } },
];

interface WaveGroup { type: string; count: number; gap: number; form: string; elite?: boolean }
interface WaveSpec { name: string; intel: string; boss?: string; groups: WaveGroup[]; endless?: boolean }
/* Handcrafted wave compositions — source se verbatim. Groups spawn in sequence. */
function waveSpec(n: number): WaveSpec {
  const specs: Record<number, WaveSpec> = {
    1:  { name: "First Contact", intel: "Scout darts probing the Gate. Learn your guns.", groups: [
            { type: "scout", count: 5, gap: 0.55, form: "line" }, { type: "scout", count: 4, gap: 0.5, form: "vee" } ] },
    2:  { name: "Cross Currents", intel: "Weavers crossing the lane. Lead your targets.", groups: [
            { type: "weaver", count: 4, gap: 0.7, form: "left" }, { type: "weaver", count: 4, gap: 0.7, form: "right" }, { type: "scout", count: 5, gap: 0.4, form: "line" } ] },
    3:  { name: "Gun Line", intel: "Shooter platforms holding range. Close the distance fast.", groups: [
            { type: "shooter", count: 3, gap: 1.1, form: "line" }, { type: "scout", count: 6, gap: 0.35, form: "arc" }, { type: "shooter", count: 2, gap: 1.0, form: "vee" } ] },
    4:  { name: "Ram Pressure", intel: "Dashers telegraph with a gold line — sidestep, then punish.", groups: [
            { type: "dasher", count: 3, gap: 1.2, form: "line" }, { type: "weaver", count: 5, gap: 0.6, form: "arc" }, { type: "tank", count: 1, gap: 0.5, form: "center" }, { type: "dasher", count: 3, gap: 1.0, form: "vee" } ] },
    5:  { name: "CAPITAL SIGNATURE", intel: "Boss: DREADNOUGHT-IX. Radial bursts are telegraphed — stay mobile.", boss: "boss1", groups: [
            { type: "scout", count: 4, gap: 0.5, form: "line" } ] },
    6:  { name: "Hive Season", intel: "Carriers split into drones. Focus the motherships.", groups: [
            { type: "carrier", count: 2, gap: 2.2, form: "vee" }, { type: "weaver", count: 5, gap: 0.55, form: "left" }, { type: "carrier", count: 1, gap: 1.0, form: "center" }, { type: "scout", count: 6, gap: 0.3, form: "arc" } ] },
    7:  { name: "Iron Cross", intel: "Tank-and-gun crossfire from both flanks.", groups: [
            { type: "tank", count: 2, gap: 2.6, form: "vee" }, { type: "shooter", count: 4, gap: 0.9, form: "line" }, { type: "dasher", count: 4, gap: 0.9, form: "arc" }, { type: "shooter", count: 3, gap: 0.8, form: "vee" } ] },
    8:  { name: "Ace Hunting", intel: "An Elite ace leads the pack. Spiral fire — keep range.", groups: [
            { type: "elite", count: 1, gap: 0.5, form: "center" }, { type: "weaver", count: 6, gap: 0.5, form: "right" }, { type: "dasher", count: 4, gap: 0.9, form: "line" }, { type: "shooter", count: 3, gap: 0.9, form: "arc" } ] },
    9:  { name: "The Gauntlet", intel: "Everything they have left, thrown at once. Hold the combo.", groups: [
            { type: "carrier", count: 2, gap: 2.0, form: "vee" }, { type: "elite", count: 1, gap: 1.4, form: "center" }, { type: "tank", count: 2, gap: 2.2, form: "vee" }, { type: "dasher", count: 5, gap: 0.7, form: "arc" }, { type: "weaver", count: 6, gap: 0.45, form: "line" } ] },
    10: { name: "FLAGSHIP AT THE GATE", intel: "Boss: STARFALL PRIME. Three phases. End this.", boss: "boss2", groups: [
            { type: "shooter", count: 3, gap: 0.9, form: "line" } ] },
  };
  if (specs[n]) return specs[n];
  /* Endless: procedurally varied mixes, scaling gently */
  const pool: [string, number][] = [["scout", 6], ["weaver", 5], ["shooter", 4], ["dasher", 4], ["carrier", 2], ["tank", 2]];
  const groups: WaveGroup[] = [];
  const groupCount = 3 + (n % 3);
  for (let i = 0; i < groupCount; i++) {
    const pick = pool[(n * 2 + i * 2) % pool.length];
    groups.push({ type: pick[0], count: Math.min(8, pick[1] + Math.floor((n - 10) / 3)), gap: Math.max(0.3, 0.65 - (n - 10) * 0.01), form: ["line", "vee", "arc", "left", "right"][(n + i) % 5], elite: n >= 13 && i === 1 });
  }
  if (n % 5 === 0) return { name: "Endless Capital", intel: "Another capital hull rises from the dark.", boss: n % 10 === 0 ? "boss2" : "boss1", groups: groups.slice(0, 2), endless: true };
  return { name: "Endless Wave " + n, intel: "The swarm does not tire. Neither do you.", groups, endless: true };
}

interface Enemy {
  type: string; name: string; code: string; color: string;
  x: number; y: number; vx: number; vy: number; radius: number; hp: number; maxHp: number;
  speed: number; score: number; damage: number; t: number; fireTimer: number;
  state: string; stateTimer: number; flash: number; chargeTele: number; dead: boolean; boss: boolean;
  idx?: number; escaped?: boolean; shotsFired?: number;
  phase?: number; attackTimer?: number; summonTimer?: number; baseY?: number;
}
interface Bullet { x: number; y: number; vx: number; vy: number; r: number; dmg: number; pierce: boolean; dead: boolean; friendly: boolean }
interface Pickup { type: string; x: number; y: number; vy: number; t: number; radius: number; dead: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number; ring?: boolean; r?: number; dead: boolean }
interface Floater { x: number; y: number; text: string; color: string; size: number; life: number; dead: boolean }
interface Telegraph { kind: string; x: number; y: number; tx: number; ty: number; t: number; dur: number; source: Enemy | null; dead: boolean }
interface Helper { angle: number; fireTimer: number; x: number; y: number }
interface SpawnItem { t: number; type: string; x: number; form: string; idx: number }

type Mode = "menu" | "playing" | "paused" | "upgrade" | "over" | "victory";
interface UpgradePick { id: string; name: string; icon: string; desc: string }
interface HudSnap { mode: Mode; score: number; wave: number; lives: number; hp: number; maxHp: number; special: number; combo: number; dashReady: boolean; novaReady: boolean; upPicked: boolean }
interface Hooks {
  onHud: (h: HudSnap) => void;
  onGameOver: (score: number, wave: number) => void;
  onVictory: (score: number, wave: number) => void;
  onUpgrade: (picks: UpgradePick[]) => void;
}

/* ───────────────── engine (source se port, DOM/audio/storage/settings hata kar) ───────────────── */
function createStarfallEngine(canvas: HTMLCanvasElement, hooks: Hooks) {
  let ctx: CanvasRenderingContext2D | null = null;
  try { ctx = canvas.getContext("2d"); } catch { /* ignore */ }
  let viewScale = 1;

  const stars: { x: number; y: number; z: number; r: number; tw: number }[] = [];
  for (let i = 0; i < 150; i++) stars.push({ x: rand(0, W), y: rand(0, H), z: rand(0.25, 1), r: rand(0.5, 1.7), tw: rand(0, TAU) });
  const nebulae = [
    { x: 180, y: 120, r: 240, c: "56,189,248", a: 0.10 }, { x: 800, y: 180, r: 280, c: "124,58,237", a: 0.12 },
    { x: 520, y: 520, r: 260, c: "190,24,93", a: 0.07 }, { x: 90, y: 480, r: 190, c: "8,145,178", a: 0.08 },
  ];

  const G = {
    mode: "menu" as Mode, time: 0, runTime: 0, wave: 0, score: 0, lives: 3,
    kills: 0, bossesDown: 0, shots: 0, hits: 0, bestCombo: 0,
    combo: 0, comboTimer: 0, special: 0, waveDamageTaken: false, endless: false,
    shake: 0, spawnQueue: [] as SpawnItem[], spawnTimer: 0, waveState: "idle", bossRef: null as Enemy | null,
    hurt: 0, banner: null as { kicker: string; title: string; text: string; t: number; dur: number } | null,
  };
  let player: Player | null = null;
  let bullets: Bullet[] = [], enemyBullets: Bullet[] = [], enemies: Enemy[] = [], pickups: Pickup[] = [],
      particles: Particle[] = [], floaters: Floater[] = [], telegraphs: Telegraph[] = [], helpers: Helper[] = [];
  let delayed: { t: number; fn: () => void }[] = [];
  let picks: UpgradeDef[] = [], upPicked = false;
  let destroyed = false, visible = true;

  const keys = new Set<string>();
  const pointer = { active: false, x: W / 2, y: H - 120, down: false, isTouch: false };
  let touchFire = false;

  function makePlayer(): Player {
    const s = SHIP;
    return {
      ship: s, x: W / 2, y: H - 92, vx: 0, vy: 0, radius: s.radius,
      hp: s.hp, shield: 0, fireTimer: 0, dashTimer: 0, dashActive: 0,
      invuln: 1.2, weaponTier: 1, tilt: 0, thrust: 0, dead: false, respawnTimer: 0,
      effects: { rapid: 0, spread: 0, pierce: 0, shield: 0, slow: 0, drone: 0 },
      permaDrone: false,
      mods: { damage: 1, fireRate: 1, speed: 1, dashCd: 1, maxHp: 0, magnet: 130, armor: 1, novaGain: 1 },
      maxHp() { return this.ship.hp + this.mods.maxHp; },
      effDamage() { return this.ship.damage * this.mods.damage * (1 + (this.weaponTier - 1) * 0.16); },
      effFireRate() { return this.ship.fireRate * this.mods.fireRate * (1 + (this.weaponTier - 1) * 0.10) * (this.effects.rapid > 0 ? 1.7 : 1); },
      effSpeed() { return this.ship.speed * this.mods.speed; },
      effDashCd() { return this.ship.dashCd * this.mods.dashCd; },
    };
  }
  player = makePlayer();

  function pushHud() {
    hooks.onHud({
      mode: G.mode, score: G.score, wave: G.wave, lives: G.lives,
      hp: player ? Math.max(0, Math.ceil(player.hp)) : 0, maxHp: player ? player.maxHp() : SHIP.hp,
      special: Math.floor(G.special), combo: G.combo,
      dashReady: !!player && !player.dead && player.dashTimer <= 0, novaReady: G.special >= 100, upPicked,
    });
  }
  function banner(kicker: string, title: string, text: string, ms?: number) {
    G.banner = { kicker, title, text: text || "", t: 0, dur: (ms || 2300) / 1000 };
  }
  function comboMult() { return 1 + Math.min(G.combo, 50) * 0.04; }
  function weaponName() {
    const names = ["Pulse Mk I", "Pulse Mk II", "Twin Pulse Mk III", "Lance Array Mk IV", "Starlance Mk V"];
    return player ? names[clamp(player.weaponTier - 1, 0, 4)] : names[0];
  }

  /* ───────── effects ───────── */
  function spawnParticles(x: number, y: number, count: number, color: string, speed: number, life: number, size: number) {
    for (let i = 0; i < count; i++) {
      if (particles.length >= 340) particles.shift();
      const a = rand(0, TAU), s = rand(speed * 0.25, speed);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(life * 0.5, life), maxLife: life, color, size: rand(size * 0.5, size), dead: false });
    }
  }
  function ringEffect(x: number, y: number, color: string) {
    particles.push({ x, y, vx: 0, vy: 0, life: 0.38, maxLife: 0.38, color, size: 4, ring: true, r: 8, dead: false });
  }
  function addFloater(x: number, y: number, text: string, color: string, size?: number) {
    if (floaters.length > 26) floaters.shift();
    floaters.push({ x, y, text, color, size: size || 13, life: 0.95, dead: false });
  }
  function addShake(n: number) { G.shake = Math.min(16, G.shake + n); }

  /* ───────── spawning, waves, bosses ───────── */
  function formationX(form: string, i: number, count: number) {
    const mid = W / 2, spacing = 74;
    switch (form) {
      case "vee": return mid + (i - (count - 1) / 2) * spacing;
      case "arc": return mid + (i - (count - 1) / 2) * 92;
      case "left": return 130 + i * 66;
      case "right": return W - 130 - i * 66;
      case "center": return mid + (i - (count - 1) / 2) * 90;
      default: return mid + (i - (count - 1) / 2) * spacing;
    }
  }
  function buildWave(n: number): WaveSpec {
    const spec = waveSpec(n);
    G.spawnQueue = []; G.waveState = "spawning";
    let t = 1.0;
    (spec.groups || []).forEach((g) => {
      for (let i = 0; i < g.count; i++) {
        G.spawnQueue.push({ t: t + i * g.gap, type: g.elite ? "elite" : g.type, x: clamp(formationX(g.form, i, g.count) + rand(-14, 14), 40, W - 40), form: g.form, idx: i });
      }
      t += g.count * g.gap + 1.15;
    });
    if (spec.boss) G.spawnQueue.push({ t: t + 0.6, type: spec.boss, x: W / 2, form: "boss", idx: 0 });
    G.spawnQueue.sort((a, b) => a.t - b.t);
    G.spawnTimer = 0;
    return spec;
  }
  function startWave(n: number) {
    G.wave = n; G.waveDamageTaken = false;
    const spec = buildWave(n);
    const isBoss = !!spec.boss;
    banner(isBoss ? "⚠ Capital Signature" : spec.endless ? "Endless Survival" : "Wave " + n, isBoss ? spec.name : "WAVE " + n, spec.intel);
    pushHud();
  }
  function spawnEnemy(type: string, x: number, yOverride?: number): Enemy | null {
    if (type === "boss1" || type === "boss2") { spawnBoss(type); return null; }
    const base = ENEMY_TYPES[type] || ENEMY_TYPES.scout;
    const hpScale = (1 + Math.max(0, G.wave - 1) * 0.055) * DIFF.hp;
    const e: Enemy = {
      type, name: base.name, code: base.code, color: base.color,
      x: clamp(x, 30, W - 30), y: yOverride !== undefined ? yOverride : -30,
      vx: 0, vy: 0, radius: base.radius, hp: base.hp * hpScale, maxHp: base.hp * hpScale,
      speed: base.speed * DIFF.speed * rand(0.92, 1.08), score: base.score, damage: base.damage,
      t: rand(0, TAU), fireTimer: rand(1.2, 2.6), state: "enter", stateTimer: 0, flash: 0,
      chargeTele: 0, dead: false, boss: false,
    };
    enemies.push(e);
    return e;
  }
  function spawnBoss(kind: string) {
    const isPrime = kind === "boss2";
    const hp = (isPrime ? 1500 : 950) * DIFF.hp * (G.endless ? 1 + (G.wave - 10) * 0.03 : 1);
    const boss: Enemy = {
      type: kind, name: isPrime ? "STARFALL PRIME" : "DREADNOUGHT-IX", code: "B", color: isPrime ? "#f471b5" : "#a78bfa",
      x: W / 2, y: -90, vx: 0, vy: 0, radius: isPrime ? 62 : 54, hp, maxHp: hp,
      speed: isPrime ? 44 : 38, score: isPrime ? 6000 : 4000, damage: 22,
      t: 0, fireTimer: 2.2, state: "enter", stateTimer: 0, flash: 0, chargeTele: 0, dead: false, boss: true,
      phase: 1, attackTimer: 3.0, summonTimer: 8, baseY: 118,
    };
    enemies.push(boss); G.bossRef = boss;
  }
  function dropPickup(x: number, y: number, forceType?: string) {
    let type = forceType;
    if (!type) {
      const roll = Math.random();
      type = roll < 0.15 ? "repair" : roll < 0.28 ? "bomb" : roll < 0.42 ? "rapid" : roll < 0.56 ? "spread" :
             roll < 0.68 ? "shield" : roll < 0.79 ? "pierce" : roll < 0.90 ? "slow" : "drone";
    }
    if (pickups.length > 14) pickups.shift();
    pickups.push({ type, x: clamp(x, 30, W - 30), y, vy: 62, t: rand(0, TAU), radius: 14, dead: false });
  }

  /* ───────── combat ───────── */
  function firingHeld() { return keys.has("Space") || pointer.down || touchFire; }
  function moveVector() {
    let x = 0, y = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) y -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) y += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
    return { x, y };
  }
  function playerFire(dt: number) {
    if (!player || player.dead) return;
    player.fireTimer -= dt;
    const interval = 1 / player.effFireRate();
    if (firingHeld() && player.fireTimer <= 0) {
      player.fireTimer = Math.max(player.fireTimer + interval, -interval);
      const tier = player.weaponTier;
      const size = 3 + tier * 0.55;
      const dmg = player.effDamage();
      const pl = player;
      const mk = (dx: number, ang: number) => {
        if (bullets.length > 240) return;
        bullets.push({ x: pl.x + dx, y: pl.y - 18, vx: Math.sin(ang) * 40, vy: -560, r: size, dmg, pierce: pl.effects.pierce > 0, dead: false, friendly: true });
        G.shots++;
      };
      mk(0, 0);
      if (tier >= 2 || player.effects.spread > 0) { mk(-11, -0.10); mk(11, 0.10); }
      if (tier >= 4) { mk(-20, -0.20); mk(20, 0.20); }
      if (tier >= 5) { mk(-6, -0.05); mk(6, 0.05); }
      spawnParticles(player.x, player.y - 20, 1, "#7dd3fc", 40, 0.12, 1.6);
    }
  }
  function droneFire(fromX: number, fromY: number) {
    if (bullets.length > 240) return;
    bullets.push({ x: fromX, y: fromY - 10, vx: 0, vy: -520, r: 3, dmg: player ? player.effDamage() * 0.45 : 5, pierce: false, dead: false, friendly: true });
  }
  function enemyFire(e: Enemy, ang: number, speed: number, r?: number, dmg?: number) {
    if (enemyBullets.length > 280) return;
    enemyBullets.push({ x: e.x, y: e.y + e.radius * 0.5, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: r || 4.5, dmg: dmg || e.damage, pierce: false, dead: false, friendly: false });
  }
  function tryDash() {
    if (!player || player.dead || player.dashTimer > 0 || G.mode !== "playing") return;
    player.dashTimer = player.effDashCd(); player.dashActive = 0.22; player.invuln = Math.max(player.invuln, 0.30);
    const m = moveVector();
    const dx = m.x !== 0 || m.y !== 0 ? m.x : 0, dy = m.x !== 0 || m.y !== 0 ? m.y : -1;
    const len = Math.hypot(dx, dy) || 1;
    player.x = clamp(player.x + (dx / len) * 118, player.radius, W - player.radius);
    player.y = clamp(player.y + (dy / len) * 118, player.radius, H - player.radius);
    spawnParticles(player.x, player.y, 14, player.ship.color, 190, 0.3, 2.4);
    pushHud();
  }
  function tryNova() {
    if (!player || player.dead || G.mode !== "playing") return;
    if (G.special < 100) { addFloater(player.x, player.y - 30, "Nova " + Math.floor(G.special) + "% — kills se charge karo", "#c4b5fd", 12); return; }
    G.special = 0;
    addShake(10);
    ringEffect(player.x, player.y, "#c4b5fd");
    enemies.slice().forEach((e) => { damageEnemy(e, e.boss ? 260 : 9999, true); });
    enemyBullets.forEach((b) => { b.dead = true; });
    addFloater(player.x, player.y - 34, "NOVA BOMB!", "#fbbf24", 18);
    pushHud();
  }
  function damageEnemy(e: Enemy, dmg: number, isNova: boolean) {
    if (!e || e.dead) return;
    e.hp -= dmg; e.flash = 0.09;
    if (!isNova) { G.hits++; G.special = clamp(G.special + 0.7, 0, 100); }
    spawnParticles(e.x, e.y, 3, "#fef08a", 130, 0.16, 1.8);
    if (e.hp <= 0) killEnemy(e);
  }
  function killEnemy(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    G.combo++; G.comboTimer = 3.4; G.bestCombo = Math.max(G.bestCombo, G.combo);
    const gained = Math.round(e.score * comboMult() * DIFF.score);
    G.score += gained; G.kills++;
    G.special = clamp(G.special + (e.boss ? 30 : 2.6) * (player ? player.mods.novaGain : 1), 0, 100);
    addFloater(e.x, e.y - 8, "+" + fmt(gained), e.boss ? "#fbbf24" : "#a5f3fc", e.boss ? 20 : 13);
    spawnParticles(e.x, e.y, e.boss ? 60 : 16, e.color, e.boss ? 300 : 210, e.boss ? 0.8 : 0.45, e.boss ? 3.4 : 2.4);
    addShake(e.boss ? 12 : 2.5);
    if (e.type === "carrier") {
      for (let i = 0; i < 3; i++) spawnEnemy("drone", e.x + rand(-26, 26), e.y + rand(-8, 14));
      dropPickup(e.x, e.y);
    } else if (e.boss) {
      onBossDown(e);
    } else if (Math.random() < 0.16 || e.type === "tank" || e.type === "elite") {
      dropPickup(e.x, e.y);
    }
    /* Weapon tier grows with sustained performance */
    if (player && !e.boss) {
      const tierTarget = G.kills >= 90 ? 5 : G.kills >= 55 ? 4 : G.kills >= 30 ? 3 : G.kills >= 12 ? 2 : 1;
      if (tierTarget > player.weaponTier) {
        player.weaponTier = tierTarget;
        addFloater(player.x, player.y - 32, "Weapon upgraded: " + weaponName() + "!", "#fbbf24", 14);
        ringEffect(player.x, player.y, "#fbbf24");
      }
    }
    pushHud();
  }
  function onBossDown(e: Enemy) {
    G.bossesDown++;
    dropPickup(e.x - 30, e.y, "repair"); dropPickup(e.x + 30, e.y, "bomb"); dropPickup(e.x, e.y + 16, "shield");
    if (G.bossRef === e) G.bossRef = null;
    banner("Capital Destroyed", e.name + " DOWN", "+" + fmt(e.score) + " pts — salvage incoming");
  }
  function damagePlayer(amount: number) {
    if (!player || player.dead || player.invuln > 0 || player.dashActive > 0) return;
    if (player.effects.shield > 0) {
      player.invuln = 0.45; ringEffect(player.x, player.y, "#60a5fa");
      spawnParticles(player.x, player.y, 8, "#93c5fd", 150, 0.25, 2);
      addFloater(player.x, player.y - 30, "Shield ne hit roka!", "#93c5fd", 12);
      pushHud(); return;
    }
    const dmg = amount * DIFF.dmg * player.mods.armor;
    player.hp -= dmg; player.invuln = 0.9; G.waveDamageTaken = true;
    G.combo = 0; G.comboTimer = 0;
    G.hurt = 1; addShake(7);
    spawnParticles(player.x, player.y, 16, "#fb7185", 220, 0.4, 2.4);
    if (player.hp <= 0) loseLife();
    pushHud();
  }
  function loseLife() {
    if (!player) return;
    G.lives--;
    explodePlayer();
    if (G.lives <= 0) { player.dead = true; gameOver(); return; }
    player.dead = true; player.respawnTimer = 1.4; player.hp = player.maxHp();
    addFloater(W / 2, H / 2, "Ship lost! " + G.lives + (G.lives === 1 ? " life" : " lives") + " baqi", "#fb7185", 16);
  }
  function explodePlayer() {
    if (!player) return;
    spawnParticles(player.x, player.y, 42, player.ship.color, 280, 0.7, 3);
    spawnParticles(player.x, player.y, 20, "#ffffff", 180, 0.4, 2);
    addShake(12);
  }

  /* ───────── enemy behaviour & boss patterns (source se verbatim) ───────── */
  function updateEnemy(e: Enemy, dt: number, timeScale: number) {
    e.t += dt; if (e.flash > 0) e.flash -= dt;
    const px = player && !player.dead ? player.x : W / 2;
    const py = player && !player.dead ? player.y : H - 100;
    switch (e.type) {
      case "scout":
        e.y += e.speed * dt * timeScale;
        e.x += clamp(px - e.x, -1, 1) * 34 * dt;
        if (e.y > H + 40) { e.dead = true; e.escaped = true; }
        break;
      case "drone":
        e.y += e.speed * dt * timeScale;
        e.x += Math.sin(e.t * 5) * 60 * dt + clamp(px - e.x, -1, 1) * 44 * dt;
        if (e.y > H + 30) { e.dead = true; e.escaped = true; }
        break;
      case "weaver":
        e.y += e.speed * 0.72 * dt * timeScale;
        e.x += Math.sin(e.t * 2.4) * 150 * dt;
        e.x = clamp(e.x, 26, W - 26);
        if (e.y > H + 40) { e.dead = true; e.escaped = true; }
        break;
      case "shooter": {
        const targetY = 120 + (e.idx || 0) * 26;
        if (e.y < targetY) e.y += e.speed * dt * timeScale;
        else { e.x += Math.sin(e.t * 0.9) * 42 * dt; e.x = clamp(e.x, 50, W - 50); }
        e.fireTimer -= dt * timeScale;
        if (e.fireTimer <= 0 && e.y > 0 && player && !player.dead) {
          e.fireTimer = rand(1.7, 2.4) * DIFF.fire;
          const a = Math.atan2(py - e.y, px - e.x);
          enemyFire(e, a, 265);
          const sx = px, sy = py;
          delayed.push({ t: 0.13, fn: () => { if (!e.dead && G.mode === "playing") enemyFire(e, Math.atan2(sy - e.y, sx - e.x), 265); } });
        }
        break;
      }
      case "tank": {
        const targetY = 105 + (e.idx || 0) * 20;
        if (e.y < targetY) e.y += e.speed * dt * timeScale;
        e.fireTimer -= dt * timeScale;
        if (e.fireTimer <= 0 && e.y > 0 && player && !player.dead) {
          e.fireTimer = rand(2.4, 3.1) * DIFF.fire;
          telegraphs.push({ kind: "shot", x: e.x, y: e.y, tx: px, ty: py, t: 0, dur: 0.55, source: e, dead: false });
        }
        break;
      }
      case "dasher": {
        e.stateTimer += dt * timeScale;
        if (e.state === "enter") { e.y += 95 * dt * timeScale; if (e.y > 92) { e.state = "hover"; e.stateTimer = 0; } }
        else if (e.state === "hover") {
          e.x += clamp(px - e.x, -1, 1) * 52 * dt;
          if (e.stateTimer > rand(1.0, 1.4)) { e.state = "telegraph"; e.stateTimer = 0; telegraphs.push({ kind: "dash", x: e.x, y: e.y, tx: px, ty: py, t: 0, dur: 0.5, source: e, dead: false }); }
        } else if (e.state === "telegraph") {
          if (e.stateTimer >= 0.5) {
            e.state = "charge"; e.stateTimer = 0;
            const a = Math.atan2(py - e.y, px - e.x);
            e.vx = Math.cos(a) * 430; e.vy = Math.sin(a) * 430;
          }
        } else if (e.state === "charge") {
          e.x += e.vx * dt * timeScale; e.y += e.vy * dt * timeScale;
          if (e.stateTimer > 0.85) { e.state = "hover"; e.stateTimer = -1.2; e.vx = e.vy = 0; }
          if (e.y > H + 40 || e.x < -40 || e.x > W + 40) { e.dead = true; e.escaped = true; }
        }
        break;
      }
      case "carrier": {
        const targetY = 96 + (e.idx || 0) * 18;
        if (e.y < targetY) e.y += e.speed * dt * timeScale;
        else e.x += Math.sin(e.t * 0.6) * 30 * dt;
        e.fireTimer -= dt * timeScale;
        if (e.fireTimer <= 0) { e.fireTimer = rand(2.6, 3.4) * DIFF.fire; if (enemies.length < 26) spawnEnemy("drone", e.x + rand(-18, 18), e.y + 22); }
        break;
      }
      case "elite": {
        const targetY = 128;
        if (e.y < targetY) e.y += 70 * dt * timeScale;
        else e.x = W / 2 + Math.sin(e.t * 0.65) * 250;
        e.fireTimer -= dt * timeScale;
        if (e.fireTimer <= 0 && player && !player.dead) {
          e.fireTimer = 0.34 * DIFF.fire;
          e.shotsFired = (e.shotsFired || 0) + 1;
          if (e.shotsFired % 7 === 0) {
            const a = Math.atan2(py - e.y, px - e.x);
            [-0.16, 0, 0.16].forEach((off) => enemyFire(e, a + off, 275));
          } else {
            enemyFire(e, e.t * 2.2, 215, 4, 11); enemyFire(e, e.t * 2.2 + Math.PI, 215, 4, 11);
          }
        }
        break;
      }
      default:
        break;
    }
    if (e.boss) updateBoss(e, dt, timeScale);
  }
  function updateBoss(e: Enemy, dt: number, timeScale: number) {
    const px = player && !player.dead ? player.x : W / 2;
    const py = player && !player.dead ? player.y : H - 100;
    const ratio = e.hp / e.maxHp;
    const newPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (newPhase !== (e.phase || 1)) {
      e.phase = newPhase;
      banner("Boss Phase " + newPhase, e.name, newPhase === 2 ? "New attack pattern: aimed fans + escorts!" : "Final phase: radial storms. Stay calm, keep firing!");
      addShake(6);
      ringEffect(e.x, e.y, e.color);
      telegraphs = telegraphs.filter((t) => t.source !== e);
    }
    if (e.state === "enter") {
      e.y += 62 * dt;
      if (e.y >= (e.baseY || 118)) e.state = "fight";
      return;
    }
    e.x = W / 2 + Math.sin(e.t * (e.phase === 3 ? 0.55 : 0.38)) * (e.type === "boss2" ? 235 : 200);
    e.y = (e.baseY || 118) + Math.sin(e.t * 0.8) * 16;
    e.attackTimer = (e.attackTimer || 0) - dt * timeScale;
    e.summonTimer = (e.summonTimer || 0) - dt * timeScale;
    if ((e.summonTimer || 0) <= 0 && enemies.length < 18) {
      e.summonTimer = e.phase === 3 ? 6.5 : 9.5;
      spawnEnemy("scout", e.x - 90, e.y + 40); spawnEnemy("scout", e.x + 90, e.y + 40);
      addFloater(e.x, e.y + 70, e.name + " ne escort scouts bheje!", "#fb7185", 12);
    }
    if ((e.attackTimer || 0) <= 0 && player && !player.dead) {
      const pattern = e.phase === 1 ? (Math.random() < 0.6 ? "fan" : "ringTele")
                    : e.phase === 2 ? (Math.random() < 0.5 ? "fan" : "spiral")
                    : (Math.random() < 0.5 ? "ringTele" : "spiral");
      if (pattern === "fan") {
        e.attackTimer = e.phase === 3 ? 1.5 : 2.0;
        const a = Math.atan2(py - e.y, px - e.x);
        const spread = e.phase === 1 ? 0.14 : 0.17, count = e.phase === 1 ? 3 : 5;
        for (let i = 0; i < count; i++) enemyFire(e, a + (i - (count - 1) / 2) * spread, 252, 4.5, 14);
      } else if (pattern === "spiral") {
        e.attackTimer = 1.15;
        for (let i = 0; i < 6; i++) enemyFire(e, e.t * 3 + i * (TAU / 6), 195, 4, 12);
      } else {
        e.attackTimer = e.phase === 3 ? 2.1 : 2.6;
        telegraphs.push({ kind: "ring", x: e.x, y: e.y, tx: 0, ty: 0, t: 0, dur: 0.75, source: e, dead: false });
      }
    }
  }
  function fireTelegraph(t: Telegraph) {
    const e = t.source;
    if (!e || e.dead) return;
    if (t.kind === "ring") {
      const n = e.phase === 3 ? 18 : 14;
      for (let i = 0; i < n; i++) enemyFire(e, (i / n) * TAU + e.t, 208, 4.5, 13);
      ringEffect(e.x, e.y, "#fb7185");
    } else if (t.kind === "shot") {
      const a = Math.atan2(t.ty - e.y, t.tx - e.x);
      enemyFire(e, a, 330, 6, e.damage);
      spawnParticles(e.x, e.y + 12, 4, "#fda4af", 120, 0.2, 2);
    }
  }

  /* ───────── pickups & helper drones ───────── */
  function applyPickup(type: string) {
    const def = PICKUPS[type]; if (!def || !player) return;
    if (type === "repair") {
      player.hp = Math.min(player.maxHp(), player.hp + 35);
      addFloater(player.x, player.y - 30, "Repair Kit: +35 hull", "#34d399", 13);
    } else if (type === "bomb") {
      G.special = clamp(G.special + 50, 0, 100);
      addFloater(player.x, player.y - 30, "Nova Cell: +50% Nova charge", "#fbbf24", 13);
      if (G.special >= 100) addFloater(player.x, player.y - 48, "NOVA READY — ✸ dabao!", "#fbbf24", 14);
    } else {
      player.effects[type as keyof Effects] = def.dur;
      if (type === "shield") player.shield = 100;
      addFloater(player.x, player.y - 30, def.name + " active (" + def.dur + "s)", def.color, 13);
    }
    ringEffect(player.x, player.y, def.color);
    pushHud();
  }
  function updateHelpers(dt: number) {
    const wantDrone = !!player && !player.dead && (player.effects.drone > 0 || player.permaDrone);
    if (wantDrone && helpers.length === 0 && player) helpers.push({ angle: 0, fireTimer: 0.4, x: player.x - 34, y: player.y + 8 });
    if (!wantDrone) helpers.length = 0;
    helpers.forEach((h) => {
      if (!player) return;
      h.angle += dt * 2.2;
      const tx = player.x + Math.cos(h.angle) * 38, ty = player.y + 10 + Math.sin(h.angle) * 12;
      h.x = lerp(h.x, tx, 0.18); h.y = lerp(h.y, ty, 0.18);
      h.fireTimer -= dt;
      if (h.fireTimer <= 0 && enemies.length > 0 && firingHeld()) { h.fireTimer = 0.24; droneFire(h.x, h.y); }
    });
  }

  /* ───────── main update (source ka dt-based loop, clamped dt) ───────── */
  function updateFx(dt: number) {
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
    if (G.hurt > 0) G.hurt = Math.max(0, G.hurt - dt * 2.0);
    if (G.banner) { G.banner.t += dt; if (G.banner.t >= G.banner.dur) G.banner = null; }
    particles.forEach((p) => {
      p.life -= dt;
      if (p.ring) { p.r = (p.r || 8) + 260 * dt; if (p.life <= 0) p.dead = true; return; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.vy *= 0.985;
      if (p.life <= 0) p.dead = true;
    });
    particles = particles.filter((p) => !p.dead);
    floaters.forEach((f) => { f.life -= dt; f.y -= 34 * dt; if (f.life <= 0) f.dead = true; });
    floaters = floaters.filter((f) => !f.dead);
  }
  function update(dt: number) {
    G.time += dt;
    /* starfield always drifts gently, even in menus */
    const scroll = G.mode === "playing" ? 46 : 13;
    stars.forEach((s) => { s.y += scroll * s.z * dt; if (s.y > H + 2) { s.y = -2; s.x = rand(0, W); } });

    if (G.mode !== "playing") { updateFx(dt); return; }
    G.runTime += dt;
    const enemyTimeScale = player && player.effects.slow > 0 ? 0.52 : 1;

    /* delayed shots (shooter burst) */
    for (let i = delayed.length - 1; i >= 0; i--) {
      delayed[i].t -= dt;
      if (delayed[i].t <= 0) { const fn = delayed[i].fn; delayed.splice(i, 1); fn(); }
    }

    /* --- spawning --- */
    if (G.spawnQueue.length > 0) {
      G.spawnTimer += dt;
      while (G.spawnQueue.length > 0 && G.spawnQueue[0].t <= G.spawnTimer) {
        const s = G.spawnQueue.shift()!;
        const just = spawnEnemy(s.type, s.x);
        if (just && !just.boss) just.idx = s.idx;
      }
    } else if (enemies.length === 0 && G.waveState === "spawning") {
      G.waveState = "clearing"; onWaveCleared();
      return;
    }
    if (G.bossRef && G.bossRef.dead) G.bossRef = null;

    /* --- combo decay --- */
    if (G.comboTimer > 0) { G.comboTimer -= dt; if (G.comboTimer <= 0) G.combo = 0; }

    /* --- player --- */
    if (player) {
      if (player.dead) {
        player.respawnTimer -= dt;
        if (player.respawnTimer <= 0 && G.lives >= 0 && G.mode === "playing") {
          player.dead = false; player.x = W / 2; player.y = H - 92; player.invuln = 2.2;
          ringEffect(player.x, player.y, player.ship.color);
          addFloater(player.x, player.y - 30, "Re-deployed. Brief shield active.", "#34d399", 12);
        }
      } else {
        (Object.keys(player.effects) as (keyof Effects)[]).forEach((k) => { if (player!.effects[k] > 0) player!.effects[k] -= dt; });
        if (player.effects.shield <= 0) player.shield = Math.max(0, player.shield - dt * 30);
        if (player.invuln > 0) player.invuln -= dt;
        if (player.dashTimer > 0) player.dashTimer -= dt;
        if (player.dashActive > 0) player.dashActive -= dt;

        const mv = moveVector();
        const usedKeyboard = mv.x !== 0 || mv.y !== 0;
        if (usedKeyboard) {
          const len = Math.hypot(mv.x, mv.y) || 1;
          const sp = player.effSpeed() * (player.dashActive > 0 ? 1.6 : 1);
          player.vx = (mv.x / len) * sp; player.vy = (mv.y / len) * sp;
        } else if (pointer.active) {
          const dx = pointer.x - player.x, dy = pointer.y - player.y;
          const d = Math.hypot(dx, dy);
          const sp = player.effSpeed();
          if (d > 6) { const v = Math.min(sp, d * 9); player.vx = (dx / d) * v; player.vy = (dy / d) * v; }
          else { player.vx *= 0.6; player.vy *= 0.6; }
        } else { player.vx *= 0.72; player.vy *= 0.72; }
        /* substep movement to avoid tunnelling at high speed */
        const steps = Math.max(1, Math.ceil((Math.hypot(player.vx, player.vy) * dt) / 14));
        for (let i = 0; i < steps; i++) {
          player.x = clamp(player.x + player.vx * dt / steps, player.radius + 4, W - player.radius - 4);
          player.y = clamp(player.y + player.vy * dt / steps, player.radius + 4, H - player.radius - 4);
        }
        player.tilt = lerp(player.tilt, clamp(player.vx * 0.00045, -0.3, 0.3), 0.2);
        player.thrust = firingHeld() || Math.hypot(player.vx, player.vy) > 30 ? 1 : 0.4;
        if (keys.has("ShiftLeft") || keys.has("ShiftRight")) tryDash();
        playerFire(dt);
        if (Math.random() < 0.65) spawnParticles(player.x + rand(-4, 4), player.y + 17, 1, player.ship.color, 60, 0.28, 2);
      }
    }
    updateHelpers(dt);

    /* --- enemies, telegraphs --- */
    for (let i = telegraphs.length - 1; i >= 0; i--) {
      const t = telegraphs[i];
      t.t += dt * enemyTimeScale;
      if (t.t >= t.dur) { fireTelegraph(t); telegraphs.splice(i, 1); }
    }
    enemies.forEach((e) => updateEnemy(e, dt, enemyTimeScale));
    enemies = enemies.filter((e) => !e.dead);

    /* --- bullets (substepped collision) --- */
    const stepBullets = (arr: Bullet[], dtScale: number): Bullet[] => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const b = arr[i];
        const dist = Math.hypot(b.vx, b.vy) * dt * dtScale;
        const sub = Math.max(1, Math.ceil(dist / 10));
        for (let s = 0; s < sub && !b.dead; s++) {
          b.x += b.vx * dt * dtScale / sub; b.y += b.vy * dt * dtScale / sub;
          if (b.friendly) {
            for (const e of enemies) {
              if (e.dead || e.y < -70) continue;
              const rr = e.radius + b.r;
              if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
                damageEnemy(e, b.dmg, false);
                if (!b.pierce) b.dead = true;
                break;
              }
            }
          } else if (player && !player.dead) {
            const rr = player.radius * 0.82 + b.r;
            if (dist2(b.x, b.y, player.x, player.y) < rr * rr) { b.dead = true; damagePlayer(b.dmg); }
          }
        }
        if (b.x < -30 || b.x > W + 30 || b.y < -40 || b.y > H + 40) b.dead = true;
      }
      return arr.filter((b) => !b.dead);
    };
    bullets = stepBullets(bullets, 1);
    enemyBullets = stepBullets(enemyBullets, enemyTimeScale);

    /* --- enemy contact --- */
    if (player && !player.dead) {
      for (const e of enemies) {
        if (e.dead) continue;
        const rr = e.radius + player.radius * 0.8;
        if (dist2(e.x, e.y, player.x, player.y) < rr * rr) {
          if (!e.boss) damageEnemy(e, 9999, true);
          damagePlayer(e.boss ? 24 : e.damage + 4);
          break;
        }
      }
    }

    /* --- pickups --- */
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.t += dt; p.y += p.vy * dt;
      if (player && !player.dead) {
        const d2 = dist2(p.x, p.y, player.x, player.y);
        const magnetR = player.mods.magnet;
        if (d2 < magnetR * magnetR) { const d = Math.sqrt(d2) || 1; p.x += (player.x - p.x) / d * 260 * dt; p.y += (player.y - p.y) / d * 260 * dt; }
        if (d2 < (p.radius + player.radius + 4) * (p.radius + player.radius + 4)) { applyPickup(p.type); pickups.splice(i, 1); continue; }
      }
      if (p.y > H + 26) pickups.splice(i, 1);
    }

    updateFx(dt);
  }

  /* ───────── wave / run lifecycle ───────── */
  function onWaveCleared() {
    if (G.mode !== "playing") return;
    G.score += 500 + G.wave * 50;
    if (!G.waveDamageTaken && G.wave > 0) { G.score += 300; addFloater(W / 2, 120, "Flawless wave! +300 bonus", "#fbbf24", 16); }
    if (G.wave === 10 && !G.endless) { victory(); return; }
    showUpgradeChoices();
  }
  function showUpgradeChoices() {
    G.mode = "upgrade"; upPicked = false;
    const pool = UPGRADES.slice();
    picks = [];
    for (let i = 0; i < 3 && pool.length; i++) picks.push(pool.splice(randi(0, pool.length - 1), 1)[0]);
    hooks.onUpgrade(picks.map((u) => ({ id: u.id, name: u.name, icon: u.icon, desc: u.desc })));
    pushHud();
  }
  function chooseUpgrade(i: number) {
    if (G.mode !== "upgrade" || upPicked || !player) return;
    const u = picks[i]; if (!u) return;
    u.apply(player); upPicked = true;
    addFloater(W / 2, 110, "Installed: " + u.name, "#fbbf24", 15);
    pushHud();
  }
  function skipUpgrade() {
    if (G.mode !== "upgrade" || upPicked) return;
    G.score += 250; upPicked = true;
    pushHud();
  }
  function nextWave() {
    if (G.mode !== "upgrade" || !upPicked) return;
    G.mode = "playing"; G.waveState = "spawning";
    startWave(G.wave + 1);
    pushHud();
  }
  function startRun() {
    G.score = 0; G.kills = 0; G.bossesDown = 0; G.shots = 0; G.hits = 0; G.bestCombo = 0;
    G.combo = 0; G.comboTimer = 0; G.special = 25; G.lives = 3; G.runTime = 0; G.endless = false;
    G.shake = 0; G.hurt = 0; G.banner = null; G.bossRef = null;
    bullets = []; enemyBullets = []; enemies = []; pickups = []; particles = []; floaters = []; telegraphs = []; helpers = []; delayed = [];
    keys.clear(); pointer.down = false; touchFire = false;
    player = makePlayer();
    G.mode = "playing";
    startWave(1);
    pushHud();
  }
  function pauseGame() {
    if (G.mode !== "playing") return;
    G.mode = "paused";
    keys.clear(); pointer.down = false; touchFire = false;
    pushHud();
  }
  function resumeGame() {
    if (G.mode !== "paused") return;
    G.mode = "playing";
    pushHud();
  }
  function gameOver() {
    G.mode = "over";
    hooks.onGameOver(G.score, G.wave);
    pushHud();
  }
  function victory() {
    G.mode = "victory"; G.endless = true;
    hooks.onVictory(G.score, G.wave);
    pushHud();
  }
  function continueEndless() {
    if (G.mode !== "victory") return;
    G.mode = "playing"; G.waveState = "spawning";
    if (player) { player.hp = player.maxHp(); player.dead = false; }
    banner("Endless Survival", "ENDLESS SURVIVAL", "How long can you hold?");
    startWave(11);
    pushHud();
  }

  /* ───────── rendering (source se verbatim; boss bar + banner canvas par saada) ───────── */
  function drawShip(x: number, y: number, ship: { color: string; accent: string }, scale: number, tilt: number, ghost: boolean) {
    if (!ctx) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt || 0); ctx.scale(scale, scale);
    ctx.globalAlpha = ghost ? 0.45 : 1;
    const flame = 10 + Math.sin(G.time * 34) * 3.4 + (player && player.thrust ? 5 : 0);
    const fg = ctx.createLinearGradient(0, 12, 0, 12 + flame + 12);
    fg.addColorStop(0, "rgba(165,243,252,.95)"); fg.addColorStop(0.4, "rgba(56,189,248,.65)"); fg.addColorStop(1, "rgba(124,58,237,0)");
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(-5, 13); ctx.lineTo(0, 14 + flame + 10); ctx.lineTo(5, 13); ctx.closePath(); ctx.fill();
    const hg = ctx.createLinearGradient(0, -20, 0, 16);
    hg.addColorStop(0, "#f8fafc"); hg.addColorStop(0.35, ship.color); hg.addColorStop(1, "#1e3a5f");
    ctx.fillStyle = hg; ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -21); ctx.lineTo(6, -6); ctx.lineTo(17, 8); ctx.lineTo(19, 14); ctx.lineTo(8, 12);
    ctx.lineTo(4, 16); ctx.lineTo(-4, 16); ctx.lineTo(-8, 12); ctx.lineTo(-19, 14); ctx.lineTo(-17, 8); ctx.lineTo(-6, -6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = ship.accent;
    ctx.beginPath(); ctx.ellipse(0, -6, 3.6, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.fillRect(-2.2, -19, 4.4, 6);
    ctx.fillStyle = ship.accent; ctx.fillRect(-17, 9, 6, 3); ctx.fillRect(11, 9, 6, 3);
    ctx.restore();
  }
  function drawEnemy(e: Enemy) {
    if (!ctx) return;
    ctx.save(); ctx.translate(e.x, e.y);
    const flash = e.flash > 0;
    const body = flash ? "#ffffff" : e.color;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.fillStyle = body;
    ctx.shadowColor = e.color; ctx.shadowBlur = 9;
    const r = e.radius;
    ctx.beginPath();
    switch (e.type) {
      case "scout": ctx.moveTo(0, r); ctx.lineTo(r * 0.8, -r * 0.7); ctx.lineTo(0, -r * 0.3); ctx.lineTo(-r * 0.8, -r * 0.7); break;
      case "drone": ctx.moveTo(0, r); ctx.lineTo(r, 0); ctx.lineTo(0, -r); ctx.lineTo(-r, 0); break;
      case "weaver": ctx.moveTo(0, r); ctx.quadraticCurveTo(r * 1.15, 0, 0, -r); ctx.quadraticCurveTo(-r * 1.15, 0, 0, r); break;
      case "shooter": ctx.rect(-r, -r * 0.7, r * 2, r * 1.4); break;
      case "tank":
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.5; ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r); }
        break;
      case "dasher": ctx.moveTo(0, r * 1.15); ctx.lineTo(r * 0.55, -r * 0.4); ctx.lineTo(r * 0.2, -r); ctx.lineTo(-r * 0.2, -r); ctx.lineTo(-r * 0.55, -r * 0.4); break;
      case "carrier":
        ctx.moveTo(-r, -r * 0.45); ctx.lineTo(-r * 0.4, -r); ctx.lineTo(r * 0.4, -r); ctx.lineTo(r, -r * 0.45); ctx.lineTo(r * 0.6, r * 0.8); ctx.lineTo(-r * 0.6, r * 0.8);
        break;
      case "elite":
        for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i / 5 * TAU; const a2 = a + TAU / 10; ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a2) * r * 0.52, Math.sin(a2) * r * 0.52); }
        break;
      default: /* bosses: layered capital hulls */
        ctx.moveTo(0, r); ctx.lineTo(r * 0.72, r * 0.25); ctx.lineTo(r * 0.95, -r * 0.55); ctx.lineTo(r * 0.4, -r * 0.95);
        ctx.lineTo(-r * 0.4, -r * 0.95); ctx.lineTo(-r * 0.95, -r * 0.55); ctx.lineTo(-r * 0.72, r * 0.25);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    if (e.type === "shooter") { ctx.fillStyle = flash ? "#fff" : "#064e3b"; ctx.fillRect(-4, r * 0.5, 8, r * 0.55); }
    if (e.type === "tank" || e.type === "carrier") {
      ctx.fillStyle = "rgba(2,6,18,.55)"; ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, TAU); ctx.fill();
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, TAU); ctx.fill();
    }
    if (e.boss) {
      ctx.strokeStyle = e.color; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.55 + Math.sin(e.t * 3) * 3, 0, TAU); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, 7 + Math.sin(e.t * 5) * 1.4, 0, TAU); ctx.fill();
      ctx.fillStyle = e.color; ctx.fillRect(-r * 0.8, -r - 8, r * 1.6, 4);
    }
    if (!e.boss && e.maxHp >= 40 && e.hp < e.maxHp) {
      ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(-r, -r - 9, r * 2, 4);
      ctx.fillStyle = "#fda4af"; ctx.fillRect(-r, -r - 9, r * 2 * clamp(e.hp / e.maxHp, 0, 1), 4);
    }
    ctx.restore();
  }
  function drawPickup(p: Pickup) {
    if (!ctx) return;
    const def = PICKUPS[p.type]; if (!def) return;
    ctx.save(); ctx.translate(p.x, p.y + Math.sin(p.t * 4) * 2.5);
    const pulse = 1 + Math.sin(p.t * 5) * 0.09;
    ctx.scale(pulse, pulse);
    ctx.shadowColor = def.color; ctx.shadowBlur = 14;
    ctx.fillStyle = "rgba(3,8,22,.9)"; ctx.strokeStyle = def.color; ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + p.t * 0.7; ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * 14, Math.sin(a) * 14); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = def.color; ctx.font = "900 13px ui-monospace, monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(def.code, 0, 1);
    ctx.restore();
  }
  function render() {
    if (!ctx) return;
    ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#050a1e"); bg.addColorStop(0.55, "#04060f"); bg.addColorStop(1, "#070313");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    nebulae.forEach((n, i) => {
      const gx = n.x + Math.sin(G.time * 0.05 + i * 2) * 12, gy = n.y + Math.cos(G.time * 0.04 + i) * 9;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, n.r);
      g.addColorStop(0, "rgba(" + n.c + "," + n.a + ")"); g.addColorStop(1, "rgba(" + n.c + ",0)");
      ctx.fillStyle = g; ctx.fillRect(gx - n.r, gy - n.r, n.r * 2, n.r * 2);
    });
    ctx.strokeStyle = "rgba(103,232,249,.20)"; ctx.lineWidth = 1.4;
    ctx.strokeRect(10.5, 10.5, W - 21, H - 21);
    ctx.strokeStyle = "rgba(148,163,184,.055)";
    for (let x = 120; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x, H - 14); ctx.stroke(); }
    stars.forEach((s) => {
      const a = 0.45 + Math.abs(Math.sin(G.time * 1.6 + s.tw)) * 0.5;
      ctx.globalAlpha = a * s.z;
      ctx.fillStyle = s.z > 0.8 ? "#e0f2fe" : "#94a3b8";
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.save();
    if (G.shake > 0.15) ctx.translate(rand(-G.shake, G.shake) * 0.5, rand(-G.shake, G.shake) * 0.5);

    telegraphs.forEach((t) => {
      if (!ctx) return;
      const k = clamp(t.t / t.dur, 0, 1);
      ctx.save();
      if (t.kind === "ring") {
        ctx.strokeStyle = "rgba(251,113,133," + (0.35 + k * 0.6) + ")"; ctx.lineWidth = 2 + k * 2;
        ctx.setLineDash([10, 7]);
        ctx.beginPath(); ctx.arc(t.x, t.y, 30 + k * 52, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(251,113,133,.12)"; ctx.beginPath(); ctx.arc(t.x, t.y, 30 + k * 52, 0, TAU); ctx.fill();
      } else {
        ctx.strokeStyle = t.kind === "dash" ? "rgba(251,191,36," + (0.3 + k * 0.65) + ")" : "rgba(251,113,133," + (0.3 + k * 0.65) + ")";
        ctx.lineWidth = t.kind === "dash" ? 16 : 5;
        ctx.setLineDash([14, 9]);
        ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.tx, t.ty); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.restore();
    });

    pickups.forEach(drawPickup);
    helpers.forEach((h) => { drawShip(h.x, h.y, { color: "#fda4af", accent: "#fff" }, 0.55, Math.sin(h.angle) * 0.2, false); });
    enemies.forEach(drawEnemy);

    bullets.forEach((b) => {
      if (!ctx) return;
      ctx.save();
      ctx.strokeStyle = "rgba(56,225,255,.35)"; ctx.lineWidth = b.r * 1.1;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = b.pierce ? "#f9a8d4" : "#a5f3fc";
      ctx.shadowColor = "#38e1ff"; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.restore();
    });
    enemyBullets.forEach((b) => {
      if (!ctx) return;
      ctx.save();
      ctx.fillStyle = "#fda4af"; ctx.shadowColor = "#f43f5e"; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.4, 0, TAU); ctx.fill();
      ctx.restore();
    });

    if (player && !player.dead && G.mode !== "menu") {
      const blink = player.invuln > 0 && Math.floor(G.time * 14) % 2 === 0;
      drawShip(player.x, player.y, player.ship, 1, player.tilt, blink && player.dashActive <= 0);
      if (player.effects.shield > 0 || player.shield > 0) {
        ctx.save(); ctx.translate(player.x, player.y);
        ctx.strokeStyle = "rgba(96,165,250," + (0.55 + Math.sin(G.time * 6) * 0.2) + ")"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 27 + Math.sin(G.time * 5) * 1.6, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      if (player.dashActive > 0) {
        ctx.save(); ctx.globalAlpha = 0.35; ctx.translate(player.x, player.y);
        ctx.strokeStyle = player.ship.color; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(0, 0, 34 - player.dashActive * 40, 0, TAU); ctx.stroke(); ctx.restore();
      }
    }

    particles.forEach((p) => {
      if (!ctx) return;
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.save(); ctx.globalAlpha = a;
      if (p.ring) {
        ctx.strokeStyle = p.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r || 8, 0, TAU); ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 0.4, 0, TAU); ctx.fill();
      }
      ctx.restore();
    });
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    floaters.forEach((f) => {
      if (!ctx) return;
      ctx.save(); ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.font = "800 " + f.size + "px ui-monospace, monospace";
      ctx.fillStyle = f.color; ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = 4;
      ctx.fillText(f.text, f.x, f.y); ctx.restore();
    });
    ctx.restore();

    if (player && player.effects.slow > 0 && G.mode === "playing") {
      ctx.fillStyle = "rgba(96,165,250,.07)"; ctx.fillRect(0, 0, W, H);
    }
    /* hurt flash — canvas vignette (DOM flash ki jagah) */
    if (G.hurt > 0) {
      const hg2 = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
      hg2.addColorStop(0, "rgba(255,45,85,0)"); hg2.addColorStop(1, "rgba(255,45,85," + 0.38 * G.hurt + ")");
      ctx.fillStyle = hg2; ctx.fillRect(0, 0, W, H);
    }
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.38)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    /* boss HP bar — canvas ke top par saada */
    const boss = G.bossRef;
    if (boss && !boss.dead && G.mode !== "menu") {
      const bw = 320, bx = W / 2 - bw / 2, by = 20;
      ctx.save();
      ctx.fillStyle = "rgba(2,6,18,.55)"; ctx.fillRect(bx - 8, by - 15, bw + 16, 36);
      ctx.fillStyle = "#fda4af"; ctx.font = "700 11px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      ctx.fillText(boss.name + " · PHASE " + ["I", "II", "III"][(boss.phase || 1) - 1], W / 2, by - 3);
      ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(bx, by + 2, bw, 7);
      ctx.fillStyle = boss.color; ctx.fillRect(bx, by + 2, bw * clamp(boss.hp / boss.maxHp, 0, 1), 7);
      ctx.restore();
    }
    /* wave banner — canvas par saada text */
    if (G.banner && (G.mode === "playing" || G.mode === "upgrade")) {
      const b = G.banner, k = b.t / b.dur;
      const alpha = k < 0.12 ? k / 0.12 : k > 0.8 ? Math.max(0, (1 - k) / 0.2) : 1;
      ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = "center";
      ctx.fillStyle = "rgba(2,6,18,.45)"; ctx.fillRect(W / 2 - 260, 84, 520, b.text ? 86 : 66);
      ctx.fillStyle = "#38e1ff"; ctx.font = "700 12px ui-monospace, monospace"; ctx.textBaseline = "alphabetic";
      ctx.fillText(b.kicker.toUpperCase(), W / 2, 108);
      ctx.fillStyle = "#eef7ff"; ctx.font = "800 30px ui-sans-system, system-ui, sans-serif";
      ctx.fillText(b.title, W / 2, 140);
      if (b.text) { ctx.fillStyle = "#9fb4d0"; ctx.font = "400 13px ui-sans-system, system-ui, sans-serif"; ctx.fillText(b.text, W / 2, 162); }
      ctx.restore();
    }
  }

  /* ───────── sizing + input + loop ───────── */
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    canvas.width = Math.max(320, Math.round(rect.width * dpr));
    canvas.height = Math.max(213, Math.round(rect.height * dpr));
    viewScale = canvas.width / W;
  }
  function canvasPos(evt: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    return { x: clamp((evt.clientX - r.left) / r.width * W, 0, W), y: clamp((evt.clientY - r.top) / r.height * H, 0, H) };
  }
  const onPointerDown = (e: PointerEvent) => {
    const p = canvasPos(e); pointer.x = p.x; pointer.y = p.y; pointer.active = true; pointer.down = true;
    pointer.isTouch = e.pointerType === "touch";
    if (pointer.isTouch) touchFire = true;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* optional */ }
    if (G.mode === "playing") canvas.focus({ preventScroll: true });
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!pointer.active && e.pointerType === "touch") return;
    const p = canvasPos(e); pointer.x = p.x; pointer.y = p.y;
    if (e.pointerType !== "touch") pointer.active = true;
  };
  const releasePointer = (e: PointerEvent) => { pointer.down = false; if (e.pointerType === "touch") { pointer.active = false; touchFire = false; } };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const code = e.code;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(code)) e.preventDefault();
    keys.add(code);
    if (e.repeat) return;
    if (code === "Escape" || code === "KeyP") {
      if (G.mode === "playing") pauseGame(); else if (G.mode === "paused") resumeGame();
    } else if (code === "KeyE" || code === "KeyX") { if (G.mode === "playing") tryNova(); }
    else if (code === "KeyR") { if (G.mode === "playing" || G.mode === "paused" || G.mode === "over") startRun(); }
    else if (code === "Enter" || code === "Space") {
      if (G.mode === "menu" || G.mode === "over") startRun();
      else if (G.mode === "paused") resumeGame();
      else if (G.mode === "victory") continueEndless();
    }
    else if (code === "Digit1" || code === "Digit2" || code === "Digit3") {
      if (G.mode === "upgrade" && !upPicked) chooseUpgrade(Number(code.slice(-1)) - 1);
    }
  };
  const onKeyUp = (e: KeyboardEvent) => { keys.delete(e.code); };
  const onBlur = () => { keys.clear(); pointer.down = false; touchFire = false; };
  const onVisibility = () => { if (document.hidden && G.mode === "playing") pauseGame(); };
  const onResize = () => resizeCanvas();

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);
  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver === "function") { observer = new ResizeObserver(resizeCanvas); observer.observe(canvas); }
  let io: IntersectionObserver | null = null;
  if (typeof IntersectionObserver === "function") { io = new IntersectionObserver((es) => { visible = es.some((en) => en.isIntersecting); }, { threshold: 0.02 }); io.observe(canvas); }
  resizeCanvas();
  pushHud();

  let lastTs = 0, lastHud = 0, raf = 0;
  function frame(ts: number) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000; lastTs = ts;
    dt = clamp(dt, 0, 0.05);
    if (document.hidden || !visible) return;
    update(dt);
    render();
    if (ts - lastHud > 100) { pushHud(); lastHud = ts; }
  }
  raf = requestAnimationFrame(frame);

  return {
    start: startRun,
    restart() { startRun(); },
    togglePause() { if (G.mode === "paused") resumeGame(); else pauseGame(); },
    chooseUpgrade, skipUpgrade, nextWave, continueEndless,
    dash: tryDash, nova: tryNova,
    get started() { return G.mode !== "menu"; },
    destroy() {
      destroyed = true; cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", releasePointer);
      canvas.removeEventListener("pointercancel", releasePointer);
      canvas.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect(); io?.disconnect();
      delayed = [];
    },
  };
}
type StarfallEngine = ReturnType<typeof createStarfallEngine>;

/* ───────────────── React card — sirf header, canvas, patli HUD line, top scores ───────────────── */
const IDLE_HUD: HudSnap = { mode: "menu", score: 0, wave: 0, lives: 3, hp: SHIP.hp, maxHp: SHIP.hp, special: 0, combo: 0, dashReady: false, novaReady: false, upPicked: false };
export default function StarfallMessage({ m }: { m: Message }) {
  const st = parseStarfall(m.caption);
  const me = useStore((s) => s.me);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engRef = useRef<StarfallEngine | null>(null);
  const [hud, setHud] = useState<HudSnap>(IDLE_HUD);
  const [picks, setPicks] = useState<UpgradePick[] | null>(null);
  // Score submit handlers hamesha latest payload dekhen — ref pattern
  const latestRef = useRef({ id: m.id, me, best: 0 });
  latestRef.current = { id: m.id, me, best: st?.scores?.[me]?.best || 0 };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const same = (a: HudSnap, b: HudSnap) =>
      a.mode === b.mode && a.score === b.score && a.wave === b.wave && a.lives === b.lives && a.hp === b.hp &&
      a.maxHp === b.maxHp && a.special === b.special && a.combo === b.combo && a.dashReady === b.dashReady &&
      a.novaReady === b.novaReady && a.upPicked === b.upPicked;
    const eng = createStarfallEngine(canvas, {
      onHud: (h) => setHud((prev) => (same(prev, h) ? prev : h)),
      onGameOver: (score, wave) => { submitStarfallScore(latestRef.current.id, score, wave, true).catch(() => {}); },
      onVictory: (score, wave) => { if (score > latestRef.current.best) submitStarfallScore(latestRef.current.id, score, wave, false).catch(() => {}); },
      onUpgrade: (p) => setPicks(p),
    });
    engRef.current = eng;
    return () => { eng.destroy(); engRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.id]);

  if (!st) return <p className="text-sm italic text-[#80848e]">Game load nahi hua</p>;

  const myEntry = st.scores[me];
  const myBest = myEntry?.best || 0;
  const top = Object.entries(st.scores).filter(([, e]) => e.best > 0).sort((a, b) => b[1].best - a[1].best).slice(0, 5);
  const inGame = hud.mode === "playing";
  const act = (fn?: () => void) => { fn?.(); canvasRef.current?.focus({ preventScroll: true }); };
  const btnMain = "rounded-full bg-[#38e1ff] px-6 py-2.5 text-sm font-extrabold text-[#06222b] soft-shadow transition hover:brightness-105 active:scale-95";

  return (
    <div className="mt-1.5 w-full max-w-[540px] rounded-xl border border-black/10 bg-white p-3.5 soft-shadow">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#5865f2]">
        🚀 Starfall — Galaxy Defender
        {myBest > 0 && (
          <span className="ml-auto rounded-full bg-[#38e1ff]/10 px-2 py-0.5 text-[10px] font-extrabold normal-case tracking-normal text-[#0e7ea3]">
            🏆 Mera best {myBest.toLocaleString()} · Wave {myEntry?.wave || 0}
          </span>
        )}
      </p>

      <div className="relative overflow-hidden rounded-lg" style={{ background: "#040713" }}>
        <canvas
          ref={canvasRef}
          width={960}
          height={640}
          tabIndex={0}
          aria-label="Starfall game — drag karke ship ghumao, firing automatic hai"
          className="block h-auto w-full touch-none outline-none"
          style={{ aspectRatio: "960 / 640" }}
        />
        {hud.mode === "menu" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <button onClick={() => act(() => engRef.current?.start())} className={btnMain}>
              ▶ Khelo
            </button>
          </div>
        )}
        {hud.mode === "paused" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/55">
            <p className="text-sm font-bold text-white">⏸ Ruka hua</p>
            <button onClick={() => act(() => engRef.current?.togglePause())} className={btnMain}>
              ▶ Jari rakho
            </button>
          </div>
        )}
        {hud.mode === "upgrade" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/60 p-3">
            {!hud.upPicked && picks ? (
              <>
                <p className="text-sm font-bold text-white">🌊 Wave {hud.wave} clear! Ek upgrade chuno:</p>
                <div className="flex w-full max-w-[430px] flex-col gap-1.5">
                  {picks.map((u, i) => (
                    <button
                      key={u.id}
                      onClick={() => act(() => engRef.current?.chooseUpgrade(i))}
                      className="flex items-center gap-2.5 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-left text-white transition hover:bg-white/20 active:scale-[0.99]"
                    >
                      <span className="text-lg leading-none">{u.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-bold leading-tight">{u.name}</span>
                        <span className="block truncate text-[11px] leading-tight text-white/70">{u.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <button onClick={() => act(() => engRef.current?.skipUpgrade())} className="text-[11px] font-semibold text-white/60 underline underline-offset-2 transition hover:text-white/90">
                  Skip karo (+250 pts)
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-white">✅ Upgrade lag gaya!</p>
                <button onClick={() => act(() => { engRef.current?.nextWave(); setPicks(null); })} className={btnMain}>
                  ▶ Wave {hud.wave + 1} shuru karo
                </button>
              </>
            )}
          </div>
        )}
        {hud.mode === "victory" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/55">
            <p className="text-sm font-bold text-white">🏆 Galaxy bach gaya! Score {hud.score.toLocaleString()}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => act(() => engRef.current?.continueEndless())} className={btnMain}>
                ♾ Endless jari rakho
              </button>
              <button onClick={() => act(() => engRef.current?.start())} className="rounded-full bg-white/15 px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-white/25 active:scale-95">
                🔁 Phir se
              </button>
            </div>
          </div>
        )}
        {hud.mode === "over" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/55">
            <p className="text-sm font-bold text-white">🏁 Game Over — Score {hud.score.toLocaleString()} · Wave {hud.wave}</p>
            <button onClick={() => act(() => engRef.current?.start())} className={btnMain}>
              🔁 Phir se khelo
            </button>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold text-[#2f3035]">
        <span>Score <b className="tabular-nums">{hud.score.toLocaleString()}</b></span>
        <span className="text-[#80848e]">Wave <b className="text-[#2f3035] tabular-nums">{hud.wave || "—"}</b></span>
        <span aria-label="lives">❤️ ×{hud.lives}</span>
        <span className="flex items-center gap-1.5" aria-label="hull">
          <span className="text-[#80848e]">HP</span>
          <span className="h-2 w-14 overflow-hidden rounded-full bg-black/10">
            <span className="block h-full rounded-full bg-[#34d399]" style={{ width: Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100)) + "%" }} />
          </span>
          <b className="tabular-nums">{hud.hp}</b>
        </span>
        {hud.combo > 1 && <span className="text-[#b97e10]">🔥 ×{(1 + Math.min(hud.combo, 50) * 0.04).toFixed(1)}</span>}
        <span className="ml-auto flex items-center gap-1">
          <button
            onClick={() => act(() => engRef.current?.dash())}
            disabled={!inGame || !hud.dashReady}
            className="grid h-8 w-8 place-items-center rounded-full text-[15px] transition hover:bg-black/5 disabled:opacity-30"
            title="Dash (Shift)"
          >
            💨
          </button>
          <button
            onClick={() => act(() => engRef.current?.nova())}
            disabled={!inGame || !hud.novaReady}
            className={`grid h-8 w-8 place-items-center rounded-full text-[15px] transition hover:bg-black/5 disabled:opacity-30 ${hud.novaReady ? "text-[#b97e10]" : ""}`}
            title={`Nova Bomb — charge ${hud.special}%`}
          >
            ✸
          </button>
          <button
            onClick={() => act(() => engRef.current?.togglePause())}
            disabled={!inGame && hud.mode !== "paused"}
            className="grid h-8 w-8 place-items-center rounded-full text-[#5c5e66] transition hover:bg-black/5 disabled:opacity-30"
            title={hud.mode === "paused" ? "Jari rakho" : "Pause"}
          >
            {hud.mode === "paused" ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button
            onClick={() => act(() => engRef.current?.restart())}
            disabled={hud.mode === "menu"}
            className="grid h-8 w-8 place-items-center rounded-full text-[#5c5e66] transition hover:bg-black/5 disabled:opacity-30"
            title="Phir se shuru"
          >
            <RotateCcw size={16} />
          </button>
        </span>
      </div>

      {top.length > 0 && (
        <div className="mt-2 border-t border-black/5 pt-2">
          {top.map(([id, e], i) => (
            <p key={id} className="flex items-center gap-1.5 py-0.5 text-xs text-[#5c5e66]">
              <span>{["🥇", "🥈", "🥉", "4.", "5."][i]}</span>
              <span className={`font-semibold ${id === me ? "text-[#5865f2]" : "text-[#2f3035]"}`}>{e.name}</span>
              {e.wave > 0 && <span className="rounded-full bg-black/5 px-1.5 py-px text-[10px] font-bold text-[#80848e]">Wave {e.wave}</span>}
              <span className="ml-auto font-bold tabular-nums text-[#2f3035]">{e.best.toLocaleString()}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
