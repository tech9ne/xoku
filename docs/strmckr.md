# StrmCkr's Sudoku Theory Documentation
Source: Reddit wiki posts by StrmCkr (20+ year forum contributor, collaborator with hobiwan).
Saved: 2026-09-20. Owner may update with additional material.

## 1. Hyper-Dimensional XOR Formulation of ERi (Empty Rectangle Intersection)

**Core concept:** ERi is a formal 2D XOR constraint across intersecting slices (e.g., row-in-box intersect col-in-box), not a simple cell-selection.

**Formal definition:**
- Let SA and SB be slice sets (e.g., Row-in-Box and Column-in-Box).
- Unique existential quantifier: exactly one selected candidate per slice.
- If slices intersect, the intersection cell acts as a shared parity bridge (CA = CB),
  satisfying two-dimensional constraints with a single truth.
- If slices do not intersect, they behave as independent 1D XOR constraints,
  not merely "distinct candidates."
- This formalizes ERi as a set-level XOR operation, not a simple cell-selection.

**Conditional forcing proof (intersection cell C):**
- Case 1 (C = True): the selected cell satisfies XOR for both slices simultaneously;
  all other candidates in both slices are eliminated (mutual exclusion).
- Case 2 (C = False): XOR propagates to remaining slice segments; each segment
  forms a strong link (exactly one candidate selected per slice); recursive
  propagation applies if segments intersect with other slices.
- enforceStrongLink(segment): if size 1 select the only candidate; else propagate
  XOR/ERi rules recursively to overlapping slices.

**Paraphrased in short:** a three-way XOR (A,B,C) exists when
((Row1*Row2) * (Col1*Col2) * Box) = 0, leaving Row3, Col3 as the only potential
Box-slice truths, where the intersection (if applicable) must be accounted for
as it has parity.
- A = (Row3 * Box) - C   [sector slice minus intersection]
- B = (Col3 * Box) - C   [sector slice minus intersection]
- C = (Row3 * Box * Col3) [intersection]

**Footnotes:**
- "Hyper-Dimensional" = overlapping unit-level constraints (multi-unit
  intersections), not ML-style high-dimensional vectors.
- "Parity" = shared truth-state between two intersecting local XOR constraints
  where the intersection participates in both (CA = CB); not unrestricted
  odd-parity across all ERi operands.

## 2. A.I.C Node Logic: Digit-Based Strong Links via XOR Gates

**Core concept:** AICs are formal Boolean circuits: XOR gates for strong links,
NAND gates for weak links. This is the chain-first philosophy behind H13.

**Structural XOR definition:** ((A or not A) and (B or not B)) with constraints
not A = B and not B = A. The tautologies are always TRUE; the inversion
constraints restrict states to (A,B) = (1,0) or (0,1), i.e. XOR(A,B) = 1,
equivalently (A and not B) or (not A and B).

**Key consequence:** a structural strong link is XOR, not OR. OR permits
(0,1),(1,0),(1,1); structural XOR permits only (1,0),(0,1) and supplies a
direct deterministic inversion between its two propositions.

**Computational comparison:**
- OR-NAND-OR: retains (1,1); needs cross-tabulation of admissible states: O(n^2).
- XOR-XOR-XOR: valid collapsed, but expanded form must propagate inversion
  constraints bidirectionally and union effects: O(n^2).
- Structural XOR-NAND-XOR: inversion stays local; both relations bidirectional;
  sequential propagation from any node in either direction: O(n).

**Base implication:**
(XOR(A,B) and XOR(A2,B2) and NAND(B,A2)) implies OR(A,B2).
Proof: B = not A; B2 = not A2; NAND(B,A2) = not(not A and A2) = A or not A2;
substituting B2 = not A2 gives the conclusion exactly. QED.

**General chain theorem:** for a chain of length n,
AND_i XOR(Ai,Bi) and AND_i NAND(Bi,A(i+1)) implies OR(A1,Bn) = True.
Proof sketch: (1) collapse strong links Bi = not Ai; (2) each weak link becomes
Ai or not A(i+1); (3) each clause is A(i+1) -> Ai, so the chain is
An -> ... -> A1; (4) contrapositive not A1 -> not An = Bn; hence A1 or Bn. QED.

**Uniqueness:** the reduced system admits exactly two satisfying assignments
(all Ai = 1, or all Ai = 0); any mixed assignment violates a clause. Therefore
the boundary OR(A1,Bn) is invariantly true. The reduced form is a Horn clause
system: deterministic linear-time propagation, O(n) in chain length.

**Elimination types (applied to a confirmed valid path OR(A1,Bn)):**
- Type 1 (same digit): A1 and Bn carry the same digit d -> eliminate d from all
  peers seeing both A1 and Bn.
- Type 2 (different digit): A1 != Bn, both single objects and mutual peers ->
  A1 cannot carry Bn's digit and Bn cannot carry A1's digit.
- Type 3 (ring): a closed consistent loop is detected; the ring's two stable
  states are used cyclically to apply Type 1/2 derived constraints across the
  whole path, eliminating impossible digits in overlapping cells of other
  unverified branches (global consistency). Does not eliminate the ring itself.

## 3. Almost Locked Sets: Foundations and Rules

**ALS definition:** an extension of the naked subset: N cells holding N + x
values, x = degree of freedom (DOF); scope here x = 1. One cell with two digits
= size-1 ALS; three cells with four digits = size-3 ALS. Notation: ALS DOF(n),
informally "aals" with one "a" per DOF. Builds directly on locked sets.

