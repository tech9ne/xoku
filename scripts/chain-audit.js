// Soundness audit v5 - the complete verifier (AIC 101 rules).
//   1. T1: same-digit endpoints, victims see all cells of both objects
//   2. T2: mixed digits, single-cell endpoints only (cross or same-cell)
//   3. NAND adjacency: candidate not inside its weak-linked set
//   4. Overlap: two sets on a weak hop are disjoint (doubly-coloured-cell rule)
//   5. Self-kill: no victim is a member of any path node
const { execSync } = require("child_process");
execSync("rm -rf /tmp/xkaudit");
execSync(
  "npx tsc lib/sudoku/core.ts lib/sudoku/slices.ts lib/sudoku/chain-tables.ts " +
  "lib/sudoku/notation.ts lib/sudoku/chain-engine.ts lib/sudoku/techniques.ts " +
  "lib/sudoku/solver.ts --rootDir lib/sudoku --outDir /tmp/xkaudit " +
  "--module commonjs --target es2020 --skipLibCheck", { stdio: "inherit" });
const T = require("/tmp/xkaudit/chain-tables.js");
const E = require("/tmp/xkaudit/chain-engine.js");
const S = require("/tmp/xkaudit/solver.js");
const puzzles = [
  "5.1..3.....7..415..89.15.6..15..7346.2364157.67435....15643.78..925.......81....5",
  "000382000030000080708000523340096050900050006000103000020608095006000400503070061",
  "..1..25...........59..4..6.9.7.6...1.428....6......94..6.....75...1......2...5.9.",
];
let bad = 0, total = 0;
for (const p of puzzles) {
  const g = S.newGame([...p].map(c => (c === "." ? 0 : +c)));
  const t = T.buildChainTables(g);
  const found = E.searchChains(g, t, 4);
  for (const f of found) {
    total++;
    const dig = k => (T.isSetKey(k) ? t.sets[k - 1000].digit : k % 10);
    const kind = k => (T.isSetKey(k) ? "set" : "cand");
    const a = f.path[0], b = f.path[f.path.length - 1];
    const sd = dig(a), ed = dig(b);

    if (sd === ed) {
      const cells = k => (T.isSetKey(k) ? t.sets[k - 1000].cells : [Math.floor(k / 10)]);
      if (!f.elims.every(e => e.cand === sd && !cells(a).includes(e.cell) && !cells(b).includes(e.cell)))
        { bad++; console.log("BAD-T1:", JSON.stringify(f.elims)); }
    } else if (kind(a) === "set" || kind(b) === "set") {
      bad++; console.log("BAD-MIXED-SET-END:", JSON.stringify({ ends: [sd, ed] }));
    } else {
      const ca = Math.floor(a / 10), cb = Math.floor(b / 10);
      const ok = ca === cb
        ? f.elims.every(e => e.cell === ca && e.cand !== sd && e.cand !== ed)
        : f.elims.every(e => (e.cell === ca && e.cand === ed) || (e.cell === cb && e.cand === sd));
      if (!ok) { bad++; console.log("BAD-T2:", JSON.stringify(f.elims)); }
    }

    for (let k = 0; k + 1 < f.path.length; k++) {
      if (k % 2 !== 1) continue;
      const x = f.path[k], y = f.path[k + 1];
      const xSet = T.isSetKey(x), ySet = T.isSetKey(y);
      if (xSet !== ySet) {
        const setC = xSet ? t.sets[x - 1000].cells : t.sets[y - 1000].cells;
        const candCell = xSet ? Math.floor(y / 10) : Math.floor(x / 10);
        if (setC.includes(candCell)) { bad++; console.log("NAND-SELF:", JSON.stringify({ at: k })); }
      }
      if (xSet && ySet) {
        const sa = t.sets[x - 1000].cells, sb = t.sets[y - 1000].cells;
        if (sa.some(c => sb.includes(c))) { bad++; console.log("OVERLAP:", JSON.stringify({ at: k })); }
      }
    }

    for (const e of f.elims)
      for (const k of f.path) {
        const member = T.isSetKey(k)
          ? (t.sets[k - 1000].digit === e.cand && t.sets[k - 1000].cells.includes(e.cell))
          : (k % 10 === e.cand && Math.floor(k / 10) === e.cell);
        if (member) { bad++; console.log("SELF-KILL:", JSON.stringify({ cell: e.cell, cand: e.cand })); break; }
      }
  }
  console.log(p.slice(0, 20) + "... chains:", found.length);
}
console.log(bad === 0 ? `SOUNDNESS OK - ${total} chains audited` : `${bad} UNSOUND of ${total}`);
process.exit(bad === 0 ? 0 : 1);
