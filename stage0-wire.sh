#!/usr/bin/env bash
set -e
cd ~/xoku

echo "==> Move record"
cat > lib/sudoku/move.ts <<'EOF'
// Stage 0: the unified Move contract both lenses emit (audit Part 5).
export interface ChainNode {
  kind: "cand" | "biv" | "slice" | "als" | "ahs";
  digit?: number;         // cand / biv in-digit / slice digit
  digit2?: number;        // biv out-digit / ALS in-out pair
  cell?: number;          // cand / biv
  cells?: number[];       // slice / ALS / AHS
  record?: unknown;       // ALS_RCC record (Stage 4)
}
export interface ChainLink {
  from: ChainNode; to: ChainNode; strong: boolean;
}
export interface FishProof {
  digit: number; base: number[]; cover: number[]; k: number;
  fins: number[]; vertices: number[];
}
export interface Move {
  eliminations: { cell: number; cand: number }[];
  placements?: { cell: number; value: number }[];
  rating: number;
  structureName: string;
  form: "wing" | "ring" | "open" | "set" | "fish" | "uniqueness";
  lens: "chain" | "fish" | "direct";
  proof?: { nodes?: ChainNode[]; links?: ChainLink[]; fish?: FishProof };
  notation: string;
  aliases: string[];
}
EOF

echo "==> Rule table (declarative, Part 4 seed)"
cat > lib/sudoku/rules.ts <<'EOF'
// Stage 0: declarative rule table for the naming layer (audit Part 4).
// Matching logic ships with Stage 1; rows are data, most-specific first.
export interface Rule {
  name: string;
  form: "wing" | "ring" | "open";
  pri: number;                 // 10 ring, 20 named, 30 family, 40 fallback
  nodes: string;               // signature, e.g. "cand cand cand cand"
  links: string;               // link-type signature, e.g. "0 0"
  constraints: string;         // free-form, matched by engine
  aliases: string[];
  xr: number;
}
export const RULES: Rule[] = [
  { name: "X-Wing", form: "ring", pri: 10, nodes: "cand cand cand cand", links: "0-2 0-2", constraints: "2R x 2C or 2C x 2R", aliases: ["fish-2"], xr: 3.0 },
  { name: "XY-Ring", form: "ring", pri: 10, nodes: "biv biv biv biv", links: "4 4 4 4", constraints: "4 distinct digits", aliases: ["XY-Chain:ring"], xr: 6.2 },
  { name: "Skyscraper", form: "wing", pri: 20, nodes: "cand cand cand cand", links: "0 0", constraints: "R+R or C+C", aliases: ["Siamese sashimi X-Wing"], xr: 3.8 },
  { name: "2-String Kite", form: "wing", pri: 20, nodes: "cand cand cand cand", links: "0 1", constraints: "R+C", aliases: ["finned mutant X-Wing"], xr: 4.0 },
  { name: "Empty Rectangle", form: "wing", pri: 20, nodes: "slice cand", links: "3 0", constraints: "B+R or B+C", aliases: ["sashimi franken X-Wing", "ERi"], xr: 4.4 },
  { name: "XY-Wing", form: "wing", pri: 20, nodes: "biv biv biv", links: "4 4 4", constraints: "3 digits", aliases: ["ALS-XY", "BARNs-3"], xr: 4.6 },
  { name: "W-Wing", form: "wing", pri: 20, nodes: "biv link biv", links: "4 0-3 4", constraints: "identical bivalves", aliases: [], xr: 5.2 },
  { name: "M(2)-Wing", form: "wing", pri: 20, nodes: "biv link link", links: "4 0/1 0/1", constraints: "", aliases: [], xr: 5.2 },
  { name: "iW-Wing", form: "wing", pri: 20, nodes: "cand cand cand cand", links: "inv-W", constraints: "", aliases: ["inversion"], xr: 5.2 },
  { name: "X-Chain", form: "open", pri: 30, nodes: "cand*", links: "0*", constraints: "single digit", aliases: [], xr: 5.8 },
  { name: "XY-Chain", form: "open", pri: 30, nodes: "biv*", links: "4*", constraints: "", aliases: [], xr: 6.0 },
  { name: "Remote Pair", form: "open", pri: 30, nodes: "biv*", links: "4*", constraints: "2 unique digits", aliases: [], xr: 4.0 },
  { name: "AIC length-n", form: "open", pri: 40, nodes: "any", links: "any", constraints: "fallback", aliases: [], xr: 0 },
];
EOF

echo "==> Notation wave 3 rulings: digit hoisting + victim compression"
python3 - <<'PY'
P = "lib/sudoku/notation.ts"
src = open(P).read()
if "hoistedXChain" not in src:
    src += '''
// StrmCkr compression rulings: shared-digit victims compress
// (r5c1,r6c4 <> 4); single-digit chains hoist the digit once.
export function compressedConclusion(elims: { cell: number; cand: number }[]): string {
  const byDigit = new Map<number, number[]>();
  for (const e of elims) {
    if (!byDigit.has(e.cand)) byDigit.set(e.cand, []);
    byDigit.get(e.cand)!.push(e.cell);
  }
  return [...byDigit.entries()]
    .map(([d, cells]) => `${cells.map(c => cellName(c)).join(",")} <> ${d}`)
    .join(", ");
}

export function hoistedXChain(d: number, tokens: string[]): string {
  return `(${d})(${tokens.join(" ")})`;
}
'''
    open(P, "w").write(src)
    print("    notation: compression + hoisting added")
else:
    print("    notation: already present")
PY

echo "==> Strikethrough removal (the ride-along)"
sed -i 's|"bg-red-500 text-white rounded-full font-bold line-through"|"bg-red-500 text-white rounded-full font-bold"|' components/SudokuGrid.tsx || true

echo "==> Census harness"
cat > scripts/census.js <<'EOF'
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
EOF

echo "==> Sanity: everything imports, nothing else changed"
npx tsc --noEmit && echo "types OK"

echo "==> GATE: census smoke run (engine untouched, output must match pre-Stage-0 behavior)"
node scripts/census.js "..1..25...........59..4..6.9.7.6...1.428....6......94..6.....75...1......2...5.9." | tail -n 6
