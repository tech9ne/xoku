#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
import re
P = "lib/sudoku/techniques.ts"
src = open(P).read()

if "pair-truth test" in src:
    raise SystemExit("already patched")

NEW = """    while (k < path.length) {
      if (k + 1 < path.length && nodeCell(path[k + 1]) === nodeCell(path[k])) {
        // Pair-truth test (the hierarchy):
        //   trivalue+ cell: every internal pair is WEAK-only (a pair can
        //     never guarantee "at least one true")
        //   bivalue cell: the pair is DUAL-NATURED - strong ("at least one
        //     true") and weak ("not both true") - and the chain's parity
        //     decides which face it serves in THIS chain
        // Connector = parity role if the pair can bear it, else weak.
        const c = nodeCell(path[k]);
        const d1 = nodeDigit(path[k]), d2 = nodeDigit(path[k + 1]);
        const pairIsBivalue = countCands(g.cands[c]) === 2 &&
          g.cands[c] === (candMask(d1) | candMask(d2));
        const connector = k % 2 === 0 && pairIsBivalue ? "=" : "-";
        if (k % 2 === 0 && !pairIsBivalue)
          throw new Error(`strong-position fold on non-bivalue pair at ${cellName(c)} - invalid chain`);
        tokens.push({ text: `(${d1} ${connector} ${d2})${cellName(c)}`, endIdx: k + 1 });
        k += 2;
      } else {
        tokens.push({ text: nodeName(path[k]), endIdx: k });
        k += 1;
      }
    }"""

pat = re.compile(
    r'    while \(k < path\.length\) \{\n'
    r'      if \(k \+ 1 < path\.length && nodeCell\(path\[k \+ 1\]\) === nodeCell\(path\[k\]\)\) \{.*?\n'
    r'      \}\n    \}',
    re.S)
hits = pat.findall(src)
assert len(hits) == 1, f"fold block found {len(hits)}x - paste me: grep -n 'while (k < path.length)' -A 16 lib/sudoku/techniques.ts"
src = pat.sub(NEW.replace("\\", "\\\\"), src, count=1)
open(P, "w").write(src)
print("    fold: pair-truth test + parity role; strong folds restricted to bivalue")
PY

echo "==> GATE"
npx tsc --noEmit && echo "types OK"
