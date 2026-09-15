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
        technique: "Locked Candidates Type 1 (Pointing)", category: "Locked Candidates", score: 2.3,
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
        technique: "Locked Candidates Type 2 (Claiming)", category: "Locked Candidates", score: 2.4,
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
          score: [0, 0, 2.0, 2.5, 2.9][n],
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
          score: [0, 0, 2.1, 2.7, 3.0][n],
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
            technique: FISH_NAMES[n], category: "Fish", score: [0, 0, 3.0, 5.0, 5.4][n],
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
          const tA = unitType(ua), tB = unitType(ub);
          const weak = UNITS_OF[x].filter(u => UNITS_OF[y].includes(u)).map(unitType);
          let technique = "Turbot Fish", score = 4.2;
          if (tA === tB && (tA === "row" || tA === "col") && weak.includes(tA === "row" ? "col" : "row")) {
            technique = "Skyscraper"; score = 3.8;
          } else if (tA !== tB && tA !== "box" && tB !== "box" && weak.includes("box")) {
            technique = "2-String Kite"; score = 4.0;
          }
          return mk({
            technique, category: "Single Digit Chain", score,
            candColors: [a1, a2, y, fy].map((c, k) => ({ cell: c, cand: d, color: k % 2 })),
            // endpoints of the OR are a1 and fy (blue start, green end)
            links: [{ from: { cell: a1, cand: d }, to: { cell: a2, cand: d }, strong: true }, { from: { cell: a2, cand: d }, to: { cell: y, cand: d }, strong: false }, { from: { cell: y, cand: d }, to: { cell: fy, cand: d }, strong: true }],
            reason: `${technique} on ${d}: strong links ${cellName(a1)}–${cellName(a2)} (${unitName(ua)}) and ${cellName(b1)}–${cellName(b2)} (${unitName(ub)}) are joined by weak link ${cellName(x)}–${cellName(y)}; one of ${cellName(fx)}/${cellName(fy)} must be ${d}, so ${d} can be removed from cells seeing both.`,
            eliminations: elims, patternCells: [x, y, fx, fy],
            patternCands: [x, y, fx, fy].map(c => ({ cell: c, cand: d })),
          });
        }
      }
    }
  }
  return null;
};

// ---------- Simple Colors ----------
export const simpleColors: Finder = (g) => {
  for (const d of ALL_DIGITS) {
    const links = strongLinks(g, d);
    if (links.length < 2) continue;
    const adj = new Map<number, number[]>();
    for (const [a, b] of links) {
      if (!adj.has(a)) adj.set(a, []);
      if (!adj.has(b)) adj.set(b, []);
      adj.get(a)!.push(b); adj.get(b)!.push(a);
    }
    const color = new Map<number, 0 | 1>();
    for (const start of adj.keys()) {
      if (color.has(start)) continue;
      color.set(start, 0);
      const queue = [start];
      const comp: number[] = [];
      let wrap: 0 | 1 | -1 = -1;
      while (queue.length) {
        const i = queue.shift()!;
        comp.push(i);
        for (const j of adj.get(i)!) {
          if (!color.has(j)) { color.set(j, (color.get(i)! ^ 1) as 0 | 1); queue.push(j); }
          else if (color.get(j) === color.get(i) && wrap === -1) wrap = color.get(i)!;
        }
      }
      if (wrap !== -1) {
        return mk({
          technique: "Simple Colors (Rule 2)", category: "Coloring", score: 4.2,
          reason: `Coloring ${d}: two cells of the same color see each other, so that color is false — remove ${d} from all its cells.`,
          eliminations: comp.filter(i => color.get(i) === wrap).map(i => ({ cell: i, cand: d })),
          patternCells: comp, patternCands: comp.map(i => ({ cell: i, cand: d })),
        });
      }
      const zeros = comp.filter(i => color.get(i) === 0);
      const ones = comp.filter(i => color.get(i) === 1);
      for (let i = 0; i < 81; i++) {
        if (g.values[i] !== 0 || !(g.cands[i] & candMask(d)) || color.has(i)) continue;
        if (zeros.some(z => arePeers(z, i)) && ones.some(o => arePeers(o, i))) {
          return mk({
            technique: "Simple Colors (Rule 4)", category: "Coloring", score: 4.2,
            reason: `Coloring ${d}: ${cellName(i)} sees both colors of the chain — remove ${d} from ${cellName(i)}.`,
            eliminations: [{ cell: i, cand: d }],
            patternCells: comp, patternCands: comp.map(c => ({ cell: c, cand: d })),
          });
        }
      }
    }
  }
  return null;
};

