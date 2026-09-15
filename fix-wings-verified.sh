#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
P = "lib/sudoku/techniques.ts"
src = open(P).read()

# ---- XY-Wing: verified current state = old tint line under its technique line ----
OLD = """          technique: "XY-Wing", category: "Wing", score: 4.6,
          cellGroups: [{ cells: [p], color: 0 }, { cells: [a], color: 1 }, { cells: [b], color: 2 }],"""
NEW = """          technique: "XY-Wing", category: "Wing", score: 4.6,
          candColors: [
            { cell: p, cand: y, color: 0 },
            { cell: p, cand: x, color: 1 },
            { cell: a, cand: x, color: 0 },
            { cell: a, cand: z, color: 1 },
            { cell: b, cand: y, color: 0 },
            { cell: b, cand: z, color: 1 },
          ],
          links: [
            { from: { cell: p, cand: y }, to: { cell: p, cand: x }, strong: true },
            { from: { cell: p, cand: x }, to: { cell: a, cand: x }, strong: false },
            { from: { cell: a, cand: x }, to: { cell: a, cand: z }, strong: true },
            { from: { cell: p, cand: y }, to: { cell: b, cand: y }, strong: false },
            { from: { cell: b, cand: y }, to: { cell: b, cand: z }, strong: true },
          ],"""
n = src.count(OLD)
assert n == 1, f"XY-Wing tint line found {n}x - paste me the grep dump again"
src = src.replace(OLD, NEW)
print("    XY-Wing -> chain dress (both branches)")

# ---- XYZ-Wing: ensure tint line exists (idempotent) ----
anchor = 'technique: "XYZ-Wing", category: "Wing", score: 4.8,'
assert src.count(anchor) == 1, "XYZ anchor missing"
i = src.index(anchor)
line_end = src.index("\n", i) + 1
if src[line_end:line_end + 200].lstrip().startswith("cellGroups:"):
    print("    XYZ-Wing -> tints already present")
else:
    src = src[:line_end] + "          cellGroups: [{ cells: [p], color: 0 }, { cells: [a], color: 1 }, { cells: [b], color: 2 }],\n" + src[line_end:]
    print("    XYZ-Wing -> tints inserted")

open(P, "w").write(src)
PY

echo "==> Verify"
grep -n 'cand: y, color: 0 },$' lib/sudoku/techniques.ts | head -n 3
grep -n "XYZ-Wing" lib/sudoku/techniques.ts | head -n 3

echo "==> GATE"
npx tsc --noEmit && echo "types OK"
