import {
  boxLineStepM,
  buildSpaces,
  fishStepM,
  HIDDEN_TECH,
  hiddenStepM,
  type FishSearchOptions,
  type SectorState,
} from './spaces';
import { Bset, Cset, PEERS, Rset, UNITS as CARDINAL_UNITS } from './cardinals';

export type Grid = number[];
export type CandidateGrid = number[][];

export interface Parsed729Data {
  bits: number[];
  sourceCandidates: CandidateGrid;
  candidates: CandidateGrid;
  spaces: number[][];
  givenBySector: SectorState;
  grid: Grid;
  givenCells: number[];
  conflicts: { cell: number; digits: number[] }[];
  valid: boolean;
}
export type SubsetSize = 1 | 2 | 3 | 4;
export type HouseType = 'row' | 'col' | 'box';

export interface HouseRef {
  type: HouseType;
  indices: number[];
}

export type Tech =
  | 'naked-single'
  | 'hidden-single'
  | 'naked-pair'
  | 'hidden-pair'
  | 'naked-triple'
  | 'hidden-triple'
  | 'naked-quad'
  | 'hidden-quad'
  | 'pointing'
  | 'claiming'
  | 'fish';

export interface CandidateRemoval {
  cell: number;
  digit: number;
}

export type Elimination =
  | { cells: number[]; digits: number[] }
  | { items: CandidateRemoval[] };

export interface Hint {
  tech: Tech;
  desc: string;
  name?: string;
  category?: string;
  size?: number;
  k?: number;
  elim: Elimination;
  digits?: number[];
  at?: number[];
  base?: HouseRef;
  cover?: HouseRef;
  baseSectors?: number[];
  coverSectors?: number[];
  vertices?: number[];
  fins?: number[];
  endofins?: number[];
  overcovered?: number[];
  triCovered?: number[];
}

export interface ReductionResult {
  cand: CandidateGrid;
  steps: Hint[];
  removed: CandidateRemoval[];
  cycles: number;
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const ROWS: number[][] = Rset;
export const COLS: number[][] = Cset;
export const BOXES: number[][] = Bset;

export const UNITS: number[][] = CARDINAL_UNITS;

export const peersOf = (cell: number): number[] => PEERS[cell] ?? [];

export function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function candidatesFor(grid: Grid, cell: number): number[] {
  if (grid[cell]) return [];
  const used = new Set(PEERS[cell].map(peer => grid[peer]));
  return DIGITS.filter(digit => !used.has(digit));
}

export function allCandidates(grid: Grid): CandidateGrid {
  return grid.map((value, cell) => (value ? [] : candidatesFor(grid, cell)));
}

function canPlace(grid: Grid, cell: number, digit: number): boolean {
  return PEERS[cell].every(peer => grid[peer] !== digit);
}

export function countSolutions(grid: Grid, limit = 2): number {
  let bestCount = Infinity;
  let bestCell = -1;

  for (let cell = 0; cell < 81; cell++) {
    if (grid[cell]) continue;
    const count = candidatesFor(grid, cell).length;
    if (count < bestCount) {
      bestCount = count;
      bestCell = cell;
      if (count <= 1) break;
    }
  }

  if (bestCell === -1) return 1;
  if (bestCount === 0) return 0;

  let found = 0;
  for (const digit of candidatesFor(grid, bestCell)) {
    grid[bestCell] = digit;
    found += countSolutions(grid, limit - found);
    grid[bestCell] = 0;
    if (found >= limit) return found;
  }

  return found;
}

export interface DlxResult {
  count: number;
  solution: Grid | null;
}

export function solveDlx(grid: Grid, limit = 2): DlxResult {
  if (grid.length !== 81) return { count: 0, solution: null };

  const maxSolutions = Math.max(1, Math.floor(limit));
  const left: number[] = [0];
  const right: number[] = [0];
  const up: number[] = [0];
  const down: number[] = [0];
  const column: number[] = [0];
  const size: number[] = [0];
  const rowCell: number[] = [];
  const rowDigit: number[] = [];

  for (let index = 1; index <= 324; index++) {
    left[index] = index - 1;
    right[index] = index === 324 ? 0 : index + 1;
    up[index] = index;
    down[index] = index;
    column[index] = index;
    size[index] = 0;
  }

  left[0] = 324;
  right[0] = 1;

  const addRow = (cell: number, digit: number, constraints: number[]): void => {
    let first = -1;
    let previous = -1;

    for (const constraint of constraints) {
      const header = constraint + 1;
      const node = left.length;
      left[node] = node;
      right[node] = node;
      up[node] = up[header];
      down[node] = header;
      column[node] = header;
      size[header] += 1;
      rowCell[node] = cell;
      rowDigit[node] = digit;
      down[up[header]] = node;
      up[header] = node;

      if (first < 0) {
        first = node;
      } else {
        left[node] = previous;
        right[node] = first;
        right[previous] = node;
        left[first] = node;
      }
      previous = node;
    }
  };

  for (let cell = 0; cell < 81; cell++) {
    const row = Math.floor(cell / 9);
    const col = cell % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);

    for (let digit = 1; digit <= 9; digit++) {
      if (grid[cell] && grid[cell] !== digit) continue;
      const d0 = digit - 1;
      addRow(cell, digit, [
        cell,
        81 + row * 9 + d0,
        162 + col * 9 + d0,
        243 + box * 9 + d0,
      ]);
    }
  }

