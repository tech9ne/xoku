#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
P = "lib/sudoku/techniques.ts"
src = open(P).read()

anchor = 'technique: "XY-Chain", category: "Chain", score: 6.0,'
assert src.count(anchor) == 1, "XY-Chain anchor missing"
i = src.index(anchor)
wend = src.find("export const", i)
assert wend != -1, "window end not found"
window = src[i:wend]

def cut_prop(text, name):
    # remove every `name: <expr>,` property: scan to the first comma at
    # bracket-depth 0 that ends its line (property boundaries in our style)
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
            elif c == "," and depth == 0:
                nl = text.find("\n", j)
                if text[j+1:nl].strip() == "": break
            j += 1
        e = j + 1
        nl = text.find("\n", e)
        if nl != -1 and text[e:nl].strip() == "": e = nl + 1
        k = e
    return "".join(res)

window = cut_prop(window, "candColors")
window = cut_prop(window, "links")

NEW = """candColors: (() => {
              // blue-first, derived from the walk: in every cell the incoming
              // digit (shared with the previous cell) is blue/OFF, the outgoing
              // digit (shared with the next) is green/ON. Endpoints: chain[0]:z
              // is the OFF assumption (blue), chain[last]:z the derived ON (green).
              const out: { cell: number; cand: number; color: number }[] = [];
              out.push({ cell: chain[0], cand: z, color: 0 });
              let incoming = z;
              for (let k = 0; k + 1 < chain.length; k++) {
                const a = chain[k], b = chain[k + 1];
                const outgoing = candsOf(g.cands[a] & g.cands[b]).find(x => x !== incoming)!;
                out.push({ cell: a, cand: outgoing, color: 1 });
                out.push({ cell: b, cand: outgoing, color: 0 });
                incoming = outgoing;
              }
              out.push({ cell: chain[chain.length - 1], cand: z, color: 1 });
              return out;
            })(),
            links: (() => {
              const L: { from: { cell: number; cand: number }; to: { cell: number; cand: number }; strong: boolean }[] = [];
              let incoming = z;
              for (let k = 0; k + 1 < chain.length; k++) {
                const a = chain[k], b = chain[k + 1];
                const outgoing = candsOf(g.cands[a] & g.cands[b]).find(x => x !== incoming)!;
                L.push({ from: { cell: a, cand: incoming }, to: { cell: a, cand: outgoing }, strong: true });
                L.push({ from: { cell: a, cand: outgoing }, to: { cell: b, cand: outgoing }, strong: false });
                incoming = outgoing;
              }
              L.push({ from: { cell: chain[chain.length - 1], cand: incoming }, to: { cell: chain[chain.length - 1], cand: z }, strong: true });
              return L;
            })(),"""

line_end = window.index("\n") + 1
window2 = window[:line_end] + NEW + "\n" + window[line_end:]

assert window2.count("candColors:") == 1, "candColors != 1 after fix - aborting"
assert window2.count("links:") == 1, "links != 1 after fix - aborting"

src = src[:i] + window2 + src[wend:]
open(P, "w").write(src)
print("    XY-Chain: role-based coloring (in=blue/out=green), links match nodes")
PY

echo "==> GATE"
npx tsc --noEmit && echo "types OK"
