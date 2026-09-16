// Soundness audit v2: validates every found chain against the ACTUAL
// ending rules - T1 (same digit, both objects), T2-cross (mixed digits,
// single cells, peers), T2-samecell. Set endpoints with mixed digits are
// the true unsound class. Fresh-compile guard: no stale /tmp reuse.
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
    const a = f.path[0], b = f.path[f.path.length - 1];
    const dig = k => (T.isSetKey(k) ? t.sets[k - 1000].digit : k % 10);
    const kind = k => (T.isSetKey(k) ? "set" : "cand");
    const sd = dig(a), ed = dig(b);
    let ok;
    if (sd === ed) {
      ok = f.elims.every(e => e.cand === sd);                    // T1
    } else if (kind(a) === "set" || kind(b) === "set") {
      ok = false;                                                 // true bug class
    } else {
      const ca = Math.floor(a / 10), cb = Math.floor(b / 10);
      if (ca === cb)
        ok = f.elims.every(e => e.cell === ca && e.cand !== sd && e.cand !== ed);
      else                                                        // T2 cross
        ok = f.elims.every(e =>
          (e.cell === ca && e.cand === ed) || (e.cell === cb && e.cand === sd));
    }
    if (!ok) {
      bad++;
      console.log("UNSOUND:", JSON.stringify({
        elims: f.elims, endDigits: [sd, ed], kinds: [kind(a), kind(b)],
      }));
    }
  }
  console.log(p.slice(0, 20) + "... chains:", found.length);
}
console.log(bad === 0 ? `SOUNDNESS OK - ${total} chains audited` : `${bad} UNSOUND of ${total}`);
process.exit(bad === 0 ? 0 : 1);
