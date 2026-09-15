#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
P = "lib/sudoku/techniques.ts"
src = open(P).read()

def cut_prop(text, name):
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
            elif c == "," and depth == 0: break
            j += 1
        e = j + 1
        nl = text.find("\n", e)
        if nl != -1 and text[e:nl].strip() == "": e = nl + 1
        k = e
    return "".join(res)

anchor = 'technique: "XYZ-Wing", category: "Wing", score: 4.8,'
assert src.count(anchor) == 1, "XYZ anchor not unique"
i = src.index(anchor)
wend = src.find("export const", i)
window = src[i:wend]
window = cut_prop(window, "cellGroups")
line_end = window.index("\n") + 1
NEW = """          cellGroups: [
            { cells: [p, a], color: 3 },
            { cells: [b], color: 4 },
          ],"""
window = window[:line_end] + NEW + "\n" + window[line_end:]
src = src[:i] + window + src[wend:]
open(P, "w").write(src)
print("    XYZ-Wing: two-ALS tints, {pivot,a} vs {b}")
PY

echo "==> GATE"
npx tsc --noEmit && echo "types OK"
