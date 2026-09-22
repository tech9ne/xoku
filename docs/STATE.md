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
- STATE: competent part 3 - M3/L1/L2/L3/H1 wing structures + vectors, digit-flow naming rule
- STATE: competent part 2 - exact ERI/W-Wing vectors, S-Wing + M(2)-Wing structures, location-link notation
- STATE: competent-level terminology contract (mini-sectors, ERI bounds, wing structures) + V-COMP vectors
- STATE: adopt strmCkr r/sudoku wiki intermediate terminology as naming/geometry contract + V-INT vectors
- H36g: size-1 ALS registration, union elims, XZ-family guard, sound tryAlsElims
- H36d: ALS modular views with locked-set eliminations
- H36f: ALS-key soundness fixes in decoders + audit v5 skip
- H36c: ALS chain naming + rendering in chainLens
- H36b3: ALS weak links + chain walker consumption
- H36b2: intra-ALS strong links (inclusive-OR on digit pairs)
- H36b1: ALS node registration in chain tables (cycle noted)
- H36a: ERI geometry detection with rich metadata (intersection/active/linked cells)
- docs: provenance credit + rewrite ledger (H35a)
- docs: regen section 5 from git log; header the H22-H34 narrative appendix
- H34: Remote Pair + Hidden Remote Pair + chain scores per StormDoku chainMathScore; v14.3-h34
- H33: type1/type2 ring closures routed through StormDoku classifier; v14.3-h33
- H32: StormDoku classifier ported (steps=strong links, V/L grammar); v14.3-h32
- H31b: L(1)-Ring score 5.5 (Irritating), reason de-duplicated; v14.3-h31b
- H31: StormDoku name translations slice 1 (honest minimum); v14.3-h31
- H30b: dead uniqueness finder bodies deleted; v14.3-h30b
- STATE: record H27-H30 entries (cannibalism, parity painting, StormDoku adoption, uniqueness removal)
- H30: uniqueness family removed from engine and names (mirror StrmCkr); v14.3-h30
- H29: degenerate ring rejection + generation tier discipline (StormDoku port); v14.3-h29
- H28: StormDoku adopted as engine Bible (face=Hodoku, engine=StormDoku); v14.3-h28
- H27e: W-Wing whole-cell parity; v14.3-h27e
- H27e: W-Wing whole-cell parity; v14.3-h27e
- H27d: XY-Wing / XYZ-Wing whole-cell parity; v14.3-h27d
- H27c: whole-ALS parity painting; v14.3-h27c
- H27b: Remote Pair parity-pair elims, ring rename, alternation; v14.3-h27b
- H27: ring cannibalism unblocked; master ledger opened; v14.3-h27
- H26: ring closure, palette decollide, WXYZ absorption into ALS-XZ; v14.3-h26
- H25: ring closure on entry digit, true closing edge, findAllSteps dedupe; v14.3-h25
- H24: tier truth (status bar and dropdown sync to measured rating); v14.3-h24
- H23c: XY-ring soundness (bivalue-only nodes, true weak links); v14.3-h23c
- H23b: ring coloring per node (alternation restored, bystanders uncolored); v14.3-h23b
- H23: engine audit (no blanks, presence checks, alternation); v14.3-h23
- H22e: palette final form (violet/turquoise/hot pink succeed lavender/mist/yellow-orange); v14.3-h22e
- H22d: palette unification (Hodoku chain trio, final twelve); v14.3-h22d
- H22c: palette back to twelve (orangered/silver/charcoal replace removals); v14.3-h22c
- H22b: palette final nine (pinks/earthies/slate out, green back, cobalt in); v14.3-h22b
- H22a: swap-arrow elbow curved (quadratic bend, same position); v14.3-h22a
- H22: palette rework (firebrick elim red, royal chain blue, ALS-safe swatches); v14.3-h22
- docs: projection reading discipline - fish = subsets in RN/CN/BN (owner insight)
- docs: strmckr.md - V/L tagging, AHS XOR structures, fishing guide, AIC 101, XOR gate formation
- docs: strmckr.md - ERi hyper-XOR, AIC XOR/NAND chain theorem, ALS DOF/RCC rules
- docs: STATE.md 6b - StormDoku2 path corrected to ~/refs/stormdoku
- docs: STATE.md 6b - StrmCkr authority + reference clone paths
- docs: STATE.md 6b - StrmCkr/StormDoku2 authority + reference clones
- docs: STATE.md section 5 auto-regen from git log; queue reset; favicon note fixed
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
## 11. Milestone notes H22-H34 (narrative, hand-maintained)
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
H22b (v14.3-h22b): PALETTE FINAL NINE per user — pinks (F7A5A7, FFD2D2),
earthies (8B4513, 808000) and ambiguous slate (708090) removed; bright
green 86F280 restored; cobalt 1E4BE8 (shade from user's upload-button
photo) added. Final: FFC059, F7DE8F, B1A5F3, DCD4FC, B22222, 86F280,
1E4BE8, 4B0082, FFFF00. Removed hues recoverable in one line if missed.
H22c (v14.3-h22c): PALETTE BACK TO TWELVE — H22b broke the replace-every-
removal rule (5 out, 2 in); now orangered FF4500 (vibrant), silver C0C0C0
and charcoal 333333 (neutrals, out of blue/green's way) fill the vacated
slots. Final twelve: FFC059, F7DE8F, B1A5F3, DCD4FC, B22222, FF4500,
86F280, 1E4BE8, 4B0082, FFFF00, C0C0C0, 333333. Cobalt and green kept;
pinks and earthies remain retired with replacements in place.

H27 (v14.3-h27): CANNIBALISM UNBLOCKED — ring eliminations no longer skip
in-ring cells; doctrinally legal cannibalistic eliminations (Hodoku's
continuous-loop and AIC examples eliminate chain members) now fire.
H27b (v14.3-h27b): REMOTE PAIR + RING RENAME — eliminates from any
opposite-polarity pair along the chain (not just ends); same-pair cycles
renamed from "Remote Pair - ring" to "Continuous Nice Loop"; alternation
candColors 0/1 added.
H27c (v14.3-h27c): WHOLE-ALS PARITY — ALS-XY-Wing and ALS-Chain paint
every candidate in each ALS node with its parity color (0/1), not split
link digits from body; each ALS is one node.
H27d (v14.3-h27d): XY/XYZ-WING WHOLE-CELL PARITY — each cell one node,
all its candidates painted with the cell's parity color.
H27e (v14.3-h27e): W-WING WHOLE-CELL PARITY — bivalue wings painted
whole-cell (0/1); bridge nodes (t1, t2) painted single-digit on d with
alternating parity.
H28 (v14.3-h28): STORMDOKU ADOPTED AS ENGINE BIBLE — cloned StrmCkr's
StormDoku webpage demo to ~/stormdoku (GPL-3.0-or-later; tech9ne listed
contributor). Decree: face=Hodoku (names, pedagogy, display), engine=
StormDoku (chain walker, five strong-link buckets BILOCAL/CELL_TO_GROUP/
GROUP_TO_GROUP/ERI/ALS, ALS/AHS DOF+FOX, NxN+K fish, 18-tier rating
ladder, generation discipline). Every future fix cross-checks ~/stormdoku
sources first. Ported code carries GPL-3.0-or-later obligations; LICENSE
decision queued with port.
H29 (v14.3-h29): DEGENERATE RING + GENERATION TIER — ring finder requires
>=3 distinct cells (2 cells = naked pair, not a ring; StormDoku chain.ts:
258-259 isRing/isTerminal distinction). Generator returns {failed: true,
attempts, level} when no candidate matches the requested XR band; worker
handler and both main-thread fallbacks keep current game unchanged and
warn (StormDoku index.html:13354 discipline).
H30 (v14.3-h30): UNIQUENESS FAMILY REMOVED — bugPlus1/2/3, bugLite,
uniqueRectangle1, urType2/3/4 withdrawn from FINDERS and their names
from TECHNIQUE_NAMES; band comments cleaned. Decree: StrmCkr's manifesto
carries no uniqueness technique and his engine proves without the unique-
solution assumption; xoku mirrors his engine and taxonomy. U-ledger rows
(G8, Type 6, Hidden/Avoidable Rectangles) cancelled. Import-time
countSolutions===1 validity check retained. Dead finder bodies still
present in techniques.ts; H30b deletes them.
H31 queued: port classifyChain (chain.ts:2207) with V/L pattern grammar
and name literals (XY-Wing, W-Wing, S-Wing, H(n)-Wing, M(n)-Wing,
L(n)-Wing/Ring, W-Ring, Y-Ring, H(2)-Ring, M(2)-Ring, Strong-Ring,
AIC Ring, Transport, T-ALS-XZ/XY, inverted i*-names; WEAK_TYPE_NAMES
LOCAL/SECTOR).
H30b (v14.3-h30b): DEAD UNIQUENESS BODIES DELETED — uniqueRectangle1,
findBug (bugPlus1/2/3), urType2/3/4, bugLite function definitions
removed from techniques.ts (lines 513-539, 611-694, 896-1117). The
uniqueness family is now completely gone from the engine; only the
import-time countSolutions===1 validity check remains.
H31 (v14.3-h31): STORMDOKU NAME TRANSLATIONS SLICE 1 — honest minimum
port: translate existing findAic technique strings to StormDoku names
where mapping is unambiguous. "AIC Type 1" / "AIC Type 2" → "AIC" (his
taxonomy collapses both). "X-Chain - ring" → "L(1)-Ring" at score 6.0
(5.5 + 0.5 ring bonus). "XY-Ring" → "AIC Ring". Deferred to H32+: full
V/L pattern grammar classifier requires understanding StormDoku's
chain-builder node-merging rules (PublicChainStep merges bridge cells
into single 'L' nodes); porting the grammar honestly requires studying
his chain.ts builder first. This slice renames without changing
detection logic.
H31b (v14.3-h31b): L(1)-RING SCORE CORRECTED TO 5.5 — the +0.5 ring
modifier replaces the open-chain premium per StormDoku's score equation
("base + length excess + unique-digit excess + Open 0.25 or Ring 0.5"),
it does not stack on the old 5.5 ring score. 5.0 base + 0.5 = 5.5 lands
in Irritating [5.0,6.0), matching the Bible's ladder (X-Chains above
four nodes, ring forms +0.5). User board-verified: the digit-7 closed
loop eliminating r6c3/r6c4 sits under Irritating. Reason string
de-duplicated to "L(1)-Ring: closed loop on digit N => ...".
H32 (v14.3-h32): STORMDOKU CLASSIFIER PORTED — lib/sudoku/storm-names.ts
adapts findAic paths to StormDoku steps (steps = strong-link nodes: V =
bivalve cell linkType 4, L = bilocation linkType 0; weak edges LOCAL/S or
SECTOR/C per WEAK_TYPE_NAMES chain.ts:10) and ports classifyChain
(chain.ts:2207-2279): ring grammar (Y-Ring, W-Ring, H(2)-Ring, M(2)-Ring,
Strong-Ring, L(n)-Ring, AIC Ring), inverted families (iW-Wing, iS-Wing,
iM3-Wing, iH2-Wing, iH3-Wing, iW-Ring per chain.ts:2079-2124), open
grammar (Skyscraper, 2-String Kite, X-Chain, XY-Wing, W-Wing, H(n)-Wing,
M(n)-Wing, L(n)-Wing, XY-Chain, AIC). Wired at findAic's ring/xchain/
AIC sites. Inert in xoku: ERI/grouped/ALS branches (no linkType 1/2/3 or
ALS steps yet) - they activate when H33 ports the five strong-link
buckets. Guards hasWRingValueNodes/isSplitWingRing/isBivalveSplitWing
deferred (chain.ts:2040/2198/2188).
H34 (v14.3-h34): REMOTE PAIR RE-EARNED FROM STORMDOKU — predicate ported
(index.html:10388): every node bivalue with the same two candidates (the
user doctrine: an even number of cells carrying the same two candidates).
Score now via chainMathScore(5, chain, 4, 2) = 5 + lengthExcess +
digitExcess + 0.25 open / 0.5 ring, replacing chain-engine's bare
xr-4.0 shortcut that bypassed naming-table minNodes:4. Name survives at
two cells (Bible does); the Irritating row label "above four nodes"
(index.html:8446) is display-only. XY-Wing (3,3,3 -> 3.25) and XY-Chain
(5,4,2) scores ported on the same curve. Hidden Remote Pair branch
ported (index.html:10402-10428): bilocation strong links alternating on
two digits. chainLens classify now speaks StormDoku for all bivalue and
hidden-pair chain shapes.