**Restricted Common Candidate (RCC):** ALSs A and B share value X such that
placing X in A removes all X from B and vice versa. X in A -> B becomes a
locked set; X in B -> A becomes a locked set. An RCC is a weak inference
between ALS nodes (ties directly to AIC).

**ALS-XZ rule (1 RCC):** Z is a candidate in both A and B, not restricted like
the RCC. Given the RCC effects, Z must belong to exactly one of A or B;
eliminate Z from any peer cell that sees all Z candidates across A and B.

**ALS-XZ double link (2 RCC):** with X1 in A and X2 in B both restricted,
placing X1 in A locks B and placing X2 in B locks A; both ALSs resolve
simultaneously. Each RCC may be eliminated from cells seeing all its
appearances; each non-RCC Z confined to one ALS may be eliminated from peers
seeing all copies of Z within that ALS.

**Naming (Barns):** when N cells = N digits the structure is a Bent Almost
Restricted Naked Subset; lookup by N: 2 Naked Pair, 3 XYZ (all bivalues -> XY),
4 WXYZ (all bivalues and 2 RCC -> XY), 5 VWXYZ, 6 UVWXYZ, 7 TUVWXYZ,
8 STUVWXYZ, 9 RSTUVWXYZ. One RCC -> "Wing"; two RCC -> "Ring".

**StrmCkr:** "These techniques are difficult because they're precise. Keep
practicing, re-read where needed, and ask questions. The logic is solid. The
understanding comes with time."

## 4. V/L Tagging (referenced, not yet pasted)
StrmCkr's strong/weak link labeling scheme; semantics live in the techniques.ts
naming table. Source messages to be appended by owner on demand.

## 5. Value/Location Tagging (V/L) — Competent Solving Prerequisites

**Competent level begins with strong grasp of:**
- Box/Line Reduction (BLR)
- Naked & Hidden subsets
- Entry-level X-Chains
- Remote Pairs
- XY-Wings

**Symbols in intermediate solving:**
- `=>` implies
- `<>` not equal to
- `=` strong link (XOR gate)
- `-` weak inference (NAND gate)

**Value and Location constructs (expand chaining beyond candidate inferences):**

**Value:** A candidate used in a chain whose inclusion/exclusion affects the next strong link.

**Location:** A cell identified as ON for one value and OFF for another strong link. Changes in cell location allow new forms of chaining logic (e.g., bivalves).

**Mini-sectors:** The grid has 27 sectors, each with 9 cells, broken into 3 groups of 3 cells (mini-sectors).
- Mental & physical construct to visualize advanced chaining.
- Base constructs of XOR logic gates (slice of sector space as intersection).

**Mini-sector types:**
1. Mini Row by Box: 3 columns in single row within box (r1c123, r1c456, r1c789)
2. Mini Col by Box: 3 rows in single column within box (r123c1, r456c1, r789c1)
3. Mini Box Col-by-Row: 3 consecutive cols by row within 1 box (r1c123, r2c123, r3c123)
4. Mini Box Row-by-Col: 3 consecutive rows by col within 1 box (r123c1, r123c2, r123c3)

Mini-sectors potentially hold 3 truths; eliminating 1 leaves 2 possible, building grouped strong links.
**Grouped strong links:** up to 3 active cells; value and/or location can transfer across the grouped link depending on configuration.

## 6. Empty Rectangle Intersection (ERI) — Special Grouped Strong Link

**ERI:** special case of grouped strong links; can only be used as value inferences.
- Grouped strong link in a box can only be true as mini-row or mini-col.
- ERI checks if all cells in a box are exactly on 1 row and 1 col, and that the overlap of row*col isn't the only active cell.
- Mark the center cell of the intersecting row/col as reminder of where to build links from (directional changes: row→col or col→row).

**Method to find an ERI:** counting method — pick a candidate and 1 row and 1 col in a box.
- sum of (Row + Col) cells - (center cell if active) = total cells in box
- If box has >5 cells: invalid
- If total <2: invalid
- If row or col has no cells: invalid

**Concept origin:** very old, created by u/strmckr; documentation lost during enjoysudoku forum crash in 2007. Known by niche group of programmers who added it to chain-building methods.

**Six types of strong links (mini-sector mapping):**
1. Bivalve
2. Bi-location
3. Grouped & One Cell
4. One Cell & Grouped
5. Grouped & Grouped
6. Empty Rectangle Intersection (ERI) {max, missing "I", min}

Each has distinct logical structure for chaining.

**Weak inference:** like strong links, can include grouped candidates from a mini-sector.

**Building chaining logic:** for every grouped strong link, two options: A xor B is true.
- **Value chains:** full logic via working links (putting it together).
- **Location chains:** when location is used, candidate changes in selected cells prompt the next strong link.

**Example:** `(1=2)r1c1 - (2)(r2c3 = r4c3) - (1)(r4c3 = r4c5) => r1c5 <> 1`
Proof: if r1c5 = 1, then none of r1c1 or r4c5 can be 1, leading to contradictions per chain logic.

## 7. Named Wings (Three Strong Links, Two Weak Inferences)

Named because all chain combinations of Value and Location have been explored for their class and structures of three strong links with two weak inferences.

**XY-Wing (Y-Wing):**
Structure: Bivalve{a,b} - Bivalve{b,c} - Bivalve{c,a}
Example: `(4=6)r5c5-(6=7)r5c2-(7=4)r6c3 => r5c1,r6c4 <> 4`

