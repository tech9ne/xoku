#!/usr/bin/env bash
set -e
cd ~/xoku

echo "==> Removing ALL chainLinks blocks and re-inserting at the true xyChain anchor"
python3 - <<'PY'
import re
P = "lib/sudoku/techniques.ts"
src = open(P).read()

# strip every previously inserted chainLinks block (from the marker to the closing brace line)
src = re.sub(r"\n\s*const chainLinks: \{ from: \{ cell: number; cand: number \}; to: \{ cell: number; cand: number \}; strong: boolean \}\[\] = \[\];.*?\n\s*chainLinks\.push\(\{ from: \{ cell: chain\[chain\.length - 1\], cand: prev \}, to: \{ cell: chain\[chain\.length - 1\], cand: z \}, strong: true \}\);", "", src, flags=re.S)

# also strip any orphan 'links: chainLinks,' and its candColors companion inserted after xyChain's mk
src = src.replace("\n            candColors: chain.flatMap((c2, k) => candsOf(g.cands[c2]).map(x => ({ cell: c2, cand: x, color: k % 2 }))),\n            links: chainLinks,", "")

# the true xyChain anchor: its builder follows 'const biSet = new Set(bi);' style function; the unique line is:
anchor = "          if (path.length < 15) stack.push({ cell: j, out: other, path: [...path, j] });\n        }\n      }\n    }\n  }\n  return null;\n};"
assert anchor in src, "XY-Chain anchor not found - paste me grep output"

# insert the links builder right before xyChain's return-mk? Simpler: build links inside the success branch.
# The success branch is uniquely: "const chain = [...path, j];\n              return mk({"
old = "const chain = [...path, j];\n              return mk({"
assert old in src, "xyChain success anchor not found"
builder = """const chain = [...path, j];
              const chainLinks: { from: { cell: number; cand: number }; to: { cell: number; cand: number }; strong: boolean }[] = [];
              {
                let prev = z === candsOf(g.cands[start])[0] ? candsOf(g.cands[start])[1] : candsOf(g.cands[start])[0];
                for (let k = 0; k + 1 < chain.length; k++) {
                  const a = chain[k], b = chain[k + 1];
                  const sh = candsOf(g.cands[a] & g.cands[b]).filter(x => x !== prev);
                  if (!sh.length) break;
                  chainLinks.push({ from: { cell: a, cand: prev }, to: { cell: a, cand: sh[0] }, strong: true });
                  chainLinks.push({ from: { cell: a, cand: sh[0] }, to: { cell: b, cand: sh[0] }, strong: false });
                  prev = sh[0];
                }
                chainLinks.push({ from: { cell: chain[chain.length - 1], cand: prev }, to: { cell: chain[chain.length - 1], cand: z }, strong: true });
              }
              return mk({"""
src = src.replace(old, builder, 1)

# re-add the mk fields after xyChain's patternCells line
oldmk = "eliminations: elims, patternCells: chain,"
assert oldmk in src
src = src.replace(oldmk, "eliminations: elims, patternCells: chain,\n                candColors: chain.flatMap((c2, k) => candsOf(g.cands[c2]).map(x => ({ cell: c2, cand: x, color: k % 2 }))),\n                links: chainLinks,", 1)

open(P, "w").write(src)
print("repaired")
PY

echo "==> Verify: chainLinks defined and used inside xyChain only"
grep -n "chainLinks" lib/sudoku/techniques.ts

echo "==> HARD GATE: no commit if types fail"
npx tsc --noEmit
echo "types OK"
