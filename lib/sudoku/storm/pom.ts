import {
  cellGroupName,
  formatRemovals,
  peersOf,
  sectorGroupName,
  UNITS,
  type CandidateGrid,
  type Grid,
  type Hint,
} from './sudoku';
import type { FishSearchOptions, FishSize } from './spaces';
import { combinations } from './set-tools';

export interface PomTemplate {
  id: number;
  cells: number[];
}

export interface PomOmission {
  digit: number;
  cells: number[];
}

export interface PomTemplateElimination {
  digit: number;
  templateIds: number[];
  reason: string;
}

export interface PomTkDelete extends PomTemplateElimination {
  size: number;
  companionDigits: number[];
}

export interface PomOmissionFish {
  name: string;
  digit: number;
  size: number;
  coverSize: number;
  k: number;
  baseSectors: number[];
  coverSectors: number[];
  cells: number[];
  triggerCells: number[];
  overcovered: number[];
  triCovered: number[];
  endoFins: number[];
  vertices: number[];
  reason: string;
}

export interface PomSubsetElimination extends PomTemplateElimination {
  size: number;
  digits: number[];
  cells: number[];
  sector: string;
}

export interface PomPassSummary {
  phase: 'omissions' | 'hidden-subset' | 'naked-subset' | 'tk-delete';
  pass: number;
  size?: number;
  reports: number;
  templateDeletes: number;
  templatesBefore: number;
  templatesAfter: number;
  digitCounts: number[];
}

export interface PomCheckResult {
  initialTemplateCounts: number[];
  templateCounts: number[];
  omissions: PomOmission[];
  templateEliminations: PomTemplateElimination[];
  hiddenSubsets: PomSubsetElimination[];
  nakedSubsets: PomSubsetElimination[];
  tkDeletes: PomTkDelete[];
  passSummaries: PomPassSummary[];
  templatesByDigit: PomTemplate[][];
  digitTemplates: number[][][];
}

let catalog: PomTemplate[] | null = null;

function generateTemplates(): PomTemplate[] {
  const templates: PomTemplate[] = [];
  const columns = new Array(9).fill(-1);
  const usedColumns = new Set<number>();
  const usedBoxes = new Set<number>();

  const visit = (row: number): void => {
    if (row === 9) {
      templates.push({
        id: templates.length,
        cells: columns.map((column, currentRow) => currentRow * 9 + column),
      });
      return;
    }

    const band = Math.floor(row / 3);
    for (let column = 0; column < 9; column++) {
      const box = band * 3 + Math.floor(column / 3);
      if (usedColumns.has(column) || usedBoxes.has(box)) continue;

      columns[row] = column;
      usedColumns.add(column);
      usedBoxes.add(box);
      visit(row + 1);
      usedColumns.delete(column);
      usedBoxes.delete(box);
    }
  };

  visit(0);
  return templates;
}

function allTemplates(): PomTemplate[] {
  if (!catalog) catalog = generateTemplates();
  return catalog;
}

function candidateCells(cand: CandidateGrid, grid: Grid, digit: number): Set<number> {
  const cells = new Set<number>();

  for (let cell = 0; cell < 81; cell++) {
    if (grid[cell] === digit || cand[cell]?.includes(digit)) cells.add(cell);
  }

  return cells;
}

function candidateOnlyCells(cand: CandidateGrid, digit: number): Set<number> {
  const cells = new Set<number>();

  for (let cell = 0; cell < 81; cell++) {
    if (cand[cell]?.includes(digit)) cells.add(cell);
  }

  return cells;
}

function buildDigitIndex(templates: PomTemplate[]): number[][] {
  const index = Array.from({ length: 81 }, () => [] as number[]);

  for (const template of templates) {
    for (const cell of template.cells) index[cell].push(template.id);
  }

  return index;
}

function intersects(template: PomTemplate, occupied: Set<number>): boolean {
  return template.cells.some(cell => occupied.has(cell));
}

function hasCompatibleTemplates(
  lists: PomTemplate[][],
  occupied: Set<number>,
): boolean {
  const ordered = [...lists].sort((a, b) => a.length - b.length);

  const visit = (index: number, used: Set<number>): boolean => {
    if (index === ordered.length) return true;

    for (const template of ordered[index]) {
      if (intersects(template, used)) continue;

      const next = new Set(used);
      for (const cell of template.cells) next.add(cell);
      if (visit(index + 1, next)) return true;
    }

    return false;
  };

  return visit(0, new Set(occupied));
}

function universallyExtendable(
  templatesByDigit: PomTemplate[][],
  occupied: Set<number>,
  chosenDigits: Set<number>,
): boolean {
  const remaining = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    .filter(digit => !chosenDigits.has(digit));

  for (const size of [1, 2, 3, 4]) {
    for (const digits of combinations(remaining, size)) {
      const lists = digits.map(digit => templatesByDigit[digit - 1]);
      if (!lists.every(list => list.length) || !hasCompatibleTemplates(lists, occupied)) {
        return false;
      }
    }
  }

  return true;
}

function existsCompatibleSet(
  templatesByDigit: PomTemplate[][],
  lists: PomTemplate[][],
  occupied: Set<number>,
  chosenDigits: Set<number>,
): boolean {
  const ordered = [...lists].sort((a, b) => a.length - b.length);

  const visit = (index: number, used: Set<number>): boolean => {
    if (index === ordered.length) {
      return universallyExtendable(templatesByDigit, used, chosenDigits);
    }

    for (const template of ordered[index]) {
      if (intersects(template, used)) continue;

      const next = new Set(used);
      for (const cell of template.cells) next.add(cell);
      if (visit(index + 1, next)) return true;
    }

    return false;
  };

  return visit(0, new Set(occupied));
}

