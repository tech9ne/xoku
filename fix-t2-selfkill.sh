#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
P = "lib/sudoku/chain-engine.ts"
src = open(P).read()

def swap(old, new, label):
    global src
    n = src.count(old)
    assert n == 1, f"{label}: found {n}x - aborting, paste me sed -n '62,85p' output"
    src = src.replace(old, new)

# extract onPath test as a helper string both branches can use
ONPATH = """const onPathNode = (k: number, c: number): boolean =>
      (isSetKey(k) ? t.sets[k - 1000].cells.includes(c) : keyCell(k) === c);"""

# same-cell T2: a === b - the victim cell IS an endpoint; ban if it's any path member
# (endpoint cells are trivially path nodes, so same-cell T2 is only legal when the
# endpoint cells are NOT interior participants - guard against interior membership)
swap("""    if (a === b) {
      const elims = candsOf(g.cands[a]).filter(x => x !== sd && x !== ed)
        .map(x => ({ cell: a, cand: x }));
      return elims.length ? elims : null;
    }""",
f"""    if (a === b) {{
      const elims = candsOf(g.cands[a]).filter(x => x !== sd && x !== ed)
        .map(x => ({{ cell: a, cand: x }}));
      // same-cell T2: legal only if this cell is not an interior path member
      let interior = false;
      for (let k = 1; k < path.length - 1; k++)
        if (onPathNode(path[k], a)) {{ interior = true; break; }}
      return !interior && elims.length ? elims : null;
    }}""",
"same-cell T2")

# cross T2: peers a,b - each victim must not be a path member
swap("""    if (seesCell(a, b)) {
      const elims: { cell: number; cand: number }[] = [];
      if (g.cands[a] & candMask(ed)) elims.push({ cell: a, cand: ed });
      if (g.cands[b] & candMask(sd)) elims.push({ cell: b, cand: sd });
      return elims.length ? elims : null;
    }""",
f"""    if (seesCell(a, b)) {{
      const elims: {{ cell: number; cand: number }}[] = [];
      if (g.cands[a] & candMask(ed) && !path.some(k => onPathNode(k, a)))
        elims.push({{ cell: a, cand: ed }});
      if (g.cands[b] & candMask(sd) && !path.some(k => onPathNode(k, b)))
        elims.push({{ cell: b, cand: sd }});
      return elims.length ? elims : null;
    }}""",
"cross T2")

# define the helper once, before tryEnding
swap("  const tryEnding = (start: number, end: number, path: number[]): { cell: number; cand: number }[] | null => {",
     f"""  {ONPATH}
  const tryEnding = (start: number, end: number, path: number[]): {{ cell: number; cand: number }}[] | null => {{""",
     "helper insert")

open(P, "w").write(src)
print("    T2 branches guarded against self-kill")
PY

echo "==> Verify"
grep -n "onPathNode" lib/sudoku/chain-engine.ts | head -n 6
grep -c "interior" lib/sudoku/chain-engine.ts

npx tsc --noEmit && echo "types OK"
