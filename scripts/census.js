// Census: solve a puzzle batch with the full registry, dump the technique
// histogram. Every stage-gate retirement requires before/after parity runs.
const { execSync } = require("child_process");
execSync(
  "npx tsc lib/sudoku/core.ts lib/sudoku/techniques.ts lib/sudoku/solver.ts " +
  "--rootDir lib/sudoku --outDir /tmp/xkcensus " +
  "--module commonjs --target es2020 --skipLibCheck",
  { stdio: "inherit" }
);
const S = require("/tmp/xkcensus/solver.js");
const puzzles = (process.argv[2] || "").split(/\s+/).filter(Boolean);
if (!puzzles.length) {
  console.error("usage: node scripts/census.js <puzzle1> <puzzle2> ...");
  process.exit(1);
}
for (const p of puzzles) {
  const g = S.newGame([...p].map(c => (c === "." ? 0 : +c)));
  const r = S.rateGame(g);
  const hist = {};
  for (const s of r.steps) hist[s.technique] = (hist[s.technique] || 0) + 1;
  console.log(`\n${p}`);
  for (const [k, v] of Object.entries(hist).sort((a, b) => b[1] - a[1]))
    console.log("  ", String(v).padStart(3), k);
  console.log("   hardest:", r.hardestTechnique, "XR", r.hardest,
              "| solved:", r.solvedByLogic, "| steps:", r.steps.length);
}
