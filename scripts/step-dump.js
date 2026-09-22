// Step-dump: run rateGame and dump every step's full reason + elims + pattern.
const { execSync } = require("child_process");
execSync(
  "npx tsc lib/sudoku/core.ts lib/sudoku/techniques.ts lib/sudoku/solver.ts " +
  "lib/sudoku/slices.ts lib/sudoku/chain-tables.ts lib/sudoku/chain-engine.ts " +
  "--rootDir lib/sudoku --outDir /tmp/xkdump " +
  "--module commonjs --target es2020 --skipLibCheck",
  { stdio: "inherit" }
);
const S = require("/tmp/xkdump/solver.js");
const puzzle = process.argv[2];
if (!puzzle) { console.error("usage: node scripts/step-dump.js <puzzle>"); process.exit(1); }
const g = S.newGame([...puzzle].map(c => c === "." ? 0 : +c));
const r = S.rateGame(g);
console.log(`Puzzle: ${puzzle}`);
console.log(`Steps: ${r.steps.length}, hardest: ${r.hardestTechnique} XR ${r.hardest}, solved: ${r.solvedByLogic}\n`);
for (let i = 0; i < r.steps.length; i++) {
  const s = r.steps[i];
  console.log(`--- Step ${i+1} ---`);
  console.log(`Technique: ${s.technique} (score ${s.score ?? '?'})`);
  console.log(`Category: ${s.category ?? ''}`);
  console.log(`Reason: ${s.reason ?? ''}`);
  console.log(`Placements: ${JSON.stringify(s.placements ?? [])}`);
  console.log(`Eliminations: ${JSON.stringify(s.eliminations ?? [])}`);
  console.log(`Pattern cells: ${JSON.stringify(s.patternCells ?? [])}`);
  console.log();
}
