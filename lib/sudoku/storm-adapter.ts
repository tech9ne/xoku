// StormDoku engine adapter: his Hint → our Step, preserving UI shape.
// Gate: STORM_ENGINE env flag (default false until parity gate passes).

import { Game, Step, Elimination, candMask, StepCategory } from "./core";
import * as storm from "./storm/sudoku";
import { findAicChains, formatChainEureka, ChainElimination } from "./storm/chain";
import { ratingForStep, ratingForChain, chainLengthOf, ratingDefinition, type SolverProfile } from "./storm-rater";

// Convert our bitmask cands to his CandidateGrid (number[][]).
// cite: lib/sudoku/storm/sudoku.ts:13 (type CandidateGrid = number[][])
export function toCandidateGrid(g: Game): storm.CandidateGrid {
  const cg: number[][] = [];
  for (let i = 0; i < 81; i++) {
    if (g.values[i] !== 0) {
      cg.push([]);
    } else {
      const digs: number[] = [];
      for (let d = 1; d <= 9; d++) {
        if (g.cands[i] & candMask(d)) digs.push(d);
      }
      cg.push(digs);
    }
  }
  return cg;
}

// Convert his Elimination (union type) to our Elimination array.
// cite: lib/sudoku/storm/sudoku.ts:52-54
function fromStormElim(e: storm.Elimination): Elimination[] {
  const out: Elimination[] = [];
  if ('items' in e) {
    // { items: CandidateRemoval[] }
    for (const item of e.items) {
      out.push({ cell: item.cell, cand: item.digit });
    }
  } else {
    // { cells: number[]; digits: number[] }
    for (const cell of e.cells) {
      for (const digit of e.digits) {
        out.push({ cell, cand: digit });
      }
    }
  }
  return out;
}

// Derive category from tech.
function techToCategory(tech: string): StepCategory {
  if (tech.includes('single')) return 'Single';
  if (tech.includes('pair') || tech.includes('triple') || tech.includes('quad')) return 'Subset';
  if (tech.includes('wing') || tech.includes('chain') || tech.includes('aic')) return 'Chain';
  if (tech.includes('fish') || tech.includes('x-wing')) return 'Fish';
  if (tech.includes('box-line') || tech.includes('locked') || tech === 'pointing' || tech === 'claiming') return 'Locked Candidates';
  return 'Chain'; // fallback
}

// Convert one Hint to our Step shape plus his rating. H-parity-e3: the
// generator acceptance consumes rank/value/category exactly as his
// ratingFromSteps does (index.html:8917), so steps now travel with
// their rating instead of dropping it inside fromHint.
export interface StormRatingInfo {
  tag: string;
  value: number | null; // null = his unknownRating (unclassifiable)
  rank: number;
  category: string;
}
export interface StormRatedStep {
  step: Step;
  rating: StormRatingInfo;
}
function ri(r: { tag: string; value: number | null; rank: number; category: string }): StormRatingInfo {
  return { tag: r.tag, value: r.value, rank: r.rank, category: r.category };
}
function fromHintRated(h: storm.Hint, g: Game): StormRatedStep {
  // cite: index.html:8825 ratingForStep - display name is his tag;
  // techToName/techToScore guessed maps purged in H-parity-e1.
  const rating = ratingForStep({
    tech: h.tech as string,
    name: h.name,
    category: h.category,
    size: h.size,
    k: h.k,
    desc: h.desc,
  });
  const rinfo = ri(rating);
  const category = techToCategory(h.tech);
  // Interim sentinel for his unknownRating (value null): 4.5 for the
  // display score only; acceptance uses rinfo.value (e1b removes it).
  const score = rating.value ?? 4.5;
  const eliminations = fromStormElim(h.elim);
  const patternCells = h.at || [];
  const patternCands: Elimination[] = [];
  const placements: { cell: number; value: number }[] = [];
  if (h.at && h.at.length === 1 && h.digits && h.digits.length === 1 && h.tech.includes('single')) {
    placements.push({ cell: h.at[0], value: h.digits[0] });
    return { step: {
      technique: rating.tag, category, score, reason: h.desc,
      placements, eliminations: [], patternCells,
      patternCands: [{ cell: h.at[0], cand: h.digits[0] }],
      candColors: [], links: [],
    }, rating: rinfo };
  }
  if (h.digits) {
    for (const cell of patternCells) {
      for (const d of h.digits) {
        patternCands.push({ cell, cand: d });
      }
    }
  }
  return { step: {
    technique: rating.tag, category, score, reason: h.desc,
    placements, eliminations, patternCells, patternCands,
    candColors: [], links: [],
  }, rating: rinfo };
}

