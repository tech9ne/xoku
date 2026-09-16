#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
P = "lib/sudoku/chain-engine.ts"
src = open(P).read()

def swap(old, new, label):
    global src
    n = src.count(old)
    assert n == 1, f"{label}: found {n}x - aborting, paste me the region"
    src = src.replace(old, new)

# 1) helper: digit-aware
swap("""  const onPathNode = (k: number, c: number): boolean =>
      (isSetKey(k) ? t.sets[k - 1000].cells.includes(c) : keyCell(k) === c);""",
"""  const onPathNode = (k: number, c: number, d: number): boolean =>
      (isSetKey(k) ? (t.sets[k - 1000].digit === d && t.sets[k - 1000].cells.includes(c))
                   : (keyCell(k) === c && keyDigit(k) === d));""",
"helper")

# 2) T1 inline block: digit-scoped (victim digit = sd)
swap("""        let onPath = false;
        for (const k of path) {
          if (isSetKey(k)) { if (t.sets[k - 1000].cells.includes(c)) { onPath = true; break; } }
          else if (keyCell(k) === c) { onPath = true; break; }
        }
        if (onPath) continue;""",
"""        let onPath = false;
        for (const k of path) {
          if (isSetKey(k)) { if (t.sets[k - 1000].digit === sd && t.sets[k - 1000].cells.includes(c)) { onPath = true; break; } }
          else if (keyCell(k) === c && keyDigit(k) === sd) { onPath = true; break; }
        }
        if (onPath) continue;""",
"T1 block")

# 3) same-cell T2: per-victim, digit-scoped
swap("""      const elims = candsOf(g.cands[a]).filter(x => x !== sd && x !== ed)
        .map(x => ({ cell: a, cand: x }));
      // same-cell T2: legal only if this cell is not an interior path member
      let interior = false;
      for (let k = 1; k < path.length - 1; k++)
        if (onPathNode(path[k], a)) { interior = true; break; }
      return !interior && elims.length ? elims : null;""",
"""      const elims = candsOf(g.cands[a]).filter(x => x !== sd && x !== ed &&
          !path.some(k => onPathNode(k, a, x)))
        .map(x => ({ cell: a, cand: x }));
      return elims.length ? elims : null;""",
"same-cell T2")

# 4) cross T2: pass the victim's digit
swap("""      if (g.cands[a] & candMask(ed) && !path.some(k => onPathNode(k, a)))
        elims.push({ cell: a, cand: ed });
      if (g.cands[b] & candMask(sd) && !path.some(k => onPathNode(k, b)))
        elims.push({ cell: b, cand: sd });""",
"""      if (g.cands[a] & candMask(ed) && !path.some(k => onPathNode(k, a, ed)))
        elims.push({ cell: a, cand: ed });
      if (g.cands[b] & candMask(sd) && !path.some(k => onPathNode(k, b, sd)))
        elims.push({ cell: b, cand: sd });""",
"cross T2")

open(P, "w").write(src)
print("    guards digit-scoped; engine predicate == audit predicate")
PY

npx tsc --noEmit && echo "types OK"
