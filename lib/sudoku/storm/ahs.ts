import { UNITS } from './cardinals';
import { candidateDigits, combinations, powerSetIndexes } from './set-tools';
import type { CandidateGrid } from './sudoku';

export interface AhsRcc {
  rccCell: number;
  rccDigits: number[];
  rccPotentialElim: number[];
  rccSectors: number[];
}

export interface Ahs {
  ahsSector: number;
  ahsSize: number;
  ahsFOX: number;
  ahsDOF: number;
  ahsDigits: number[];
  ahsAllCells: number[];
  PowerSet: number;
  cellPowerSet: number;
  rccList: AhsRcc[];
  uniqueID: string;
}

export interface AhsBuilderOptions {
  maxSize?: number;
  maxSizeFox?: number;
  searchLimit?: boolean;
  sizeLimit?: boolean;
}

const DUPLICATES_A = new Set([9, 10, 17, 30, 31, 35, 42, 43, 44]);
const DUPLICATES_B = new Set([45, 109, 128]);
let nextAhsId = 0;

function boxEnforcer(sector: number, powerSetIndex: number, dof: number): boolean {
  if (sector >= 18 || dof <= 0) return false;
  return DUPLICATES_A.has(powerSetIndex) || DUPLICATES_B.has(powerSetIndex);
}

function candidateCellsForDigits(
  cand: CandidateGrid,
  sectorCells: readonly number[],
  digits: readonly number[],
): number[] {
  const selected = new Set(digits);
  return sectorCells.filter(cell => (cand[cell] ?? []).some(digit => selected.has(digit)));
}

function containsNakedSubset(
  cand: CandidateGrid,
  cells: readonly number[],
  hiddenDigits: readonly number[],
): boolean {
  const allowed = new Set(hiddenDigits);
  for (let size = 1; size < cells.length; size++) {
    for (const subset of combinations(cells, size)) {
      const subsetDigits = candidateDigits(cand, subset);
      if (subsetDigits.length === size && subsetDigits.some(digit => !allowed.has(digit))) return true;
    }
  }
  return false;
}

function containsDofZeroSubset(
  cand: CandidateGrid,
  cells: readonly number[],
  digits: readonly number[],
): boolean {
  // An AHS is defined by its selected digits. Reject it when a proper
  // digit subset is already confined to the same number of cells; that
  // smaller hidden subset owns the structure instead.
  for (let size = 1; size < digits.length; size++) {
    for (const subset of combinations(digits, size)) {
      if (candidateCellsForDigits(cand, cells, subset).length === size) return true;
    }
  }
  return false;
}

function normaliseOptions(options: AhsBuilderOptions) {
  return {
    maxSize: Number.isInteger(options.maxSize) ? Math.max(0, Math.min(8, options.maxSize!)) : 8,
    maxSizeFox: Number.isInteger(options.maxSizeFox) ? Math.max(0, Math.min(8, options.maxSizeFox!)) : 7,
    searchLimit: options.searchLimit ?? false,
    sizeLimit: options.sizeLimit ?? false,
  };
}

function buildAhs(
  cand: CandidateGrid,
  sector: number,
  positionSize: number,
  fox: number,
  digits: number[],
  cells: number[],
  digitPowerSet: number,
  cellPowerSet: number,
): Ahs {
  const selected = new Set(digits);
  const rccList: AhsRcc[] = cells.map(cell => ({
    rccCell: cell,
    rccDigits: (cand[cell] ?? []).filter(digit => !selected.has(digit)),
    rccPotentialElim: [cell],
    rccSectors: [sector],
  }));

  return {
    ahsSector: sector,
    ahsSize: positionSize,
    ahsFOX: fox,
    ahsDOF: fox - positionSize,
    ahsDigits: [...digits],
    ahsAllCells: [...cells],
    PowerSet: digitPowerSet,
    cellPowerSet,
    rccList,
    uniqueID: `ahs-${nextAhsId++}`,
  };
}

export function ahsConstructor(cand: CandidateGrid, options: AhsBuilderOptions = {}): Ahs[] {
  nextAhsId = 0;
  const opts = normaliseOptions(options);
  const ahsList: Ahs[] = [];

  for (let sector = 0; sector < UNITS.length; sector++) {
    const sectorCells = UNITS[sector];
    const activeCells = sectorCells.filter(cell => (cand[cell] ?? []).length > 0);
    const sectorDigits = candidateDigits(cand, activeCells);
    if (!activeCells.length) continue;

    for (let positionSize = 0; positionSize <= opts.maxSize; positionSize++) {
      const digitCount = positionSize + 1;
      if (digitCount > sectorDigits.length) continue;

      for (const digits of combinations(sectorDigits, digitCount)) {
        // PowerSet indexes use the absolute digit positions 0..8, not the
        // compressed list of digits present in this sector.
        const digitPositions = digits.map(digit => digit - 1);
        const digitPowerSet = powerSetIndexes.get(digitPositions.join(','));
        if (digitPowerSet === undefined) continue;

        const cells = candidateCellsForDigits(cand, activeCells, digits);
        const cellCount = cells.length;
        const fox = cellCount - 1;
        const dof = fox - positionSize;
        if (fox < positionSize || fox > opts.maxSizeFox + 1) continue;
        if (opts.searchLimit && dof !== 1) continue;
        if (opts.sizeLimit && dof > 0) continue;
        if (containsNakedSubset(cand, cells, digits)) continue;
        if (dof > 0 && containsDofZeroSubset(cand, cells, digits)) continue;
        const cellPositions = cells.map(cell => sectorCells.indexOf(cell));
        const cellPowerSet = powerSetIndexes.get(cellPositions.join(','));
        if (cellPowerSet === undefined) continue;
        if (boxEnforcer(sector, cellPowerSet, dof)) continue;
        ahsList.push(buildAhs(cand, sector, positionSize, fox, digits, cells, digitPowerSet, cellPowerSet));
      }
    }
  }

  return ahsList;
}
