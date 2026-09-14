#!/usr/bin/env bash
set -e
cd ~/xoku

echo "==> Extracting the chainLinks builder block (lines 497-509, approx) into /tmp"
# Pull the builder block: from 'const chainLinks' to the final push with 'strong: true });'
awk '/const chainLinks: \{ from: \{ cell: number; cand: number \};/{
  capture=1
}
capture{
  print
  if(/cand: z \}, strong: true \}\);/){
    exit
  }
}' lib/sudoku/techniques.ts > /tmp/chainlinks-block.txt
wc -l /tmp/chainlinks-block.txt
head -n 2 /tmp/chainlinks-block.txt

echo "==> Removing the builder block from its wrong location"
# Delete those exact lines (they're contiguous) — find start line
START=$(grep -n "const chainLinks: \{ from: \{ cell: number; cand: number \};" lib/sudoku/techniques.ts | head -n 1 | cut -d: -f1)
END=$(grep -n "cand: z }, strong: true });" lib/sudoku/techniques.ts | head -n 1 | cut -d: -f1)
echo "    removing lines $START-$END"
sed -i "${START},${END}d" lib/sudoku/techniques.ts

echo "==> Inserting the builder ABOVE the return mk in xyChain (before line that has 'links: chainLinks')"
# Find the mk field line — the builder must go before 'return mk({' of that same statement
# Strategy: insert before the line 'const chain = [...path, j];' that precedes the mk containing chainLinks
MKLINE=$(grep -n "links: chainLinks," lib/sudoku/techniques.ts | head -n 1 | cut -d: -f1)
# Walk back to find 'return mk({'
RETLINE=$(head -n "$MKLINE" lib/sudoku/techniques.ts | grep -n "return mk({" | tail -n 1 | cut -d: -f1)
echo "    inserting builder before line $RETLINE"
# Indent the block by 14 spaces to match the surrounding code style
sed 's/^/              /' /tmp/chainlinks-block.txt > /tmp/chainlinks-indented.txt
sed -i "${RETLINE}r /tmp/chainlinks-indented.txt" lib/sudoku/techniques.ts

echo "==> Verify chainLinks is now defined and used in the same scope"
grep -n "chainLinks" lib/sudoku/techniques.ts

echo "==> HARD GATE"
npx tsc --noEmit
echo "types OK"
