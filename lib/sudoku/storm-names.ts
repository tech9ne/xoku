// StormDoku chain classifier port. Face Hodoku, engine+taxonomy StormDoku.
// Steps = strong-link nodes (chain.ts:744-780): 'V' = bivalve-cell node
// (linkType 4), 'L' = bilocation node (linkType 0). Weak inferences are the
// edges between steps: 'S' = LOCAL (same cell), 'C' = SECTOR (peers),
// per WEAK_TYPE_NAMES = ['LOCAL','SECTOR'] (chain.ts:10).

import { isAlsKey } from './chain-tables';

export type StormStep = {
  token: 'V' | 'L' | 'A';
  linkType: 0 | 4;
  digits: number[];        // digits on the node's sides, in traversal order
  cells: number[];
  weakDigit: number | null; // weak edge leaving this step toward the next
  weakSameCell: boolean;    // true => 'S' (LOCAL), false => 'C' (SECTOR)
};

const cellOf = (n: number) => Math.floor(n / 10);
const digOf = (n: number) => n % 10;

// Adapt a xoku findAic path (node = cell*10+digit) to StormDoku steps.
export function toStormSteps(path: number[], isRing: boolean, t?: { alsNodes: { nodeKey: number; cells: number[] }[] }): StormStep[] {
  const steps: StormStep[] = [];
  for (let k = 0; k + 1 < path.length; k += 2) {
    const a = path[k], b = path[k + 1];
    const nxt = k + 2 < path.length ? path[k + 2] : (isRing ? path[0] : null);
    
    let token: 'V' | 'L' | 'A', linkType: 0 | 4, digits: number[], cells: number[];
    
    if (isAlsKey(a)) {
      token = 'A';
      linkType = 4;
      digits = [digOf(a)];
      cells = t?.alsNodes.find(n => n.nodeKey === a)?.cells ?? [];
    } else {
      const sameCell = cellOf(a) === cellOf(b);
      token = sameCell ? 'V' : 'L';
      linkType = sameCell ? 4 : 0;
      digits = sameCell ? [digOf(a), digOf(b)] : [digOf(a)];
      cells = sameCell ? [cellOf(a)] : [cellOf(a), cellOf(b)];
    }
    
    steps.push({
      token,
      linkType,
      digits,
      cells,
      weakDigit: nxt != null ? digOf(nxt) : null,
      weakSameCell: nxt != null ? (isAlsKey(b) ? false : cellOf(b) === cellOf(nxt)) : false,
    });
  }
  return steps;
}

export const chainPattern = (steps: StormStep[]) => steps.map(s => s.token).join('');

export function chainDigits(steps: StormStep[]): number[] {
  const set = new Set<number>();
  for (const s of steps) { for (const d of s.digits) set.add(d); if (s.weakDigit != null) set.add(s.weakDigit); }
  return [...set].sort((a, b) => a - b);
}

// cite chain.ts:1990-1997 (rotation + reflection equivalence)
export function ringPatternMatches(pattern: string, target: string): boolean {
  if (pattern.length !== target.length) return false;
  const variants = [pattern, [...pattern].reverse().join('')];
  return variants.some(v => [...v].some((_, i) => `${v.slice(i)}${v.slice(0, i)}` === target));
}

// weak-edge string over consecutive steps: 'S' local / 'C' sector
const weakPattern = (steps: StormStep[]) => steps.slice(0, -1).map(s => (s.weakSameCell ? 'S' : 'C')).join('');

// first-occurrence letter shape: [7,4,4,7] -> 'ABBA'
const digitShape = (ds: number[]) => {
  const map = new Map<number, string>();
  return ds.map(d => { if (!map.has(d)) map.set(d, String.fromCharCode(65 + map.size)); return map.get(d)!; }).join('');
};
const locationDigits = (steps: StormStep[]) => steps.map(s => s.digits[0]);

// cite chain.ts:1946-1969 (two-link open classifier; ERI/grouped absent in xoku)
function classifyTwoLinkXChain(steps: StormStep[]): string | null {
  if (steps.length !== 2 || steps.some(s => s.token !== 'L')) return null;
  if (chainDigits(steps).length !== 1) return null;
  const kind = (s: StormStep): 'R' | 'C' | 'B' => {
    const [a, b] = s.cells;
    if (Math.floor(a / 9) === Math.floor(b / 9)) return 'R';
    if (a % 9 === b % 9) return 'C';
    return 'B';
  };
  const k0 = kind(steps[0]), k1 = kind(steps[1]);
  if (k0 === k1 && k0 !== 'B') return 'Skyscraper';          // same Row or Column
  if ((k0 === 'R' && k1 === 'C') || (k0 === 'C' && k1 === 'R')) return '2-String Kite';
  return 'X-Chain';
}

