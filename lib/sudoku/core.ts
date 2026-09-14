export type Digit = number; // 1..9

export const ALL_DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export interface Elimination { cell: number; cand: Digit; }
export interface Placement { cell: number; value: Digit; }

export type StepCategory =
  | "Single" | "Locked Candidates" | "Subset" | "Fish"
  | "Single Digit Chain" | "Coloring" | "Wing" | "Chain" | "Uniqueness" | "ALS" | "Brute Force";

export interface Step {
  technique: string;
  category: StepCategory;
  score: number;
  reason: string;
  placements: Placement[];
  eliminations: Elimination[];
  patternCells: number[];
  patternCands: Elimination[];
  cellGroups?: { cells: number[]; color: number }[];
  candColors?: { cell: number; cand: Digit; color: number }[];
  links?: { from: { cell: number; cand: Digit }; to: { cell: number; cand: Digit }; strong: boolean }[];
}

export interface Game {
  values: number[];
  cands: number[];
  given: boolean[];
  solution: number[];
}

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3);

export const UNITS: number[][] = [];
export const UNITS_OF: number[][] = [];
export const PEERS: number[][] = [];

for (let r = 0; r < 9; r++) UNITS.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
for (let c = 0; c < 9; c++) UNITS.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
for (let b = 0; b < 9; b++) {
  const cells: number[] = [];
  const br = Math.floor(b / 3) * 3, bc = (b % 3) * 3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push((br + r) * 9 + bc + c);
  UNITS.push(cells);
}
for (let i = 0; i < 81; i++) {
  UNITS_OF[i] = [rowOf(i), 9 + colOf(i), 18 + boxOf(i)];
  PEERS[i] = Array.from(new Set(
    [...UNITS[rowOf(i)], ...UNITS[9 + colOf(i)], ...UNITS[18 + boxOf(i)]].filter(x => x !== i)
  ));
}

export const unitName = (u: number) =>
  u < 9 ? `row ${u + 1}` : u < 18 ? `column ${u - 8}` : `box ${u - 17}`;
export const cellName = (i: number) => `r${rowOf(i) + 1}c${colOf(i) + 1}`;
export const candMask = (d: Digit) => 1 << (d - 1);
export const candsOf = (m: number): Digit[] => {
  const out: Digit[] = [];
  for (let d = 1; d <= 9; d++) if (m & candMask(d)) out.push(d);
  return out;
};
export const countCands = (m: number) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };

export const arePeers = (a: number, b: number) => PEERS[a].includes(b);
export function commonPeers(a: number, b: number): number[] {
  const sa = new Set(PEERS[a]);
  return PEERS[b].filter(i => sa.has(i));
}

export function* combinations<T>(arr: readonly T[], k: number): Generator<T[]> {
  if (k <= 0) { yield []; return; }
  for (let i = 0; i <= arr.length - k; i++)
    for (const rest of combinations(arr.slice(i + 1), k - 1)) yield [arr[i], ...rest];
}

export function emptyCells(g: Game): number[] {
  const out: number[] = [];
  for (let i = 0; i < 81; i++) if (g.values[i] === 0) out.push(i);
  return out;
}

export function computeCands(values: number[]): number[] {
  const cands = new Array(81).fill(0);
  for (let i = 0; i < 81; i++) {
    if (values[i] !== 0) continue;
    let m = 0x1ff;
    for (const p of PEERS[i]) if (values[p] !== 0) m &= ~candMask(values[p]);
    cands[i] = m;
  }
  return cands;
}

export function cloneGame(g: Game): Game {
  return { values: g.values.slice(), cands: g.cands.slice(), given: g.given.slice(), solution: g.solution.slice() };
}

export function placeValue(g: Game, cell: number, value: Digit) {
  g.values[cell] = value;
  g.cands[cell] = 0;
  for (const p of PEERS[cell]) g.cands[p] &= ~candMask(value);
}

export function applyStep(g: Game, s: Step) {
  for (const e of s.eliminations) g.cands[e.cell] &= ~candMask(e.cand);
  for (const p of s.placements) placeValue(g, p.cell, p.value);
}

export const isSolved = (g: Game) => g.values.every(v => v !== 0);
