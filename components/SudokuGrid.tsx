"use client";
import { ALL_DIGITS, Game, Step, candMask, countCands } from "@/lib/sudoku/core";

const cls = (...xs: (string | false | undefined)[]) => xs.filter(Boolean).join(" ");

export type DigitFilter = number | "xy" | null;

// HoDoKu's candidate-highlight green
const FILTER_BG = "bg-[#B9FFB9]";

interface Props {
  game: Game; sel: number; step: Step | null; showCands: boolean;
  digitFilter: DigitFilter;
  onSelect: (i: number) => void; onCandClick: (cell: number, d: number) => void;
}

export default function SudokuGrid({ game, sel, step, showCands, digitFilter, onSelect, onCandClick }: Props) {
  return (
    <div className="w-[min(92vw,540px)] aspect-square grid grid-cols-9 grid-rows-9 bg-white border-2 border-slate-500 shadow select-none touch-manipulation">
      {Array.from({ length: 81 }, (_, i) => {
        const r = Math.floor(i / 9), c = i % 9;
        const value = game.values[i];
        const wrong = value !== 0 && !game.given[i] && value !== game.solution[i];
        const pattern = step?.patternCells.includes(i);
        const placing = step?.placements.some(p => p.cell === i);
        const selected = sel === i;
        const bi = value === 0 && countCands(game.cands[i]) === 2;

        // 1-9 / x/y filter: ONLY candidate cells highlight (HoDoKu style)
        let filterBg: string | undefined;
        if (digitFilter === "xy") {
          if (bi) filterBg = FILTER_BG;
        } else if (typeof digitFilter === "number" && value === 0) {
          if (game.cands[i] & candMask(digitFilter)) filterBg = FILTER_BG;
        }

        // one background per cell, in priority order:
        const bg = selected ? "bg-yellow-200"
          : placing ? "bg-green-200"
          : pattern ? "bg-sky-100"
          : filterBg;

        const valueCls = wrong ? "text-red-600"
          : game.given[i] ? "text-slate-900"
          : "text-blue-700";

        return (
          <div key={i}
            className={cls("relative border border-slate-200 flex items-center justify-center cursor-pointer",
              (c === 2 || c === 5) && "border-r-2 border-r-slate-500",
              (r === 2 || r === 5) && "border-b-2 border-b-slate-500",
              bg)}
            onClick={() => onSelect(selected ? -1 : i)}
            title={value !== 0 ? undefined : "tap to select (tap again to deselect); long-press or right-click a digit to exclude it"}>
            {value !== 0 ? (
              <span className={cls("text-2xl sm:text-3xl font-medium", valueCls)}>
                {value}
              </span>
            ) : showCands ? (
              <div className="grid grid-cols-3 grid-rows-3 w-full h-full text-[9px] sm:text-[11px] leading-none">
                {ALL_DIGITS.map(d => {
                  const on = (game.cands[i] & candMask(d)) !== 0;
                  const elim = step?.eliminations.some(e => e.cell === i && e.cand === d);
                  const pat = step?.patternCands.some(e => e.cell === i && e.cand === d);
                  const hl = on && !elim && !pat && (
                    (digitFilter === "xy" && bi) ||
                    (typeof digitFilter === "number" && d === digitFilter)
                  );
                  const candCls = elim ? "text-red-600 font-bold line-through"
                    : pat ? "text-green-700 font-bold"
                    : hl ? "text-green-900 font-bold"
                    : undefined;
                  return (
                    <span key={d}
                      className={cls("flex items-center justify-center", !on && "invisible", candCls)}
                      onContextMenu={e => {
                        e.preventDefault();
                        e.stopPropagation();
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
  );
}
