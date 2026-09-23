// StormDoku engine adapter: his Hint → our Step, preserving UI shape.
// Gate: STORM_ENGINE env flag (default false until parity gate passes).

import { Game, Step, Elimination, candMask, StepCategory } from "./core";
import * as storm from "./storm/sudoku";
import { findAicChains, formatChainEureka, ChainElimination } from "./storm/chain";

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

// Map his Tech enum to our technique strings.
function techToName(tech: string): string {
  const map: Record<string, string> = {
    'hidden-single': 'Hidden Single',
    'naked-single': 'Naked Single',
    'box-line': 'Box-Line Reduction',
    'hidden-pair': 'Hidden Pair',
    'naked-pair': 'Naked Pair',
    'hidden-triple': 'Hidden Triple',
    'naked-triple': 'Naked Triple',
    'hidden-quad': 'Hidden Quad',
    'naked-quad': 'Naked Quad',
    'x-wing': 'X-Wing',
    'swordfish': 'Swordfish',
    'jellyfish': 'Jellyfish',
    'aic': 'AIC',
    'remote-pair': 'Remote Pair',
  };
  return map[tech] || tech;
}

// Derive category from tech.
function techToCategory(tech: string): StepCategory {
  if (tech.includes('single')) return 'Single';
  if (tech.includes('pair') || tech.includes('triple') || tech.includes('quad')) return 'Subset';
  if (tech.includes('wing') || tech.includes('chain') || tech.includes('aic')) return 'Chain';
  if (tech.includes('fish') || tech.includes('x-wing')) return 'Fish';
  if (tech.includes('box-line') || tech.includes('locked')) return 'Locked Candidates';
  return 'Chain'; // fallback
}

// Score mapping (XR scores for his tech).
function techToScore(tech: string): number {
  const scores: Record<string, number> = {
    'hidden-single': 1.0,
    'naked-single': 1.0,
    'box-line': 1.5,
    'hidden-pair': 2.0,
    'naked-pair': 2.0,
    'hidden-triple': 3.0,
    'naked-triple': 3.0,
    'hidden-quad': 4.0,
    'naked-quad': 4.0,
    'x-wing': 3.5,
    'swordfish': 4.5,
    'jellyfish': 5.4,
    'aic': 4.5,
    'remote-pair': 5.25,
  };
  return scores[tech] || 5.0;
}

// Convert one Hint to our Step shape.
// cite: lib/sudoku/storm/sudoku.ts:56 (Hint interface)
function fromHint(h: storm.Hint, g: Game): Step {
  const technique = techToName(h.tech);
  const category = techToCategory(h.tech);
  const score = techToScore(h.tech);
  
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
export function stormFindNextStep(g: Game): Step | null {
  // Implicit resolve pass. Storm's state model is candidate-grid-only: a
  // cell reduced to one candidate IS placed (his nakedSingleStep returns
  // null once no peer eliminations remain, sudoku.ts:658-671). Our state
  // needs an explicit placement step, so emit it here.
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
  if (hiddenSingle) return fromHint(hiddenSingle, g);
  const nakedSingle = storm.nakedSingleStep(cg);
  if (nakedSingle) return fromHint(nakedSingle, g);
  
  // Box-line
  const boxLine = storm.boxLineStep(cg);
  if (boxLine) return fromHint(boxLine, g);
  
  // Subsets (hidden then naked, sizes 2-4)
  for (let k = 2; k <= 4; k++) {
    const hidden = storm.hiddenSubsetStep(cg, k as storm.SubsetSize);
    if (hidden) return fromHint(hidden, g);
    const naked = storm.nakedSubsetStep(cg, k as storm.SubsetSize);
    if (naked) return fromHint(naked, g);
  }
  
  // Fish (sizes 2-4)
  for (let size = 2; size <= 4; size++) {
    const fish = storm.fishStep(cg, [size as 2 | 3 | 4]);
    if (fish) return fromHint(fish, g);
  }
  
  // Chains (AIC)
  const chainReport = findAicChains(cg);
  if (chainReport.chains && chainReport.chains.length > 0) {
    const chain = chainReport.chains[0];
    const reason = formatChainEureka(chain);
    const eliminations: Elimination[] = chain.eliminations.map((e: ChainElimination) => ({
      cell: e.cell,
      cand: e.digit
    }));
    
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
    
    return {
      technique: 'AIC',
      category: 'Chain',
      score: 4.5,
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

