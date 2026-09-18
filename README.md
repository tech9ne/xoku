![xoku — Sudoku trainer](public/wordmark.svg)

# Xoku

A HoDoKu-style Sudoku trainer in the browser. React + Next.js + TypeScript.

## Features
- 20+ solving techniques: singles, locked candidates, subsets, fish (X-Wing/Swordfish/Jellyfish),
  Skyscraper / 2-String Kite / Turbot, Simple Colors, Remote Pairs, XY/XYZ/W-Wings,
  Unique Rectangle Type 1, XY-Chains
- Step-by-step hints with grid highlighting and plain-English explanations
- "Show all possible steps" panel (one step per technique, like HoDoKu)
- Difficulty rating (Easy - Extreme) = sum of step scores
- Generator with uniqueness guarantee; import/export; undo; wrong-entry highlighting

## Run
    npm install
    npm run dev

## Build (static export)
    npm run build   # output in ./out — serve with any static file server

Engine written from scratch; inspired by HoDoKu (hodoku.sourceforge.net).
