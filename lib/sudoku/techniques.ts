import { matchRule, NodeKind, WeakKind, LinkType } from './naming-table';
import { nodeStr, setNodeStr, bivStr, conclusionStr } from "./notation";
import { chainLens } from "./chain-engine";
import { classifyStormChain } from "./storm-names";
import {
  ALL_DIGITS, Elimination, Game, PEERS, Step, UNITS, UNITS_OF,
  arePeers, boxOf, candMask, candsOf, cellName, colOf, combinations,
  commonPeers, countCands, emptyCells, rowOf, unitName,
} from "./core";

export type Finder = (g: Game) => Step | null;

const mk = (
  s: Omit<Step, "placements" | "eliminations" | "patternCells" | "patternCands"> &
    Partial<Pick<Step, "placements" | "eliminations" | "patternCells" | "patternCands">>
): Step => ({ placements: [], eliminations: [], patternCells: [], patternCands: [], ...s });

// ---------- Singles ----------
export const fullHouse: Finder = (g) => {
  for (let u = 0; u < 27; u++) {
    const empt = UNITS[u].filter(i => g.values[i] === 0);
    if (empt.length !== 1) continue;
    const cell = empt[0];
    const value = ALL_DIGITS.find(d => !UNITS[u].some(i => g.values[i] === d));
    if (!value) continue;
    return mk({
      technique: "Full House", category: "Single", score: 1.0,
      reason: `${cellName(cell)} is the last empty cell in ${unitName(u)}: it must be ${value}.`,
      placements: [{ cell, value }], patternCells: [cell],
    });
  }
  return null;
};

export const nakedSingle: Finder = (g) => {
  for (const i of emptyCells(g)) {
    if (countCands(g.cands[i]) !== 1) continue;
    const d = candsOf(g.cands[i])[0];
    return mk({
      technique: "Naked Single", category: "Single", score: 1.0,
      reason: `${cellName(i)} has only one candidate left (${d}).`,
      placements: [{ cell: i, value: d }],
      patternCells: [i], patternCands: [{ cell: i, cand: d }],
    });
  }
  return null;
};

export const hiddenSingle: Finder = (g) => {
  for (let u = 0; u < 27; u++) {
    const empt = UNITS[u].filter(i => g.values[i] === 0);
    for (const d of ALL_DIGITS) {
      const spots = empt.filter(i => g.cands[i] & candMask(d));
      if (spots.length !== 1) continue;
      return mk({
        technique: "Hidden Single", category: "Single", score: u < 18 ? 1.5 : 1.3,
        reason: `In ${unitName(u)}, ${d} can only go in ${cellName(spots[0])}.`,
        placements: [{ cell: spots[0], value: d }],
        patternCells: spots, patternCands: [{ cell: spots[0], cand: d }],
      });
    }
  }
  return null;
};

// ---------- Locked candidates ----------
export const pointing: Finder = (g) => {
  for (let b = 18; b < 27; b++) {
    for (const d of ALL_DIGITS) {
      const spots = UNITS[b].filter(i => g.values[i] === 0 && g.cands[i] & candMask(d));
      if (spots.length < 2) continue;
      const rows = new Set(spots.map(rowOf)), cols = new Set(spots.map(colOf));
      let target = -1;
      if (rows.size === 1) target = [...rows][0];
      else if (cols.size === 1) target = 9 + [...cols][0];
      else continue;
      const elims = UNITS[target]
        .filter(i => g.values[i] === 0 && g.cands[i] & candMask(d) && boxOf(i) !== b - 18)
        .map((i): Elimination => ({ cell: i, cand: d }));
      if (!elims.length) continue;
      return mk({
        technique: "Locked Candidates Type 1 (Pointing)", category: "Locked Candidates", score: 1.5,
        reason: `In box ${b - 17}, ${d} is confined to ${unitName(target)} — remove ${d} from the rest of ${unitName(target)}.`,
        eliminations: elims, patternCells: spots,
        patternCands: spots.map(i => ({ cell: i, cand: d })),
      });
    }
  }
  return null;
};

export const claiming: Finder = (g) => {
  for (let u = 0; u < 18; u++) {
    for (const d of ALL_DIGITS) {
      const spots = UNITS[u].filter(i => g.values[i] === 0 && g.cands[i] & candMask(d));
      if (spots.length < 2) continue;
      const boxes = new Set(spots.map(boxOf));
      if (boxes.size !== 1) continue;
      const bx = [...boxes][0];
      const elims = UNITS[18 + bx]
        .filter(i => g.values[i] === 0 && g.cands[i] & candMask(d) && !spots.includes(i))
        .map((i): Elimination => ({ cell: i, cand: d }));
      if (!elims.length) continue;
      return mk({
        technique: "Locked Candidates Type 2 (Claiming)", category: "Locked Candidates", score: 1.5,
        reason: `In ${unitName(u)}, ${d} is confined to box ${bx + 1} — remove ${d} from the rest of box ${bx + 1}.`,
        eliminations: elims, patternCells: spots,
        patternCands: spots.map(i => ({ cell: i, cand: d })),
      });
    }
  }
  return null;
};

// ---------- Subsets ----------
const SUBSET_NAMES = ["", "", "Pair", "Triple", "Quad"];

export function makeNakedSubset(n: 2 | 3 | 4): Finder {
  return (g) => {
    for (let u = 0; u < 27; u++) {
      const empt = UNITS[u].filter(i => g.values[i] === 0);
      const eligible = empt.filter(i => { const c = countCands(g.cands[i]); return c >= 2 && c <= n; });
      if (eligible.length < n) continue;
      for (const combo of combinations(eligible, n)) {
        const union = combo.reduce((m, i) => m | g.cands[i], 0);
        if (countCands(union) !== n) continue;
        const digits = candsOf(union);
        const elims: Elimination[] = [];
        for (const i of empt) {
          if (combo.includes(i)) continue;
          for (const d of digits) if (g.cands[i] & candMask(d)) elims.push({ cell: i, cand: d });
        }
        if (!elims.length) continue;
        return mk({
          technique: `Naked ${SUBSET_NAMES[n]}`, category: "Subset",
          score: [0, 0, 2.0, 3.0, 4.0][n],
          reason: `${combo.map(cellName).join(", ")} in ${unitName(u)} contain only ${digits.join("/")} — remove those from the other cells of ${unitName(u)}.`,
          eliminations: elims, patternCells: combo,
          patternCands: combo.flatMap(i => candsOf(g.cands[i]).map(d => ({ cell: i, cand: d }))),
        });
      }
    }
    return null;
  };
}

export function makeHiddenSubset(n: 2 | 3 | 4): Finder {
  return (g) => {
    for (let u = 0; u < 27; u++) {
      const empt = UNITS[u].filter(i => g.values[i] === 0);
      const digitCells = new Map<number, number[]>();
      for (const d of ALL_DIGITS) {
        const spots = empt.filter(i => g.cands[i] & candMask(d));
        if (spots.length >= 2 && spots.length <= n) digitCells.set(d, spots);
      }
      const ds = [...digitCells.keys()];
      if (ds.length < n) continue;
      for (const combo of combinations(ds, n)) {
        const cellSet = new Set<number>();
        for (const d of combo) for (const i of digitCells.get(d)!) cellSet.add(i);
        if (cellSet.size !== n) continue;
        const mask = combo.reduce((m, d) => m | candMask(d), 0);
        const elims: Elimination[] = [];
        for (const i of cellSet)
          for (const d of candsOf(g.cands[i] & ~mask)) elims.push({ cell: i, cand: d });
        if (!elims.length) continue;
        return mk({
          technique: `Hidden ${SUBSET_NAMES[n]}`, category: "Subset",
          score: [0, 0, 2.0, 3.0, 4.0][n],
          reason: `In ${unitName(u)}, ${combo.join("/")} occur only in ${[...cellSet].map(cellName).join(", ")} — remove all other candidates from those cells.`,
          eliminations: elims, patternCells: [...cellSet],
          patternCands: [...cellSet].flatMap(i => candsOf(g.cands[i] & mask).map(d => ({ cell: i, cand: d }))),
        });
      }
    }
    return null;
  };
}

// ---------- Basic fish ----------
const FISH_NAMES = ["", "", "X-Wing", "Swordfish", "Jellyfish"];

export function makeBasicFish(n: 2 | 3 | 4): Finder {
  return (g) => {
    for (const d of ALL_DIGITS) {
      for (const useRows of [true, false]) {
        const posInLine: number[][] = [];
        for (let l = 0; l < 9; l++) {
          const ps: number[] = [];
          for (let x = 0; x < 9; x++) {
            const cell = useRows ? l * 9 + x : x * 9 + l;
            if (g.values[cell] === 0 && g.cands[cell] & candMask(d)) ps.push(x);
          }
          posInLine.push(ps);
        }
        for (const baseLines of combinations([0, 1, 2, 3, 4, 5, 6, 7, 8], n)) {
          const covers = new Set<number>();
          let ok = true;
          for (const l of baseLines) {
            const ps = posInLine[l];
            if (ps.length < 2 || ps.length > n) { ok = false; break; }
            for (const p of ps) covers.add(p);
          }
          if (!ok || covers.size !== n) continue;
          const elims: Elimination[] = [];
          for (const cv of covers) for (let l = 0; l < 9; l++) {
            if (baseLines.includes(l)) continue;
            const cell = useRows ? l * 9 + cv : cv * 9 + l;
            if (g.values[cell] === 0 && g.cands[cell] & candMask(d)) elims.push({ cell, cand: d });
          }
          if (!elims.length) continue;
          const patternCells: number[] = [];
          for (const l of baseLines) for (const p of posInLine[l])
            patternCells.push(useRows ? l * 9 + p : p * 9 + l);
          return mk({
            technique: FISH_NAMES[n], category: "Fish", score: [0, 0, 2.0, 3.0, 4.0][n],
            reason: `${FISH_NAMES[n]} on ${d}: base ${useRows ? "rows" : "columns"} ${baseLines.map(x => x + 1).join("/")} cover ${useRows ? "columns" : "rows"} ${[...covers].map(x => x + 1).join("/")} — remove ${d} from those ${useRows ? "columns" : "rows"} outside the base lines.`,
            eliminations: elims, patternCells,
            patternCands: patternCells.map(c => ({ cell: c, cand: d })),
          });
        }
      }
    }
    return null;
  };
}

