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
function solveMax(g0: Game, next: (g: Game) => Step | null, maxSteps: number) {
  const g = clone(g0); const steps: Step[] = [];
  while (!isSolved(g) && steps.length < maxSteps) {
    const s = next(g); if (!s) break; apply(g, s); steps.push(s);
  }
  return { steps, solved: isSolved(g) };
}
const oldNext = (g: Game) => { for (const f of FINDERS) { const s = f(g); if (s) return s; } return null; };

for (let i = 0; i < 3; i++) {
  const res = generatePuzzle("Moderate");
  if ('failed' in res) { console.log(`#${i+1} generation failed`); continue; }
  const g = newGame(res.puzzle, res.solution);
  
  console.log(`\n=== Puzzle #${i+1} ===`);
  const old = solveMax(g, oldNext, 50);
  const stm = solveMax(g, stormFindNextStep, 50);
  
  console.log(`Old: ${old.solved ? 'solved' : 'stalled'} after ${old.steps.length} steps`);
  console.log(`Stm: ${stm.solved ? 'solved' : 'stalled'} after ${stm.steps.length} steps`);
  
  // Show last 5 steps from each
  const lastOld = old.steps.slice(-5);
  const lastStm = stm.steps.slice(-5);
  console.log('Old last 5:');
  for (const s of lastOld) console.log(`  ${s.technique} score=${s.score}`);
  console.log('Stm last 5:');
  for (const s of lastStm) console.log(`  ${s.technique} score=${s.score}`);
}
