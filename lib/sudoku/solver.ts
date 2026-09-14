import {
  Game, Step, applyStep, candMask, cloneGame, computeCands, countCands,
  candsOf, isSolved, PEERS,
} from "./core";
import { findNextStep } from "./techniques";

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
  const g2 = cloneGame(g);
  const steps: Step[] = [];
  while (!isSolved(g2)) {
    const s = findNextStep(g2);
    if (!s) break;
    applyStep(g2, s);
    steps.push(s);
  }
  let hardest = 0, hardestTechnique = "—";
  for (const s of steps) if (s.score > hardest) { hardest = s.score; hardestTechnique = s.technique; }
  return {
    steps,
    score: steps.reduce((a, s) => a + s.score, 0),
    hardest, hardestTechnique,
    solvedByLogic: isSolved(g2),
  };
}

export type Level = "Easy" | "Medium" | "Hard" | "Diabolical" | "Extreme";

// ---- Xoku Rating (XR) ----
// Every technique has an XR; a puzzle's XR is the rating of the hardest
// technique its solve path actually requires. Levels are bands over XR:
//   Easy       1.0 - 1.9   singles only
//   Medium     2.0 - 4.9   locked candidates, subsets, X-Wing, UR, BUG+1,
//                          skyscraper/kite/turbot, colors, remote pairs, XY/XYZ-wings
//   Hard       5.0 - 6.9   swordfish, W-wing, BUG+2/+3, jellyfish, XY-chains
//   Diabolical 7.0 - 8.4   ALS family, death blossom, kraken fish
//   Extreme    8.5+ / not solvable with the current engine
const XR_BAND: Record<Exclude<Level, "Extreme">, [number, number]> = {
  Easy: [1.0, 2.0],
  Medium: [2.0, 5.0],
  Hard: [5.0, 7.0],
  Diabolical: [7.0, 8.5],
};

export function levelOfRating(r: { hardest: number; solvedByLogic: boolean }): Level {
  if (!r.solvedByLogic) return "Extreme";
  if (r.hardest < 2.0) return "Easy";
  if (r.hardest < 5.0) return "Medium";
  if (r.hardest < 7.0) return "Hard";
  if (r.hardest < 8.5) return "Diabolical";
  return "Extreme";
}

export function generatePuzzle(level: Level = "Easy") {
  const cluesTarget: Record<Level, number> = { Easy: 40, Medium: 32, Hard: 24, Diabolical: 22, Extreme: 22 };
  const maxAttempts: Record<Level, number> = { Easy: 30, Medium: 30, Hard: 50, Diabolical: 50, Extreme: 50 };
  const band = level === "Extreme" ? null : XR_BAND[level];
  const t0 = Date.now();

  // distance from the requested band (0 = exact match).
  // With ALS-XZ (XR 7.0) Diabolical is reachable; fallback reports honestly.
  //
  const dist = (r: Rating): number => {
    if (!band) return r.solvedByLogic ? 1000 - Math.min(r.hardest, 999) : 0;
    if (!r.solvedByLogic) return 500;
    const [lo, hi] = band;
    return r.hardest < lo ? lo - r.hardest : r.hardest >= hi ? r.hardest - hi : 0;
  };

  let best: { puzzle: number[]; solution: number[]; rating: Rating } | null = null;
  let bestDist = Infinity;

  for (let attempt = 0; attempt < maxAttempts[level]; attempt++) {
    if (Date.now() - t0 > 30000) break; // time budget: return best effort
    const solution = bruteSolve(new Array(81).fill(0), true)!;
    const puzzle = solution.slice();
    let clues = 81;
    for (const i of shuffle(Array.from({ length: 81 }, (_, k) => k))) {
      if (clues <= cluesTarget[level]) break;
      const v = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle, 2) !== 1) puzzle[i] = v;
      else clues--;
    }
    const rating = rateGame(newGame(puzzle, solution));
    const candidate = { puzzle, solution, rating };
    const d = dist(rating);
    if (d === 0) return candidate;
    if (d < bestDist) { best = candidate; bestDist = d; }
  }
  return best!;
}