// cite chain.ts:2079-2104 (inverted open wings)
function invertedWingName(steps: StormStep[]): string | null {
  if (steps.length !== 4 && steps.length !== 5) return null;
  if (chainPattern(steps) !== 'L'.repeat(steps.length)) return null;
  const digits = locationDigits(steps);
  const weak = weakPattern(steps);
  const variants = [
    { shape: digitShape(digits), weak },
    { shape: digitShape([...digits].reverse()), weak: [...weak].reverse().join('') },
  ];
  const patterns: Array<[string, string, string]> = [
    ['ABBA', 'CSC', 'iW-Wing'], ['AABB', 'SCS', 'iS-Wing'], ['ABBC', 'CCC', 'iM3-Wing'],
    ['ABBB', 'CSS', 'iH2-Wing'], ['ABBCC', 'CSSC', 'iH3-Wing'],
  ];
  for (const v of variants) for (const [shape, wp, name] of patterns)
    if (v.shape === shape && v.weak === wp) return name;
  return null;
}

// cite chain.ts:2106-2124 (inverted rings)
function invertedRingName(steps: StormStep[], ringWeakDigit: number | null): string | null {
  if (steps.length !== 4 && steps.length !== 5) return null;
  if (chainPattern(steps) !== 'L'.repeat(steps.length)) return null;
  const digits = locationDigits(steps);
  if (new Set(digits).size !== 2 || ringWeakDigit == null) return null;
  if (ringWeakDigit !== digits[0] && ringWeakDigit !== digits[digits.length - 1]) return null;
  const weak = weakPattern(steps);
  const allowedWeak = steps.length === 4 ? new Set(['CSC', 'SCS']) : new Set(['SSCS', 'CSCS']);
  if (!allowedWeak.has(weak)) return null;
  const allowed = steps.length === 4
    ? new Set(['ABBA', 'AABB']) : new Set(['AAABB', 'AABBB', 'ABBAA', 'AABBA']);
  return allowed.has(digitShape(digits)) || allowed.has(digitShape([...digits].reverse())) ? 'iW-Ring' : null;
}

// cite chain.ts:2207-2279 (dispatcher; ALS/ERI/grouped branches inert in xoku)
export function classifyStormChain(path: number[], isRing: boolean): string {
  const steps = toStormSteps(path, isRing);
  const digits = chainDigits(steps);
  if (isRing) {
    const pattern = chainPattern(steps);
    const inv = invertedRingName(steps, steps[steps.length - 1]?.weakDigit ?? null);
    if (inv) return inv;
    if (ringPatternMatches(pattern, 'VVVVL')) return 'Y-Ring';
    if (ringPatternMatches(pattern, 'VLVLL')) return 'W-Ring';
    if (ringPatternMatches(pattern, 'VVLL')) return 'H(2)-Ring';
    if (ringPatternMatches(pattern, 'VLL')) return 'M(2)-Ring';
    if (ringPatternMatches(pattern, 'VLLL')) return 'M(2)-Ring';
    if (ringPatternMatches(pattern, 'LLLLV')) return 'Strong-Ring';
    if (pattern.length > 0 && pattern.split('').every(t => t === 'L'))
      return `L(${Math.max(1, digits.length)})-Ring`;
    return 'AIC Ring';
  }
  const pattern = chainPattern(steps);
  const two = classifyTwoLinkXChain(steps);
  if (two) return two;
  const inv = invertedWingName(steps);
  if (inv) return inv;
  if (pattern === 'VVV' && digits.length === 3) return 'XY-Wing';
  if (pattern === 'VLV' && digits.length === 2) return 'W-Wing';
  if (pattern === 'VVL' && digits.length >= 2) return `H(${Math.min(3, digits.length)})-Wing`;
  if (pattern === 'VLL') {
    const shared = steps[0].digits[1] === steps[1].digits[0] ? steps[1].digits[0] : null;
    const last = steps[steps.length - 1];
    const lastDigits = last.digits;
    if (digits.length <= 2 && shared != null && lastDigits.includes(shared)) return 'H(1)-Wing';
    return `M(${Math.min(3, Math.max(2, digits.length))})-Wing`;
  }
  if (pattern === 'LLL') return `L(${Math.min(3, Math.max(1, digits.length))})-Wing`;
  if (pattern.length >= 3 && pattern.split('').every(t => t === 'V')) return 'XY-Chain';
  return 'AIC';
}
