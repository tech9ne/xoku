import { Bsec, Bxy, Csec, Rsec } from './cardinals';
import type { CandidateGrid } from './sudoku';

export type MiniSectorTable = Set<number>[][][];

export interface MiniSectors {
  RCBnbp: MiniSectorTable;
  digitCells: number[][];
}

function emptyTable(): MiniSectorTable {
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => new Set<number>())
    )
  );
}

export function buildMiniSectors(cand: CandidateGrid): MiniSectors {
  const RCBnbp = emptyTable();
  const digitCells = Array.from({ length: 9 }, () => [] as number[]);

  for (let cell = 0; cell < 81; cell++) {
    const row = Math.floor(cell / 9);
    const col = cell % 9;
    const box = Bxy[cell];
    for (const digit of cand[cell] ?? []) {
      if (digit < 1 || digit > 9) continue;
      const d = digit - 1;
      digitCells[d].push(cell);
      RCBnbp[0][row][d].add(Bsec[box]);
      RCBnbp[1][col][d].add(Bsec[box]);
      RCBnbp[2][box][d].add(Rsec[row]);
      RCBnbp[3][box][d].add(Csec[col]);
    }
  }

  return { RCBnbp, digitCells };
}
