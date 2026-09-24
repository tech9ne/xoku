// StormDoku rater - verbatim TypeScript port of his rating layer.
// Source: ~/stormdoku/index.html. Values, branch order, regexes are his;
// only type annotations are ours. Branch order is load-bearing.
// e1 scope: ratingForChain omits his helper-based branches (B.A.R.N.S.,
// transport, ERI-count, size-one, hiddenXY) with explicit e1b markers.
// No values invented; gaps are visible and land in e1b.

// Structural subset of his chain object the rater reads. The vendored
// ChainResult (lib/sudoku/storm/chain.ts ChainResult) satisfies it.
export interface ChainLike {
  structureName?: string;
  isRing?: boolean;
  length?: number;
  steps?: ReadonlyArray<unknown>;
  uniqueDigits?: number[];
  uniqueDigitCount?: number;
}

// Structural subset of his step object ratingForStep reads.
export interface StepLike {
  tech?: string;
  name?: string;
  category?: string;
  size?: number;
  k?: number;
  mode?: string;
  chainForm?: string;
  isRing?: boolean;
  primaryA?: { dof?: number };
  desc?: string;
  chain?: ChainLike;
}

// cite: index.html:8181 RATING_CATEGORY_RANKS (verbatim)
export const RATING_CATEGORY_RANKS: Record<string, number> = {
  Any: -1,
  Lulz: 0,
  'Extremely Easy': 10,
  'Very Easy': 20,
  'Modestly Easy': 30,
  Easy: 40,
  Moderate: 50,
  Tough: 60,
  Challenging: 70,
  Irritating: 80,
  Frustrating: 90,
  Hard: 100,
  Demanding: 110,
  Expert: 120,
  Brutal: 130,
  Nightmare: 140,
  Abyssal: 150,
  Transcendent: 160,
  Unknown: Number.POSITIVE_INFINITY,
};
// rater chunk R1 ok

// cite: index.html:8203 RATING_CATEGORY_SCORE_BANDS (verbatim, disjoint)
export const RATING_CATEGORY_SCORE_BANDS: ReadonlyArray<{
  category: string; min: number; max: number;
}> = [
  { category: 'Lulz', min: 0, max: 0 },
  { category: 'Extremely Easy', min: 1, max: 1.5 },
  { category: 'Very Easy', min: 2, max: 2 },
  { category: 'Modestly Easy', min: 2.001, max: 2.999 },
  { category: 'Easy', min: 3, max: 3 },
  { category: 'Moderate', min: 3.001, max: 3.999 },
  { category: 'Tough', min: 4, max: 4 },
  { category: 'Challenging', min: 4.001, max: 4.999 },
  { category: 'Irritating', min: 5, max: 5.999 },
  { category: 'Frustrating', min: 6, max: 6.999 },
  { category: 'Hard', min: 7, max: 7.999 },
  { category: 'Demanding', min: 8, max: 8.999 },
  { category: 'Expert', min: 9, max: 9.999 },
  { category: 'Brutal', min: 10, max: 10.999 },
  { category: 'Nightmare', min: 11, max: 11.999 },
  { category: 'Abyssal', min: 12, max: 12.999 },
  { category: 'Transcendent', min: 13, max: 14.999 },
];

// cite: index.html normalizeRatingCategory (verbatim)
export function normalizeRatingCategory(category: unknown): string {
  const value = String(category ?? '').trim();
  if (!value || /^any$/i.test(value)) return 'Any';
  if (/^unknown$/i.test(value)) return 'Unknown';
  return value;
}
// rater chunk R2 ok

// cite: index.html ratingCategoryForValue (verbatim, inclusive bounds)
export function ratingCategoryForValue(value: unknown, fallback = 'Unknown'): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const band = RATING_CATEGORY_SCORE_BANDS.find(
    ({ min, max }) => numeric >= min && numeric <= max,
  );
  return band?.category || fallback;
}

// cite: index.html ratingDefinition (verbatim after generationTechniqueProfile).
// Deviation: tech key always present (null when absent) for TS typing;
// behavior-identical to his conditional spread.
export function ratingDefinition(
  category: string, value: number, tag: string,
  tech: string | null = null, rank: number | null = null,
) {
  return {
    category,
    rank: rank ?? RATING_CATEGORY_RANKS[normalizeRatingCategory(category)] ?? RATING_CATEGORY_RANKS.Unknown,
    value,
    tag,
    tech,
  };
}

