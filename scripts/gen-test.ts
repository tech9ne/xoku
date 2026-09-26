// Dev harness: measure per-tier generation hit rates. Not part of the build.
// usage: NEXT_PUBLIC_STORM_ENGINE=true npx tsx scripts/gen-test.ts <count> [levels...]
import { generatePuzzle } from "../lib/sudoku/solver";
import type { Level } from "../lib/sudoku/solver";

const count = Number(process.argv[2] ?? 2);
const levels = (process.argv.slice(3).length
  ? process.argv.slice(3)
  : ["Very Easy", "Modestly Easy", "Tough", "Challenging", "Hard"]) as Level[];

for (const level of levels) {
  let ok = 0;
  for (let i = 0; i < count; i++) {
    const s = Date.now();
    const r = generatePuzzle(level, { timeBudgetMs: 120000 });
    const dt = ((Date.now() - s) / 1000).toFixed(1);
    if ("failed" in r) {
      console.log(`${level}: FAIL (attempts=${r.attempts}${"reason" in r ? " " + r.reason : ""}) ${dt}s diag=${JSON.stringify((r as Record<string, unknown>).diag ?? {})}`);
    } else {
      ok++;
      const puz = r.puzzle.map(v => (v === 0 ? "." : v)).join("");
      console.log(`${level}: OK hardest=${r.rating.hardest} ${r.rating.hardestTechnique} ${dt}s`);
      console.log(`  P=${puz}`);
    }
  }
  console.log(`== ${level}: ${ok}/${count} succeeded`);
}
