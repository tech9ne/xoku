#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
P = "lib/sudoku/chain-engine.ts"
src = open(P).read()

def swap(old, new, label):
    global src
    n = src.count(old)
    assert n == 1, f"{label}: found {n}x - aborting"
    src = src.replace(old, new)

# 1) weakFrom: digit of a set node
swap("    const d = keyDigit(k);",
     "    const d = isSetKey(k) ? t.sets[k - 1000].digit : keyDigit(k);",
     "weakFrom digit")

# 2) tryEnding: real digits at both endpoints (THE soundness fix)
swap("    const sd = keyDigit(start), ed = keyDigit(end);",
     "    const sd = isSetKey(start) ? t.sets[start - 1000].digit : keyDigit(start);\n    const ed = isSetKey(end) ? t.sets[end - 1000].digit : keyDigit(end);",
     "tryEnding digits")

# 3) renderNotation: digitOf helper + allSame
swap("""function renderNotation(g: Game, t: ChainTables, path: number[]): string {
  const allSame = path.every(n => keyDigit(n) === keyDigit(path[0]));""",
     """function renderNotation(g: Game, t: ChainTables, path: number[]): string {
  const digitOf = (n: number) => (isSetKey(n) ? t.sets[n - 1000].digit : keyDigit(n));
  const allSame = path.every(n => digitOf(n) === digitOf(path[0]));""",
     "renderNotation allSame")

# 4) set token digit
swap("toks.push({ text: allSame ? `(${compressCells(cells)})` : setNodeStr(keyDigit(path[k]), cells), endIdx: k });",
     "toks.push({ text: allSame ? `(${compressCells(cells)})` : setNodeStr(digitOf(path[k]), cells), endIdx: k });",
     "set token digit")

# 5) hoisted digit
swap("  return allSame ? `(${keyDigit(path[0])})(${body})` : body;",
     "  return allSame ? `(${digitOf(path[0])})(${body})` : body;",
     "hoist digit")

# 6) classify: needs the tables now
swap("""function classify(path: number[]): { name: string; xr: number } {
  const digits = new Set(path.map(keyDigit));""",
     """function classify(path: number[], t: ChainTables): { name: string; xr: number } {
  const digits = new Set(path.map(n => (isSetKey(n) ? t.sets[n - 1000].digit : keyDigit(n))));""",
     "classify signature")

swap("  const { name, xr } = classify(best.path);",
     "  const { name, xr } = classify(best.path, t);",
     "classify caller")

# 7) patternCands: set highlight digit
swap("    ? t.sets[k - 1000].cells.map(c => ({ cell: c, cand: keyDigit(k) }))",
     "    ? t.sets[k - 1000].cells.map(c => ({ cell: c, cand: t.sets[k - 1000].digit }))",
     "patternCands digit")

open(P, "w").write(src)
print("    7 sites patched: set digits now come from the tables, never setId%10")
PY

echo "==> GATE 1: types"
npx tsc --noEmit && echo "types OK"