export function makeFinnedFish(n: 2 | 3 | 4): Finder {
  return (g) => {
    for (const d of ALL_DIGITS) {
      for (const useRows of [true, false]) {
        const posInLine: number[][] = [];
        for (let l = 0; l < 9; l++) {
          const ps: number[] = [];
          for (let x = 0; x < 9; x++) {
            const cell = useRows ? l * 9 + x : x * 9 + l;
            if (g.values[cell] === 0 && g.cands[cell] & candMask(d)) ps.push(x);
          }
          posInLine.push(ps);
        }
        for (const baseLines of combinations([0, 1, 2, 3, 4, 5, 6, 7, 8], n)) {
          const allPos = [...new Set(baseLines.flatMap(l => posInLine[l]))].sort((a, b) => a - b);
          const extra = allPos.length - n;
          if (extra < 1 || extra > 2) continue;
          for (const coverSubset of combinations(allPos, n)) {
            const covers = new Set(coverSubset);
            const finCols = allPos.filter(p => !covers.has(p));
            const fins: number[] = [];
            for (const l of baseLines) for (const p of posInLine[l])
              if (finCols.includes(p)) fins.push(useRows ? l * 9 + p : p * 9 + l);
            if (!fins.length || fins.length > 2) continue;
            let degenerate = false, emptyBody = false;
            for (const l of baseLines) {
              const inCover = posInLine[l].filter(p => covers.has(p)).length;
              if (inCover === 0) { emptyBody = true; break; }
              if (inCover < 2) degenerate = true;
            }
            if (emptyBody) continue;
            const elims: Elimination[] = [];
            for (const cv of coverSubset) for (let l = 0; l < 9; l++) {
              if (baseLines.includes(l)) continue;
              const cell = useRows ? l * 9 + cv : cv * 9 + l;
              if (g.values[cell] !== 0 || !(g.cands[cell] & candMask(d))) continue;
              if (fins.every(f => fastPeers(cell, f))) elims.push({ cell, cand: d });
            }
            if (!elims.length) continue;
            const present: string[] = [], missing: string[] = [];
            for (const l of baseLines) for (const cv of coverSubset) {
              const cc = useRows ? l * 9 + cv : cv * 9 + l;
              (g.values[cc] === 0 && g.cands[cc] & candMask(d) ? present : missing).push(cellName(cc));
            }
            const technique = `${degenerate ? "Sashimi" : "Finned"} ${FISH_NAMES[n]}`;
            const score = n === 2 ? 2.6 : n === 3 ? 3.5 : 4.5;
            const patternCells = [...new Set(baseLines.flatMap(l => posInLine[l].map(p => useRows ? l * 9 + p : p * 9 + l)))];
            return mk({
              technique, category: "Fish", score,
              reason: `${technique} on ${d}: base ${useRows ? "rows" : "columns"} ${baseLines.map(x => x + 1).join("/")} cover ${useRows ? "columns" : "rows"} ${coverSubset.map(x => x + 1).join("/")} with fin(s) ${fins.map(cellName).join("+")}; body corners ${present.join("+")}${missing.length ? `, missing ${missing.join("+")}` : ""} — cover candidates outside the base that see every fin are removed.`,
              eliminations: elims, patternCells,
              patternCands: patternCells.map(c => ({ cell: c, cand: d })),
              candColors: fins.map(f => ({ cell: f, cand: d, color: 1 })),
            });
          }
        }
      }
    }
    return null;
  };
}
// ---------- Skyscraper / 2-String Kite / Turbot Fish ----------
const unitType = (u: number) => (u < 9 ? "row" : u < 18 ? "col" : "box");

function strongLinks(g: Game, d: number): [number, number, number][] {
  const links: [number, number, number][] = [];
  for (let u = 0; u < 27; u++) {
    const spots = UNITS[u].filter(i => g.values[i] === 0 && g.cands[i] & candMask(d));
    if (spots.length === 2) links.push([spots[0], spots[1], u]);
  }
  return links;
}

function getScoreForLevel(technique: string): number {
  const scores: Record<string, number> = {
    "Skyscraper": 2.6, "2-String Kite": 2.6, "Empty Rectangle": 2.6,
    "X-Wing": 2.0, "X-Chain": 5.0
  };
  return scores[technique] ?? 5.0;
}

export const singleDigitChains: Finder = (g) => {
  for (const d of ALL_DIGITS) {
    const links = strongLinks(g, d);
    for (let a = 0; a < links.length; a++) for (let b = a + 1; b < links.length; b++) {
      const [a1, a2, ua] = links[a], [b1, b2, ub] = links[b];
      if (new Set([a1, a2, b1, b2]).size !== 4) continue;
      for (const [x, fx] of [[a1, a2], [a2, a1]] as const) {
        for (const [y, fy] of [[b1, b2], [b2, b1]] as const) {
          if (!arePeers(x, y)) continue;
          const elims = commonPeers(fx, fy)
            .filter(i => g.values[i] === 0 && g.cands[i] & candMask(d))
            .map((i): Elimination => ({ cell: i, cand: d }));
          if (!elims.length) continue;
          
          // Tag with V/L and LinkType
          const nodes: NodeKind[] = ['L', 'L'];
          const weaks: WeakKind[] = ['s'];
          const linkTypes: LinkType[] = [
            arePeers(a1, a2) ? 0 : 1,
            arePeers(b1, b2) ? 0 : 1
          ];
          const rule = matchRule(nodes, weaks, linkTypes, false);
          const technique = rule?.name ?? "X-Chain";
          const score = rule ? getScoreForLevel(technique) : 5.0;
          
          return mk({
            technique, category: "Single Digit Chain", score,
            candColors: [fx, x, y, fy].map((c, k) => ({ cell: c, cand: d, color: k % 2 })),
            links: [{ from: { cell: fx, cand: d }, to: { cell: x, cand: d }, strong: true }, { from: { cell: x, cand: d }, to: { cell: y, cand: d }, strong: false }, { from: { cell: y, cand: d }, to: { cell: fy, cand: d }, strong: true }],
            reason: `${technique}: ${nodeStr(d, fx)} = ${nodeStr(d, x)} - ${nodeStr(d, y)} = ${nodeStr(d, fy)} => ${conclusionStr(elims)}.`,
            eliminations: elims, patternCells: [x, y, fx, fy],
            patternCands: [x, y, fx, fy].map(c => ({ cell: c, cand: d })),
          });
        }
      }
    }
  }
  return null;
};
export const remotePairs: Finder = (g) => {
  const bi = emptyCells(g).filter(i => countCands(g.cands[i]) === 2);
  const biSet = new Set(bi);
  const adj = new Map<number, number[]>();
  for (const i of bi) adj.set(i, PEERS[i].filter(j => biSet.has(j) && g.cands[j] === g.cands[i]));
  for (const start of bi) {
    const dist = new Map<number, number>([[start, 0]]);
    const parent = new Map<number, number>();
    const queue = [start];
    while (queue.length) {
      const i = queue.shift()!;
      for (const j of adj.get(i)!) if (!dist.has(j)) {
        dist.set(j, dist.get(i)! + 1); parent.set(j, i); queue.push(j);
      }
    }
    const mask = g.cands[start];
    const [p, q] = candsOf(mask);
    for (const [end, dd] of [...dist.entries()]) {
      if (dd < 3 || dd % 2 === 0) continue;
      const elims: Elimination[] = [];
      const seen = new Set<number>();
      for (const [end2, dd] of [...dist.entries()]) {
        if (dd < 1 || dd % 2 === 0) continue;
        for (const [end3, dd3] of [...dist.entries()]) {
          if (dd3 % 2 !== dd % 2 || end2 === end3) continue;
          const pairPeers = commonPeers(end2, end3)
            .filter(i => g.values[i] === 0 && g.cands[i] & mask);
          for (const i of pairPeers) {
            const key = i * 10 + p;
            if (seen.has(key)) continue;
            seen.add(key);
            for (const c of candsOf(g.cands[i] & mask)) elims.push({ cell: i, cand: c });
          }
        }
      }
      if (!elims.length) continue;
      const chain: number[] = [];
      for (let c = end; c !== start; c = parent.get(c)!) chain.unshift(c);
      chain.unshift(start);
      return mk({
        technique: "Remote Pair", category: "Chain", score: 5.0,
        candColors: chain.flatMap((c, k) => [{ cell: c, cand: p, color: k % 2 }, { cell: c, cand: q, color: (k + 1) % 2 }]),
        reason: `Remote Pair: ${chain.map((c, k) => bivStr(k % 2 === 0 ? p : q, k % 2 === 0 ? q : p, c)).join(" - ")} => ${conclusionStr(elims)}.`,
        eliminations: elims, patternCells: chain,
        patternCands: chain.flatMap(i => [{ cell: i, cand: p }, { cell: i, cand: q }]),
      });
    }
  }
  return null;
};

// ---------- Wings ----------
export const xyWing: Finder = (g) => {
  const bi = emptyCells(g).filter(i => countCands(g.cands[i]) === 2);
  for (const p of bi) {
    const [x, y] = candsOf(g.cands[p]);
    for (const z of ALL_DIGITS) {
      if (z === x || z === y) continue;
      const c1 = PEERS[p].filter(i => g.values[i] === 0 && g.cands[i] === (candMask(x) | candMask(z)));
      const c2 = PEERS[p].filter(i => g.values[i] === 0 && g.cands[i] === (candMask(y) | candMask(z)));
      for (const a of c1) for (const b of c2) {
        const elims = commonPeers(a, b)
          .filter(i => g.values[i] === 0 && g.cands[i] & candMask(z))
          .map((i): Elimination => ({ cell: i, cand: z }));
        if (!elims.length) continue;
        return mk({
          technique: "XY-Wing", category: "Wing", score: 3.5,
          candColors: [
            ...candsOf(g.cands[a]).map(d => ({ cell: a, cand: d, color: 0 })),
            ...candsOf(g.cands[p]).map(d => ({ cell: p, cand: d, color: 1 })),
            ...candsOf(g.cands[b]).map(d => ({ cell: b, cand: d, color: 0 })),
          ],
                                                  reason: `XY-Wing: ${bivStr(z, x, a)} - ${bivStr(x, y, p)} - ${bivStr(y, z, b)} => ${conclusionStr(elims)}.`,
          eliminations: elims, patternCells: [p, a, b],
          patternCands: [{ cell: p, cand: x }, { cell: p, cand: y }, { cell: a, cand: x }, { cell: a, cand: z }, { cell: b, cand: y }, { cell: b, cand: z }],
        });
      }
    }
  }
  return null;
};