**W-Wing:**
Structure: Bivalve{a,b} - Location{b} - Bivalve{a,b}
Example: `(4=2)r8c1-(2)r7c3=(2)r7c78-(2=4)r9c9 => r8c7,r9c3 <> 4`

**S-Wing (Split):**
Structure: Location{a} - Bivalve{a,b} - Location{b}
Example: `(4)r9c6=(4)r7c6-(4=8)r7c9-(8)r2c9=(8)r2c6 => r9c6 <> 8`

**M2-Wing:**
Structure: Bivalve{a,b} - Location{a} - Location{b}
Example: `(1=8)r4c6-(8)r1c6=(8-1)r1c2=(1)r5c2 => r4c3,r5c6 <> 1`

**M3-Wing:**
Structure: Bivalve{a,b} - Location{a} - Location{c}
Example: `(1)r7c4=(1-2)r8c6=(2)r1c6-(2=8)r1c4 => r7c4 <> 8`

**L1-Wing (Local):**
Structure: Location{a} - Location{a} - Location{a}
Example: `(2)(r46c9=r8c9-r9c7=r9c4-r8c5=r6c5) => r6c7 <> 2`

**L2-Wing (Local):**
Structure: Location{b} - Location{a} - Location{a}
Example: `(3)r7c5=(3)r2c5-(3)r2c4=(3-7)r5c4=(7)r8c4 => r7c5 <> 7`

**L3-Wing (Local):**
Structure: Location{a} - Location{b} - Location{c}
Example: `(1)r8c7=(1-6)r9c8=(6-4)r9c3=(4)r8c1 => r8c7 <> 4`

**H1-Wing (Hybrid):**
Structure: Location{a} - Location{a} - Bivalve{a,b}
Features single-digit X-chain for same elimination.
Example: `(2)r7c12=(2)r7c9-(2)r2c9=(2)r2c1-(2=3)r9c1 => r9c1 <> 2`

**H2-Wing (Hybrid):**
Structure: Location{a} - Bivalve{a,b} - Bivalve{a,b}
Features single-digit X-chain, contains naked pair.
Example: `(3)r3c8=(3)r3c7-(3=5)r6c7-(5=3)r6c8 => r14c8 <> 3`

**H3-Wing (Hybrid):**
Structure: 3 values, any type of link usable for 3 strong links.
Features single-digit X-chain.
Example: `(7)r5c7=(7)r5c4-(7=6)r4c5-(6=9)r4c9 => r5c7 <> 9`

**iW-Wing (inverted):**
Structure: Location{a} - Location{b} - Location{b} - Location{a}
Example: `(1)r4c3=(1-4)r1c3=(4)r13c1-(4)r8c1=(4-1)r8c7=(1)r5c7 => r4c8,r5c1 <> 1`

## 8. Almost Hidden Sets (AHS) as XOR Structures

**Premise:** For any unit (row, column, box), Sudoku enforces digit-level XOR: each digit appears exactly once per unit.
- Hidden Set satisfies this XOR internally.
- Almost Hidden Set (AHS) contains one additional placement state beyond those required to resolve its digits.
- Additional state may be: single cell, or non-overlapping group of cells for one digit acting as one structural proposition.
- The +1 in AHS does not simply mean one additional physical cell; represents one additional unresolved placement state within relationship between digits and cells.
- Resolving that additional state reduces AHS to corresponding Hidden Set / 1:1 locked state.
- That is the XOR structure of AHS.

**Hidden Set (baseline):**
Let D be set of n digits within single unit; P(D) be set of placement states available to those digits.
Placement state may represent: one cell, or grouped set of cells for one digit (provided group functions as single non-overlapping logical proposition).
If digits resolve into exactly n independent placement states: |P(D)| = |D|, then D forms Hidden Set.
N digits = N placement states (1:1 state). Every digit in D must be resolved internally within those placement states.

**Almost Hidden Set (AHS):**
AHS contains one additional placement state: |P(D)| = |D| + 1, therefore N digits = N + 1 placement states.
The +1 has slightly different meaning from ALS +1:
- ALS directly compares: N cells = N + 1 digits
- AHS describes relationship between collection of digits and their available placement states.
Additional state may involve individual cell or cell-group for one digit.
Only N independent placement states required to resolve N digits; additional state represents one unresolved degree of freedom.
Resolving it reduces structure to N digits = N placement states (corresponding Hidden Set / 1:1 locked state).

For any selected external placement state p, two possible states:
- p is excluded: remaining structure resolves as corresponding Hidden Set
- p is used: another placement state must be excluded instead
These two conditions are complementary: HS(p) XOR p. Exactly one is true.

**Restricted Common Candidate (RCC):**
Let AHS₁ and AHS₂ be two AHS structures; p be candidate proposition shared between them.
Term "candidate" intentionally general; within AHS, RCC may represent candidate in single cell or non-overlapping group of cells for one digit acting as one candidate proposition.
What matters is logical restriction between two AHS structures.

Candidate proposition p is RCC when:
1. p participates in both AHS structures
2. its truth in one structure excludes its truth in the other
3. both structures cannot satisfy p simultaneously
Thus: NOT(RCC₁(p) AND RCC₂(p)) or equivalently RCC₁(p) NAND RCC₂(p).

RCC has two separate roles:
- Inside its own AHS: participates in XOR: HS(p) XOR RCC(p)
- Between two AHS structures: participates in NAND: RCC₁(p) NAND RCC₂(p)
These relationships should not be confused.

