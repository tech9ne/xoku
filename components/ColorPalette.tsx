"use client";
const H = ["FFC059","F7DE8F","B1A5F3","DCD4FC","F7A5A7","FFD2D2",
  "86E8D0","CEFBED","86F280","D7FFD7","33CCFF","FFFF00"];
export type ColorMode = "default" | "cands" | "cells";
interface Props {
  active: number | null;
  second: number;
  onPick: (i: number) => void;
  onPickSecond: (i: number) => void;
  onSwap: () => void;
  onClearAll: () => void;
  visible: boolean;
  onToggleVisible: () => void;
  mode: ColorMode;
  onMode: (m: ColorMode) => void;
}
export default function ColorPalette(p: Props) {
  const c1 = p.active === null ? 8 : p.active;
  const sw = (i: number) => (
    <button key={i} title={"color " + (i + 1)}
      onClick={() => p.onPick(i)}
      onContextMenu={(e) => { e.preventDefault(); p.onPickSecond(i); }}
      className={"w-7 h-7 " + (c1 === i ? "ring-1 ring-inset ring-black/30" : "")}
      style={{ backgroundColor: "#" + H[i] }} />
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="relative w-16 h-16 shrink-0">
          <div className="absolute right-0 bottom-0 w-11 h-11 border border-[#707070]"
            style={{ backgroundColor: "#" + H[p.second] }} />
          <div className="absolute left-0 top-0 w-11 h-11 border border-[#707070]"
            style={{ backgroundColor: "#" + H[c1] }} />
          <button title="swap colors" onClick={p.onSwap}
            className="absolute -top-2 -right-2 w-5 h-5">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none"
              stroke="#909090" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 15v-3a8 8 0 0 0-8-8H6" />
              <path d="M9 1L6 4l3 3" />
            </svg>
          </button>
          <button title="reset coloring" onClick={p.onClearAll}
            className="absolute -bottom-2 -left-2 w-6 h-6 border border-[#808080] bg-white text-[11px] font-semibold">R</button>
        </div>
        <div className="flex flex-col gap-1 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="radio" name="cmode" className="w-3.5 h-3.5 accent-black"
              checked={p.mode === "default"} onChange={() => p.onMode("default")} />
            Default Mouse</label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="cmode" className="w-3.5 h-3.5 accent-black"
              checked={p.mode === "cands"} onChange={() => p.onMode("cands")} />
            Color Candidates</label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="cmode" className="w-3.5 h-3.5 accent-black"
              checked={p.mode === "cells"} onChange={() => p.onMode("cells")} />
            Color Cells</label>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px w-fit bg-[#808080] border border-[#808080]">
        {H.slice(0, 6).map((_, i) => sw(i))}
        <button title={p.visible ? "hide coloring" : "show coloring"}
          onClick={p.onToggleVisible}
          className="w-7 h-7 bg-white flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="black" strokeWidth="2">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
            <circle cx="12" cy="12" r="2.5" fill="black" />
          </svg>
        </button>
        {H.slice(6, 12).map((_, i) => sw(i + 6))}
        <div className="w-7 h-7 bg-[#ECECEC]" />
      </div>
    </div>
  );
}
