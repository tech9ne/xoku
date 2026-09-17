# xoku — Project State (resume doc)
Updated: 2026-09-18, session H8a. Read fully before touching code.

## 1. What this is
- Sudoku trainer "xoku": Next.js 16.3.5 (Turbopack) + TS + Tailwind, static export to GitHub Pages.
- Repo github.com:tech9ne/xoku.git ; live https://tech9ne.github.io/xoku/ ; workdir ~/xoku on ubuntu@rev9.
- Behavior/UX reference: HoDoKu (PseudoFish fork). Clone at /tmp/hodoku-src (HEAD c37fe90).
  If missing: git clone --depth 1 https://github.com/PseudoFish/Hodoku /tmp/hodoku-src
- Secondary reference: Hodoku2 (wyzelli) clone at /tmp/hodoku2-src — newer UI and Draw Links mode (manual strong/weak link arrows); H9 arrows reference.
- Owner: Tommy. Wants rigor, verified short steps, no guessing, no beginner explanations.

## 2. Workflow rules (hard-won; follow them)
- Mobile SSH terminal mangles long pastes. Use small blocks, one purpose each, verify with grep/sed after.
- Python edit scripts: assert anchor count==1; write file only at end; prefer substring anchors.
- Version tag: lib/version.ts BUILD_TAG. Bump with
  TAG=$(grep -o 'v14\.3-h7[a-z]' lib/version.ts); sed -i "s/$TAG/v14.3-hXX/" lib/version.ts
  Never assume the previous tag (the h7b-stuck incident: chained seds no-op'd for 4 releases).
- npx tsc --noEmit must be silent before commit. Broken commit already pushed?
  fix, git commit --amend, git push --force-with-lease origin main.
- Phone Chrome caches hard: after push, clear cached images and confirm Summary>Build tag
  before judging any visual change. Pages deploy takes ~1-2 min; a transient
  "This page couldn't load" is network/deploy window, NOT an app crash.
- One feature = one commit + version bump + push + phone verification.

- Every commit must update docs/STATE.md with the new state/milestone before push.

## 3. File map
- app/page.tsx — state + handlers: hint state ~21, getHint ~159, applyHint ~171,
  auto-solve loop ~190-199, Hints dock ~354 (left column under grid); shell: root ~318, left col ~331, aside ~380, footer ~465; hintMode/solveUpTo/cancelHint, right panel below.
- components/SudokuGrid.tsx — board, hint-dot rendering, HINT_COLORS + MANUAL_COLORS.
- components/MenuBar.tsx — toolbar: undo/redo mask PNGs, logo SVG, level select,
  filter swatch, digit strip. Props: onNew/onRestart/onImport/onExport/onUndo/
  onRedo/canUndo/canRedo/onToggleFilterMode/filterMode/onHintVague/onHintConcrete/onHintNext/onHintExecute/onHintAbort/hintMode/hasHint.
- lib/sudoku/core.ts — Game/Step types, applyStep, candMask, candsOf, cellName.
- lib/sudoku/techniques.ts — finders. findNextStep(g: Game): Step | null at ~1685
  (NO singlesOnly param). findAllSteps ~1653. Helpers ccOf/memOf near alsXZ.
- lib/version.ts — BUILD_TAG. docs/STATE.md — this file.

## 4. Hint coloring system (current, deliberate)
Candidate-only dots (Hodoku fillOval parity). No cell tints for techniques.
Vague hint mode suppresses dots by passing null step to SudokuGrid; concrete mode passes the active Step.
Selection = 3px yellow ring outline only, never a fill.
- HINT_COLORS[6] in SudokuGrid:
  0 #7FBBFF spine off/entry (blue), 1 #3FDA65 spine on/exit (green),
  2 #FF8800 set0 orange, 3 #9D4EDD set1 violet,
  4 #FF00FF set2 fuchsia, 5 #800000 set3 maroon.
- Spine rule: per ALS set entry=0(blue), exit=1(green); weak link carries
  green->blue across sets; every chain starts blue.
  ALS-XZ [z@B0,x@B1,x@A0,z@A1]; ALS-XY-Wing pivot-middle [Z@B0,X@B1,X@A0,Y@A1,Y@C0,Z@C1];
  ALS-Chain tracks vias[] in its DFS stack; Death Blossom [Z@A0,x@A1,x@S0,y@S1,y@B0,Z@B1];
  XYZ-Wing pure 6-dot spine [z@a0,x@a1,x@p0,y@p1,y@b0,z@b1] (no members).
- Members: non-spine candidates of set k get color 2+(k%4). Emitters use
  ccOf (presence-filtered dots) + memOf (members minus spine digits).
- Eliminations: bg-red-500 #EF4444 white text, one global color for all techniques
  (role = "dies"). Deliberate divergence from Hodoku salmon #FF7684: in a vibrant
  palette salmon reads as a set color; true red keeps the alarm function.
- ALS theory: within an ALS any two candidates are strong-linked = inclusive OR
  (both-false impossible, both-true possible) = NAND of negations. NOT XOR.
- Human digit filter (toolbar 1-9): cell-level #B9FFB9 possible / #FFB9B9 excluded.
  Unchanged by design (Hodoku filters candidate squares; accepted divergence).
- Manual paint: MANUAL_COLORS 5 entries; to be replaced by Hodoku COLORING_COLORS
  12 swatches at H10.
- Rejected: Hodoku pastels for members, cyan #00B4D8, copper #B87333, magenta #FF006E.

## 5. Milestones (git log is truth; tags v14.3-h6k..h8a)
H6k filter-mode toggle swatch. H6l TS fixes (LayoutProps, dup prop).
H6m logo D (X-Wing two-tone X on nonet). H6n logo full-bleed (no slate frame).
H7a ALS/Wing emitters emit candColors; deleted cell-tint branch.
H7b candidate-only dots: placements+patternCands as dots; deleted bg-sky-100/green-200.
H7c flat dots (white ring removed). H7d category palettes (superseded by H7f).
H7e ALS spine + per-set members. H7f HINT_COLORS 6-slot unification, nc %6.
H7g vibrant members + version-tag fix. H7h spine order fixes (XY-Wing pivot middle,
XYZ-Wing true spine). H7i copper (rejected). H7j fuchsia+maroon.
H7k H7 UI completion: toolbar vague/concrete/next/execute/abort; dock Solve up to/Cancel; vague = name+region no dots; solve-up-to stops at first non-Single/Subset and shows step (v14.3-h8).
H8a app shell frame: fixed desktop viewport, left column = grid+all-steps+dock, right column internal scroll, status bar pinned (v14.3-h8a).
VERIFY: git log --oneline -5 and grep BUILD_TAG lib/version.ts — if tag < h8, re-apply H7 UI (toolbar hint group + dock Solve up to/Cancel + vague/concrete logic) before anything else.

## 6. Hodoku reference pointers (/tmp/hodoku-src)
- SudokuPanel.java ~2574-2678: hintColor decision tree — chain strong=green back,
  weak=fin blue; ALS backs[alsIndex%4]; fins; endo-fins; coloring map; delete;
  cannibalistic. Dots drawn with g2.fillOval per candidate.
- Options.java ~495-545: color constants — FILTER #B9FFB9, INVERSE #FFB9B9,
  AKT_CELL #FFFF96, HINT_CANDIDATE_BACK #3FDA65, DELETE #FF7684, FIN #7FBBFF,
  ENDO_FIN #D8B2FF, ALS backs 4 pastels, COLORING_COLORS 12, difficulty RGBs
  (our level dots already match exactly).
- MainFrame.java 191-202: toolbar vageHintToggleButton, concreteHintToggleButton,
  hintSeperator, execute-next-step button. Hint panel: solveUpToButton,
  hinweisAusfuehrenButton (Execute), hinweisAbbrechenButton (Cancel),
  hinweisTextArea.

## 7. Done: H7 (hint UI completion)
- Dock: Hodoku-style text area left + 2×2 button grid right: Next Hint, Execute, Solve up to, Cancel.
- Toolbar: hint group after redo separator, before new-game logo: vague, concrete, next, execute, abort.
- Vague mode: technique + region cells only; no dots. Grid receives `step={hintMode === "concrete" ? hint : null}`.
- Concrete mode: full reason + dots.
- Solve up to: applies while `step.category` is `Single` or `Subset`; stops before first non-progress step, forces concrete mode, shows stopping step as active hint.
- `getHint` accepts `unknown` first arg so React click events cannot enter the hint-mode union.
- Locked decisions: 1a vague = name+region only; 2 solve-up-to boundary = Single/Subset + show stopping step.

## 8. Queue after H7 (rescoped at H8a: shell-parity program)
H8a DONE (v14.3-h8a): app shell — desktop fixed 100vh frame, no page scroll;
phone scrolls. Left column = grid + all-steps + hints dock; right column
internal scroll; status bar pinned.
H8b right-panel 2x2 tab switcher (Summary / All possible steps /
Solution path / Active Cell) with Hodoku-style blue active bar.
H8c hints dock refinements under grid (heights/borders) if needed after H8b.
H9 chain/link arrows overlay: solid red = strong link, dashed red = weak link
(refs: Hodoku2 Draw Links, SudokuPanel drawing); solution-path band colors
(green/yellow/orange by technique class).
H10 round glossy toolbar buttons (yellow ?/? green ! orange check red X);
blue status bar with palette segments + R; coloring palette wiring
(COLORING_COLORS 12, primary/secondary swatches, R reset, mode radios).
Decisions locked at H8a: desktop fixed frame no scroll; phone scroll + tabs;
selection stays ring-only (no #FFFF96 fill).
Optional: favicon app/icon.svg from logo.

## 9. Logo
New-game button: inline SVG viewBox 32, full-bleed 3x3 grid lines #C7CCD1 plus
X strokes indigo #4F46E5 and coral #E8604C, round caps, in MenuBar.
Chosen from concepts A/D/J family (X-Wing identity). Favicon not yet done.