**Single RCC — binary XOR view:**
When only one RCC edge of AHS is relevant, structure can be represented simply as: HS XOR RCC.
- If RCC is false, its complementary Hidden Set is true.
- If Hidden Set is false, RCC must be true.
Therefore: HS ⊕ RCC = 1.
RCC represents relevant candidate proposition; physical representation may be single cell or valid cell-group for one digit.
This is simplest view of AHS, sufficient when only one RCC edge exposed; however only binary view of larger AHS structure.

**Multiple RCCs:**
When more than one candidate proposition from same AHS is used as RCC, AHS must retain Hidden-Set state associated with each RCC edge.
Consider AHS with two RCCs: RCC_L and RCC_R.
Each RCC has its own complementary Hidden-Set resolution: HS(L) XOR RCC_L and RCC_R XOR HS(R).
Important point: HS(L) ≠ HS(R); they are different Hidden-Set resolutions of same AHS.
Treating both simply as HS discards information contained within AHS.

**Defining the common subset C:**
Two Hidden-Set resolutions may contain placement states common to both.
Let L = Hidden Set produced when RCC_L is false; R = Hidden Set produced when RCC_R is false.
Placement subset shared by both Hidden-Set resolutions called C: C = L ∩ R.
Members of C may represent individual cells or valid cell-groups associated with their respective digits.

Separate remaining placement states into portions unique to each side: HS_L = L \ C; HS_R = R \ C.
Therefore: L = HS_L + C and R = C + HS_R.
- HS_L represents portion unique to left Hidden-Set resolution
- C represents placement states common to both Hidden-Set resolutions
- HS_R represents portion unique to right Hidden-Set resolution

Two unique portions form symmetric difference: L △ R = HS_L + HS_R, while C is their intersection.
Complete middle AHS can therefore be decomposed as: {RCC_L, HS_L + C + HS_R, RCC_R}.
C component is not additional rule or inference; information already present in AHS, identifying subset that remains common when same AHS viewed from two different RCC edges.

**Why binary form not enough:**
For single RCC: HS XOR RCC is sufficient.
With two RCCs, writing RCC_L XOR HS XOR RCC_R incorrectly treats HS as one fixed state (it is not).
Left RCC complemented by HS_L + C; right RCC complemented by C + HS_R.
Structure contains two related XOR views: (HS_L + C) XOR RCC_L and RCC_R XOR (C + HS_R).
Both belong to same AHS; not independent XOR gates.

**XOR structure with two RCCs:**
AHS can now be represented through combined state: {RCC_L, HS_L + C + HS_R, RCC_R}.
Two binary XOR views remain available: (HS_L + C) XOR RCC_L and RCC_R XOR (C + HS_R), but complete AHS retains common subset C connecting those views.
Important when AHS used as intermediate node: HS — XOR — RCC — NAND — RCC — AHS — RCC — NAND — RCC — XOR — HS.
Middle AHS has two different RCC edges; NAND candidate used to enter/leave AHS determines which Hidden-Set view exposed.
- Entering through left RCC exposes: HS_L + C
- Entering through right RCC exposes: C + HS_R
Underlying AHS itself does not change; only subset view being used changes.

**Why not reduce to OR?**
OR representation can preserve simple inference relationship but discards internal Hidden-Set structure.
Example: RCC_L OR RCC_R does not retain HS_L, C, or HS_R; may preserve outward logical consequence but no longer identifies which Hidden-Set subset produced that consequence.
XOR representation retains that information: (HS_L + C) XOR RCC_L and RCC_R XOR (C + HS_R).
Distinction becomes important when chaining through AHS, closing ring, or reconstructing logical output.
C is not additional logic; information already present in AHS that is lost when structure reduced to OR.

**Logical consequence:**
For any RCC candidate proposition p: RCC(p) = false forces HS(p) = true; HS(p) = false forces RCC(p) = true (local XOR behavior).
When RCC connected to another AHS: RCC₁(p) NAND RCC₂(p), true RCC on one side forces RCC on other side false; that false RCC then resolves its own AHS into corresponding Hidden Set.
Resulting construction: XOR → NAND → XOR (same structure used throughout AIC).

**Single AHS perspective:**
AHS not limited to one HS XOR RCC relationship; each usable RCC exposes its own binary XOR view of same underlying digit/placement structure.
- For RCC x: HS(x) XOR RCC(x)
- For RCC y: HS(y) XOR RCC(y)
- For RCC z: HS(z) XOR RCC(z)
Views related because they belong to same AHS; when multiple views used simultaneously, their common and differing Hidden-Set subsets must be retained.
For two RCC views: HS(x) = HS_L + C; HS(y) = C + HS_R.
Common subset C is what allows both views to remain identifiable as parts of same AHS.

**Interpretation:**
- Hidden Set: N digits = N placement states (1:1 state)
- AHS: contains one additional unresolved placement state
- +1 may be represented by cell or valid cell-group for one digit
- Resolving additional state reduces AHS to corresponding Hidden Set / 1:1 locked state
- Selected RCC exposes binary HS XOR RCC view
- RCC means Restricted Common Candidate; candidate intentionally representation-independent
- RCC may therefore represent single-cell or grouped candidate proposition
- Multiple RCCs expose multiple views of same AHS
- C is placement subset common to two Hidden-Set views
- HS_L and HS_R are symmetric differences between those views
- RCCs connect compatible AHS structures through NAND
- AHS logic remains structural XOR, not pattern-based

