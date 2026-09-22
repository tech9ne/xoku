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

// Compute locked set: digits that appear in ≥2 cells of the ALS, where those cells share a unit
function computeLockedSet(als: { cells: number[]; mask: number; byDigit: number[][] }, cands: Uint8Array | number[]): { cells: number[]; digits: number[] } {
  const result: { cells: number[]; digits: number[] } = { cells: [], digits: [] };
  const ds = candsOf(als.mask);
  for (const d of ds) {
    const positions = als.byDigit[d] ?? [];
    if (positions.length >= 2) {
      // Check if all positions share a row
      const row = Math.floor(positions[0] / 9);
      if (positions.every(p => Math.floor(p / 9) === row)) {
        result.cells.push(...positions);
        result.digits.push(d);
        continue;
      }
      // Check if all positions share a column
      const col = positions[0] % 9;
      if (positions.every(p => p % 9 === col)) {
        result.cells.push(...positions);
        result.digits.push(d);
        continue;
      }
      // Check if all positions share a box
      const box = Math.floor(Math.floor(positions[0] / 9) / 3) * 3 + Math.floor((positions[0] % 9) / 3);
      if (positions.every(p => Math.floor(Math.floor(p / 9) / 3) * 3 + Math.floor((p % 9) / 3) === box)) {
        result.cells.push(...positions);
        result.digits.push(d);
        continue;
      }
    }
  }
  return result;
}

export const fastPeers = (a: number, b: number): boolean => {
  const ra = Math.floor(a / 9), ca = a % 9;
  const rb = Math.floor(b / 9), cb = b % 9;
  return (ra === rb) || (ca === cb) || (Math.floor(ra / 3) * 3 + Math.floor(ca / 3) === Math.floor(rb / 3) * 3 + Math.floor(cb / 3));
};
export const candKey = (cell: number, digit: number) => cell * 10 + digit;
export const keyCell = (k: number) => Math.floor(k / 10);
export const keyDigit = (k: number) => k % 10;

export interface ChainTables {
  strong: Map<number, number[]>;
  sets: { digit: number; cells: number[] }[];
  eriSets: Set<number>;
  alsNodes: { alsIndex: number; digit: number; nodeKey: number; cells: number[] }[];
  alsWeak: Map<number, number[]>;
  alsModularViews: Map<string, ALSModularView>;
}

export interface ALSModularView {
  alsLeft: number;      // alsIndex
  alsRight: number;     // alsIndex
  rccDigit: number;     // restricted common digit
  LS_L: { cells: number[]; digits: number[] };  // locked set left
  LS_R: { cells: number[]; digits: number[] };  // locked set right
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
  const alsModularViews = new Map<string, ALSModularView>();
    // H36b3a: precompute ALS weak links (candidate-ALS and ALS-ALS RCC)
  const alsWeak = new Map<number, number[]>();
  for (const node of alsNodes) {
    if (!alsWeak.has(node.nodeKey)) alsWeak.set(node.nodeKey, []);
    // candidate-to-ALS weak link
    for (let c = 0; c < 81; c++) {
      if (g.values[c] !== 0) continue;
      if (node.cells.includes(c)) continue;
      if (!(g.cands[c] & candMask(node.digit))) continue;
      const alsDigitCells = alsList[node.alsIndex].byDigit[node.digit] ?? [];
      if (alsDigitCells.every(ac => fastPeers(c, ac))) {
        const ck = candKey(c, node.digit);
        alsWeak.get(node.nodeKey)!.push(ck);
        if (!alsWeak.has(ck)) alsWeak.set(ck, []);
        alsWeak.get(ck)!.push(node.nodeKey);
      }
    }
    // ALS-to-ALS RCC weak link
    for (let j = node.alsIndex + 1; j < alsList.length; j++) {
      const als2 = alsList[j];
      if (als2.cells.some(c2 => node.cells.includes(c2))) continue;
      if (!(alsList[node.alsIndex].mask & als2.mask & candMask(node.digit))) continue;
      const a1Cells = alsList[node.alsIndex].byDigit[node.digit] ?? [];
      const a2Cells = als2.byDigit[node.digit] ?? [];
      if (a1Cells.every(c1 => a2Cells.every(c2 => fastPeers(c1, c2)))) {
        const nk2 = alsKey(j, node.digit);
        alsWeak.get(node.nodeKey)!.push(nk2);
        if (!alsWeak.has(nk2)) alsWeak.set(nk2, []);
        alsWeak.get(nk2)!.push(node.nodeKey);
        // H36d2: Build modular view for this ALS pair
        const LS_L = computeLockedSet(alsList[node.alsIndex], g.cands);
        const LS_R = computeLockedSet(alsList[j], g.cands);
        if (LS_L.digits.length > 0 || LS_R.digits.length > 0) {
          const viewKey = `${node.alsIndex},${j},${node.digit}`;
          alsModularViews.set(viewKey, {
            alsLeft: node.alsIndex,
            alsRight: j,
            rccDigit: node.digit,
            LS_L,
            LS_R,
          });
        }
      }
    }
  }
  return { strong, sets, eriSets, alsNodes, alsWeak, alsModularViews };
}
