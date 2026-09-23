import { generatePuzzle, newGame } from "./lib/sudoku/solver";
import { FINDERS } from "./lib/sudoku/techniques";
import { stormFindNextStep } from "./lib/sudoku/storm-adapter";
import { Game, Step, PEERS, candMask } from "./lib/sudoku/core";

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
function solve(g0: Game, next: (g: Game) => Step | null, maxSteps = 100) {
  const g = clone(g0); const steps: Step[] = [];
  while (!isSolved(g) && steps.length < maxSteps) {
    const s = next(g); if (!s) break; apply(g, s); steps.push(s);
  }
  return { steps, solved: isSolved(g) };
}
const oldNext = (g: Game) => { for (const f of FINDERS) { const s = f(g); if (s) return s; } return null; };

for (let i = 0; i < 5; i++) {
  const res = generatePuzzle("Moderate");
  if ('failed' in res) continue;
  const g = newGame(res.puzzle, res.solution);
  const old = solve(g, oldNext);
  const stm = solve(g, stormFindNextStep);
  console.log(`#${i+1}: old ${old.solved ? '✓' : '✗'} (${old.steps.length}), stm ${stm.solved ? '✓' : '✗'} (${stm.steps.length}) last=${stm.steps[stm.steps.length-1]?.technique}`);
}