**Relation to standard techniques:**
| Technique | Logical Structure |
|---|---|
| Hidden Set | Complete 1:1 state |
| AHS | Constructed XOR |
| Single RCC view | HS XOR RCC |
| RCC connection | RCC NAND RCC |
| Multiple RCC AHS | Multiple subset views of one XOR structure |
| AHS-XZ | XOR structures connected through RCC NAND |
| AHS-XY | Multiple RCC views connected through RCC NAND |
| AHS Chain | XOR → NAND → XOR → NAND → XOR ... |
| AHS Ring | Closed chain of same XOR/NAND structure |

**Duality with ALS:**
ALS and AHS are dual constructions, but their +1 states expressed differently.
| ALS | AHS |
|---|---|
| N cells = N + 1 digits | N digits = N + 1 placement states |
| Extra degree of freedom is digit | Extra degree of freedom is placement state |
| Locked-Set resolution / 1:1 resolution | Hidden-Set / 1:1 resolution |
| RCC projects through digit | RCC projects through placement |
| Common digit subset | Common placement subset |
| Candidate projection | Placement projection |

For ALS: LS(d) XOR RCC(d); for AHS: HS(p) XOR RCC(p).
RCC terminology does not change; what changes is projection represented by candidate.
Symmetry structural rather than merely digit ↔ cell.
AHS operates on relationship between digits and their available placement states; those placement states may themselves be grouped.
With multiple edges, both ALS and AHS must retain common subset C and symmetric differences between their corresponding internal resolutions.
They remain same underlying XOR construction viewed through opposite projections.

**Conclusion:**
AHS not special case; first-class XOR object.
For single RCC: AHS = XOR(Hidden Set, Restricted Common Candidate) is view of AHS, not limitation of complete structure.
+1 in AHS does not merely identify one extra physical cell; represents additional placement state within relationship between digits and cells/cell-groups capable of containing them.
Resolving additional state reduces structure to corresponding N digits = N placement states Hidden Set / 1:1 locked state.
When multiple RCCs exposed, each has its own complementary Hidden-Set resolution: HS(p) XOR RCC(p); those Hidden Sets may contain both common and differing placement subsets.
For two RCC edges: Left HS = HS_L + C; Right HS = C + HS_R, where C = Left HS ∩ Right HS and HS_L + HS_R = Left HS △ Right HS.
Common subset C must be retained if full structure to remain identifiable.
Without C, two Hidden-Set views collapse into generic HS; information about which placement states remain common between RCC-dependent resolutions lost.
Thus AHS-XZ, AHS-XY, AHS chains, AHS rings remain compositions of same fundamental construction: XOR structures connected by NAND edges.
No additional logical operator required; apparent complexity comes from exposing multiple subset views of same underlying XOR structure.
Framing keeps AHS logic unit-based, symmetric with ALS, information-preserving, algorithmically explicit.

## 9. The Ultimate Fishing Guide — Catching Fish in Sudoku

**How did fishing arise?** To understand fish patterns, first grasp templates in Sudoku.

**Templates:**
- Template: every possible arrangement of single digit in every allowed cell.
- 46,656 different templates for each digit.
- Solved Sudoku has exactly 9 templates (one for each digit).
- Opening clues reduce possible templates dramatically as digits progressively placed.

**Nisho — Template Omission:**
- Template analysis can swiftly compare all legal digit placements.
- If cell never appears in any template for digit, it can be eliminated (Nisho).
- Logical principle underlies how advanced fish techniques "prove" reductions.

**Fish — Mathematical Approach:**
- Fish: set-theoretic approach, balancing sets (base sectors) to fit into container (cover sectors).
- Fish identify where candidates forced and thus where eliminations can be made.

**Fish Construction:**
- Fish uses sectors (rows, columns, boxes) and single digit.
- Fish have two parts: Base and Cover.

**Base Sector:** Set of N rows (or columns/boxes) containing the digit.
**Cover Sector:** Opposite type; if base is rows, cover is columns (or boxes). Base and cover must intersect.

**Picking Base and Cover Sets:**
For basic fish, select N base and N cover sectors.
Intersection creates "net" of candidate cells.

**Fish Math:**
For digit, fish of order N: Base N sectors, Cover N sectors.
Principles:
- Every base unit's digit appears only in cover units.
- Digit cannot appear elsewhere within cover sectors, outside intersection.
- Thus, any digit in cover sector outside base can be safely eliminated.
Extensions: if cover has extra sectors (N < K), digit can also be excluded from overlapped cells.

**Vertices:**
Intersection cells between base and cover.
Exactly N vertices for N sectors, one per sector.

**Fish of Size N — Naming:**
| N | Fish Name |
|---|---|
| 1 | CyclopsFish (BLR) |
| 2 | X-Wing |
| 3 | Swordfish |
| 4 | Jellyfish |
| 5 | Starfish/Squirmbag |
| 6 | Whale |
| 7 | Leviathan |

**Fish Shapes:**
- **Basic:** N row sectors × N column sectors, or vice versa.
- **Franken:** N (row/box) × N (column/box), allows boxes in base/cover.
- **Mutant:** N sectors × N sectors, not strictly basic/franken.

