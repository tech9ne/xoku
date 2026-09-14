#!/usr/bin/env bash
set -e
cd ~/xoku

echo "==> 1) Grid: accept + render manual colors, long-press to paint"
python3 - <<'PY'
P = "components/SudokuGrid.tsx"
src = open(P).read()

# props: manual color map + paint handler
OLD_PROPS = """interface Props {
  game: Game; sel: number; step: Step | null; showCands: boolean;
  digitFilter: DigitFilter;
  onSelect: (i: number) => void; onCandClick: (cell: number, d: number) => void;
}"""
NEW_PROPS = """interface Props {
  game: Game; sel: number; step: Step | null; showCands: boolean;
  digitFilter: DigitFilter;
  manualColors: Map<number, number>;
  onPaint: (cell: number) => void;
  onSelect: (i: number) => void; onCandClick: (cell: number, d: number) => void;
}"""
assert src.count(OLD_PROPS) == 1, "Props interface not found"
src = src.replace(OLD_PROPS, NEW_PROPS)

OLD_SIG = "export default function SudokuGrid({ game, sel, step, showCands, digitFilter, onSelect, onCandClick }: Props) {"
NEW_SIG = "export default function SudokuGrid({ game, sel, step, showCands, digitFilter, manualColors, onPaint, onSelect, onCandClick }: Props) {"
assert src.count(OLD_SIG) == 1, "component signature not found"
src = src.replace(OLD_SIG, NEW_SIG)

# rendering: manual ring + tint + colored cands, lowest visual priority
OLD_BG = """          const bg = selected ? "bg-yellow-200"
            : placing ? "bg-green-200"
            : groupOf.has(i) ? PALETTE[groupOf.get(i)!].cell
            : pattern ? "bg-sky-100"
            : filterBg;"""
NEW_BG = """          const manual = manualColors.get(i);
          const manualCell = manual !== undefined ? PALETTE[manual % 5].cell : undefined;
          const bg = selected ? "bg-yellow-200"
            : placing ? "bg-green-200"
            : groupOf.has(i) ? PALETTE[groupOf.get(i)!].cell
            : pattern ? "bg-sky-100"
            : manualCell
            : filterBg;"""
assert src.count(OLD_BG) == 1, "background chain not found"
src = src.replace(OLD_BG, NEW_BG)

# ring on manually colored cells (applies whatever bg wins)
OLD_DIV = """            <div key={i}
              className={cls("relative border border-slate-200 flex items-center justify-center cursor-pointer",
                (c === 2 || c === 5) && "border-r-2 border-r-slate-500",
                (r === 2 || r === 5) && "border-b-2 border-b-slate-500",
                bg)}
              onClick={() => onSelect(selected ? -1 : i)}"""
NEW_DIV = """            <div key={i}
              className={cls("relative border border-slate-200 flex items-center justify-center cursor-pointer",
                (c === 2 || c === 5) && "border-r-2 border-r-slate-500",
                (r === 2 || r === 5) && "border-b-2 border-b-slate-500",
                manual !== undefined && ["ring-2 ring-inset ring-blue-400", "ring-2 ring-inset ring-green-500", "ring-2 ring-inset ring-orange-300", "ring-2 ring-inset ring-purple-400", "ring-2 ring-inset ring-teal-400"][manual % 5],
                bg)}
              onClick={() => onSelect(selected ? -1 : i)}
              onContextMenu={e => { e.preventDefault(); onPaint(i); }}"""
assert src.count(OLD_DIV) == 1, "cell div not found"
src = src.replace(OLD_DIV, NEW_DIV)

# long-press: hold 500ms paints instead of opening the context menu
OLD_MOUNT = """export default function SudokuGrid({ game, sel, step, showCands, digitFilter, manualColors, onPaint, onSelect, onCandClick }: Props) {
  const groupOf = new Map<number, number>();"""
NEW_MOUNT = """export default function SudokuGrid({ game, sel, step, showCands, digitFilter, manualColors, onPaint, onSelect, onCandClick }: Props) {
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  const startPress = (i: number) => {
    pressTimer = setTimeout(() => { pressTimer = undefined; onPaint(i); }, 500);
  };
  const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = undefined; } };

  const groupOf = new Map<number, number>();"""
assert src.count(OLD_MOUNT) == 1, "mount body not found"
src = src.replace(OLD_MOUNT, NEW_MOUNT)

OLD_EVENTS = """              onClick={() => onSelect(selected ? -1 : i)}
              onContextMenu={e => { e.preventDefault(); onPaint(i); }}"""
NEW_EVENTS = """              onClick={() => { cancelPress(); onSelect(selected ? -1 : i); }}
              onTouchStart={() => startPress(i)}
              onTouchEnd={cancelPress}
              onTouchMove={cancelPress}
              onContextMenu={e => { e.preventDefault(); onPaint(i); }}"""
assert src.count(OLD_EVENTS) == 1, "event handlers not found"
src = src.replace(OLD_EVENTS, NEW_EVENTS)

open(P, "w").write(src)
print("    grid: manual colors rendered, long-press/right-click painting")
PY

echo "==> 2) Palette component"
cat > components/ColorPalette.tsx <<'EOF'
"use client";
const PALETTE = [
  { id: 0, cls: "bg-blue-500", ring: "ring-blue-700", name: "blue" },
  { id: 1, cls: "bg-green-500", ring: "ring-green-700", name: "green" },
  { id: 2, cls: "bg-orange-400", ring: "ring-orange-600", name: "orange" },
  { id: 3, cls: "bg-purple-500", ring: "ring-purple-700", name: "purple" },
  { id: 4, cls: "bg-teal-500", ring: "ring-teal-700", name: "teal" },
];

