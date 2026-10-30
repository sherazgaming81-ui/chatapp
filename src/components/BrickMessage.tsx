"use client";
// 🧱 Brick Breaker — "Prism Break" ka CORE port: sirf game + mechanics.
// Fazool UI nahi: koi settings/achievements/sidebar/toast nahi, koi SFX/music nahi,
// speed FIXED Normal (DIFF.speed = 1, baseSpeed 350 + level*4.6), STEP = 1/120 fixed timestep.
// Har viewer apni LOCAL run khelta hai; game over / level clear par best score payload me jama hota hai.
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store";
import { parseBrick } from "@/lib/games";
import { submitBrickScore } from "@/lib/db";
import type { Message } from "@/lib/types";

/* ───────────────── engine (source se port, DOM/audio/storage hata kar) ───────────────── */
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const W = 960, H = 650, WALL = 18, STEP = 1 / 120, MAX_BALLS = 5, MAX_SCORE = 999999999;
// Fixed theme: neon (source ka default) — koi theme selector nahi
const THEME = {
  board: "#111219", grid: "#262833", accent: "#d4f88a", secondary: "#ad98ec", teal: "#82cfbd",
  warm: "#edb38f", danger: "#f38fa4", ink: "#202916", steel: "#48505f",
  bricks: ["#ae9be8", "#9884cf", "#d3ee96", "#bcd780", "#7fcfbc", "#68b8ac", "#dcab88", "#ba94c7", "#cfe7a0"],
};
// Fixed difficulty: NORMAL — speed multiplier hamesha 1
const DIFF = { width: 124, speed: 1, drop: 0.20, boss: 1 };
const POWERS: Record<string, { symbol: string; name: string; tone: "accent" | "secondary" | "teal" | "warm" | "danger"; duration: number }> = {
  wide: { symbol: "W", name: "Wide paddle", tone: "accent", duration: 16 },
  multi: { symbol: "M", name: "Multi-ball", tone: "secondary", duration: 0 },
  slow: { symbol: "~", name: "Slow ball", tone: "teal", duration: 12 },
  sticky: { symbol: "C", name: "Sticky catch", tone: "secondary", duration: 14 },
  laser: { symbol: "L", name: "Laser paddle", tone: "warm", duration: 14 },
  life: { symbol: "+", name: "Extra life", tone: "danger", duration: 0 },
  shield: { symbol: "#", name: "Safety shield", tone: "teal", duration: 0 },
  bonus: { symbol: "$", name: "Bonus points", tone: "accent", duration: 0 },
};

type MaskFn = (x: number, y: number, r: number, c: number, rows: number) => boolean;
const LEVELS: { name: string; rows: number; mask: MaskFn }[] = [
  { name: "First light", rows: 6, mask: (x, y, r) => (r < 2 ? Math.abs(x) >= 2 && Math.abs(x) <= 5 + r : Math.abs(x) <= 8 - r) },
  { name: "Ripple effect", rows: 7, mask: (x, y) => Math.abs(y - 1.6 * Math.sin(x * .68)) < 1.75 },
  { name: "Split decision", rows: 7, mask: (x, y, r) => Math.abs(x) >= 2 && Math.abs(x) <= 6 - Math.floor(r / 3) },
  { name: "Diamond dust", rows: 9, mask: (x, y) => Math.abs(x) / 1.5 + Math.abs(y) <= 4.4 },
  { name: "The Gatekeeper", rows: 6, mask: (x, y, r) => Math.abs(x) >= 4 || (r < 2 && Math.abs(x) >= 2) || (r === 5 && Math.abs(x) <= 2) },
  { name: "Cross current", rows: 8, mask: (x, y) => Math.abs(x - y * 1.5) < 1.7 || Math.abs(x + y * 1.5) < 1.7 },
  { name: "Soft focus", rows: 9, mask: (x, y) => { const d = x * x / 2 + y * y; return d > 5 && d < 23; } },
  { name: "Fault line", rows: 8, mask: (x, y, r) => Math.abs(x - y * .65) > 1.3 && (r < 6 || Math.abs(x) > 3) },
  { name: "Switchback", rows: 8, mask: (x, y, r) => Math.abs(x - (r % 4 < 2 ? -2.5 : 2.5)) < 3 || r === 3 || r === 4 },
  { name: "Twin engines", rows: 7, mask: (x, y) => Math.abs(Math.abs(x) - 3) + Math.abs(y) < 3.5 },
  { name: "Open circuit", rows: 9, mask: (x, y, r, c) => (r < 2 || r > 6 || c < 2 || c > 10) && !(r > 3 && r < 6 && (c < 2 || c > 10)) },
  { name: "Night shift", rows: 9, mask: (x, y, r, c) => (Math.floor(r / 2) + Math.floor(c / 2)) % 2 === 0 },
  { name: "High frequency", rows: 9, mask: (x, y) => Math.abs(y - 2.7 * Math.sin(x * .9)) < 1.25 || Math.abs(y + 2.7 * Math.sin(x * .9)) < .65 },
  { name: "Pressure points", rows: 9, mask: (x, y) => Math.abs(Math.abs(x) - 3) + Math.abs(Math.abs(y) - 2) < 2.4 },
  { name: "Iron garden", rows: 7, mask: (x, y, r) => (Math.abs(x) >= 2 && Math.abs(x) <= 2 + r * .75) || r === 0 },
  { name: "Satellite", rows: 9, mask: (x, y) => { const d = x * x / 2 + y * y; return d < 3.2 || (d > 11 && d < 24); } },
  { name: "Slipstream", rows: 8, mask: (x, y, r) => Math.abs(Math.abs(x) - (r % 4) * 1.5) < 1.7 },
  { name: "Afterimage", rows: 9, mask: (x, y, r, c) => (r + c) % 3 !== 0 && (r < 6 || Math.abs(x) < 5) },
  { name: "Glass ceiling", rows: 9, mask: (x, y, r) => r < 2 || Math.abs(r - (Math.abs(x) * .8 + 2)) < 1.4 },
  { name: "The Architect", rows: 7, mask: (x, y, r) => Math.abs(x) + Math.abs(y) < 3.6 || (Math.abs(x) > 4 && r !== 3) },
  { name: "Supernova", rows: 9, mask: (x, y) => Math.abs(x) < 1.2 || Math.abs(y) < 1.2 || Math.abs(Math.abs(x) - Math.abs(y) * 1.4) < .8 },
  { name: "Neon labyrinth", rows: 9, mask: (x, y, r, c) => (r % 3 === 0 ? (Math.floor(r / 3) % 2 === 0 ? c < 11 : c > 1) : c === 2 || c === 10 || (c === 6 && r < 6)) },
  { name: "Interference", rows: 9, mask: (x, y) => Math.sin(x * 1.2) * Math.cos(y * 1.1) > .05 || Math.abs(x) < .5 },
  { name: "Event horizon", rows: 9, mask: (x, y) => { const d = Math.sqrt(x * x / 2 + y * y); return d < 1.4 || (d > 2 && d < 2.9) || (d > 3.7 && d < 4.8); } },
  { name: "The Overseer", rows: 7, mask: (x, y, r) => r === 0 || r === 3 || Math.abs(x) > 4 || (Math.abs(x) < 2 && r < 5) },
  { name: "Final approach", rows: 9, mask: (x, y, r) => Math.abs(Math.abs(x) - (6 - r * .65)) < 1.8 || r === 0 },
  { name: "Quantum leap", rows: 9, mask: (x, y, r, c) => (c + r * 2) % 7 < 3 || (c - r + 14) % 7 < 2 },
  { name: "Prism heart", rows: 9, mask: (x, y, r) => { const a = x / 5.8, b = (4 - r) / 3.8; return Math.pow(a * a + b * b - 1, 3) - a * a * b * b * b <= 0; } },
  { name: "Breaking point", rows: 9, mask: (x, y, r, c) => !(c === 6 && r % 3 !== 0) && !(r % 3 === 1 && c % 4 === 1) },
  { name: "The Last Warden", rows: 8, mask: (x, y, r) => (r < 2 ? Math.abs(x) % 3 < 1.1 : r < 4 ? Math.abs(x) > 1 : Math.abs(x) <= 9 - r) },
];
function levelDefinition(level: number) {
  const base = LEVELS[(level - 1) % 30], cycle = Math.floor((level - 1) / 30);
  return { ...base, name: cycle ? "Afterglow " + cycle + " / " + base.name : base.name, cycle };
}
function seededRandom(seed: number) {
  let t = seed >>> 0;
  return () => { t += 0x6D2B79F5; let n = t; n = Math.imul(n ^ (n >>> 15), n | 1); n ^= n + Math.imul(n ^ (n >>> 7), n | 61); return ((n ^ (n >>> 14)) >>> 0) / 4294967296; };
}

