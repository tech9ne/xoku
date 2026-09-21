// H36a: ERI detector - behavior parity with StormDoku strong-link.ts
// Ported logic: eriGeometries (lines 270-330)
import { Game, PEERS, candMask, candsOf } from "./core";

export interface ERIGeometry {
  box: number;
  intersectionCell: number;
  activeCells: number[];  // mini-row within box
  linkedCells: number[];  // mini-col within box
  emptyCells: number[];   // the 4 "empty rectangle" cells
}

export function detectERI(g: Game, digit: number): ERIGeometry[] {
  const results: ERIGeometry[] = [];
  for (let box = 0; box < 9; box++) {
    const boxRow = Math.floor(box / 3) * 3;
    const boxCol = (box % 3) * 3;
    const boxCells: number[] = [];
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        const cell = r * 9 + c;
        if (g.values[cell] === 0 && g.cands[cell] & candMask(digit)) {
          boxCells.push(cell);
        }
      }
    }
    if (boxCells.length < 4 || boxCells.length > 5) continue;
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        const intersectionCell = r * 9 + c;
        const emptyCells = boxCells.filter(cell =>
          Math.floor(cell / 9) !== r && cell % 9 !== c
        );
        const hasDigitInEmpty = emptyCells.some(cell =>
          g.cands[cell] & candMask(digit)
        );
        if (hasDigitInEmpty) continue;
        const activeCells = boxCells.filter(cell =>
          Math.floor(cell / 9) === r
        );
        const linkedCells = boxCells.filter(cell =>
          cell % 9 === c
        );
        if (activeCells.length === 0 || linkedCells.length === 0) continue;
        results.push({ box, intersectionCell, activeCells, linkedCells, emptyCells });
      }
    }
  }
  return results;
}