// ---------- Remote Pairs ----------
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
      const elims = commonPeers(start, end)
        .filter(i => g.values[i] === 0 && g.cands[i] & mask)
        .flatMap(i => candsOf(g.cands[i] & mask).map(c => ({ cell: i, cand: c })));
      if (!elims.length) continue;
      const chain: number[] = [];
      for (let c = end; c !== start; c = parent.get(c)!) chain.unshift(c);
      chain.unshift(start);
      return mk({
        technique: "Remote Pair", category: "Chain", score: 4.0,
        reason: `${p}/${q} chain ${chain.map(cellName).join("–")}: the ends hold opposite values, so cells seeing both ends lose ${p} and ${q}.`,
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
          technique: "XY-Wing", category: "Wing", score: 4.6,
          reason: `XY-Wing: pivot ${cellName(p)} (${x}/${y}), pincers ${cellName(a)} (${x}/${z}) and ${cellName(b)} (${y}/${z}) — one pincer must be ${z}.`,
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
          technique: "XYZ-Wing", category: "Wing", score: 4.8,
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
          technique: "W-Wing", category: "Wing", score: 5.2,
          reason: `W-Wing: ${cellName(A)} and ${cellName(B)} both hold ${x}/${y}; the strong link ${d} (${cellName(s1)}–${cellName(s2)}) forces one of them to be ${o}.`,
          eliminations: elims, patternCells: [A, B, s1, s2],
          patternCands: [{ cell: A, cand: x }, { cell: A, cand: y }, { cell: B, cand: x }, { cell: B, cand: y }, { cell: s1, cand: d }, { cell: s2, cand: d }],
        });
      }
    }
  }
  return null;
};

