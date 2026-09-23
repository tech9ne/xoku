import { UNITS } from './cardinals';
import { buildMiniSectors } from './mini-sectors';
import { intersection, peerPotentialEliminations, union } from './set-tools';
import { peersOf, type CandidateGrid } from './sudoku';

export const BILOCAL = 0;
export const CELL_TO_GROUP = 1;
export const GROUP_TO_GROUP = 2;
export const ERI = 3;
export const ALS = 4;

export const STRONG_LINK_TYPE_NAMES = ['BILOCAL', 'CELL_TO_GROUP', 'GROUP_TO_GROUP', 'ERI', 'ALS'] as const;

export interface StrongLink {
  id: number;
  linkType: number;
  linkTypeName: string;
  originSector: number[];
  startingDigits: number[];
  activeCells: number[];
  linkedCells: number[];
  linkDigits: number[];
  startCellsSector: Record<string, number[]>;
  linkCellsSector: Record<string, number[]>;
  startDigitSwapAvailable: number[];
  endDigitSwapAvailable: number[];
  potentialElimStart: Record<string, number[]>;
  potentialElimEnd: Record<string, number[]>;
  rightWeakLinks: unknown[];
  leftWeakLinks: unknown[];
  xorConstruction?: StrongLinkXorConstruction | null;
  secondaryTypes?: string[];
  secondaryXorConstruction?: StrongLinkXorConstruction | null;
}

export interface StrongLinkXorConstruction {
  kind: 'mini-sector' | 'eri';
  name?: string;
  baseSector?: number;
  row?: number;
  col?: number;
  intersectionCell?: number;
  partitionSectors?: number[];
  partitionCells?: number[][];
  activePartition?: number;
  linkedPartition?: number;
  emptyPartition?: number;
  activeCells?: number[];
  linkedCells?: number[];
  emptyCells?: number[];
}

export type StrongLinkSet = [StrongLink[], StrongLink[], StrongLink[], StrongLink[], StrongLink[]];

let nextStrongLinkId = 0;

function commonSectors(cells: readonly number[]): number[] {
  if (!cells.length) return [];
  return UNITS
    .map((unit, sector) => cells.every(cell => unit.includes(cell)) ? sector : -1)
    .filter(sector => sector >= 0);
}

function peerCellsForDigit(
  digitCells: number[][],
  digit: number,
  sourceCells: readonly number[],
): number[] {
  const sourceSet = new Set(sourceCells);
  return digitCells[digit].filter(cell =>
    !sourceSet.has(cell)
    && sourceCells.every(source => peersOf(source).includes(cell))
  );
}

function swapDigits(cand: CandidateGrid, digit: number, cells: readonly number[]): number[] {
  if (cells.length !== 1) return [];
  return (cand[cells[0]] ?? []).filter(value => value !== digit);
}

function sectorMap(digit: number, cells: readonly number[]): Record<string, number[]> {
  return { [digit + 1]: commonSectors(cells) };
}

function eliminationMap(
  digit: number,
  cells: readonly number[],
  digitCells: number[][],
): Record<string, number[]> {
  return { [digit + 1]: peerCellsForDigit(digitCells, digit, cells) };
}

function determineLinkType(activeCells: readonly number[], linkedCells: readonly number[]): number {
  const activeCount = activeCells.length;
  const linkedCount = linkedCells.length;
  if (activeCount === 1 && linkedCount === 1) return BILOCAL;
  if ((activeCount > 1 && linkedCount === 1) || (activeCount === 1 && linkedCount > 1)) {
    return CELL_TO_GROUP;
  }
  if (activeCount > 1 && linkedCount > 1) return GROUP_TO_GROUP;
  return -1;
}

function buildLink(
  cand: CandidateGrid,
  digitCells: number[][],
  digit: number,
  linkType: number,
  activeCells: readonly number[],
  linkedCells: readonly number[],
  xorConstruction: StrongLinkXorConstruction | null = null,
): StrongLink {
  const allCells = union(activeCells, linkedCells);
  return {
    id: nextStrongLinkId++,
    linkType,
    linkTypeName: STRONG_LINK_TYPE_NAMES[linkType] ?? 'UNKNOWN',
    originSector: commonSectors(allCells),
    startingDigits: [digit + 1],
    activeCells: [...activeCells],
    linkedCells: [...linkedCells],
    linkDigits: [digit + 1],
    startCellsSector: sectorMap(digit, activeCells),
    linkCellsSector: sectorMap(digit, linkedCells),
    startDigitSwapAvailable: swapDigits(cand, digit + 1, activeCells),
    endDigitSwapAvailable: swapDigits(cand, digit + 1, linkedCells),
    potentialElimStart: eliminationMap(digit, activeCells, digitCells),
    potentialElimEnd: eliminationMap(digit, linkedCells, digitCells),
    rightWeakLinks: [],
    leftWeakLinks: [],
    xorConstruction,
    secondaryTypes: [],
    secondaryXorConstruction: null,
  };
}

