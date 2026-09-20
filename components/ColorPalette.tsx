"use client";
const H = ["FFC059","F7DE8F","B1A5F3","DCD4FC","B22222","FF4500","86F280","1E4BE8","4B0082","FFFF00","C0C0C0","333333"];
export type ColorMode = "default" | "cands" | "cells" | "links";
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="relative w-[4.5rem] h-[4.5rem] shrink-0">
          <div className="absolute left-6 top-6 w-12 h-12 border border-[#707070]"
            style={{ backgroundColor: "#" + H[p.second] }} />
          <div className="absolute left-0 top-0 w-12 h-12 border border-[#707070]"
            style={{ backgroundColor: "#" + H[c1] }} />
          <button title="swap colors" onClick={p.onSwap}
            className="absolute top-0 right-0 w-[18px] h-[18px]">
            <svg viewBox="0 0 20 20" className="w-[18px] h-[18px]">
              <path d="M6 6 H11 Q14 6 14 9 V14" fill="none" stroke="#9a9a9a" strokeWidth="3" strokeLinecap="round" />
              <path d="M7 2 L2 6 L7 10 Z" fill="#9a9a9a" />
              <path d="M10 13 L14 18 L18 13 Z" fill="#9a9a9a" />
            </svg>
          </button>
          <button title="reset coloring" onClick={p.onClearAll}
            className="absolute bottom-0 left-0 w-[18px] h-[18px] bg-white border border-[#909090] flex items-center justify-center">
            <img src="hodoku/reset.png" alt="R" className="w-3 h-3" />
          </button>
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
          <label className="flex items-center gap-1.5">
            <input type="radio" name="cmode" className="w-3.5 h-3.5 accent-black"
              checked={p.mode === "links"} onChange={() => p.onMode("links")} />
            Draw Links</label>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px w-fit bg-[#808080] border border-[#808080]">
        {H.slice(0, 6).map((_, i) => sw(i))}
        <button title={p.visible ? "hide coloring" : "show coloring"}
          onClick={p.onToggleVisible}
          className="w-7 h-7 bg-[#E8E8E8] flex items-center justify-center shadow-[inset_1px_1px_0_#ffffff,inset_-1px_-1px_0_#9a9a9a]">
          {p.visible
            ? <img src="hodoku/visibility_on_64x64_cc0.png" alt="" className="w-5 h-5" />
            : <img src="hodoku/visibility_off_64x64_cc0.png" alt="" className="w-5 h-5" />}
        </button>
        {H.slice(6, 12).map((_, i) => sw(i + 6))}
        <div className="w-7 h-7 bg-[#ECECEC]" />
      </div>
    </div>
  );
}
