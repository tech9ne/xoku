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
