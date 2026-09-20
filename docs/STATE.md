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
- Every pasted block starts with cd ~/xoku; never assume the cwd.

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

## 5. Milestones (auto-regen from git log; newest first)
- H20i path XR polish + H21 Frankin fish (X-Wing + Swordfish); v14.3-h21
- H20h2: wing filters use FILTER_BG (#B9FFB9), same shade as digit filter; v14.3-h20h2
- H20h1: wing filters highlight matching cells green (digit-filter language); v14.3-h20h1
- H20h: Mode-menu wing filters (X/XY/XYZ/WXYZ dimming); v14.3-h20h
- H20g2: fluid chip sizing (clamp) fixes iPad-landscape squish; v14.3-h20g2
- H20g1: Reset candidates, Solution count, Savepoints (Hodoku borrowings); v14.3-h20g1
- H20g: View/File menu toggles, Copy 729, puzzle readout panel; v14.3-h20g
- H20f7: content-proof square frame for projections; slot-scaled chips; v14.3-h20f7
- H20f6: height budget + no desktop scrollbar + Arial 900 axis titles; v14.3-h20f6
- H20f5: invariant view frame, bold axis titles, bare arrowhead selector, mobile chip scale; v14.3-h20f5
- H20f4: custom reverse-caret dropdown in grid corner; board size invariant; v14.3-h20f4
- chore: sync version tag to v14.3-h20f3
- H20f3: projection panels match RC board footprint (aspect-square cells)
- H20f2: projection rows h-14 (chips no longer squished)
- H20f1: native vantage select (clone spec) + panel lattice; v14.3-h20f1
- H20f: StormDoku2 projection parity (RC/RN/CN/BN + caret dropdown); v14.3-h20f
- H20e: CN/BN v2 (StormDoku chips, box borders, centered tab stack)
- H20d+H15e: RC/CN/BN projection panels + 4-node ring correctness; v14.3-h20d
- H20a: gutter rebuild with COL/ROWS titles and stretch alignment; v14.3-h20a
- H20: Draw Links radio + overlay gate, RC gutters, import polish; v14.3-h20
- H19: port Empty Rectangle (verified), Avoidable Rectangle, WXYZ-Wing; v14.3-h19
- H18b: ALS_RCC record with C-subset + AHS duality; v14.3-h18b
- H18a1: finned/sashimi reason lines report body corners and missing corners
- H18a: Sue de Coq (ALS DOF family); Death Blossom recategorized; v14.3-h18a
- docs: README rewrite — unified engine, StrmCkr ladder, credits
- H17: finned + sashimi fish lens (K>0 base/cover arithmetic); v14.3-h17
- H15d: Type 3 rings on findAic (X-Chain/AIC rings with +0.5); v14.3-h15d
- H16c+H15c: levelOfRating via XR_BAND; Type 3 XY rings with +0.5; v14.3-h15c
- H16b: idle-prop drives empty combo, latch effect guarded; v14.3-h16b
- H16b: idle-prop drives empty combo display (Hodoku posture); v14.3-h16b
- H16a: dropdown empty until difficulty chosen; Grid X disabled while idle; v14.3-h16a
- H16: Hodoku-style fresh launch (empty all-candidates board, idle status); v14.3-h16
- H15b2: complete StrmCkr score alignment (literals + templates); v14.3-h15b2
- H15b2: name-anchored score alignment to StrmCkr ladder; v14.3-h15b2
- H15b: singleDigitChains uses naming table (V/L tagging); v14.3-h15b
- H15a: StrmCkr declarative naming table & chain taxonomy; v14.3-h15a
- H14a: fix cluesTarget/maxAttempts/band destructuring for 14-tier ladder
- H14: StrmCkr 14-tier ladder rewire (Extremely Easy → Nightmare); v14.3-h14
- H13: remove AIC with ALS nodes (StrmCkr chain-first philosophy); v14.3-h13
- H12: remove obsolete Turbot Fish + Simple Colors (StrmCkr subsumption); v14.3-h12
- H11d: logo new-game uses MenuBar local chosen difficulty; v14.3-h11d
- H11c: commit missed page.tsx level prop (CI TS2741); v14.3-h11c
- H11b: wordmark replaces plain H1 in README; v14.3-h11b
- H11a: theme-aware wordmark (picture + dark variant); v14.3-h11a
- H11: brand identity - Grid X mark + woven-X wordmark + favicon; v14.3-h11
- H10m: XYZ-Wing colors only, no link arrows; v14.3-h10m
- H10l: blue status bar with palette segments (Hodoku format); visual parity complete; v14.3-h10l
- H10k: restore xy filter button with f_xyc.png (swallowed by H10j surgery); v14.3-h10k
- H10j: Hodoku digit icons + neutral pressed bevel + equal-arm swap arrow; v14.3-h10j
- H10i: clone-exact coloring geometry + toolbar sizing/pressed bevel; v14.3-h10i
- H10h: fix manualColors key collision; permanent hint scrollbar; R well; arrow aspect; v14.3-h10h
- H10g: swap arrow pinned clear of both swatches; v14.3-h10g
- H10f: full-width hints dock under both columns; centered grids + indented palette; arrow air; v14.3-h10f
- H10e: XYZ-Wing magenta both Set B cells + 3-link chain; R = reset.png; one left margin; v14.3-h10e
- H10c+d: arrows (Hodoku exact) + R/swap notch + XYZ-Wing magenta/links; v14.3-h10d
- H10b: scaled arrowheads with short-link guard + R/swap notch placement; v14.3-h10b
- H10a: link arrows retrofit (arrowheads at chain/fish endpoints, Hodoku geometry); v14.3-h10a
- H9d: hoist Panel/TitleBar to module scope (fixes 1s-timer remount scroll reset); v14.3-h9d
- H9c: contained fixed-height list scrollers (phone scroll fix) + coloring spacing; v14.3-h9c
- H9b: Summary stats table + scroll regions + Find all steps/Add to solution; v14.3-h9b
- H9a: ship manual paint hex fix (missed by H9 commit); v14.3-h9a
- H9: solution path parity - notation rows, XR band tints, click-to-hint; v14.3-h9
- H8k: real Hodoku PNG hint cluster after xy + swap/eye icons; STATE; v14.3-h8k
- H8j: manual paints via inline styles (fix invisible colors); Swing bevel R/eye; v14.3-h8j
- H8i: grey blended right panel + working color modes (no accidental paint); v14.3-h8i
- H8h: coloring widget Hodoku geometry (overlap pair, arrow, R, radios, palette+eye); compact value squares; v14.3-h8h
- H8g: coloring widget parity (12 Hodoku colors, pair view, R, eye); STATE; v14.3-h8g
- H8f: Set Value/Exclude as Hodoku gray squares with per-digit availability; STATE locks difficulty-band path colors; v14.3-h8f
- H8e: all-steps list uses panel scroller (fix touch snap-back); STATE renumber; v14.3-h8e
- H8d: right-panel 2x2 tab switcher with blue active bar (Hodoku parity); STATE; v14.3-h8d
- H8c: main-row sizing - desktop board fill + mobile x-axis pan; STATE; v14.3-h8c
- H8b: unlock phone scrolling (height lock was lg-only intent); STATE renumber; v14.3-h8b
- H8a: app shell frame (fixed desktop viewport, dock under grid, pinned status bar); STATE rescope + v14.3-h8a
- H7: hint UI complete (vague/concrete toolbar + dock Solve up to/Cancel); STATE + v14.3-h8
- docs: STATE.md resume doc (workflow rules, coloring system, queue)
- version: v14.3-h7j (checkpoint: H7j fuchsia+maroon)
- ALS slots: fuchsia #FF00FF + maroon #800000; elim stays red-500 (H7j)
- version: v14.3-h7i (checkpoint: H7i copper)
- ALS member slot 4: cyan -> copper #B87333 (no blue clash) (H7i)
- version: v14.3-h7h (checkpoint: H7h spine order)
- fix ALS-XY-Wing pivot-middle spine order; XYZ-Wing true 6-dot spine (H7h)
- vibrant per-ALS member colors (orange/violet/cyan/magenta); fix stuck version tag (H7g)
- SudokuGrid: HINT_COLORS 6-slot + MANUAL_COLORS, nc %6 (H7f)
- ALS emitters: blue/green spine per set + per-ALS member pastels (H7e)
- SudokuGrid: Hodoku palette - CHAIN(blue/green) + ALS(4 pastels) by category (H7d)
- SudokuGrid: hint colors match Hodoku palette (ALS 4-color, eliminations #FF7684) (H7d)
- SudokuGrid: hint dots flat (drop white ring) to match Hodoku fillOval (H7c)
- version: v14.3-h7b (checkpoint: H7b candidate-only hints)
- hints candidate-only: placements+patternCands render as dots, delete cell tints (H7b)
- version: v14.3-h7a (checkpoint: H7a candidate-only hints)
- candidate-only technique highlighting: ALS/Wing emitters use candColors for working digit; delete cell-tint branch (H7a)
- version: v14.3-h6n (checkpoint: H6n logo full-bleed)
- MenuBar: logo full-bleed - drop slate frame, grid+X to edges (H6n)
- version: v14.3-h6m (checkpoint: H6m logo D)
- MenuBar: new-game glyph = X-Wing two-tone X on nonet (logo D) (H6m)
- version: v14.3-h6l (checkpoint: H6k filter toggle working)
- fix duplicate filterMode prop + Next.js 16 LayoutProps type (H6k fix)
- version: v14.3-h6k (checkpoint: H6k filter toggle)
- wire swatch as red/green filter-mode toggle; pink offset 4px (H6k)
- version: v14.3-h6j (checkpoint: H6j level names + menu cleanup)
- MenuBar: drop New prefix from combo; remove difficulty entries from File menu (H6j)
- version: v14.3-h6i (checkpoint: H6h logo + H6i levels)
- rename difficulty bands to Stormdoku2 ladder: Moderate/Brutal/Nightmare (H6i)
- MenuBar: logo icon second red strand + blue candidate dots; swatch pink offset 3px (H6h)
- version: v14.3-h6g (checkpoint: H6g new-game + shadow)
- MenuBar: new-game logo button + choose-only level combo (H6g)
- MenuBar: digit drip shadow dark, not white halo (H6g)
- version: v14.3-h6f (checkpoint: H6e clear removed + H6f chrome)
- MenuBar: drop clear button - digit re-click toggles filter off (H6e); swatch offset shadow + beveled combo (H6f)
- version: v14.3-h6d (checkpoint: H6d emboss)
- MenuBar: embossed drip-shadow digits+xy like Hodoku toolbar (H6d)
- version: v14.3-h6c (checkpoint: H6c menus+ring)
- MenuBar: menus wrap not scroll (H6c); SudokuGrid: active cell ring 3px
- version: v14.3-h6b (checkpoint: H6b nav strips)
- MenuBar: restore row-1 close; menu bar white+scroll, toolbar gray wrap (H6b)
- version: v14.3-h6 (checkpoint: H6 status bar)
- page: status bar to Hodoku light-gray chrome with level-colored dot (H6)
- version: v14.3-h5 (checkpoint: H5 toolbar)
- MenuBar: digits+xy+swatch onto toolbar row 2 (H5); SudokuGrid: active cell border-only (H3b)
- version: v14.3-h4d (checkpoint: H3b border-only active cell)
- SudokuGrid: active cell border-only - thick yellow rectangle, no fill (H3b)
- version: v14.3-h4c (checkpoint: H4c smooth arrows)
- MenuBar: undo/redo as antialiased PNG masks (smooth curves, tintable) (H4c)
- version: v14.3-h4b (checkpoint: H4b fat arrows)
- MenuBar: undo/redo icons traced from Hodoku 32x32 silhouettes (H4b)
- version: v14.3-h4 (checkpoint: H1-H4)
- MenuBar: bare Hodoku undo/redo icons - blue undo, green redo, gray disabled (H4)
- SudokuGrid: candidates #646464, active cell solid #FFFF96 + bright yellow ring (H2b+H3)
- SudokuGrid: user-entered values blue #0000FF (H2a)
- version: v14.3-h1 (checkpoint: queue a + H1)
- SudokuGrid: Hodoku grid lines - black outer/box, #C0C0C0 inner (H1)
- MenuBar: strip digits to w-7 h-8 text-base, drop font-serif (queue a)
- MenuBar: old undo/redo removed from digit strip
- Active cell: yellow outline coexisting with highlights; menu cleanup; lilac undo/redo; bigger digits
- HoDoKu fixes: thick active-cell outline; toolbar row 2 with big undo/redo + difficulty select
- HoDoKu layout: four zones, wide panel, titled sections, bottom hints block, solution path panel
- HoDoKu layout: four zones, bottom Hints block with Next Hint/Execute, Summary/Active Cell/Set Value/Exclude/Coloring/Solution path panel, their status bar format
- Chain lens certified: digit-scoped guards + audit (sound AND complete); cross-T2 restored, 111 chains green
- NAND discipline: membership guards on both weak-hop directions (cand->set, set->cand); audit v3 green at 908+
- Engine fix (set digits from tables) + soundness audit v2 with per-ending validation
- Stage 1a: chain lens - master engine, parity-verified additive registration
- Stage 0: foundation - slice tables with ERi tags, Move record, rule table seed, notation rulings, census harness
- Notation wave 2: wings, remote pair, skyscraper/kite/turbot in chain grammar
- Eliminations: red circle only, strikethrough removed
- Fold hierarchy: bivalue pairs dual-natured (parity picks the face); trivalue+ pairs weak-only; strong folds throw on invalid chains
- Dual-natured folds: connector by chain role (parity), not cell nature; weak passages fold as (4 - 5)r3c5
- Fold truth: bivalue cells render = only when genuinely strong, - when serving as passage
- Notation complete: (d)cell nodes, folded bivalues, => conclusions across all chain engines
- Notation wave 1 + ALS chain grammar with enforced continuity
- Wings: XY single-chain parity, W-Wing 6-node orientation-aware chain, XYZ two-ALS tints
- Wings final: XY 2-branch chain colors, W-Wing full 6-node chain, XYZ 2-tint sets
- XY-Chain: role-based blue/green coloring derived from off/on walk; links join opposite colors
- Wing taxonomy final: XY-Wing chain dress (both branches), XYZ-Wing ALS tints
- Turbot walk fx-x-y-fy; XY-Chain flat emitter; wing colors (XY/XYZ tint sets, W-Wing alternating)
- Chain parity: blue-first convention for turbot + XY-Chain coloring, rebuilt walks
- Curved offset links; node contrast (darker fills + white ring); dedupe XY-Chain links
- Fix menu dropdowns (unclip header row); exclude build output from tsc
- Background puzzle generation (web worker) + main-thread fallback
- Single header row: menus, undo/redo, digit strip (two-part paste)
- Digit strip: inline HoDoKu keyboard style (brace-walk replacement)
- HoDoKu-style menu bar: no title, light bar, toolbar undo/redo icons with redo stack; smaller top digits
- Turbot family: color/link emission follows chain walk order; restore remote-pair circles
- Palette: red replaces amber, ringed to distinguish from eliminations
- Fix selection (guard stopPropagation); palette orange -> amber, red reserved for eliminations
- Candidate coloring (HoDoKu-style circles) + single-line digit row
- Fix paintCell scope: extract from undo() body to component scope
- Top-row digits: drop counts, larger glyph
- Premium bare-style buttons: digit over count, no borders (HoDoKu keyboard look)
- Superscript x: larger (13px) with proper spacing
- Bivalue button: HoDoKu-style superscript x before y
- v14.2: arrow contrast (thick solid vs thin dashed), XY-Chain link fix, build tag, error instrumentation
- Weak-link arrows red (matching strong), thinner dashed stroke
- v14: arrows for all chain families, red weak links, rich fields re-applied cleanly
- Fix: rich-highlight fields placed in xyChain/remotePairs (anchor bug)
- Rich highlighting: ALS set colors, chain circles, strong/weak arrows; UI polish (x^y)
- AIC with ALS nodes (XR 7.6)
- AIC Types 1/2 (cross-elimination ending merged into Type 2)
- AIC engine: X-Chain, AIC Type 1/2 (XR 5.8-6.4)
- ALS-XY-Wing, ALS Chain, Death Blossom (XR 7.2-7.6)
- UR types 2-5 + BUG Lite (XR 3.4-4.0)
- GitHub Pages: auto-deploy workflow + basePath
- ALS-XZ (XR 7.0): Diabolical is now reachable
- Xoku v1: HoDoKu-style Sudoku trainer, 25 techniques, XR ratings, BUG+n, candidate highlight row, port 3002

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

## 8. Queue (hand-maintained; owner defines next)
- TBD: H22 not yet defined.
- Maintenance: run python3 docs/regen_state.py each session;
  never hand-edit section 5. Sections 1-4, 6-9 hand-written.

## 9. Logo
New-game button: inline SVG viewBox 32, full-bleed 3x3 grid lines #C7CCD1 plus
X strokes indigo #4F46E5 and coral #E8604C, round caps, in MenuBar.
Chosen from concepts A/D/J family (X-Wing identity). Favicon + launcher shipped at H11.

## 6b. External references and authorities
- StrmCkr: person. 20+ year Sudoku-forum contributor; collaborated with
  hobiwan (late Hodoku developer) and peers who shaped modern technique
  theory. Author of StormDoku and StormDoku2 (web trainer; human-play
  parity with Hodoku added recently). His directives are xoku engine
  authority: chain-first philosophy (H13), 14-tier ladder (H14),
  declarative naming table + V/L tagging (H15a/b), score alignment (H15b2).
- V/L tagging: StrmCkr's strong/weak link labeling scheme. Exact semantics
  live in the techniques.ts naming table; source forum messages are NOT in
  assistant context — owner re-pastes on demand (consider docs/strmckr.md).
- Reference clones: /tmp/hodoku-src (PseudoFish Hodoku, HEAD c37fe90),
  /tmp/hodoku2-src (wyzelli Hodoku2), StormDoku2 source: ~/refs/stormdoku (canonical); /tmp/stormdoku (git clone).
- Copy 729 (H20g) = 729-char candidate-grid string.

## 10. Projection reading discipline (owner insight, verified at H21)
- RN cell (row,digit) = column list; CN (col,digit) = row list;
  BN (box,digit) = mini-cell list; RC = board.
- Fish ARE subsets in projection space: row-base fish on d = naked subset
  among row slots in RN digit-column d (X-Wing = naked pair, Swordfish =
  triple, Jellyfish = quad). Column-base fish = hidden subset in RN
  (columns confined to N row slots), naked in CN. Mirror in CN.
  Franken/mutant close only in BN (box covers become contained slots).
- Finned = almost-subset with one extra mark (fin); sashimi = base slot
  missing one mark (gap); eliminations must peer the fin/gap witness.
- Discipline: run the subset eye down each digit column of RN, CN, BN;
  the panel where closure happens names the fish class.
H22 (v14.3-h22): PALETTE REWORK — manual swatches rebuilt for ALS marking
without colliding with chain-link colors: firebrick B22222 (eliminations),
saddle 8B4513, olive 808000, indigo 4B0082, slate 708090 replace the
teal/mint/green/pale-green/cyan swatches that masqueraded as links;
chain-link blue deepened to royal #4169E4 with white text (green #3FDA65
kept); status-bar six-swatch indicator updated to match. Saved color
indices now map to the new hues by position.
H22a (v14.3-h22a): SWAP-ARROW ELBOW CURVED — the palette swap glyph's
sharp 90-degree bend (M6 6 H14 V14) replaced with a quadratic sweep
(M6 6 H11 Q14 6 14 9 V14, round linecap); arrowheads and endpoints
unchanged, position identical. Revert key: /tmp/ColorPalette.bak-h22.
