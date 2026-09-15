#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
import re
P = "lib/sudoku/techniques.ts"
src = open(P).read()

# ensure the notation import carries everything
m = re.search(r'import \{([^}]+)\} from "\./notation";', src)
assert m, "notation import missing - paste grep -n notation lib/sudoku/techniques.ts"
names = [n.strip() for n in m.group(1).split(",")]
for need in ("nodeStr", "bivStr", "conclusionStr"):
    if need not in names: names.append(need)
src = src[:m.start()] + "import { " + ", ".join(names) + ' } from "./notation";' + src[m.end():]

def swap(old, new, label):
    global src
    n = src.count(old)
    assert n == 1, f"{label}: found {n}x - aborting"
    src = src.replace(old, new)

# XY-Wing: (z = x)a - (x = y)p - (y = z)b => elims   [S-W-S-W-S, endpoints a:z/b:z]
swap('reason: `XY-Wing: pivot ${cellName(p)} (${x}/${y}), pincers ${cellName(a)} (${x}/${z}) and ${cellName(b)} (${y}/${z}) — one pincer must be ${z}.`,',
     'reason: `XY-Wing: ${bivStr(z, x, a)} - ${bivStr(x, y, p)} - ${bivStr(y, z, b)} => ${conclusionStr(elims)}.`,',
     "XY-Wing")

# W-Wing: (o = d)A - (d)t1 = (d)t2 - (d = o)B => elims  [t1 sees A, t2 sees B]
swap('reason: `W-Wing: ${cellName(A)} and ${cellName(B)} both hold ${x}/${y}; the strong link ${d} (${cellName(s1)}–${cellName(s2)}) forces one of them to be ${o}.`,',
     'reason: `W-Wing: ${bivStr(o, d, A)} - ${nodeStr(d, arePeers(s1, A) && arePeers(s2, B) ? s1 : s2)} = ${nodeStr(d, arePeers(s1, A) && arePeers(s2, B) ? s2 : s1)} - ${bivStr(d, o, B)} => ${conclusionStr(elims)}.`,',
     "W-Wing")

open(P, "w").write(src)
print("    wings converted")
PY

npx tsc --noEmit && echo "types OK"
