const { execSync } = require("child_process");
execSync("npx tsc lib/sudoku/core.ts lib/sudoku/techniques.ts lib/sudoku/solver.ts lib/sudoku/slices.ts lib/sudoku/chain-tables.ts lib/sudoku/chain-engine.ts --rootDir lib/sudoku --outDir /tmp/xkhint --module commonjs --target es2020 --skipLibCheck", { stdio: "inherit" });
const T = require("/tmp/xkhint/techniques.js");
const E = require("/tmp/xkhint/chain-engine.js");
const S = require("/tmp/xkhint/solver.js");
const C = require("/tmp/xkhint/core.js");
const puzzle = process.argv[2];
const K = +(process.argv[3] || 0);
const g = S.newGame([...puzzle].map(c => c === "." ? 0 : +c));
const PEERS = C.PEERS || C.peers;
if (K > 0 && PEERS) {
  const r0 = S.rateGame(g);
  const n = Math.min(K, r0.steps.length);
  for (let i = 0; i < n; i++) {
    const s = r0.steps[i];
    for (const p of s.placements || []) {
      const d = p.digit ?? p.value; if (!d) continue;
      g.values[p.cell] = d; g.cands[p.cell] = 0;
      for (const q of PEERS[p.cell]) if (g.values[q] === 0) g.cands[q] &= ~(1 << d);
    }
    for (const e of s.eliminations || []) g.cands[e.cell] &= ~(1 << e.cand);
  }
  console.log(`Advanced ${n} steps`);
}
console.log(`Puzzle: ${puzzle}\n`);
const all = { ...T, ...E };
for (const [name, fn] of Object.entries(all)) {
  if (typeof fn !== "function") continue;
  let res = null;
  try { res = fn(g); } catch (e) { continue; }
  if (!res || typeof res !== "object") continue;
  const list = Array.isArray(res) ? res : [res];
  for (const r of list) {
    if (!r.technique) continue;
    console.log(`=== ${name} ===`);
    console.log(`Technique: ${r.technique}`);
    console.log(`Reason: ${r.reason}`);
    console.log(`Elims: ${JSON.stringify(r.eliminations)}`);
    console.log();
  }
}