**Fish Colouring Method:**
For visual clarity, use colours: Base = Blue, Cover = Red, Vertices = Green.
Steps:
1. Pick digit (your "tackle").
2. Pick fish size N.
3. Colour N base sectors' candidate cells blue.
4. Colour N cover sectors' candidate cells red; if cell already blue, change to green (vertex).
5. Check net: if any blue cells remain, no fish present (increase N if possible); if all blue become green (N vertices), net full.
Colour eliminations: all red cells not converted to green can be eliminated for digit.

**Mathematical proof:**
If you place any of eliminated candidates, at least one sector will lack valid placement (rule violation).

**Classic Fish Examples:**

**CyclopsFish / Box Line Reduction (BLR) — Size 1:**
- Base: 1 sector, Cover: 1 sector.
- Example 1: Tackle "3", N=1, Class Franken. Base: Box B2 (r3c45) blue; Cover: Row 3 (r3c1237) red; change vertices (r3c45) to green; no blue cells unmarked = fish; eliminate red cells: r3c1237 <> 3.
- Example 2: Tackle "3", n=1, Class Franken. Base r9: (r9c46) blue; Cover B8: (r8c4) red; change vertices (r9c46) to green; no blue cells unmarked = fish; eliminate red cells: (r8c4) <> 3.

**X-Wing — Size 2:**
- Base: 2 sectors, Cover: 2 sectors.
- Example: Tackle "7", N=2, Class Basic. Base: r24 (r2c39,r4c39) blue; Cover: C39 (r3c9,r5c39,r9c9) red; change vertices (r2c39,r4c39) green; no blue cells = fish; eliminate red cells: (r3c9,r5c39,r9c9) <> 7.

**Swordfish — Size 3:**
- Base: 3 sectors, Cover: 3 sectors.
- Example: Tackle "2", N=3, Class Basic. Base: c157 (27c1,r37c5,r25c7) blue; Cover: r237 (r2c235,r3c24,r7c36) red; change vertices (r2c17,r3c57,r25c7) green; no blue cells = fish; eliminate all red cells: (r2c235,r3c24,r7c36) <> 2.

**Jellyfish — Size 4:**
- Base: 4 sectors, Cover: 4 sectors.
- Example: Tackle "2", N=4, Class Basic. Base: r1468 (r1c24,r4c36,r4c234,r8c234) blue; Cover c2346 (r23c2,r27c3,r3c4,r27,c6) red; change vertices (r1c24,r4c36,r4c234,r8c234) green; no blue cells = fish; eliminate red cells: (r23c2,r27c3,r3c4,r27,c6) <> 2.

**Fish Finder Tips:**
- For basic fish, base sectors should have ≤ N candidates.
- If you can net these fish, you're ready for exotic fish species.

With practice, you'll quickly spot nets, set up lines, and reel in advanced fish, unlocking deep logical eliminations in any Sudoku puzzle.

## 10. Alternating Inference Chain 101

**Primary operation of AIC:** start and end on XOR Gate, where each XOR gate connected by NAND gate on intersecting edge.
Creates logic sequence that results in OR relationship between non-connected edges of chain.
Those resultant OR gates are what we use to perform eliminations.

**Single Digit — XOR Gate:**
Simplest form using just one digit.
XOR gate constructed from basic rules of Sudoku: every sector can contain only one copy of any digit (the X part: e(X)actly one).
OR part attained by using information in grid to create situation where two truths plausible.
Do this by subdividing every sector into three partitions (mini-sectors).
Rows and columns broken up by their respective three boxes; boxes broken up by their respective rows and columns (rarely used for single-digit chaining, but needed later).

**Using three colours: Blue — Green — Red.**
If one of those mini-sectors completely missing candidate (like Red), we can establish relationship for sector: exactly one of Blue OR Green will be true for digit.

**Important point:** coloured edge represents mini-sector, not candidate or cell.
When "Blue is true," digit occurs somewhere within that Blue mini-sector.
Number of candidates inside it does not define the relationship.

**Simple Constructs:**
To spot these, use digit highlighting to focus on one digit at a time and look at what mini-sector is "off."
Goal of AIC: connect two XOR gates.
Showcase this by first finding two such sectors (for beginners, recommend sticking to same sector types at first).

**Connecting the XOR Gates:**
Join colours: Blue to Blue or Green to Green (becomes edge between them).
How to connect? Use the intersection.
Two Blues share common sector (e.g., Column 2).
Goal: get all of Blue 4s encapsulated by that intersecting sector.
Draw new colour (Grey); check all Blue 4s — every Blue 4 must also be coloured Grey.
If they aren't, connection doesn't work (try Green edge instead).

**Creating NAND Gate:**
Congratulations — we have now created our first NAND Gate.
This is keystone mechanic of all AIC chains.
If this relationship isn't formed correctly, none of the chain will work.
All Blue 4s from both groups contained within C2.
Since C2 can contain only one 4: both Blues cannot be true, or as logic gate: NAND(Blue, Blue).

**Important point about NAND intersection:**
Once NAND established, we never consider contents of C2 while chaining.
We do not ask whether C2 contains a 4, which Blue contains the 4, or require one of Blues to contain 4.
C2 was used to establish one fact: both Blues cannot be true. That's it.
For this NAND, "none" means neither of our two Blue edges is true; does not mean C2 itself contains no 4.
C2 may contain its 4 somewhere else, or may even form its own XOR relationship; neither matters here because those are separate attributes of puzzle state and not part of this NAND connection.
From this point forward, connection is simply: NAND(Blue, Blue).
Allowed states: Blue 1, Blue 2, or neither — but never both.
That "neither" state is important one for chaining.

