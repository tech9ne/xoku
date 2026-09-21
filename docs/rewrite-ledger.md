# Rewrite ledger — StormDoku mirrors in xoku
Status codes: verbatim-adapted = copied+adapted (obligations attach until
rewritten); rewritten = xoku's own expression, same logic (no attach);
names-only = taxonomy/names adopted, code independent.
- lib/sudoku/storm-names.ts — verbatim-adapted (classifyChain grammar from
  chain.ts:2207-2279; ring/inverted/open grammars). Rewrite candidate H36+.
- techniques.ts remotePair/hiddenRemotePair — verbatim-adapted
  (index.html:10388, 10402-10428) at H34. Rewrite candidate.
- chainMathScore curve (base + lengthExcess + digitExcess + 0.25 open /
  0.5 ring) — formula adopted, implementation xoku's own: names-only.
- findAic classifier wiring (H32/H33) — names-only.
