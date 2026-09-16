#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
P = "lib/sudoku/chain-engine.ts"
src = open(P).read()

def swap(old, new, label):
    global src
    n = src.count(old)
    assert n == 1, f"{label}: found {n}x - aborting, paste me the grep"
    src = src.replace(old, new)

# Guard 2 (retry - last sed never landed): set->cand weak hop excludes membership
swap("if (g.values[c] === 0 && g.cands[c] & candMask(d) && cellSeesSet(c, set.cells))",
     "if (g.values[c] === 0 && g.cands[c] & candMask(d) && !set.cells.includes(c) && cellSeesSet(c, set.cells))",
     "Guard 2")

# Bug A (the doc's doubly-coloured cell rule): set->set weak hops must be disjoint
swap("if (o.digit === d && s !== k - 1000 && setSeesSet(set.cells, o.cells)) out.push(1000 + s);",
     "if (o.digit === d && s !== k - 1000 && setSeesSet(set.cells, o.cells) && !set.cells.some(x => o.cells.includes(x))) out.push(1000 + s);",
     "Bug A")

# Bug B: T1 victims exclude members of ANY path node (chain participants are consumed)
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
print("    Guard 2 + Bug A + Bug B applied")
PY

echo "==> Verify (expect 3 guard lines)"
grep -n '!set.cells.includes(c)' lib/sudoku/chain-engine.ts
grep -n 'o.cells.includes(x)' lib/sudoku/chain-engine.ts

echo "==> Audit v5: overlap + self-kill checks"
python3 - <<'PY'
P = "scripts/chain-audit.js"
src = open(P).read()
anchor = "    // NAND audit: no weak link may join a candidate to a set containing it"
assert src.count(anchor) == 1, "v3 anchor missing"
NEW = """    // v5 (doc-validated): NAND-joined edges must be disjoint; victims never
    // on the path. These encode the doubly-coloured-cell rule from AIC 101.
    for (let k = 0; k + 1 < f.path.length; k++) {
      const a = f.path[k], b = f.path[k + 1];
      if (k % 2 === 1 && T.isSetKey(a) && T.isSetKey(b)) {
        const sa = t.sets[a - 1000].cells, sb = t.sets[b - 1000].cells;
        if (sa.some(x => sb.includes(x))) {
          bad++;
          console.log("OVERLAP:", JSON.stringify({ at: k }));
        }
      }
    }
    for (const e of f.elims)
      for (const k of f.path) {
        const member = T.isSetKey(k)
          ? t.sets[k - 1000].cells.includes(e.cell)
          : Math.floor(k / 10) === e.cell;
        if (member) {
          bad++;
          console.log("SELF-KILL:", JSON.stringify({ cell: e.cell, cand: e.cand }));
          break;
        }
      }
    // NAND audit: no weak link may join a candidate to a set containing it"""
src = src.replace(anchor, NEW)
open(P, "w").write(src)
print("    audit v5 installed")
PY

echo "==> GATE 1: types"
npx tsc --noEmit && echo "types OK"

echo "==> GATE 2: audit v5"
node scripts/chain-audit.js