H36a (v14.3-h36a): ERI GEOMETRY DETECTION — replaced boolean eriTag with
rich eriGeometry metadata in slices.ts; detectERI algorithm ported from
StormDoku strong-link.ts eriGeometries (4-5 candidate box rule, empty
rectangle validation, active/linked cell split); chain-tables.ts updated
to consume new geometry field. ERI now provides intersectionCell,
activeCells, linkedCells for directional row↔column swapping in chains.

H36b1 (v14.3-h36b1): ALS NODE REGISTRATION — ChainTables gains alsNodes
(alsIndex, digit, nodeKey = 3000+alsIndex*10+digit, cells); enumerateAls
exported from techniques.ts (creates techniques<->chain-tables cycle:
function-level only, runtime-safe, accepted consciously). Nodes carry no
links yet; H36b2 adds intra-ALS strong links, H36b3 RCC weak links.

H36b2 (v14.3-h36b2): INTRA-ALS STRONG LINKS - every digit pair within an
ALS (size >= 2) registered as a strong link between P(i,d) nodes
(inclusive-OR ruling per section 4; exactly-one-absent makes two absents
impossible). Size-1 ALS skipped: bivalue cand nodes already carry the pair.
Walker consumption (cellsOf / onPathNode / weakFrom ALS cases) lands H36b3.

