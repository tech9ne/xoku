// StormDoku engine adapter: his Hint → our Step, preserving UI shape.
// Gate: STORM_ENGINE env flag (default false until parity gate passes).

import { Game, Step, Elimination, candMask, StepCategory } from "./core";
import * as storm from "./storm/sudoku";
import { findAicChains, formatChainEureka, ChainElimination } from "./storm/chain";
import { ratingForStep, ratingForChain } from "./storm-rater";

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

// Convert one Hint to our Step shape.
// cite: lib/sudoku/storm/sudoku.ts:56 (Hint interface)
function fromHint(h: storm.Hint, g: Game): Step {
  // H-parity-e1: rating via ported rater (index.html:8825 ratingForStep);
  // display name is his tag. techToName/techToScore purged as guessed maps.
  const rating = ratingForStep({
    tech: h.tech as string,
    name: h.name,
    category: h.category,
    size: h.size,
    k: h.k,
    desc: h.desc,
  });
  const technique = rating.tag;
  const category = techToCategory(h.tech);
  // Interim sentinel for his unknownRating (value null): 4.5, documented
  // in STATE.md; e1b removes the need.
  const score = rating.value ?? 4.5;
  
  const eliminations = fromStormElim(h.elim);
  const patternCells = h.at || [];
  const patternCands: Elimination[] = [];
  
  // Storm singles return peer eliminations, but we need placements.
  // If this is a single with at: [cell] and digits: [digit], convert to placement.
  const placements: { cell: number; value: number }[] = [];
  if (h.at && h.at.length === 1 && h.digits && h.digits.length === 1 && h.tech.includes('single')) {
    placements.push({ cell: h.at[0], value: h.digits[0] });
    // Singles don't have explicit eliminations in our model — placement handles peer reductions
    return {
      technique,
      category,
      score,
      reason: h.desc,
      placements,
      eliminations: [],
      patternCells,
      patternCands: [{ cell: h.at[0], cand: h.digits[0] }],
      candColors: [],
      links: [],
    };
  }
  if (h.digits) {
    for (const cell of patternCells) {
      for (const d of h.digits) {
        patternCands.push({ cell, cand: d });
      }
    }
  }
  
  return {
    technique,
    category,
    score,
    reason: h.desc,
    placements,
    eliminations,
    patternCells,
    patternCands,
    candColors: [],
    links: [],
  };
}

// Walk his finders in scheduler order, return first match as Step.
// cite: lib/sudoku/storm/sudoku.ts exports
// cite: stormdoku src/browser-core.js withActualEliminations — a hint whose
// eliminations are already gone is a no-op; skip it or rateGame spins forever.
function liveHint(h: storm.Hint | null, g: Game): h is storm.Hint {
  if (!h) return false;
  if (typeof h.tech === "string" && h.tech.includes("single")) {
    return !!h.at && h.at.length === 1 && g.values[h.at[0]] === 0;
  }
  const items = h.elim && (h.elim as any).items ? (h.elim as any).items : [];
  return items.some((e: any) =>
    g.values[e.cell] === 0 && (g.cands[e.cell] & candMask(e.digit)) !== 0);
}

export function stormFindNextStep(g: Game): Step | null {
  // Implicit resolve pass. Storm's state model is candidate-grid-only: a
  // cell reduced to one candidate IS placed (his nakedSingleStep returns
  // null once no peer eliminations remain, sudoku.ts:658-671). Our state
  // needs an explicit placement step, so emit it here.
  // H-parity-e1: implicit resolve split per his scheduler order
  // (browser-core.js subsetOrFishStep: last-man-standing before singles).
  // Pass 1: single-candidate cell whose digit appears in no peer
  // candidate = his lastManStandingStep (value 0, promote: true).
  // Pass 2: any other single-candidate cell = naked single (value 1).
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
  for (let i = 0; i < 81; i++) {
    if (g.values[i] !== 0) continue;
    const m = g.cands[i];
    if (m === 0 || (m & (m - 1)) !== 0) continue;
    let d = 0;
    for (let k = 1; k <= 9; k++) if (m & candMask(k)) { d = k; break; }
    if (!peerHasD(i, d)) {
      return {
        technique: "Last Man Standing", category: "Single", score: 0,
        reason: `Last Man Standing: cell ${i} = ${d} (no peer lists ${d}).`,
        placements: [{ cell: i, value: d }],
        eliminations: [],
        patternCells: [i], patternCands: [{ cell: i, cand: d }],
      };
    }
  }
  for (let i = 0; i < 81; i++) {
    if (g.values[i] !== 0) continue;
    const m = g.cands[i];
    if (m !== 0 && (m & (m - 1)) === 0) {
      let d = 0;
      for (let k = 1; k <= 9; k++) if (m & candMask(k)) { d = k; break; }
      return {
        technique: "Naked Single", category: "Single", score: 1.0,
        reason: `Naked Single: cell ${i} holds only candidate ${d}.`,
        placements: [{ cell: i, value: d }],
        eliminations: [],
        patternCells: [i], patternCands: [{ cell: i, cand: d }],
      };
    }
  }
  const cg = toCandidateGrid(g);
  
  // Singles (hidden before naked per his demo)
  const hiddenSingle = storm.hiddenSubsetStep(cg, 1);
  if (liveHint(hiddenSingle, g)) return fromHint(hiddenSingle, g);
  const nakedSingle = storm.nakedSingleStep(cg);
  if (liveHint(nakedSingle, g)) return fromHint(nakedSingle, g);
  
  // Box-line
  const boxLine = storm.boxLineStep(cg);
  if (liveHint(boxLine, g)) return fromHint(boxLine, g);
  
  // Subsets (hidden then naked, sizes 2-4)
  for (let k = 2; k <= 4; k++) {
    const hidden = storm.hiddenSubsetStep(cg, k as storm.SubsetSize);
    if (liveHint(hidden, g)) return fromHint(hidden, g);
    const naked = storm.nakedSubsetStep(cg, k as storm.SubsetSize);
    if (liveHint(naked, g)) return fromHint(naked, g);
  }
  
  // Fish (sizes 2-4)
  for (let size = 2; size <= 4; size++) {
    const fish = storm.fishStep(cg, [size as 2 | 3 | 4]);
    if (liveHint(fish, g)) return fromHint(fish, g);
  }
  
  // Chains (AIC). H-fix-chains: walk every chain; the first chain with a
  // live elimination wins. Previously only chains[0] was inspected and a
  // dead head chain nulled the entire Storm path -> silent old-FINDERS
  // fall-through mid-solve (techniques.ts:1611), mixing engine ratings.
  const chainReport = findAicChains(cg);
  for (const chain of chainReport.chains ?? []) {
    const eliminations: Elimination[] = chain.eliminations.map((e: ChainElimination) => ({
      cell: e.cell,
      cand: e.digit,
    }));
    const isLive = eliminations.some(
      (e) => g.values[e.cell] === 0 && (g.cands[e.cell] & candMask(e.cand)) !== 0,
    );
    if (!isLive) continue;
    const reason = formatChainEureka(chain);
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
    const rating = ratingForChain(chain, { desc: reason });
    return {
      technique: rating.tag,
      category: 'Chain',
      score: rating.value ?? 4.5,
      reason,
      placements: [],
      eliminations,
      patternCells: [],
      patternCands: [],
      candColors,
      links: [],
    };
  }
  return null;
}