export const xyzWing: Finder = (g) => {
  for (const p of emptyCells(g)) {
    if (countCands(g.cands[p]) !== 3) continue;
    const ds = candsOf(g.cands[p]);
    for (const z of ds) {
      const [x, y] = ds.filter(d => d !== z);
      const c1 = PEERS[p].filter(i => g.values[i] === 0 && g.cands[i] === (candMask(x) | candMask(z)));
      const c2 = PEERS[p].filter(i => g.values[i] === 0 && g.cands[i] === (candMask(y) | candMask(z)));
      for (const a of c1) for (const b of c2) {
        const elims = commonPeers(p, a)
          .filter(i => arePeers(b, i) && g.values[i] === 0 && g.cands[i] & candMask(z))
          .map((i): Elimination => ({ cell: i, cand: z }));
        if (!elims.length) continue;
        return mk({
          technique: "XYZ-Wing", category: "Wing", score: 3.5,
          candColors: [
            ...candsOf(g.cands[a]).map(d => ({ cell: a, cand: d, color: 0 })),
            ...candsOf(g.cands[p]).map(d => ({ cell: p, cand: d, color: 1 })),
            ...candsOf(g.cands[b]).map(d => ({ cell: b, cand: d, color: 0 })),
          ],
                              reason: `XYZ-Wing: pivot ${cellName(p)} (${x}/${y}/${z}) with pincers ${cellName(a)} and ${cellName(b)} — ${z} must be in the pivot or a pincer.`,
          eliminations: elims, patternCells: [p, a, b],
          patternCands: [{ cell: p, cand: x }, { cell: p, cand: y }, { cell: p, cand: z }, { cell: a, cand: x }, { cell: a, cand: z }, { cell: b, cand: y }, { cell: b, cand: z }],
        });
      }
    }
  }
  return null;
};

export const wWing: Finder = (g) => {
  const bi = emptyCells(g).filter(i => countCands(g.cands[i]) === 2);
  for (let a = 0; a < bi.length; a++) for (let b = a + 1; b < bi.length; b++) {
    const A = bi[a], B = bi[b];
    if (g.cands[A] !== g.cands[B]) continue;
    const [x, y] = candsOf(g.cands[A]);
    for (const d of [x, y]) {
      const o = d === x ? y : x;
      for (let u = 0; u < 27; u++) {
        const spots = UNITS[u].filter(i => g.values[i] === 0 && g.cands[i] & candMask(d));
        if (spots.length !== 2) continue;
        const [s1, s2] = spots;
        if (s1 === A || s1 === B || s2 === A || s2 === B) continue;
        const elims = (arePeers(s1, A) && arePeers(s2, B)) || (arePeers(s2, A) && arePeers(s1, B))
          ? commonPeers(A, B)
              .filter(i => g.values[i] === 0 && g.cands[i] & candMask(o))
              .map((i): Elimination => ({ cell: i, cand: o }))
          : [];
        if (!elims.length) continue;
        return mk({
          technique: "W-Wing", category: "Wing", score: 6.0,
          candColors: (() => {
            const o1 = arePeers(s1, A) && arePeers(s2, B);
            const t1 = o1 ? s1 : s2;
            const t2 = o1 ? s2 : s1;
            return [
              ...candsOf(g.cands[A]).map(d => ({ cell: A, cand: d, color: 0 })),
              { cell: t1, cand: d, color: 1 },
              { cell: t2, cand: d, color: 0 },
              ...candsOf(g.cands[B]).map(d => ({ cell: B, cand: d, color: 1 })),
            ];
          })(),
          links: (() => {
            const o1 = arePeers(s1, A) && arePeers(s2, B);
            const t1 = o1 ? s1 : s2;
            const t2 = o1 ? s2 : s1;
            return [
              { from: { cell: A, cand: o }, to: { cell: A, cand: d }, strong: true },
              { from: { cell: A, cand: d }, to: { cell: t1, cand: d }, strong: false },
              { from: { cell: t1, cand: d }, to: { cell: t2, cand: d }, strong: true },
              { from: { cell: t2, cand: d }, to: { cell: B, cand: d }, strong: false },
              { from: { cell: B, cand: d }, to: { cell: B, cand: o }, strong: true },
            ];
          })(),
                                                  reason: `W-Wing: ${bivStr(o, d, A)} - ${nodeStr(d, arePeers(s1, A) && arePeers(s2, B) ? s1 : s2)} = ${nodeStr(d, arePeers(s1, A) && arePeers(s2, B) ? s2 : s1)} - ${bivStr(d, o, B)} => ${conclusionStr(elims)}.`,
          eliminations: elims, patternCells: [A, B, s1, s2],
          patternCands: [{ cell: A, cand: x }, { cell: A, cand: y }, { cell: B, cand: x }, { cell: B, cand: y }, { cell: s1, cand: d }, { cell: s2, cand: d }],
        });
      }
    }
  }
  return null;
};


// ---------- XY-Chain ----------
export const xyChain: Finder = (g) => {
  const bi = emptyCells(g).filter(i => countCands(g.cands[i]) === 2);
  const biSet = new Set(bi);
  let budget = 150_000;
  for (const start of bi) {
    if (countCands(g.cands[start]) !== 2) continue;
    const [d1, d2] = candsOf(g.cands[start]);
    for (const z of [d1, d2]) {
      const firstOut = d1 === z ? d2 : d1;
      const stack: { cell: number; out: number; path: number[] }[] = [
        { cell: start, out: firstOut, path: [start] },
      ];
      while (stack.length) {
        if (--budget < 0) return null;
        const { cell, out, path } = stack.pop()!;
        for (const j of PEERS[cell]) {
          if (j === start && path.length >= 4) {
            if (out === z) {
              const ringCells = [...path, j];
              const distinctCells = new Set(ringCells).size;
              if (distinctCells < 3) continue; // degenerate: 2 distinct cells = naked pair, not a ring (StormDoku chain.ts:258-259 isRing requires proper closure)
              const inRing = new Set(ringCells);
              const elims: Elimination[] = [];
              const weakPairs: [number, number, number][] = [];
              let incoming = z;
              for (let k = 0; k + 1 < ringCells.length; k++) {
                const aa = ringCells[k], bb = ringCells[k + 1];
                const outgoing = candsOf(g.cands[aa] & g.cands[bb]).find(x => x !== incoming)!;
                weakPairs.push([aa, bb, outgoing]);
                incoming = outgoing;
              }
              for (const [aa, bb, dd] of weakPairs) {
                for (const i of commonPeers(aa, bb)) {
                  if (g.values[i] === 0 && g.cands[i] & candMask(dd)) elims.push({ cell: i, cand: dd });
                }
              }
              if (elims.length === 0) continue;
              const samePair = ringCells.every(c => g.cands[c] === g.cands[start]);
              const technique = samePair ? "Continuous Nice Loop" : (ringCells.length === 4 ? "AIC Ring" : "XY-Chain - ring");
              return mk({
                technique, category: "Chain", score: 5.5,
                candColors: (() => {
                  const nodeColor = new Map<number, number>();
                  let t = 0, inc = z;
                  for (let k = 0; k < ringCells.length - 1; k++) {
                    const outD = weakPairs[k][2];
                    nodeColor.set(ringCells[k] * 10 + inc, t % 2);
                    nodeColor.set(ringCells[k] * 10 + outD, (t + 1) % 2);
                    t += 2; inc = outD;
                  }
                  return [...nodeColor.entries()].map(([key, color]) => ({ cell: Math.floor(key / 10), cand: key % 10, color }));
                })(),
                links: weakPairs.map(([aa, bb, dd]) => ({ from: { cell: aa, cand: dd }, to: { cell: bb, cand: dd }, strong: false })),
                reason: `${technique}: closed XY loop of ${ringCells.length - 1} cells => ${conclusionStr(elims)}.`,
                eliminations: elims, patternCells: ringCells,
                patternCands: ringCells.flatMap(c => candsOf(g.cands[c]).map(d => ({ cell: c, cand: d }))),
              });
            }
          }
          if (countCands(g.cands[j]) === 2 && (g.cands[j] & candMask(out))) {
            const other = candsOf(g.cands[j]).find(dd => dd !== out)!;
            if (path.length < 15) stack.push({ cell: j, out: other, path: [...path, j] });
          }
        }
      }
    }
  }
  return null;
};


// ---------- ALS-XZ (XR 7.0) ----------
// An ALS (Almost Locked Set) is a group of n cells inside one unit whose
// candidates together hold exactly n+1 digits — delete any one digit and the
// set collapses into a naked subset (locked set).
// ALS-XZ: two disjoint ALSs A and B with common candidates X and Z, where X
// is RESTRICTED (every X in A sees every X in B). Then:
//   X true in A   -> X false in B -> B locks -> Z is placed in B
//   X false in A  -> A locks                 -> Z is placed in A
// Either way Z must be true in A or in B, so Z can be removed from any cell
// that sees every Z in A and every Z in B. When Z is restricted too (doubly
// linked), the mirrored argument also removes X from cells seeing every X
// in both sets.

// fast 81x81 peer lookup (arePeers in core is a linear scan; pair loops here
// need it O(1))
const PEER2 = new Uint8Array(81 * 81);
for (let a = 0; a < 81; a++) for (const p of PEERS[a]) PEER2[a * 81 + p] = 1;
const fastPeers = (a: number, b: number) => PEER2[a * 81 + b] === 1;

interface Als { cells: number[]; mask: number; byDigit: number[][]; }
interface AlsRcc {
  A: Als;
  B: Als;
  x: number; // RCC
  z: number; // Z candidate
  lsA: number[]; // cells in A that form the locked set when x is false
  lsB: number[]; // cells in B that form the locked set when x is false
  cSubset: number[]; // cells common to both lsA and lsB
  zRestr: boolean; // is z also restricted?
  elims: Elimination[];
}

function restrictedCommon(A: Als, B: Als, d: number): boolean {
  return A.byDigit[d].every(a => B.byDigit[d].every(b => fastPeers(a, b)));
}