// cite: index.html unknownRating (verbatim, DIFFICULTY_TABLE window)
export function unknownRating(move = '') {
  return {
    rank: RATING_CATEGORY_RANKS.Unknown,
    value: null as number | null,
    tag: 'Unknown',
    category: 'Unknown',
    hardestMove: move,
    cycles: 0,
    score: 0,
    scoredMoves: 0,
    source: 'run',
  };
}

// cite: index.html RATING_TAGS (verbatim, 13 basics)
const RATING_TAGS = Object.freeze([
  ratingDefinition('Lulz', 0, 'Last Man Standing', 'last-man-standing'),
  ratingDefinition('Extremely Easy', 1, 'Hidden Single', 'hidden-single'),
  ratingDefinition('Extremely Easy', 1, 'Naked Single', 'naked-single'),
  ratingDefinition('Extremely Easy', 1, 'Box - Line Reduction', 'box-line'),
  ratingDefinition('Very Easy', 2, 'Hidden Pair', 'hidden-pair'),
  ratingDefinition('Very Easy', 2, 'Naked Pair', 'naked-pair'),
  ratingDefinition('Very Easy', 2, 'X-Wing', 'x-wing'),
  ratingDefinition('Easy', 3, 'Hidden Triple', 'hidden-triple'),
  ratingDefinition('Easy', 3, 'Naked Triple', 'naked-triple'),
  ratingDefinition('Easy', 3, 'SwordFish', 'swordfish'),
  ratingDefinition('Tough', 4, 'Hidden Quad', 'hidden-quad'),
  ratingDefinition('Tough', 4, 'Naked Quad', 'naked-quad'),
  ratingDefinition('Tough', 4, 'JellyFish', 'jellyfish'),
]);
// rater chunk R3 ok

// cite: index.html fishScoreForSize (verbatim, DIFFICULTY_TABLE window)
export function fishScoreForSize(size: number, k = 0, fishCategory = 'Basic'): number | null {
  const fishSize = Number(size);
  const fishK = Number(k);
  if (!Number.isInteger(fishSize) || fishSize < 2
    || !Number.isInteger(fishK) || fishK < 0) return null;
  if (fishSize > 7 || fishK > 2) return null;
  const modifier = String(fishCategory || 'Basic').toLowerCase();
  const shapeModifier = modifier === 'franken'
    ? 0.125
    : modifier === 'mutant'
      ? 0.25
      : 0;
  return Number((fishSize + fishK * 0.25 + shapeModifier).toFixed(3));
}

// cite: index.html chainLengthOf (verbatim)
export function chainLengthOf(chain: ChainLike | null): number {
  return Number(chain?.length || chain?.steps?.length || 0);
}

// cite: index.html:8622 chainMathScore (verbatim). Vendored ChainResult
// carries no uniqueDigits, so digitExcess is always 0 here - his own
// graceful degradation, kept verbatim; e1b wires the field.
export function chainMathScore(
  baseScore: number, chain: ChainLike,
  canonicalLength = baseScore, canonicalDigits = baseScore,
): number {
  const length = chainLengthOf(chain);
  const actualDigits = Array.isArray(chain?.uniqueDigits)
    ? chain.uniqueDigits.length
    : Number(chain?.uniqueDigitCount);
  const digitExcess = Number.isFinite(actualDigits)
    ? Math.max(0, actualDigits - canonicalDigits)
    : 0;
  const lengthExcess = Number.isFinite(length)
    ? Math.max(0, length - canonicalLength)
    : 0;
  const closure = chain?.isRing ? 0.5 : 0.25;
  return Number((baseScore + lengthExcess + digitExcess + closure).toFixed(3));
}
// rater chunk R4 ok

// cite: index.html:8782 alsDofScore (verbatim)
function alsDofScore(step: StepLike): number {
  const dof = Math.max(1, Number(step?.size ?? step?.primaryA?.dof ?? 1));
  const dofShift = 0.25 * Math.max(0, dof - 1);
  if (step?.mode === 'almost-dds') return 12 + dofShift + 0.75;
  if (step?.mode === 'dds') return 12 + dofShift + (step.isRing ? 0.5 : 0);
  return 12 + dofShift + (step?.isRing ? 0.5 : 0);
}

