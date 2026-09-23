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

const oldNext = (g: Game) => { for (const f of FINDERS) { const s = f(g); if (s) return s; } return null; };

for (let i = 0; i < 3; i++) {
  const res = generatePuzzle("Moderate");
  if ('failed' in res) { console.log(`#${i+1} generation failed`); continue; }
  const g = newGame(res.puzzle, res.solution);
  
  console.log(`\n=== Puzzle #${i+1} ===`);
  
  // Old engine: 20 steps max
  const gOld = clone(g);
  const oldSteps: Step[] = [];
  while (!isSolved(gOld) && oldSteps.length < 20) {
    const s = oldNext(gOld);
    if (!s) break;
    apply(gOld, s);
    oldSteps.push(s);
  }
  console.log(`Old: ${oldSteps.length} steps, last=${oldSteps[oldSteps.length-1]?.technique}`);
  
  // Storm engine: 20 steps max with debug
  const gStm = clone(g);
  const stmSteps: Step[] = [];
  while (!isSolved(gStm) && stmSteps.length < 20) {
    const before = { 
      values: gStm.values.slice(), 
      cands: gStm.cands.slice() 
    };
    const s = stormFindNextStep(gStm);
    if (!s) {
      console.log(`Storm: stalled at step ${stmSteps.length}`);
      break;
    }
    apply(gStm, s);
    stmSteps.push(s);
    
    // Check if state changed
    const changed = before.values.some((v, i) => v !== gStm.values[i]) ||
                    before.cands.some((c, i) => c !== gStm.cands[i]);
    if (!changed) {
      console.log(`Storm: state unchanged after ${s.technique}!`);
      console.log(`  placements=${JSON.stringify(s.placements)}`);
      console.log(`  eliminations=${JSON.stringify(s.eliminations.slice(0,3))}`);
      break;
    }
  }
  console.log(`Storm: ${stmSteps.length} steps, last=${stmSteps[stmSteps.length-1]?.technique}`);
}
