import { peersOf, type CandidateGrid } from './sudoku';

export const POWERSET_OFFSETS = [0, 9, 45, 129, 255, 381, 465, 501, 510] as const;

export function sortedUnique(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

export function intersection(left: readonly number[], right: readonly number[]): number[] {
  const rightSet = new Set(right);
  return left.filter(value => rightSet.has(value));
}

export function union(left: readonly number[], right: readonly number[]): number[] {
  return sortedUnique([...left, ...right]);
}

export function combinations<T>(values: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  const current: T[] = [];
  if (size < 0 || size > values.length) return out;

  const visit = (start: number): void => {
    if (current.length === size) {
      out.push([...current]);
      return;
    }

    for (let index = start; index < values.length; index++) {
      current.push(values[index]);
      visit(index + 1);
      current.pop();
    }
  };

  visit(0);
  return out;
}

export function buildPowerSetIndexes(): Map<string, number> {
  const indexes = new Map<string, number>();
  for (let size = 1; size <= 9; size++) {
    const positions = Array.from({ length: 9 }, (_, index) => index);
    combinations(positions, size).forEach((combo, rank) => {
      indexes.set(combo.join(','), POWERSET_OFFSETS[size - 1] + rank);
    });
  }
  return indexes;
}

export const powerSetIndexes = buildPowerSetIndexes();

export function candidateDigits(cand: CandidateGrid, cells: readonly number[]): number[] {
  const digits = new Set<number>();
  for (const cell of cells) for (const digit of cand[cell] ?? []) digits.add(digit);
  return [...digits].sort((a, b) => a - b);
}

export function peerPotentialEliminations(
  cand: CandidateGrid,
  digit: number,
  sourceCells: readonly number[],
): number[] {
  if (!sourceCells.length) return [];
  const sourceSet = new Set(sourceCells);
  const out: number[] = [];

  for (let cell = 0; cell < 81; cell++) {
    if (sourceSet.has(cell) || !(cand[cell] ?? []).includes(digit)) continue;
    if (sourceCells.every(source => peersOf(source).includes(cell))) out.push(cell);
  }

  return out;
}

export function sectorsForRcc(
  cand: CandidateGrid,
  digit: number,
  sourceCells: readonly number[],
  sector: number,
  units: readonly number[][],
): number[] {
  const sectors = [sector];

  for (let other = 0; other < units.length; other++) {
    if (other === sector) continue;
    const locations = units[other].filter(cell => (cand[cell] ?? []).includes(digit));
    if (sourceCells.every(cell => locations.includes(cell))) sectors.push(other);
  }

  return sectors;
}
