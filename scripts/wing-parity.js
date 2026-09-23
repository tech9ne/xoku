const { execSync } = require("child_process");
execSync("npx tsc lib/sudoku/core.ts lib/sudoku/techniques.ts lib/sudoku/solver.ts lib/sudoku/slices.ts lib/sudoku/chain-tables.ts lib/sudoku/chain-engine.ts --rootDir lib/sudoku --outDir /tmp/xkwp --module commonjs --target es2020 --skipLibCheck", { stdio: "inherit" });
const T = require("/tmp/xkwp/techniques.js");
const E = require("/tmp/xkwp/chain-engine.js");
const S = require("/tmp/xkwp/solver.js");
const P1 = "..47.5...29....15..5891....52.49861....5.1...9.1.3..85..2856931..9...546..51498..";
const P2 = "16.3.825.83.256..152.91.3682567931849714856324836219753958.2.1661253.8..748169523";
const P3 = "31...2958629538471..81.9623..3.9781...18.359.89..1536.736981245142356789985724136";
const P4 = "5.1..3.....7..415..89.15.6..15..7346.2364157.67435....15643.78..925.......81....5";
const P5 = "5.......9.2.1...7...8...3...4...2.......5.......7.6.1...3...8...6...4.2.9.......5";
const P6 = "...67..242..4....1..4512..874.3..269..27..485..82.43178579361424..127856.2.845793";
const P7 = ".5....964467915283928364175.42.......4...27..7...63417.6.534.2..6...7..21.7.....";
const P8 = "3.2...4.565.....914...57623..32.41....21.8..4.7465192381.46....2.3.....64.65...317";
const P9 = ".2...7..6.35641..7.6782...1......7....37.....679412..831.974..5.98.56.7375..839..";
const P10 = "8..14..6..6358974...4.62...6..43..2......6...8..51..6..861.95..91...63..46.95..7";
const V = [
  ["V-INT-1 X-Ring",     "X-Wing",     P1, [{cell:26,cand:7},{cell:38,cand:7},{cell:44,cand:7},{cell:80,cand:7}]],
  ["V-INT-2 Skyscraper", "Skyscraper", P1, [{cell:40,cand:6},{cell:46,cand:6}]],
  ["V-INT-3 2-Str Kite", "2-String Kite", P1, [{cell:13,cand:6}]],
  ["V-INT-4 Remote Pair","Remote Pair",P2, [{cell:8,cand:7}]],
  ["V-INT-5 XY-Wing",    "XY-Wing",    P3, [{cell:36,cand:4},{cell:48,cand:4}]],
  ["V-COMP-1 ERI",       "ERI",        P4, [{cell:51,cand:9}]],
  ["V-COMP-2 W-Wing",    "W-Wing",     P5, [{cell:69,cand:4},{cell:74,cand:4}]],
  ["V-COMP-S S-Wing",    "S-Wing",     P5, [{cell:77,cand:8}]],
  ["V-COMP-M2",          "M(2)-Wing",  P6, [{cell:29,cand:1},{cell:41,cand:1}]],
  ["V-COMP-M3",          "M(3)-Wing",  P7, [{cell:57,cand:8}]],
  ["V-COMP-L2",          "L(2)-Wing",  P8, [{cell:58,cand:7}]],
  ["V-COMP-L3",          "L(3)-Wing",  P9, [{cell:69,cand:4}]],
  ["V-COMP-H1",          "H(1)-Wing",  P10,[{cell:72,cand:2}]],
  ["V-COMP-H2",          "H(2)-Wing",  P9, [{cell:7,cand:3},{cell:34,cand:3}]],
  ["V-COMP-H3",          "H(3)-Wing",  P8, [{cell:42,cand:9}]],
  ["V-COMP-iW",          "iW-Wing",    P9, [{cell:34,cand:1},{cell:36,cand:1}]],
];
const key = es => (es || []).map(e => e.cell * 10 + e.cand).sort((a, b) => a - b).join(",");
const finders = { xyWing: T.xyWing, wWing: T.wWing, xyzWing: T.xyzWing, alsXZ: T.alsXZ, ahsXZ: T.ahsXZ, alsXYWing: T.alsXYWing, alsChain: T.alsChain, xChain: T.xChain, xyChain: T.xyChain, singleDigitChains: T.singleDigitChains, remotePairs: T.remotePairs, chainLens: E.chainLens };
for (const [id, want, p, elims] of V) {
  const g = S.newGame([...p].map(c => c === "." ? 0 : +c));
  const steps = [];
  for (const [fnName, fn] of Object.entries(finders)) {
    let r = null; try { r = fn(g); } catch (e) { continue; }
    if (!r || typeof r !== "object") continue;
    for (const s of Array.isArray(r) ? r : [r]) if (s && s.technique && s.eliminations) steps.push(s);
  }
  const target = key(elims);
  const hit = steps.find(s => key(s.eliminations) === target);
  console.log(`${id}: ${hit ? "FOUND as '" + hit.technique + "'" + (hit.technique === want ? " [name OK]" : " [want '" + want + "']") : "MISS"}`);
}