function buildCellAlsLink(cand: CandidateGrid, cell: number): StrongLink {
  const digits = [...(cand[cell] ?? [])].sort((a, b) => a - b);
  const [leftDigit, rightDigit] = digits;
  const cells = [cell];
  const sectors = commonSectors(cells);

  return {
    id: nextStrongLinkId++,
    linkType: ALS,
    linkTypeName: STRONG_LINK_TYPE_NAMES[ALS],
    originSector: sectors,
    startingDigits: [leftDigit],
    activeCells: cells,
    linkedCells: cells,
    linkDigits: [rightDigit],
    startCellsSector: { [leftDigit]: sectors },
    linkCellsSector: { [rightDigit]: sectors },
    startDigitSwapAvailable: [rightDigit],
    endDigitSwapAvailable: [leftDigit],
    potentialElimStart: { [leftDigit]: peerPotentialEliminations(cand, leftDigit, cells) },
    potentialElimEnd: { [rightDigit]: peerPotentialEliminations(cand, rightDigit, cells) },
    rightWeakLinks: [],
    leftWeakLinks: [],
  };
}

function linkKey(link: StrongLink): string {
  const groups = [link.activeCells, link.linkedCells]
    .map(cells => cells.join(','))
    .sort();
  return [
    link.linkType,
    link.startingDigits.join(','),
    link.linkDigits.join(','),
    link.originSector.join(','),
    ...groups,
  ].join('|');
}

function addUnique(buckets: StrongLinkSet, seen: Set<string>, link: StrongLink): void {
  const key = linkKey(link);
  if (seen.has(key)) return;
  seen.add(key);
  buckets[link.linkType].push(link);
}

const OFFSETS = [0, 9, 18, 18];

function miniPartitionSectors(type: number, line: number): number[] {
  if (type === 0) {
    const firstBox = Math.floor(line / 3) * 3;
    return [18 + firstBox, 18 + firstBox + 1, 18 + firstBox + 2];
  }
  if (type === 1) {
    const firstBox = Math.floor(line / 3);
    return [18 + firstBox, 18 + firstBox + 3, 18 + firstBox + 6];
  }
  if (type === 2) {
    const firstRow = Math.floor(line / 3) * 3;
    return [firstRow, firstRow + 1, firstRow + 2];
  }
  const firstCol = (line % 3) * 3;
  return [9 + firstCol, 9 + firstCol + 1, 9 + firstCol + 2];
}

function miniPartitionName(type: number): string {
  return ['row-by-box', 'col-by-box', 'box-by-row', 'box-by-col'][type] ?? 'mini-sector';
}

function miniXorConstruction(
  type: number,
  line: number,
  options: readonly number[],
  startSector: number,
  activeCells: readonly number[],
  linkedCells: readonly number[],
): StrongLinkXorConstruction {
  const partitionSectors = miniPartitionSectors(type, line);
  const occupied = options.map(Number);
  return {
    kind: 'mini-sector',
    name: miniPartitionName(type),
    baseSector: startSector,
    partitionSectors,
    partitionCells: partitionSectors.map(sector => intersection(UNITS[startSector], UNITS[sector])),
    activePartition: partitionSectors.indexOf(occupied[0]),
    linkedPartition: partitionSectors.indexOf(occupied[1]),
    emptyPartition: partitionSectors.findIndex(sector => !occupied.includes(sector)),
    activeCells: [...activeCells],
    linkedCells: [...linkedCells],
  };
}

function eriXorConstruction(box: number, row: number, col: number): StrongLinkXorConstruction {
  const boxSector = 18 + box;
    const boxRowStart = Math.floor(box / 3) * 3;
    const boxColStart = (box % 3) * 3;
  const offsetIndex = (col - boxColStart) * 3 + (row - boxRowStart);
  return {
    kind: 'eri',
    name: 'empty-rectangle',
    baseSector: boxSector,
    row,
    col,
    intersectionCell: row * 9 + col,
    emptyCells: eriOffsetCells(box, offsetIndex),
  };
}

// The nine offsets are the Java EriOffSets table: box cells outside the
// selected box-row and box-column crossing, indexed by local column/row.
const ERI_OFFSETS: number[][][] = Array.from({ length: 9 }, (_, box) =>
  Array.from({ length: 9 }, (_, offsetIndex) => {
  const boxRowStart = Math.floor(box / 3) * 3;
  const boxColStart = (box % 3) * 3;
    // The Java table is indexed by local column first, then local row:
    // index = columnOffset * 3 + rowOffset.
    const columnOffset = Math.floor(offsetIndex / 3);
    const rowOffset = offsetIndex % 3;
    const row = boxRowStart + rowOffset;
    const col = boxColStart + columnOffset;
    return UNITS[18 + box].filter(cell =>
      Math.floor(cell / 9) !== row && cell % 9 !== col,
    );
  }),
);

function eriOffsetCells(box: number, offsetIndex: number): number[] {
  return ERI_OFFSETS[box]?.[offsetIndex] ?? [];
}