H36b3 (v14.3-h36b3): ALS WEAK LINKS + WALKER CONSUMPTION — alsWeak map
precomputed in chain-tables (candidate-ALS where candidate sees all
d-cells; ALS-ALS RCC where all d-cells peer); chain-engine updated:
cellsOf/onPathNode handle ALS keys, weakFrom returns precomputed weaks,
tryEnding T2 rejects ALS endpoints. Walker now traverses ALS paths;
classifier naming lands H36c.

H36c (v14.3-h36c): ALS CHAIN NAMING + RENDERING — chainLens (master
engine) now names paths containing >=2 distinct ALS nodes as ALS-XZ (2),
ALS-XY-Wing (3), ALS-Chain (>3) with score 6.0+0.3*n; patternCells/
patternCands render ALS member cells; links skip ALS endpoints (drawn as
set-like nodes). Local classify retained for non-ALS paths. StormDoku
modular ALS grammar (chain.ts:486-690) deferred to H36d.

H36f (v14.3-h36f): ALS-KEY SOUNDNESS FIXES — isSetKey(k)=k>=1000 also
matches ALS keys (>=3000), so six decode sites indexed t.sets[k-1000]
out of range. Fixed: weakFrom early-returns alsWeak; tryEnding sd/ed use
ALS-safe digOfNode; T1 on-path loop delegates to onPathNode; local
classify bails to AIC on ALS paths; renderNotation emits ALS(...) tokens.
Audit v5 updated to skip ALS paths (different endpoint semantics).
Result: SOUNDNESS OK - 111 chains audited; ALS paths confirmed firing
(56/99 on probe puzzle, alternating ALS->RCC->ALS structure intact).

