// Diagnostic: show what steps ARE produced, check if puzzles solve
const { execSync } = require("child_process");
execSync("npx tsc lib/sudoku/core.ts lib/sudoku/techniques.ts lib/sudoku/solver.ts lib/sudoku/slices.ts lib/sudoku/chain-tables.ts lib/sudoku/chain-engine.ts --rootDir lib/sudoku --outDir /tmp/xkdiag --module commonjs --target es2020 --skipLibCheck", { stdio: "inherit" });
const T = require("/tmp/xkdiag/techniques.js");
const E = require("/tmp/xkdiag/chain-engine.js");
const S = require("/tmp/xkdiag/solver.js");
const P1 = "..47.5...29....15..5891....52.49861....5.1...9.1.3..85..2856931..9...546..51498..";
const P2 = "16.3.825.83.256..152.91.3682567931849714856324836219753958.2.1661253.8..748169523";
const P3 = "31...2958629538471..81.9623..3.9781...18.359.89..1536.736981245142356789985724136";

console.log("=== P1 X-Ring vector ===");
const g1 = S.newGame([...P1].map(c => c === "." ? 0 : +c));
const r1 = S.rateGame(g1);
console.log(`Solves: ${r1.solvedByLogic}, steps: ${r1.steps.length}, hardest: ${r1.hardestTechnique} XR ${r1.hardest}`);
console.log(`First 5 steps:`);
for (let i = 0; i < Math.min(5, r1.steps.length); i++) {
  const s = r1.steps[i];
  console.log(`  ${i+1}. ${s.technique}: ${s.eliminations ? s.eliminations.length + " elims" : "placements"}`);
}

console.log("\n=== P2 Remote Pair vector ===");
const g2 = S.newGame([...P2].map(c => c === "." ? 0 : +c));
const r2 = S.rateGame(g2);
console.log(`Solves: ${r2.solvedByLogic}, steps: ${r2.steps.length}, hardest: ${r2.hardestTechnique} XR ${r2.hardest}`);
console.log(`First 5 steps:`);
for (let i = 0; i < Math.min(5, r2.steps.length); i++) {
  const s = r2.steps[i];
  console.log(`  ${i+1}. ${s.technique}: ${s.eliminations ? s.eliminations.length + " elims" : "placements"}`);
}

console.log("\n=== P3 XY-Wing vector ===");
const g3 = S.newGame([...P3].map(c => c === "." ? 0 : +c));
const r3 = S.rateGame(g3);
console.log(`Solves: ${r3.solvedByLogic}, steps: ${r3.steps.length}, hardest: ${r3.hardestTechnique} XR ${r3.hardest}`);
console.log(`First 5 steps:`);
for (let i = 0; i < Math.min(5, r3.steps.length); i++) {
  const s = r3.steps[i];
  console.log(`  ${i+1}. ${s.technique}: ${s.eliminations ? s.eliminations.length + " elims" : "placements"}`);
}
