// Stage 1a: node registry + strong-link graph for the chain lens.
// Node keys: candidate = cell*10+digit (11..809); set = 1000+setId.
// Strong links: type 4 (bivalue), type 0 (bilocation), types 1-3 (slices,
// from slices.ts - single-cell sides collapse to candidate nodes).
import { ALL_DIGITS, Game, UNITS, candMask, candsOf } from "./core";
import { buildSliceLinks } from "./slices";
import { enumerateAls } from "./techniques";

export const isSetKey = (k: number) => k >= 1000;
export const alsKey = (alsIndex: number, digit: number) => 3000 + alsIndex * 10 + digit;
export const isAlsKey = (k: number) => k >= 3000;
export const candKey = (cell: number, digit: number) => cell * 10 + digit;
export const keyCell = (k: number) => Math.floor(k / 10);
export const keyDigit = (k: number) => k % 10;

export interface ChainTables {
  strong: Map<number, number[]>;
  sets: { digit: number; cells: number[] }[];
  eriSets: Set<number>;
  alsNodes: { alsIndex: number; digit: number; nodeKey: number; cells: number[] }[];
}

export function buildChainTables(g: Game): ChainTables {
  const strong = new Map<number, number[]>();
  const sets: { digit: number; cells: number[] }[] = [];
  const setIndex = new Map<string, number>();
  const eriSets = new Set<number>();

  const add = (a: number, b: number) => {
    if (!strong.has(a)) strong.set(a, []);
    if (!strong.has(b)) strong.set(b, []);
    const la = strong.get(a)!, lb = strong.get(b)!;
    if (!la.includes(b)) la.push(b);
    if (!lb.includes(a)) lb.push(a);
  };

  // register/reuse a set node; single-cell sets become cand nodes
  const nodeOf = (digit: number, cells: number[]): number => {
    if (cells.length === 1) return candKey(cells[0], digit);
    const key = digit + ":" + cells.slice().sort((x, y) => x - y).join(",");
    let id = setIndex.get(key);
    if (id === undefined) {
      id = 1000 + sets.length;
      sets.push({ digit, cells });
      setIndex.set(key, id);
    }
    return id;
  };

  for (let i = 0; i < 81; i++) {
    if (g.values[i] !== 0) continue;
    const cs = candsOf(g.cands[i]);
    if (cs.length === 2) add(candKey(i, cs[0]), candKey(i, cs[1]));
  }
  for (const d of ALL_DIGITS)
    for (let u = 0; u < 27; u++) {
      const spots = UNITS[u].filter(i => g.values[i] === 0 && g.cands[i] & candMask(d));
      if (spots.length === 2) add(candKey(spots[0], d), candKey(spots[1], d));
    }
  for (const l of buildSliceLinks(g)) {
    const a = nodeOf(l.digit, l.aCells);
    const b = nodeOf(l.digit, l.bCells);
    add(a, b);
    if (l.eriGeometry) {
      if (isSetKey(a)) eriSets.add(a);
      if (isSetKey(b)) eriSets.add(b);
    }
  }
  const alsList = enumerateAls(g);
  const alsNodes: { alsIndex: number; digit: number; nodeKey: number; cells: number[] }[] = [];
  for (let i = 0; i < alsList.length; i++) {
    const als = alsList[i];
    if (als.cells.length === 1) continue; // size-1 implicit as bivalue cand nodes
    for (const d of candsOf(als.mask)) {
      alsNodes.push({ alsIndex: i, digit: d, nodeKey: alsKey(i, d), cells: als.cells });
    }
  }
  // H36b2: intra-ALS strong links - P(i,d1) OR P(i,d2) always true
  // (exactly one digit of the mask is absent => two absents impossible)
  for (let i = 0; i < alsList.length; i++) {
    if (alsList[i].cells.length === 1) continue;
    const ds = candsOf(alsList[i].mask);
    for (let a = 0; a < ds.length; a++)
      for (let b = a + 1; b < ds.length; b++)
        add(alsKey(i, ds[a]), alsKey(i, ds[b]));
  }
  return { strong, sets, eriSets, alsNodes };
}
