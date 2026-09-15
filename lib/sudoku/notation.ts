// Chain notation - the single grammar for all link-based techniques.
//   candidate node:  (4)r5c2            digit in parens, then cell
//   bivalue cell:    (4 = 5)r3c5        internal strong link, folded
//   ALS set node:    7=4(r7c456, ...)   in=out(cells)      [ALS chains]
//   strong link " = "   weak link " - "
//   conclusion:      " => r5c8 <> 4"     comma-separated for multiples
// Compression: 3+ cells in a row fuse (r7c456), 3+ in a column fuse
// (r1678c1); smaller groups list individually.
import { cellName } from "./core";

export function nodeStr(digit: number, cell: number): string {
  return `(${digit})${cellName(cell)}`;
}

export function bivStr(d1: number, d2: number, cell: number): string {
  return `(${d1} = ${d2})${cellName(cell)}`;
}

export function conclusionStr(elims: { cell: number; cand: number }[]): string {
  return elims.map(e => `${cellName(e.cell)} <> ${e.cand}`).join(", ");
}

export function compressCells(cells: number[]): string {
  const rows = new Map<number, Set<number>>();
  const cols = new Map<number, Set<number>>();
  for (const c of cells) {
    const r = Math.floor(c / 9), k = c % 9;
    if (!rows.has(r)) rows.set(r, new Set());
    rows.get(r)!.add(k);
    if (!cols.has(k)) cols.set(k, new Set());
    cols.get(k)!.add(r);
  }
  const used = new Set<number>();
  const parts: string[] = [];
  for (const [r, ks] of rows)
    if (ks.size >= 3) {
      parts.push(`r${r + 1}c${[...ks].sort((a, b) => a - b).map(k => k + 1).join("")}`);
      for (const k of ks) used.add(r * 9 + k);
    }
  for (const [k, rs] of cols) {
    const rest = [...rs].filter(r => !used.has(r * 9 + k)).sort((a, b) => a - b);
    if (rest.length >= 3) {
      parts.push(`r${rest.map(r => r + 1).join("")}c${k + 1}`);
      for (const r of rest) used.add(r * 9 + k);
    }
  }
  for (const c of cells) if (!used.has(c)) parts.push(cellName(c));
  return parts.join(", ");
}

export function setNodeStr(digit: number, cells: number[]): string {
  return `${digit}(${compressCells(cells)})`;
}

// ALS internal strong link: if x is false throughout the set, the set
// locks and places y.
export function alsStrong(x: number, y: number, cells: number[]): string {
  return `${x}=${y}(${compressCells(cells)})`;
}

// ALS-chain rendering with the continuity rule enforced: the digit
// exiting node k-1 must equal the digit entering node k (weak links
// join the same digit). A violation throws - a finder bug becomes a
// loud error instead of a silently wrong hint.
export function alsChainStr(
  nodes: { in: number; out: number; cells: number[] }[]
): string {
  for (let k = 1; k < nodes.length; k++)
    if (nodes[k].in !== nodes[k - 1].out)
      throw new Error(
        `chain continuity broken at node ${k}: exits ${nodes[k - 1].out}, enters ${nodes[k].in}`
      );
  return nodes.map(n => alsStrong(n.in, n.out, n.cells)).join(" - ");
}