// ---------- Uniqueness: UR Type 1 ----------
export const uniqueRectangle1: Finder = (g) => {
  for (let r1 = 0; r1 < 9; r1++) for (let r2 = r1 + 1; r2 < 9; r2++) {
    for (let c1 = 0; c1 < 9; c1++) for (let c2 = c1 + 1; c2 < 9; c2++) {
      if (Math.floor(r1 / 3) !== Math.floor(r2 / 3) && Math.floor(c1 / 3) !== Math.floor(c2 / 3)) continue;
      const cells = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
      if (!cells.every(i => g.values[i] === 0)) continue;
      for (const dIdx of cells) {
        const others = cells.filter(i => i !== dIdx);
        const m = g.cands[others[0]];
        if (countCands(m) !== 2 || !others.every(i => g.cands[i] === m)) continue;
        const dm = g.cands[dIdx];
        if ((dm & m) !== m || dm === m) continue;
        const [x, y] = candsOf(m);
        const elims = [x, y].filter(d => dm & candMask(d)).map(d => ({ cell: dIdx, cand: d }));
        return mk({
          technique: "Unique Rectangle Type 1", category: "Uniqueness", score: 3.3,
          reason: `If ${cellName(dIdx)} were ${x} or ${y}, the rectangle r${r1 + 1}/r${r2 + 1}c${c1 + 1}/c${c2 + 1} would allow two solutions — remove ${x} and ${y} from ${cellName(dIdx)}.`,
          eliminations: elims, patternCells: cells,
          patternCands: others.flatMap(i => [{ cell: i, cand: x }, { cell: i, cand: y }]),
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
          if (!biSet.has(j) || path.includes(j)) continue;
          if (!(g.cands[j] & candMask(out))) continue;
          const other = candsOf(g.cands[j]).find(d => d !== out)!;
          if (other === z && path.length + 1 >= 4) {
            const elims = commonPeers(start, j)
              .filter(i => g.values[i] === 0 && g.cands[i] & candMask(z))
              .map((i): Elimination => ({ cell: i, cand: z }));
            if (elims.length) {
              const chain = [...path, j];
              return mk({
                technique: "XY-Chain", category: "Chain", score: 6.0,
candColors: (() => {
              // blue-first convention: start assumption = start cell is OFF
              // in its outgoing digit. Alternation: in-digit = parity,
              // strong-link partner = 1 - parity, shared digit carries
              // 1 - parity into the next cell where it is the in-digit.
              const out: { cell: number; cand: number; color: number }[] = [];
              let parity = 0;                    // 0 = blue
              let prev = firstOut;               // digit leaving the start
              out.push({ cell: chain[0], cand: firstOut, color: 0 });
              const other0 = candsOf(g.cands[chain[0]]).find(x => x !== firstOut)!;
              out.push({ cell: chain[0], cand: other0, color: 1 });
              parity = 1;
              for (let k = 0; k + 1 < chain.length; k++) {
                const a = chain[k], b = chain[k + 1];
                const sh = candsOf(g.cands[a] & g.cands[b]).filter(x => x !== prev);
                if (!sh.length) break;
                // sh[0] arrives in cell b as the OFF side -> blue
                out.push({ cell: b, cand: sh[0], color: 0 });
                const partner = candsOf(g.cands[b]).find(x => x !== sh[0])!;
                if (partner !== undefined) out.push({ cell: b, cand: partner, color: 1 });
                prev = sh[0];
                parity = 1 - parity;
              }
              out.push({ cell: chain[chain.length - 1], cand: z, color: chain.length % 2 === 1 ? 0 : 1 });
              return out;
            })(),
            links: (() => {
              const L: { from: { cell: number; cand: number }; to: { cell: number; cand: number }; strong: boolean }[] = [];
              let prev = firstOut;
              for (let k = 0; k + 1 < chain.length; k++) {
                const a = chain[k], b = chain[k + 1];
                const sh = candsOf(g.cands[a] & g.cands[b]).filter(x => x !== prev);
                if (!sh.length) break;
                L.push({ from: { cell: a, cand: prev }, to: { cell: a, cand: sh[0] }, strong: true });
                L.push({ from: { cell: a, cand: sh[0] }, to: { cell: b, cand: sh[0] }, strong: false });
                prev = sh[0];
              }
              L.push({ from: { cell: chain[chain.length - 1], cand: prev }, to: { cell: chain[chain.length - 1], cand: z }, strong: true });
              return L;
            })(),
                                            
                reason: `XY-Chain ${chain.map(cellName).join(" → ")}: one end must be ${z}, so ${z} can be removed from cells seeing both ends.`,
                eliminations: elims, patternCells: chain,
                patternCands: chain.flatMap(i => candsOf(g.cands[i]).map(d => ({ cell: i, cand: d }))),
              });
            }
          }
          if (path.length < 15) stack.push({ cell: j, out: other, path: [...path, j] });
        }
      }
    }
  }
  return null;
};

// ---------- BUG + n (uniqueness) ----------
// A full BUG (Bivalue Universal Grave): every unsolved cell is bivalue and every
// candidate appears exactly twice per house — a deadly pattern (parity swap),
// impossible in a puzzle with a unique solution. BUG+n = the grid is n
// candidate falsifications away from a full BUG, so at least one of the n
// "extra" candidates must be true:
//   n=1: the extra candidate is true (placement)
//   n=2/3 with all extras the same digit: cells seeing ALL extra cells lose it
// Conditions enforced below (each is required for the contradiction to hold):
// extras appear 3x in EVERY house of their cell; no candidate appears 1x or
// 4+ times anywhere; every 3x count is caused by exactly one extra.
function findBug(g: Game, n: number): Step | null {
  const empt = emptyCells(g);
  if (empt.length < 4) return null;
  const tri: number[] = [];
  for (const i of empt) {
    const c = countCands(g.cands[i]);
    if (c === 3) tri.push(i);
    else if (c !== 2) return null;
  }
  if (tri.length !== n) return null;

  // counts[u][d] = unsolved cells in unit u containing candidate d
  const counts: number[][] = Array.from({ length: 27 }, () => new Array(10).fill(0));
  for (const i of empt)
    for (const d of candsOf(g.cands[i]))
      for (const u of UNITS_OF[i]) counts[u][d]++;

  for (let u = 0; u < 27; u++)
    for (let d = 1; d <= 9; d++) {
      const c = counts[u][d];
      if (c !== 0 && c !== 2 && c !== 3) return null;
    }

  // the extra of each trivalue cell: 3x in all three of its houses
  const extra = new Map<number, number>();
  for (const A of tri) {
    const xs = candsOf(g.cands[A]).filter(x =>
      counts[UNITS_OF[A][0]][x] === 3 &&
      counts[UNITS_OF[A][1]][x] === 3 &&
      counts[UNITS_OF[A][2]][x] === 3);
    if (xs.length !== 1) return null;
    extra.set(A, xs[0]);
  }

  // every 3x count must be caused by exactly one extra cell in that unit
  for (let u = 0; u < 27; u++)
    for (let d = 1; d <= 9; d++)
      if (counts[u][d] === 3) {
        let owners = 0;
        for (const A of tri)
          if (extra.get(A) === d && UNITS_OF[A].includes(u)) owners++;
        if (owners !== 1) return null;
      }

  if (n === 1) {
    const A = tri[0], x = extra.get(A)!;
    return mk({
      technique: "BUG+1", category: "Uniqueness", score: 3.2,
      reason: `All unsolved cells are bivalue except ${cellName(A)}, and every candidate appears exactly twice per house except ${x} (three times). If ${x} were false here the grid would be a BUG with two solutions — so ${cellName(A)} = ${x}.`,
      placements: [{ cell: A, value: x }],
      patternCells: [A], patternCands: [{ cell: A, cand: x }],
    });
  }

  const digits = new Set(tri.map(A => extra.get(A)!));
  if (digits.size !== 1) return null; // mixed digits: no standalone elimination
  const d = [...digits][0];
  const elims = empt
    .filter(i => tri.every(A => arePeers(A, i)) && g.cands[i] & candMask(d))
    .map(i => ({ cell: i, cand: d }));
  if (!elims.length) return null;
  return mk({
    technique: `BUG+${n}`, category: "Uniqueness", score: n === 2 ? 5.0 : 5.2,
    reason: `The grid is ${n} candidates away from a BUG: at least one of ${tri.map(cellName).join(", ")} must be ${d}, so ${d} can be removed from cells seeing all of them.`,
    eliminations: elims, patternCells: tri,
    patternCands: tri.map(A => ({ cell: A, cand: d })),
  });
}

export const bugPlus1: Finder = (g) => findBug(g, 1);
export const bugPlus2: Finder = (g) => findBug(g, 2);
export const bugPlus3: Finder = (g) => findBug(g, 3);

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

function restrictedCommon(A: Als, B: Als, d: number): boolean {
  return A.byDigit[d].every(a => B.byDigit[d].every(b => fastPeers(a, b)));
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
          return mk({
            technique: zRestr ? "ALS-XZ (doubly linked)" : "ALS-XZ",
            category: "ALS", score: 7.0,
            cellGroups: [{ cells: A.cells, color: 0 }, { cells: B.cells, color: 1 }],
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

// ---------- Unique Rectangle Types 2, 3, 4, 5 (XR 3.4 - 3.7) ----------
// Shared geometry: four cells on two rows and two columns spanning exactly
// two boxes. If all four took values only from the pair {x,y} the pattern is
// deadly (swapping x<->y gives a second solution), so at least one cell must
// break it. UR Type 1 is implemented above (uniqueRectangle1).

// Type 2 / Type 5: two cells are exactly {x,y,z} with the same single extra
// z, the other two exactly {x,y}. If neither z-cell held z the rectangle
// would be deadly -> at least one z-cell is z -> z is removed from every
// cell seeing both. z-cells in one row/column = Type 2, diagonal = Type 5.
export const urType2: Finder = (g) => {
  for (let r1 = 0; r1 < 9; r1++) for (let r2 = r1 + 1; r2 < 9; r2++) {
    for (let c1 = 0; c1 < 9; c1++) for (let c2 = c1 + 1; c2 < 9; c2++) {
      if (Math.floor(r1 / 3) !== Math.floor(r2 / 3) && Math.floor(c1 / 3) !== Math.floor(c2 / 3)) continue;
      const cells = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
      if (!cells.every(i => g.values[i] === 0)) continue;
      for (let x = 1; x <= 9; x++) for (let y = x + 1; y <= 9; y++) {
        const pairMask = candMask(x) | candMask(y);
        const biv = cells.filter(i => g.cands[i] === pairMask);
        if (biv.length !== 2) continue;
        const rest = cells.filter(i => g.cands[i] !== pairMask);
        if (g.cands[rest[0]] !== g.cands[rest[1]]) continue;
        if (countCands(g.cands[rest[0]]) !== 3 || (g.cands[rest[0]] & pairMask) !== pairMask) continue;
        const z = candsOf(g.cands[rest[0]] & ~pairMask)[0];
        const sameLine = rowOf(rest[0]) === rowOf(rest[1]) || colOf(rest[0]) === colOf(rest[1]);
        const elims = commonPeers(rest[0], rest[1])
          .filter(i => g.values[i] === 0 && g.cands[i] & candMask(z))
          .map(i => ({ cell: i, cand: z }));
        if (!elims.length) continue;
        return mk({
          technique: sameLine ? "Unique Rectangle Type 2" : "Unique Rectangle Type 5",
          category: "Uniqueness", score: sameLine ? 3.4 : 3.5,
          reason: `${cellName(rest[0])} and ${cellName(rest[1])} are ${x}/${y}/${z} while the other two cells of the rectangle are ${x}/${y} only — if neither were ${z} the rectangle would allow two solutions, so at least one is ${z}; remove ${z} from cells seeing both.`,
          eliminations: elims, patternCells: cells,
          patternCands: cells.flatMap(i => candsOf(g.cands[i]).map(d => ({ cell: i, cand: d }))),
        });
      }
    }
  }
  return null;
};

// Type 3: floor = two cells exactly {x,y} in one line; the two roof cells
// hold {x,y} plus extras. One roof must use an extra digit (deadly
// avoidance), so the roof pair acts as a virtual cell with candidates
// E = union of extras. E plus (|E|-1) outside cells with candidates
// inside E, all in a unit shared by the roofs, form a naked subset.
export const urType3: Finder = (g) => {
  for (let r1 = 0; r1 < 9; r1++) for (let r2 = r1 + 1; r2 < 9; r2++) {
    for (let c1 = 0; c1 < 9; c1++) for (let c2 = c1 + 1; c2 < 9; c2++) {
      if (Math.floor(r1 / 3) !== Math.floor(r2 / 3) && Math.floor(c1 / 3) !== Math.floor(c2 / 3)) continue;
      const cells = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
      if (!cells.every(i => g.values[i] === 0)) continue;
      for (let x = 1; x <= 9; x++) for (let y = x + 1; y <= 9; y++) {
        const pairMask = candMask(x) | candMask(y);
        const orientations: [number, number, number, number][] = [
          [cells[0], cells[1], cells[2], cells[3]],
          [cells[0], cells[2], cells[1], cells[3]],
        ];
        for (const [f1, f2, roofA, roofB] of orientations) {
          if (g.cands[f1] !== pairMask || g.cands[f2] !== pairMask) continue;
          if ((g.cands[roofA] & pairMask) !== pairMask || (g.cands[roofB] & pairMask) !== pairMask) continue;
          const E = (g.cands[roofA] | g.cands[roofB]) & ~pairMask;
          const eSize = countCands(E);
          if (eSize < 2 || eSize > 3) continue;
          const shared = UNITS_OF[roofA].filter(u => UNITS_OF[roofB].includes(u));
          for (const u of shared) {
            const cand = UNITS[u].filter(i =>
              g.values[i] === 0 && i !== roofA && i !== roofB &&
              g.cands[i] !== 0 && (g.cands[i] & ~E) === 0);
            if (cand.length < eSize - 1) continue;
            for (const combo of combinations(cand, eSize - 1)) {
              const elims: Elimination[] = [];
              for (const i of UNITS[u]) {
                if (i === roofA || i === roofB || combo.includes(i)) continue;
                if (g.values[i] === 0)
                  for (const d of candsOf(g.cands[i] & E)) elims.push({ cell: i, cand: d });
              }
              if (!elims.length) continue;
              return mk({
                technique: "Unique Rectangle Type 3", category: "Uniqueness", score: 3.6,
                reason: `Roofs ${cellName(roofA)} and ${cellName(roofB)} must use a digit beyond ${x}/${y} (else the rectangle is deadly); their extras ${candsOf(E).join("/")} plus ${combo.map(cellName).join(", ")} form a naked subset in ${unitName(u)} — remove ${candsOf(E).join("/")} from the rest of ${unitName(u)}.`,
                eliminations: elims, patternCells: cells,
                patternCands: cells.flatMap(i => candsOf(g.cands[i]).map(d => ({ cell: i, cand: d }))),
              });
            }
          }
        }
      }
    }
  }
  return null;
};

// Type 4: floor = two cells exactly {x,y} in one line; roofs hold {x,y} plus
// extras. If one pair digit d appears nowhere else in a unit shared by the
// roofs (strong link), one roof must be d; to avoid the deadly rectangle the
// other roof must be an extra digit — so the other pair digit falls in both.
export const urType4: Finder = (g) => {
  for (let r1 = 0; r1 < 9; r1++) for (let r2 = r1 + 1; r2 < 9; r2++) {
    for (let c1 = 0; c1 < 9; c1++) for (let c2 = c1 + 1; c2 < 9; c2++) {
      if (Math.floor(r1 / 3) !== Math.floor(r2 / 3) && Math.floor(c1 / 3) !== Math.floor(c2 / 3)) continue;
      const cells = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
      if (!cells.every(i => g.values[i] === 0)) continue;
      for (let x = 1; x <= 9; x++) for (let y = x + 1; y <= 9; y++) {
        const pairMask = candMask(x) | candMask(y);
        const orientations: [number, number, number, number][] = [
          [cells[0], cells[1], cells[2], cells[3]],
          [cells[0], cells[2], cells[1], cells[3]],
        ];
        for (const [f1, f2, roofA, roofB] of orientations) {
          if (g.cands[f1] !== pairMask || g.cands[f2] !== pairMask) continue;
          if ((g.cands[roofA] & pairMask) !== pairMask || (g.cands[roofB] & pairMask) !== pairMask) continue;
          if (g.cands[roofA] === pairMask && g.cands[roofB] === pairMask) continue;
          const shared = UNITS_OF[roofA].filter(u => UNITS_OF[roofB].includes(u));
          for (const u of shared) {
            for (const d of [x, y]) {
              const other = d === x ? y : x;
              const blocked = UNITS[u].some(i =>
                i !== roofA && i !== roofB && g.values[i] === 0 && g.cands[i] & candMask(d));
              if (blocked) continue;
              const elims = [roofA, roofB]
                .filter(i => g.cands[i] & candMask(other))
                .map(i => ({ cell: i, cand: other }));
              if (!elims.length) continue;
              return mk({
                technique: "Unique Rectangle Type 4", category: "Uniqueness", score: 3.7,
                reason: `In ${unitName(u)}, ${d} appears only in the roof cells ${cellName(roofA)} and ${cellName(roofB)}: one must be ${d}, and to avoid the deadly rectangle the other must be an extra digit — so ${other} can be removed from both roofs.`,
                eliminations: elims, patternCells: cells,
                patternCands: cells.flatMap(i => candsOf(g.cands[i]).map(dd => ({ cell: i, cand: dd }))),
              });
            }
          }
        }
      }
    }
  }
  return null;
};

// ---------- BUG Lite (XR 4.0) ----------
// The UR generalized: a set of cells all containing the pair {x,y} where
// every house holds 0 or 2 of them. If all cells were bivalue {x,y} the
// whole set could be x<->y swapped for a second solution (deadly), so at
// least one cell must use an extra candidate:
//   one extra cell with a single extra z  -> z is placed there
//   two extra cells, same single extra z  -> z removed from cells seeing both
export const bugLite: Finder = (g) => {
  for (let x = 1; x <= 9; x++) for (let y = x + 1; y <= 9; y++) {
    const pairMask = candMask(x) | candMask(y);
    const pool = emptyCells(g).filter(i => (g.cands[i] & pairMask) === pairMask);
    if (pool.length < 6) continue;

    const visited = new Set<string>();
    let budget = 120_000;
    const stack: number[][] = pool.map(c => [c]);

    while (stack.length) {
      if (--budget < 0) break;
      const S = stack.pop()!;
      const key = S.slice().sort((a, b) => a - b).join(",");
      if (visited.has(key)) continue;
      visited.add(key);

      const inS = new Set(S);
      const counts = new Map<number, number>();
      for (const c of S) for (const u of UNITS_OF[c]) counts.set(u, (counts.get(u) ?? 0) + 1);

      let open = -1;
      for (const [u, n] of counts) if (n === 1) { open = u; break; }

      if (open === -1) {
        // closed structure: every house holds 0 or 2 cells of S
        if (S.length >= 6 && S.length <= 10) {
          const extras = S.filter(c => g.cands[c] !== pairMask);
          if (extras.length === 1 &&
              countCands(g.cands[extras[0]]) === 3 &&
              (g.cands[extras[0]] & pairMask) === pairMask) {
            const w = extras[0];
            const z = candsOf(g.cands[w] & ~pairMask)[0];
            return mk({
              technique: "BUG Lite (single extra)", category: "Uniqueness", score: 4.0,
              reason: `${S.length} cells (${S.map(cellName).join(", ")}) all contain ${x}/${y} and every house holds exactly two of them. If all were ${x}/${y}-only the set could be swapped for a second solution — so ${cellName(w)} must break the pattern: it is ${z}.`,
              placements: [{ cell: w, value: z }],
              patternCells: S,
              patternCands: S.flatMap(c => candsOf(g.cands[c]).map(d => ({ cell: c, cand: d }))),
            });
          }
          if (extras.length === 2 &&
              g.cands[extras[0]] === g.cands[extras[1]] &&
              countCands(g.cands[extras[0]]) === 3) {
            const z = candsOf(g.cands[extras[0]] & ~pairMask)[0];
            const elims = commonPeers(extras[0], extras[1])
              .filter(i => g.values[i] === 0 && g.cands[i] & candMask(z))
              .map(i => ({ cell: i, cand: z }));
            if (elims.length) {
              return mk({
                technique: "BUG Lite (two extras)", category: "Uniqueness", score: 4.0,
                reason: `${S.length} cells (${S.map(cellName).join(", ")}) all contain ${x}/${y} and every house holds exactly two of them. If all were ${x}/${y}-only the set could be swapped for a second solution — so at least one of ${cellName(extras[0])}, ${cellName(extras[1])} is ${z}, which is removed from cells seeing both.`,
                eliminations: elims, patternCells: S,
                patternCands: S.flatMap(c => candsOf(g.cands[c]).map(d => ({ cell: c, cand: d }))),
              });
            }
          }
        }
        continue;
      }

      // grow: close the open unit by adding one more {x,y} cell from it
      if (S.length >= 10) continue;
      for (const c of UNITS[open]) {
        if (inS.has(c) || g.values[c] !== 0 || (g.cands[c] & pairMask) !== pairMask) continue;
        let ok = true;
        for (const u of UNITS_OF[c]) if ((counts.get(u) ?? 0) >= 2) { ok = false; break; }
        if (!ok) continue;
        stack.push([...S, c]);
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
            technique: "ALS-XY-Wing", category: "ALS", score: 7.2,
            cellGroups: [{ cells: A.cells, color: 0 }, { cells: B.cells, color: 1 }, { cells: C.cells, color: 2 }],
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
export const alsChain: Finder = (g) => {
  const als = enumerateAls(g);
  if (als.length < 3) return null;
  const empt = emptyCells(g);
  const nb = alsGraph(als);
  let budget = 120_000;

  for (let s = 0; s < als.length; s++) {
    const A1 = als[s];
    for (const Z of candsOf(A1.mask)) {
      const stack: { cur: number; via: number; path: number[]; cells: Set<number> }[] = [];
      for (const e of nb[s]) {
        if (e.d === Z) continue; // first link must differ from Z
        const cells = new Set<number>([...A1.cells, ...als[e.j].cells]);
        stack.push({ cur: e.j, via: e.d, path: [s, e.j], cells });
      }
      while (stack.length) {
        if (--budget < 0) return null;
        const { cur, via, path, cells } = stack.pop()!;
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
              technique: "ALS Chain", category: "ALS", score: 7.4,
              cellGroups: path.map((p, k) => ({ cells: als[p].cells, color: k % 5 })),
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
          stack.push({ cur: e.j, via: e.d, path: [...path, e.j], cells: ncells });
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
          technique: "Death Blossom", category: "ALS", score: 7.6,
          cellGroups: [{ cells: [S], color: 0 }, { cells: A.cells, color: 1 }, { cells: B.cells, color: 2 }],
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
  const nodeName = (n: number) => `${cellName(nodeCell(n))}:${nodeDigit(n)}`;
  const chainStr = (path: number[]) =>
    path.map((n, k) => (k === 0 ? nodeName(n) : `${k % 2 === 1 ? " = " : " - "}${nodeName(n)}`)).join("");

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
                technique: "X-Chain", category: "Single Digit Chain", score: 5.8,
                candColors: path.map((n, k) => ({ cell: nodeCell(n), cand: nodeDigit(n), color: k % 2 })),
                links: path.slice(0, -1).map((n, k) => ({ from: { cell: nodeCell(n), cand: nodeDigit(n) }, to: { cell: nodeCell(path[k + 1]), cand: nodeDigit(path[k + 1]) }, strong: k % 2 === 0 })),
                reason: `X-Chain on ${d}: ${chainStr(path)} — the alternating links prove that ${cellName(i)} or ${cellName(B)} must hold ${d}, so ${d} is removed from cells seeing both.`,
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
                technique: "AIC Type 1", category: "Chain", score: 6.2,
                candColors: path.map((n, k) => ({ cell: nodeCell(n), cand: nodeDigit(n), color: k % 2 })),
                links: path.slice(0, -1).map((n, k) => ({ from: { cell: nodeCell(n), cand: nodeDigit(n) }, to: { cell: nodeCell(path[k + 1]), cand: nodeDigit(path[k + 1]) }, strong: k % 2 === 0 })),
                reason: `AIC: ${chainStr(path)} — at least one end must be true (${cellName(i)} or ${cellName(B)} holds ${d}), so ${d} is removed from cells seeing both.`,
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
                technique: "AIC Type 2", category: "Chain", score: 6.4,
                candColors: path.map((n, k) => ({ cell: nodeCell(n), cand: nodeDigit(n), color: k % 2 })),
                links: path.slice(0, -1).map((n, k) => ({ from: { cell: nodeCell(n), cand: nodeDigit(n) }, to: { cell: nodeCell(path[k + 1]), cand: nodeDigit(path[k + 1]) }, strong: k % 2 === 0 })),
                reason: `AIC: ${chainStr(path)} — at least one end must be true (${cellName(i)} is ${d} or ${cellName(B)} is ${q}); ${ending}.`,
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

// ---------- AIC with ALS nodes (XR 7.6) ----------
// The AIC engine extended with a third node type: ALS digits. Node (A,d)
// means "d is true somewhere in ALS A". New links:
//   STRONG, ALS-internal: (A,x) = (A,y) for x <> y in A — if x is false
//   throughout A, the set locks and places y
//   WEAK, ALS-external: (c,x) - (A,x) when cell c sees every x in A;
//   (A,x) - (B,x) when x is restricted between A and B
// Endpoints are candidates (or one ALS end on the start digit); conclusions
// follow AIC Types 1 and 2. Requires at least one multi-cell ALS node, so
// plain chains stay with findAic. Single-cell ALSs (bivalue cells) are
// excluded — their links already exist as bivalue strong links.
export const aicAls: Finder = (g) => {
  const empt = emptyCells(g);
  if (empt.length < 4) return null;
  const als = enumerateAls(g).filter(A => A.cells.length >= 2);
  if (als.length < 2) return null;
  const nb = alsGraph(als);

  const isAls = (n: number) => n >= 1000;
  const nodeCell = (n: number) => Math.floor(n / 10);
  const nodeDigit = (n: number) => n % 10;
  const alsSet = (n: number) => als[Math.floor((n - 1000) / 10)];
  const nameOf = (n: number) => isAls(n)
    ? `[${alsSet(n).cells.map(cellName).join("+")}]:${n % 10}`
    : `${cellName(nodeCell(n))}:${nodeDigit(n)}`;
  const chainStr = (p: number[]) =>
    p.map((n, k) => (k === 0 ? nameOf(n) : `${k % 2 === 1 ? " = " : " - "}${nameOf(n)}`)).join("");

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
    for (let d2 = 1; d2 <= 9; d2++) {
      const spots = UNITS[u].filter(i => g.values[i] === 0 && g.cands[i] & candMask(d2));
      if (spots.length === 2) addStrong(spots[0] * 10 + d2, spots[1] * 10 + d2);
    }

  // weak bridges between candidates and ALS digits (both directions)
  const alsFromCand = new Map<number, number[]>();
  const candFromAls = new Map<number, number[]>();
  for (let a = 0; a < als.length; a++) {
    const A = als[a];
    for (const dd of candsOf(A.mask)) {
      for (const c of empt) {
        if (A.cells.includes(c) || !(g.cands[c] & candMask(dd))) continue;
        if (!A.byDigit[dd].every(h => fastPeers(c, h))) continue;
        const cn = c * 10 + dd, an = 1000 + a * 10 + dd;
        if (!alsFromCand.has(cn)) alsFromCand.set(cn, []);
        alsFromCand.get(cn)!.push(a);
        if (!candFromAls.has(an)) candFromAls.set(an, []);
        candFromAls.get(an)!.push(cn);
      }
    }
  }

  const patternOf = (path: number[], used: number[]) => {
    const cells = new Set<number>(path.filter(n => !isAls(n)).map(nodeCell));
    for (const a of used) for (const c of als[a].cells) cells.add(c);
    const cands: Elimination[] = path.filter(n => !isAls(n))
      .map(n => ({ cell: nodeCell(n), cand: nodeDigit(n) }));
    for (const a of used) for (const c of als[a].cells)
      for (const dd of candsOf(g.cands[c])) cands.push({ cell: c, cand: dd });
    return { cells: [...cells], cands };
  };

  let budget = 150_000;
  for (const i of empt) {
    for (const d of candsOf(g.cands[i])) {
      const start = i * 10 + d;
      const stack: { cur: number; path: number[]; used: number[] }[] = [];
      for (const n2 of strong.get(start) ?? [])
        stack.push({ cur: n2, path: [start, n2], used: [] });
      while (stack.length) {
        if (--budget < 0) return null;
        const { cur, path, used } = stack.pop()!;
        const strongArrived = path.length % 2 === 0;

        if (strongArrived && path.length >= 6 && path.some(isAls)) {
          if (isAls(cur) && cur % 10 === d) {
            // ending on an ALS node carrying the start digit
            const A = alsSet(cur);
            const holders = A.byDigit[d];
            const elims = empt.filter(t =>
              t !== i && !holders.includes(t) && g.cands[t] & candMask(d) &&
              fastPeers(t, i) && holders.every(h => fastPeers(t, h)))
              .map(t => ({ cell: t, cand: d }));
            if (elims.length) {
              const pat = patternOf(path, used);
              return mk({
                technique: "AIC with ALS nodes (Type 1)", category: "ALS", score: 7.6,
                reason: `AIC: ${chainStr(path)} — at least one end must be true: ${cellName(i)} holds ${d}, or ${d} is placed in ALS ${A.cells.map(cellName).join("+")}; either way ${d} is removed from cells seeing both.`,
                eliminations: elims, patternCells: pat.cells, patternCands: pat.cands,
              });
            }
          } else if (!isAls(cur)) {
            const B = nodeCell(cur), q = nodeDigit(cur);
            let elims: Elimination[] = [];
            let why = "";
            if (q === d && B !== i) {
              elims = commonPeers(i, B)
                .filter(t => g.values[t] === 0 && g.cands[t] & candMask(d))
                .map(t => ({ cell: t, cand: d }));
              why = `${cellName(i)} or ${cellName(B)} must hold ${d}, so ${d} is removed from cells seeing both`;
            } else if (q !== d) {
              if (B === i) {
                const keep = new Set([d, q]);
                elims = candsOf(g.cands[i]).filter(x => !keep.has(x))
                  .map(x => ({ cell: i, cand: x }));
                why = `${cellName(i)} is ${d} or ${q}, so its other candidates are removed`;
              } else if (fastPeers(i, B)) {
                if (g.cands[i] & candMask(q)) elims.push({ cell: i, cand: q });
                if (g.cands[B] & candMask(d)) elims.push({ cell: B, cand: d });
                why = `the end cells see each other, so neither can hold the other's digit`;
              }
            }
            if (elims.length) {
              const pat = patternOf(path, used);
              return mk({
                technique: `AIC with ALS nodes (Type ${q === d ? 1 : 2})`, category: "ALS", score: 7.6,
                reason: `AIC: ${chainStr(path)} — at least one end must be true; ${why}.`,
                eliminations: elims, patternCells: pat.cells, patternCands: pat.cands,
              });
            }
          }
        }

        if (path.length >= 16) continue;
        const push = (n: number, u: number[]) =>
          stack.push({ cur: n, path: [...path, n], used: u });
        if (strongArrived) {
          if (isAls(cur)) {
            for (const cn of candFromAls.get(cur) ?? [])
              if (!path.includes(cn)) push(cn, used);
            const a = Math.floor((cur - 1000) / 10), y = cur % 10;
            for (const e of nb[a]) {
              if (e.d !== y || used.includes(e.j)) continue;
              if (used.some(u => als[u].cells.some(c => als[e.j].cells.includes(c)))) continue;
              push(1000 + e.j * 10 + y, [...used, e.j]);
            }
          } else {
            const c = nodeCell(cur), cd = nodeDigit(cur);
            for (const e of candsOf(g.cands[c])) {
              if (e !== cd && !path.includes(c * 10 + e)) push(c * 10 + e, used);
            }
            for (const t of PEERS[c]) {
              if (g.values[t] !== 0 || !(g.cands[t] & candMask(cd))) continue;
              if (!path.includes(t * 10 + cd)) push(t * 10 + cd, used);
            }
            for (const a of alsFromCand.get(cur) ?? []) {
              if (used.includes(a)) continue;
              if (used.some(u => als[u].cells.some(c => als[a].cells.includes(c)))) continue;
              push(1000 + a * 10 + cd, [...used, a]);
            }
          }
        } else {
          if (isAls(cur)) {
            const a = Math.floor((cur - 1000) / 10), x = cur % 10;
            for (const y of candsOf(als[a].mask)) {
              if (y !== x) push(1000 + a * 10 + y, used);
            }
          } else {
            for (const s of strong.get(cur) ?? [])
              if (!path.includes(s)) push(s, used);
          }
        }
      }
    }
  }
  return null;
};
// ---------- Registry (ordered by XR, easiest first) ----------
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
  makeBasicFish(2),        // XR 3.0  X-Wing
  bugPlus1,                // XR 3.2  BUG+1
  uniqueRectangle1,        // XR 3.3  UR Type 1
  urType2,                 // XR 3.4 / 3.5  UR Types 2 and 5
  urType3,                 // XR 3.6
  urType4,                 // XR 3.7
  singleDigitChains,       // XR 3.8 / 4.0 / 4.2
  bugLite,                 // XR 4.0
  remotePairs,             // XR 4.0
  simpleColors,            // XR 4.2
  xyWing,                  // XR 4.6
  xyzWing,                 // XR 4.8
  bugPlus2,                // XR 5.0
  makeBasicFish(3),        // XR 5.0  Swordfish
  wWing,                   // XR 5.2
  bugPlus3,                // XR 5.2
  makeBasicFish(4),        // XR 5.4  Jellyfish
  xChain,                  // XR 5.8
  xyChain,                 // XR 6.0
  aicType1,                // XR 6.2
  aicType2,                // XR 6.4  (same-cell and cross endings)
  alsXZ,                   // XR 7.0
  alsXYWing,               // XR 7.2
  alsChain,                // XR 7.4
  deathBlossom,            // XR 7.6
  aicAls,                  // XR 7.6  AICs with ALS nodes
];

export function findNextStep(g: Game): Step | null {
  for (const f of FINDERS) { const s = f(g); if (s) return s; }
  return null;
}

export function findAllSteps(g: Game): Step[] {
  return FINDERS.map(f => f(g))
    .filter((s): s is Step => !!s)
    .sort((a, b) => a.score - b.score);
}

export const TECHNIQUE_NAMES = [
  "Full House", "Naked Single", "Hidden Single", "Pointing", "Claiming",
  "Naked Pair/Triple/Quad", "Hidden Pair/Triple/Quad",
  "X-Wing", "Swordfish", "Jellyfish",
  "Skyscraper", "2-String Kite", "Turbot Fish", "Simple Colors", "Remote Pair",
  "XY-Wing", "XYZ-Wing", "W-Wing",
  "Unique Rectangle Types 1-5", "BUG Lite", "BUG+1", "BUG+2", "BUG+3",
  "X-Chain", "XY-Chain", "AIC Type 1", "AIC Type 2",
  "ALS-XZ", "ALS-XY-Wing", "ALS Chain", "Death Blossom", "AIC (ALS nodes)",
];