type FishTypeId = 0 | 1 | 2;
type PomFishSize = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface OmissionFishOptions {
  minSize?: PomFishSize;
  maxSize?: PomFishSize;
  minK?: 0 | 1 | 2;
  maxK?: 0 | 1 | 2;
  digits?: number[];
  baseSectors?: number[];
  coverSectors?: number[];
  basicsEnabled?: boolean;
  frankenEnabled?: boolean;
  mutantEnabled?: boolean;
  earlyTermination?: boolean;
  priorityMode?: boolean;
  enabledTechniques?: Iterable<string>;
}

interface NormalisedOmissionFishOptions {
  minSize: PomFishSize;
  maxSize: PomFishSize;
  minK: 0 | 1 | 2;
  maxK: 0 | 1 | 2;
  digits: Set<number>;
  baseSectors: Set<number>;
  coverSectors: Set<number>;
  basicsEnabled: boolean;
  frankenEnabled: boolean;
  mutantEnabled: boolean;
  earlyTermination: boolean;
  priorityMode: boolean;
  enabledTechniques: Set<string> | null;
}

interface DigitSectorState {
  cellsByDigit: Set<number>[][];
  activeSectorsByDigit: Set<number>[];
}

interface SavedSectorCells {
  allUsedCells: Set<number>;
  rcbOverlap: Set<number>;
  baseIntersections: Set<number>;
  twoCoverIntersections: Set<number>;
}

interface OmissionFishCandidate {
  name: string;
  digit: number;
  size: number;
  coverSize: number;
  k: number;
  baseSectors: number[];
  coverSectors: number[];
  cells: number[];
  triggerCells: number[];
  overcovered: number[];
  triCovered: number[];
  endoFins: number[];
  vertices: number[];
}

const ALL_SECTORS = Array.from({ length: 27 }, (_, index) => index);
const POM_FISH_NAMES: Record<number, string> = {
  1: 'Cyclops',
  2: 'X-Wing',
  3: 'SwordFish',
  4: 'JellyFish',
  5: 'StarFish {Squirmbag}',
  6: 'Whale',
  7: 'Leviathan',
};

function uniqueSorted(values: Iterable<number>): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function setFrom(values: Iterable<number>): Set<number> {
  return new Set(values);
}

function setUnion(...sets: Set<number>[]): Set<number> {
  const out = new Set<number>();
  for (const set of sets) {
    for (const value of set) out.add(value);
  }
  return out;
}

function setIntersection(a: Set<number>, b: Set<number>): Set<number> {
  const out = new Set<number>();
  for (const value of a) if (b.has(value)) out.add(value);
  return out;
}

function setDifference(a: Set<number>, b: Set<number>): Set<number> {
  const out = new Set<number>();
  for (const value of a) if (!b.has(value)) out.add(value);
  return out;
}

