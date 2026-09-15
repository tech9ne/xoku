#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
P = "components/SudokuGrid.tsx"
src = open(P).read()

# ---- 1) straight lines -> quadratic Beziers with perpendicular offset ----
OLD = """              const t1 = Math.min(2.2 / len, 0.4), t2 = 1 - t1;
              return (
                <line key={k}
                  x1={a.x + dx * t1} y1={a.y + dy * t1}
                  x2={a.x + dx * t2} y2={a.y + dy * t2}
                  stroke="#dc2626"
                  strokeWidth={l.strong ? 0.8 : 0.42}
                  strokeDasharray={l.strong ? undefined : "1.1 1.3"}
                  strokeLinecap="round" />
              );"""
NEW = """              const same = l.from.cell === l.to.cell;
              const trim = same ? 0.28 : Math.min(2.2 / len, 0.4);
              const t1 = trim, t2 = 1 - trim;
              const x1 = a.x + dx * t1, y1 = a.y + dy * t1;
              const x2 = a.x + dx * t2, y2 = a.y + dy * t2;
              // perpendicular bow: alternating direction per link fans
              // overlapping/parallel links apart; in-cell links bow wider
              const px = -dy / len, py = dx / len;
              const bow = same ? 1.1 : (k % 2 === 0 ? 0.9 : -0.9);
              const cx = (x1 + x2) / 2 + px * bow;
              const cy = (y1 + y2) / 2 + py * bow;
              return (
                <path key={k}
                  d={`M ${x1.toFixed(2)} ${y1.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`}
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth={l.strong ? 0.8 : 0.42}
                  strokeDasharray={l.strong ? undefined : "1.1 1.3"}
                  strokeLinecap="round" />
              );"""
n = src.count(OLD)
assert n == 1, f"link renderer block found {n}x - paste me sed -n around 'strokeDasharray'"
src = src.replace(OLD, NEW)

# ---- 2) node contrast: darker fills + white ring on chain circles ----
for old, new in [
  ('"bg-blue-500 text-white"', '"bg-blue-600 text-white ring-2 ring-white/90"'),
  ('"bg-green-500 text-white"', '"bg-green-600 text-white ring-2 ring-white/90"'),
  ('"bg-purple-500 text-white"', '"bg-purple-600 text-white ring-2 ring-white/90"'),
  ('"bg-teal-500 text-white"', '"bg-teal-600 text-white ring-2 ring-white/90"'),
]:
    n = src.count(old)
    assert n == 1, f"palette slot {old} found {n}x - aborting"
    src = src.replace(old, new)
# red slot: normalize ring opacity if the earlier red patch is present
src = src.replace('"bg-red-600 text-white ring-2 ring-white/70"',
                  '"bg-red-600 text-white ring-2 ring-white/90"')

open(P, "w").write(src)
print("    curves + node contrast applied")
PY

echo "==> GATE"
npx tsc --noEmit && echo "types OK"
