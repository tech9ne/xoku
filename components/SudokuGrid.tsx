"use client";
import { ALL_DIGITS, Game, Step, candMask, countCands } from "@/lib/sudoku/core";

const cls = (...xs: (string | false | undefined)[]) => xs.filter(Boolean).join(" ");

export type DigitFilter = number | "xy" | null;

const FILTER_BG = "bg-[#B9FFB9]";
const FILTER_BG_X = "bg-[#FFB9B9]";
const HINT_COLORS = [
  { node: "bg-[#7FBBFF] text-black", cell: "bg-[#7FBBFF]/20" },
  { node: "bg-[#3FDA65] text-black", cell: "bg-[#3FDA65]/20" },
  { node: "bg-[#FF8800] text-black", cell: "bg-[#FF8800]/20" },
  { node: "bg-[#9D4EDD] text-white", cell: "bg-[#9D4EDD]/20" },
  { node: "bg-[#FF00FF] text-white", cell: "bg-[#FF00FF]/20" },
  { node: "bg-[#800000] text-white", cell: "bg-[#800000]/20" },
];
const H = ["FFC059","F7DE8F","B1A5F3","DCD4FC","F7A5A7","FFD2D2","86E8D0","CEFBED","86F280","D7FFD7","33CCFF","FFFF00"];
const MANUAL_COLORS = H.map(h => ({ node: `bg-[#${h}] text-black`, cell: `bg-[#${h}]/20` }));
const RING = H.map(h => `ring-2 ring-inset ring-[#${h}]`);

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

  const nodeOf = new Map<number, number>();
  if (step?.candColors)
    for (const nc of step.candColors) nodeOf.set(nc.cell * 10 + nc.cand, nc.color % 6);
  const patSet = new Set((step?.patternCands ?? []).map(e => e.cell * 10 + e.cand));
  const placeSet = new Set((step?.placements ?? []).map(q => q.cell * 10 + q.value));
  const PALETTE = HINT_COLORS;
  const hasRich = nodeOf.size > 0 || patSet.size > 0 || placeSet.size > 0;

  // center of candidate d in cell, in 0-100 viewBox units
  const candPos = (cell: number, d: number) => {
    const r = Math.floor(cell / 9), c = cell % 9;
    return {
      x: ((c + (((d - 1) % 3) + 0.5) / 3) / 9) * 100,
      y: ((r + (Math.floor((d - 1) / 3) + 0.5) / 3) / 9) * 100,
    };
  };

  return (
    <div className="relative w-[min(92vw,540px)] lg:w-[min(100%,calc(100vh-280px))] mx-auto aspect-square select-none touch-manipulation">
      <div className="absolute inset-0 grid grid-cols-9 grid-rows-9 bg-white border-2 border-black shadow">
        {Array.from({ length: 81 }, (_, i) => {
          const r = Math.floor(i / 9), c = i % 9;
          const value = game.values[i];
          const wrong = value !== 0 && !game.given[i] && value !== game.solution[i];
          const selected = sel === i;
          const bi = value === 0 && countCands(game.cands[i]) === 2;

          let filterBg: string | undefined;
          if (digitFilter === "xy") { if (bi) filterBg = FILTER_BG; }
          else if (typeof digitFilter === "number" && value === 0) {
            const has = (game.cands[i] & candMask(digitFilter)) !== 0;
            if (filterMode === "excluded" ? !has : has) filterBg = filterMode === "excluded" ? FILTER_BG_X : FILTER_BG;
          }

          const manual = manualColors.get(i);
          const manualCell = manual !== undefined ? MANUAL_COLORS[manual].cell : undefined;

          // selection is an OUTLINE (yellow, thick) - never a background -
          // so digit highlights, hint tints and pattern colors stay visible
          const outline = selected ? "ring-[3px] ring-inset ring-[#FFFF00] z-10" : "";
          // priority: hint placement > hint sets > hint pattern > manual > filter
          const bg = manualCell ?? filterBg;

          const valueCls = wrong ? "text-red-600"
            : game.given[i] ? "text-slate-900"
            : "text-[#0000FF]";

          return (
            <div key={i}
              className={cls("relative border border-[#C0C0C0] flex items-center justify-center cursor-pointer",
                (c === 2 || c === 5) && "border-r-2 border-r-black",
                (r === 2 || r === 5) && "border-b-2 border-b-black",
                outline,
                manual !== undefined && RING[manual],
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
                    const pat = patSet.has(i * 10 + d);
                    const plc = placeSet.has(i * 10 + d);
                    const hl = on && !elim && !pat && nc === undefined && !hasRich && (
                      (digitFilter === "xy" && bi) ||
                      (typeof digitFilter === "number" && d === digitFilter)
                    );
                    const manualNode = manualColors.get(i * 10 + d);
                    const candCls = elim
                      ? "bg-[#FF7684] text-black rounded-full font-bold"
                      : nc !== undefined
                        ? cls(PALETTE[nc].node, "rounded-full font-bold")
                        : pat || plc
                          ? cls(PALETTE[1].node, "rounded-full font-bold")
                          : manualNode !== undefined
                            ? cls(MANUAL_COLORS[manualNode].node, "rounded-full font-bold")
                            : hasRich ? "opacity-30"
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