function setEquals(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function isSetSubset(subset: Set<number>, set: Set<number>): boolean {
  for (const value of subset) if (!set.has(value)) return false;
  return true;
}

function normaliseOmissionFishOptions(
  options: OmissionFishOptions = {},
): NormalisedOmissionFishOptions {
  const minSize = options.minSize ?? 2;
  const maxSize = options.maxSize ?? 4;
  const minK = options.minK ?? 0;
  const maxK = options.maxK ?? 0;
  const cleanDigits = (options.digits ?? [1, 2, 3, 4, 5, 6, 7, 8, 9])
    .filter(digit => Number.isInteger(digit) && digit >= 1 && digit <= 9);
  const cleanBaseSectors = (options.baseSectors ?? ALL_SECTORS)
    .filter(sector => Number.isInteger(sector) && sector >= 0 && sector < 27);
  const cleanCoverSectors = (options.coverSectors ?? ALL_SECTORS)
    .filter(sector => Number.isInteger(sector) && sector >= 0 && sector < 27);

  return {
    minSize: Math.min(minSize, maxSize) as PomFishSize,
    maxSize: Math.max(minSize, maxSize) as PomFishSize,
    minK: Math.min(minK, maxK) as 0 | 1 | 2,
    maxK: Math.max(minK, maxK) as 0 | 1 | 2,
    digits: new Set(cleanDigits),
    baseSectors: new Set(cleanBaseSectors),
    coverSectors: new Set(cleanCoverSectors),
    basicsEnabled: options.basicsEnabled ?? true,
    frankenEnabled: options.frankenEnabled ?? false,
    mutantEnabled: options.mutantEnabled ?? false,
    earlyTermination: options.earlyTermination ?? true,
    priorityMode: options.priorityMode ?? false,
    enabledTechniques: options.enabledTechniques ? new Set(options.enabledTechniques) : null,
  };
}

function buildDigitSectorState(cand: CandidateGrid): DigitSectorState {
  const cellsByDigit = Array.from({ length: 9 }, () =>
    Array.from({ length: 27 }, () => new Set<number>())
  );
  const activeSectorsByDigit = Array.from({ length: 9 }, () => new Set<number>());

  for (let digit = 1; digit <= 9; digit++) {
    for (let sector = 0; sector < UNITS.length; sector++) {
      for (const cell of UNITS[sector]) {
        if (!cand[cell]?.includes(digit)) continue;
        cellsByDigit[digit - 1][sector].add(cell);
        activeSectorsByDigit[digit - 1].add(sector);
      }
    }
  }

  return { cellsByDigit, activeSectorsByDigit };
}

function isBasicRow(sectors: readonly number[]): boolean {
  return sectors.every(sector => sector < 9);
}

function isBasicCol(sectors: readonly number[]): boolean {
  return sectors.every(sector => sector >= 9 && sector < 18);
}

function isBasicBox(sectors: readonly number[]): boolean {
  return sectors.length > 0 && sectors.every(sector => sector >= 18);
}

function isImpossibleBoxFish(
  baseSectors: readonly number[],
  coverSectors: readonly number[],
): boolean {
  return isBasicBox(baseSectors) && isBasicBox(coverSectors);
}

function isFrankenRow(sectors: readonly number[]): boolean {
  return sectors.some(sector => sector >= 18) && sectors.every(sector => sector < 9 || sector >= 18);
}

function isFrankenCol(sectors: readonly number[]): boolean {
  return sectors.some(sector => sector >= 18) && sectors.every(sector => sector >= 9);
}

function fishType(baseSectors: readonly number[], coverSectors: readonly number[]): FishTypeId {
  const baseBasicRow = isBasicRow(baseSectors);
  const baseBasicCol = isBasicCol(baseSectors);
  const baseBasicBox = isBasicBox(baseSectors);
  const coverBasicRow = isBasicRow(coverSectors);
  const coverBasicCol = isBasicCol(coverSectors);
  const coverBasicBox = isBasicBox(coverSectors);
  const baseFrankenRow = isFrankenRow(baseSectors);
  const baseFrankenCol = isFrankenCol(baseSectors);
  const coverFrankenRow = isFrankenRow(coverSectors);
  const coverFrankenCol = isFrankenCol(coverSectors);

  if (
    (baseBasicRow && coverBasicCol)
    || (baseBasicCol && coverBasicRow)
    || (baseBasicBox && coverBasicRow)
    || (baseBasicBox && coverBasicCol)
    || (baseBasicRow && coverBasicBox)
    || (baseBasicCol && coverBasicBox)
  ) return 0;

  if (
    (baseFrankenRow && coverFrankenCol)
    || (baseFrankenCol && coverFrankenRow)
    || (baseBasicRow && coverFrankenCol)
    || (baseBasicCol && coverFrankenRow)
    || (coverBasicRow && baseFrankenCol)
    || (coverBasicCol && baseFrankenRow)
  ) {
    return 1;
  }

  return 2;
}

function baseCombinationAllowed(
  sectors: readonly number[],
  options: NormalisedOmissionFishOptions,
): boolean {
  if (options.mutantEnabled) return true;
  if (options.frankenEnabled) {
    return isBasicRow(sectors)
      || isBasicCol(sectors)
      || isBasicBox(sectors)
      || isFrankenRow(sectors)
      || isFrankenCol(sectors);
  }
  return options.basicsEnabled
    && (isBasicRow(sectors) || isBasicCol(sectors) || isBasicBox(sectors));
}

function baseSearchSectors(
  usableSectors: readonly number[],
  options: NormalisedOmissionFishOptions,
): number[] {
  if (options.basicsEnabled && !options.frankenEnabled && !options.mutantEnabled) {
    return [...usableSectors];
  }

  return [...usableSectors];
}

function coverSearchSectors(
  usableSectors: readonly number[],
  baseSectors: readonly number[],
  options: NormalisedOmissionFishOptions,
): number[] {
  if (options.basicsEnabled && !options.frankenEnabled && !options.mutantEnabled) {
    if (isBasicRow(baseSectors)) return usableSectors.filter(sector => sector >= 9);
    if (isBasicCol(baseSectors)) return usableSectors.filter(sector => sector < 9 || sector >= 18);
    if (isBasicBox(baseSectors)) return usableSectors.filter(sector => sector < 18);
  }

  return [...usableSectors];
}

function fishTypeAllowed(type: FishTypeId, options: NormalisedOmissionFishOptions): boolean {
  if (type === 0) return options.basicsEnabled;
  if (type === 1) return options.frankenEnabled;
  return options.mutantEnabled;
}

function fishName(size: number, k: number, type: FishTypeId): string {
  const typeName = type === 1 ? 'Franken ' : type === 2 ? 'Mutant ' : '';
  const finned = k > 0 && size > 1 ? 'Finned ' : '';
  return `${finned}${typeName}${POM_FISH_NAMES[size] ?? `Fish ${size}`}`;
}

function fishMoveTypeForReport(fish: PomOmissionFish): string | null {
  const size = Number(fish.size);
  const k = Number(fish.k ?? 0);
  if (k > 0) return `${size}x${size}+k-fish`;
  return ({ 2: 'x-wing', 3: 'swordfish', 4: 'jellyfish' } as Record<number, string>)[size] ?? null;
}

function fishReportEnabled(fish: PomOmissionFish, options: NormalisedOmissionFishOptions): boolean {
  const moveType = fishMoveTypeForReport(fish);
  return !options.enabledTechniques || (moveType !== null && options.enabledTechniques.has(moveType));
}

function saveSectorCells(
  state: DigitSectorState,
  digit: number,
  sectors: readonly number[],
): SavedSectorCells {
  const rowCells = new Set<number>();
  const colCells = new Set<number>();
  const boxCells = new Set<number>();
  const allUsedCells = new Set<number>();

  for (const sector of sectors) {
    const activeCells = state.cellsByDigit[digit - 1][sector];
    for (const cell of activeCells) {
      allUsedCells.add(cell);
      if (sector < 9) rowCells.add(cell);
      else if (sector < 18) colCells.add(cell);
      else boxCells.add(cell);
    }
  }

  const rowColOverlap = setIntersection(rowCells, colCells);
  const colBoxOverlap = setIntersection(colCells, boxCells);
  const rowBoxOverlap = setIntersection(rowCells, boxCells);
  const rcbOverlap = setIntersection(rowColOverlap, boxCells);

  return {
    allUsedCells,
    rcbOverlap,
    baseIntersections: setUnion(rcbOverlap, rowBoxOverlap, rowColOverlap, colBoxOverlap),
    twoCoverIntersections: setUnion(rowBoxOverlap, rowColOverlap, colBoxOverlap),
  };
}

function sectorCellCountsInRange(
  state: DigitSectorState,
  digit: number,
  sectors: readonly number[],
  size: number,
): boolean {
  return sectors.every(sector => state.cellsByDigit[digit - 1][sector].size <= size + 4);
}

function noDuplicateCellSectors(
  state: DigitSectorState,
  digit: number,
  sectors: readonly number[],
): boolean {
  for (let i = 0; i < sectors.length; i++) {
    const cellsA = state.cellsByDigit[digit - 1][sectors[i]];
    for (let j = i + 1; j < sectors.length; j++) {
      const cellsB = state.cellsByDigit[digit - 1][sectors[j]];
      if (setEquals(cellsA, cellsB)) return false;
    }
  }

  return true;
}

function noCellsForCover(
  state: DigitSectorState,
  digit: number,
  allBaseCells: Set<number>,
  sectors: readonly number[],
): boolean {
  return sectors.every(sector =>
    setIntersection(state.cellsByDigit[digit - 1][sector], allBaseCells).size > 0
  );
}

function noDuplicateCellCovers(
  state: DigitSectorState,
  digit: number,
  allBaseCells: Set<number>,
  sectors: readonly number[],
): boolean {
  for (let i = 0; i < sectors.length; i++) {
    const cellsA = state.cellsByDigit[digit - 1][sectors[i]];
    const checkA = setIntersection(cellsA, allBaseCells);

    for (let j = i + 1; j < sectors.length; j++) {
      const cellsB = state.cellsByDigit[digit - 1][sectors[j]];
      const checkB = setIntersection(cellsB, allBaseCells);
      if (isSetSubset(checkB, checkA) || isSetSubset(checkA, checkB) || setEquals(cellsA, cellsB)) {
        return false;
      }
    }
  }

  return true;
}

function peerCandidateCellsForAll(
  cand: CandidateGrid,
  digit: number,
  sourceCells: Set<number>,
): Set<number> {
  const sources = [...sourceCells];
  const out = new Set<number>();
  if (!sources.length) return out;

  for (let cell = 0; cell < 81; cell++) {
    if (!cand[cell]?.includes(digit)) continue;
    if (sources.every(source => peersOf(source).includes(cell))) out.add(cell);
  }

  return out;
}

function activeCandidateEliminations(
  cand: CandidateGrid,
  digit: number,
  cells: Set<number>,
): number[] {
  return uniqueSorted([...cells].filter(cell => cand[cell]?.includes(digit)));
}

function omissionFishEliminations(
  cand: CandidateGrid,
  digit: number,
  size: number,
  coverSize: number,
  baseSaved: SavedSectorCells,
  coverSaved: SavedSectorCells,
): Pick<OmissionFishCandidate, 'cells' | 'overcovered' | 'triCovered' | 'endoFins'> {
  const extraCoverCount = coverSize - size;
  const coverMinusBase = setDifference(coverSaved.allUsedCells, baseSaved.allUsedCells);
  const twoCovers = coverSaved.twoCoverIntersections;
  const threeCovers = coverSaved.rcbOverlap;
  const parts: Set<number>[] = [];
  let endoFins = new Set<number>();
  let overcovered = twoCovers;

  if (baseSaved.baseIntersections.size) {
    const coverBaseOverlap = setIntersection(twoCovers, baseSaved.baseIntersections);
    const baseOverlapFullyCovered = setEquals(coverBaseOverlap, baseSaved.baseIntersections);
    const baseOverlapNotCovered = setDifference(baseSaved.baseIntersections, coverBaseOverlap);
    const endoFinPeers = peerCandidateCellsForAll(cand, digit, baseOverlapNotCovered);
    const twoCoversOutsideBaseIntersections = setDifference(twoCovers, baseSaved.baseIntersections);

    endoFins = baseOverlapNotCovered;
    overcovered = twoCoversOutsideBaseIntersections;

    const restricted = (cells: Set<number>) =>
      baseOverlapFullyCovered ? cells : setIntersection(endoFinPeers, cells);

    if (size === coverSize) {
      parts.push(restricted(coverMinusBase));
      parts.push(restricted(setDifference(twoCoversOutsideBaseIntersections, coverMinusBase)));
      parts.push(restricted(setDifference(threeCovers, coverMinusBase)));
    }

    if (extraCoverCount === 1) {
      parts.push(restricted(setDifference(twoCoversOutsideBaseIntersections, baseSaved.allUsedCells)));
      parts.push(restricted(setDifference(threeCovers, coverMinusBase)));
    }

    if (extraCoverCount === 2) {
      parts.push(restricted(setDifference(threeCovers, baseSaved.allUsedCells)));
    }
  } else {
    const twoCoverElims = setDifference(twoCovers, coverMinusBase);
    const triCoverElims = setDifference(threeCovers, coverMinusBase);

    if (size === coverSize) {
      parts.push(coverMinusBase);
      parts.push(twoCoverElims);
      parts.push(triCoverElims);
    }

    if (extraCoverCount === 1) {
      parts.push(setDifference(twoCovers, baseSaved.allUsedCells));
      parts.push(triCoverElims);
    }

    if (extraCoverCount === 2) {
      parts.push(setDifference(threeCovers, baseSaved.allUsedCells));
    }
  }

  return {
    cells: activeCandidateEliminations(cand, digit, setUnion(...parts)),
    overcovered: uniqueSorted(overcovered),
    triCovered: uniqueSorted(threeCovers),
    endoFins: uniqueSorted(endoFins),
  };
}

function processOmissionFishCover(
  cand: CandidateGrid,
  state: DigitSectorState,
  digit: number,
  size: number,
  baseSectors: number[],
  baseSaved: SavedSectorCells,
  coverSectors: number[],
  triggerCells: Set<number>,
  options: NormalisedOmissionFishOptions,
): OmissionFishCandidate | null {
  if (isImpossibleBoxFish(baseSectors, coverSectors)) return null;

  const coverSaved = saveSectorCells(state, digit, coverSectors);
  if (!isSetSubset(baseSaved.allUsedCells, coverSaved.allUsedCells)) return null;

  const type = fishType(baseSectors, coverSectors);
  if (!fishTypeAllowed(type, options)) return null;

  const coverSize = coverSectors.length;
  const details = omissionFishEliminations(cand, digit, size, coverSize, baseSaved, coverSaved);
  if (!details.cells.length) return null;

  const baseCells = setUnion(...baseSectors.map(sector => setFrom(UNITS[sector])));
  const coverCells = setUnion(...coverSectors.map(sector => setFrom(UNITS[sector])));

  return {
    name: fishName(size, coverSize - size, type),
    digit,
    size,
    coverSize,
    k: coverSize - size,
    baseSectors: uniqueSorted(baseSectors),
    coverSectors: uniqueSorted(coverSectors),
    cells: details.cells,
    triggerCells: uniqueSorted(setIntersection(triggerCells, coverSaved.allUsedCells)),
    overcovered: details.overcovered,
    triCovered: details.triCovered,
    endoFins: details.endoFins,
    vertices: uniqueSorted(setIntersection(baseCells, coverCells)),
  };
}

function filterOmissionFishBaseCombinations(
  state: DigitSectorState,
  digit: number,
  usableSectors: number[],
  size: number,
  triggerCells: Set<number>,
  options: NormalisedOmissionFishOptions,
): number[][] {
  const out: number[][] = [];

  for (const sectors of combinations(usableSectors, size)) {
    if (!baseCombinationAllowed(sectors, options)) continue;

    const baseSaved = saveSectorCells(state, digit, sectors);
    if (isSetSubset(triggerCells, baseSaved.allUsedCells)) continue;
    if (!sectorCellCountsInRange(state, digit, sectors, size)) continue;
    if (!noDuplicateCellSectors(state, digit, sectors)) continue;

    out.push(sectors);
  }

  return out;
}

function filterOmissionFishCoverCombinations(
  state: DigitSectorState,
  digit: number,
  usableSectors: number[],
  baseSectors: number[],
  baseSaved: SavedSectorCells,
  coverSize: number,
  triggerCells: Set<number>,
  options: NormalisedOmissionFishOptions,
): number[][] {
  const baseSet = setFrom(baseSectors);
  const candidates = usableSectors.filter(sector => {
    if (baseSet.has(sector)) return false;
    const cells = state.cellsByDigit[digit - 1][sector];
    return setIntersection(cells, baseSaved.allUsedCells).size > 0;
  });
  const out: number[][] = [];

  // Build covers around the still-uncovered base cells instead of testing every
  // sector combination. This is the omission index's main performance path.
  const canCoverRemaining = (start: number, covered: Set<number>): boolean => {
    for (const cell of baseSaved.allUsedCells) {
      if (covered.has(cell)) continue;
      let possible = false;
      for (let index = start; index < candidates.length; index++) {
        if (state.cellsByDigit[digit - 1][candidates[index]].has(cell)) {
          possible = true;
          break;
        }
      }
      if (!possible) return false;
    }
    return true;
  };

  const duplicateWithChosen = (sector: number, chosen: number[]): boolean => {
    const cells = state.cellsByDigit[digit - 1][sector];
    const check = setIntersection(cells, baseSaved.allUsedCells);
    for (const chosenSector of chosen) {
      const chosenCells = state.cellsByDigit[digit - 1][chosenSector];
      const chosenCheck = setIntersection(chosenCells, baseSaved.allUsedCells);
      if (
        isSetSubset(check, chosenCheck)
        || isSetSubset(chosenCheck, check)
        || setEquals(cells, chosenCells)
      ) return true;
    }
    return false;
  };

  const visit = (
    start: number,
    chosen: number[],
    covered: Set<number>,
    hasTrigger: boolean,
  ): void => {
    const remaining = coverSize - chosen.length;
    if (remaining === 0) {
      if (!isSetSubset(baseSaved.allUsedCells, covered) || !hasTrigger) return;
      if (!fishTypeAllowed(fishType(baseSectors, chosen), options)) return;
      out.push([...chosen]);
      return;
    }

    if (candidates.length - start < remaining || !canCoverRemaining(start, covered)) return;

    const lastStart = candidates.length - remaining;
    for (let index = start; index <= lastStart; index++) {
      const sector = candidates[index];
      if (duplicateWithChosen(sector, chosen)) continue;

      const cells = state.cellsByDigit[digit - 1][sector];
      const nextCovered = setUnion(covered, cells);
      chosen.push(sector);
      visit(
        index + 1,
        chosen,
        nextCovered,
        hasTrigger || setIntersection(cells, triggerCells).size > 0,
      );
      chosen.pop();
    }
  };

  visit(0, [], new Set<number>(), false);

  return out;
}

function findOmissionFishPass(
  cand: CandidateGrid,
  templatesByDigit: PomTemplate[][],
  digitTemplates: number[][][],
  omissionsByDigit: Set<number>[],
  reports: PomOmissionFish[],
  options: OmissionFishOptions = {},
): boolean {
  const opts = normaliseOmissionFishOptions(options);
  if (!(opts.basicsEnabled || opts.frankenEnabled || opts.mutantEnabled)) return false;

  const state = buildDigitSectorState(cand);
  const seenReports = new Set(reports.map(report =>
    `${report.digit}:${report.baseSectors.join(',')}/${report.coverSectors.join(',')}:${report.cells.join(',')}`
  ));

  for (let digit = 1; digit <= 9; digit++) {
    if (!opts.digits.has(digit)) continue;

    const triggerCells = omissionsByDigit[digit - 1];
    if (!triggerCells?.size) continue;

    const activeSectors = state.activeSectorsByDigit[digit - 1];
    const usableBaseSectors = baseSearchSectors(
        ALL_SECTORS.filter(sector => activeSectors.has(sector) && opts.baseSectors.has(sector)),
        opts,
      );
      const usableCoverSectors = ALL_SECTORS.filter(sector =>
        activeSectors.has(sector) && opts.coverSectors.has(sector)
      );

    for (let size = opts.minSize; size <= opts.maxSize; size++) {
      const baseCombinations = filterOmissionFishBaseCombinations(
        state,
        digit,
        usableBaseSectors,
        size,
        triggerCells,
        opts,
      );

      for (const baseSectors of baseCombinations) {
        const baseSaved = saveSectorCells(state, digit, baseSectors);
        if (baseSaved.rcbOverlap.size) continue;
        const coverSectorsForBase = coverSearchSectors(usableCoverSectors, baseSectors, opts);

        let stopCoverExpansion = false;
        for (
          let coverSize = size + opts.minK;
          coverSize <= size + opts.maxK && coverSize <= 9 && !stopCoverExpansion;
          coverSize++
        ) {
          const coverCombinations = filterOmissionFishCoverCombinations(
            state,
            digit,
            coverSectorsForBase,
            baseSectors,
            baseSaved,
            coverSize,
            triggerCells,
            opts,
          );

          for (const coverSectors of coverCombinations) {
            const match = processOmissionFishCover(
              cand,
              state,
              digit,
              size,
              baseSectors,
              baseSaved,
              coverSectors,
              triggerCells,
              opts,
            );
            if (!match) continue;

            const cells = match.cells.filter(cell => cand[cell]?.includes(digit));
            if (!cells.length) continue;

            const key = `${digit}:${match.baseSectors.join(',')}/${match.coverSectors.join(',')}:${cells.join(',')}`;
            if (seenReports.has(key)) continue;
            seenReports.add(key);

            reports.push({
              ...match,
              cells: uniqueSorted(cells),
              reason: 'template-omission-fish',
            });

            if (opts.earlyTermination && fishReportEnabled(match as PomOmissionFish, opts)) {
              stopCoverExpansion = true;
              break;
            }
          }
        }
      }
    }
  }

  void templatesByDigit;
  void digitTemplates;
  return false;
}

function applyTemplateDeletes(
  templatesByDigit: PomTemplate[][],
  digitTemplates: number[][][],
  deletions: Map<number, Set<number>>,
): boolean {
  let changed = false;

  for (const [digit, ids] of deletions) {
    const before = templatesByDigit[digit];
    const after = before.filter(template => !ids.has(template.id));
    if (after.length === before.length) continue;

    templatesByDigit[digit] = after;
    digitTemplates[digit] = buildDigitIndex(after);
    changed = true;
  }

  return changed;
}

function sectorLabel(index: number): string {
  if (index < 9) return `r${index + 1}`;
  if (index < 18) return `c${index - 8}`;
  return `b${index - 17}`;
}

function unionTemplateIds(index: number[][][], digit: number, cells: number[]): Set<number> {
  const ids = new Set<number>();
  for (const cell of cells) {
    for (const id of index[digit - 1][cell]) ids.add(id);
  }
  return ids;
}

function findHiddenSubsetPass(
  size: 1 | 2 | 3 | 4,
  templatesByDigit: PomTemplate[][],
  digitTemplates: number[][][],
  reports: PomSubsetElimination[],
): boolean {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  const pending = new Map<number, Set<number>>();

  for (const digitCombo of combinations(digits, size)) {
    if (digitCombo.some(digit => !templatesByDigit[digit - 1].length)) continue;

    for (let sector = 0; sector < UNITS.length; sector++) {
      for (const cells of combinations(UNITS[sector], size)) {
        const coversAll = digitCombo.every(digit =>
          unionTemplateIds(digitTemplates, digit, cells).size === templatesByDigit[digit - 1].length
        );
        if (!coversAll) continue;

        const eliminations = new Map<number, Set<number>>();
        for (const digit of digits) {
          if (digitCombo.includes(digit)) continue;
          const ids = unionTemplateIds(digitTemplates, digit, cells);
          if (ids.size) eliminations.set(digit, ids);
        }

        if (!eliminations.size) continue;

        for (const [digit, ids] of eliminations) {
          if (!pending.has(digit - 1)) pending.set(digit - 1, new Set());
          ids.forEach(id => pending.get(digit - 1)?.add(id));
          reports.push({
            digit,
            templateIds: [...ids].sort((a, b) => a - b),
            reason: 'hidden-subset',
            size,
            digits: digitCombo,
            cells,
            sector: sectorLabel(sector),
          });
        }
      }
    }
  }

  if (applyTemplateDeletes(templatesByDigit, digitTemplates, pending)) return true;

  return false;
}

function findNakedSubsetPass(
  size: 1 | 2 | 3 | 4,
  templatesByDigit: PomTemplate[][],
  digitTemplates: number[][][],
  reports: PomSubsetElimination[],
): boolean {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const pending = new Map<number, Set<number>>();

  for (const digitCombo of combinations(digits, size)) {
    const selectedDigits = new Set(digitCombo);

    for (let sector = 0; sector < UNITS.length; sector++) {
      for (const cells of combinations(UNITS[sector], size)) {
        const validCells = cells.every(cell => {
          const activeDigits = digits.filter(digit => digitTemplates[digit - 1][cell].length);
          return activeDigits.length > 0 && activeDigits.every(digit => selectedDigits.has(digit));
        });
        if (!validCells) continue;

        const eliminations = new Map<number, Set<number>>();
        for (const digit of digitCombo) {
          const used = unionTemplateIds(digitTemplates, digit, cells);
          const outside = new Set(templatesByDigit[digit - 1].map(template => template.id));
          for (const id of used) outside.delete(id);
          if (outside.size) eliminations.set(digit, outside);
        }

        if (!eliminations.size) continue;

        for (const [digit, ids] of eliminations) {
          if (!pending.has(digit - 1)) pending.set(digit - 1, new Set());
          ids.forEach(id => pending.get(digit - 1)?.add(id));
          reports.push({
            digit,
            templateIds: [...ids].sort((a, b) => a - b),
            reason: 'naked-subset',
            size,
            digits: digitCombo,
            cells,
            sector: sectorLabel(sector),
          });
        }
      }
    }
  }

  if (applyTemplateDeletes(templatesByDigit, digitTemplates, pending)) return true;

  return false;
}

function findTkDeletes(
  size: 1 | 2 | 3 | 4,
  templatesByDigit: PomTemplate[][],
  digitTemplates: number[][][],
  reports: PomTkDelete[],
): boolean {
  const pending = new Map<number, Set<number>>();

  for (let baseDigit = 1; baseDigit <= 9; baseDigit++) {
    for (const baseTemplate of templatesByDigit[baseDigit - 1]) {
      for (const companionDigits of combinations(
        [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(digit => digit !== baseDigit),
        size - 1,
      )) {
        const lists = companionDigits.map(digit => templatesByDigit[digit - 1]);
        if (!lists.every(list => list.length)) continue;

        const occupied = new Set(baseTemplate.cells);
        const chosenDigits = new Set([baseDigit, ...companionDigits]);
        const extendable = existsCompatibleSet(
          templatesByDigit,
          lists,
          occupied,
          chosenDigits,
        );
        if (extendable) continue;

        if (!pending.has(baseDigit - 1)) pending.set(baseDigit - 1, new Set());
        pending.get(baseDigit - 1)?.add(baseTemplate.id);
        reports.push({
          digit: baseDigit,
          templateIds: [baseTemplate.id],
          reason: `T${size + 1}-delete`,
          size,
          companionDigits,
        });
        break;
      }
    }
  }

  return applyTemplateDeletes(templatesByDigit, digitTemplates, pending);
}

function collectOmissions(
  templatesByDigit: PomTemplate[][],
  candidateCellsByDigit: Set<number>[],
  omissions: PomOmission[],
  seen: Set<string>,
): Set<number>[] {
  const omissionsByDigit = Array.from({ length: 9 }, () => new Set<number>());

  for (let digit = 1; digit <= 9; digit++) {
    const active = templatesByDigit[digit - 1];
    const usedCells = new Set<number>();
    for (const template of active) {
      for (const cell of template.cells) usedCells.add(cell);
    }

    const omittedCells = [...candidateCellsByDigit[digit - 1]]
      .filter(cell => !usedCells.has(cell))
      .sort((a, b) => a - b);
    if (!omittedCells.length) continue;

    omissionsByDigit[digit - 1] = new Set(omittedCells);

    const key = `${digit}:${omittedCells.join(',')}`;
    if (!seen.has(key)) {
      seen.add(key);
      omissions.push({ digit, cells: omittedCells });
    }
  }

  return omissionsByDigit;
}

function templateTotal(templatesByDigit: PomTemplate[][]): number {
  return templatesByDigit.reduce((total, templates) => total + templates.length, 0);
}

function templatesResolved(templatesByDigit: PomTemplate[][]): boolean {
  return templatesByDigit.every(templates => templates.length === 1);
}

function passSummary(
  phase: PomPassSummary['phase'],
  pass: number,
  size: number | undefined,
  before: number,
  after: number,
  reports: readonly { digit: number }[],
): PomPassSummary {
  const digitCounts = new Array(9).fill(0);
  for (const report of reports) digitCounts[report.digit - 1]++;

  return {
    phase,
    pass,
    ...(size === undefined ? {} : { size }),
    reports: reports.length,
    templateDeletes: Math.max(0, before - after),
    templatesBefore: before,
    templatesAfter: after,
    digitCounts,
  };
}

function recordPassSummary(
  passSummaries: PomPassSummary[],
  phase: PomPassSummary['phase'],
  pass: number,
  size: number | undefined,
  before: number,
  after: number,
  reports: readonly { digit: number }[],
): void {
  const summary = passSummary(phase, pass, size, before, after, reports);
  if (summary.reports > 0) passSummaries.push(summary);
}

export function formatPomOmission(omission: PomOmission): string {
  const eliminations = omission.cells.map(cell => ({ cell, digit: omission.digit }));
  return `Omission: (${omission.digit}) ${formatRemovals(eliminations)}`;
}

export function formatPomOmissionFish(fish: PomOmissionFish): string {
  const eliminations = fish.cells.map(cell => ({ cell, digit: fish.digit }));
  return `${fish.name}: (${fish.digit}) ${sectorGroupName(fish.baseSectors)} / ${sectorGroupName(fish.coverSectors)} => ${formatRemovals(eliminations)}`;
}

export function omissionFishStep(
  cand: CandidateGrid,
  sizes: readonly FishSize[],
  options: FishSearchOptions = {},
): Hint | null {
  const grid = options.grid;
  if (!grid || grid.length !== 81) return null;

  const templates = allTemplates();
  const templatesByDigit: PomTemplate[][] = [];
  const digitTemplates: number[][][] = [];
  const candidateCellsByDigit: Set<number>[] = [];

  for (let digit = 1; digit <= 9; digit++) {
    const allowed = candidateCells(cand, grid, digit);
    const active = templates.filter(template => template.cells.every(cell => allowed.has(cell)));
    templatesByDigit.push(active);
    digitTemplates.push(buildDigitIndex(active));
    candidateCellsByDigit.push(candidateOnlyCells(cand, digit));
  }

  const omissionsByDigit = collectOmissions(
    templatesByDigit,
    candidateCellsByDigit,
    [],
    new Set<string>(),
  );
  const priority = { Basic: 0, Franken: 1, Mutant: 2 } as Record<string, number>;
  const categoryPasses: Array<[
    'basicsEnabled' | 'frankenEnabled' | 'mutantEnabled',
    boolean,
  ]> = [
    ['basicsEnabled', options.basicsEnabled ?? true],
    ['frankenEnabled', options.frankenEnabled ?? false],
    ['mutantEnabled', options.mutantEnabled ?? false],
  ];

  for (const [categoryFlag, enabled] of categoryPasses) {
    if (!enabled) continue;

    // Keep each hierarchy pass isolated so a broader category cannot
    // consume a Basic or Franken candidate during the same search.
    const reports: PomOmissionFish[] = [];
    findOmissionFishPass(
      cand,
      templatesByDigit,
      digitTemplates,
      omissionsByDigit,
      reports,
      {
        ...options,
        minSize: sizes[0],
        maxSize: sizes[sizes.length - 1],
        basicsEnabled: false,
        frankenEnabled: false,
        mutantEnabled: false,
        [categoryFlag]: true,
      },
    );

    const orderedReports = options.priorityMode
      ? [...reports].sort((a, b) => {
          const categoryDelta = (priority[(a as any).category] ?? 99) - (priority[(b as any).category] ?? 99);
          if (categoryDelta) return categoryDelta;
          return Number(a.k ?? 0) - Number(b.k ?? 0);
        })
      : reports;
    const report = orderedReports[0];
    if (!report) continue;

    const items = report.cells.map(cell => ({ cell, digit: report.digit }));
    return {
      tech: 'fish',
      desc: formatPomOmissionFish(report),
      elim: { items },
      digits: [report.digit],
      baseSectors: report.baseSectors,
      coverSectors: report.coverSectors,
      vertices: report.vertices,
      fins: report.triggerCells,
      endofins: report.endoFins,
      overcovered: report.overcovered,
      triCovered: report.triCovered,
    };
  }

  return null;
}

export function pomCheck(
  cand: CandidateGrid,
  grid: Grid,
): PomCheckResult {
  const templatesByDigit: PomTemplate[][] = [];
  const digitTemplates: number[][][] = [];
  const omissions: PomOmission[] = [];
  const templateEliminations: PomTemplateElimination[] = [];
  const hiddenSubsets: PomSubsetElimination[] = [];
  const nakedSubsets: PomSubsetElimination[] = [];
  const tkDeletes: PomTkDelete[] = [];
  const passSummaries: PomPassSummary[] = [];
  const templates = allTemplates();
  const allowedByDigit: Set<number>[] = [];
  const candidateCellsByDigit: Set<number>[] = [];
  const seenOmissions = new Set<string>();

  for (let digit = 1; digit <= 9; digit++) {
    const allowed = candidateCells(cand, grid, digit);
    allowedByDigit.push(allowed);
    candidateCellsByDigit.push(candidateOnlyCells(cand, digit));
    const active = templates.filter(template => template.cells.every(cell => allowed.has(cell)));
    const index = buildDigitIndex(active);

    templatesByDigit.push(active);
    digitTemplates.push(index);
  }

  const initialTemplateCounts = templatesByDigit.map(list => list.length);

  for (let pass = 1; ; pass++) {
    if (templatesResolved(templatesByDigit)) break;

    collectOmissions(
      templatesByDigit,
      candidateCellsByDigit,
      omissions,
      seenOmissions,
    );

    let hiddenChanged = false;
    for (const size of [1, 2, 3, 4] as const) {
      const before = templateTotal(templatesByDigit);
      const reportStart = hiddenSubsets.length;
      const changed = findHiddenSubsetPass(size, templatesByDigit, digitTemplates, hiddenSubsets);
      const after = templateTotal(templatesByDigit);
      recordPassSummary(
        passSummaries,
        'hidden-subset',
        pass,
        size,
        before,
        after,
        hiddenSubsets.slice(reportStart),
      );
      if (changed) {
        hiddenChanged = true;
        break;
      }
    }
    if (hiddenChanged) continue;

    let nakedChanged = false;
    for (const size of [1, 2, 3, 4] as const) {
      const before = templateTotal(templatesByDigit);
      const reportStart = nakedSubsets.length;
      const changed = findNakedSubsetPass(size, templatesByDigit, digitTemplates, nakedSubsets);
      const after = templateTotal(templatesByDigit);
      recordPassSummary(
        passSummaries,
        'naked-subset',
        pass,
        size,
        before,
        after,
        nakedSubsets.slice(reportStart),
      );
      if (changed) {
        nakedChanged = true;
        break;
      }
    }
    if (nakedChanged) continue;

    let tkChanged = false;
    for (const size of [1, 2, 3, 4] as const) {
      const before = templateTotal(templatesByDigit);
      const reportStart = tkDeletes.length;
      const changed = findTkDeletes(size, templatesByDigit, digitTemplates, tkDeletes);
      const after = templateTotal(templatesByDigit);
      recordPassSummary(
        passSummaries,
        'tk-delete',
        pass,
        size + 1,
        before,
        after,
        tkDeletes.slice(reportStart),
      );
      if (changed) {
        tkChanged = true;
        break;
      }
    }
    if (!tkChanged) break;
  }

  return {
    initialTemplateCounts,
    templateCounts: templatesByDigit.map(list => list.length),
    omissions,
    templateEliminations,
    hiddenSubsets,
    nakedSubsets,
    tkDeletes,
    passSummaries,
    templatesByDigit,
    digitTemplates,
  };
}
