#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
P = "lib/sudoku/techniques.ts"
src = open(P).read()

# findAic's folded renderer: the connector inside a same-cell pair is
# STRONG only when those two digits are the cell's full candidate set.
OLD = """    while (k < path.length) {
      if (k % 2 === 0 && k + 1 < path.length && nodeCell(path[k + 1]) === nodeCell(path[k])) {
        tokens.push({ text: bivStr(nodeDigit(path[k]), nodeDigit(path[k + 1]), nodeCell(path[k])), endIdx: k + 1 });
        k += 2;
      } else {
        tokens.push({ text: nodeName(path[k]), endIdx: k });
        k += 1;
      }
    }"""
NEW = """    while (k < path.length) {
      if (k % 2 === 0 && k + 1 < path.length && nodeCell(path[k + 1]) === nodeCell(path[k])) {
        // connector truth: '=' only when the pair IS the cell's bivalue
        // strong link; '-' when the cell merely serves as the passage
        // (trivalue+ cell, or a non-strong same-cell restriction)
        const c = nodeCell(path[k]);
        const d1 = nodeDigit(path[k]), d2 = nodeDigit(path[k + 1]);
        const isStrong = countCands(g.cands[c]) === 2 &&
          g.cands[c] === (candMask(d1) | candMask(d2));
        tokens.push({ text: `(${d1} ${isStrong ? "=" : "-"} ${d2})${cellName(c)}`, endIdx: k + 1 });
        k += 2;
      } else {
        tokens.push({ text: nodeName(path[k]), endIdx: k });
        k += 1;
      }
    }"""
n = src.count(OLD)
assert n == 1, f"fold block found {n}x - paste me grep -n 'while (k < path.length)' -A 12"
src = src.replace(OLD, NEW)
open(P, "w").write(src)
print("    fold connector now reflects actual strong/weak truth")
PY

echo "==> GATE"
npx tsc --noEmit && echo "types OK"
