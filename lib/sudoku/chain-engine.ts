// Stage 1a: the master chain engine - alternating DFS, T1/T2 endings.
// Runs LAST in the registry: pure addition over the old finders.
import { Game, PEERS, Step, candMask, candsOf, countCands, cellName } from "./core";
import { ChainTables, buildChainTables, isSetKey, keyCell, keyDigit, candKey } from "./chain-tables";
import { seesCell, cellSeesSet, setSeesSet } from "./slices";
import { nodeStr, setNodeStr, conclusionStr, compressCells } from "./notation";
import type { Finder } from "./techniques";

interface Found {
  path: number[];
  elims: { cell: number; cand: number }[];
}

export function searchChains(g: Game, t: ChainTables, maxStrong = 4): Found[] {
  const results: Found[] = [];
  const seen = new Set<string>();
  let budget = 150_000;
  const cellsOf = (k: number) => (isSetKey(k) ? t.sets[k - 1000].cells : [keyCell(k)]);

  const weakFrom = (k: number): number[] => {
    const out: number[] = [];
    const d = keyDigit(k);
    if (!isSetKey(k)) {
      const c = keyCell(k);
      for (const e of candsOf(g.cands[c])) if (e !== d) out.push(candKey(c, e));
      for (const p of PEERS[c])
        if (g.values[p] === 0 && g.cands[p] & candMask(d)) out.push(candKey(p, d));
      for (let s = 0; s < t.sets.length; s++) {
        const set = t.sets[s];
        if (set.digit === d && cellSeesSet(c, set.cells)) out.push(1000 + s);
      }
    } else {
      const set = t.sets[k - 1000];
      for (let c = 0; c < 81; c++)
        if (g.values[c] === 0 && g.cands[c] & candMask(d) && cellSeesSet(c, set.cells))
          out.push(candKey(c, d));
      for (let s = 0; s < t.sets.length; s++) {
        const o = t.sets[s];
        if (o.digit === d && s !== k - 1000 && setSeesSet(set.cells, o.cells)) out.push(1000 + s);
      }
    }
    return out;
  };

  const tryEnding = (start: number, end: number): { cell: number; cand: number }[] | null => {
    const sd = keyDigit(start), ed = keyDigit(end);
    if (sd === ed) {
      // T1: victims see all cells of both endpoint objects
      const sc = cellsOf(start), ec = cellsOf(end);
      const elims: { cell: number; cand: number }[] = [];
      for (let c = 0; c < 81; c++) {
        if (g.values[c] !== 0 || !(g.cands[c] & candMask(sd))) continue;
        if (sc.includes(c) || ec.includes(c)) continue;
        if (sc.every(s => seesCell(c, s)) && ec.every(s => seesCell(c, s)))
          elims.push({ cell: c, cand: sd });
      }
      return elims.length ? elims : null;
    }
    // T2: single objects only (group endpoints may not serve T2)
    if (isSetKey(start) || isSetKey(end)) return null;
    const a = keyCell(start), b = keyCell(end);
    if (a === b) {
      const elims = candsOf(g.cands[a]).filter(x => x !== sd && x !== ed)
        .map(x => ({ cell: a, cand: x }));
      return elims.length ? elims : null;
    }
    if (seesCell(a, b)) {
      const elims: { cell: number; cand: number }[] = [];
      if (g.cands[a] & candMask(ed)) elims.push({ cell: a, cand: ed });
      if (g.cands[b] & candMask(sd)) elims.push({ cell: b, cand: sd });
      return elims.length ? elims : null;
    }
    return null;
  };

  const record = (path: number[], elims: { cell: number; cand: number }[]) => {
    const key = elims.map(e => e.cell * 10 + e.cand).sort((x, y) => x - y).join(",") +
      "|" + Math.min(path[0], path[path.length - 1]) + ":" + Math.max(path[0], path[path.length - 1]);
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ path, elims });
  };

  for (const start of [...t.strong.keys()]) {
    for (const n2 of t.strong.get(start)!) {
      const stack: { cur: number; path: number[]; sc: number }[] =
        [{ cur: n2, path: [start, n2], sc: 1 }];
      while (stack.length) {
        if (--budget < 0) return results;
        const { cur, path, sc } = stack.pop()!;
        const strongArrived = path.length % 2 === 0;
        if (strongArrived && sc >= 2) {
          const elims = tryEnding(start, cur);
          if (elims) record(path, elims);
        }
        if (sc >= maxStrong) continue;
        if (strongArrived) {
          for (const w of weakFrom(cur))
            if (!path.includes(w)) stack.push({ cur: w, path: [...path, w], sc });
        } else {
          for (const s of t.strong.get(cur) ?? [])
            if (!path.includes(s)) stack.push({ cur: s, path: [...path, s], sc: sc + 1 });
        }
      }
    }
  }
  return results;
}

