const { execSync } = require("child_process");
execSync("npx tsc lib/sudoku/core.ts lib/sudoku/techniques.ts lib/sudoku/solver.ts lib/sudoku/slices.ts lib/sudoku/chain-tables.ts lib/sudoku/chain-engine.ts --rootDir lib/sudoku --outDir /tmp/xkchk --module commonjs --target es2020 --skipLibCheck", { stdio: "inherit" });
const T = require("/tmp/xkchk/techniques.js");
const E = require("/tmp/xkchk/chain-engine.js");
const S = require("/tmp/xkchk/solver.js");
const P3 = "31...2958629538471..81.9623..3.9781...18.359.89..1536.736981245142356789985724136";
const g = S.newGame([...P3].map(c => c === "." ? 0 : +c));

console.log("=== xyWing ===");
const r1 = T.xyWing(g);
console.log("Result:", r1 ? `technique=${r1.technique}, elims=${JSON.stringify(r1.eliminations)}` : "null");

console.log("\n=== chainLens ===");
const r2 = E.chainLens(g);
console.log("Result:", r2 ? `technique=${r2.technique}, elims=${JSON.stringify(r2.eliminations)}` : "null");

console.log("\n=== findAllSteps ===");
const r3 = T.findAllSteps(g);
console.log("Result type:", typeof r3, Array.isArray(r3) ? `array[${r3.length}]` : "not array");
if (Array.isArray(r3) && r3.length > 0) {
  console.log("First step:", JSON.stringify(r3[0], null, 2));
}
