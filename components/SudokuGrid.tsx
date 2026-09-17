"use client";
import { ALL_DIGITS, Game, Step, candMask, countCands } from "@/lib/sudoku/core";

const cls = (...xs: (string | false | undefined)[]) => xs.filter(Boolean).join(" ");

export type DigitFilter = number | "xy" | null;

const FILTER_BG = "bg-[#B9FFB9]";
const FILTER_BG_X = "bg-[#FFB9B9]";

const PALETTE = [
  { node: "bg-blue-600 text-white ring-2 ring-white/90", cell: "bg-blue-100" },
  { node: "bg-green-600 text-white ring-2 ring-white/90", cell: "bg-green-100" },
  { node: "bg-red-600 text-white ring-2 ring-white/90", cell: "bg-red-100" },
  { node: "bg-purple-600 text-white ring-2 ring-white/90", cell: "bg-purple-100" },
  { node: "bg-teal-600 text-white ring-2 ring-white/90", cell: "bg-teal-100" },
];

const RING = [
  "ring-2 ring-inset ring-blue-400",
  "ring-2 ring-inset ring-green-500",
  "ring-2 ring-inset ring-orange-300",
  "ring-2 ring-inset ring-purple-400",
  "ring-2 ring-inset ring-teal-400",
];

interface Props {
  game: Game; sel: number; step: Step | null; showCands: boolean;
  digitFilter: DigitFilter;
  filterMode: "possible" | "excluded";
  manualColors: Map<number, number>;
  brush: number | null;
  onPaintCand: (cell: number, d: number) => void;
  onSelect: (i: number) => void; onCandClick: (cell: number, d: number) => void;
}

export default function SudokuGrid({ game, sel, step, showCands, digitFilter, filterMode, manualColors, brush, onPaintCand, onSelect, onCandClick }: Props) {
  const groupOf = new Map<number, number>();
  if (step?.cellGroups)
    for (const grp of step.cellGroups) for (const c of grp.cells) groupOf.set(c, grp.color % 5);
  const nodeOf = new Map<number, number>();
  if (step?.candColors)
    for (const nc of step.candColors) nodeOf.set(nc.cell * 10 + nc.cand, nc.color % 5);
  const hasRich = groupOf.size > 0 || nodeOf.size > 0;

  // center of candidate d in cell, in 0-100 viewBox units
  const candPos = (cell: number, d: number) => {
    const r = Math.floor(cell / 9), c = cell % 9;
    return {
      x: ((c + (((d - 1) % 3) + 0.5) / 3) / 9) * 100,
      y: ((r + (Math.floor((d - 1) / 3) + 0.5) / 3) / 9) * 100,
    };
  };

  return (
    <div className="relative w-[min(92vw,540px)] aspect-square select-none touch-manipulation">
      <div className="absolute inset-0 grid grid-cols-9 grid-rows-9 bg-white border-2 border-black shadow">
        {Array.from({ length: 81 }, (_, i) => {
          const r = Math.floor(i / 9), c = i % 9;
          const value = game.values[i];
          const wrong = value !== 0 && !game.given[i] && value !== game.solution[i];
          const pattern = step?.patternCells.includes(i);
          const placing = step?.placements.some(p => p.cell === i);
          const selected = sel === i;
          const bi = value === 0 && countCands(game.cands[i]) === 2;

          let filterBg: string | undefined;
          if (digitFilter === "xy") { if (bi) filterBg = FILTER_BG; }
          else if (typeof digitFilter === "number" && value === 0) {
            const has = (game.cands[i] & candMask(digitFilter)) !== 0;
            if (filterMode === "excluded" ? !has : has) filterBg = filterMode === "excluded" ? FILTER_BG_X : FILTER_BG;
          }

          const manual = manualColors.get(i);
          const manualCell = manual !== undefined ? PALETTE[manual % 5].cell : undefined;

          // selection is an OUTLINE (yellow, thick) - never a background -
          // so digit highlights, hint tints and pattern colors stay visible
          const outline = selected ? "ring-[3px] ring-inset ring-[#FFFF00] z-10" : "";
          // priority: hint placement > hint sets > hint pattern > manual > filter
          const bg = placing ? "bg-green-200"
            : groupOf.has(i) ? PALETTE[groupOf.get(i)!].cell
            : pattern ? "bg-sky-100"
            : manualCell ?? filterBg;

          const valueCls = wrong ? "text-red-600"
            : game.given[i] ? "text-slate-900"
            : "text-[#0000FF]";

          return (
            <div key={i}
              className={cls("relative border border-[#C0C0C0] flex items-center justify-center cursor-pointer",
                (c === 2 || c === 5) && "border-r-2 border-r-black",
                (r === 2 || r === 5) && "border-b-2 border-b-black",
                outline,
                manual !== undefined && RING[manual % 5],
                bg)}
              onClick={() => onSelect(selected ? -1 : i)}
              title={value !== 0 ? undefined : "tap to select; long-press paints the active color; right-click a pencil digit excludes it"}>
              {value !== 0 ? (
                <span className={cls("text-2xl sm:text-3xl font-medium", valueCls)}>
                  {value}
                </span>
              ) : showCands ? (
                <div className="grid grid-cols-3 grid-rows-3 w-full h-full text-[#646464] text-[9px] sm:text-[11px] leading-none">
                  {ALL_DIGITS.map(d => {
                    const on = (game.cands[i] & candMask(d)) !== 0;
                    const elim = step?.eliminations.some(e => e.cell === i && e.cand === d);
                    const nc = nodeOf.get(i * 10 + d);
                    const pat = step?.patternCands.some(e => e.cell === i && e.cand === d);
                    const hl = on && !elim && !pat && nc === undefined && !hasRich && (
                      (digitFilter === "xy" && bi) ||
                      (typeof digitFilter === "number" && d === digitFilter)
                    );
                    const manualNode = manualColors.get(i * 10 + d);
                    const candCls = elim
                      ? "bg-red-500 text-white rounded-full font-bold"
                      : nc !== undefined
                        ? cls(PALETTE[nc].node, "rounded-full font-bold")
                        : manualNode !== undefined
                          ? cls(PALETTE[manualNode % 5].node, "rounded-full font-bold")
                          : hasRich ? "opacity-30"
                          : pat ? "text-green-700 font-bold"
                          : hl ? "text-green-900 font-bold"
                          : undefined;
                    return (
                      <span key={d}
                        className={cls("flex items-center justify-center z-10", !on && "invisible", candCls,
                          brush !== null && on && "cursor-pointer")}
                        onClick={e => {
                          if (brush !== null && on) {
                            e.stopPropagation();
                            onPaintCand(i, d);
                          }
                        }}
                        onContextMenu={e => {
                          e.preventDefault(); e.stopPropagation();
                          if (on) onCandClick(i, d);
                        }}>
                        {d}
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {step?.links && step.links.length > 0 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-20"
          viewBox="0 0 100 100" preserveAspectRatio="none">
          {step.links
            .filter(l => !(l.from.cell === l.to.cell && l.from.cand === l.to.cand))
            .map((l, k) => {
              const a = candPos(l.from.cell, l.from.cand);
              const b = candPos(l.to.cell, l.to.cand);
              const dx = b.x - a.x, dy = b.y - a.y;
              const len = Math.hypot(dx, dy) || 1;
              const same = l.from.cell === l.to.cell;
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
              );
            })}
        </svg>
      )}
    </div>
  );
}
