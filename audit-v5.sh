#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
P = "scripts/chain-audit.js"
src = open(P).read()
if "OVERLAP" in src:
    raise SystemExit("v5 already installed")
anchor = "    // NAND audit: no weak link may join a candidate to a set containing it"
assert src.count(anchor) == 1, "v3 anchor missing - paste me the audit's loop head"
NEW = """    // v5 (AIC 101): NAND-joined edges must be disjoint; victims never on path
    for (let k = 0; k + 1 < f.path.length; k++) {
      const a = f.path[k], b = f.path[k + 1];
      if (k % 2 === 1 && T.isSetKey(a) && T.isSetKey(b)) {
        const sa = t.sets[a - 1000].cells, sb = t.sets[b - 1000].cells;
        if (sa.some(x => sb.includes(x))) {
          bad++;
          console.log("OVERLAP:", JSON.stringify({ at: k }));
        }
      }
    }
    for (const e of f.elims)
      for (const k of f.path) {
        const member = T.isSetKey(k)
          ? t.sets[k - 1000].cells.includes(e.cell)
          : Math.floor(k / 10) === e.cell;
        if (member) {
          bad++;
          console.log("SELF-KILL:", JSON.stringify({ cell: e.cell, cand: e.cand }));
          break;
        }
      }
    // NAND audit: no weak link may join a candidate to a set containing it"""
src = src.replace(anchor, NEW)
open(P, "w").write(src)
print("    audit v5 installed")
PY

node scripts/chain-audit.js
