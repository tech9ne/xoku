#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
P = "lib/sudoku/techniques.ts"
src = open(P).read()

# XY-Wing: currently (from last round) AIC-style ONE branch (a only).
# Final form: BOTH pincer branches, alternating colors — the two-OR proof.
OLD = """candColors: [
  { cell: p, cand: y, color: 0 },
  { cell: p, cand: x, color: 1 },
  { cell: a, cand: x, color: 0 },
  { cell: a, cand: z, color: 1 },
],
links: [
  { from: { cell: p, cand: y }, to: { cell: p, cand: x }, strong: true },
  { from: { cell: p, cand: x }, to: { cell: a, cand: x }, strong: false },
  { from: { cell: a, cand: x }, to: { cell: a, cand: z }, strong: true },
],"""
NEW = """candColors: [
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
if n == 1:
    src = src.replace(OLD, NEW)
    print("    XY-Wing: both branches (was one-branch)")
else:
    # maybe already has both branches from the corrected block
    assert src.count(NEW) == 1, f"XY-Wing block not found in either shape ({n}x one-branch) - paste me grep -n 'XY-Wing' -A 20"
    print("    XY-Wing: already two-branch, nothing to do")

# XYZ-Wing: back to ALS tints (strip the AIC block, restore cellGroups)
OLD_XYZ = """candColors: [
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
# careful: identical shape to XY-Wing's NEW block. Disambiguate by technique anchor.
anchor_xyz = 'technique: "XYZ-Wing", category: "Wing", score: 4.8,'
assert src.count(anchor_xyz) == 1, "XYZ anchor missing"
i = src.index(anchor_xyz)
after = src[i:i + 4000]
if OLD_XYZ in after:
    after2 = after.replace(OLD_XYZ, "cellGroups: [{ cells: [p], color: 0 }, { cells: [a], color: 1 }, { cells: [b], color: 2 }],")
    src = src[:i] + after2 + src[i + 4000:]
    print("    XYZ-Wing: ALS tints restored")
else:
    print("    XYZ-Wing: no AIC block found near anchor - check state")

open(P, "w").write(src)
PY

echo "==> Sanity"
grep -n "cellGroups: \[{ cells: \[p\]" lib/sudoku/techniques.ts
grep -c "from: { cell: p, cand: y }, to: { cell: b, cand: y }" lib/sudoku/techniques.ts

echo "==> GATE"
npx tsc --noEmit && echo "types OK"