function ccOf(g: Game, cells: number[], d: number): number[] {
  return cells.filter(c => (g.cands[c] & candMask(d)) !== 0);
}
function memOf(g: Game, cells: number[], exclude: number[], color: number) {
  const ex = new Set(exclude);
  return cells.flatMap(c => candsOf(g.cands[c]).filter(d => !ex.has(d)).map(d => ({ cell: c, cand: d, color })));
}

export const alsXZ: Finder = (g) => {
  const empt = emptyCells(g);
  if (empt.length < 4) return null;

  // 1) enumerate ALSs: subsets of each unit's empty cells with |cands| = |cells| + 1
  //    (a single bivalue cell is the size-1 case; duplicates across units are deduped)
  const alsList: Als[] = [];
  const seenKeys = new Set<string>();
  for (let u = 0; u < 27; u++) {
    const cells = UNITS[u].filter(i => g.values[i] === 0);
    const n = cells.length;
    if (n === 0) continue;
    for (let sub = 1; sub < 1 << n; sub++) {
      let mask = 0, size = 0;
      for (let k = 0; k < n; k++) if (sub & (1 << k)) { mask |= g.cands[cells[k]]; size++; }
      if (countCands(mask) !== size + 1) continue;
      const set = cells.filter((_, k) => sub & (1 << k));
      const key = set.join(",");
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const byDigit: number[][] = [];
      for (const d of candsOf(mask)) byDigit[d] = set.filter(c => g.cands[c] & candMask(d));
      alsList.push({ cells: set, mask, byDigit });
    }
  }
  if (alsList.length < 2) return null;

  const mark = new Uint8Array(81); // scratch for the disjointness test

  for (let i = 0; i < alsList.length; i++) {
    const A = alsList[i];
    for (let j = i + 1; j < alsList.length; j++) {
      const B = alsList[j];
      for (const c of B.cells) mark[c] = 1;
      let overlap = false;
      for (const c of A.cells) if (mark[c]) { overlap = true; break; }
      for (const c of B.cells) mark[c] = 0;
      if (overlap) continue;
      if (countCands(A.mask & B.mask) < 2) continue;
      const common = candsOf(A.mask & B.mask);

      for (let xi = 0; xi < common.length; xi++) {
        const x = common[xi];
        if (!restrictedCommon(A, B, x)) continue;
        for (let zi = 0; zi < common.length; zi++) {
          if (zi === xi) continue;
          const z = common[zi];
          const targets = (d: number) =>
            empt.filter(t =>
              g.cands[t] & candMask(d) &&
              A.byDigit[d].every(a => fastPeers(t, a)) &&
              B.byDigit[d].every(b => fastPeers(t, b)))
            .map(t => ({ cell: t, cand: d }));
          const zRestr = restrictedCommon(A, B, z);
          const elims = [...targets(z), ...(zRestr ? targets(x) : [])];
          if (!elims.length) continue;
          const patternCells = [...A.cells, ...B.cells];
          // Build the full ALS_RCC record (for chain integration)
          const lsA = A.cells.filter(c => g.cands[c] & candMask(z));
          const lsB = B.cells.filter(c => g.cands[c] & candMask(z));
          const cSubset = lsA.filter(c => lsB.includes(c));
          const rccRecord: AlsRcc = { A, B, x, z, lsA, lsB, cSubset, zRestr, elims };
          return mk({
            technique: zRestr ? "ALS-XZ (doubly linked)" : "ALS-XZ",
            category: "ALS", score: 7.0,
            candColors: [
            ...ccOf(g, B.cells, z).map(c => ({ cell: c, cand: z, color: 0 })),
            ...ccOf(g, B.cells, x).map(c => ({ cell: c, cand: x, color: 1 })),
            ...ccOf(g, A.cells, x).map(c => ({ cell: c, cand: x, color: 0 })),
            ...ccOf(g, A.cells, z).map(c => ({ cell: c, cand: z, color: 1 })),
            ...memOf(g, A.cells, [x, z], 2),
            ...memOf(g, B.cells, [x, z], 3),
          ],
            reason: `ALS ${A.cells.map(cellName).join("+")} (${candsOf(A.mask).join("/")}) and ALS ${B.cells.map(cellName).join("+")} (${candsOf(B.mask).join("/")}) share restricted candidate ${x}: if ${x} is placed in one set it is removed from the other, locking it and forcing ${z}; if ${x} is false in the first set, that set locks and forces ${z} itself — either way ${z} must be true in one of the two sets${zRestr ? `, and ${x} likewise (doubly linked)` : ""}.`,
            eliminations: elims, patternCells,
            patternCands: patternCells.flatMap(c => candsOf(g.cands[c]).map(d => ({ cell: c, cand: d }))),
          });
        }
      }
    }
  }
  return null;
};

// ---------- AHS-XZ (Almost Hidden Set, dual of ALS) ----------
// An AHS is a group of N digits in one unit whose placement states total N+1.
// A placement state is a cell or a grouped set of cells for one digit.
// AHS-XZ: two disjoint AHSs A and B with common placement state X (restricted),
// and common placement state Z. Either X is true in A or in B, locking the
// other and forcing Z. Z can be removed from cells that see all Z placements
// in both AHSs.
export const ahsXZ: Finder = (g) => {
  const empt = emptyCells(g);
  if (empt.length < 4) return null;
  // Enumerate AHSs: for each unit and digit, collect cells where that digit
  // is a candidate. If |cells| = |digits_in_cells| + 1, it's an AHS.
  interface Ahs { cells: number[]; digits: number[]; unit: number; }
  const ahsList: Ahs[] = [];
  for (let u = 0; u < 27; u++) {
    const cells = UNITS[u].filter(i => g.values[i] === 0);
    for (let sub = 1; sub < (1 << cells.length); sub++) {
      const set = cells.filter((_, k) => sub & (1 << k));
      let mask = 0;
      for (const c of set) mask |= g.cands[c];
      const digits = candsOf(mask);
      if (digits.length === set.length + 1) {
        ahsList.push({ cells: set, digits, unit: u });
      }
    }
  }
  if (ahsList.length < 2) return null;
  // Look for two AHSs with a restricted common placement state
  for (let i = 0; i < ahsList.length; i++) {
    const A = ahsList[i];
    for (let j = i + 1; j < ahsList.length; j++) {
      const B = ahsList[j];
      if (A.unit === B.unit) continue; // must be in different units
      const common = A.digits.filter(d => B.digits.includes(d));
      if (common.length < 2) continue;
      // Check if one common digit is restricted (all placements in A see all in B)
      for (const x of common) {
        const xA = A.cells.filter(c => g.cands[c] & candMask(x));
        const xB = B.cells.filter(c => g.cands[c] & candMask(x));
        const xRestr = xA.every(a => xB.every(b => fastPeers(a, b)));
        if (!xRestr) continue;
        // Find a second common digit z
        for (const z of common) {
          if (z === x) continue;
          const zA = A.cells.filter(c => g.cands[c] & candMask(z));
          const zB = B.cells.filter(c => g.cands[c] & candMask(z));
          // Eliminate z from cells seeing all z placements in both AHSs
          const elims = empt
            .filter(t => (g.cands[t] & candMask(z)) !== 0 && zA.every(a => fastPeers(t, a)) && zB.every(b => fastPeers(t, b)))
            .map(t => ({ cell: t, cand: z }));
          if (elims.length === 0) continue;
          const patternCells = [...A.cells, ...B.cells];
          const isWXYZ = (A.cells.length === 1 && countCands(g.cands[A.cells[0]]) === 2 && B.cells.length === 3) ||
            (B.cells.length === 1 && countCands(g.cands[B.cells[0]]) === 2 && A.cells.length === 3);
          return mk({
            technique: isWXYZ ? "WXYZ-Wing" : "AHS-XZ",
            category: "ALS", score: isWXYZ ? 4.8 : 7.0,
            candColors: [
              ...zB.map(c => ({ cell: c, cand: z, color: 0 })),
              ...xB.map(c => ({ cell: c, cand: x, color: 1 })),
              ...xA.map(c => ({ cell: c, cand: x, color: 0 })),
              ...zA.map(c => ({ cell: c, cand: z, color: 1 })),
            ],
            reason: isWXYZ ? `WXYZ-Wing: hinge ${A.cells.length === 1 ? cellName(A.cells[0]) : cellName(B.cells[0])} with wings ${A.cells.length === 1 ? B.cells.map(cellName).join(", ") : A.cells.map(cellName).join(", ")} — restricted common ${x} between hinge and wings forces ${z} into the structure` : `AHS ${A.cells.map(cellName).join("+")} (digits ${A.digits.join("")}) and AHS ${B.cells.map(cellName).join("+")} (digits ${B.digits.join("")}) share restricted placement state ${x}: if ${x} is placed in one set it is removed from the other, locking it and forcing ${z}; if ${x} is false in the first set, that set locks and forces ${z} itself — either way ${z} must be true in one of the two sets.`,
            eliminations: elims, patternCells,
            patternCands: patternCells.flatMap(c => candsOf(g.cands[c]).map(d => ({ cell: c, cand: d }))),
          });
        }
      }
    }
  }
  return null;
};
// ---------- Shared ALS infrastructure ----------
// (alsXZ keeps its own enumeration; the rest of the ALS family uses these.)
function enumerateAls(g: Game): Als[] {
  const alsList: Als[] = [];
  const seenKeys = new Set<string>();
  for (let u = 0; u < 27; u++) {
    const cells = UNITS[u].filter(i => g.values[i] === 0);
    const n = cells.length;
    if (n === 0) continue;
    for (let sub = 1; sub < 1 << n; sub++) {
      let mask = 0, size = 0;
      for (let k = 0; k < n; k++) if (sub & (1 << k)) { mask |= g.cands[cells[k]]; size++; }
      if (countCands(mask) !== size + 1) continue;
      const set = cells.filter((_, k) => sub & (1 << k));
      const key = set.join(",");
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const byDigit: number[][] = [];
      for (const d of candsOf(mask)) byDigit[d] = set.filter(c => g.cands[c] & candMask(d));
      alsList.push({ cells: set, mask, byDigit });
    }
  }
  return alsList;
}