function eriGeometries(
  box: number,
  digitCells: number[][],
  digit: number,
  requireCount: boolean,
): Array<{ boxCells: number[]; activeCells: number[]; linkedCells: number[]; construction: StrongLinkXorConstruction }> {
  const boxSector = 18 + box;
  const boxCells = intersection(UNITS[boxSector], digitCells[digit]);
  if (requireCount && (boxCells.length < 4 || boxCells.length >= 6)) return [];

  const geometries: Array<{ boxCells: number[]; activeCells: number[]; linkedCells: number[]; construction: StrongLinkXorConstruction }> = [];
  const boxRowStart = Math.floor(box / 3) * 3;
  const boxColStart = (box % 3) * 3;
  for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
    for (let colOffset = 0; colOffset < 3; colOffset++) {
      const row = boxRowStart + colOffset;
      const col = boxColStart + rowOffset;
      const intersectionCell = row * 9 + col;
      const boxCountWithoutIntersection = boxCells.length
        - (boxCells.includes(intersectionCell) ? 1 : 0);
      if (requireCount && boxCountWithoutIntersection < 4) continue;

      const construction = eriXorConstruction(box, row, col);
      if (intersection(boxCells, construction.emptyCells ?? []).length) continue;

      const activeCells = intersection(boxCells, UNITS[row]);
      const linkedCells = intersection(boxCells, UNITS[9 + col]);
      if (!activeCells.length || !linkedCells.length) continue;

      geometries.push({
        boxCells,
        activeCells,
        linkedCells,
        construction: {
          ...construction,
          activeCells: [...activeCells],
          linkedCells: [...linkedCells],
        },
      });
    }
  }
  return geometries;
}

function buildSingleDigitStrongLinks(
  cand: CandidateGrid,
  mini: ReturnType<typeof buildMiniSectors>,
  digit: number,
  buckets: StrongLinkSet,
  seen: Set<string>,
): void {
  for (let line = 0; line < 9; line++) {
    for (let type = 0; type < 4; type++) {
      const options = [...mini.RCBnbp[type][line][digit]];
      if (options.length !== 2) continue;   

      const startSector = line + OFFSETS[type];
      const startCells = intersection(UNITS[startSector], mini.digitCells[digit]);
      const firstCells = intersection(UNITS[options[0]], mini.digitCells[digit]);
      const secondCells = intersection(UNITS[options[1]], mini.digitCells[digit]);
      const activeCells = intersection(startCells, firstCells);
      const linkedCells = intersection(startCells, secondCells);
      if (!activeCells.length || !linkedCells.length) continue;

      const linkType = determineLinkType(activeCells, linkedCells);
      if (linkType < 0) continue;
      const link = buildLink(
          cand,
          mini.digitCells,
          digit,
          linkType,
          activeCells,
          linkedCells,
          miniXorConstruction(type, line, options, startSector, activeCells, linkedCells),
      );
      if (type >= 2) {
        const profileCells = union(activeCells, linkedCells);
        const dualEri = eriGeometries(line, mini.digitCells, digit, false)
          .find(geometry => {
            const intersectionCell = geometry.construction.intersectionCell!;
            const remainingProfileCells = profileCells.filter(cell => cell !== intersectionCell);
            return geometry.boxCells.includes(intersectionCell)
              && remainingProfileCells.length > 1
              && geometry.boxCells.join(',') === profileCells.join(',');
          });
        if (dualEri) {
          link.secondaryTypes = ['ERI'];
          link.secondaryXorConstruction = dualEri.construction;
        }
      }
      addUnique(buckets, seen, link);
    }
  }
}

function buildEriLinks(
  cand: CandidateGrid,
  digitCells: number[][],
  digit: number,
  buckets: StrongLinkSet,
  seen: Set<string>,
): void {
  for (let box = 0; box < 9; box++) {
    for (const geometry of eriGeometries(box, digitCells, digit, true)) {
        addUnique(
          buckets,
          seen,
          buildLink(cand, digitCells, digit, ERI, geometry.activeCells, geometry.linkedCells, geometry.construction),
        );
    }
  }
}

export function buildStrongLinks(cand: CandidateGrid): StrongLinkSet {
  nextStrongLinkId = 0;
  const buckets: StrongLinkSet = [[], [], [], [], []];
  const seen = new Set<string>();
  const mini = buildMiniSectors(cand);

  for (let digit = 0; digit < 9; digit++) {
    buildSingleDigitStrongLinks(cand, mini, digit, buckets, seen);
    buildEriLinks(cand, mini.digitCells, digit, buckets, seen);
  }

  for (let cell = 0; cell < 81; cell++) {
    if ((cand[cell] ?? []).length === 2) addUnique(buckets, seen, buildCellAlsLink(cand, cell));
  }

  return buckets;
}

export function flattenStrongLinks(linkset: StrongLinkSet): StrongLink[] {
  return linkset.flat();
}
