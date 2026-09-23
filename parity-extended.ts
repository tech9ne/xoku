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
function solve(g0: Game, next: (g: Game) => Step | null, maxSteps = 300) {
  const g = clone(g0); const steps: Step[] = [];
  let highest = 0, highestTech = "—";
  while (!isSolved(g) && steps.length < maxSteps) {
    const before = { values: g.values.slice(), cands: g.cands.slice() };
    const s = next(g);
    if (!s) break;
    apply(g, s);
    steps.push(s);
    if (s.score > highest) { highest = s.score; highestTech = s.technique; }
    const changed = before.values.some((v, i) => v !== g.values[i]) ||
                    before.cands.some((c, i) => c !== g.cands[i]);
    if (!changed && steps.length > 5) break;
  }
  return { steps, solved: isSolved(g), highest, highestTech };
}
const oldNext = (g: Game) => { for (const f of FINDERS) { const s = f(g); if (s) return s; } return null; };

const tiers = [
  "Extremely Easy", "Very Easy", "Modestly Easy", "Easy", 
  "Moderate", "Tough", "Challenging", "Irritating", 
  "Frustrating", "Hard", "Demanding", "Expert", "Brutal", "Nightmare"
] as const;
const perTier = 3;

console.log("Extended corpus: 14 tiers × 3 puzzles each\n");
for (const tier of tiers) {
  let oldSolved = 0, stmSolved = 0, total = 0;
  for (let i = 0; i < perTier; i++) {
    const res = generatePuzzle(tier);
    if ('failed' in res) continue;
    const g = newGame(res.puzzle, res.solution);
    const old = solve(g, oldNext);
    const stm = solve(g, stormFindNextStep);
    if (old.solved) oldSolved++;
    if (stm.solved) stmSolved++;
    total++;
  }
  if (total > 0) {
    console.log(`${tier}: old ${oldSolved}/${total}, storm ${stmSolved}/${total}`);
  }
}