function makeOverlap() {
  const mark = new Uint8Array(81);
  return (A: Als, B: Als): boolean => {
    for (const c of B.cells) mark[c] = 1;
    let hit = false;
    for (const c of A.cells) if (mark[c]) { hit = true; break; }
    for (const c of B.cells) mark[c] = 0;
    return hit;
  };
}

// graph of disjoint ALS pairs linked by restricted common candidates
function alsGraph(als: Als[]): { j: number; d: number }[][] {
  const overlap = makeOverlap();
  const nb: { j: number; d: number }[][] = als.map(() => [] as { j: number; d: number }[]);
  for (let i = 0; i < als.length; i++) {
    for (let j = i + 1; j < als.length; j++) {
      if (overlap(als[i], als[j])) continue;
      const common = als[i].mask & als[j].mask;
      if (!common) continue;
      for (const d of candsOf(common)) {
        if (restrictedCommon(als[i], als[j], d)) {
          nb[i].push({ j, d });
          nb[j].push({ j: i, d });
        }
      }
    }
  }
  return nb;
}

// ---------- ALS-XY-Wing (XR 7.2) ----------
// Three pairwise-disjoint ALSs: pivot A, pincers B and C.
//   A and B share restricted candidate X, A and C share restricted
//   candidate Y (Y <> X), B and C share candidate Z (Z not in {X, Y}).
//   X true in A  -> X false in B -> B locks -> Z placed in B
//   X false in A -> A locks -> Y placed in A -> Y false in C -> C locks -> Z placed in C
// Either way Z is placed in a pincer -> Z is removed from cells seeing
// every Z in B and every Z in C.
// ---------- Sue de Coq (ALS DOF family, per StrmCkr: NOT an ALS-XZ 2-RCC rule) ----------
// Core = cells at box/line intersection; two disjoint ALS flanks (one in the
// box outside the line, one in the line outside the box) whose digits partition
// the core's digits, with |digits(core)| = |core| + |A| + |B|.
export const sueDeCoq: Finder = (g) => {
  const empt = emptyCells(g);
  if (empt.length < 5) return null;
  const regionAls = (cells: number[]) => {
    const out: { cells: number[]; mask: number }[] = [];
    const n = cells.length;
    for (let sub = 1; sub < (1 << n); sub++) {
      let mask = 0, size = 0;
      for (let k = 0; k < n; k++) if (sub & (1 << k)) { mask |= g.cands[cells[k]]; size++; }
      if (size < 1 || size > 2) continue;
      if (countCands(mask) !== size + 1) continue;
      out.push({ cells: cells.filter((_, k) => sub & (1 << k)), mask });
    }
    return out;
  };
  for (let b = 0; b < 9; b++) {
    const br = Math.floor(b / 3) * 3, bc = (b % 3) * 3;
    for (let li = 0; li < 3; li++) for (const orient of [0, 1]) {
      const line = orient === 0 ? br + li : bc + li;
      const unit = orient === 0 ? line : 9 + line;
      const inLine = (c: number) => (orient === 0 ? rowOf(c) === line : colOf(c) === line);
      const core0 = UNITS[18 + b].filter(c => g.values[c] === 0 && inLine(c));
      const boxSide = UNITS[18 + b].filter(c => g.values[c] === 0 && !inLine(c));
      const lineSide = UNITS[unit].filter(c => g.values[c] === 0 && boxOf(c) !== b);
      if (!core0.length || !boxSide.length || !lineSide.length) continue;
      const As = regionAls(boxSide), Bs = regionAls(lineSide);
      for (let cs = 1; cs < (1 << core0.length); cs++) {
        const core = core0.filter((_, k) => cs & (1 << k));
        let maskCore = 0;
        for (const c of core) maskCore |= g.cands[c];
        const dCore = candsOf(maskCore);
        for (const A of As) {
          if (A.mask & ~maskCore) continue;
          for (const B of Bs) {
            if (B.mask & ~maskCore) continue;
            if (B.mask & A.mask) continue;
            if ((A.mask | B.mask) !== maskCore) continue;
            if (dCore.length !== core.length + A.cells.length + B.cells.length) continue;
            const elims: Elimination[] = [];
            const aSet = new Set(A.cells), bSet = new Set(B.cells);
            const dA = candsOf(A.mask), dB = candsOf(B.mask);
            for (const c of boxSide) if (!aSet.has(c)) for (const d of dA) if (g.cands[c] & candMask(d)) elims.push({ cell: c, cand: d });
            for (const c of lineSide) if (!bSet.has(c)) for (const d of dB) if (g.cands[c] & candMask(d)) elims.push({ cell: c, cand: d });
            if (!elims.length) continue;
            return mk({
              technique: "Sue de Coq", category: "ALS DOF", score: 8.5,
              reason: `Sue de Coq: core ${core.map(cellName).join("+")} holds digits ${dCore.join("")}, split between box flank ${A.cells.map(cellName).join("+")} (${dA.join("")}) and line flank ${B.cells.map(cellName).join("+")} (${dB.join("")}) — box cells outside the line lose the box flank digits, line cells outside the box lose the line flank digits.`,
              eliminations: elims,
              patternCells: [...core, ...A.cells, ...B.cells],
              patternCands: [...core, ...A.cells, ...B.cells].flatMap(c => candsOf(g.cands[c]).map(d => ({ cell: c, cand: d }))),
              candColors: [
                ...core.flatMap(c => candsOf(g.cands[c]).map(d => ({ cell: c, cand: d, color: 0 }))),
                ...A.cells.flatMap(c => candsOf(g.cands[c]).map(d => ({ cell: c, cand: d, color: 1 }))),
                ...B.cells.flatMap(c => candsOf(g.cands[c]).map(d => ({ cell: c, cand: d, color: 2 }))),
              ],
            });
          }
        }
      }
    }
  }
  return null;
};
export const alsXYWing: Finder = (g) => {
  const als = enumerateAls(g);
  if (als.length < 3) return null;
  const empt = emptyCells(g);
  const nb = alsGraph(als);
  const overlap = makeOverlap();

  for (let i = 0; i < als.length; i++) {
    const A = als[i];
    for (const nbB of nb[i]) {
      const B = als[nbB.j];
      const X = nbB.d;
      for (const nbC of nb[i]) {
        if (nbC.j === nbB.j) continue;
        const C = als[nbC.j];
        const Y = nbC.d;
        if (Y === X) continue;
        if (overlap(B, C)) continue;
        const zs = B.mask & C.mask & ~(candMask(X) | candMask(Y));
        if (!zs) continue;
        for (const Z of candsOf(zs)) {
          const elims = empt.filter(t =>
            g.cands[t] & candMask(Z) &&
            B.byDigit[Z].every(b => fastPeers(t, b)) &&
            C.byDigit[Z].every(c => fastPeers(t, c)))
            .map(t => ({ cell: t, cand: Z }));
          if (!elims.length) continue;
          const patternCells = [...A.cells, ...B.cells, ...C.cells];
          return mk({
            technique: "ALS-XY-Wing", category: "ALS", score: 8.0,
            candColors: [
            ...A.cells.flatMap(c => candsOf(g.cands[c]).map(d => ({ cell: c, cand: d, color: 0 }))),
            ...B.cells.flatMap(c => candsOf(g.cands[c]).map(d => ({ cell: c, cand: d, color: 1 }))),
            ...C.cells.flatMap(c => candsOf(g.cands[c]).map(d => ({ cell: c, cand: d, color: 0 }))),
          ],
            reason: `Pivot ALS ${A.cells.map(cellName).join("+")} (${candsOf(A.mask).join("/")}) is linked by restricted candidate ${X} to pincer ${B.cells.map(cellName).join("+")} and by restricted ${Y} to pincer ${C.cells.map(cellName).join("+")}. If ${X} is true in the pivot, the first pincer locks and must place ${Z}; if ${X} is false, the pivot locks, places ${Y}, and the second pincer must place ${Z}. Either way ${Z} is placed in one of the pincers — removed from cells seeing all of it in both.`,
            eliminations: elims, patternCells,
            patternCands: patternCells.flatMap(c => candsOf(g.cands[c]).map(d => ({ cell: c, cand: d }))),
          });
        }
      }
    }
  }
  return null;
};

