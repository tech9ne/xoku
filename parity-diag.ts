// Diagnostic: show first 5 steps from each engine side-by-side
import { generatePuzzle, newGame } from "./lib/sudoku/solver";
import { FINDERS } from "./lib/sudoku/techniques";
import { stormFindNextStep, toCandidateGrid } from "./lib/sudoku/storm-adapter";
import { Game, Step, PEERS, candMask } from "./lib/sudoku/core";
import * as storm from "./lib/sudoku/storm/sudoku";

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
function getFirstN(g0: Game, next: (g: Game) => Step | null, n: number) {
  const g = clone(g0); const steps: Step[] = [];
  while (!isSolved(g) && steps.length < n) {
    const s = next(g); if (!s) break; apply(g, s); steps.push(s);
  }
  return steps;
}
const oldNext = (g: Game) => { for (const f of FINDERS) { const s = f(g); if (s) return s; } return null; };

for (let i = 0; i < 3; i++) {
  const res = generatePuzzle("Moderate");
  if ('failed' in res) { console.log(`#${i+1} generation failed`); continue; }
  const g = newGame(res.puzzle, res.solution);
  
  console.log(`\n=== Puzzle #${i+1} ===`);
  const oldSteps = getFirstN(g, oldNext, 5);
  const stmSteps = getFirstN(g, stormFindNextStep, 5);
  
  for (let j = 0; j < 5; j++) {
    const o = oldSteps[j], s = stmSteps[j];
    console.log(`Step ${j+1}:`);
    console.log(`  Old: ${o?.technique} elim=${o?.eliminations.slice(0,3).map(e=>`${e.cell}:${e.cand}`)}`);
    console.log(`  Stm: ${s?.technique} elim=${s?.eliminations.slice(0,3).map(e=>`${e.cell}:${e.cand}`)}`);
    
    // Show raw Storm hint for this step
    if (s) {
      const cg = toCandidateGrid(g);
      // hintFor expects Grid (number[]), not CandidateGrid — skip raw hint

    }
  }
}