// cite: index.html:8825 ratingForStep (verbatim incl. als-dof branch)
export function ratingForStep(step: StepLike) {
  const tech = String(step?.tech || '');
  if (tech === 'chain') {
    return ratingForChain(step.chain || (step as unknown as ChainLike), step);
  }
  if (tech === 'als-dof') {
    const isChain = step.mode === 'chain' || !!step.chainForm;
    const score = isChain ? 13 + (step.isRing ? 0.5 : 0) : alsDofScore(step);
    const category = isChain ? 'Transcendent' : ratingCategoryForValue(score);
    const label = isChain
      ? (step.mode === 'almost-dds' ? 'ADDS - Chain' : 'DDS - Chain')
      : step.mode === 'almost-dds'
        ? 'Almost DDS'
        : step.mode === 'dds'
          ? 'DDS'
          : 'ALS - DOF';
    return {
      ...ratingDefinition(category, score, `${label}${step.isRing ? ' Ring' : ''}`),
      hardestMove: step.desc || '',
    };
  }
  const direct = RATING_TAGS.find(definition => definition.tech === tech);
  if (direct) {
    return {
      rank: direct.rank, value: direct.value, tag: direct.tag,
      category: direct.category, hardestMove: step.desc || '',
    };
  }
  if (tech === 'pointing' || tech === 'claiming') {
    return {
      ...ratingDefinition('Extremely Easy', 1, 'Box - Line Reduction'),
      hardestMove: step.desc || '',
    };
  }
  const subsetMatch = /^(hidden|naked)-(single|pair|triple|quad|quintuple|sextuple|septuple|octuple|nontuple)$/i.exec(tech);
  if (subsetMatch) {
    const kind = subsetMatch[1].toLowerCase();
    const names: Record<string, [string, string]> = {
      single: ['Hidden Single', 'Naked Single'],
      pair: ['Hidden Pair', 'Naked Pair'],
      triple: ['Hidden Triple', 'Naked Triple'],
      quad: ['Hidden Quad', 'Naked Quad'],
      quintuple: ['Hidden Quintuple', 'Naked Quintuple'],
      sextuple: ['Hidden Sextuple', 'Naked Sextuple'],
      septuple: ['Hidden Septuple', 'Naked Septuple'],
      octuple: ['Hidden Octuple', 'Naked Octuple'],
      nontuple: ['Hidden Nontuple', 'Naked Nontuple'],
    };
    const sizes: Record<string, number> = {
      single: 1, pair: 2, triple: 3, quad: 4, quintuple: 5,
      sextuple: 6, septuple: 7, octuple: 8, nontuple: 9,
    };
    const size = sizes[subsetMatch[2].toLowerCase()] || 0;
    if (size > 0) {
      const value = size === 1 ? 1 : size;
      return {
        ...ratingDefinition(ratingCategoryForValue(value), value,
          names[subsetMatch[2].toLowerCase()][kind === 'hidden' ? 0 : 1]),
        hardestMove: step.desc || '',
      };
    }
  }
  if (tech === 'fish') {
    const size = Number(step?.size);
    const k = Number(step?.k || 0);
    const fishCategory = step?.category || 'Basic';
    const value = fishScoreForSize(size, k, fishCategory);
    if (value !== null && Number.isFinite(value)) {
      const category = ratingCategoryForValue(value);
      const shape = fishCategory === 'Basic' && k === 0
        ? ({ 2: 'X-Wing', 3: 'SwordFish', 4: 'JellyFish' }[size] || `${size}x${size} Fish`)
        : `${fishCategory} ${size}x${size}+K${k} Fish`;
      return {
        ...ratingDefinition(category, value, shape),
        hardestMove: step.desc || '',
      };
    }
  }
  return unknownRating(step?.desc || '');
}
// rater chunk R5 ok

