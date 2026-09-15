#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
import re
P = "lib/sudoku/techniques.ts"
src = open(P).read()

def swap(old, new, label):
    global src
    n = src.count(old)
    assert n == 1, f"{label}: found {n}x - aborting"
    src = src.replace(old, new)

# 1) import the new helpers
swap('import { nodeStr, setNodeStr } from "./notation";',
     'import { nodeStr, setNodeStr, bivStr, conclusionStr } from "./notation";',
     "notation import")

# 2) findAic chainStr: fold same-cell strong pairs into (d1 = d2)cell
OLD_CS = """  const chainStr = (path: number[]) =>
    path.map((n, k) => (k === 0 ? nodeName(n) : `${k % 2 === 1 ? " = " : " - "}${nodeName(n)}`)).join("");"""
NEW_CS = """  const chainStr = (path: number[]) => {
    // folded: same-cell strong pairs become (d1 = d2)cell tokens
    const tokens: { text: string; endIdx: number }[] = [];
    let k = 0;
    while (k < path.length) {
      if (k % 2 === 0 && k + 1 < path.length && nodeCell(path[k + 1]) === nodeCell(path[k])) {
        tokens.push({ text: bivStr(nodeDigit(path[k]), nodeDigit(path[k + 1]), nodeCell(path[k])), endIdx: k + 1 });
        k += 2;
      } else {
        tokens.push({ text: nodeName(path[k]), endIdx: k });
        k += 1;
      }
    }
    const parts: string[] = [tokens[0].text];
    for (let t = 0; t + 1 < tokens.length; t++) {
      parts.push(tokens[t].endIdx % 2 === 0 ? " = " : " - ");
      parts.push(tokens[t + 1].text);
    }
    return parts.join("");
  };"""
swap(OLD_CS, NEW_CS, "findAic chainStr")

# 3) five reason lines -> notation-led with => conclusion
for old, label in [
    ("reason: `X-Chain on ${d}: ${chainStr(path)} — the alternating links prove that ${cellName(i)} or ${cellName(B)} must hold ${d}, so ${d} is removed from cells seeing both.`,", "X-Chain reason"),
    ("reason: `AIC: ${chainStr(path)} — at least one end must be true (${cellName(i)} or ${cellName(B)} holds ${d}), so ${d} is removed from cells seeing both.`,", "AIC T1 reason"),
    ("reason: `AIC: ${chainStr(path)} — at least one end must be true (${cellName(i)} is ${d} or ${cellName(B)} is ${q}); ${ending}.`,", "AIC T2 reason"),
    ("reason: `AIC: ${chainStr(path)} — at least one end must be true: ${cellName(i)} holds ${d}, or ${d} is placed in ALS ${A.cells.map(cellName).join(\"+\")}; either way ${d} is removed from cells seeing both.`,", "aicAls T1 reason"),
    ("reason: `AIC: ${chainStr(path)} — at least one end must be true; ${why}.`,", "aicAls T2 reason"),
]:
    new = "reason: `AIC: ${chainStr(path)} => ${conclusionStr(elims)}.`," if label.startswith("AIC") or label.startswith("aicAls") else "reason: `X-Chain: ${chainStr(path)} => ${conclusionStr(elims)}.`,"
    swap(old, new, label)

# 4) XY-Chain: folded notation + reason
anchor = "const chain = [...path, j];"
n = src.count(anchor)
assert n == 1, f"xyChain chain anchor found {n}x - aborting"
i = src.index(anchor)
line_end = src.index("\n", i)
XY_NOT = """
      const xyNot = (() => {
        const parts: string[] = [];
        let incoming = z;
        for (let k = 0; k + 1 < chain.length; k++) {
          const a = chain[k], b = chain[k + 1];
          const outgoing = candsOf(g.cands[a] & g.cands[b]).find(x => x !== incoming)!;
          parts.push(bivStr(incoming, outgoing, a));
          incoming = outgoing;
        }
        parts.push(bivStr(incoming, z, chain[chain.length - 1]));
        return parts.join(" - ");
      })();"""
src = src[:line_end] + XY_NOT + src[line_end:]

src2, n = re.subn(r"reason: `XY-Chain[^`]*`,",
                  "reason: `XY-Chain: ${xyNot} => ${conclusionStr(elims)}.`,", src)
assert n == 1, f"XY-Chain reason found {n}x - aborting"
src = src2

open(P, "w").write(src)
print("    all chain reasons: folded notation + => conclusions")
PY

echo "==> Sanity: reasons now lead with notation"
grep -n 'reason: `X-Chain: \${chainStr' lib/sudoku/techniques.ts
grep -c "=> \${conclusionStr(elims)}" lib/sudoku/techniques.ts   # expect 6

echo "==> GATE"
npx tsc --noEmit && echo "types OK"