// ---------- ALS Chain (XR 7.4) ----------
// Three or more pairwise-disjoint ALSs linked by restricted common
// candidates: A1 -x1- A2 -x2- ... - An, consecutive links on different
// digits. If Z (<> x1) were false throughout A1, A1 would lock and place
// x1; that kills x1 in A2, which locks and places x2; ... until An locks
// and places Z (Z <> x_{n-1}). So Z must be true in A1 or in An, and Z is
// removed from cells seeing every Z in both end sets.
// ---------- WXYZ-Wing (BARNS size 4, 1 RCC) ----------
// A 4-cell ALS chain with 4 digits {W,X,Y,Z} and 1 restricted common.
// Structure: hinge cell (3-4 digits) + 3 bivalue wings forming a chain.
// RCC is restricted between hinge and one wing; eliminations are the
// other restricted digit from cells seeing all instances in the structure.
export const wxyzWing: Finder = (g) => {
  const empt = emptyCells(g);
  if (empt.length < 4) return null;
  // Find all bivalue cells
  const bi = empt.filter(i => countCands(g.cands[i]) === 2);
  // Find cells with 3-4 candidates (potential hinges)
  const hinges = empt.filter(i => {
    const c = countCands(g.cands[i]);
    return c === 3 || c === 4;
  });
  for (const h of hinges) {
    const hDigits = candsOf(g.cands[h]);
    if (hDigits.length < 3) continue;
    // Try all combinations of 3 bivalue wings seeing the hinge
    for (let i = 0; i < bi.length; i++) {
      const w1 = bi[i];
      if (!fastPeers(h, w1)) continue;
      for (let j = i + 1; j < bi.length; j++) {
        const w2 = bi[j];
        if (!fastPeers(w1, w2) || !fastPeers(h, w2)) continue;
        for (let k = j + 1; k < bi.length; k++) {
          const w3 = bi[k];
          if (!fastPeers(w2, w3)) continue;
          const wings = [w1, w2, w3];
          const allCells = [h, ...wings];
          let mask = 0;
          for (const c of allCells) mask |= g.cands[c];
          const digits = candsOf(mask);
          if (digits.length !== 4) continue;
          // Check if this forms a valid WXYZ-Wing:
          // - Hinge has 3-4 of the digits
          // - Each wing is bivalue
          // - There's a restricted common (RCC) between hinge and w1
          // - Eliminations are the digit restricted between w2 and w3
          const hCands = g.cands[h];
          const w1Cands = g.cands[w1];
          const w2Cands = g.cands[w2];
          const w3Cands = g.cands[w3];
          // Find RCC: digit in both h and w1 that's restricted
          let rcc = -1;
          for (const d of candsOf(hCands & w1Cands)) {
            // Check if d is restricted (all h's d see all w1's d)
            // Since they're single cells, they see each other if peers
            if (fastPeers(h, w1)) {
              rcc = d;
              break;
            }
          }
          if (rcc === -1) continue;
          // Find elimination digit: digit in w3 that's not in w2
          const elimDig = candsOf(w3Cands & ~w2Cands);
          if (elimDig.length !== 1) continue;
          const z = elimDig[0];
          // Eliminate z from cells seeing all z in the structure
          const zCells = allCells.filter(c => g.cands[c] & candMask(z));
          const elims = empt
            .filter(t => (g.cands[t] & candMask(z)) !== 0 && zCells.every(zc => fastPeers(t, zc)))
            .map(t => ({ cell: t, cand: z }));
          if (elims.length === 0) continue;
          return mk({
            technique: "WXYZ-Wing",
            category: "Wing", score: 4.5,
            candColors: allCells.flatMap((c, idx) =>
              candsOf(g.cands[c]).map(d => ({ cell: c, cand: d, color: idx }))
            ),
            reason: `WXYZ-Wing: hinge ${cellName(h)} (${hDigits.join("")}) with wings ${wings.map(cellName).join(", ")} (${w1Cands}, ${w2Cands}, ${w3Cands}) — restricted common ${rcc} between hinge and first wing forces ${z} to be placed in one of the wings, so ${z} can be removed from cells seeing all ${z} in the structure.`,
            eliminations: elims,
            patternCells: allCells,
            patternCands: allCells.flatMap(c => candsOf(g.cands[c]).map(d => ({ cell: c, cand: d }))),
          });
        }
      }
    }
  }
  return null;
};
export const alsChain: Finder = (g) => {
  const als = enumerateAls(g);
  if (als.length < 3) return null;
  const empt = emptyCells(g);
  const nb = alsGraph(als);
  let budget = 120_000;

  for (let s = 0; s < als.length; s++) {
    const A1 = als[s];
    for (const Z of candsOf(A1.mask)) {
      const stack: { cur: number; via: number; path: number[]; cells: Set<number>; vias: number[] }[] = [];
      for (const e of nb[s]) {
        if (e.d === Z) continue; // first link must differ from Z
        const cells = new Set<number>([...A1.cells, ...als[e.j].cells]);
        stack.push({ cur: e.j, via: e.d, path: [s, e.j], cells, vias: [e.d] });
      }
      while (stack.length) {
        if (--budget < 0) return null;
        const { cur, via, path, cells, vias } = stack.pop()!;
        const curAls = als[cur];

        // closed chain: current set holds Z and Z is not its entry digit
        if (path.length >= 3 && (curAls.mask & candMask(Z)) && via !== Z) {
          const elims = empt.filter(t =>
            g.cands[t] & candMask(Z) &&
            A1.byDigit[Z].every(a => fastPeers(t, a)) &&
            curAls.byDigit[Z].every(a => fastPeers(t, a)))
            .map(t => ({ cell: t, cand: Z }));
          if (elims.length) {
            const patternCells = path.flatMap(p => als[p].cells);
            return mk({
              technique: "ALS Chain", category: "ALS", score: 10.0,
                            candColors: (() => {
                const spine: { cell: number; cand: number; color: number }[] = [];
                path.forEach((p, k) => {
                  const parity = k % 2;
                  spine.push(...als[p].cells.flatMap(c => candsOf(g.cands[c]).map(d => ({ cell: c, cand: d, color: parity }))));
                });
                return spine;
              })(),
              reason: `ALS chain ${path.map(p => als[p].cells.map(cellName).join("+")).join(" -> ")}: if ${Z} were false throughout the first set it would lock, and the restricted links force each following set to lock in turn until the last set places ${Z} — so ${Z} must be true in one of the end sets and is removed from cells seeing all of it in both.`,
              eliminations: elims, patternCells,
              patternCands: patternCells.flatMap(c => candsOf(g.cands[c]).map(d => ({ cell: c, cand: d }))),
            });
          }
        }

        if (path.length >= 6) continue;
        for (const e of nb[cur]) {
          if (e.d === via) continue;        // consecutive links use different digits
          if (path.includes(e.j)) continue; // no set repeated
          if (als[e.j].cells.some(c => cells.has(c))) continue; // pairwise disjoint
          const ncells = new Set(cells);
          for (const c of als[e.j].cells) ncells.add(c);
          stack.push({ cur: e.j, via: e.d, path: [...path, e.j], cells: ncells, vias: [...vias, e.d] });
        }
      }
    }
  }
  return null;
};

// ---------- Death Blossom (XR 7.6) ----------
// A bivalue stem cell {x, y} plus two petals: ALS A containing x such that
// the stem sees every x in A, and ALS B containing y such that the stem
// sees every y in B, plus a common petal digit Z (Z not in {x, y}):
//   stem = x -> x false in A -> A locks -> Z placed in A
//   stem = y -> y false in B -> B locks -> Z placed in B
// Z must be true in one petal -> removed from cells seeing every Z in both.
export const deathBlossom: Finder = (g) => {
  const als = enumerateAls(g);
  if (als.length < 2) return null;
  const empt = emptyCells(g);

  for (const S of empt) {
    if (countCands(g.cands[S]) !== 2) continue;
    const [x, y] = candsOf(g.cands[S]);
    const petX = als.filter(a =>
      a.mask & candMask(x) && !a.cells.includes(S) &&
      a.byDigit[x].every(c => fastPeers(S, c)));
    const petY = als.filter(a =>
      a.mask & candMask(y) && !a.cells.includes(S) &&
      a.byDigit[y].every(c => fastPeers(S, c)));
    if (!petX.length || !petY.length) continue;
    for (const A of petX) for (const B of petY) {
      const zs = A.mask & B.mask & ~(candMask(x) | candMask(y));
      if (!zs) continue;
      for (const Z of candsOf(zs)) {
        const elims = empt.filter(t =>
          g.cands[t] & candMask(Z) &&
          A.byDigit[Z].every(a => fastPeers(t, a)) &&
          B.byDigit[Z].every(b => fastPeers(t, b)))
          .map(t => ({ cell: t, cand: Z }));
        if (!elims.length) continue;
        const patternCells = [S, ...A.cells, ...B.cells];
        return mk({
          technique: "Death Blossom", category: "ALS DOF", score: 9.0,
          candColors: [
            ...ccOf(g, A.cells, Z).map(c => ({ cell: c, cand: Z, color: 0 })),
            ...ccOf(g, A.cells, x).map(c => ({ cell: c, cand: x, color: 1 })),
            ...ccOf(g, [S], x).map(c => ({ cell: c, cand: x, color: 0 })),
            ...ccOf(g, [S], y).map(c => ({ cell: c, cand: y, color: 1 })),
            ...ccOf(g, B.cells, y).map(c => ({ cell: c, cand: y, color: 0 })),
            ...ccOf(g, B.cells, Z).map(c => ({ cell: c, cand: Z, color: 1 })),
            ...memOf(g, A.cells, [Z, x], 2),
            ...memOf(g, [S], [x, y], 3),
            ...memOf(g, B.cells, [Z, y], 4),
          ],
          reason: `Stem ${cellName(S)} (${x}/${y}) with petals ${A.cells.map(cellName).join("+")} and ${B.cells.map(cellName).join("+")}: the stem is ${x} or ${y}; either way one petal loses its link digit, locks, and must place ${Z} — so ${Z} is removed from cells seeing all of it in both petals.`,
          eliminations: elims, patternCells,
          patternCands: patternCells.flatMap(c => candsOf(g.cands[c]).map(d => ({ cell: c, cand: d }))),
        });
      }
    }
  }
  return null;
};