// cite: index.html:8637 ratingForChain. e1 ports his branch ORDER and
// regex branches verbatim. Helper-based branches pending e1b, cited:
//   barnsTransportChainInfo  index.html:10306
//   barnsChainInfo           index.html:10276
//   chainEriCount block      index.html:10094
//   alsSizeOneChainInfo      index.html:10339
//   hiddenXyChainInfo        index.html:10405
// A chain his helpers would reclassify falls through to the generic
// ALS / X-Chain branch here - visible, never invented.
export function ratingForChain(chain: ChainLike | null, step: StepLike = chain as StepLike) {
  if (!chain) return unknownRating(step?.desc || '');
  const fullName = String(chain.structureName || 'AIC');
  const name = fullName
    .replace(/^\s*(?:AIC\s*\+\s*ALS|ALS|AHS|ALC)\s*-\s*/i, '')
    .trim();
  const ringBonus = chain.isRing ? 0.5 : 0;
  const ringSuffix = chain.isRing ? ' Ring' : '';
  const define = (category: string, value: number, tag = name) => ({
    ...ratingDefinition(category, value, tag),
    hardestMove: step?.desc || '',
  });
  // e1b pending: B.A.R.N.S. transport branch
  // e1b pending: B.A.R.N.S. wing/ring branch
  if (/^T\s*-\s*ALS\s*-\s*XY$/i.test(fullName)) {
    return define('Expert', 9 + ringBonus, `T-ALS-XY${ringSuffix}`);
  }
  if (/^T\s*-\s*ALS\s*-\s*XZ$/i.test(fullName)) {
    return define('Demanding', 8 + ringBonus, `T-ALS-XZ${ringSuffix}`);
  }
  if (/^AIC\s*\+\s*ALS(?:\s*-\s*Chain)?$/i.test(fullName)) {
    return define('Nightmare', 11 + ringBonus, `AIC + ALS Chain${ringSuffix}`);
  }
  if (/^ALS\s*-\s*Chain$/i.test(fullName)) {
    return define('Brutal', 10 + ringBonus, `ALS Chain${ringSuffix}`);
  }
  if (/^ALS\s*-\s*XY$/i.test(fullName)) {
    return define('Demanding', 8 + ringBonus, `ALS - XY${ringSuffix}`);
  }
  if (/^ALS\s*-\s*XZ$/i.test(fullName)) {
    return define('Hard', 7 + ringBonus, `ALS - XZ${ringSuffix}`);
  }
  const isAicAls = /^AIC\s*\+\s*ALS(?:\s*-|$)/i.test(fullName);
  const alsNamed = (isAicAls || /^ALS\s*-/i.test(fullName))
    && /(?:Wing|Ring)$/i.test(name);
  if (alsNamed && !/^ALS\s*-\s*(?:XZ|XY|Chain)$/i.test(fullName)) {
    return define('Expert', 9 + ringBonus, `ALS - ${name}${ringSuffix}`);
  }
  // e1b pending: generic ERI-count block
  // e1b pending: size-one ALS reclassification (Remote Pair / XY-Wing / XY-Chain)
  // e1b pending: hidden XY-Chain / Hidden Remote Pair
  if (/^XY-Wing$/i.test(name)) {
    const value = chainMathScore(3, chain, 3, 3);
    return define(ratingCategoryForValue(value), value, `XY-Wing${ringSuffix}`);
  }
  if (/^W\s*-?\s*Transport$/i.test(name) || /W\s*-?\s*Transport/i.test(fullName)) {
    return define('Frustrating', 6.5 + ringBonus, `W Transport${ringSuffix}`);
  }
  if (/^(?:2-String Kite|Empty Rectangle|Skyscraper|Finned X-Wing|Sashimi X-Wing)$/i.test(name)) {
    const value = chainMathScore(2, chain, 2, 2);
    return define(ratingCategoryForValue(value), value, `${name}${ringSuffix}`);
  }
  if (/(?:^|-)\s*(?:Dual Empty Rectangle|Rec'T Kite|Bridged Empty Rectangle|Bridged ERI|3x ERI|L\(1\)-Wing|L1-Wing)$/i.test(name)) {
    const value = chainMathScore(3, chain, 3, 3);
    return define(ratingCategoryForValue(value), value, `${name}${ringSuffix}`);
  }
  if (/(?:^|-)\s*4x ERI$/i.test(name)) {
    const value = chainMathScore(4, chain, 4, 1);
    return define(ratingCategoryForValue(value), value, `${name}${ringSuffix}`);
  }
  if (/^X-Wing$/i.test(name)) return define('Very Easy', 2, 'AIC X-Wing');
  if (/^(?:L\([23]\)|L[23]|S|M(?:\(\d+\))?|H(?:\(\d+\))?|W)-?(?:Wing|Ring)$/i.test(name)
    || /^i[SWMLH]/i.test(name)) {
    return define('Frustrating', 6 + ringBonus, `${name}${ringSuffix}`);
  }
  const length = chainLengthOf(chain);
  if (length >= 2) {
    const base = length > 4 ? 5 : length;
    const value = chainMathScore(base, chain, length > 4 ? 5 : length, length);
    return define(ratingCategoryForValue(value), value,
      `X-Chain (Depth ${length})${ringSuffix}`);
  }
  return unknownRating(step?.desc || '');
}
// rater chunk R6 ok
