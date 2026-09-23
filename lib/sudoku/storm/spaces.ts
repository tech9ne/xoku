import type { CandidateGrid, CandidateRemoval, Hint, HouseRef, SubsetSize } from './sudoku';
import { Bset, Bxy, BxyN, Cset, Cy, PEERS, Rset, Rx, UNITS } from './cardinals';

export interface SectorState {
  cells: number[];
  rows: number[];
  cols: number[];
  boxes: number[];
}

export interface Spaces {
  M: number[][];
  given: SectorState;
}

export const POPC = new Uint8Array(512);
for (let i = 1; i < POPC.length; i++) POPC[i] = POPC[i >> 1] + (i & 1);

const IDX = new Int8Array(512);
for (let i = 0; i < 9; i++) IDX[1 << i] = i;

export type FishSize = 2 | 3 | 4;

export interface FishSearchOptions {
  minSize?: FishSize;
  maxSize?: FishSize;
  minK?: 0 | 1 | 2;
  maxK?: 0 | 1 | 2;
  digits?: number[];
  baseSectors?: number[];
  coverSectors?: number[];
  basicsEnabled?: boolean;
  frankenEnabled?: boolean;
  mutantEnabled?: boolean;
  grid?: number[];
  enabledTechniques?: Iterable<string>;
  priorityMode?: boolean;
  omissionFishSearch?: (
    cand: CandidateGrid,
    sizes: readonly FishSize[],
    options: FishSearchOptions,
  ) => Hint | null;
}

const SUBSET_NAME: Record<SubsetSize, 'single' | 'pair' | 'triple' | 'quad'> = {
  1: 'single',
  2: 'pair',
  3: 'triple',
  4: 'quad',
};

export const HIDDEN_TECH: Record<SubsetSize, 'hidden-single' | 'hidden-pair' | 'hidden-triple' | 'hidden-quad'> = {
  1: 'hidden-single',
  2: 'hidden-pair',
  3: 'hidden-triple',
  4: 'hidden-quad',
};

const FISH_NAME: Record<SubsetSize, 'Cyclops' | 'X-Wing' | 'SwordFish' | 'JellyFish'> = {
  1: 'Cyclops',
  2: 'X-Wing',
  3: 'SwordFish',
  4: 'JellyFish',
};

const COMBOS: Record<SubsetSize, number[][]> = {
  1: combosIdx(1),
  2: combosIdx(2),
  3: combosIdx(3),
  4: combosIdx(4),
};

function fixedSectorState(grid: number[] = []): SectorState {
  const state: SectorState = {
    cells: [],
    rows: new Array(9).fill(0),
    cols: new Array(9).fill(0),
    boxes: new Array(9).fill(0),
  };

  for (let cell = 0; cell < 81; cell++) {
    const digit = grid[cell];
    if (!digit || digit < 1 || digit > 9) continue;
    const bit = 1 << (digit - 1);
    state.cells.push(cell);
    state.rows[Rx[cell]] |= bit;
    state.cols[Cy[cell]] |= bit;
    state.boxes[Bxy[cell]] |= bit;
  }

  return state;
}

export function buildSpaces(
  cand: CandidateGrid,
  givenGrid: number[] = [],
): Spaces {
  const M = Array.from({ length: 27 }, () => new Array(9).fill(0));
  const given = fixedSectorState(givenGrid);

  for (let cell = 0; cell < 81; cell++) {
    for (const digit of cand[cell]) {
      const d0 = digit - 1;
      M[Rx[cell]][d0] |= 1 << Cy[cell];
      M[9 + Cy[cell]][d0] |= 1 << Rx[cell];
      M[18 + Bxy[cell]][d0] |= 1 << BxyN[cell];
    }
  }

  return { M, given };
}

function bits(mask: number): number[] {
  const out: number[] = [];
  for (let x = mask; x; x &= x - 1) out.push(IDX[x & -x]);
  return out;
}

function combosIdx(k: number): number[][] {
  const out: number[][] = [];
  const cur: number[] = [];

  const rec = (start: number) => {
    if (cur.length === k) {
      out.push([...cur]);
      return;
    }

    for (let i = start; i < 9; i++) {
      cur.push(i);
      rec(i + 1);
      cur.pop();
    }
  };

  rec(0);
  return out;
}

