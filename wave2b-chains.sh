#!/usr/bin/env bash
set -e
cd ~/xoku

echo "==> Anchors (note the real prefixes)"
grep -n 'chain ${chain.map\|reason: `${technique}' lib/sudoku/techniques.ts

python3 - <<'PY'
P = "lib/sudoku/techniques.ts"
src = open(P).read()

def swap(old, new, label):
    global src
    n = src.count(old)
    assert n == 1, f"{label}: found {n}x - aborting, paste me the dump above"
    src = src.replace(old, new)

# Remote Pair: alternating folds, both digits in the conclusion
swap('reason: `${p}/${q} chain ${chain.map(cellName).join("–")}: the ends hold opposite values, so cells seeing both ends lose ${p} and ${q}.`,',
     'reason: `Remote Pair: ${chain.map((c, k) => bivStr(k % 2 === 0 ? p : q, k % 2 === 0 ? q : p, c)).join(" - ")} => ${conclusionStr(elims)}.`,',
     "Remote Pair")

# Skyscraper / 2-String Kite / Turbot Fish: (d)fx = (d)x - (d)y = (d)fy => elims
swap('reason: `${technique} on ${d}: strong links ${cellName(a1)}–${cellName(a2)} (${unitName(ua)}) and ${cellName(b1)}–${cellName(b2)} (${unitName(ub)}) are joined by weak link ${cellName(x)}–${cellName(y)}; one of ${cellName(fx)}/${cellName(fy)} must be ${d}, so ${d} can be removed from cells seeing both.`,',
     'reason: `${technique}: ${nodeStr(d, fx)} = ${nodeStr(d, x)} - ${nodeStr(d, y)} = ${nodeStr(d, fy)} => ${conclusionStr(elims)}.`,',
     "Turbot family")

open(P, "w").write(src)
print("    remote pair + single-digit chains converted")
PY

npx tsc --noEmit && echo "types OK"
