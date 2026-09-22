// Stage 1a: the master chain engine - alternating DFS, T1/T2 endings.
// Runs LAST in the registry: pure addition over the old finders.
import { Game, PEERS, Step, candMask, candsOf, countCands, cellName } from "./core";
import { ChainTables, buildChainTables, isSetKey, isAlsKey, keyCell, keyDigit, candKey } from "./chain-tables";
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
  const cellsOf = (k: number) => (isAlsKey(k) ? t.alsNodes.find(n => n.nodeKey === k)!.cells : isSetKey(k) ? t.sets[k - 1000].cells : [keyCell(k)]);

  const weakFrom = (k: number): number[] => {
    const out: number[] = [];
    const d = isSetKey(k) ? t.sets[k - 1000].digit : keyDigit(k);
    if (!isSetKey(k)) {
      const c = keyCell(k);
      for (const e of candsOf(g.cands[c])) if (e !== d) out.push(candKey(c, e));
      for (const p of PEERS[c])
        if (g.values[p] === 0 && g.cands[p] & candMask(d)) out.push(candKey(p, d));
      for (let s = 0; s < t.sets.length; s++) {
        const set = t.sets[s];
        if (set.digit === d && !set.cells.includes(c) && cellSeesSet(c, set.cells)) out.push(1000 + s);
      }
    } else {
      const set = t.sets[k - 1000];
      for (let c = 0; c < 81; c++)
        if (g.values[c] === 0 && g.cands[c] & candMask(d) && !set.cells.includes(c) && cellSeesSet(c, set.cells))
          out.push(candKey(c, d));
      for (let s = 0; s < t.sets.length; s++) {
        const o = t.sets[s];
        if (o.digit === d && s !== k - 1000 && setSeesSet(set.cells, o.cells) && !set.cells.some(x => o.cells.includes(x))) out.push(1000 + s);
      }
    }
    if (isAlsKey(k)) {
      const weaks = t.alsWeak.get(k) ?? [];
      for (const w of weaks) out.push(w);
    }
    return out;
  };

  const onPathNode = (k: number, c: number, d: number): boolean => {
    if (isAlsKey(k)) {
      const node = t.alsNodes.find(n => n.nodeKey === k);
      return node ? node.digit === d && node.cells.includes(c) : false;
    }
    return isSetKey(k) ? (t.sets[k - 1000].digit === d && t.sets[k - 1000].cells.includes(c))
                       : (keyCell(k) === c && keyDigit(k) === d);
  };
  const tryEnding = (start: number, end: number, path: number[]): { cell: number; cand: number }[] | null => {
    const sd = isSetKey(start) ? t.sets[start - 1000].digit : keyDigit(start);
    const ed = isSetKey(end) ? t.sets[end - 1000].digit : keyDigit(end);
    if (sd === ed) {
      // T1: victims see all cells of both endpoint objects
      const sc = cellsOf(start), ec = cellsOf(end);
      const elims: { cell: number; cand: number }[] = [];
      for (let c = 0; c < 81; c++) {
        if (g.values[c] !== 0 || !(g.cands[c] & candMask(sd))) continue;
        if (sc.includes(c) || ec.includes(c)) continue;
        let onPath = false;
        for (const k of path) {
          if (isSetKey(k)) { if (t.sets[k - 1000].digit === sd && t.sets[k - 1000].cells.includes(c)) { onPath = true; break; } }
          else if (keyCell(k) === c && keyDigit(k) === sd) { onPath = true; break; }
        }
        if (onPath) continue;
        if (sc.every(s => seesCell(c, s)) && ec.every(s => seesCell(c, s)))
          elims.push({ cell: c, cand: sd });
      }
      return elims.length ? elims : null;
    }
    // T2: single objects only (group and ALS endpoints may not serve T2)
    if (isSetKey(start) || isSetKey(end) || isAlsKey(start) || isAlsKey(end)) return null;
    const a = keyCell(start), b = keyCell(end);
    if (a === b) {
      const elims = candsOf(g.cands[a]).filter(x => x !== sd && x !== ed &&
          !path.some(k => onPathNode(k, a, x)))
        .map(x => ({ cell: a, cand: x }));
      return elims.length ? elims : null;
    }
    if (seesCell(a, b)) {
      const elims: { cell: number; cand: number }[] = [];
      if (g.cands[a] & candMask(ed) && !path.some(k => onPathNode(k, a, ed)))
        elims.push({ cell: a, cand: ed });
      if (g.cands[b] & candMask(sd) && !path.some(k => onPathNode(k, b, sd)))
        elims.push({ cell: b, cand: sd });
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
          const elims = tryEnding(start, cur, path);
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
  const digitOf = (n: number) => (isSetKey(n) ? t.sets[n - 1000].digit : keyDigit(n));
  const allSame = path.every(n => digitOf(n) === digitOf(path[0]));
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
      toks.push({ text: allSame ? `(${compressCells(cells)})` : setNodeStr(digitOf(path[k]), cells), endIdx: k });
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
  return allSame ? `(${digitOf(path[0])})(${body})` : body;
}

function classify(path: number[], t: ChainTables): { name: string; xr: number } {
  const digits = new Set(path.map(n => (isSetKey(n) ? t.sets[n - 1000].digit : keyDigit(n))));
  const hasSet = path.some(isSetKey);
  let allBiv = true;
  for (let k = 0; k + 1 < path.length; k += 2)
    if (isSetKey(path[k]) || isSetKey(path[k + 1]) || keyCell(path[k]) !== keyCell(path[k + 1])) {
      allBiv = false;
      break;
    }
  // StormDoku chainMathScore: base + lengthExcess + digitExcess + closure
  // (0.25 open / 0.5 ring). Remote Pair (5,4,2); XY-Wing (3,3,3); XY-Chain (5,4,2).
  const steps = Math.ceil(path.length / 2);
  const cms = (base: number, canonLen: number, canonDigits: number) =>
    base + Math.max(0, steps - canonLen) + Math.max(0, digits.size - canonDigits) + 0.25;
  if (digits.size === 1) return hasSet ? { name: "Grouped X-Chain", xr: 6.6 } : { name: "X-Chain", xr: 5.8 };
  if (allBiv) {
    if (digits.size === 2) return { name: "Remote Pair", xr: cms(5, 4, 2) };
    if (steps === 3) return { name: "XY-Wing", xr: cms(3, 3, 3) };
    return { name: "XY-Chain", xr: cms(5, 4, 2) };
  }
  // Hidden Remote Pair (index.html:10402-10428): bilocation strong links
  // alternating on two digits.
  if (digits.size === 2) {
    const linkDigits: number[] = [];
    let ok = true;
    for (let k = 0; k + 1 < path.length; k += 2) {
      if (keyCell(path[k]) === keyCell(path[k + 1])) { ok = false; break; }
      const d = keyDigit(path[k]);
      if (linkDigits.length && linkDigits[linkDigits.length - 1] === d) { ok = false; break; }
      linkDigits.push(d);
    }
    if (ok && linkDigits.length >= 2) return { name: "Hidden Remote Pair", xr: cms(5, 4, 2) };
  }
  return hasSet ? { name: "Grouped AIC", xr: 6.6 } : { name: "AIC", xr: 6.2 };
}

export const chainLens: Finder = (g) => {
  if (g.values.filter(v => v === 0).length < 4) return null;
  const t = buildChainTables(g);
  const found = searchChains(g, t, 4);
  if (!found.length) return null;
  found.sort((a, b) => a.path.length - b.path.length || b.elims.length - a.elims.length);
  const best = found[0];
  const alsCellsOf = (k: number) => t.alsNodes.find(n => n.nodeKey === k)?.cells ?? [];
  const alsDigitOf = (k: number) => t.alsNodes.find(n => n.nodeKey === k)?.digit ?? 0;
  const alsIdx = new Set(best.path.filter(isAlsKey).map(k => Math.floor((k - 3000) / 10)));
  let name: string, xr: number;
  if (alsIdx.size >= 2) {
    name = alsIdx.size === 2 ? "ALS-XZ" : alsIdx.size === 3 ? "ALS-XY-Wing" : "ALS-Chain";
    xr = 6.0 + alsIdx.size * 0.3;
  } else {
    ({ name, xr } = classify(best.path, t));
  }
  const patternCells = [...new Set(best.path.flatMap(k =>
    isAlsKey(k) ? alsCellsOf(k) : isSetKey(k) ? t.sets[k - 1000].cells : [keyCell(k)]))];
  const patternCands = best.path.flatMap(k => isAlsKey(k)
    ? alsCellsOf(k).map(c => ({ cell: c, cand: alsDigitOf(k) }))
    : isSetKey(k)
    ? t.sets[k - 1000].cells.map(c => ({ cell: c, cand: t.sets[k - 1000].digit }))
    : [{ cell: keyCell(k), cand: keyDigit(k) }]);
  const links: Step["links"] = [];
  for (let k = 0; k + 1 < best.path.length; k++) {
    const a = best.path[k], b = best.path[k + 1];
    if (isSetKey(a) || isSetKey(b) || isAlsKey(a) || isAlsKey(b)) continue;
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
