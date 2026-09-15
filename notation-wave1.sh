#!/usr/bin/env bash
set -e
cd ~/xoku

echo "==> 1) The shared notation module"
cat > lib/sudoku/notation.ts <<'EOF'
// Chain notation - the single grammar for all link-based techniques.
//   single node:  digit + cell        "7r7c4"
//   set node:     digit + (cells)      "4(r7c456, r8c5, r9c5)"
//   strong link:  " = "    weak link:  " - "
//   ALS internal: "x=y(cells)"         "7=4(r7c456, r8c5, r9c5)"
// Compression: 3+ cells in a row fuse (r7c456), 3+ in a column fuse
// (r1678c1); smaller groups list individually.
import { cellName } from "./core";

export function nodeStr(digit: number, cell: number): string {
  return `${digit}${cellName(cell)}`;
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
EOF
wc -l lib/sudoku/notation.ts   # expect ~55

echo "==> 2) Point the two local renderers at the module (digit-first)"
python3 - <<'PY'
P = "lib/sudoku/techniques.ts"
src = open(P).read()

# module import - names chosen to dodge the local chainStr collision
OLD_IMP = "import {\n  ALL_DIGITS, Elimination, Game, PEERS, Step, UNITS, UNITS_OF,"
n = src.count(OLD_IMP)
assert n == 1, f"core import anchor found {n}x"
src = src.replace(OLD_IMP,
  'import { nodeStr, setNodeStr } from "./notation";\n' + OLD_IMP)

# findAic renderer: r4c8:1 -> 1r4c8
OLD1 = "  const nodeName = (n: number) => `${cellName(nodeCell(n))}:${nodeDigit(n)}`;"
NEW1 = "  const nodeName = (n: number) => nodeStr(nodeDigit(n), nodeCell(n));"
n = src.count(OLD1)
assert n == 1, f"findAic nodeName found {n}x"
src = src.replace(OLD1, NEW1)

# aicAls renderer: [r6c4+r6c7]:7 -> 7(r6c4, r6c7, ...) with compression
OLD2 = """  const nameOf = (n: number) => isAls(n)
    ? `[${alsSet(n).cells.map(cellName).join("+")}]:${n % 10}`
    : `${cellName(nodeCell(n))}:${nodeDigit(n)}`;"""
NEW2 = """  const nameOf = (n: number) => isAls(n)
    ? setNodeStr(n % 10, alsSet(n).cells)
    : nodeStr(nodeDigit(n), nodeCell(n));"""
n = src.count(OLD2)
assert n == 1, f"aicAls nameOf found {n}x - paste me: grep -n 'nameOf' lib/sudoku/techniques.ts"
src = src.replace(OLD2, NEW2)

open(P, "w").write(src)
print("    renderers converted: digit-first, sets compressed")
PY

echo "==> 3) The five reason lines that just changed dialect"
grep -n 'reason: `X-Chain\|reason: `AIC' lib/sudoku/techniques.ts

echo "==> GATE"
npx tsc --noEmit && echo "types OK"
