# Xoku — Sudoku Trainer & Structural Solver

Xoku is a browser Sudoku trainer whose hint engine is built on **structural
logic, not pattern heuristics**: every hint is a proof assembled from XOR
(strong) and NAND (weak) inferences over mini-sector slices.

## The Unified Engine (two lenses, one move record)
- **Chain lens** — AIC search with V/L (Value/Location) tagging, ERI
  directional switches, Type 1/2/3 eliminations, and ring closure
  (rings own the report and score +0.5).
- **Fish lens** — base/cover arithmetic, N x (N+K) counting, finned and
  sashimi fish up to size 4 (Franken/mutant planned).
- **Declarative naming table** — chain signatures (node kinds, weak kinds,
  link types 0-4) map to exact technique names; generic AIC only as the
  final fallback.
- **StrmCkr ladder** — 14 difficulty tiers, Extremely Easy to Nightmare,
  each with its own status-bar color; ratings read the ladder honestly.

## Technique coverage
Singles, locked candidates, naked/hidden subsets, basic + finned + sashimi
fish (2-4), skyscraper, 2-string kite, empty rectangle, XY/XYZ/W-Wing,
X-Chain, XY-Chain, remote pair, AIC Types 1/2 and ring forms, uniqueness
tests 1/3/4, BUG+1 and BUG-lite, ALS-XZ, ALS-XY-Wing, ALS chain,
Death Blossom.

## Retired as obsolete (per StrmCkr's subsumption ruling)
Turbot Fish, Simple Colors, AIC-with-ALS-nodes — all are special cases of
general chain logic and are now expressed as chains.

## Credits & lineage
- **StrmCkr** — the XOR/NAND AIC framework, V/L taxonomy, ERI, mini-sector
  theory, the 14-tier ladder, and the StormDoku reference implementation.
  This engine is a direct implementation of his published framework.
- **HoDoKu / hodoku2** — original technique catalogue and UI inspiration.
- **YZF (Yizhe Fan's solver)** — exotic technique census reference.

## Run locally
    npm install
    npm run dev      # develop
    npm run build    # production build (deploys to GitHub Pages)

## Versioning
Build tags follow `v<major>.<minor>-h<commit>`; every milestone is recorded
in `docs/STATE.md`.
