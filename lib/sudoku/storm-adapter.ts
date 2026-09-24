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
// cite: stormdoku index.html ratingDefinition table (verbatim values)
function techToScore(tech: string, reason?: string): number {
  const t = tech.toLowerCase();
  // Singles & basics
  if (t.includes('single') || t.includes('last-man')) return t.includes('last') ? 0 : 1;
  if (t.includes('box-line') || t.includes('pointing') || t.includes('claiming')) return 1;
  // Pairs & X-Wing
  if (t.includes('pair') || t === 'x-wing' || t.includes('aic x-wing')) return 2;
  // Triples & Swordfish
  if (t.includes('triple') || t.includes('swordfish')) return 3;
  // Quads & Jellyfish
  if (t.includes('quad') || t.includes('jellyfish')) return 4;
  // Fish variants (Franken/Mutant/K-fish)
  if (t.includes('fish')) {
    if (reason && /franken|mutant/i.test(reason)) {
      const kMatch = reason.match(/k(\d+)/i);
      const k = kMatch ? parseInt(kMatch[1]) : 0;
      const sizeMatch = reason.match(/(\d+)x(\d+)/);
      const size = sizeMatch ? parseInt(sizeMatch[1]) : 2;
      if (size <= 2) return 2.125 + k * 0.125;
      if (size <= 3) return 3.125 + k * 0.125;
      if (size <= 4) return 4.125 + k * 0.125;
      return 5.125 + k * 0.125;
    }
    if (reason && /finned|sashimi/i.test(reason)) return 2.25;
    return t.includes('x-wing') ? 2 : t.includes('swordfish') ? 3 : 4;
  }
  // Skyscraper, 2-String Kite, Empty Rectangle
  if (t.includes('skyscraper') || t.includes('2-string') || t.includes('empty-rect') || t.includes('kite')) return 2.25;
  // Wings & Rings
  if (t.includes('wing') || t.includes('ring')) {
    if (t.includes('l(1)') || t.includes('xy-wing') || t.includes('xy-ring') || t.includes('barns xyz')) return 3.25;
    if (t.includes('l(2)') || t.includes('l(3)') || t.includes('w-wing') || t.includes('s-wing') || 
        t.includes('m(2)') || t.includes('m(3)') || t.includes('h(1)') || t.includes('h(2)') || t.includes('h(3)')) return 6;
    return 3.25; // default wing
  }
  // ERI chains
  if (t.includes('eri')) {
    if (reason && /3x/.test(reason)) return 3.25;
    if (reason && /4x/.test(reason)) return 4.25;
    return 5;
  }
  // Remote Pair, XY-Chain
  if (t.includes('remote-pair') || t.includes('xy-chain')) return 5;
  // ALS techniques
  if (t.includes('als')) {
    if (t.includes('chain')) return 10;
    if (t.includes('t-als-xy') || t.includes('aic')) return 9;
    if (t.includes('t-als-xz') || t.includes('als-xy')) return 8;
    if (t.includes('als-xz')) return 7;
    if (t.includes('dof') || t.includes('dds') || t.includes('adds')) return 11;
    return 8;
  }
  // AIC chains (default)
  if (t.includes('aic') || t.includes('chain')) return 4.5;
  // Fallback
  return 5;
}

// Convert one Hint to our Step shape.
// cite: lib/sudoku/storm/sudoku.ts:56 (Hint interface)
function fromHint(h: storm.Hint, g: Game): Step {
  const technique = techToName(h.tech);
  const category = techToCategory(h.tech);
  const score = techToScore(h.tech, h.desc);
  
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
    return {
      technique: 'AIC',
      category: 'Chain',
      score: techToScore('AIC', reason),
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

