#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
P = "lib/sudoku/techniques.ts"
src = open(P).read()

anchor = 'technique: "XY-Chain", category: "Chain", score: 6.0,'
assert src.count(anchor) == 1, "XY-Chain anchor missing"
i = src.index(anchor)
window = src[i:i + 9000]

marker = "links: (() => {"
pos, k = [], window.find(marker)
while k != -1:
    pos.append(k)
    k = window.find(marker, k + 1)
assert len(pos) == 2, f"expected 2 links IIFEs in XY-Chain mk, found {len(pos)} - paste me sed -n '520,600p'"

def iife_end(text, start):
    depth, j = 0, text.index("{", start)
    while True:
        c = text[j]
        if c == "{": depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                close = text.find(")(),", j)
                assert close != -1, "IIFE terminator not found"
                return close + len(")(),")
        j += 1

line_start = window.rfind("\n", 0, pos[1]) + 1
end2 = iife_end(window, pos[1])
if window[end2] == "\n": end2 += 1
src = src[:i] + window[:line_start] + window[end2:] + src[i + 9000:]
open(P, "w").write(src)
print("    duplicate links IIFE removed (kept one)")
PY

echo "==> links: count dropped by one"
grep -c "links:" lib/sudoku/techniques.ts

echo "==> GATE"
npx tsc --noEmit && echo "types OK"