interface Brick { id: number; x: number; y: number; w: number; h: number; type: string; hp: number; maxHp: number; row: number; colorIndex: number; alive: boolean; flash: number }
interface Ball { x: number; y: number; r: number; vx: number; vy: number; attached: boolean; offset: number; trail: { x: number; y: number }[]; trailClock: number; hits: Map<number, number>; bossHit: number }
interface Boss { x: number; y: number; w: number; h: number; hp: number; maxHp: number; flash: number; attackTimer: number; name: string }
type GState = "menu" | "serving" | "playing" | "paused" | "levelClear" | "bossIntro" | "gameOver";
interface HudSnap { state: GState; score: number; level: number; lives: number }
interface Hooks { onHud: (h: HudSnap) => void; onGameOver: (score: number) => void; onLevelClear: (score: number) => void }

function buildLevel(level: number): Brick[] {
  const def = levelDefinition(level), rng = seededRandom(level * 9973 + 73), rows = Math.min(9, def.rows + (def.cycle % 3 === 2 ? 1 : 0));
  const bricks: Brick[] = [], startY = level % 5 === 0 ? 157 : 76, cellW = 66, cellH = 31, left = (W - (13 * cellW - 8)) / 2;
  let steelCount = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < 13; c++) {
    const pc = def.cycle % 2 ? 12 - c : c, pr = def.cycle ? (r + def.cycle) % rows : r;
    if (!def.mask(pc - 6, pr - (rows - 1) / 2, pr, pc, rows)) continue;
    let type = "standard", hp = 1; const chance = rng();
    if (level >= 5 && r % 2 === 0 && c % 3 === 1 && chance < .20 && steelCount < Math.min(7, 2 + Math.floor(level / 5))) { type = "steel"; hp = Infinity; steelCount++; }
    else if (level >= 3 && chance < .085) type = "explosive";
    else if (chance < .125) type = "bonus";
    else if (level >= 3 && chance < .125 + Math.min(.45, .10 + level * .009)) { type = "armor"; hp = 2 + (level >= 12 ? 1 : 0) + (level >= 24 && rng() > .45 ? 1 : 0); }
    bricks.push({ id: r * 13 + c, x: left + c * cellW, y: startY + r * cellH, w: 58, h: 23, type, hp, maxHp: hp, row: r, colorIndex: (r + def.cycle) % 9, alive: true, flash: 0 });
  }
  return bricks;
}

