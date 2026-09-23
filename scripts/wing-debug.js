const { execSync } = require("child_process");
execSync("npx tsc lib/sudoku/core.ts lib/sudoku/techniques.ts lib/sudoku/solver.ts lib/sudoku/slices.ts lib/sudoku/chain-tables.ts lib/sudoku/chain-engine.ts --rootDir lib/sudoku --outDir /tmp/xkdbg --module commonjs --target es2020 --skipLibCheck", { stdio: "inherit" });
const T = require("/tmp/xkdbg/techniques.js");
const E = require("/tmp/xkdbg/chain-engine.js");
const S = require("/tmp/xkdbg/solver.js");
const P3 = "31...2958629538471..81.9623..3.9781...18.359.89..1536.736981245142356789985724136";
const g = S.newGame([...P3].map(c => c === "." ? 0 : +c));
const finders = { xyWing: T.xyWing, wWing: T.wWing, chainLens: E.chainLens };
const steps = [];
for (const [fnName, fn] of Object.entries(finders)) {
  let r = null; try { r = fn(g); } catch (e) { continue; }
  if (!r || typeof r !== "object") continue;
  console.log(`${fnName}: returned ${Array.isArray(r) ? "array[" + r.length + "]" : "object"}`);
  for (const s of Array.isArray(r) ? r : [r]) {
    if (s && s.technique && s.eliminations) {
      steps.push(s);
      console.log(`  -> ${s.technique}: ${JSON.stringify(s.eliminations)}`);
    }
  }
}
const target = [[36,4],[48,4]];
const targetKey = target.map(e => e[0] * 10 + e[1]).sort((a, b) => a - b).join(",");
console.log("\nTarget key:", targetKey);
for (const s of steps) {
  const actualKey = s.eliminations.map(e => e.cell * 10 + e.cand).sort((a, b) => a - b).join(",");
  console.log(`${s.technique} key: ${actualKey} ${actualKey === targetKey ? "[MATCH]" : ""}`);
}
