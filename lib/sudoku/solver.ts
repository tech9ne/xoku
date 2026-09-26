import {
  Game, Step, applyStep, candMask, cloneGame, computeCands, countCands,
  candsOf, isSolved, PEERS,
} from "./core";
import { findNextStep } from "./techniques";
import { stormFindNextStepRated } from "./storm-adapter";
import { generationTechniqueProfile, ratingCategoryForValue, type SolverProfile } from "./storm-rater";

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function pickCell(vals: number[]): [cell: number, mask: number, dead: boolean] {
  let cell = -1, mask = 0, best = 10;
  for (let i = 0; i < 81; i++) {
    if (vals[i] !== 0) continue;
    let m = 0x1ff;
    for (const p of PEERS[i]) if (vals[p] !== 0) m &= ~candMask(vals[p]);
    const c = countCands(m);
    if (c === 0) return [-1, 0, true];
    if (c < best) { cell = i; mask = m; best = c; if (c === 1) break; }
  }
  return [cell, mask, false];
}

export function bruteSolve(values: number[], randomized = false): number[] | null {
  const vals = values.slice();
  const dfs = (): boolean => {
    const [cell, mask, dead] = pickCell(vals);
    if (dead) return false;
    if (cell === -1) return true;
    const digits = randomized ? shuffle(candsOf(mask)) : candsOf(mask);
    for (const d of digits) { vals[cell] = d; if (dfs()) return true; vals[cell] = 0; }
    return false;
  };
  return dfs() ? vals : null;
}

export function countSolutions(values: number[], limit = 2): number {
  const vals = values.slice();
  let count = 0;
  const dfs = (): void => {
    const [cell, mask, dead] = pickCell(vals);
    if (dead) return;
    if (cell === -1) { count++; return; }
    for (const d of candsOf(mask)) {
      vals[cell] = d;
      dfs();
      vals[cell] = 0;
      if (count >= limit) return;
    }
  };
  dfs();
  return count;
}

export function newGame(puzzle: number[], solution?: number[]): Game {
  const sol = solution ?? bruteSolve(puzzle) ?? new Array(81).fill(0);
  return {
    values: puzzle.slice(),
    cands: computeCands(puzzle),
    given: puzzle.map(v => v !== 0),
    solution: sol,
  };
}

export interface Rating {
  steps: Step[];
  score: number;              // sum of all step XRs (display stat)
  hardest: number;            // XR of the hardest step required
  hardestTechnique: string;
  solvedByLogic: boolean;
}

export function rateGame(g: Game): Rating {
  const steps: Step[] = [];
  const g2 = cloneGame(g);
  let hardest = 0, hardestTechnique = "—";
  let sum = 0;
  while (!isSolved(g2)) {
    const before = g2.values.slice();
    const bc = g2.cands.slice();
    const s = findNextStep(g2);
    if (!s) break;
    applyStep(g2, s);
    if (before.every((v, i) => v === g2.values[i]) && bc.every((c, i) => c === g2.cands[i])) break;
    steps.push(s);
    sum += s.score;
    if (s.score > hardest) { hardest = s.score; hardestTechnique = s.technique; }
  }
  const solvedByLogic = isSolved(g2);
  return { steps, score: sum, hardest, hardestTechnique, solvedByLogic };
}

export type Level = "Unknown" | "Lulz" | "Extremely Easy" | "Very Easy" | "Modestly Easy" | "Easy" | "Moderate" | "Tough" | "Challenging" | "Irritating" | "Frustrating" | "Hard" | "Demanding" | "Expert" | "Brutal" | "Nightmare" | "Abyssal" | "Transcendent";