// cite: stormdoku src/browser-core.js:1156 withActualEliminations - a hint
// whose eliminations are already gone is a no-op; skip it or rateGame
// spins forever.
function liveHint(h: storm.Hint | null, g: Game): h is storm.Hint {
  if (!h) return false;
  if (typeof h.tech === "string" && h.tech.includes("single")) {
    return !!h.at && h.at.length === 1 && g.values[h.at[0]] === 0;
  }
  const items = h.elim && (h.elim as any).items ? (h.elim as any).items : [];
  return items.some((e: any) =>
    g.values[e.cell] === 0 && (g.cands[e.cell] & candMask(e.digit)) !== 0);
}

// His move selection under an optional generator profile, with his
// rating attached. cite: index.html:11704 chooseSolverStep - simple
// first; early-return when the simple value <= 2; otherwise
// lower-scoring of (simple, best chain) wins. Chain pick:
// bestChainFromReport (index.html:11043) - lowest rating value,
// Unknown = Infinity, his rank filter under profiles.
export function stormFindNextStepRated(g: Game, profile?: SolverProfile | null): StormRatedStep | null {
  const mt = profile?.moveTypes;
  const peerHasD = (cell: number, d: number): boolean => {
    const mask = candMask(d);
    const r = (cell / 9) | 0, c = cell % 9;
    for (let j = 0; j < 81; j++) {
      if (j === cell || g.values[j] !== 0) continue;
      const jr = (j / 9) | 0, jc = j % 9;
      const sameBox = ((jr / 3) | 0) === ((r / 3) | 0) && ((jc / 3) | 0) === ((c / 3) | 0);
      if ((jr === r || jc === c || sameBox) && (g.cands[j] & mask) !== 0) return true;
    }
    return false;
  };
  // Pass 1: last-man-standing. cite: browser-core.js:693; RATING_TAGS
  // 'last-man-standing' -> Lulz 0.
  if (!mt || mt.has('last-man-standing')) {
    for (let i = 0; i < 81; i++) {
      if (g.values[i] !== 0) continue;
      const m = g.cands[i];
      if (m === 0 || (m & (m - 1)) !== 0) continue;
      let d = 0;
      for (let k = 1; k <= 9; k++) if (m & candMask(k)) { d = k; break; }
      if (!peerHasD(i, d)) {
        const r = ri(ratingDefinition('Lulz', 0, 'Last Man Standing', 'last-man-standing'));
        return { step: {
          technique: "Last Man Standing", category: "Single", score: 0,
          reason: `Last Man Standing: cell ${i} = ${d} (no peer lists ${d}).`,
          placements: [{ cell: i, value: d }],
          eliminations: [], patternCells: [i], patternCands: [{ cell: i, cand: d }],
        }, rating: r };
      }
    }
  }
  // Pass 2: naked singles (value 1). cite: RATING_TAGS 'naked-single'.
  if (!mt || mt.has('naked-single')) {
    for (let i = 0; i < 81; i++) {
      if (g.values[i] !== 0) continue;
      const m = g.cands[i];
      if (m !== 0 && (m & (m - 1)) === 0) {
        let d = 0;
        for (let k = 1; k <= 9; k++) if (m & candMask(k)) { d = k; break; }
        const r = ri(ratingDefinition('Extremely Easy', 1, 'Naked Single', 'naked-single'));
        return { step: {
          technique: "Naked Single", category: "Single", score: 1.0,
          reason: `Naked Single: cell ${i} holds only candidate ${d}.`,
          placements: [{ cell: i, value: d }],
          eliminations: [], patternCells: [i], patternCands: [{ cell: i, cand: d }],
        }, rating: r };
      }
    }
  }
  const cg = toCandidateGrid(g);
  // Simple walk: his subsetOrFishStep order, moveType-gated under profiles.
  let simple: StormRatedStep | null = null;
  if (!mt || mt.has('hidden-single')) {
    const h = storm.hiddenSubsetStep(cg, 1);
    if (liveHint(h, g)) simple = fromHintRated(h, g);
  }
  if (!simple && (!mt || mt.has('naked-single'))) {
    const n = storm.nakedSingleStep(cg);
    if (liveHint(n, g)) simple = fromHintRated(n, g);
  }
  if (!simple && (!mt || mt.has('box-line'))) {
    const b = storm.boxLineStep(cg);
    if (liveHint(b, g)) simple = fromHintRated(b, g);
  }
  if (!simple) {
    for (let k = 2; k <= 4 && !simple; k++) {
      const hid = ['hidden-pair', 'hidden-triple', 'hidden-quad'][k - 2];
      if (!mt || mt.has(hid)) {
        const h = storm.hiddenSubsetStep(cg, k as storm.SubsetSize);
        if (liveHint(h, g)) { simple = fromHintRated(h, g); break; }
      }
      const nak = ['naked-pair', 'naked-triple', 'naked-quad'][k - 2];
      if (!mt || mt.has(nak)) {
        const n = storm.nakedSubsetStep(cg, k as storm.SubsetSize);
        if (liveHint(n, g)) { simple = fromHintRated(n, g); break; }
      }
    }
  }
  if (!simple) {
    // cite: index.html solverFishSizes - size enabled by either name key.
    const fishKeys: Record<number, [string, string]> = {
      2: ['x-wing', '2x2+k-fish'],
      3: ['swordfish', '3x3+k-fish'],
      4: ['jellyfish', '4x4+k-fish'],
    };
    for (let size = 2; size <= 4 && !simple; size++) {
      if ((profile?.maxFishSize ?? 4) < size) continue;
      if (mt) { const keys = fishKeys[size]; if (!mt.has(keys[0]) && !mt.has(keys[1])) continue; }
      const f = storm.fishStep(cg, [size as 2 | 3 | 4]);
      if (liveHint(f, g)) simple = fromHintRated(f, g);
    }
  }
  // his chooseSolverStep early-return (index.html:11704): simple value
  // <= 2 cannot be beaten by any chain (Number(null)=0 quirk preserved).
  if (simple) {
    const sv = Number(simple.rating.value);
    if (Number.isFinite(sv) && sv <= 2) return simple;
  }
  // Chain search: his bestChainFromReport policy (lowest value wins).
  let best: { rated: StormRatedStep; value: number; length: number } | null = null;
  if (!mt || mt.has('chains')) {
    const report = findAicChains(cg, profile ? {
      maxDepth: profile.maxDepth,
      strongLinkTypes: profile.strongLinkTypes,
      includeAls: profile.includeAlsRcc,
      ...profile.caps, // cite: index.html chainSearchOptions generator budget
    } : {});
    for (const chain of report.chains ?? []) {
      const eliminations: Elimination[] = chain.eliminations.map((e: ChainElimination) => ({
        cell: e.cell,
        cand: e.digit,
      }));
      const isLive = eliminations.some(
        (e) => g.values[e.cell] === 0 && (g.cands[e.cell] & candMask(e.cand)) !== 0,
      );
      if (!isLive) continue;
      // H-parity-e1c: strip his embedded structure-name prefix.
      const eureka = formatChainEureka(chain);
      const eurekaSep = eureka.indexOf(':');
      const reason = eurekaSep >= 0 ? eureka.slice(eurekaSep + 1).trim() : eureka;
      const rating = ratingForChain(chain, { desc: eureka });
      if (profile && rating.rank > profile.maxRank) continue;
      const rinfo = ri(rating);
      const value = rinfo.category === 'Unknown' || rinfo.value == null
        ? Number.POSITIVE_INFINITY : rinfo.value;
      const length = chainLengthOf(chain);
      if (!best || value < best.value || (value === best.value && length < best.length)) {
        const candColors: { cell: number; cand: number; color: number }[] = [];
        let colorIdx = 0;
        for (const step of chain.steps) {
          for (const cell of step.entry.cells) {
            for (const d of step.entry.digits) {
              candColors.push({ cell, cand: d, color: colorIdx % 6 });
            }
          }
          for (const cell of step.exit.cells) {
            for (const d of step.exit.digits) {
              candColors.push({ cell, cand: d, color: (colorIdx + 1) % 6 });
            }
          }
          colorIdx += 2;
        }
        best = { rated: { step: {
          technique: rating.tag, category: 'Chain',
          score: rinfo.value ?? 4.5, reason,
          placements: [], eliminations,
          patternCells: [], patternCands: [], candColors, links: [],
        }, rating: rinfo }, value, length };
      }
    }
  }
  // his chooseLowerScoringMove / chooseBestSolverMove: lower value wins;
  // simple wins ties (iterated first with strict <).
  if (best) {
    const simpleVal = simple
      ? (simple.rating.category === 'Unknown' || simple.rating.value == null
          ? Number.POSITIVE_INFINITY : simple.rating.value)
      : Number.POSITIVE_INFINITY;
    if (best.value < simpleVal) return best.rated;
  }
  return simple;
}

// Interactive entry (techniques.ts gate). H-parity-e3: thin wrapper over
// the rated finder; the rating is discarded on this path.
export function stormFindNextStep(g: Game, profile?: SolverProfile | null): Step | null {
  return stormFindNextStepRated(g, profile)?.step ?? null;
}
