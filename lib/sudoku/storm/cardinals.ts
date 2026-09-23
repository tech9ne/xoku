/**
 * Cardinal lookup tables: cell <-> house/position conversions.
 * Verbatim TypeScript transliteration of the tables from strmckr's
 * StormDoku core ("cardinals for Int {cell}"), shared 2025-09-09 in
 * review, used with permission and attribution.
 * Conventions: houses map rows 0-8, cols 9-17, boxes 18-26; digits 0-indexed.
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * This file is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 */
export const Rx: number[] = [
  0,0,0,0,0,0,0,0,0, 1,1,1,1,1,1,1,1,1, 2,2,2,2,2,2,2,2,2,
  3,3,3,3,3,3,3,3,3, 4,4,4,4,4,4,4,4,4, 5,5,5,5,5,5,5,5,5,
  6,6,6,6,6,6,6,6,6, 7,7,7,7,7,7,7,7,7, 8,8,8,8,8,8,8,8,8
];
export const Cy: number[] = [
  0,1,2,3,4,5,6,7,8, 0,1,2,3,4,5,6,7,8, 0,1,2,3,4,5,6,7,8,
  0,1,2,3,4,5,6,7,8, 0,1,2,3,4,5,6,7,8, 0,1,2,3,4,5,6,7,8,
  0,1,2,3,4,5,6,7,8, 0,1,2,3,4,5,6,7,8, 0,1,2,3,4,5,6,7,8
];
export const Bxy: number[] = [
  0,0,0,1,1,1,2,2,2, 0,0,0,1,1,1,2,2,2, 0,0,0,1,1,1,2,2,2,
  3,3,3,4,4,4,5,5,5, 3,3,3,4,4,4,5,5,5, 3,3,3,4,4,4,5,5,5,
  6,6,6,7,7,7,8,8,8, 6,6,6,7,7,7,8,8,8, 6,6,6,7,7,7,8,8,8
];
export const BxyN: number[] = [
  0,1,2,0,1,2,0,1,2, 3,4,5,3,4,5,3,4,5, 6,7,8,6,7,8,6,7,8,
  0,1,2,0,1,2,0,1,2, 3,4,5,3,4,5,3,4,5, 6,7,8,6,7,8,6,7,8,
  0,1,2,0,1,2,0,1,2, 3,4,5,3,4,5,3,4,5, 6,7,8,6,7,8,6,7,8
];
export const Rset: number[][] = [
  [0,1,2,3,4,5,6,7,8],[9,10,11,12,13,14,15,16,17],[18,19,20,21,22,23,24,25,26],
  [27,28,29,30,31,32,33,34,35],[36,37,38,39,40,41,42,43,44],[45,46,47,48,49,50,51,52,53],
  [54,55,56,57,58,59,60,61,62],[63,64,65,66,67,68,69,70,71],[72,73,74,75,76,77,78,79,80]
];
export const Cset: number[][] = [
  [0,9,18,27,36,45,54,63,72],[1,10,19,28,37,46,55,64,73],[2,11,20,29,38,47,56,65,74],
  [3,12,21,30,39,48,57,66,75],[4,13,22,31,40,49,58,67,76],[5,14,23,32,41,50,59,68,77],
  [6,15,24,33,42,51,60,69,78],[7,16,25,34,43,52,61,70,79],[8,17,26,35,44,53,62,71,80]
];
export const Bset: number[][] = [
  [0,1,2,9,10,11,18,19,20],[3,4,5,12,13,14,21,22,23],[6,7,8,15,16,17,24,25,26],
  [27,28,29,36,37,38,45,46,47],[30,31,32,39,40,41,48,49,50],[33,34,35,42,43,44,51,52,53],
  [54,55,56,63,64,65,72,73,74],[57,58,59,66,67,68,75,76,77],[60,61,62,69,70,71,78,79,80]
];

// Global sector ids used by the original mini-sector tables:
// rows 0..8, columns 9..17, boxes 18..26.
export const Rsec: number[] = Array.from({ length: 9 }, (_, row) => row);
export const Csec: number[] = Array.from({ length: 9 }, (_, col) => col + 9);
export const Bsec: number[] = Array.from({ length: 9 }, (_, box) => box + 18);

export const UNITS: number[][] = [...Rset, ...Cset, ...Bset];

export const PEERS: number[][] = Array.from({ length: 81 }, (_, cell) => {
  const peers = new Set<number>();
  for (const unit of UNITS) {
    if (!unit.includes(cell)) continue;
    for (const other of unit) if (other !== cell) peers.add(other);
  }
  return [...peers];
});

for (let i = 0; i < 81; i++) {
  const r = (i / 9) | 0, c = i % 9, b = ((r / 3) | 0) * 3 + ((c / 3) | 0), p = (r % 3) * 3 + (c % 3);
  if (Rx[i] !== r || Cy[i] !== c || Bxy[i] !== b || BxyN[i] !== p) throw new Error(`cardinals mismatch at cell ${i}`);
  if (Rset[r][c] !== i || Cset[c][r] !== i || Bset[b][p] !== i) throw new Error(`cardinals set mismatch at cell ${i}`);
}