// ---------- AIC engine: X-Chain (XR 5.8), AIC Types 1 and 2 (6.2-6.4) ----------
// Nodes are candidates (cell + digit). Links:
//   STRONG (at least one endpoint true): bivalue cells, or a digit with
//   exactly two positions left in a unit (bilocation)
//   WEAK (not both true): same digit in cells that see each other, or two
//   different candidates in the same cell
// An alternating chain  strong - weak - strong - ... - strong  (even number
// of nodes) proves that at least one of its two end nodes is true:
//   Type 1: ends are the same digit in different cells -> that digit is
//   removed from every cell seeing both end cells (X-Chain if single-digit)
//   Type 2: ends are different candidates ->
//     same cell: the cell holds one of them, all other candidates removed
//     cells that see each other: neither can hold the other's digit (that
//     would force both cells to the same digit), so each end digit is
//     removed from the other end cell
function findAic(g: Game, mode: "xchain" | "type1" | "type2"): Step | null {
  const empt = emptyCells(g);
  if (empt.length < 4) return null;

  const nodeCell = (n: number) => Math.floor(n / 10);
  const nodeDigit = (n: number) => n % 10;
  const nodeName = (n: number) => nodeStr(nodeDigit(n), nodeCell(n));
  const chainStr = (path: number[]) => {
    // folded: same-cell strong pairs become (d1 = d2)cell tokens
    const tokens: { text: string; endIdx: number }[] = [];
    let k = 0;
    while (k < path.length) {
      if (k + 1 < path.length && nodeCell(path[k + 1]) === nodeCell(path[k])) {
        // Pair-truth test (the hierarchy):
        //   trivalue+ cell: every internal pair is WEAK-only (a pair can
        //     never guarantee "at least one true")
        //   bivalue cell: the pair is DUAL-NATURED - strong ("at least one
        //     true") and weak ("not both true") - and the chain's parity
        //     decides which face it serves in THIS chain
        // Connector = parity role if the pair can bear it, else weak.
        const c = nodeCell(path[k]);
        const d1 = nodeDigit(path[k]), d2 = nodeDigit(path[k + 1]);
        const pairIsBivalue = countCands(g.cands[c]) === 2 &&
          g.cands[c] === (candMask(d1) | candMask(d2));
        const connector = k % 2 === 0 && pairIsBivalue ? "=" : "-";
        if (k % 2 === 0 && !pairIsBivalue)
          throw new Error(`strong-position fold on non-bivalue pair at ${cellName(c)} - invalid chain`);
        tokens.push({ text: `(${d1} ${connector} ${d2})${cellName(c)}`, endIdx: k + 1 });
        k += 2;
      } else {
        tokens.push({ text: nodeName(path[k]), endIdx: k });
        k += 1;
      }
    }
    const parts: string[] = [tokens[0].text];
    for (let t = 0; t + 1 < tokens.length; t++) {
      parts.push(tokens[t].endIdx % 2 === 0 ? " = " : " - ");
      parts.push(tokens[t + 1].text);
    }
    return parts.join("");
  };

  // strong-link adjacency: bivalue cells + bilocation pairs
  const strong = new Map<number, number[]>();
  const addStrong = (a: number, b: number) => {
    if (!strong.has(a)) strong.set(a, []);
    if (!strong.has(b)) strong.set(b, []);
    const la = strong.get(a)!, lb = strong.get(b)!;
    if (!la.includes(b)) la.push(b);
    if (!lb.includes(a)) lb.push(a);
  };
  for (const i of empt) {
    const cs = candsOf(g.cands[i]);
    if (cs.length === 2) addStrong(i * 10 + cs[0], i * 10 + cs[1]);
  }
  for (let u = 0; u < 27; u++)
    for (let d = 1; d <= 9; d++) {
      const spots = UNITS[u].filter(i => g.values[i] === 0 && g.cands[i] & candMask(d));
      if (spots.length === 2) addStrong(spots[0] * 10 + d, spots[1] * 10 + d);
    }
  if (strong.size === 0) return null;

  let budget = 100_000;

  for (const i of empt) {
    for (const d of candsOf(g.cands[i])) {
      const start = i * 10 + d;
      const stack: { cur: number; path: number[] }[] = [];
      for (const n2 of strong.get(start) ?? []) {
        if (mode === "xchain" && nodeDigit(n2) !== d) continue;
        stack.push({ cur: n2, path: [start, n2] });
      }
      while (stack.length) {
        if (--budget < 0) return null;
        const { cur, path } = stack.pop()!;
        // ---- ring closure: weak inference from cur back to start ----
        // checked before open-chain endings so ring owns the report.
        if (path.length >= 4 && path.length % 2 === 0) {
          const sCell = i, sDig = d;
          const cCell = nodeCell(cur), cDig = nodeDigit(cur);
          const weakBack =
            (cCell === sCell && cDig !== sDig) ||
            (cDig === sDig && cCell !== sCell && fastPeers(cCell, sCell));
          if (weakBack) {
            const allSameDigit = path.every(n => nodeDigit(n) === sDig);
            const ringCells = new Set(path.map(nodeCell));
            ringCells.add(sCell);
            const ringEdges: [number, number][] = [];
            for (let k = 0; k + 1 < path.length; k++) ringEdges.push([nodeCell(path[k]), nodeCell(path[k + 1])]);
            ringEdges.push([cCell, sCell]);
            const elims: Elimination[] = [];
            if (allSameDigit) {
              for (const [a, b] of ringEdges) {
                if (a === b) continue;
                for (const t of commonPeers(a, b)) {
                  if (ringCells.has(t)) continue;
                  if (g.values[t] === 0 && g.cands[t] & candMask(sDig)) elims.push({ cell: t, cand: sDig });
                }
              }
              const seenK = new Set<number>();
              const uniq = elims.filter(e => {
                const kk = e.cell * 10 + e.cand;
                if (seenK.has(kk)) return false;
                seenK.add(kk);
                return true;
              });
              if (uniq.length) {
                return mk({
                  technique: classifyStormChain(path, true), category: "Single Digit Chain", score: 5.5,
                  candColors: path.map((n, k) => ({ cell: nodeCell(n), cand: nodeDigit(n), color: k % 2 })),
                  links: path.slice(0, -1).map((n, k) => ({ from: { cell: nodeCell(n), cand: nodeDigit(n) }, to: { cell: nodeCell(path[k + 1]), cand: nodeDigit(path[k + 1]) }, strong: k % 2 === 0 })),
                  reason: `L(1)-Ring: closed loop on digit ${sDig} => ${conclusionStr(uniq)}.`,
                  eliminations: uniq,
                  patternCells: [...new Set(path.map(nodeCell))],
                  patternCands: path.map(n => ({ cell: nodeCell(n), cand: nodeDigit(n) })),
                });
              }
            } else {
              for (let k = 0; k < ringEdges.length; k++) {
                const [a, b] = ringEdges[k];
                const idxInPath = k;
                const nA = idxInPath < path.length ? nodeDigit(path[idxInPath]) : sDig;
                const nB = idxInPath + 1 < path.length ? nodeDigit(path[idxInPath + 1]) : cDig;
                if (a === b) {
                  for (const q of candsOf(g.cands[a])) {
                    if (q === nA || q === nB) continue;
                    elims.push({ cell: a, cand: q });
                  }
                  continue;
                }
                if (nA === nB) {
                  for (const t of commonPeers(a, b)) {
                    if (ringCells.has(t)) continue;
                    if (g.values[t] === 0 && g.cands[t] & candMask(nA)) elims.push({ cell: t, cand: nA });
                  }
                } else if (fastPeers(a, b)) {
                  if (g.cands[a] & candMask(nB)) elims.push({ cell: a, cand: nB });
                  if (g.cands[b] & candMask(nA)) elims.push({ cell: b, cand: nA });
                }
              }
              const seenK = new Set<number>();
              const uniq = elims.filter(e => {
                const kk = e.cell * 10 + e.cand;
                if (seenK.has(kk)) return false;
                seenK.add(kk);
                return true;
              });
              if (uniq.length) {
                const techName = mode === "type1" ? "AIC Type 1 - ring" : "AIC Type 2 - ring";
                return mk({
                  technique: techName, category: "Chain", score: 5.0,
                  candColors: path.map((n, k) => ({ cell: nodeCell(n), cand: nodeDigit(n), color: k % 2 })),
                  links: path.slice(0, -1).map((n, k) => ({ from: { cell: nodeCell(n), cand: nodeDigit(n) }, to: { cell: nodeCell(path[k + 1]), cand: nodeDigit(path[k + 1]) }, strong: k % 2 === 0 })),
                  reason: `${techName}: closed loop => ${conclusionStr(uniq)}.`,
                  eliminations: uniq,
                  patternCells: [...new Set(path.map(nodeCell))],
                  patternCands: path.map(n => ({ cell: nodeCell(n), cand: nodeDigit(n) })),
                });
              }
            }
          }
        }
        const strongArrived = path.length % 2 === 0;

        // ---- endings: only on strong arrivals, chains of 6+ nodes ----
        if (strongArrived && path.length >= 6) {
          const allSameDigit = path.every(n => nodeDigit(n) === d);
          const sameDigit = nodeDigit(cur) === d;
          const sameCell = nodeCell(cur) === i;
          // true when every strong link is within one cell (XY-Chain shape)
          const allBivalue = path.every((n, k) =>
            k % 2 === 1 || nodeCell(path[k + 1]) === nodeCell(n));

          if (mode === "xchain" && allSameDigit && sameDigit) {
            const B = nodeCell(cur);
            const elims = commonPeers(i, B)
              .filter(t => g.values[t] === 0 && g.cands[t] & candMask(d))
              .map(t => ({ cell: t, cand: d }));
            if (elims.length) {
              return mk({
                technique: classifyStormChain(path, false), category: "Single Digit Chain", score: 5.0,
                candColors: path.map((n, k) => ({ cell: nodeCell(n), cand: nodeDigit(n), color: k % 2 })),
                links: path.slice(0, -1).map((n, k) => ({ from: { cell: nodeCell(n), cand: nodeDigit(n) }, to: { cell: nodeCell(path[k + 1]), cand: nodeDigit(path[k + 1]) }, strong: k % 2 === 0 })),
                reason: `X-Chain: ${chainStr(path)} => ${conclusionStr(elims)}.`,
                eliminations: elims,
                patternCells: [...new Set(path.map(nodeCell))],
                patternCands: path.map(n => ({ cell: nodeCell(n), cand: nodeDigit(n) })),
              });
            }
          }
          if (mode === "type1" && sameDigit && !sameCell && !allSameDigit && !allBivalue) {
            const B = nodeCell(cur);
            const elims = commonPeers(i, B)
              .filter(t => g.values[t] === 0 && g.cands[t] & candMask(d))
              .map(t => ({ cell: t, cand: d }));
            if (elims.length) {
              return mk({
                technique: classifyStormChain(path, false), category: "Chain", score: 4.5,
                candColors: path.map((n, k) => ({ cell: nodeCell(n), cand: nodeDigit(n), color: k % 2 })),
                links: path.slice(0, -1).map((n, k) => ({ from: { cell: nodeCell(n), cand: nodeDigit(n) }, to: { cell: nodeCell(path[k + 1]), cand: nodeDigit(path[k + 1]) }, strong: k % 2 === 0 })),
                reason: `AIC: ${chainStr(path)} => ${conclusionStr(elims)}.`,
                eliminations: elims,
                patternCells: [...new Set(path.map(nodeCell))],
                patternCands: path.map(n => ({ cell: nodeCell(n), cand: nodeDigit(n) })),
              });
            }
          }
          if (mode === "type2" && !sameDigit) {
            const B = nodeCell(cur), q = nodeDigit(cur);
            let elims: Elimination[] = [];
            let ending = "";
            if (sameCell) {
              const keep = new Set([d, q]);
              elims = candsOf(g.cands[i]).filter(x => !keep.has(x))
                .map(x => ({ cell: i, cand: x }));
              ending = `${cellName(i)} is ${d} or ${q}, so all of its other candidates are removed`;
            } else if (fastPeers(i, B)) {
              if (g.cands[i] & candMask(q)) elims.push({ cell: i, cand: q });
              if (g.cands[B] & candMask(d)) elims.push({ cell: B, cand: d });
              ending = `the end cells see each other, so neither can hold the other's digit (that would force both cells to the same digit): removed ${elims.map(e => `${e.cand} from ${cellName(e.cell)}`).join(" and ")}`;
            }
            if (elims.length) {
              return mk({
                technique: classifyStormChain(path, false), category: "Chain", score: 4.5,
                candColors: path.map((n, k) => ({ cell: nodeCell(n), cand: nodeDigit(n), color: k % 2 })),
                links: path.slice(0, -1).map((n, k) => ({ from: { cell: nodeCell(n), cand: nodeDigit(n) }, to: { cell: nodeCell(path[k + 1]), cand: nodeDigit(path[k + 1]) }, strong: k % 2 === 0 })),
                reason: `AIC: ${chainStr(path)} => ${conclusionStr(elims)}.`,
                eliminations: elims,
                patternCells: [...new Set(path.map(nodeCell))],
                patternCands: path.map(n => ({ cell: nodeCell(n), cand: nodeDigit(n) })),
              });
            }
          }
        }

        // ---- extension: alternate the link type ----
        if (path.length >= 14) continue;
        if (strongArrived) {
          const c = nodeCell(cur), cd = nodeDigit(cur);
          if (mode !== "xchain") {
            for (const e of candsOf(g.cands[c])) {
              if (e === cd) continue;
              const n = c * 10 + e;
              if (!path.includes(n)) stack.push({ cur: n, path: [...path, n] });
            }
          }
          for (const t of PEERS[c]) {
            if (g.values[t] !== 0 || !(g.cands[t] & candMask(cd))) continue;
            const n = t * 10 + cd;
            if (!path.includes(n)) stack.push({ cur: n, path: [...path, n] });
          }
        } else {
          for (const s of strong.get(cur) ?? []) {
            if (path.includes(s)) continue;
            if (mode === "xchain" && nodeDigit(s) !== d) continue;
            stack.push({ cur: s, path: [...path, s] });
          }
        }
      }
    }
  }
  return null;
}