H36d (v14.3-h36d): ALS MODULAR VIEWS — computeLockedSet helper added to
chain-tables; alsModularViews map populated during ALS-ALS RCC construction
(tracking LS_L/LS_R locked digits that share a unit); tryAlsElims function
added to chain-engine that eliminates candidates seeing both locked sets
for shared digits; chainLens names paths with modular views as
"ALS-XZ (Modular)" / "ALS-XY-Wing (Modular)" with score +1.0. Note: this
causes chain count explosion (~100 → ~15k) as the ALS-XZ elimination
space is much larger than T1/T2 endpoints. Audit v5 skips ALS paths
(soundness intact at 111 chains). Future optimization: prune non-modular
ALS paths early.

H36g (v14.3-h36g): NAME-PARITY + SOUNDNESS SCOPE — size-1 ALS (bivalue
cells) registered as ALS nodes (StormDoku buildCellAlsLink parity), so
doubly-linked ALS-XZ is expressible as a 2-ALS path; chainLens names it
"ALS-XZ (doubly linked)" and emits the full union elim set (T1 endpoint
elims UNION RCC-victim elims; both independent theorems). tryAlsElims
restricted to exactly 2 distinct ALS indices: RCC-victim elims are
licensed only in the XZ family; longer ALS chains eliminate via endpoint
digits only (alsChain semantics). renderNotation prints size-1 ALS as
plain candidate. Supersedes H36e superset logic.
H36g2: tryAlsElims soundness rewrite — standard Z-elims (non-restricted
common digits) added; X/RCC-digit and locked-set elims gated on
doubly-linked (second restricted common); record key endpoint-normalized
(kills cand-node vs ALS-key representation duplicates). Folds uncommitted
H36e/H36f experiments; tags skip e/f by design.