// ---- Xoku Rating (XR) ----
// Every technique has an XR; a puzzle's XR is the rating of the hardest
// technique its solve path actually requires. Levels are bands over XR:
//   Easy       1.0 - 1.9   singles only
//   Moderate     2.0 - 4.9   locked candidates, subsets, X-Wing,
//                          skyscraper/kite/turbot, colors, remote pairs, XY/XYZ-wings
//   Hard       5.0 - 6.9   swordfish, W-wing, jellyfish, XY-chains
//   Brutal 7.0 - 8.4   ALS family, death blossom, kraken fish
//   Nightmare    8.5+ / not solvable with the current engine
const XR_BAND: Record<Level, { min: number; max: number } | null> = {
  // cite: stormdoku index.html RATING_CATEGORY_SCORE_BANDS (verbatim, DISJOINT)
  Unknown: null,
  Lulz: { min: 0, max: 0 },
  "Extremely Easy": { min: 1, max: 1.5 },
  "Very Easy": { min: 2, max: 2 },
  "Modestly Easy": { min: 2.001, max: 2.999 },
  Easy: { min: 3, max: 3 },
  Moderate: { min: 3.001, max: 3.999 },
  Tough: { min: 4, max: 4 },
  Challenging: { min: 4.001, max: 4.999 },
  Irritating: { min: 5, max: 5.999 },
  Frustrating: { min: 6, max: 6.999 },
  Hard: { min: 7, max: 7.999 },
  Demanding: { min: 8, max: 8.999 },
  Expert: { min: 9, max: 9.999 },
  Brutal: { min: 10, max: 10.999 },
  Nightmare: { min: 11, max: 11.999 },
  Abyssal: { min: 12, max: 12.999 },
  Transcendent: { min: 13, max: 14.999 },
};

export function levelOfRating(r: { hardest: number; solvedByLogic: boolean }): Level {
  if (!r.solvedByLogic) return "Nightmare";
  // cite: stormdoku index.html ratingCategoryForValue (inclusive bounds verbatim)
  const band = (Object.entries(XR_BAND) as [Level, { min: number; max: number } | null][])
    .find(([, b]) => b !== null && r.hardest >= b.min && r.hardest <= b.max);
  return band ? band[0] : "Unknown";
}

export function rateBounded(g: Game, bandMax: number): Rating { // retained for old-engine parachute until H-cleanup
  const steps: Step[] = [];
  const g2 = cloneGame(g);
  let hardest = 0, hardestTechnique = "—";
  let sum = 0;
  while (!isSolved(g2)) {
    const bv = g2.values.slice(); const bc = g2.cands.slice();
    const st = findNextStep(g2);
    if (!st) break;
    applyStep(g2, st);
    if (bv.every((v, i) => v === g2.values[i]) && bc.every((c, i) => c === g2.cands[i])) break;
    if (st.score > hardest) { hardest = st.score; hardestTechnique = st.technique; }
    if (hardest > bandMax) break; // prune: band unreachable, stop paying for the rest
    steps.push(st);
    sum += st.score;
  }
  return { steps, score: sum, hardest, hardestTechnique, solvedByLogic: isSolved(g2) };
}


// ---- H-parity-e3: his two-stage generator ------------------------------
// cite: index.html:13339 generatePuzzle. Stage 1 solves each candidate
// under generationTechniqueProfile(target) - a puzzle needing
// above-tier techniques stalls fast (cheap reject); accept only
// solved && category === target, Lulz additionally sum === 0. Stage 2
// re-verifies survivors under profile('Nightmare'). maxRatingAttempts
// = 1000; honest failure leaves the current puzzle unchanged. Our dig
// with per-removal uniqueness is retained (his core.generate does the
// same, browser-core.js:324). Deviations in STATE.md: per-level clue
// targets kept; worker runs wall-free, main thread defaults 30s.
function cluesTarget(level: Level): number {
  const t: Record<Level, number> = {
    Unknown: 30, Lulz: 40, "Abyssal": 20, "Transcendent": 17,
    "Extremely Easy": 40, "Very Easy": 36, "Modestly Easy": 33,
    "Easy": 30, "Moderate": 28, "Tough": 26, "Challenging": 25,
    "Irritating": 24, "Frustrating": 23, "Hard": 22, "Demanding": 21,
    "Expert": 20, "Brutal": 19, "Nightmare": 18,
  };
  return t[level];
}

interface ProfileSolve {
  solvedCorrect: boolean;
  category: string; // his ratingFromSteps category (index.html:8917)
  sum: number;      // his score: sum of finite move values
  hardest: number;
  hardestTechnique: string;
  steps: Step[];
}

