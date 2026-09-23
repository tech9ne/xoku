import { generatePuzzle, newGame } from "./lib/sudoku/solver";
import { FINDERS } from "./lib/sudoku/techniques";
import { stormFindNextStep, toCandidateGrid } from "./lib/sudoku/storm-adapter";
import { Game, Step, PEERS, candMask, candsOf } from "./lib/sudoku/core";
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

const oldNext = (g: Game) => { for (const f of FINDERS) { const s = f(g); if (s) return s; } return null; };

const res = generatePuzzle("Moderate");
if ('failed' in res) { console.log('generation failed'); process.exit(1); }
const g = newGame(res.puzzle, res.solution);

const gOld = clone(g);
const gStm = clone(g);

for (let step = 0; step < 60; step++) {
  const oldStep = oldNext(gOld);
  const stmStep = stormFindNextStep(gStm);
  
  if (!oldStep || !stmStep) {
    console.log(`\n=== DIVERGENCE at step ${step} ===`);
    console.log(`Old next: ${oldStep?.technique || 'null'}`);
    console.log(`Stm next: ${stmStep?.technique || 'null'}`);
    
    // Show grid state
    console.log(`\nGrid state (cells with 1 candidate):`);
    for (let i = 0; i < 81; i++) {
      const oldCands = candsOf(gOld.cands[i]);
      const stmCands = candsOf(gStm.cands[i]);
      if (oldCands.length === 1 || stmCands.length === 1) {
        console.log(`  Cell ${i}: old=${oldCands.join(',')}, stm=${stmCands.join(',')}, value=${gOld.values[i]}/${gStm.values[i]}`);
      }
    }
    
    // Check Storm's candidate grid
    const cg = toCandidateGrid(gStm);
    console.log(`\nStorm's toCandidateGrid output (cells with 1 candidate):`);
    for (let i = 0; i < 81; i++) {
      if (cg[i].length === 1) {
        console.log(`  Cell ${i}: ${cg[i].join(',')}`);
      }
    }
    
    // Try Storm's hiddenSubsetStep directly
    const hs = storm.hiddenSubsetStep(cg, 1);
    console.log(`\nStorm hiddenSubsetStep(cg, 1): ${hs ? hs.tech : 'null'}`);
    
    break;
  }
  
  apply(gOld, oldStep);
  apply(gStm, stmStep);
}
