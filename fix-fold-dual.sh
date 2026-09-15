#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
import re
P = "lib/sudoku/techniques.ts"
src = open(P).read()

if "serves as the weak passage" in src:
    raise SystemExit("already patched - nothing to do")

NEW = """    while (k < path.length) {
      if (k + 1 < path.length && nodeCell(path[k + 1]) === nodeCell(path[k])) {
        // A bivalue pair is dual-natured: "at least one true" (strong) AND
        // "not both true" (weak) hold at once. The connector mirrors the
        // role THIS chain gives the pair - its position parity:
        //   even k: the pair carries the strong link   "(4 = 5)r3c5"
        //   odd  k: the cell serves as the weak passage "(4 - 5)r3c5"
        //           (enters strong, crosses weak, exits strong)
        const c = nodeCell(path[k]);
        const d1 = nodeDigit(path[k]), d2 = nodeDigit(path[k + 1]);
        tokens.push({ text: `(${d1} ${k % 2 === 0 ? "=" : "-"} ${d2})${cellName(c)}`, endIdx: k + 1 });
        k += 2;
      } else {
        tokens.push({ text: nodeName(path[k]), endIdx: k });
        k += 1;
      }
    }"""

# matches both prior variants (plain bivStr fold AND the truth-check fold):
# they share the same if-condition and block structure
pat = re.compile(
    r'    while \(k < path\.length\) \{\n'
    r'      if \(k % 2 === 0 && k \+ 1 < path\.length && nodeCell\(path\[k \+ 1\]\) === nodeCell\(path\[k\]\)\) \{.*?\n'
    r'      \}\n    \}',
    re.S)
hits = pat.findall(src)
if len(hits) == 1:
    src = pat.sub(NEW.replace("\\", "\\\\"), src, count=1)
    print("    fold rewritten: dual-natured, connector by chain role (parity)")
elif "folded: same-cell" in src:
    raise SystemExit("fold block in unexpected shape - paste me: grep -n 'while (k < path.length)' -A 16 lib/sudoku/techniques.ts")
else:
    raise SystemExit("notation-complete.sh has not been applied - run it first, then this script")

open(P, "w").write(src)
PY

echo "==> GATE"
npx tsc --noEmit && echo "types OK"