export const xChain: Finder = (g) => findAic(g, "xchain");
export const aicType1: Finder = (g) => findAic(g, "type1");
export const aicType2: Finder = (g) => findAic(g, "type2");


// ---------- Registry (ordered by XR, easiest first) ----------

function subsets<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  return [...subsets(rest, k - 1).map(x => [first, ...x]), ...subsets(rest, k)];
}
const row = (i: number) => Math.floor(i / 9);
const col = (i: number) => i % 9;
const box = (i: number) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);


function findFranken(g: Game, size: number): Step | null {
  const candsByDig: number[][] = Array.from({ length: 10 }, () => []);
  for (let i = 0; i < 81; i++) {
    if (g.values[i] !== 0) continue;
    const m = g.cands[i];
    for (let d = 1; d <= 9; d++) if (m & (1 << (d - 1))) candsByDig[d].push(i);
  }
  for (let d = 1; d <= 9; d++) {
    const cands = candsByDig[d];
    if (cands.length < 2) continue;
    // Base = rows, cover = cols or boxes
    const rows = [...new Set(cands.map(row))];
    if (rows.length >= size) {
      for (const baseRows of subsets(rows, size)) {
        const baseCands = cands.filter(c => baseRows.includes(row(c)));
        const pool: { type: "c" | "b"; idx: number; covers: number[] }[] = [];
        for (let c = 0; c < 9; c++) {
          const cov = baseCands.filter(x => col(x) === c);
          if (cov.length) pool.push({ type: "c", idx: c, covers: cov });
        }
        for (let b = 0; b < 9; b++) {
          const cov = baseCands.filter(x => box(x) === b);
          if (cov.length) pool.push({ type: "b", idx: b, covers: cov });
        }
        for (const cov of subsets(pool, size)) {
          if (new Set(cov.map(u => u.type)).size !== 2) continue;
          const covered = new Set(cov.flatMap(u => u.covers));
          const fins = baseCands.filter(c => !covered.has(c));
          if (fins.length === 0 || fins.length > 3) continue;
          if (new Set(fins.map(box)).size !== 1) continue;
          const elims: { cell: number; cand: number }[] = [];
          for (const u of cov) {
            const cells = u.type === "c"
              ? cands.filter(c => col(c) === u.idx && !baseRows.includes(row(c)))
              : cands.filter(c => box(c) === u.idx && !baseRows.includes(row(c)));
            for (const cell of cells) if (fins.every(f => arePeers(cell, f))) elims.push({ cell, cand: d });
          }
          if (elims.length === 0) continue;
          return {
            technique: `Finned Franken ${size === 2 ? "X-Wing" : "Swordfish"}`,
            score: size === 2 ? 5.0 : 6.0,
            patternCands: baseCands.map(c => ({ cell: c, cand: d })),
            eliminations: elims,
            category: "Fish",
            placements: [],
            patternCells: baseCands,
            reason: `Digit ${d}, base rows ${baseRows.map(r => "r" + (r + 1)).join(",")}, cover ${cov.map(u => (u.type === "c" ? "c" : "b") + (u.idx + 1)).join("/")}, ${elims.length} elims`,
          };
        }
      }
    }
    // Base = cols, cover = rows or boxes
    const cols = [...new Set(cands.map(col))];
    if (cols.length >= size) {
      for (const baseCols of subsets(cols, size)) {
        const baseCands = cands.filter(c => baseCols.includes(col(c)));
        const pool: { type: "r" | "b"; idx: number; covers: number[] }[] = [];
        for (let r = 0; r < 9; r++) {
          const cov = baseCands.filter(x => row(x) === r);
          if (cov.length) pool.push({ type: "r", idx: r, covers: cov });
        }
        for (let b = 0; b < 9; b++) {
          const cov = baseCands.filter(x => box(x) === b);
          if (cov.length) pool.push({ type: "b", idx: b, covers: cov });
        }
        for (const cov of subsets(pool, size)) {
          if (new Set(cov.map(u => u.type)).size !== 2) continue;
          const covered = new Set(cov.flatMap(u => u.covers));
          const fins = baseCands.filter(c => !covered.has(c));
          if (fins.length === 0 || fins.length > 3) continue;
          if (new Set(fins.map(box)).size !== 1) continue;
          const elims: { cell: number; cand: number }[] = [];
          for (const u of cov) {
            const cells = u.type === "r"
              ? cands.filter(c => row(c) === u.idx && !baseCols.includes(col(c)))
              : cands.filter(c => box(c) === u.idx && !baseCols.includes(col(c)));
            for (const cell of cells) if (fins.every(f => arePeers(cell, f))) elims.push({ cell, cand: d });
          }
          if (elims.length === 0) continue;
          return {
            technique: `Finned Franken ${size === 2 ? "X-Wing" : "Swordfish"}`,
            score: size === 2 ? 5.0 : 6.0,
            patternCands: baseCands.map(c => ({ cell: c, cand: d })),
            eliminations: elims,
            category: "Fish",
            placements: [],
            patternCells: baseCands,
            reason: `Digit ${d}, base cols ${baseCols.map(c => "c" + (c + 1)).join(",")}, cover ${cov.map(u => (u.type === "r" ? "r" : "b") + (u.idx + 1)).join("/")}, ${elims.length} elims`,
          };
        }
      }
    }
  }
  return null;
}
export const frankenFish2: Finder = (g) => findFranken(g, 2);
export const frankenFish3: Finder = (g) => findFranken(g, 3);

export const FINDERS: Finder[] = [
  fullHouse,               // XR 1.0
  nakedSingle,             // XR 1.0
  hiddenSingle,            // XR 1.3 / 1.5
  makeNakedSubset(2),      // XR 2.0
  makeHiddenSubset(2),     // XR 2.1
  pointing,                // XR 2.3
  claiming,                // XR 2.4
  makeNakedSubset(3),      // XR 2.5
  makeHiddenSubset(3),     // XR 2.7
  makeNakedSubset(4),      // XR 2.9
  makeHiddenSubset(4),     // XR 3.0
  makeBasicFish(2),
  makeFinnedFish(2),        // XR 3.0  X-Wing
  singleDigitChains,       // XR 3.8 / 4.0 / 4.2
  remotePairs,             // XR 4.0
  xyWing,                  // XR 4.6
  xyzWing,                 // XR 4.8
  makeBasicFish(3),
  makeFinnedFish(3),        // XR 5.0  Swordfish
  frankenFish2,              // XR 5.0  Finned Franken X-Wing
  frankenFish3,              // XR 6.0  Finned Franken Swordfish
  wWing,                   // XR 5.2
  makeBasicFish(4),
  makeFinnedFish(4),        // XR 5.4  Jellyfish
  xChain,                  // XR 5.8
  xyChain,                 // XR 6.0
  aicType1,                // XR 6.2
  aicType2,                // XR 6.4  (same-cell and cross endings)
  alsXZ,
  ahsXZ,
  sueDeCoq,                   // XR 7.0
  alsXYWing,

  alsChain,                // XR 7.4
  deathBlossom,            // XR 7.6
  chainLens,               // Stage 1a: master chain engine (runs last)
];

export function findNextStep(g: Game): Step | null {
  for (const f of FINDERS) { const s = f(g); if (s && (s.eliminations.length > 0 || s.placements.length > 0)) return s; }
  return null;
}

export function findAllSteps(g: Game): Step[] {
  return (() => {
    const seen = new Set<string>();
    const out: Step[] = [];
    for (const f of FINDERS) {
      const st = f(g);
      if (!st || (st.eliminations.length === 0 && st.placements.length === 0)) continue;
      const key = st.technique + "|" + st.eliminations.map(e => e.cell * 10 + e.cand).sort((x, y) => x - y).join(",") + "|" + (st.patternCells ?? []).slice().sort((x, y) => x - y).join(",");
      if (seen.has(key)) continue;
      seen.add(key); out.push(st);
    }
    return out;
  })()
    .filter((s): s is Step => !!s)
    .sort((a, b) => a.score - b.score);
}

export const TECHNIQUE_NAMES = [
  "Full House", "Naked Single", "Hidden Single", "Pointing", "Claiming",
  "Naked Pair/Triple/Quad", "Hidden Pair/Triple/Quad",
  "X-Wing", "Swordfish", "Jellyfish",
  "Skyscraper", "2-String Kite",  "Remote Pair",
  "XY-Wing", "XYZ-Wing", "W-Wing",
  "X-Chain", "XY-Chain", "AIC Type 1", "AIC Type 2",
  "ALS-XZ", "ALS-XY-Wing", "ALS Chain", "Death Blossom", "AIC (ALS nodes)",

  "Chain Lens (grouped chains, AIC)",];
