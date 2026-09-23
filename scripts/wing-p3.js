// Check P3 XY-Wing specifically
const { execSync } = require("child_process");
execSync("npx tsc lib/sudoku/core.ts lib/sudoku/techniques.ts lib/sudoku/solver.ts lib/sudoku/slices.ts lib/sudoku/chain-tables.ts lib/sudoku/chain-engine.ts --rootDir lib/sudoku --outDir /tmp/xkp3 --module commonjs --target es2020 --skipLibCheck", { stdio: "inherit" });
const T = require("/tmp/xkp3/techniques.js");
const S = require("/tmp/xkp3/solver.js");
const P3 = "31...2958629538471..81.9623..3.9781...18.359.89..1536.736981245142356789985724136";
const g = S.newGame([...P3].map(c => c === "." ? 0 : +c));
const r = T.findXYWing(g);
console.log("findXYWing result:", JSON.stringify(r, null, 2));
const target = [[36,4],[49,4]];
const targetKey = target.map(e => e[0] * 10 + e[1]).sort((a, b) => a - b).join(",");
console.log("Target elim key:", targetKey);
if (r && r.eliminations) {
  const actualKey = r.eliminations.map(e => e.cell * 10 + e.cand).sort((a, b) => a - b).join(",");
  console.log("Actual elim key:", actualKey);
  console.log("Match:", targetKey === actualKey);
}
