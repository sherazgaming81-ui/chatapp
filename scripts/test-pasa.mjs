// Pasa (Ludo v2) pure-logic test — games.ts ko temp dir me compile karke
// pasaLegalMoves / pasaSixChainAfter / helpers ke bunyadi cases check karta hai.
// Chalao: node scripts/test-pasa.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "pasa-test-"));
execFileSync("npx", ["tsc", "src/lib/games.ts", "--outDir", out, "--module", "commonjs", "--target", "es2020", "--moduleResolution", "node", "--skipLibCheck", "--noEmitOnError", "false"], { cwd: root, stdio: "pipe" });
const require = createRequire(import.meta.url);
const G = require(join(out, "games.js"));
const { pasaLegalMoves, pasaSixChainAfter, pasaPlayerDone, pasaBotName, pasaCell, pasaTorActive, pasaHasKill } = G;

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} — mila ${g}, chahiye tha ${w}`); }
}
function ok(name, cond) { eq(name, !!cond, true); }

function mkState(tokens, settings = {}, kills = {}) {
  return {
    v: 2,
    players: ["A", "B", "C", "D"],
    tokens,
    kills,
    turn: "A", phase: "move", roll: null, sixChain: 0,
    settings: { per: 4, timer: true, capture: true, teams: false, tor: false, ...settings },
    bots: {}, host: "A", started: true, log: [], done: false, winner: null,
    leftPlayers: [], t: "🎲 Ludo",
  };
}
const F = [58, 58, 58, 58]; // finished tokens filler

console.log("— base se nikalna —");
let st = mkState({ A: [0, ...F.slice(1)], B: F, C: F, D: F });
eq("roll 5 par base wali goti nahi chal sakti", pasaLegalMoves(st, "A", 5), []);
eq("roll 6 par base wali goti chal sakti hai", pasaLegalMoves(st, "A", 6), [0]);

console.log("— exact roll / overshoot —");
st = mkState({ A: [56, ...F.slice(1)], B: F, C: F, D: F });
eq("56 par roll 3 overshoot — illegal", pasaLegalMoves(st, "A", 3), []);
eq("56 par roll 2 exact finish — legal", pasaLegalMoves(st, "A", 2), [0]);
st = mkState({ A: [50, ...F.slice(1)], B: F, C: F, D: F });
eq("50 par roll 5 home column (55) — legal", pasaLegalMoves(st, "A", 5), [0]);

console.log("— block (dushman ki 2 gotiyan) —");
// A (offset 0) progress 10 => cell 9. B (offset 13) ke cell 12 par 2 tokens: progress = ((12-13) mod 52)+1 = 52
st = mkState({ A: [10, ...F.slice(1)], B: [52, 52, 58, 58], C: F, D: F });
ok("setup: B ki dono tokens cell 12 par hain", pasaCell(1, 52) === 12);
eq("roll 4 block ke UPAR se guzarna — illegal", pasaLegalMoves(st, "A", 4), []);
eq("roll 3 block par LAND karna — illegal", pasaLegalMoves(st, "A", 3), []);
eq("roll 2 block se pehle rukna — legal", pasaLegalMoves(st, "A", 2), [0]);
// apni block passable
st = mkState({ A: [10, 13, 13, 58], B: F, C: F, D: F });
ok("apni block ke upar se guzarna — legal", pasaLegalMoves(st, "A", 4).includes(0));
// teams: partner (C, offset 26) ki block cell 12 par: progress = ((12-26) mod 52)+1 = 39
const blockTokens = { A: [10, ...F.slice(1)], B: F, C: [39, 39, 58, 58], D: F };
ok("setup: C ki tokens cell 12 par", pasaCell(2, 39) === 12);
eq("FFA me C ki block ke upar se — illegal", pasaLegalMoves(mkState(blockTokens), "A", 4), []);
ok("Teams me partner ki block ke upar se — legal", pasaLegalMoves(mkState(blockTokens, { teams: true }), "A", 4).includes(0));

console.log("— safe cell —");
// Safe cell 8 par B ki 1 token: B progress = ((8-13) mod 52)+1 = 48. A progress 5 => cell 4, roll 4 => progress 9 => cell 8.
st = mkState({ A: [5, ...F.slice(1)], B: [48, 58, 58, 58], C: F, D: F });
ok("setup: B ki token safe cell 8 par", pasaCell(1, 48) === 8 && G.PASA_SAFE_CELLS.includes(8));
ok("safe cell par land karna move ke tor par legal hai (wahan CAPTURE engine rokta hai — db.ts pasaApplyMove me PASA_SAFE_CELLS check)", pasaLegalMoves(st, "A", 4).includes(0));

console.log("— tor rule (kill-gate: pehle goti maro, phir ghar) —");
// (a) tor on + kill=0: home column entry (53+) band, track move theek hai
let torSt = mkState({ A: [50, ...F.slice(1)], B: F, C: F, D: F }, { tor: true }, { A: 0 });
ok("tor active hai (tor+capture+per4)", pasaTorActive(torSt));
eq("(a) kill=0: 50 se roll 5 home entry (55) — illegal", pasaLegalMoves(torSt, "A", 5), []);
ok("(a) kill=0: 50 se roll 2 track par (52) — legal", pasaLegalMoves(torSt, "A", 2).includes(0));
eq("(a) kill=0: 56 se roll 2 finish — illegal", pasaLegalMoves(mkState({ A: [56, ...F.slice(1)], B: F, C: F, D: F }, { tor: true }, { A: 0 }), "A", 2), []);
ok("(a) kill=0: base se 6 par bahar — legal (tor sirf ghar rokta hai)", pasaLegalMoves(mkState({ A: [0, ...F.slice(1)], B: F, C: F, D: F }, { tor: true }, { A: 0 }), "A", 6).includes(0));
// (b) kill>=1: sab khula hai
const killedSt = mkState({ A: [50, ...F.slice(1)], B: F, C: F, D: F }, { tor: true }, { A: 1 });
ok("(b) pasaHasKill kill=1 par true", pasaHasKill(killedSt, "A"));
ok("(b) kill>=1: 50 se roll 5 home entry (55) — legal", pasaLegalMoves(killedSt, "A", 5).includes(0));
ok("(b) kill>=1: 56 se roll 2 finish — legal", pasaLegalMoves(mkState({ A: [56, ...F.slice(1)], B: F, C: F, D: F }, { tor: true }, { A: 1 }), "A", 2).includes(0));
// kills per-player: B ka kill A ke kaam nahi
eq("(b) dusre (B) ka kill A ko home nahi deta", pasaLegalMoves(mkState({ A: [50, ...F.slice(1)], B: F, C: F, D: F }, { tor: true }, { B: 2 }), "A", 5), []);
// (c) per=1: tor setting on ho tab bhi apply nahi hota
const oneSt = mkState({ A: [50], B: [58], C: [58], D: [58] }, { tor: true, per: 1 }, { A: 0 });
eq("(c) per=1 me tor active NAHI", pasaTorActive(oneSt), false);
ok("(c) per=1: kill=0 par bhi 50 se roll 5 home — legal (sirf pugana)", pasaLegalMoves(oneSt, "A", 5).includes(0));
ok("(c) per=1: 56 se roll 2 finish — legal", pasaLegalMoves(mkState({ A: [56], B: [58], C: [58], D: [58] }, { tor: true, per: 1 }, { A: 0 }), "A", 2).includes(0));
// (d) capture off: tor auto off
const capOffSt = mkState({ A: [50, ...F.slice(1)], B: F, C: F, D: F }, { tor: true, capture: false }, { A: 0 });
eq("(d) capture off par tor active NAHI", pasaTorActive(capOffSt), false);
ok("(d) capture off: kill=0 par bhi home entry — legal", pasaLegalMoves(capOffSt, "A", 5).includes(0));
// kills record missing (purani game): tor on ho to kill=0 mana jayega
eq("purani game (kills missing): tor on par home band", pasaLegalMoves({ ...mkState({ A: [50, ...F.slice(1)], B: F, C: F, D: F }, { tor: true }), kills: undefined }, "A", 5), []);

console.log("— teen 6 rule (pasaSixChainAfter) —");
eq("pehla 6", pasaSixChainAfter(0, 6), { chain: 1, forfeited: false });
eq("doosra 6", pasaSixChainAfter(1, 6), { chain: 2, forfeited: false });
eq("teesra 6 zaya", pasaSixChainAfter(2, 6), { chain: 3, forfeited: true });
eq("gair-6 par chain reset", pasaSixChainAfter(2, 4), { chain: 0, forfeited: false });

console.log("— helpers —");
ok("pasaPlayerDone: saari 58", pasaPlayerDone(mkState({ A: F, B: F, C: F, D: F }), "A"));
ok("pasaPlayerDone: left player", pasaPlayerDone({ ...mkState({ A: [0, 0, 0, 0], B: F, C: F, D: F }), leftPlayers: ["A"] }, "A"));
eq("pasaPlayerDone: beech game me false", pasaPlayerDone(mkState({ A: [10, 0, 0, 0], B: F, C: F, D: F }), "A"), false);
eq("pasaBotName", pasaBotName("__bot_2"), "🤖 Bot 2");
eq("pasaBotName insaan par null", pasaBotName("user123"), null);

console.log(`\nResult: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
