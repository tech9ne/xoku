#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
P = "lib/sudoku/techniques.ts"
src = open(P).read()

# ---------- TURBOT FAMILY: walk = a1(B) = a2(G) - y(B) = fy(G)? ----------
# No: strong link = OFF->ON. Start assumption: a1 is OFF (blue).
#   a1(B) =strong= a2(G)      a2/x sees y: weak = ON->OFF: y(B)
#   y(B) =strong= fy(G)       endpoints: a1 and fy -> the OR pair.
# BUT the elimination targets must see BOTH a1 and fy. The finder already
# guarantees that via commonPeers(x_endpoint_pair). The drawn walk must be
# exactly [a1, a2, y, fy] with colors [0,1,0,1]: blue, green, blue, green.
# (It was; the parity was right but the START was arbitrary — a1 vs the
# logical start. Since both endpoints are equivalent for the OR, the
# invariant that matters is: first node blue, strict alternation, endpoints
# = the OR pair. Enforce explicitly.)
OLD_T = """            candColors: [a1, a2, y, fy].map((c, k) => ({ cell: c, cand: d, color: k % 2 })),"""
NEW_T = """            candColors: [a1, a2, y, fy].map((c, k) => ({ cell: c, cand: d, color: k % 2 })),
            // endpoints of the OR are a1 and fy (blue start, green end)"""
assert src.count(OLD_T) == 1, "turbot candColors not found - paste me grep -n 'a1, a2, y, fy' output"
src = src.replace(OLD_T, NEW_T)

# ---------- XY-CHAIN: rebuild the coloring + links with verified start ----------
# The chain array is [start, ..., end]; the assumption: start is OFF in the
# digit that leaves first (firstOut). Walk: start(firstOut)=B --strong-->
# start(other)=G --weak--> next(sh)=B ... The parity bug: my IIFE pushed the
# in-cell partner with (k+1)%2 but the weak-link node in the NEXT cell with
# the same (k+1)%2 — wrong: after the strong link the color flips to green,
# then the shared digit in the next cell is the OFF side = blue again.
# Correct walk: cell k holds [in=parity_k, out=1-parity_k]; the shared digit
# enters the next cell as in = 1-parity... Rebuild cleanly:
import re
# find and remove BOTH the candColors IIFE and links IIFE in XY-Chain mk
anchor = 'technique: "XY-Chain", category: "Chain", score: 6.0,'
assert src.count(anchor) == 1
i = src.index(anchor)
window = src[i:i + 12000]

def cut_iife(text, marker):
    out = []
    k = 0
    while True:
        p = text.find(marker, k)
        if p == -1:
            out.append(text[k:])
            break
        out.append(text[k:p])
        # find matching close: naive brace count from first { after p
        j = text.index("{", p)
        depth = 0
        while True:
            if text[j] == "{": depth += 1
            elif text[j] == "}":
                depth -= 1
                if depth == 0: break
            j += 1
        # skip trailing ")(),"
        e = text.find(")(),", j)
        assert e != -1, "IIFE close not found"
        e += len(")(),")
        if text[e] == "\n": e += 1
        k = e
    return "".join(out)

window2 = cut_iife(window, "candColors: (() => {")
window2 = cut_iife(window2, "links: (() => {")

NEW_BLOCK = """candColors: (() => {
              // blue-first convention: start assumption = start cell is OFF
              // in its outgoing digit. Alternation: in-digit = parity,
              // strong-link partner = 1 - parity, shared digit carries
              // 1 - parity into the next cell where it is the in-digit.
              const out: { cell: number; cand: number; color: number }[] = [];
              let parity = 0;                    // 0 = blue
              let prev = firstOut;               // digit leaving the start
              out.push({ cell: chain[0], cand: firstOut, color: 0 });
              const other0 = candsOf(g.cands[chain[0]]).find(x => x !== firstOut)!;
              out.push({ cell: chain[0], cand: other0, color: 1 });
              parity = 1;
              for (let k = 0; k + 1 < chain.length; k++) {
                const a = chain[k], b = chain[k + 1];
                const sh = candsOf(g.cands[a] & g.cands[b]).filter(x => x !== prev);
                if (!sh.length) break;
                // sh[0] arrives in cell b as the OFF side -> blue
                out.push({ cell: b, cand: sh[0], color: 0 });
                const partner = candsOf(g.cands[b]).find(x => x !== sh[0])!;
                if (partner !== undefined) out.push({ cell: b, cand: partner, color: 1 });
                prev = sh[0];
                parity = 1 - parity;
              }
              out.push({ cell: chain[chain.length - 1], cand: z, color: chain.length % 2 === 1 ? 0 : 1 });
              return out;
            })(),
            links: (() => {
              const L: { from: { cell: number; cand: number }; to: { cell: number; cand: number }; strong: boolean }[] = [];
              let prev = firstOut;
              for (let k = 0; k + 1 < chain.length; k++) {
                const a = chain[k], b = chain[k + 1];
                const sh = candsOf(g.cands[a] & g.cands[b]).filter(x => x !== prev);
                if (!sh.length) break;
                L.push({ from: { cell: a, cand: prev }, to: { cell: a, cand: sh[0] }, strong: true });
                L.push({ from: { cell: a, cand: sh[0] }, to: { cell: b, cand: sh[0] }, strong: false });
                prev = sh[0];
              }
              L.push({ from: { cell: chain[chain.length - 1], cand: prev }, to: { cell: chain[chain.length - 1], cand: z }, strong: true });
              return L;
            })(),"""
# insert NEW_BLOCK right after the anchor line
line_end = window2.index("\n", window2.index(anchor_marker := "score: 6.0,")) + 1
src = src[:i] + window2[:line_end] + NEW_BLOCK + "\n" + window2[line_end:] + src[i + 12000:]
open(P, "w").write(src)
print("    XY-Chain: blue-first coloring rebuilt, links rebuilt")
PY

echo "==> links: count (expect unchanged or -0 from before this script)"
grep -c "links:" lib/sudoku/techniques.ts

echo "==> GATE"
npx tsc --noEmit && echo "types OK"
