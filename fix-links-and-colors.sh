#!/usr/bin/env bash
set -e
cd ~/xoku

echo "==> 1) Renderer: links are undirected lines (no markerEnd)"
python3 - <<'PY'
P = "components/SudokuGrid.tsx"
src = open(P).read()

# remove arrowhead markers from links; keep solid vs dashed distinction
OLD_DEF = """          <defs>
            <marker id="xk-s" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
              <path d="M0,0 L5,2.5 L0,5 z" fill="#dc2626" />
            </marker>
            <marker id="xk-w" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
              <path d="M0,0 L5,2.5 L0,5 z" fill="#dc2626" />
            </marker>
          </defs>
"""
assert src.count(OLD_DEF) == 1, "marker defs not found - aborting"
src = src.replace(OLD_DEF, "")

OLD_LINE = """                <line key={k}
                  x1={a.x + dx * t1} y1={a.y + dy * t1}
                  x2={a.x + dx * t2} y2={a.y + dy * t2}
                  stroke="#dc2626"
                  strokeWidth={l.strong ? 0.8 : 0.42}
                  strokeDasharray={l.strong ? undefined : "1.1 1.3"}
                  strokeLinecap="round"
                  markerEnd={`url(#${l.strong ? "xk-s" : "xk-w"})`} />"""
NEW_LINE = """                <line key={k}
                  x1={a.x + dx * t1} y1={a.y + dy * t1}
                  x2={a.x + dx * t2} y2={a.y + dy * t2}
                  stroke="#dc2626"
                  strokeWidth={l.strong ? 0.8 : 0.42}
                  strokeDasharray={l.strong ? undefined : "1.1 1.3"}
                  strokeLinecap="round" />"""
assert src.count(OLD_LINE) == 1, "link line not found - aborting"
src = src.replace(OLD_LINE, NEW_LINE)
open(P, "w").write(src)
print("    renderer: undirected links (no arrowheads)")
PY

echo "==> 2) XY-Chain: path-based coloring + links emitted"
python3 - <<'PY'
P = "lib/sudoku/techniques.ts"
src = open(P).read()

# locate xyChain's mk: anchor on its technique line
anchor = 'technique: "XY-Chain", category: "Chain", score: 6.0,'
n = src.count(anchor)
assert n == 1, f"XY-Chain anchor found {n}x - aborting"
i = src.index(anchor)
ws = src[src.rfind("\n", 0, i) + 1:i]

RICH = "\n" + ws + """candColors: (() => {
              // walk the chain: in-digit and strong-link partner get opposite colors,
              // alternating along the path (each cell holds one blue + one green node)
              const startDigit = firstOut;
              let prev = startDigit;
              const out: { cell: number; cand: number; color: number }[] = [];
              out.push({ cell: chain[0], cand: startDigit, color: 0 });
              for (let k = 0; k + 1 < chain.length; k++) {
                const a = chain[k], b = chain[k + 1];
                const sh = candsOf(g.cands[a] & g.cands[b]).filter(x => x !== prev);
                if (!sh.length) break;
                out.push({ cell: a, cand: sh[0], color: (k + 1) % 2 });
                out.push({ cell: b, cand: sh[0], color: (k + 1) % 2 });
                prev = sh[0];
              }
              out.push({ cell: chain[chain.length - 1], cand: z, color: chain.length % 2 });
              return out;
            })(),
            links: (() => {
              const L: { from: { cell: number; cand: number }; to: { cell: number; cand: number }; strong: boolean }[] = [];
              const startDigit = firstOut;
              let prev = startDigit;
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
src = src[:i + len(anchor)] + RICH + src[i + len(anchor):]
open(P, "w").write(src)
print("    XY-Chain: path coloring + in-cell strong links emitted")
PY

echo "==> 3) Clean up any earlier XY-Chain candColors that colored by cell"
python3 - <<'PY'
P = "lib/sudoku/techniques.ts"
src = open(P).read()
OLD = "candColors: chain.flatMap((c2, k) => candsOf(g.cands[c2]).map(x => ({ cell: c2, cand: x, color: k % 2 }))),"
n = src.count(OLD)
if n >= 1:
    src = src.replace(OLD, "")
    open(P, "w").write(src)
    print(f"    removed {n} old cell-keyed color line(s)")
else:
    print("    none found (already clean)")
PY

echo "==> GATE"
npx tsc --noEmit && echo "types OK"