**The Truth Inverter:**
Now each Blue is paired with Green by XOR: Blue XOR Green.
When Blue is false, its paired Green must be true to satisfy that XOR.
With logic gates we don't have to "test" anything; we already established relationships above, and condition of our NAND can be "none" (neither Blue is true).
That immediately forces both Greens true.
Jump straight to important result: both Greens, or at least one Green, will be true.
Since both Greens used for elimination, only NAND case we need to consider: NAND → none, because that is case that forces into both outward edges.

Construction: Green — XOR — Blue — NAND — Blue — XOR — Green, result: OR(Green, Green).
At least one of those Green edges must be true.
Notice Greens aren't directly connected; they are non-connected edges.
This is resultant OR gate mentioned at beginning.

**Eliminations:**
Use resultant OR.
All 4s that are peers to every possible 4 on both Green edges can be eliminated (marked Red with arrows showing they see Green 4s).
Important relationship: OR(R2 Green, R7 Green) — at least one of those two mini-sectors contains the 4.
Therefore any candidate that would prevent both from containing the 4 cannot itself be true.

**Proof of Concept:**
Place any one of eliminations as True.
Doing so turns off Green for both rows.
Each row still has its XOR: Blue XOR Green.
With both Greens false, both Blues must therefore contain the 4.
But both Blues encapsulated by C2; that would require C2 to contain two 4s.
Violates NAND premise and ultimately basic Sudoku rule that C2 contains exactly one 4.
Therefore eliminated candidate cannot be true.
With use of NAND, chain's very own proof contained within its construction.

**What if two XOR gates don't produce eliminations?**
Expand outward from any of non-connected edges (e.g., use C3).
Try to keep colours paired when using same sector types (makes transitions easier to follow).
Eliminations will now use new outer edges.
Remember earlier idea: imagine intermediate NAND connections contribute "none"; XORs force us outward until what remains is: C1{Blue} OR C8{Green}.
Those are now resultant OR edges.

**Upgrading the Visuals:**
Gets messy quickly visually; time to upgrade how we draw it.
Once we understand NAND concept, can replace overlapping intersection colours with dashed line.
Once we understand XOR gate, can give each XOR one unique colour and draw solid line between its two edges.
May also match colours if that makes it easier to keep track of connections.
Important thing: underlying logic has not changed: XOR → NAND → XOR → NAND → XOR ...
NAND gates connect our XOR gates; two non-connected outer edges produce final OR; resultant OR is what we use for eliminations.

**Mixing: Rows with Cols:**
Same concepts from previous topic apply; however, when mixing rows & cols, match intersections to opposite colours to help identify cell shared by both R & C (this cell violates NAND clause — not both).
With R & C's, only way they can share is to mark box 3 as NAND gate.
Not even going to that step as "4" is already coloured twice, making this choice bad (being true satisfies both R2{green} & C8{blue} both true, when NAND gate says never both).
Example that works: R2,C7 with NAND{b3}.
Two checks: triple-coloured cell doesn't have "4"; grey cells has all the "4" from c7{blue} and r2{green} cells fully encapsulated.
Good — can presume these are "none" and jump straight into OR{r2(blue), C7(green)} and check for elimination.

**Empty Rectangle Intersection — ERi {xor}:**
Last and hardest of single-digit XOR structures.
So far our XOR gates have been pretty simple: one edge OR the other edge — exactly one is true.
ERi looks little strange because we build this XOR inside Box, using: one mini-Row, one mini-Col, cell where they cross: i {intersection}.
That intersection cell is trick: if i contains digit, it satisfies Box by itself, but i also belongs to both mini-Row and mini-Col.
This lets it bridge Row and Col without breaking Box rule: exactly one of this digit must be true in Box.
Trying to write whole thing out as logic gate gets ugly very quickly & is possible.
Luckily, we don't need to.
For chaining, ERi behaves like directional switch: NAND connects to Row → Col becomes non-connected edge; NAND connects to Col → Row becomes non-connected edge.
Instead of thinking about whole structure at once, just remember: connect one way — come out the other way.

**Why "Empty Rectangle"?**
To make this XOR possible, 4 cells must be empty of digit (our Empty Rectangle cells {red}).
Their position leaves candidates arranged around our mini-Row, mini-Col and intersection i.
There are 9 ways this can appear visually inside Box.
Sounds like lot to learn, but isn't: those 9 appearances reduce to only 3 distinctive shapes: {T, +, L}.
Once you can recognize those three shapes, only question you need to ask while chaining: which edge did my NAND connect to?
Row in → Col out; Col in → Row out.

**First example:**
Identify ERi in Box 7: mini-Row{Blue}, mini-Col{Green}, intersection cell i{both green and blue}, 4 cells "red" in rectangle shape are empty.
Make choice: Row | Col. Choose to connect through Col[2]{Green}.
Identify second XOR to connect to (used R2).
Keep colours lined up: Green → NAND → Green.
Since we chose Col edge of our ERi, NAND intersection will use C2{Grey}.
Perform usual NAND check: ensure all 4s from Green{R2} and Green{B7} fully encapsulated by Grey{C2}.
They are, so we have constructed our NAND gate: NAND{Green, Green}.
Once constructed and checked, can forget about NAND intersection and jump straight to non-connected edges: OR(Blue{R2}, Blue{B7}).
Arrows show elimination sees all possible 4s on both Blue edges.