function createBrickEngine(canvas: HTMLCanvasElement, hooks: Hooks) {
  let ctx: CanvasRenderingContext2D | null = null;
  try { ctx = canvas.getContext("2d"); } catch { /* ignore */ }
  const emptyEffects = () => ({ wide: 0, slow: 0, sticky: 0, laser: 0, jam: 0 });
  const game = {
    state: "menu" as GState, resumeState: "serving" as GState, started: false, level: 1, levelName: "First light",
    score: 0, lives: 3, bricks: [] as Brick[], remaining: 0, balls: [] as Ball[],
    drops: [] as any[], bullets: [] as any[], hazards: [] as any[], particles: [] as any[], floats: [] as any[],
    boss: null as Boss | null, effects: emptyEffects(), shield: 0, combo: 0, comboTimer: 0, clock: 0, levelTime: 0,
    baseSpeed: 350, laserCooldown: 0, autoLaser: 0, shakeTime: 0, shakeStrength: 0, clearBonus: 0,
    paddle: { x: W / 2, target: W / 2, y: 604, w: DIFF.width, h: 14, velocity: 0, flash: 0 },
  };
  const input = { keys: new Set<string>(), pointerId: null as number | null, downX: 0, downY: 0, dragged: false };
  const view = { width: 960, height: 650, scale: 1, dpr: 1, offsetX: 0, offsetY: 0 };
  const previewBricks: Brick[] = buildLevel(1).map((b) => ({ ...b, type: "standard", hp: 1, maxHp: 1 }));
  let destroyed = false, visible = true, raf = 0;

  const addScore = (points: number) => { game.score = Math.floor(clamp(game.score + Math.max(0, points), 0, MAX_SCORE)); };
  const multiplier = () => 1 + Math.min(4, Math.floor(game.combo / 5));
  function shake(strength = 3, duration = .15) {
    game.shakeStrength = Math.max(game.shakeStrength, strength); game.shakeTime = Math.max(game.shakeTime, duration);
  }
  function burst(x: number, y: number, color: string, count = 10, strength = 1) {
    for (let i = 0; i < count && game.particles.length < 300; i++) {
      const angle = Math.random() * Math.PI * 2, speed = (40 + Math.random() * 150) * strength, life = .28 + Math.random() * .35;
      game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color, life, maxLife: life, size: 1.5 + Math.random() * 2.5, kind: "spark" });
    }
  }
  function ring(x: number, y: number, color: string) {
    if (game.particles.length >= 300) return;
    game.particles.push({ x, y, vx: 0, vy: 0, color, life: .35, maxLife: .35, size: 5, kind: "ring" });
  }
  function floating(x: number, y: number, text: string, color: string, size = 16) {
    if (game.floats.length >= 24) return;
    game.floats.push({ x, y, text, color, size, life: .85, maxLife: .85 });
  }
  function setState(s: GState) { game.state = s; pushHud(); }
  function pushHud() { hooks.onHud({ state: game.state, score: game.score, level: game.level, lives: game.lives }); }

  function basePaddleWidth() { return DIFF.width; }
  function currentBallSpeed() { return game.baseSpeed * (game.effects.slow > 0 ? .7 : 1); }
  function ballRadius() { return clamp(2.8 / Math.max(.2, view.scale), 7, 10); }
  function normalizeBall(ball: Ball) {
    if (ball.attached) return;
    const speed = currentBallSpeed();
    if (!Number.isFinite(ball.vx) || !Number.isFinite(ball.vy) || Math.hypot(ball.vx, ball.vy) < .01) { ball.vx = .3; ball.vy = -.954; }
    const length = Math.hypot(ball.vx, ball.vy); ball.vx = ball.vx / length * speed; ball.vy = ball.vy / length * speed;
    if (Math.abs(ball.vy) < speed * .28) { ball.vy = (ball.vy < 0 ? -1 : 1) * speed * .28; ball.vx = (ball.vx < 0 ? -1 : 1) * Math.sqrt(speed * speed - ball.vy * ball.vy); }
    if (Math.abs(ball.vx) < speed * .075) { ball.vx = (ball.vx < 0 ? -1 : 1) * speed * .075; ball.vy = (ball.vy < 0 ? -1 : 1) * Math.sqrt(speed * speed - ball.vx * ball.vx); }
  }
  function newBall(attached = true, offset = 0): Ball {
    const p = game.paddle, r = ballRadius();
    return { x: p.x + offset * (p.w / 2 - 12), y: p.y - r - 2, r, vx: 0, vy: 0, attached, offset, trail: [], trailClock: 0, hits: new Map(), bossHit: -1 };
  }
  function startRun() {
    game.started = true; game.score = 0; game.lives = 3;
    input.keys.clear(); beginLevel(1, true);
  }
  function beginLevel(level: number, initial = false) {
    game.level = Math.min(999999, level); game.levelName = levelDefinition(game.level).name;
    game.bricks = buildLevel(game.level); game.remaining = game.bricks.filter((b) => b.type !== "steel").length;
    game.balls = []; game.drops = []; game.bullets = []; game.hazards = []; game.particles = []; game.floats = []; game.effects = emptyEffects();
    game.shield = 0; game.combo = 0; game.comboTimer = 0; game.levelTime = 0; game.clock = 0; game.laserCooldown = 0; game.autoLaser = 0; game.shakeTime = 0;
    // Ball speed FIXED Normal: baseSpeed 350 + level ke sath +4.6 (koi slider nahi)
    game.baseSpeed = clamp((350 + Math.min(game.level - 1, 65) * 4.6) * DIFF.speed, 270, 700);
    Object.assign(game.paddle, { x: W / 2, target: W / 2, w: basePaddleWidth(), velocity: 0, flash: 0 });
    game.balls.push(newBall()); game.boss = null;
    if (game.level % 5 === 0) {
      const hp = Math.round((14 + Math.min(12, Math.floor(game.level / 5)) * 3) * DIFF.boss);
      game.boss = { x: W / 2 - 78, y: 82, w: 156, h: 38, hp, maxHp: hp, flash: 0, attackTimer: 3.7, name: game.level <= 30 ? game.levelName : "The Afterglow Warden" };
    }
    setState(game.boss ? "bossIntro" : "serving");
    void initial;
  }
  function launchBalls() {
    if (!["playing", "serving"].includes(game.state)) return;
    let launched = 0;
    for (const b of game.balls) if (b.attached) {
      b.x = game.paddle.x + b.offset * (game.paddle.w / 2 - 12); b.y = game.paddle.y - b.r - 2;
      b.attached = false; const angle = b.offset * .85 + (b.offset === 0 ? .24 : 0); b.vx = Math.sin(angle); b.vy = -Math.cos(angle); normalizeBall(b); launched++;
    }
    if (launched) setState("playing");
  }
  function loseLife() {
    game.lives = Math.max(0, game.lives - 1); game.combo = 0; game.comboTimer = 0; game.drops = []; game.bullets = []; game.hazards = [];
    game.effects = emptyEffects(); game.shield = 0; game.paddle.w = basePaddleWidth(); game.paddle.target = game.paddle.x;
    shake(4, .22);
    if (game.lives <= 0) {
      game.balls = []; setState("gameOver"); hooks.onGameOver(game.score);
    } else {
      game.balls = [newBall()]; setState("serving");
    }
  }
  function finishLevel() {
    if (!["playing", "serving"].includes(game.state)) return;
    game.clearBonus = 750 + game.level * 100 + game.lives * 150; addScore(game.clearBonus);
    game.bullets = []; game.hazards = []; game.drops = []; game.combo = 0; game.comboTimer = 0;
    burst(W / 2, H * .45, THEME.accent, 45, 1.4); setState("levelClear"); hooks.onLevelClear(game.score);
  }
  function spawnDrop(x: number, y: number, forced: string | null = null) {
    if (game.drops.length >= 6) return;
    const choices = ["wide", "multi", "slow", "sticky", "laser", "life", "shield", "bonus", "wide", "multi", "slow", "shield"];
    const key = forced || choices[Math.floor(Math.random() * choices.length)];
    game.drops.push({ x, y, originX: x, key, phase: Math.random() * 6.28, age: 0, w: clamp(22 / view.scale, 38, 66), h: clamp(15 / view.scale, 26, 40) });
  }
  function damageBrick(initial: Brick, damage = 1) {
    if (!initial || !initial.alive) return;
    if (initial.type === "steel") { initial.flash = .10; return; }
    const queue: { brick: Brick; damage: number }[] = [{ brick: initial, damage }], queued = new Set([initial.id]);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const { brick, damage: power } = queue[cursor];
      if (!brick.alive || brick.type === "steel") continue;
      brick.hp -= power; brick.flash = .13;
      if (brick.hp > 0) { addScore(15); burst(brick.x + brick.w / 2, brick.y + brick.h / 2, THEME.secondary, 3, .55); continue; }
      brick.alive = false; game.remaining = Math.max(0, game.remaining - 1);
      game.combo = game.comboTimer > 0 ? Math.min(1000, game.combo + 1) : 1; game.comboTimer = 3.8;
      const base: Record<string, number> = { standard: 100, armor: 160 + (brick.maxHp - 2) * 35, explosive: 140, bonus: 300 };
      const points = (base[brick.type] || 100) * multiplier(), color = THEME.bricks[brick.colorIndex], x = brick.x + brick.w / 2, y = brick.y + brick.h / 2;
      addScore(points); burst(x, y, color, 10); floating(x, y, "+" + points, color);
      if (brick.type === "bonus") spawnDrop(x, y, Math.random() < .5 ? "bonus" : null);
      else if (Math.random() < Math.max(.11, DIFF.drop - Math.max(0, game.level - 15) * .001)) spawnDrop(x, y);
      if (brick.type === "explosive") {
        ring(x, y, THEME.warm); burst(x, y, THEME.warm, 18, 1.3); shake(2.5, .13);
        for (const neighbor of game.bricks) if (neighbor.alive && neighbor.type !== "steel" && !queued.has(neighbor.id) && Math.hypot(neighbor.x + neighbor.w / 2 - x, neighbor.y + neighbor.h / 2 - y) < 108) { queued.add(neighbor.id); queue.push({ brick: neighbor, damage: 2 }); }
      }
    }
  }
  function damageBoss(damage = 1) {
    const boss = game.boss;
    if (!boss || boss.hp <= 0) return;
    boss.hp = Math.max(0, boss.hp - damage); boss.flash = .16; addScore(Math.round(75 * damage));
    burst(boss.x + boss.w / 2, boss.y + boss.h / 2, THEME.danger, 5, .65);
    if (boss.hp > 0) return;
    const x = boss.x + boss.w / 2, y = boss.y + boss.h / 2, bonus = 1500 + game.level * 50;
    game.boss = null; game.hazards = [];
    addScore(bonus); burst(x, y, THEME.danger, 45, 1.5); ring(x, y, THEME.accent); floating(x, y, "WARDEN DOWN +" + bonus, THEME.accent, 22);
    shake(5, .25);
  }
  function collectPower(key: string, x: number, y: number) {
    const power = POWERS[key]; if (!power) return;
    addScore(50); burst(x, y, THEME[power.tone], 14, .8);
    if (power.duration) {
      game.effects[key as keyof typeof game.effects] = power.duration;
      if (key === "slow") for (const ball of game.balls) normalizeBall(ball);
      if (key === "laser") game.autoLaser = 0;
    } else if (key === "multi") {
      if (!game.balls.length) game.balls.push(newBall());
      const seed = game.balls.find((b) => !b.attached) || game.balls[0];
      for (const sign of [-1, 1]) {
        if (game.balls.length >= MAX_BALLS) break;
        const ball = newBall(seed.attached, sign * .6);
        if (!seed.attached) { const angle = sign * .48; ball.x = seed.x; ball.y = seed.y; ball.vx = seed.vx * Math.cos(angle) - seed.vy * Math.sin(angle); ball.vy = seed.vx * Math.sin(angle) + seed.vy * Math.cos(angle); normalizeBall(ball); }
        game.balls.push(ball);
      }
    } else if (key === "life") {
      if (game.lives < 5) game.lives++; else addScore(250);
    } else if (key === "shield") game.shield = Math.min(3, game.shield + 1);
    else if (key === "bonus") addScore(600);
    floating(x, y - 18, power.name.toUpperCase(), THEME[power.tone], 14);
    pushHud();
  }
  function fireLaser() {
    if (game.state !== "playing" || game.effects.laser <= 0 || game.laserCooldown > 0 || game.bullets.length >= 30) return;
    const p = game.paddle;
    for (const sign of [-1, 1]) game.bullets.push({ x: p.x + sign * (p.w / 2 - 9), y: p.y - 7, w: 4, h: 17 });
    game.laserCooldown = .18; p.flash = .07;
  }

  function circleRect(ball: { x: number; y: number; r: number }, rect: { x: number; y: number; w: number; h: number }) {
    const x = clamp(ball.x, rect.x, rect.x + rect.w), y = clamp(ball.y, rect.y, rect.y + rect.h), dx = ball.x - x, dy = ball.y - y, distanceSq = dx * dx + dy * dy;
    if (distanceSq >= ball.r * ball.r) return null;
    if (distanceSq > .000001) { const d = Math.sqrt(distanceSq); return { nx: dx / d, ny: dy / d, depth: ball.r - d }; }
    const faces = [{ d: ball.x - rect.x, nx: -1, ny: 0 }, { d: rect.x + rect.w - ball.x, nx: 1, ny: 0 }, { d: ball.y - rect.y, nx: 0, ny: -1 }, { d: rect.y + rect.h - ball.y, nx: 0, ny: 1 }];
    faces.sort((a, b) => a.d - b.d); return { nx: faces[0].nx, ny: faces[0].ny, depth: ball.r + faces[0].d };
  }
  function reflect(ball: Ball, contact: { nx: number; ny: number; depth: number }) {
    ball.x += contact.nx * (contact.depth + .08); ball.y += contact.ny * (contact.depth + .08);
    const dot = ball.vx * contact.nx + ball.vy * contact.ny;
    if (dot < 0) { ball.vx -= 2 * dot * contact.nx; ball.vy -= 2 * dot * contact.ny; normalizeBall(ball); }
    return dot < 0;
  }
  function updatePaddle(dt: number) {
    const p = game.paddle, oldX = p.x;
    const targetWidth = basePaddleWidth() * (game.effects.wide > 0 ? 1.5 : 1) * (game.effects.jam > 0 ? .78 : 1);
    p.w += (targetWidth - p.w) * Math.min(1, dt * 16);
    const left = input.keys.has("ArrowLeft") || input.keys.has("KeyA"), right = input.keys.has("ArrowRight") || input.keys.has("KeyD");
    if (left || right) { p.x += ((right ? 1 : 0) - (left ? 1 : 0)) * 800 * dt; p.target = p.x; }
    else p.x += (p.target - p.x) * Math.min(1, dt * 30);
    p.x = clamp(p.x, WALL + p.w / 2, W - WALL - p.w / 2); p.target = clamp(p.target, WALL + p.w / 2, W - WALL - p.w / 2);
    p.velocity = clamp((p.x - oldX) / dt, -1100, 1100); p.flash = Math.max(0, p.flash - dt);
  }
  function bouncePaddle(ball: Ball) {
    const p = game.paddle, offset = clamp((ball.x - p.x) / (p.w / 2), -.98, .98);
    ball.y = p.y - ball.r - .3; p.flash = .14; burst(ball.x, p.y, THEME.accent, 4, .45);
    if (game.effects.sticky > 0) {
      ball.attached = true; ball.offset = clamp(offset, -.85, .85); ball.vx = 0; ball.vy = 0; ball.trail = [];
      return;
    }
    const angle = offset * 1.09; ball.vx = Math.sin(angle) + p.velocity * .00013; ball.vy = -Math.max(.45, Math.cos(angle)); normalizeBall(ball);
  }
  function updateBall(ball: Ball, dt: number): boolean {
    const p = game.paddle;
    if (ball.attached) { ball.x = p.x + ball.offset * (p.w / 2 - 12); ball.y = p.y - ball.r - 2; return false; }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    let wallHit = false;
    if (ball.x - ball.r < WALL) { ball.x = WALL + ball.r; ball.vx = Math.abs(ball.vx); wallHit = true; }
    if (ball.x + ball.r > W - WALL) { ball.x = W - WALL - ball.r; ball.vx = -Math.abs(ball.vx); wallHit = true; }
    if (ball.y - ball.r < WALL) { ball.y = WALL + ball.r; ball.vy = Math.abs(ball.vy); wallHit = true; }
    if (wallHit) normalizeBall(ball);
    const paddleContact = circleRect(ball, { x: p.x - p.w / 2, y: p.y, w: p.w, h: p.h });
    if (paddleContact && ball.vy > 0) {
      if (ball.y <= p.y + 3) bouncePaddle(ball); else reflect(ball, paddleContact);
    }
    if (ball.attached) return false;
    const boss = game.boss;
    if (boss) {
      const contact = circleRect(ball, boss);
      if (contact) { const approaching = reflect(ball, contact); if (approaching && game.clock - ball.bossHit > .12) { ball.bossHit = game.clock; damageBoss(1); } }
    }
    for (const brick of game.bricks) {
      if (!brick.alive) continue;
      const contact = circleRect(ball, brick); if (!contact) continue;
      const approaching = reflect(ball, contact), lastHit = ball.hits.get(brick.id) ?? -1;
      if (approaching && game.clock - lastHit > .10) { ball.hits.set(brick.id, game.clock); damageBrick(brick); }
      break;
    }
    if (game.shield > 0 && ball.vy > 0 && ball.y + ball.r >= H - 22) {
      game.shield--; ball.y = H - 22 - ball.r; ball.vy = -Math.abs(ball.vy); normalizeBall(ball); ring(ball.x, H - 22, THEME.teal); burst(ball.x, H - 22, THEME.teal, 16);
    }
    ball.trailClock += dt;
    if (ball.trailClock > .018) { ball.trail.push({ x: ball.x, y: ball.y }); if (ball.trail.length > 9) ball.trail.shift(); ball.trailClock = 0; }
    return ball.y - ball.r > H + 12;
  }
  function updateBoss(dt: number) {
    const boss = game.boss; if (!boss) return;
    boss.x = W / 2 - boss.w / 2 + Math.sin(game.levelTime * .65) * Math.min(275, 155 + game.level * 2);
    boss.y = 80 + Math.sin(game.levelTime * 1.07) * 11; boss.flash = Math.max(0, boss.flash - dt); boss.attackTimer -= dt;
    if (boss.attackTimer <= 0) {
      boss.attackTimer = Math.max(2.35, 4.5 - game.level * .035) / DIFF.boss;
      for (const sign of [-1, 0, 1]) if (game.hazards.length < 12) game.hazards.push({ x: boss.x + boss.w / 2 + sign * 40, y: boss.y + boss.h + 9, vx: sign * 22, vy: Math.min(180, 125 + game.level), r: 8 });
      boss.flash = .11;
    }
  }
  function rectOverlap(a: any, b: any) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function updateBullets(dt: number) {
    for (let i = game.bullets.length - 1; i >= 0; i--) {
      const beam = game.bullets[i]; beam.y -= 820 * dt; let hit = beam.y + beam.h < 0;
      const box = { x: beam.x - beam.w / 2, y: beam.y, w: beam.w, h: beam.h };
      if (!hit && game.boss && rectOverlap(box, game.boss)) { damageBoss(.5); hit = true; }
      if (!hit) for (const brick of game.bricks) if (brick.alive && rectOverlap(box, brick)) { damageBrick(brick); hit = true; break; }
      if (!hit) for (let j = game.hazards.length - 1; j >= 0; j--) {
        const pulse = game.hazards[j];
        if (circleRect(pulse, box)) { burst(pulse.x, pulse.y, THEME.warm, 6); game.hazards.splice(j, 1); addScore(20); hit = true; break; }
      }
      if (hit) game.bullets.splice(i, 1);
    }
  }
  function updateDrops(dt: number) {
    const p = game.paddle;
    for (let i = game.drops.length - 1; i >= 0; i--) {
      const drop = game.drops[i]; drop.y += 86 * dt; drop.age += dt; drop.x = drop.originX + Math.sin(drop.age * 2 + drop.phase) * 6;
      const overlaps = drop.y + drop.h / 2 >= p.y && drop.y - drop.h / 2 <= p.y + p.h && drop.x + drop.w / 2 >= p.x - p.w / 2 && drop.x - drop.w / 2 <= p.x + p.w / 2;
      if (overlaps) { game.drops.splice(i, 1); collectPower(drop.key, drop.x, drop.y); }
      else if (drop.y > H + 30) game.drops.splice(i, 1);
    }
  }
  function updateHazards(dt: number) {
    const p = game.paddle;
    for (let i = game.hazards.length - 1; i >= 0; i--) {
      const pulse = game.hazards[i]; pulse.x += pulse.vx * dt; pulse.y += pulse.vy * dt;
      if (circleRect(pulse, { x: p.x - p.w / 2, y: p.y, w: p.w, h: p.h })) {
        game.effects.jam = 3; p.flash = .2; shake(2, .12); burst(pulse.x, pulse.y, THEME.danger, 10); game.hazards.splice(i, 1);
      } else if (pulse.y > H + 20) game.hazards.splice(i, 1);
    }
  }
  function updateEffects(dt: number) {
    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i]; p.life -= dt;
      if (p.life <= 0) { game.particles.splice(i, 1); continue; }
      if (p.kind === "ring") p.size += 210 * dt; else { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 110 * dt; }
    }
    for (let i = game.floats.length - 1; i >= 0; i--) { const f = game.floats[i]; f.life -= dt; f.y -= 28 * dt; if (f.life <= 0) game.floats.splice(i, 1); }
    game.shakeTime = Math.max(0, game.shakeTime - dt); if (!game.shakeTime) game.shakeStrength = 0;
  }
  function update(dt: number) {
    if (!game.started || game.state === "paused") return;
    updateEffects(dt);
    if (!["playing", "serving"].includes(game.state)) return;
    game.clock += dt;
    const simDt = dt * DIFF.speed;
    for (const key of Object.keys(game.effects) as (keyof typeof game.effects)[]) {
      const before = game.effects[key]; game.effects[key] = Math.max(0, before - dt);
      if (key === "slow" && before > 0 && game.effects[key] === 0) for (const b of game.balls) normalizeBall(b);
    }
    if (game.comboTimer > 0) { game.comboTimer = Math.max(0, game.comboTimer - dt); if (!game.comboTimer) game.combo = 0; }
    game.laserCooldown = Math.max(0, game.laserCooldown - dt);
    for (const brick of game.bricks) if (brick.flash > 0) brick.flash = Math.max(0, brick.flash - dt);
    updatePaddle(dt); updateDrops(simDt);
    if (game.state === "playing") {
      game.levelTime += simDt; updateBoss(simDt); updateHazards(simDt);
      if (game.effects.laser > 0) { game.autoLaser -= dt; if (game.autoLaser <= 0) { fireLaser(); game.autoLaser = .58; } }
      updateBullets(simDt);
    }
    for (let i = game.balls.length - 1; i >= 0; i--) if (updateBall(game.balls[i], simDt)) game.balls.splice(i, 1);
    if (!game.remaining && !game.boss) { finishLevel(); return; }
    if (!game.balls.length && game.state === "playing") { loseLife(); return; }
    if (game.state === "playing" && game.balls.length && game.balls.every((b) => b.attached)) setState("serving");
  }

  /* ───────── drawing (source ki canvas rendering, neon theme fixed) ───────── */
  function roundedPath(x: number, y: number, w: number, h: number, r = 4) {
    if (!ctx) return;
    r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function fillRounded(x: number, y: number, w: number, h: number, r: number, color: string) {
    if (!ctx || w <= 0 || h <= 0) return; roundedPath(x, y, w, h, r); ctx.fillStyle = color; ctx.fill();
  }
  function drawBackground() {
    if (!ctx) return;
    const extraX = view.offsetX / view.scale, extraY = view.offsetY / view.scale;
    ctx.fillStyle = THEME.board; ctx.fillRect(-extraX, -extraY, W + extraX * 2, H + extraY * 2);
    const glow = ctx.createRadialGradient(W / 2, H * .6, 0, W / 2, H * .6, W * .65); glow.addColorStop(0, THEME.secondary + "06"); glow.addColorStop(1, THEME.board + "00"); ctx.fillStyle = glow; ctx.fillRect(-extraX, -extraY, W + extraX * 2, H + extraY * 2);
    ctx.strokeStyle = THEME.grid; ctx.lineWidth = .6; ctx.globalAlpha = .47; ctx.beginPath();
    for (let x = Math.floor(-extraX / 40) * 40; x < W + extraX; x += 40) { ctx.moveTo(x, -extraY); ctx.lineTo(x, H + extraY); }
    for (let y = Math.floor(-extraY / 40) * 40; y < H + extraY; y += 40) { ctx.moveTo(-extraX, y); ctx.lineTo(W + extraX, y); }
    ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = THEME.secondary + "22";
    for (let x = 80; x < W; x += 160) for (let y = 60; y < H; y += 120) ctx.fillRect(x - .8, y - .8, 1.6, 1.6);
    ctx.strokeStyle = THEME.secondary + "36"; ctx.lineWidth = 1; ctx.beginPath();
    for (const x of [WALL, W - WALL]) { const sign = x === WALL ? 1 : -1; ctx.moveTo(x + sign * 10, 22); ctx.lineTo(x, 22); ctx.lineTo(x, 32); ctx.moveTo(x, H - 37); ctx.lineTo(x, H - 27); ctx.lineTo(x + sign * 10, H - 27); }
    ctx.stroke();
    ctx.strokeStyle = THEME.grid; ctx.beginPath(); ctx.moveTo(WALL, H - 22); ctx.lineTo(W - WALL, H - 22); ctx.stroke();
  }
  function drawBrick(brick: Brick, preview = false, time = 0) {
    if (!ctx || !brick.alive) return;
    const { x, y, w, h, type } = brick, color = type === "steel" ? THEME.steel : type === "explosive" ? THEME.warm : type === "bonus" ? THEME.teal : THEME.bricks[brick.colorIndex];
    ctx.save();
    if (preview) ctx.globalAlpha = .87 + Math.sin(time * .65 + brick.row * .5) * .055;
    fillRounded(x, y + 2, w, h, 4, "#00000030");
    const gradient = ctx.createLinearGradient(0, y, 0, y + h); gradient.addColorStop(0, color); gradient.addColorStop(1, color + "d9");
    roundedPath(x, y, w, h, 3); ctx.fillStyle = gradient; ctx.fill();
    ctx.strokeStyle = "#ffffff20"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 4, y + .6); ctx.lineTo(x + w - 4, y + .6); ctx.stroke();
    fillRounded(x + 1, y + h - 4, w - 2, 3, 1, "#0000000d");
    ctx.strokeStyle = THEME.ink + "91"; ctx.fillStyle = THEME.ink; ctx.lineWidth = 1.4;
    const cx = x + w / 2, cy = y + h / 2;
    if (type === "steel") {
      ctx.save(); roundedPath(x, y, w, h, 3); ctx.clip(); ctx.strokeStyle = "#a6b7ce40"; ctx.lineWidth = 1;
      for (let a = x - 20; a < x + w + 20; a += 9) { ctx.beginPath(); ctx.moveTo(a, y + h); ctx.lineTo(a + 20, y); ctx.stroke(); } ctx.restore();
      ctx.strokeStyle = "#cbd5e166"; roundedPath(x + 2.5, y + 2.5, w - 5, h - 5, 2); ctx.stroke();
    } else if (type === "armor") {
      ctx.strokeStyle = "#ffffff65"; roundedPath(x + 2.5, y + 2.5, w - 5, h - 5, 2); ctx.stroke();
      ctx.fillStyle = THEME.ink + "bb";
      for (let i = 0; i < brick.maxHp; i++) { ctx.globalAlpha = i < brick.hp ? 1 : .2; fillRounded(cx - (brick.maxHp * 6 - 3) / 2 + i * 6, cy - 3, 3, 6, 1, THEME.ink + "aa"); } ctx.globalAlpha = preview ? ctx.globalAlpha : 1;
      if (brick.hp < brick.maxHp) { ctx.strokeStyle = THEME.ink + "42"; ctx.beginPath(); ctx.moveTo(x + 11, y); ctx.lineTo(x + 14, y + 7); ctx.lineTo(x + 10, y + 12); ctx.lineTo(x + 15, y + h); ctx.stroke(); }
    } else if (type === "explosive") {
      ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx + 6, cy); ctx.lineTo(cx, cy + 6); ctx.lineTo(cx - 6, cy); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - 3, cy); ctx.lineTo(cx + 3, cy); ctx.moveTo(cx, cy - 3); ctx.lineTo(cx, cy + 3); ctx.stroke();
    } else if (type === "bonus") {
      ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx + 2, cy - 2); ctx.lineTo(cx + 6, cy); ctx.lineTo(cx + 2, cy + 2); ctx.lineTo(cx, cy + 6); ctx.lineTo(cx - 2, cy + 2); ctx.lineTo(cx - 6, cy); ctx.lineTo(cx - 2, cy - 2); ctx.closePath(); ctx.fill();
    }
    if (brick.flash > 0) { ctx.globalAlpha = Math.min(.7, brick.flash * 4); fillRounded(x, y, w, h, 3, "#ffffff"); }
    ctx.restore();
  }
  function drawPaddle(p: typeof game.paddle) {
    if (!ctx) return;
    ctx.save();
    const color = game.started && game.effects.jam > 0 ? THEME.danger : game.started && game.effects.sticky > 0 ? THEME.secondary : THEME.accent;
    ctx.shadowColor = color + "70"; ctx.shadowBlur = 18;
    const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h); g.addColorStop(0, "#f5ffe7"); g.addColorStop(.18, color); g.addColorStop(1, color + "aa");
    roundedPath(p.x - p.w / 2, p.y, p.w, p.h, 7); ctx.fillStyle = p.flash > 0 ? "#ffffff" : g; ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffff70"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x - p.w / 2 + 9, p.y + .5); ctx.lineTo(p.x + p.w / 2 - 9, p.y + .5); ctx.stroke();
    fillRounded(p.x - p.w / 2 + 4, p.y + 4, 3, p.h - 8, 1, THEME.ink + "60"); fillRounded(p.x + p.w / 2 - 7, p.y + 4, 3, p.h - 8, 1, THEME.ink + "60");
    for (let i = -1; i <= 1; i++) fillRounded(p.x + i * 5 - 1, p.y + 5, 2, 4, 1, THEME.ink + "60");
    if (game.started && game.effects.laser > 0) for (const sign of [-1, 1]) { fillRounded(p.x + sign * (p.w / 2 - 9) - 3, p.y - 5, 6, 8, 2, THEME.warm); fillRounded(p.x + sign * (p.w / 2 - 9) - 1, p.y - 8, 2, 5, 1, "#fff3df"); }
    if (game.started && game.effects.sticky > 0) { ctx.strokeStyle = THEME.secondary; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(p.x - p.w / 2 + 10, p.y - 4); ctx.lineTo(p.x + p.w / 2 - 10, p.y - 4); ctx.stroke(); }
    ctx.restore();
  }
  function drawBall(ball: Ball) {
    if (!ctx) return;
    const color = game.effects.slow > 0 && game.started ? THEME.teal : THEME.accent;
    ctx.save();
    for (let i = 0; i < ball.trail.length; i++) {
      const trail = ball.trail[i], fraction = (i + 1) / ball.trail.length; ctx.globalAlpha = fraction * .17; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(trail.x, trail.y, ball.r * (.35 + fraction * .5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.fillStyle = "#f8fff1";
    ctx.shadowColor = color; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(ball.x - ball.r * .2, ball.y - ball.r * .25, ball.r * .4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function drawBoss(boss: Boss) {
    if (!ctx) return;
    ctx.save(); const { x, y, w, h } = boss, color = boss.flash > 0 ? "#fff1f7" : THEME.danger;
    ctx.shadowColor = THEME.danger + "55"; ctx.shadowBlur = 17;
    ctx.fillStyle = THEME.danger + "27"; ctx.strokeStyle = color; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(x, y + h * .55); ctx.lineTo(x + 23, y + 3); ctx.lineTo(x + w * .36, y + 8); ctx.lineTo(x + w * .5, y); ctx.lineTo(x + w * .64, y + 8); ctx.lineTo(x + w - 23, y + 3); ctx.lineTo(x + w, y + h * .55); ctx.lineTo(x + w - 25, y + h); ctx.lineTo(x + w * .65, y + h - 7); ctx.lineTo(x + w * .5, y + h); ctx.lineTo(x + w * .35, y + h - 7); ctx.lineTo(x + 25, y + h); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = boss.flash > 0 ? "#ffffff" : color; ctx.beginPath(); ctx.moveTo(x + w / 2, y + 8); ctx.lineTo(x + w / 2 + 10, y + h / 2); ctx.lineTo(x + w / 2, y + h - 8); ctx.lineTo(x + w / 2 - 10, y + h / 2); ctx.closePath(); ctx.fill();
    for (const sign of [-1, 1]) { const cx = x + w / 2 + sign * 43; ctx.strokeStyle = color + "a0"; ctx.beginPath(); ctx.moveTo(cx - sign * 8, y + 13); ctx.lineTo(cx + sign * 8, y + 13); ctx.lineTo(cx + sign * 13, y + 22); ctx.lineTo(cx - sign * 8, y + 22); ctx.stroke(); }
    ctx.restore();
    // Boss health — canvas ke andar chhoti bar (DOM meter ki jagah)
    const bw = 230, bx = W / 2 - bw / 2, by = 30;
    ctx.save();
    ctx.fillStyle = "#ffffff"; ctx.font = "600 11px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ctx.fillText("THE WARDEN " + Math.ceil(boss.hp) + " / " + boss.maxHp, W / 2, by - 3);
    fillRounded(bx, by, bw, 5, 2, "#ffffff22");
    fillRounded(bx, by, bw * clamp(boss.hp / boss.maxHp, 0, 1), 5, 2, THEME.danger);
    ctx.restore();
  }
  function drawDrop(drop: any) {
    if (!ctx) return;
    const power = POWERS[drop.key]; if (!power) return;
    const color = THEME[power.tone];
    ctx.save();
    ctx.shadowBlur = 12; ctx.shadowColor = color + "60";
    fillRounded(drop.x - drop.w / 2, drop.y - drop.h / 2, drop.w, drop.h, 7, THEME.board);
    fillRounded(drop.x - drop.w / 2, drop.y - drop.h / 2, drop.w, drop.h, 7, color + "22");
    roundedPath(drop.x - drop.w / 2, drop.y - drop.h / 2, drop.w, drop.h, 7); ctx.strokeStyle = color + "cc"; ctx.lineWidth = 1.4; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = color; ctx.font = "bold " + clamp(9 / view.scale, 14, 25) + "px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(power.symbol, drop.x, drop.y + 1);
    ctx.restore();
  }
  function drawEffects() {
    if (!ctx) return;
    ctx.save();
    for (const p of game.particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1); ctx.fillStyle = p.color;
      if (p.kind === "ring") { ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke(); }
      else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const f of game.floats) { ctx.globalAlpha = clamp(f.life * 2, 0, 1); ctx.fillStyle = f.color; ctx.font = "600 " + f.size + "px monospace"; ctx.fillText(f.text, f.x, f.y); }
    ctx.restore();
  }
  function draw(time: number) {
    if (!ctx) return;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0); ctx.clearRect(0, 0, view.width, view.height); ctx.fillStyle = THEME.board; ctx.fillRect(0, 0, view.width, view.height);
    ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, view.dpr * view.offsetX, view.dpr * view.offsetY);
    drawBackground(); ctx.save();
    if (game.shakeTime > 0 && game.state !== "menu") { const amplitude = game.shakeStrength * Math.min(1, game.shakeTime * 6); ctx.translate((Math.random() - .5) * amplitude, (Math.random() - .5) * amplitude); }
    if (game.state === "menu") {
      for (const brick of previewBricks) drawBrick(brick, true, time);
      const px = W / 2 + Math.sin(time * .5) * 32;
      drawPaddle({ x: px, target: px, y: 604, w: 124, h: 14, velocity: 0, flash: 0 });
      const bx = W * .73 + Math.sin(time * .6) * 19, by = H * .72 + Math.sin(time * .43) * 15, trail: { x: number; y: number }[] = [];
      for (let i = 8; i > 0; i--) trail.push({ x: bx + i * 5, y: by - i * 8 });
      drawBall({ x: bx, y: by, r: 7, vx: 0, vy: 0, attached: false, offset: 0, trail, trailClock: 0, hits: new Map(), bossHit: -1 });
    } else {
      for (const brick of game.bricks) drawBrick(brick);
      if (game.boss) drawBoss(game.boss);
      if (game.shield > 0) {
        ctx.save(); ctx.strokeStyle = THEME.teal; ctx.lineWidth = 2; ctx.shadowColor = THEME.teal; ctx.shadowBlur = 12; ctx.beginPath(); ctx.moveTo(WALL, H - 22); ctx.lineTo(W - WALL, H - 22); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = THEME.teal + "12"; ctx.fillRect(WALL, H - 21, W - WALL * 2, 12); ctx.restore();
      }
      for (const beam of game.bullets) { ctx.save(); ctx.shadowColor = THEME.warm; ctx.shadowBlur = 10; fillRounded(beam.x - beam.w / 2, beam.y, beam.w, beam.h, 2, THEME.warm); ctx.restore(); }
      for (const pulse of game.hazards) {
        ctx.save(); ctx.fillStyle = THEME.danger + "33"; ctx.strokeStyle = THEME.danger; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(pulse.x - pulse.r, pulse.y - pulse.r); ctx.lineTo(pulse.x + pulse.r, pulse.y - pulse.r); ctx.lineTo(pulse.x, pulse.y + pulse.r); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = THEME.danger; ctx.fillRect(pulse.x - 1, pulse.y - pulse.r - 8, 2, 4); ctx.restore();
      }
      for (const drop of game.drops) drawDrop(drop);
      drawPaddle(game.paddle); for (const ball of game.balls) drawBall(ball); drawEffects();
    }
    ctx.restore();
  }

  /* ───────── input + loop ───────── */
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    view.width = rect.width; view.height = rect.height; view.dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    view.scale = Math.min(rect.width / W, rect.height / H); view.offsetX = (rect.width - W * view.scale) / 2; view.offsetY = (rect.height - H * view.scale) / 2;
    canvas.width = Math.round(rect.width * view.dpr); canvas.height = Math.round(rect.height * view.dpr);
    for (const ball of game.balls) ball.r = ballRadius();
    for (const drop of game.drops) { drop.w = clamp(22 / view.scale, 38, 66); drop.h = clamp(15 / view.scale, 26, 40); }
  }
  function pointerX(event: PointerEvent) { return clamp((event.clientX - canvas.getBoundingClientRect().left - view.offsetX) / view.scale, WALL, W - WALL); }
  function pauseGame() {
    if (!["playing", "serving", "bossIntro"].includes(game.state)) return;
    game.resumeState = game.state; input.keys.clear(); setState("paused");
  }
  function resumeGame() {
    if (game.state !== "paused" || document.hidden) return;
    setState(game.resumeState);
  }
  function mainAction() {
    if (game.state === "menu" || game.state === "gameOver") startRun();
    else if (game.state === "paused") resumeGame();
    else if (game.state === "levelClear") beginLevel(game.level + 1);
    else if (game.state === "bossIntro") setState("serving");
    else if (game.balls.some((b) => b.attached)) launchBalls();
    else if (game.state === "playing") pauseGame();
  }
  const onPointerDown = (event: PointerEvent) => {
    if (!["playing", "serving"].includes(game.state) || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault(); canvas.focus({ preventScroll: true }); input.pointerId = event.pointerId; input.downX = event.clientX; input.downY = event.clientY; input.dragged = false;
    game.paddle.target = pointerX(event);
    try { canvas.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    if (event.pointerType === "mouse") { game.paddle.x = clamp(game.paddle.target, WALL + game.paddle.w / 2, W - WALL - game.paddle.w / 2); if (game.balls.some((b) => b.attached)) launchBalls(); }
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!["playing", "serving"].includes(game.state)) return;
    if (event.pointerType !== "mouse" && input.pointerId !== event.pointerId) return;
    game.paddle.target = pointerX(event);
    if (input.pointerId === event.pointerId && Math.hypot(event.clientX - input.downX, event.clientY - input.downY) > 7) input.dragged = true;
  };
  const onPointerUp = (event: PointerEvent) => {
    if (input.pointerId !== event.pointerId) return;
    if (event.pointerType !== "mouse" && !input.dragged && game.balls.some((b) => b.attached)) { game.paddle.x = clamp(game.paddle.target, WALL + game.paddle.w / 2, W - WALL - game.paddle.w / 2); launchBalls(); }
    try { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch { /* ignore */ }
    input.pointerId = null;
  };
  const onPointerCancel = () => { input.pointerId = null; input.dragged = false; };
  const onContextMenu = (event: Event) => { if (["playing", "serving"].includes(game.state)) event.preventDefault(); };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const code = event.code;
    if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(code) && ["playing", "serving"].includes(game.state)) { event.preventDefault(); input.keys.add(code); }
    if (code === "Space") { event.preventDefault(); if (!event.repeat) mainAction(); }
    else if (code === "Escape" && !event.repeat) { if (game.state === "paused") resumeGame(); else if (["playing", "serving", "bossIntro"].includes(game.state)) { event.preventDefault(); pauseGame(); } }
    else if (code === "KeyR" && game.started && !event.repeat) { event.preventDefault(); startRun(); }
    else if (code === "KeyZ" && game.state === "playing") { event.preventDefault(); fireLaser(); }
  };
  const onKeyUp = (event: KeyboardEvent) => { input.keys.delete(event.code); };
  const onVisibility = () => { if (document.hidden) { input.keys.clear(); pauseGame(); } };
  const onResize = () => resizeCanvas();

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("keyup", onKeyUp);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("resize", onResize);
  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver === "function") { observer = new ResizeObserver(resizeCanvas); observer.observe(canvas); }
  let io: IntersectionObserver | null = null;
  if (typeof IntersectionObserver === "function") { io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); }, { threshold: 0.02 }); io.observe(canvas); }
  resizeCanvas();
  pushHud();

  let last = performance.now(), accumulator = 0, lastHUD = 0;
  function frame(now: number) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const dt = clamp((now - last) / 1000, 0, .05); last = now;
    if (document.hidden || !visible) { accumulator = 0; return; }
    accumulator += dt; let steps = 0;
    while (accumulator >= STEP && steps < 8) { update(STEP); accumulator -= STEP; steps++; }
    if (steps === 8) accumulator = 0;
    draw(now / 1000);
    if (now - lastHUD > 90) { pushHud(); lastHUD = now; }
  }
  raf = requestAnimationFrame(frame);

  return {
    mainAction,
    togglePause() { if (game.state === "paused") resumeGame(); else pauseGame(); },
    restart() { if (game.started) startRun(); },
    get started() { return game.started; },
    destroy() {
      destroyed = true; cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      observer?.disconnect(); io?.disconnect();
    },
  };
}
type BrickEngine = ReturnType<typeof createBrickEngine>;

