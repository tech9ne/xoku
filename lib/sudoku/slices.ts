// Stage 0: shared slice tables for both lenses (chain + fish).
// Formalism: each sector is a Domain Sector; its three 3-cell intersections
// with the crossing sector type are Mini-Sectors (slice propositions).
// One slice empty => XOR collapses to two operands => structural strong link.
// ERi is a TAGGED PROPERTY on box links (R1 ruling), not a separate finder.
import { ALL_DIGITS, Game, UNITS, candMask, candsOf, countCands } from "./core";

// ---- slice-set construction -------------------------------------------
// A slice-set for digit d in sector s = the d-candidates of s inside one
// crossing partition. Four types:
//   0: row sliced by boxes      (3 slices per row)
//   1: col sliced by boxes      (3 slices per col)
//   2: box sliced by rows       (3 slices per box)
//   3: box sliced by cols       (3 slices per box)
export interface SliceLink {
  digit: number;
  type: 0 | 1 | 2 | 3;
  // the two occupied slices (each: cells of digit d in the partition)
  aCells: number[];
  bCells: number[];
  // the base sector both live in
  sector: number; // 0-26
  eri: boolean;   // ERi tag (type 2/3 with box-level geometry)
}

const boxOfRow = (r: number) => Math.floor(r / 3) * 3 + Math.floor(0 / 3); // unused, kept for clarity below
const rowOfCell = (c: number) => Math.floor(c / 9);
const colOfCell = (c: number) => c % 9;
const boxOfCell = (c: number) => Math.floor(c / 27) * 3 + Math.floor((c % 9) / 3);

function sliceSets(g: Game, d: number, sector: number): number[][] {
  // returns the 3 slice-sets of this sector for digit d
  const cells = UNITS[sector].filter(i => g.values[i] === 0 && g.cands[i] & candMask(d));
  const parts: number[][] = [[], [], []];
  if (sector < 9) {
    // row sliced by its 3 boxes
    for (const c of cells) parts[Math.floor((c % 9) / 3)].push(c);
  } else if (sector < 18) {
    // col sliced by its 3 boxes
    for (const c of cells) parts[Math.floor(c / 27)].push(c);
  } else {
    // box sliced by rows (type 2) or cols (type 3): caller decides via sliceType
    // handled by caller - see buildLinks
  }
  return parts;
}

function boxSliceSets(g: Game, d: number, box: number, byRows: boolean): number[][] {
  const cells = UNITS[18 + box].filter(i => g.values[i] === 0 && g.cands[i] & candMask(d));
  const parts: number[][] = [[], [], []];
  for (const c of cells) {
    const localRow = Math.floor(c / 9) - Math.floor(UNITS[18 + box][0] / 9);
    const localCol = (c % 9) - (UNITS[18 + box][0] % 9);
    parts[byRows ? localRow : localCol].push(c);
  }
  return parts;
}

// ERi tag (R1): for a box link of type 2 or 3, ERi validity per the wiki
// count rule: digit confined to exactly one row-slice AND one col-slice of
// the box, both non-empty, intersection not the sole active cell.
function eriTag(g: Game, d: number, box: number): boolean {
  const cells = UNITS[18 + box].filter(i => g.values[i] === 0 && g.cands[i] & candMask(d));
  if (cells.length < 2 || cells.length > 5) return false;
  const rows = new Set<number>(), cols = new Set<number>();
  for (const c of cells) { rows.add(rowOfCell(c)); cols.add(colOfCell(c)); }
  if (rows.size !== 1 || cols.size !== 1) return false;
  const r = [...rows][0], k = [...cols][0];
  const inter = r * 9 + k;
  if (cells.includes(inter) && cells.length < 2) return false;
  return true;
}

export function buildSliceLinks(g: Game): SliceLink[] {
  const links: SliceLink[] = [];
  for (const d of ALL_DIGITS) {
    // types 0,1: rows and cols sliced by boxes
    for (let s = 0; s < 18; s++) {
      const parts = sliceSets(g, d, s);
      const empty = parts.findIndex(p => p.length === 0);
      const occupied = parts.filter(p => p.length > 0);
      if (empty === -1 || occupied.length !== 2) continue;
      links.push({
        digit: d, type: s < 9 ? 0 : 1,
        aCells: occupied[0], bCells: occupied[1],
        sector: s, eri: false,
      });
    }
    // types 2,3: boxes sliced by rows / cols, with ERi tagging
    for (let b = 0; b < 9; b++) {
      for (const byRows of [true, false]) {
        const parts = boxSliceSets(g, d, b, byRows);
        const occupied = parts.filter(p => p.length > 0);
        if (occupied.length !== 2) continue;
        const eri = eriTag(g, d, b);
        links.push({
          digit: d, type: byRows ? 2 : 3,
          aCells: occupied[0], bCells: occupied[1],
          sector: 18 + b, eri,
        });
      }
    }
  }
  return links;
}

// ---- type 0 (bilocation) kept for the plain-pair case -----------------
export function bilocationLinks(g: Game): { digit: number; a: number; b: number; sector: number }[] {
  const out: { digit: number; a: number; b: number; sector: number }[] = [];
  for (const d of ALL_DIGITS)
    for (let u = 0; u < 27; u++) {
      const spots = UNITS[u].filter(i => g.values[i] === 0 && g.cands[i] & candMask(d));
      if (spots.length === 2) out.push({ digit: d, a: spots[0], b: spots[1], sector: u });
    }
  return out;
}

// ---- weak links: full mutual visibility -------------------------------
export const seesCell = (a: number, b: number) =>
  Math.floor(a / 9) === Math.floor(b / 9) || a % 9 === b % 9 ||
  boxOfCell(a) === boxOfCell(b);

export function cellSeesSet(cell: number, set: number[]): boolean {
  return set.every(s => seesCell(cell, s));
}
export function setSeesSet(a: number[], b: number[]): boolean {
  return a.every(x => b.every(y => seesCell(x, y)));
}