**Question about triple-coloured cell in Box 7:**
This is i cell mentioned earlier.
Perfectly fine — does not violate our NAND gate.
Remember: our NAND is NAND{Green R2, Green B7}; NAND says those two Green edges cannot both be true.
i cell is only part of Green B7; its other colour (Blue) belongs to other side of ERi XOR — not the second Green edge of our NAND.
So if i is true: Green B7 is true; Blue B7 also satisfied by that same single cell; Green R2 must be false because of NAND.
Still only one 4 in Box 7, and only one of our two NAND edges is true.
Look at resultant OR: OR(Blue R2, Blue B7); i cell is part of Blue B7, so must also be included when checking elimination.
Means elimination must see: every possible 4 on Blue R2 AND every possible 4 on Blue B7 — including i.
Although i is coloured twice inside ERi, it is still just one candidate satisfying both intersecting mini-sectors (thus the box).
When I change XOR colours and draw simplified lines, mark i{Yellow} so we don't accidentally forget it when checking eliminations.

**Can we chain using ERi?** Yes.
Only thing we need to remember: ERi always swaps directions (Row in → Col out; Col in → Row out).
When expanding chain through ERi, pay attention to which edge NAND connected to — we leave through the other one.

**Single Digit A.I.C. — Summary:**
Congratulations — you now know everything needed to build Single Digit A.I.C.s and create their eliminations.
- Find an XOR.
- Choose an edge to connect.
- Connect it to another XOR with valid NAND.
- NAND = either or neither — never both.
- Non-connected edges form resultant OR.
- If OR produces eliminations — you're done.
- If not — expand from non-connected edge and keep chaining.
- Mix Rows, Columns and Boxes as needed.
- ERi swaps direction: Row in → Col out | Col in → Row out.
- Every non-connected edge between two nodes is potential elimination.
- XOR → NAND → XOR → NAND → XOR ...: Resultant OR{First edge, Last edge}.

## 11. XOR Gate Formation in Sudoku — Single Digit R/C/B Slices

**Premise:**
For each cell, Sudoku enforces global XOR constraint: exactly one digit assigned to each of 81 cells.
Dually, for each digit, Sudoku enforces: exactly one cell contains that digit in each sector (Row, Column, Box).
Thus, Sudoku is system of native XOR constraints, not heuristic rules.
Each sector constraint can be written as: XOR(sector) = 1.

**Sector Representation:**
Fix digit d. Define following sector sets (BitSets of cells):
- Rᵢ(d): candidate cells for digit d in row i
- Cⱼ(d): candidate cells for digit d in column j
- Bₖ(d): candidate cells for digit d in box k

Each sector is intersection of: global digit-d candidate set and structure.
Selected Row, Column, or Box acts as Domain Sector for its XOR constraint.

**XOR from Slice Intersections (Line–Box Case):**
Consider row–box interaction for digit d.
Let R be row {Domain Sector}; Bₐ, Bᵦ, B𝑐 be three boxes intersecting that row.
Their intersections with R form three mini-sectors.
Then: R(d) = (R ∩ Bₐ) ∪ (R ∩ Bᵦ) ∪ (R ∩ B𝑐).
Define slice segments: Sₐ = R ∩ Bₐ; Sᵦ = R ∩ Bᵦ; S𝑐 = R ∩ B𝑐.
For digit d, each mini-sector is one logical proposition: digit d occurs somewhere within that slice.
Number of candidate cells inside mini-sector does not change that proposition.

**Slice Elimination Condition:**
Given condition: S𝑐 = ∅, row slice collapses to: R(d) = Sₐ ∪ Sᵦ.
Only two mini-sector propositions remain available for digit d.

**Resulting XOR Gate:**
Since Sudoku enforces: XOR(R(d)) = 1, we obtain explicit XOR gate: XOR(Sₐ, Sᵦ) = 1.
Exactly one of two mini-sectors contains digit d.
This is true logical XOR, derived directly from sector constraint — not heuristic or pattern rule.

**Bidirectional Propagation:**
XOR gate enforces following implications:
- If Sₐ = 0 → Sᵦ = 1
- If Sᵦ = 0 → Sₐ = 1
- If Sₐ = 1 → Sᵦ = 0
- If Sᵦ = 1 → Sₐ = 0
Propagation is bidirectional and arises automatically from sector XOR.

**Generalization Across Units:**
Same construction applies symmetrically to all unit interactions:
| Constraint | Slice Decomposition |
|---|---|
| R × B | R = (R ∩ Bₐ) ⊕ (R ∩ Bᵦ) |
| C × B | C = (C ∩ Bₐ) ⊕ (C ∩ Bᵦ) |
| B × R | B = (B ∩ Rₐ) ⊕ (B ∩ Rᵦ) |
| B × C | B = (B ∩ Cₐ) ⊕ (B ∩ Cᵦ) |

Each case requires one slice to be empty for XOR to collapse to exactly two operands.

**Interpretation:**
- Sudoku constraints are native XOR gates
- Rows, Columns, and Boxes are structural sectors
- Selected sector acts as domain sector
- Slice intersections form mini-sector logical operands
- Mini-sector represents where digit occurs, not individual candidate
- Empty slices remove degrees of freedom
- Two remaining slices expose structural XOR
- XOR gates emerge structurally, without inference rules

**Conclusion:**
Sudoku solving is discovery and propagation of XOR gates over intersecting slices.
Single-digit strong links are direct consequences of: XOR(slice set) = 1.
Formulation makes logic explicit, sector-based, and algorithmically discoverable.
