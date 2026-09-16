#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
P = "lib/sudoku/chain-engine.ts"
src = open(P).read()

def swap(old, new, label):
    global src
    n = src.count(old)
    assert n == 1, f"{label}: found {n}x - aborting"
    src = src.replace(old, new)

swap("  const tryEnding = (start: number, end: number): { cell: number; cand: number }[] | null => {",
     "  const tryEnding = (start: number, end: number, path: number[]): { cell: number; cand: number }[] | null => {",
     "B-sig")

swap("        if (sc.includes(c) || ec.includes(c)) continue;",
     """        if (sc.includes(c) || ec.includes(c)) continue;
        let onPath = false;
        for (const k of path) {
          if (isSetKey(k)) { if (t.sets[k - 1000].cells.includes(c)) { onPath = true; break; } }
          else if (keyCell(k) === c) { onPath = true; break; }
        }
        if (onPath) continue;""",
     "B-victims")

swap("          const elims = tryEnding(start, cur);",
     "          const elims = tryEnding(start, cur, path);",
     "B-call")

open(P, "w").write(src)
print("    Bug B applied")
PY

echo "==> Verify: signature carries path, victims block present, call passes it"
grep -n "tryEnding = (start: number, end: number, path" lib/sudoku/chain-engine.ts
grep -n "let onPath" lib/sudoku/chain-engine.ts
grep -n "tryEnding(start, cur, path)" lib/sudoku/chain-engine.ts

npx tsc --noEmit && echo "types OK"
