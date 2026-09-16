#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
P = "lib/sudoku/techniques.ts"
src = open(P).read()

if "chainLens," in src:
    raise SystemExit("already registered")

# import (value import; chain-engine's back-import is type-only, no cycle)
anchor = '"./notation";'
n = src.count(anchor)
assert n == 1, f"notation import anchor found {n}x"
i = src.index(anchor) + len(anchor)
src = src[:i] + '\nimport { chainLens } from "./chain-engine";' + src[i:]

# register LAST: pure addition, old finders keep priority
anchor = "  aicAls,                  // XR 7.6  AICs with ALS nodes"
n = src.count(anchor)
assert n == 1, f"aicAls registry anchor found {n}x - paste me grep -n 'aicAls,' lib/sudoku/techniques.ts"
i = src.index(anchor) + len(anchor)
src = src[:i] + "\n  chainLens,               // Stage 1a: master chain engine (runs last)" + src[i:]

# names list
import re
m = re.search(r"export const TECHNIQUE_NAMES = \[(.*?)\];", src, re.S)
assert m, "TECHNIQUE_NAMES block not found"
src = src[:m.start(1) + len(m.group(1))] + '\n  "Chain Lens (grouped chains, AIC)",' + src[m.start(1) + len(m.group(1)):]

open(P, "w").write(src)
print("    chainLens registered (last position)")
PY

echo "==> GATE 1: types"
npx tsc --noEmit && echo "types OK"

echo "==> GATE 2: census parity on the Diabolical (must be unchanged)"
node scripts/census.js "..1..25...........59..4..6.9.7.6...1.428....6......94..6.....75...1......2...5.9." | tail -n 4

echo "==> GATE 3: new power - wiki L(1) puzzle (grouped links, old engine blind)"
node scripts/census.js "000382000030000080708000523340096050900050006000103000020608095006000400503070061" | tail -n 8
