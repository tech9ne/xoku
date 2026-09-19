import type { ReactNode } from "react";
import type { Game, Step } from "@/lib/sudoku/core";
import { candMask } from "@/lib/sudoku/core";

const boxCell = (b: number, s: number) =>
  Math.floor(b / 3) * 27 + (b % 3) * 3 + Math.floor(s / 3) * 9 + (s % 3);

export default function ProjectionPanel({ game, step, view, onPick, corner }: {
  game: Game; step: Step | null; view: "RN" | "CN" | "BN";
  onPick: (cell: number) => void; corner: ReactNode;
}) {
  const pat = new Set((step?.patternCands ?? []).map(e => e.cell * 10 + e.cand));
  const elim = new Set((step?.eliminations ?? []).map(e => e.cell * 10 + e.cand));
  const cellAt = (a: number, slot: number) =>
    view === "RN" ? a * 9 + slot
    : view === "CN" ? slot * 9 + a
    : boxCell(a, slot);
  const rowLabel = (a: number) =>
    (view === "RN" ? "R" : view === "CN" ? "C" : "B") + (a + 1);
  const leftTitle = view === "CN" ? "COL" : view === "BN" ? "BOX" : "ROWS";
  return (
    <div className="w-[min(92vw,540px)] lg:w-[min(100%,calc(100vh-340px))] mx-auto flex flex-col gap-1">
      <div className="flex gap-1">
        <span className="w-14 shrink-0" />
        <div className="flex-1 text-center text-[10px] font-black tracking-wider text-[#111827] [font-family:Arial,Helvetica,sans-serif]">
          DIGITS
        </div>
      </div>
      <div className="flex gap-1">
        {corner}
        <div className="flex-1 grid grid-cols-9 text-xs text-slate-500 font-mono">
          {[1,2,3,4,5,6,7,8,9].map(d => (
            <span key={d} className="text-center">{d}</span>
          ))}
        </div>
      </div>
      <div className="flex gap-1 items-stretch">
        <div className="w-14 flex items-stretch">
          <span
            className="self-center text-[10px] font-black tracking-wider text-[#111827] [font-family:Arial,Helvetica,sans-serif]"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
            {leftTitle}
          </span>
          <div className="grid grid-rows-9 flex-1 text-xs text-slate-500 font-mono">
            {[0,1,2,3,4,5,6,7,8].map(a => (
              <span key={a} className="flex items-center justify-center">
                {rowLabel(a)}
              </span>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-0 relative aspect-square">
        <div className="absolute inset-0 grid grid-rows-9 border-2 border-black bg-white">
          {[0,1,2,3,4,5,6,7,8].map(a => (
            <div key={a} className={"grid grid-cols-9" + (a % 3 === 0 && a > 0 ? " border-t-2 border-t-black" : "")}>
              {[1,2,3,4,5,6,7,8,9].map(d => (
                <div key={d}
                  className={"overflow-hidden grid grid-cols-3 grid-rows-3 p-px border border-[#c9ced6]" + (d % 3 === 1 && d > 1 ? " border-l-2 border-l-black" : "")}>
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
                          <span
                            className={"leading-none px-0.5 rounded-[2px] " + hi}
                            style={{ fontSize: "clamp(6px, min(calc((92vw - 60px)/36), calc((100vh - 400px)/36)), 10px)" }}>
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
    </div>
  );
}