## Terminology contract — strmCkr r/sudoku wiki (Intermediate Level)
Adopted as naming + geometry parity reference for the V-phase and all
future technique work. Source: reddit.com/r/sudoku/wiki intermediate
chaining page, author strmCkr (StormDoku). Further sections
(Competent level etc.) appended here on receipt.

Gates: strong link = bidirectional XOR over two sector truths,
(#)(A = B), exactly one true (bilocation, bivalve, grouped).
Weak inference = NAND between nodes: at most one true, both may be
false; bidirectional check. Notation: "=" strong, "-" weak,
"=>" implies, "<>" eliminate.

AIC types: T1 same value(s) at first/last => eliminate from peers of
start & end. T2 different values, ends peer each other => exclude the
opposite value. T3 Ring: start & end weak-inferenced; every node part
acts as start/end; apply T1+T2 a second round; strongest class.

Pattern geometry contract:
- X-Wing: technically a ring; two same-cand strongs in rows or cols;
  four valid weak constructions.
- Skyscraper: two same-cand strongs, nodes 2x Row || 2x Col (parallel
  strongs in two houses joined by a base weak link).
- Two-String Kite: two same-cand strongs, one row + one col, joined by
  one weak; strongs built 1 Row, 1 Col.
- Remote Pair: bivalue-only AIC, same two digits; eliminates BOTH
  digits from peers of start/end cells.
- XY-Wing: three bivalue strongs + two weak inferences.
- X-Chain: single-candidate AIC. XY-Chain: bivalue-only AIC.

Golden test vectors (wiki examples; V2 regression set):
V-INT-1 X-Ring: P=..47.5...29....15..5891....52.49861....5.1...9.1.3..85..2856931..9...546..51498..
  (7)(r2c3=r2c9-r4c9=r4c3-r2c3) => r3c9,r5c9,r9c9,r5c3<>7
V-INT-2 Skyscraper: same P => (6)(r5c3=r2c3-r2c4=r6c4) => r5c5,r6c2<>6
V-INT-3 2-String Kite: same P => (6)(r2c3=r5c3-r6c2=r6c4) => r2c4<>6
V-INT-4 Remote Pair: P=16.3.825.83.256..152.91.3682567931849714856324836219753958.2.1661253.8..748169523
  (7=4)r1c5-(4=7)r7c5-(7=4)r7c7-(4=7)r2c7 => r1c9<>7
V-INT-5 XY-Wing: P=31...2958629538471..81.9623..3.9781...18.359.89..1536.736981245142356789985724136
  (4=6)r5c5-(6=7)r5c2-(7=4)r6c3 => r5c1,r6c4<>4

## Terminology contract — Competent Level (strmCkr r/sudoku wiki)
Second instalment; further wing/ring structures pending. Structures
below are the naming/geometry contract for V-phase.

Mini-sectors (slice sets): 27 sectors x 3 groups of 3 cells.
 1 Mini Row by Box:   [r1c123],[r1c456],[r1c789]
 2 Mini Col by Box:   [r123c1],[r456c1],[r789c1]
 3 Mini Box Col by Row: [r1c123],[r2c123],[r3c123]
 4 Mini Box Row by Col: [r123c1],[r123c2],[r123c3]
A mini-sector holds <=3 truths; eliminating 1 leaves 2 => grouped
strong link (<=3 active cells); value and/or location transfer
across it depending on configuration.

ERI contract: special case of grouped strong link; VALUE inferences
only. A grouped strong in a box is true only as a mini row or mini
col. ERI = check that all box cells of a candidate lie exactly on
1 row and 1 col, and the row*col overlap is not the only active
cell. Centre cell (row intersect col) is marked as the link-build
point (direction change row<->col). Counting method:
cells(row)+cells(col)-(centre if active) = box total; invalid if
total >5, <2, or row/col has no cells.
Six strong-link types: bivalve; bi-location; grouped&one-cell;
one-cell&grouped; grouped&grouped; ERI {max, missing-I, min}.
Weak inferences may also use grouped mini-sector candidates.

Chains: value chains vs location chains (a cell ON for one value,
OFF for another strong link).
Ex: (1=2)r1c1-(2)(r2c3=r4c3)-(1)(r4c3=r4c5) => r1c5<>1.

Wing structures (three strongs + two weaks; value+location classes):
 XY-Wing: Bivalve{a,b} - Bivalve{b,c} - Bivalve{c,a}
 W-Wing:  Bivalve{a,b} - Location{b} - Bivalve{a,b}
 (further structures to be appended from later screenshots)

Test vectors:
V-COMP-1 ERI X-chain: P=5.1..3.....7..415..89.15.6..15..7346.2364157.67435....15643.78..925.......81....5
  single-value X-chain using ERI; must fire on this grid.
V-COMP-2 W-Wing: P=5.......9.2.1...7...8...3...4...2.......5.......7.6.1...3...8...6...4.2.9.......5
  W-Wing per structure above.
V-COMP-3 XY-Wing: identical to V-INT-5.

## Terminology contract — Competent Level part 2 (exact wing vectors)
V-COMP-1 Empty Rectangle, exact expected step:
  (9)(r6c789=r5c9-r7c9=r7c6) => r6c6<>9
V-COMP-2 W-Wing, exact expected step:
  (4=2)r8c1-(2)r7c3=(2)r7c78-(2=4)r9c9 => r8c7,r9c3<>4
{Split} S-Wing: Structure Location{a} - Bivalve{a,b} - Location{b}
  vector (same puzzle as V-COMP-2):
  (4)r9c6=(4)r7c6-(4=8)r7c9-(8)r2c9=(8)r2c6 => r9c6<>8
M(2)-Wing: Structure Bivalve{a,b} - Location{a} - Location{b}
  vector P=...67..242..4....1..4512..874.3..269..27..485..82.43178579361424..127856.2.845793
  (1=8)r4c6-(8)r1c6=(8-1)r1c2=(1)r5c2 => r4c3,r5c6<>1
Notation convention: a location weak inference inside one cell is
written (8-1)r1c2 seated between the two sector strong links.

Wing structure table (V = bivalve/value node, L = location/grouped
sector node):
  XY-Wing  V-V-V
  W-Wing   V-L-V
  S-Wing   L-V-L   ({Split} variant)
  M(2)-Wing V-L-L
  M(3)-Wing pending next screenshots

## Terminology contract — Competent Level part 3 (local/hybrid wings)
M(3)-Wing: Structure bivalve{a,b} - Location{a} - Location{c}
  P=.5....964467915283928364175.42.......4...27..7...63417.6.534.2..6...7..21.7.....
  (1)r7c4=(1-2)r8c6=(2)r1c6-(2=8)r1c4 => r7c4<>8
{Local} L(1)-Wing: Structure Location{a} - Location{a} - Location{a}
  P=...382.....3....8.7.8...52334..96.5.9...5...6...1.3....2.6.8.95..6...4..5.3.7..61
  (2)(r46c9=r8c9-r9c7=r9c4-r8c5=r6c5) => r6?<>(occluded; verify at replay)
{Local} L(2)-Wing: Structure Location{b} - Location{a} - Location{a}
  P=3.2...4.565.....914...57623..32.41....21.8..4.7465192381.46....2.3.....64.65...317
  (3)r7c5=(3)r2c5-(3)r2c4=(3-7)r5c4=(7)r8c4 => r7c5<>7
{Local} L(3)-Wing: Structure Location{a} - Location{b} - Location{c}
  P=.2...7..6.35641..7.6782...1......7....37.....679412..831.974..5.98.56.7375..839..
  (1)r8c7=(1-6)r9c8=(6-4)r9c3-(4)r8c1 => r8c7<>4
{Hybrid} H(1)-Wing: Structure Location{a} - Location{a} - Bivalve{a,b}
  P=8..14..6..6358974...4.62...6..43..2......6...8..51..6..861.95..91...63..46.95..7
  (2)r7c12=(2)r7c9-(2)r2c9=(2)r2c1-(2=3)r9c1 => r9c1<>2
  Wiki note: features a single-digit x-chain for the same elimination
  => naming-priority question: H-wing vs X-chain for identical elims.

Structure table update (V=bivalve/value, L=location/grouped):
  XY V-V-V | W V-L-V | S L-V-L | M2 V-L-L(ends on b) | M3 V-L-L(ends on c)
  L1 L-L-L(same a) | L2 L-L-L(b,a,a) | L3 L-L-L(a,b,c) | H1 L-L-V
Token strings alone do NOT separate M2/M3 nor L1/L2/L3: digit flow
across nodes is part of the name. classify() must inspect digits.

## Terminology contract — Competent Level part 4 (hybrid/inverted, final)
H(2)-Wing: Structure Location{a} - Bivalve{a,b} - Bivalve{a,b}
  contains a naked pair; single-digit x-chain redundancy.
  Vector P=L3-grid: (3)r3c8=(3)r3c7-(3=5)r6c7-(5=3)r6c8 => r1c8,r4c8<>3
H(3)-Wing: Structure 3 values, any link type for the 3 strong links;
  single-digit x-chain redundancy.
  Vector P=L2-grid: (7)r5c7=(7)r5c4-(7=6)r4c5-(6=9)r4c9 => r5c7<>9
{inverted} iW-Wing: Structure Location{a} - Location{b} -
  Location{b} - Location{a} (four nodes)
  Vector P=L3-grid: (1)r4c3=(1-4)r1c3=(4)r13c1-(4)r8c1=(4-1)r8c7=(1)r5c7
  => r4c8,r5c1<>1
Structure table final additions: H2 = L-V-V, H3 = 3-value any-link,
iW = L-L-L-L (a,b,b,a).
Shared-grid note: L3/H2/iW share one puzzle; L2/H3 share one; W/S
share one. Same-state vectors with different elim sets must all
surface; equal elim sets fall to the elim-set dedupe rule.
