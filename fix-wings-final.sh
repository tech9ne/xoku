#!/usr/bin/env bash
set -e
cd ~/xoku

echo "==> Dump current state of all three wing blocks"
grep -n 'technique: "XY-Wing"\|technique: "W-Wing"\|technique: "XYZ-Wing"' lib/sudoku/techniques.ts

python3 - <<'PY'
P = "lib/sudoku/techniques.ts"
src = open(P).read()

def cut_prop(text, name):
    res, k = [], 0
    marker = name + ":"
    while True:
        p = text.find(marker, k)
        if p == -1:
            res.append(text[k:]); break
        res.append(text[k:p])
        j = p + len(marker)
        depth = 0
        while j < len(text):
            c = text[j]
            if c in "([{": depth += 1
            elif c in ")]}": depth -= 1
            elif c == "," and depth == 0: break
            j += 1
        e = j + 1
        nl = text.find("\n", e)
        if nl != -1 and text[e:nl].strip() == "": e = nl + 1
        k = e
    return "".join(res)

def rework(anchor, new_props):
    """Cut candColors/links/cellGroups in the finder block, insert new after the technique line."""
    global src
    assert src.count(anchor) == 1, f"anchor {anchor[:40]} not unique"
    i = src.index(anchor)
    wend = src.find("export const", i)
    assert wend != -1
    window = src[i:wend]
    for prop in ("candColors", "links", "cellGroups"):
        window = cut_prop(window, prop)
    line_end = window.index("\n") + 1
    window = window[:line_end] + new_props + "\n" + window[line_end:]
    src = src[:i] + window + src[wend:]

# ---- XY-Wing: two branches sharing the pivot's in-cell strong link ----
rework('technique: "XY-Wing", category: "Wing", score: 4.6,', """          candColors: [
            { cell: p, cand: x, color: 1 },
            { cell: p, cand: y, color: 0 },
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
          ],""")

# ---- W-Wing: six circles incl. the strong-link nodes, five links ----
rework('technique: "W-Wing", category: "Wing", score: 5.2,', """          candColors: [
            { cell: A, cand: x, color: 1 },
            { cell: A, cand: y, color: 0 },
            { cell: s1, cand: d, color: 0 },
            { cell: s1, cand: d, color: 1 },
            { cell: B, cand: x, color: 1 },
            { cell: B, cand: y, color: 0 },
          ].filter((c, i, arr) => arr.findIndex(t => t.cell === c.cell && t.cand === c.cand) === i),
          links: [
            { from: { cell: A, cand: y }, to: { cell: A, cand: x }, strong: true },
            { from: { cell: A, cand: x }, to: { cell: s1, cand: d }, strong: false },
            { from: { cell: s1, cand: d }, to: { cell: s2, cand: d }, strong: true },
            { from: { cell: s2, cand: d }, to: { cell: B, cand: x }, strong: false },
            { from: { cell: B, cand: x }, to: { cell: B, cand: y }, strong: true },
          ],""")

# ---- XYZ-Wing: two tints, violet/rose (distinct from ALS blue/green) ----
rework('technique: "XYZ-Wing", category: "Wing", score: 4.8,', """          cellGroups: [
            { cells: [p], color: 3 },
            { cells: [a, b], color: 4 },
          ],""")

open(P, "w").write(src)
print("    wings reworked: XY 2-branch chain, W 6-node chain, XYZ 2 tints")
PY

echo "==> Verify"
grep -n "color: 3 }," lib/sudoku/techniques.ts | head -n 2
grep -c "cell: s1, cand: d" lib/sudoku/techniques.ts

echo "==> GATE"
npx tsc --noEmit && echo "types OK"