/* ───────────────── React card — sirf header, canvas, patli HUD line, top scores ───────────────── */
export default function BrickMessage({ m }: { m: Message }) {
  const st = parseBrick(m.caption);
  const me = useStore((s) => s.me);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engRef = useRef<BrickEngine | null>(null);
  const [hud, setHud] = useState<HudSnap>({ state: "menu", score: 0, level: 1, lives: 3 });
  // Score submit handlers hamesha latest payload dekhen — ref pattern
  const latestRef = useRef({ id: m.id, me, best: 0 });
  latestRef.current = { id: m.id, me, best: st?.scores?.[me]?.best || 0 };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const eng = createBrickEngine(canvas, {
      onHud: (h) => setHud((prev) => (prev.state === h.state && prev.score === h.score && prev.level === h.level && prev.lives === h.lives ? prev : h)),
      onGameOver: (score) => { submitBrickScore(latestRef.current.id, score, true).catch(() => {}); },
      onLevelClear: (score) => { if (score > latestRef.current.best) submitBrickScore(latestRef.current.id, score, false).catch(() => {}); },
    });
    engRef.current = eng;
    return () => { eng.destroy(); engRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.id]);

  if (!st) return <p className="text-sm italic text-[#80848e]">Game load nahi hua</p>;

  const myBest = st.scores[me]?.best || 0;
  const top = Object.entries(st.scores).filter(([, e]) => e.best > 0).sort((a, b) => b[1].best - a[1].best).slice(0, 5);
  const inGame = hud.state === "playing" || hud.state === "serving";
  const act = (fn?: () => void) => { fn?.(); canvasRef.current?.focus({ preventScroll: true }); };

  return (
    <div className="mt-1.5 w-full max-w-[540px] rounded-xl border border-black/10 bg-white p-3.5 soft-shadow">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#5865f2]">
        🧱 Brick Breaker
        {myBest > 0 && (
          <span className="ml-auto rounded-full bg-[#f5a623]/10 px-2 py-0.5 text-[10px] font-extrabold normal-case tracking-normal text-[#b97e10]">
            🏆 Mera best {myBest.toLocaleString()}
          </span>
        )}
      </p>

      <div className="relative overflow-hidden rounded-lg" style={{ background: "#111219" }}>
        <canvas
          ref={canvasRef}
          width={960}
          height={650}
          tabIndex={0}
          aria-label="Brick Breaker game"
          className="block h-auto w-full touch-none outline-none"
          style={{ aspectRatio: "960 / 650" }}
        />
        {hud.state === "menu" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <button onClick={() => act(() => engRef.current?.mainAction())} className="rounded-full bg-[#d4f88a] px-6 py-2.5 text-sm font-extrabold text-[#202916] soft-shadow transition hover:brightness-105 active:scale-95">
              ▶ Khelo
            </button>
          </div>
        )}
        {hud.state === "paused" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/55">
            <p className="text-sm font-bold text-white">⏸ Ruka hua</p>
            <button onClick={() => act(() => engRef.current?.mainAction())} className="rounded-full bg-[#d4f88a] px-6 py-2.5 text-sm font-extrabold text-[#202916] soft-shadow transition hover:brightness-105 active:scale-95">
              ▶ Jari rakho
            </button>
          </div>
        )}
        {hud.state === "levelClear" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/55">
            <p className="text-sm font-bold text-white">✅ Level {hud.level} clear!</p>
            <button onClick={() => act(() => engRef.current?.mainAction())} className="rounded-full bg-[#d4f88a] px-6 py-2.5 text-sm font-extrabold text-[#202916] soft-shadow transition hover:brightness-105 active:scale-95">
              ▶ Agla level
            </button>
          </div>
        )}
        {hud.state === "bossIntro" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/55">
            <p className="text-sm font-bold text-white">👹 Warden aa gaya — Level {hud.level}</p>
            <button onClick={() => act(() => engRef.current?.mainAction())} className="rounded-full bg-[#d4f88a] px-6 py-2.5 text-sm font-extrabold text-[#202916] soft-shadow transition hover:brightness-105 active:scale-95">
              ▶ Shuru karo
            </button>
          </div>
        )}
        {hud.state === "gameOver" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/55">
            <p className="text-sm font-bold text-white">🏁 Game Over — Score {hud.score.toLocaleString()}</p>
            <button onClick={() => act(() => engRef.current?.mainAction())} className="rounded-full bg-[#d4f88a] px-6 py-2.5 text-sm font-extrabold text-[#202916] soft-shadow transition hover:brightness-105 active:scale-95">
              🔁 Phir se khelo
            </button>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[13px] font-semibold text-[#2f3035]">
        <span>Score <b className="tabular-nums">{hud.score.toLocaleString()}</b></span>
        <span className="text-[#80848e]">Level <b className="text-[#2f3035] tabular-nums">{hud.level}</b></span>
        <span aria-label="lives">❤️ ×{hud.lives}</span>
        <span className="ml-auto flex items-center gap-1">
          <button
            onClick={() => act(() => engRef.current?.togglePause())}
            disabled={!inGame && hud.state !== "paused"}
            className="grid h-8 w-8 place-items-center rounded-full text-[#5c5e66] transition hover:bg-black/5 disabled:opacity-30"
            title={hud.state === "paused" ? "Jari rakho" : "Pause"}
          >
            {hud.state === "paused" ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button
            onClick={() => act(() => engRef.current?.restart())}
            disabled={hud.state === "menu"}
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
              <span className="ml-auto font-bold tabular-nums text-[#2f3035]">{e.best.toLocaleString()}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