// Restricted solve: Storm path ONLY, profile-gated. A stall means the
// puzzle is unsolvable at this tier - the fail-fast reject. No
// old-FINDERS fall-through: it would rate with forbidden techniques.
function stormSolveUnderProfile(g: Game, solution: number[], profile: SolverProfile | null): ProfileSolve {
  const g2 = cloneGame(g);
  const steps: Step[] = [];
  let hardest = 0, hardestTechnique = "—", sum = 0;
  let top: { value: number | null; rank: number; category: string } | null = null;
  for (let cycle = 0; cycle < 100; cycle++) { // his maxCycles = 100
    const rated = stormFindNextStepRated(g2, profile ?? undefined);
    if (!rated) break;
    const before = g2.values.slice();
    applyStep(g2, rated.step);
    steps.push(rated.step);
    if (rated.rating.value !== null) sum += rated.rating.value;
    if (!top
      || rated.rating.rank > top.rank
      || (rated.rating.rank === top.rank
        && Number(rated.rating.value ?? -Infinity) > Number(top.value ?? -Infinity))) {
      top = rated.rating;
    }
    if (rated.rating.value !== null && rated.rating.value > hardest) {
      hardest = rated.rating.value;
      hardestTechnique = rated.step.technique;
    }
    let changed = false;
    for (let i = 0; i < 81; i++) if (before[i] !== g2.values[i]) { changed = true; break; }
    if (!changed) break;
  }
  let solvedCorrect = isSolved(g2);
  if (solvedCorrect) {
    for (let i = 0; i < 81; i++) {
      if (g2.values[i] !== solution[i]) { solvedCorrect = false; break; }
    }
  }
  const category = top ? ratingCategoryForValue(top.value, top.category) : 'Unknown';
  return { solvedCorrect, category, sum, hardest, hardestTechnique, steps };
}

export function generatePuzzle(level: Level = "Easy", opts?: { timeBudgetMs?: number }) {
  // Xoku-UX guard (documented deviation): Abyssal/Transcendent need
  // ALS-DOF/DDS moves (rank 150/160) the vendored engine cannot produce
  // yet; stage 1 would stall on every candidate. Fail honestly now;
  // remove this guard when the ALS-DOF engine is vendored.
  if (level === 'Abyssal' || level === 'Transcendent') {
    return { failed: true, attempts: 0, level, reason: 'als-dof-not-vendored' };
  }
  const profile = generationTechniqueProfile(level); // null for Unknown
  const verifyProfile = generationTechniqueProfile('Nightmare');
  const t0 = Date.now();
  const timeBudget = opts?.timeBudgetMs ?? 30000; // 0 = wall-free (worker)
  const maxAttempts = 1000; // his maxRatingAttempts (index.html:13355)
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (timeBudget > 0 && Date.now() - t0 > timeBudget) break;
    const solution = bruteSolve(new Array(81).fill(0), true)!;
    const puzzle = solution.slice();
    let clues = 81;
    for (const i of shuffle(Array.from({ length: 81 }, (_, k) => k))) {
      if (clues <= cluesTarget(level)) break;
      const v = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle, 2) !== 1) puzzle[i] = v;
      else clues--;
    }
    const limited = stormSolveUnderProfile(newGame(puzzle, solution), solution, profile);
    const stage1Ok = limited.solvedCorrect
      && (profile === null || limited.category === level)
      && (level !== 'Lulz' || limited.sum === 0);
    if (!stage1Ok) continue;
    if (profile === null) {
      // his quickGeneration (Any/Unknown): accept the first unique solve.
      return { puzzle, solution, rating: {
        steps: limited.steps, score: limited.sum, hardest: limited.hardest,
        hardestTechnique: limited.hardestTechnique, solvedByLogic: true,
      } };
    }
    const verified = stormSolveUnderProfile(newGame(puzzle, solution), solution, verifyProfile);
    if (!(verified.solvedCorrect && verified.category === level)) continue;
    if (level === 'Lulz' && verified.sum !== 0) continue;
    return { puzzle, solution, rating: {
      steps: limited.steps, score: limited.sum, hardest: limited.hardest,
      hardestTechnique: limited.hardestTechnique, solvedByLogic: true,
    } };
  }
  return { failed: true, attempts: maxAttempts, level };
}