  const cover = (header: number): void => {
    right[left[header]] = right[header];
    left[right[header]] = left[header];

    for (let rowNode = down[header]; rowNode !== header; rowNode = down[rowNode]) {
      for (let node = right[rowNode]; node !== rowNode; node = right[node]) {
        down[up[node]] = down[node];
        up[down[node]] = up[node];
        size[column[node]] -= 1;
      }
    }
  };

  const uncover = (header: number): void => {
    for (let rowNode = up[header]; rowNode !== header; rowNode = up[rowNode]) {
      for (let node = left[rowNode]; node !== rowNode; node = left[node]) {
        size[column[node]] += 1;
        down[up[node]] = node;
        up[down[node]] = node;
      }
    }

    right[left[header]] = header;
    left[right[header]] = header;
  };

  let found = 0;
  let firstSolution: Grid | null = null;
  const selectedRows: number[] = [];
  const search = (): void => {
    if (found >= maxSolutions) return;
    if (right[0] === 0) {
      if (!firstSolution) {
        firstSolution = new Array<number>(81).fill(0);
        for (const rowNode of selectedRows) firstSolution[rowCell[rowNode]] = rowDigit[rowNode];
      }
      found += 1;
      return;
    }

    let chosen = right[0];
    let smallest = size[chosen];
    for (let header = right[chosen]; header !== 0; header = right[header]) {
      if (size[header] < smallest) {
        chosen = header;
        smallest = size[header];
        if (smallest === 0) break;
      }
    }

    if (smallest === 0) return;

    cover(chosen);
    for (let rowNode = down[chosen]; rowNode !== chosen && found < maxSolutions; rowNode = down[rowNode]) {
      selectedRows.push(rowNode);
      for (let node = right[rowNode]; node !== rowNode; node = right[node]) cover(column[node]);
      search();
      for (let node = left[rowNode]; node !== rowNode; node = left[node]) uncover(column[node]);
      selectedRows.pop();
    }
    uncover(chosen);
  };

  search();
  return { count: found, solution: firstSolution };
}

export function countSolutionsDlx(grid: Grid, limit = 2): number {
  return solveDlx(grid, limit).count;
}

export function solveFully(grid: Grid): Grid | null {
  const work = [...grid];

  const fill = (): boolean => {
    let bestCount = Infinity;
    let bestCell = -1;
    let bestCandidates: number[] = [];

    for (let cell = 0; cell < 81; cell++) {
      if (work[cell]) continue;
      const candidates = candidatesFor(work, cell);
      if (candidates.length < bestCount) {
        bestCount = candidates.length;
        bestCell = cell;
        bestCandidates = candidates;
        if (bestCount <= 1) break;
      }
    }

    if (bestCell === -1) return true;
    if (bestCount === 0) return false;

    for (const digit of bestCandidates) {
      work[bestCell] = digit;
      if (fill()) return true;
      work[bestCell] = 0;
    }

    return false;
  };

  return fill() ? work : null;
}