// ---- notation: folds by service, hoisting for single-digit chains ----
function renderNotation(g: Game, t: ChainTables, path: number[]): string {
  const allSame = path.every(n => keyDigit(n) === keyDigit(path[0]));
  const toks: { text: string; endIdx: number }[] = [];
  let k = 0;
  while (k < path.length) {
    if (k + 1 < path.length && !isSetKey(path[k]) && !isSetKey(path[k + 1]) &&
        keyCell(path[k]) === keyCell(path[k + 1])) {
      const c = keyCell(path[k]);
      const d1 = keyDigit(path[k]), d2 = keyDigit(path[k + 1]);
      const pairIsBiv = countCands(g.cands[c]) === 2 &&
        g.cands[c] === (candMask(d1) | candMask(d2));
      const conn = k % 2 === 0 && pairIsBiv ? "=" : "-";
      toks.push({ text: `(${d1} ${conn} ${d2})${cellName(c)}`, endIdx: k + 1 });
      k += 2;
    } else if (isSetKey(path[k])) {
      const cells = t.sets[path[k] - 1000].cells;
      toks.push({ text: allSame ? `(${compressCells(cells)})` : setNodeStr(keyDigit(path[k]), cells), endIdx: k });
      k += 1;
    } else {
      toks.push({ text: allSame ? cellName(keyCell(path[k])) : nodeStr(keyDigit(path[k]), keyCell(path[k])), endIdx: k });
      k += 1;
    }
  }
  const parts: string[] = [toks[0].text];
  for (let j = 0; j + 1 < toks.length; j++) {
    parts.push(toks[j].endIdx % 2 === 0 ? "=" : "-");
    parts.push(toks[j + 1].text);
  }
  const body = parts.join("");
  return allSame ? `(${keyDigit(path[0])})(${body})` : body;
}

function classify(path: number[]): { name: string; xr: number } {
  const digits = new Set(path.map(keyDigit));
  const hasSet = path.some(isSetKey);
  let allBiv = true;
  for (let k = 0; k + 1 < path.length; k += 2)
    if (isSetKey(path[k]) || isSetKey(path[k + 1]) || keyCell(path[k]) !== keyCell(path[k + 1])) {
      allBiv = false;
      break;
    }
  if (digits.size === 1) return hasSet ? { name: "Grouped X-Chain", xr: 6.6 } : { name: "X-Chain", xr: 5.8 };
  if (allBiv) return digits.size === 2 ? { name: "Remote Pair", xr: 4.0 } : { name: "XY-Chain", xr: 6.0 };
  return hasSet ? { name: "Grouped AIC", xr: 6.6 } : { name: "AIC", xr: 6.2 };
}

export const chainLens: Finder = (g) => {
  if (g.values.filter(v => v === 0).length < 4) return null;
  const t = buildChainTables(g);
  const found = searchChains(g, t, 4);
  if (!found.length) return null;
  found.sort((a, b) => a.path.length - b.path.length || b.elims.length - a.elims.length);
  const best = found[0];
  const { name, xr } = classify(best.path);
  const patternCells = [...new Set(best.path.flatMap(k =>
    isSetKey(k) ? t.sets[k - 1000].cells : [keyCell(k)]))];
  const patternCands = best.path.flatMap(k => isSetKey(k)
    ? t.sets[k - 1000].cells.map(c => ({ cell: c, cand: keyDigit(k) }))
    : [{ cell: keyCell(k), cand: keyDigit(k) }]);
  const links: Step["links"] = [];
  for (let k = 0; k + 1 < best.path.length; k++) {
    const a = best.path[k], b = best.path[k + 1];
    if (isSetKey(a) || isSetKey(b)) continue;
    links.push({ from: { cell: keyCell(a), cand: keyDigit(a) },
                 to: { cell: keyCell(b), cand: keyDigit(b) }, strong: k % 2 === 0 });
  }
  return {
    technique: name, category: "Chain", score: xr,
    reason: `${name}: ${renderNotation(g, t, best.path)} => ${conclusionStr(best.elims)}.`,
    placements: [], eliminations: best.elims,
    patternCells, patternCands, links,
  };
};
