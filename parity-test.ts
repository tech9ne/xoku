// Parity gate v2: old FINDERS vs StormDoku adapter on a corpus.
import { generatePuzzle, newGame } from "./lib/sudoku/solver";
import { FINDERS } from "./lib/sudoku/techniques";
import { stormFindNextStep } from "./lib/sudoku/storm-adapter";
import { Game, Step, PEERS, candMask } from "./lib/sudoku/core";

const CORPUS = 20;

const clone = (g: Game): Game => ({
  values: g.values.slice(), cands: g.cands.slice(),
  given: g.given.slice(), solution: g.solution.slice(),
});
const isSolved = (g: Game) => g.values.every(v => v !== 0);
function apply(g: Game, s: Step) {
  for (const e of s.eliminations) if (g.values[e.cell] === 0) g.cands[e.cell] &= ~candMask(e.cand);
  for (const p of s.placements) {
    g.values[p.cell] = p.value; g.cands[p.cell] = 0;
    for (const t of PEERS[p.cell]) if (g.values[t] === 0) g.cands[t] &= ~candMask(p.value);
  }
}
function solve(g0: Game, next: (g: Game) => Step | null) {
  const g = clone(g0); const steps: Step[] = [];
  while (!isSolved(g)) { const s = next(g); if (!s) break; apply(g, s); steps.push(s); }
  let hardest = 0, tech = "—";
  for (const s of steps) if (s.score > hardest) { hardest = s.score; tech = s.technique; }
  return { steps, solved: isSolved(g), hardest, tech };
}
const oldNext = (g: Game) => { for (const f of FINDERS) { const s = f(g); if (s) return s; } return null; };
const elims = (r: { steps: Step[] }) => new Set(r.steps.flatMap(s => s.eliminations.map(e => `${e.cell}:${e.cand}`)));

let div = 0;
for (let i = 0; i < CORPUS; i++) {
  const res = generatePuzzle("Moderate"); if ("failed" in res) continue; const { puzzle, solution } = res;
  const g = newGame(puzzle, solution);
  const a = solve(g, oldNext), b = solve(g, stormFindNextStep);
  const ea = elims(a), eb = elims(b);
  const same = ea.size === eb.size && [...ea].every(k => eb.has(k));
  const ok = a.solved === b.solved && same;
  if (!ok) {
    div++;
    if (div <= 5) console.log(
      `#${i + 1} old: solved=${a.solved} n=${a.steps.length} xr=${a.hardest.toFixed(1)} ${a.tech}\n` +
      `     stm: solved=${b.solved} n=${b.steps.length} xr=${b.hardest.toFixed(1)} ${b.tech}\n` +
      `     only-old=${[...ea].filter(k => !eb.has(k)).slice(0, 4)} only-stm=${[...eb].filter(k => !ea.has(k)).slice(0, 4)}`);
  }
}
console.log(`divergences ${div}/${CORPUS} — ${div === 0 ? "PARITY HOLDS" : "triage needed"}`);