export function generate(givens = 30): { puzzle: Grid; solution: Grid } {
  const targetGivens = Math.max(0, Math.min(81, Math.floor(givens)));
  const grid = new Array(81).fill(0);

  const fill = (cell: number): boolean => {
    if (cell === 81) return true;
    for (const digit of shuffle([...DIGITS])) {
      if (!canPlace(grid, cell, digit)) continue;
      grid[cell] = digit;
      if (fill(cell + 1)) return true;
      grid[cell] = 0;
    }
    return false;
  };

  fill(0);

  const solution = [...grid];
  const puzzle = [...solution];
  let removed = 0;

  for (const cell of shuffle(Array.from({ length: 81 }, (_, i) => i))) {
    if (removed >= 81 - targetGivens) break;
    const value = puzzle[cell];
    puzzle[cell] = 0;

    if (countSolutions([...puzzle]) === 1) removed++;
    else puzzle[cell] = value;
  }

  return { puzzle, solution };
}

function combos(n: number, k: number): number[][] {
  const out: number[][] = [];
  const cur: number[] = [];

  const rec = (start: number) => {
    if (cur.length === k) {
      out.push([...cur]);
      return;
    }

    for (let i = start; i < n; i++) {
      cur.push(i);
      rec(i + 1);
      cur.pop();
    }
  };

  rec(0);
  return out;
}

const NAKED_TECH: Record<SubsetSize, 'naked-single' | 'naked-pair' | 'naked-triple' | 'naked-quad'> = {
  1: 'naked-single',
  2: 'naked-pair',
  3: 'naked-triple',
  4: 'naked-quad',
};

const TECH_NAME: Record<Tech, string> = {
  'naked-single': 'Naked Single',
  'hidden-single': 'Hidden Single',
  'naked-pair': 'Naked Pair',
  'hidden-pair': 'Hidden Pair',
  'naked-triple': 'Naked Triple',
  'hidden-triple': 'Hidden Triple',
  'naked-quad': 'Naked Quad',
  'hidden-quad': 'Hidden Quad',
  pointing: 'Box - Line Reduction',
  claiming: 'Box - Line Reduction',
  fish: 'Fish',
};

function houseRef(unitIndex: number): HouseRef {
  if (unitIndex < 9) return { type: 'row', indices: [unitIndex] };
  if (unitIndex < 18) return { type: 'col', indices: [unitIndex - 9] };
  return { type: 'box', indices: [unitIndex - 18] };
}

function houseLabel(unitIndex: number): string {
  if (unitIndex < 9) return `row ${unitIndex + 1}`;
  if (unitIndex < 18) return `column ${unitIndex - 8}`;
  return `box ${unitIndex - 17}`;
}

function houseRefLabel(ref?: HouseRef): string {
  if (!ref) return 'peers';

  const indexes = ref.indices.map(index => index + 1).join('/');
  if (ref.type === 'row') return ref.indices.length === 1 ? `row ${indexes}` : `rows ${indexes}`;
  if (ref.type === 'col') return ref.indices.length === 1 ? `column ${indexes}` : `columns ${indexes}`;
  return ref.indices.length === 1 ? `box ${indexes}` : `boxes ${indexes}`;
}

export function cellName(cell: number): string {
  return `r${Math.floor(cell / 9) + 1}c${(cell % 9) + 1}`;
}

function rowOf(cell: number): number {
  return Math.floor(cell / 9);
}

function colOf(cell: number): number {
  return cell % 9;
}

function boxOf(cell: number): number {
  return Math.floor(rowOf(cell) / 3) * 3 + Math.floor(colOf(cell) / 3);
}