function digitCombos(k: SubsetSize): number[][] {
  return COMBOS[k].map(combo => combo.map(i => i + 1));
}

function house(h: number): { cells: number[]; label: string; ref: HouseRef } {
  if (h < 9) return { cells: Rset[h], label: `row ${h + 1}`, ref: { type: 'row', indices: [h] } };
  if (h < 18) return { cells: Cset[h - 9], label: `column ${h - 8}`, ref: { type: 'col', indices: [h - 9] } };
  return { cells: Bset[h - 18], label: `box ${h - 17}`, ref: { type: 'box', indices: [h - 18] } };
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function cellGroupSelector(cells: number[]): { label: string; cells: number[] } | null {
  if (cells.length < 2) return null;

  const boxes = uniqueSorted(cells.map(cell => Bxy[cell]));
  if (boxes.length !== 1) return null;

  const rows = uniqueSorted(cells.map(cell => Rx[cell]));
  const cols = uniqueSorted(cells.map(cell => Cy[cell]));
  if (rows.length <= 1 || cols.length <= 1) return null;

  const positions = uniqueSorted(cells.map(cell => BxyN[cell]));
  return {
    label: `b${boxes[0] + 1}p${positions.map(position => position + 1).join('')}`,
    cells,
  };
}

function rectSelector(remaining: Set<number>): { label: string; cells: number[] } {
  const rows = uniqueSorted([...remaining].map(cell => Rx[cell]));
  let bestRows: number[] = [];
  let bestCols: number[] = [];

  for (let mask = 1; mask < (1 << rows.length); mask++) {
    const selectedRows = rows.filter((_, index) => mask & (1 << index));
    const cols: number[] = [];

    for (let col = 0; col < 9; col++) {
      if (selectedRows.every(row => remaining.has(Rset[row][col]))) cols.push(col);
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
    cells: bestRows.flatMap(row => bestCols.map(col => Rset[row][col])),
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

      const rows = uniqueSorted(currentCells.map(cell => Rx[cell]));
      const cols = uniqueSorted(currentCells.map(cell => Cy[cell]));

      for (let mask = (1 << rows.length) - 1; mask > 0; mask--) {
        const selectedRows = rows.filter((_, index) => mask & (1 << index));
        const selectedCols = cols.filter(col =>
          selectedRows.every(row => current.remaining.has(Rset[row][col]))
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
            for (const col of selectedCols) remaining.delete(Rset[row][col]);
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

function cellGroupName(cells: number[]): string {
  return cellGroupParts(cells).join(',');
}

function formatRemovals(items: CandidateRemoval[]): string {
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

function sectorGroupName(sectors: number[]): string {
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

function hiddenSubsetReport(
  k: SubsetSize,
  digits: number[],
  cells: number[],
  sector: string,
  removals: CandidateRemoval[],
): string {
  return `Hidden ${titleCase(SUBSET_NAME[k])}: (${digits.join('')}) ${cellGroupName(cells)} in ${sector} => ${formatRemovals(removals)}`;
}

function boxLineReport(
  digit: number,
  base: number[],
  cover: number[],
  removals: CandidateRemoval[],
): string {
  return `B.L.R. (${digit}) ${sectorGroupName(base)} / ${sectorGroupName(cover)} => ${formatRemovals(removals)}`;
}

function fishReport(
  name: string,
  digit: number,
  baseSectors: number[],
  coverSectors: number[],
  elimCells: number[],
): string {
  const eliminations = elimCells.map(cell => ({ cell, digit }));
  return `${name}: (${digit}) ${sectorGroupName(baseSectors)} / ${sectorGroupName(coverSectors)} => ${formatRemovals(eliminations)}`;
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
      if (!sourceCells.every(source => PEERS[source].includes(cell))) continue;

      const key = `${cell}:${digit}`;
      if (seen.has(key)) continue;

      seen.add(key);
      eliminations.push({ cell, digit });
    }
  }

  return eliminations;
}

export function hiddenStepM(cand: CandidateGrid, k: SubsetSize): Hint | null {
  const { M } = buildSpaces(cand);

  for (let h = 0; h < 27; h++) {
    const currentHouse = house(h);

    for (const digits of digitCombos(k)) {
      let union = 0;
      let hasMissingDigit = false;

      for (const digit of digits) {
        const mask = M[h][digit - 1];
        if (!mask) {
          hasMissingDigit = true;
          break;
        }
        union |= mask;
      }

      if (hasMissingDigit || POPC[union] !== k) continue;

      const cells = bits(union).map(position => currentHouse.cells[position]);
      const items: CandidateRemoval[] = [];

      for (const cell of cells) {
        for (const digit of cand[cell]) {
          if (!digits.includes(digit)) items.push({ cell, digit });
        }
      }

      items.push(...peerSubsetEliminations(cand, cells, digits));

      if (!items.length) continue;

      return {
        tech: HIDDEN_TECH[k],
        desc: hiddenSubsetReport(k, digits, cells, currentHouse.label, items),
        elim: { items },
        digits,
        at: cells,
        base: currentHouse.ref,
        vertices: cells,
      };
    }
  }

  return null;
}

export function boxLineStepM(cand: CandidateGrid): Hint | null {
  for (let digit = 1; digit <= 9; digit++) {
    for (let box = 0; box < 9; box++) {
      const boxCells = Bset[box].filter(cell => cand[cell].includes(digit));
      if (!boxCells.length) continue;

      const rows = uniqueSorted(boxCells.map(cell => Rx[cell]));
      if (rows.length === 1) {
        const row = rows[0];
        const eliminations = Rset[row]
          .filter(cell => Bxy[cell] !== box && cand[cell].includes(digit))
          .map(cell => ({ cell, digit }));

        if (eliminations.length) {
          return {
            tech: 'pointing',
            desc: boxLineReport(digit, [18 + box], [row], eliminations),
            elim: { items: eliminations },
            digits: [digit],
            at: boxCells,
            base: { type: 'box', indices: [box] },
            cover: { type: 'row', indices: [row] },
            vertices: boxCells,
          };
        }
      }

      for (let row = 0; row < 9; row++) {
        const rowCells = Rset[row].filter(cell => cand[cell].includes(digit));
        if (!rowCells.length || !rowCells.every(cell => Bxy[cell] === box)) continue;

        const eliminations = Bset[box]
          .filter(cell => Rx[cell] !== row && cand[cell].includes(digit))
          .map(cell => ({ cell, digit }));

        if (eliminations.length) {
          return {
            tech: 'claiming',
            desc: boxLineReport(digit, [row], [18 + box], eliminations),
            elim: { items: eliminations },
            digits: [digit],
            at: rowCells,
            base: { type: 'row', indices: [row] },
            cover: { type: 'box', indices: [box] },
            vertices: rowCells,
          };
        }
      }

      const cols = uniqueSorted(boxCells.map(cell => Cy[cell]));
      if (cols.length === 1) {
        const col = cols[0];
        const eliminations = Cset[col]
          .filter(cell => Bxy[cell] !== box && cand[cell].includes(digit))
          .map(cell => ({ cell, digit }));

        if (eliminations.length) {
          return {
            tech: 'pointing',
            desc: boxLineReport(digit, [18 + box], [9 + col], eliminations),
            elim: { items: eliminations },
            digits: [digit],
            at: boxCells,
            base: { type: 'box', indices: [box] },
            cover: { type: 'col', indices: [col] },
            vertices: boxCells,
          };
        }
      }

      for (let col = 0; col < 9; col++) {
        const colCells = Cset[col].filter(cell => cand[cell].includes(digit));
        if (!colCells.length || !colCells.every(cell => Bxy[cell] === box)) continue;

        const eliminations = Bset[box]
          .filter(cell => Cy[cell] !== col && cand[cell].includes(digit))
          .map(cell => ({ cell, digit }));

        if (eliminations.length) {
          return {
            tech: 'claiming',
            desc: boxLineReport(digit, [9 + col], [18 + box], eliminations),
            elim: { items: eliminations },
            digits: [digit],
            at: colCells,
            base: { type: 'col', indices: [col] },
            cover: { type: 'box', indices: [box] },
            vertices: colCells,
          };
        }
      }
    }
  }

  return null;
}

function moveTypeEnabled(enabledTypes: Iterable<string> | undefined, type: string | null): boolean {
  return !enabledTypes || (type !== null && new Set(enabledTypes).has(type));
}

function fishMoveType(step: Hint | null): string | null {
  if (!step) return null;
  const size = Number(step.size);
  const k = Number(step.k ?? 0);
  if (k > 0) return `${size}x${size}+k-fish`;
  return ({ 2: 'x-wing', 3: 'swordfish', 4: 'jellyfish' } as Record<number, string>)[size] ?? null;
}

function fishStepAllowed(step: Hint | null, enabledTypes: Iterable<string> | undefined): step is Hint {
  return !!step && moveTypeEnabled(enabledTypes, fishMoveType(step));
}

export function fishStepM(
  cand: CandidateGrid,
  sizes: readonly FishSize[] = [2, 3, 4],
  options: FishSearchOptions = {},
): Hint | null {
  const configuredMaxK = Number(options.maxK ?? 2);
  const maxK = Number.isFinite(configuredMaxK) ? Math.max(0, configuredMaxK) : 2;

  for (const size of sizes) {
    const omissionFish = options.omissionFishSearch?.(cand, [size], {
      ...options,
      minSize: size,
      maxSize: size,
      minK: 0,
      maxK: maxK as 0 | 1 | 2,
      priorityMode: true,
    });
    if (fishStepAllowed(omissionFish!, options.enabledTechniques)) return omissionFish;
  }

  return null;
}

function fishByRows(M: number[][], d0: number, digit: number, k: FishSize): Hint | null {
  for (const baseRows of COMBOS[k]) {
    let coverMask = 0;
    for (const row of baseRows) coverMask |= M[row][d0];
    if (POPC[coverMask] !== k || baseRows.some(row => M[row][d0] === 0)) continue;

    const coverCols = bits(coverMask);
    const eliminations: number[] = [];

    for (const col of coverCols) {
      for (let row = 0; row < 9; row++) {
        if (!baseRows.includes(row) && (M[row][d0] & (1 << col))) {
          eliminations.push(Rset[row][col]);
        }
      }
    }

    if (!eliminations.length) continue;

    const vertices = baseRows.flatMap(row =>
      coverCols
        .filter(col => M[row][d0] & (1 << col))
        .map(col => Rset[row][col])
    );

    return {
      tech: 'fish',
      name: FISH_NAME[k],
      category: 'Basic',
      size: k,
      k: 0,
      desc: fishReport(FISH_NAME[k], digit, baseRows, coverCols.map(col => 9 + col), eliminations),
      elim: { cells: eliminations, digits: [digit] },
      digits: [digit],
      base: { type: 'row', indices: [...baseRows] },
      cover: { type: 'col', indices: coverCols },
      vertices,
    };
  }

  return null;
}

function fishByCols(M: number[][], d0: number, digit: number, k: FishSize): Hint | null {
  for (const baseCols of COMBOS[k]) {
    let coverMask = 0;
    for (const col of baseCols) coverMask |= M[9 + col][d0];
    if (POPC[coverMask] !== k || baseCols.some(col => M[9 + col][d0] === 0)) continue;

    const coverRows = bits(coverMask);
    const eliminations: number[] = [];

    for (const row of coverRows) {
      for (let col = 0; col < 9; col++) {
        if (!baseCols.includes(col) && (M[9 + col][d0] & (1 << row))) {
          eliminations.push(Cset[col][row]);
        }
      }
    }

    if (!eliminations.length) continue;

    const vertices = baseCols.flatMap(col =>
      coverRows
        .filter(row => M[9 + col][d0] & (1 << row))
        .map(row => Cset[col][row])
    );

    return {
      tech: 'fish',
      name: FISH_NAME[k],
      category: 'Basic',
      size: k,
      k: 0,
      desc: fishReport(FISH_NAME[k], digit, baseCols.map(col => 9 + col), coverRows, eliminations),
      elim: { cells: eliminations, digits: [digit] },
      digits: [digit],
      base: { type: 'col', indices: [...baseCols] },
      cover: { type: 'row', indices: coverRows },
      vertices,
    };
  }

  return null;
}