interface Props {
  active: number | null;
  onPick: (c: number) => void;
  onClearAll: () => void;
  anySet: boolean;
}

export default function ColorPalette({ active, onPick, onClearAll, anySet }: Props) {
  return (
    <div className="flex items-center gap-2">
      {PALETTE.map(p => (
        <button key={p.id} title={`color ${p.name}`}
          onClick={() => onPick(p.id)}
          className={`w-6 h-6 rounded-full ${p.cls} ${active === p.id ? `ring-2 ring-offset-1 ${p.ring}` : ""}`} />
      ))}
      {anySet && (
        <button onClick={onClearAll}
          className="ml-1 text-[11px] px-1.5 py-0.5 rounded text-slate-500 hover:bg-slate-200/70">
          clear
        </button>
      )}
    </div>
  );
}
EOF

echo "==> 3) Wire into page.tsx"
python3 - <<'PY'
P = "app/page.tsx"
src = open(P).read()

def insert_after(text, anchor, lines, label):
    n = text.count(anchor)
    assert n == 1, f"{label}: anchor found {n}x - aborting"
    i = text.index(anchor)
    ws = text[text.rfind("\n", 0, i) + 1:i]
    return text[:i + len(anchor)] + "\n" + "\n".join(ws + l for l in lines) + text[i + len(anchor):]

src = insert_after(src,
  'import SudokuGrid from "@/components/SudokuGrid";',
  ['import ColorPalette from "@/components/ColorPalette";'],
  "import")

src = insert_after(src,
  'const [digitFilter, setDigitFilter] = useState<number | "xy" | null>(null);',
  ['const [manualColors, setManualColors] = useState<Map<number, number>>(new Map());',
   'const [activeColor, setActiveColor] = useState<number | null>(null);'],
  "state")

# reset colors on new game
src = insert_after(src,
  'setHistory([]); setHint(null); setAllSteps(null); setDigitFilter(null);',
  ['    setManualColors(new Map());'],
  "reset")

# paint handler: toggle cell color / erase
src = insert_after(src,
  '  const undo = () => {',
  ['  const paintCell = (cell: number) => {',
   '    if (activeColor === null) return;',
   '    setManualColors(m => {',
   '      const n = new Map(m);',
   '      if (n.get(cell) === activeColor) n.delete(cell);',
   '      else n.set(cell, activeColor);',
   '      return n;',
   '    });',
   '  };',
   ''],
  "paint handler")

# pass to grid
src = insert_after(src,
  '          digitFilter={digitFilter} onSelect={setSel} onCandClick={toggleCand} />',
  ['          manualColors={manualColors} onPaint={paintCell} />'],
  "grid props — note: replaces the self-closing, see next patch")

# the insert above added a second line after a self-closing tag: fix by
# merging into one tag line
src = src.replace(
  '          digitFilter={digitFilter} onSelect={setSel} onCandClick={toggleCand} />\n          manualColors={manualColors} onPaint={paintCell} />',
  '          digitFilter={digitFilter} onSelect={setSel} onCandClick={toggleCand}\n          manualColors={manualColors} onPaint={paintCell} />')

# palette UI in the sidebar, above Hints
src = insert_after(src,
  '          <section className="bg-white rounded shadow p-3 text-sm">\n            <h2 className="font-semibold mb-2">Hints</h2>',
  ['          <section className="bg-white rounded shadow p-3">',
   '            <h2 className="font-semibold text-sm mb-2">Coloring</h2>',
   '            <ColorPalette active={activeColor} onPick={c => setActiveColor(a => (a === c ? null : c))}',
   '              onClearAll={() => setManualColors(new Map())} anySet={manualColors.size > 0} />',
   '            <p className="text-[11px] text-slate-500 mt-2">',
   '              Pick a color, then long-press (or right-click) cells to mark them. Tap the color again to put the brush away.',
   '            </p>',
   '          </section>',
   '',
   '          <section className="bg-white rounded shadow p-3 text-sm">',
   '            <h2 className="font-semibold mb-2">Hints</h2>'],
  "sidebar palette — replaces the Hints opening, deduped below")
src = src.replace(
  '          <section className="bg-white rounded shadow p-3 text-sm">\n            <h2 className="font-semibold mb-2">Hints</h2>\n          <section className="bg-white rounded shadow p-3">\n            <h2 className="font-semibold text-sm mb-2">Coloring</h2>',
  'PLACEHOLDER_NEVER_MATCHES', 0)  # no-op guard
# remove the duplicated original Hints opening that preceded our insertion
src = src.replace(
  '          <section className="bg-white rounded shadow p-3 text-sm">\n            <h2 className="font-semibold mb-2">Hints</h2>\n          <section className="bg-white rounded shadow p-3">\n            <h2 className="font-semibold text-sm mb-2">Coloring</h2>',
  '          <section className="bg-white rounded shadow p-3">\n            <h2 className="font-semibold text-sm mb-2">Coloring</h2>')

open(P, "w").write(src)
print("    page wired: state, paint handler, grid props, palette section")
PY

echo "==> Sanity checks"
grep -n "Coloring\|manualColors\|paintCell" app/page.tsx | head -n 10
grep -n "onPaint\|manualColors" components/SudokuGrid.tsx | head -n 6

echo "==> GATE"
npx tsc --noEmit && echo "types OK"