function boxPositionOf(cell: number): number {
  return (rowOf(cell) % 3) * 3 + (colOf(cell) % 3);
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function cellGroupSelector(cells: number[]): { label: string; cells: number[] } | null {
  if (cells.length < 2) return null;

  const boxes = uniqueSorted(cells.map(boxOf));
  if (boxes.length !== 1) return null;

  const rows = uniqueSorted(cells.map(rowOf));
  const cols = uniqueSorted(cells.map(colOf));
  if (rows.length <= 1 || cols.length <= 1) return null;

  const positions = uniqueSorted(cells.map(boxPositionOf));
  return {
    label: `b${boxes[0] + 1}p${positions.map(position => position + 1).join('')}`,
    cells,
  };
}

function rectSelector(remaining: Set<number>): { label: string; cells: number[] } {
  const rows = uniqueSorted([...remaining].map(rowOf));
  let bestRows: number[] = [];
  let bestCols: number[] = [];

  for (let mask = 1; mask < (1 << rows.length); mask++) {
    const selectedRows = rows.filter((_, index) => mask & (1 << index));
    const cols: number[] = [];

    for (let col = 0; col < 9; col++) {
      if (selectedRows.every(row => remaining.has(row * 9 + col))) cols.push(col);
    }

    if (!cols.length) continue;

    const size = selectedRows.length * cols.length;
    const bestSize = bestRows.length * bestCols.length;
    const label = `r${selectedRows.map(row => row + 1).join('')}c${cols.map(col => col + 1).join('')}`;
    const bestLabel = `r${bestRows.map(row => row + 1).join('')}c${bestCols.map(col => col + 1).join('')}`;

    if (size > bestSize || (size === bestSize && label < bestLabel)) {
      bestRows = selectedRows;
      bestCols = cols;
    }
  }

  return {
    label: `r${bestRows.map(row => row + 1).join('')}c${bestCols.map(col => col + 1).join('')}`,
    cells: bestRows.flatMap(row => bestCols.map(col => row * 9 + col)),
  };
}

interface CellGroupState {
  prev: CellGroupState | null;
  rows: number[] | null;
  cols: number[] | null;
  remaining: Set<number>;
}

function stateGroupParts(state: CellGroupState | null): string[] {
  if (!state?.prev || !state.rows || !state.cols) return [];
  return [
    ...stateGroupParts(state.prev),
    `r${state.rows.map(row => row + 1).join('')}c${state.cols.map(col => col + 1).join('')}`,
  ];
}

function cellGroupParts(cells: number[]): string[] {
  const start = new Set(uniqueSorted(cells));
  let toCover = start.size;
  let thisRound: CellGroupState[] = [{ prev: null, rows: null, cols: null, remaining: start }];

  while (toCover > 0) {
    let nextSize = 0;
    const nextRound: CellGroupState[] = [];

    for (const current of thisRound) {
      const currentCells = [...current.remaining];
      const boxGroup = cellGroupSelector(currentCells);
      if (boxGroup && boxGroup.cells.length === toCover) {
        return [...stateGroupParts(current), boxGroup.label];
      }

      const rows = uniqueSorted(currentCells.map(rowOf));
      const cols = uniqueSorted(currentCells.map(colOf));

      for (let mask = (1 << rows.length) - 1; mask > 0; mask--) {
        const selectedRows = rows.filter((_, index) => mask & (1 << index));
        const selectedCols = cols.filter(col =>
          selectedRows.every(row => current.remaining.has(row * 9 + col))
        );
        if (!selectedCols.length) continue;

        const groupSize = selectedRows.length * selectedCols.length;
        if (groupSize > nextSize) {
          nextSize = groupSize;
          nextRound.length = 0;
        }

        if (groupSize === nextSize) {
          const remaining = new Set(current.remaining);
          for (const row of selectedRows) {
            for (const col of selectedCols) remaining.delete(row * 9 + col);
          }
          nextRound.push({ prev: current, rows: selectedRows, cols: selectedCols, remaining });
        }
      }
    }

    if (!nextSize || !nextRound.length) return [rectSelector(start).label];
    thisRound = nextRound;
    toCover -= nextSize;
  }

  return stateGroupParts(thisRound[thisRound.length - 1]);
}

export function cellGroupName(cells: number[]): string {
  return cellGroupParts(cells).join(',');
}

export function sectorGroupName(sectors: number[]): string {
  let out = '';
  let lastType = -1;

  for (const sector of uniqueSorted(sectors)) {
    const type = Math.floor(sector / 9);

    if (type !== lastType) {
      lastType = type;
      if (out) out += ',';
      out += type === 0 ? 'r' : type === 1 ? 'c' : 'b';
    }

    out += (sector % 9) + 1;
  }

  return out;
}

export function formatRemovals(items: CandidateRemoval[]): string {
  const byDigit = new Map<number, Set<number>>();
  const seen = new Set<string>();

  for (const { cell, digit } of items) {
    const key = `${cell}:${digit}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (!byDigit.has(digit)) byDigit.set(digit, new Set());
    byDigit.get(digit)?.add(cell);
  }

  const byCellGroup = new Map<string, Set<number>>();

  for (const digit of [...byDigit.keys()].sort((a, b) => a - b)) {
    const cells = [...(byDigit.get(digit) ?? [])];
    for (const part of cellGroupParts(cells)) {
      if (!byCellGroup.has(part)) byCellGroup.set(part, new Set());
      byCellGroup.get(part)?.add(digit);
    }
  }

  return [...byCellGroup.entries()]
    .map(([cells, digits]) => `${cells}<>${[...digits].sort((a, b) => a - b).join('')}`)
    .join(', ');
}

function formatSubsetReport(
  tech: Tech,
  digits: number[],
  cells: number[],
  sector: string,
  removals: CandidateRemoval[],
): string {
  return `${TECH_NAME[tech]}: (${digits.join('')}) ${cellGroupName(cells)} in ${sector} => ${formatRemovals(removals)}`;
}

function formatSingleReport(
  tech: Tech,
  digits: number[],
  cells: number[],
  removals: CandidateRemoval[],
): string {
  return `${TECH_NAME[tech]}: (${digits.join('')}) ${cellGroupName(cells)} => ${formatRemovals(removals)}`;
}

function peerSubsetEliminations(
  cand: CandidateGrid,
  cells: number[],
  digits: number[],
): CandidateRemoval[] {
  const sourceCellSet = new Set(cells);
  const seen = new Set<string>();
  const eliminations: CandidateRemoval[] = [];

  for (const digit of digits) {
    const sourceCells = cells.filter(cell => cand[cell].includes(digit));
    if (!sourceCells.length) continue;

    for (let cell = 0; cell < 81; cell++) {
      if (sourceCellSet.has(cell) || !cand[cell].includes(digit)) continue;
      if (!sourceCells.every(source => peersOf(source).includes(cell))) continue;

      const key = `${cell}:${digit}`;
      if (seen.has(key)) continue;

      seen.add(key);
      eliminations.push({ cell, digit });
    }
  }

  return eliminations;
}

export function nakedSingleStep(cand: CandidateGrid): Hint | null {
  for (let cell = 0; cell < 81; cell++) {
    if (cand[cell].length !== 1) continue;

    const digit = cand[cell][0];
    const eliminations = peerSubsetEliminations(cand, [cell], [digit]);

    if (!eliminations.length) continue;

    return {
      tech: 'naked-single',
      desc: formatSingleReport('naked-single', [digit], [cell], eliminations),
      elim: { items: eliminations },
      digits: [digit],
      at: [cell],
      vertices: [cell],
    };
  }

  return null;
}

export function nakedSubsetStep(cand: CandidateGrid, k: SubsetSize): Hint | null {
  if (k === 1) return nakedSingleStep(cand);

  for (let unitIndex = 0; unitIndex < UNITS.length; unitIndex++) {
    const unit = UNITS[unitIndex];
    const subsetCells: number[] = unit.filter((cell: number) =>
      cand[cell].length >= 2 && cand[cell].length <= k
    );

    for (const selected of combos(subsetCells.length, k) as number[][]) {
      const cells = selected.map((i: number) => subsetCells[i]);
      const digits = ([...new Set(cells.flatMap((cell: number) => cand[cell]))] as number[]).sort((a, b) => a - b);
      if (digits.length !== k) continue;

      const eliminations = peerSubsetEliminations(cand, cells, digits);

      if (!eliminations.length) continue;

      return {
        tech: NAKED_TECH[k],
        desc: formatSubsetReport(NAKED_TECH[k], digits, cells, houseLabel(unitIndex), eliminations),
        elim: { items: eliminations },
        digits,
        at: cells,
        base: houseRef(unitIndex),
        vertices: cells,
      };
    }
  }

  return null;
}

export function hiddenSubsetStep(cand: CandidateGrid, k: SubsetSize): Hint | null {
  const hint = withActualEliminations(hiddenStepM(cand, k), cand);
  if (!hint?.digits || !hint.at) return hint;

  return {
    ...hint,
    desc: formatSubsetReport(hint.tech, hint.digits, hint.at, houseRefLabel(hint.base), eliminationItems(hint.elim)),
  };
}

export function boxLineStep(cand: CandidateGrid): Hint | null {
  return withActualEliminations(boxLineStepM(cand), cand);
}

function moveTypeEnabled(enabledTypes: Iterable<string> | undefined, type: string): boolean {
  return !enabledTypes || new Set(enabledTypes).has(type);
}

function subsetStepForSizes(
  cand: CandidateGrid,
  sizes: readonly SubsetSize[],
  enabledTypes?: Iterable<string>,
): Hint | null {
  for (const k of sizes) {
    const hiddenType = HIDDEN_TECH[k];
    if (moveTypeEnabled(enabledTypes, hiddenType)) {
      const hidden = hiddenSubsetStep(cand, k);
      if (hidden) return hidden;
    }

    const nakedType = NAKED_TECH[k];
    if (moveTypeEnabled(enabledTypes, nakedType)) {
      const naked = withActualEliminations(nakedSubsetStep(cand, k), cand);
      if (naked) return naked;
    }
  }

  return null;
}

export function subsetStep(cand: CandidateGrid, options: FishSearchOptions = {}): Hint | null {
  return subsetStepForSizes(cand, [1, 2, 3, 4], options.enabledTechniques);
}

export function fishStep(
  cand: CandidateGrid,
  sizes: readonly (2 | 3 | 4)[] = [2, 3, 4],
  options: FishSearchOptions = {},
): Hint | null {
  return withActualEliminations(fishStepM(cand, sizes, options), cand);
}

export function subsetOrFishStep(cand: CandidateGrid, fishOptions: FishSearchOptions = {}): Hint | null {
  const enabledTypes = fishOptions.enabledTechniques;
  const singles = subsetStepForSizes(cand, [1], enabledTypes);
  if (singles) return singles;

  if (moveTypeEnabled(enabledTypes, 'box-line')) {
    const boxLine = boxLineStep(cand);
    if (boxLine) return boxLine;
  }

  for (const size of [2, 3, 4] as const) {
    const subset = subsetStepForSizes(cand, [size], enabledTypes);
    if (subset) return subset;

    const fish = fishStep(cand, [size], fishOptions);
    if (fish) return fish;
  }

  return null;
}

export function hintFor(grid: Grid, fishOptions: FishSearchOptions = {}): Hint | null {
  return subsetOrFishStep(allCandidates(grid), { ...fishOptions, grid });
}

export function eliminationItems(elim: Elimination, cand?: CandidateGrid): CandidateRemoval[] {
  const items = 'items' in elim
    ? elim.items
    : elim.cells.flatMap(cell => elim.digits.map(digit => ({ cell, digit })));

  return items.filter(({ cell, digit }) => !cand || cand[cell]?.includes(digit));
}

export function hasEliminations(hint: Hint | null, cand?: CandidateGrid): hint is Hint {
  return hint !== null && eliminationItems(hint.elim, cand).length > 0;
}

export function applyEliminations(cand: CandidateGrid, elim: Elimination): CandidateRemoval[] {
  const removed: CandidateRemoval[] = [];

  for (const { cell, digit } of eliminationItems(elim, cand)) {
    const next = cand[cell].filter(value => value !== digit);
    if (next.length === cand[cell].length) continue;
    cand[cell] = next;
    removed.push({ cell, digit });
  }

  return removed;
}

export function cloneCandidates(cand: CandidateGrid): CandidateGrid {
  return cand.map(cell => [...cell]);
}

export function reduceCandidates(
  cand: CandidateGrid,
  maxCycles = 100,
  fishOptions: FishSearchOptions = {},
): ReductionResult {
  return reduceCandidatesInPlace(cloneCandidates(cand), maxCycles, fishOptions);
}

export function reduceCandidatesInPlace(
  cand: CandidateGrid,
  maxCycles = 100,
  fishOptions: FishSearchOptions = {},
): ReductionResult {
  const steps: Hint[] = [];
  const removed: CandidateRemoval[] = [];

  for (let cycle = 0; cycle < maxCycles; cycle++) {
    const step = subsetOrFishStep(cand, fishOptions);
    if (!step) return { cand, steps, removed, cycles: steps.length };

    const cycleRemoved = applyEliminations(cand, step.elim);
    if (!cycleRemoved.length) return { cand, steps, removed, cycles: steps.length };

    steps.push({ ...step, elim: { items: cycleRemoved } });
    removed.push(...cycleRemoved);
  }

  return { cand, steps, removed, cycles: steps.length };
}

function withActualEliminations(hint: Hint | null, cand: CandidateGrid): Hint | null {
  if (!hint) return null;

  const items = eliminationItems(hint.elim, cand);
  if (!items.length) return null;

  if ('items' in hint.elim) return { ...hint, elim: { items } };

  const digits = [...new Set(items.map(item => item.digit))].sort((a, b) => a - b);
  const cells = [...new Set(items.map(item => item.cell))].sort((a, b) => a - b);

  return digits.length === 1
    ? { ...hint, elim: { cells, digits } }
    : { ...hint, elim: { items } };
}

export function encode(grid: Grid): string {
  return grid.map(value => (value ? String(value) : '.')).join('');
}

export function decode(text: string): Grid | null {
  const clean = text.replace(/[\s|,;:_-]+/g, '');
  if (!/^[0-9.]{81}$/.test(clean)) return null;
  const grid = clean.split('').map(ch => (ch >= '1' && ch <= '9' ? Number(ch) : 0));
  return grid.some(Boolean) ? grid : null;
}

function singletonMask(mask: number, position: number): boolean {
  return mask === (1 << position);
}

function parse729Bits(text: string): number[] | null {
  const clean = text.replace(/[\s,;|:_-]+/g, '');
  if (!/^[01]{729}$/.test(clean)) return null;
  return clean.split('').map(Number);
}

function parseCandidateGridText(text: string): number[] | null {
  const rows = text.split(/\r?\n/)
    .map(line => line.match(/[1-9]+/g) ?? [])
    .filter(tokens => tokens.length === 9);
  if (rows.length !== 9) return null;

  return rows.flatMap(tokens => tokens.flatMap(token =>
    Array.from({ length: 9 }, (_, digit) => token.includes(String(digit + 1)) ? 1 : 0),
  ));
}

/**
 * Parse 81 cells x 9 digits of candidate data and infer only space-proven givens.
 * The input is 729 binary values in cell-major order: cell 0 digits 1..9,
 * then cell 1 digits 1..9, and so on.
 */
export function parse729Data(text: string): Parsed729Data | null {
  const bits = parse729Bits(text) ?? parseCandidateGridText(text);
  if (!bits) return null;

  const sourceCandidates: CandidateGrid = Array.from({ length: 81 }, (_, cell) =>
    bits.slice(cell * 9, cell * 9 + 9)
      .map((present, digit) => present ? digit + 1 : 0)
      .filter(Boolean),
  );
  const sourceSpaces = buildSpaces(sourceCandidates).M;
  const candidates = sourceCandidates.map(values => [...values]);
  const grid = new Array<number>(81).fill(0);
  const conflicts: { cell: number; digits: number[] }[] = [];

  for (let cell = 0; cell < 81; cell++) {
    const row = Math.floor(cell / 9);
    const col = cell % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    const boxPosition = (row % 3) * 3 + (col % 3);
    const forced = sourceCandidates[cell].filter(digit => {
      const d0 = digit - 1;
      return singletonMask(sourceSpaces[row][d0], col)
        && singletonMask(sourceSpaces[9 + col][d0], row)
        && singletonMask(sourceSpaces[18 + box][d0], boxPosition);
    });

    if (forced.length > 1) {
      conflicts.push({ cell, digits: forced });
      continue;
    }
    if (forced.length !== 1) continue;

    grid[cell] = forced[0];
    candidates[cell] = [];
  }

  const finalSpaces = buildSpaces(candidates, grid);

  return {
    bits,
    sourceCandidates,
    candidates,
    spaces: finalSpaces.M,
    givenBySector: finalSpaces.given,
    grid,
    givenCells: grid.reduce<number[]>((cells, digit, cell) => {
      if (digit) cells.push(cell);
      return cells;
    }, []),
    conflicts,
    valid: conflicts.length === 0,
  };
}
