import type { Game, Step } from "@/lib/sudoku/core";
import { candMask } from "@/lib/sudoku/core";

const boxCell = (b: number, s: number) =>
  Math.floor(b / 3) * 27 + (b % 3) * 3 + Math.floor(s / 3) * 9 + (s % 3);

export default function ProjectionPanel({ game, step, view, onPick }: {
  game: Game; step: Step | null; view: "RN" | "CN" | "BN";
  onPick: (cell: number) => void;
}) {
  const pat = new Set((step?.patternCands ?? []).map(e => e.cell * 10 + e.cand));
  const elim = new Set((step?.eliminations ?? []).map(e => e.cell * 10 + e.cand));
  const cellAt = (a: number, slot: number) =>
    view === "RN" ? a * 9 + slot
    : view === "CN" ? slot * 9 + a
    : boxCell(a, slot);
  const rowLabel = (a: number) =>
    (view === "RN" ? "R" : view === "CN" ? "C" : "B") + (a + 1);
  return (
    <div className="w-[min(92vw,540px)] lg:w-[min(100%,calc(100vh-280px))] mx-auto flex flex-col gap-1">
      <div className="flex">
        <span className="w-8" />
        <div className="flex-1 text-center text-[10px] tracking-wider text-slate-500">
          DIGITS
        </div>
      </div>
      <div className="flex">
        <span className="w-8" />
        <div className="flex-1 grid grid-cols-9 text-xs text-slate-500 font-mono">
          {[1,2,3,4,5,6,7,8,9].map(d => (
            <span key={d} className="text-center">{d}</span>
          ))}
        </div>
      </div>
      <div className="flex items-stretch">
        <div className="grid grid-rows-9 w-8 text-xs text-slate-500 font-mono">
          {[0,1,2,3,4,5,6,7,8].map(a => (
            <span key={a} className="flex items-center justify-center">
              {rowLabel(a)}
            </span>
          ))}
        </div>
        <div className="flex-1 grid grid-rows-9 border-2 border-black bg-white">
          {[0,1,2,3,4,5,6,7,8].map(a => (
            <div key={a} className={"grid grid-cols-9" + (a % 3 === 0 && a > 0 ? " border-t-2 border-t-black" : "")}>
              {[1,2,3,4,5,6,7,8,9].map(d => (
                <div key={d}
                  className={"h-10 grid grid-cols-3 grid-rows-3 p-0.5 border border-[#c9ced6]" + (d % 3 === 1 && d > 1 ? " border-l-2 border-l-black" : "")}>
                  {[0,1,2,3,4,5,6,7,8].map(sl => {
                    const cell = cellAt(a, sl);
                    const on = (game.cands[cell] & candMask(d)) !== 0;
                    const key = cell * 10 + d;
                    const hi = pat.has(key)
                      ? "bg-[#86F280] text-black"
                      : elim.has(key)
                      ? "bg-[#F7A5A7] text-black"
                      : "bg-[#cfe0f4] text-[#3d7abf]";
                    return (
                      <button key={sl}
                        className="flex items-center justify-center"
                        onClick={() => { if (on) onPick(cell); }}>
                        {on ? (
                          <span className={"text-[10px] leading-4 px-1 rounded-[3px] " + hi}>
                            {sl + 1}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
