"use client";
import { useEffect, useState } from "react";
import type { Level } from "@/lib/sudoku/solver";
import { ALL_DIGITS } from "@/lib/sudoku/core";
import { UNDO_PNG } from "../lib/undoPng";
import { REDO_PNG } from "../lib/redoPng";

const LEVELS: Level[] = ["Easy", "Medium", "Hard", "Diabolical", "Extreme"];

interface Props {
  onNew: (l: Level) => void; onRestart: () => void; onImport: () => void; onExport: () => void;
  onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean;
  onCheck: () => void; onAutoSolve: () => void; onHelp: () => void;
  showCands: boolean; setShowCands: (v: boolean) => void;
  digitFilter: number | "xy" | null;
  onDigitFilter: (f: number | "xy" | null) => void;
  digitRemaining: (d: number) => number;
  currentLevel: Level;
}

const UndoIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);
const RedoIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </svg>
);

export default function MenuBar(p: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Level>(p.currentLevel);
  useEffect(() => { setChosen(p.currentLevel); }, [p.currentLevel]);
  const toggleCands: [string, () => void] = [
    p.showCands ? "Hide candidates" : "Show candidates",
    () => p.setShowCands(!p.showCands),
  ];
  const menus: Record<string, [string, () => void][]> = {
    File: [
      ...LEVELS.map(l => [`New ${l}`, () => p.onNew(l)] as [string, () => void]),
      ["Restart", p.onRestart],
      ["Import…", p.onImport],
      ["Export (copy to clipboard)", p.onExport],
    ],
    Mode: [["Solve (active)", () => {}], ["Practice (soon)", () => {}], ["Edit (soon)", () => {}]],
    Options: [toggleCands],
    Puzzle: [["Check", p.onCheck], ["Auto solve", p.onAutoSolve]],
    View: [toggleCands],
    Help: [
      ["Implemented techniques…", p.onHelp],
      ["Keys: 1-9 set · Shift+1-9 candidate · arrows · Del · Ctrl+Z undo · Ctrl+Y redo · Esc deselect", () => {}],
    ],
  };
  return (
    <nav className="bg-slate-200 text-slate-800 border-b border-slate-300">
      <div className="flex items-center flex-wrap gap-1 px-1 min-h-9 py-0.5 bg-white">
        {Object.entries(menus).map(([title, entries]) => (
          <div key={title} className="relative shrink-0">
            <button className="px-2 h-7 text-xs hover:bg-slate-300 rounded-sm whitespace-nowrap"
              onClick={() => setOpen(o => (o === title ? null : title))}>{title}</button>
            {open === title && (
              <div className="absolute left-0 top-full z-30 bg-white text-slate-900 border border-slate-300 shadow-lg min-w-56 text-sm">
                {entries.map(([label, action]) => (
                  <button key={label} className="block w-full text-left px-3 py-1.5 hover:bg-slate-100"
                    onClick={() => { setOpen(null); action(); }}>{label}</button>
                ))}
              </div>
            )}
          </div>
        ))}

      </div>
      {/* toolbar row 2: BIG undo/redo + difficulty */}
      <div className="flex items-center flex-wrap gap-2 px-2 min-h-11 py-1 bg-[#D6D9DE] border-b border-[#9aa0aa]">
        <button title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!p.canUndo} onClick={p.onUndo}
          className="w-8 h-8 flex items-center justify-center">
          <span aria-hidden="true" className="inline-block w-8 h-8" style={{ backgroundColor: p.canUndo ? "#5588CC" : "#A8A8A8", WebkitMaskImage: `url(${UNDO_PNG})`, maskImage: `url(${UNDO_PNG})`, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }} />
        </button>
        <button title="Redo (Ctrl+Y)" aria-label="Redo" disabled={!p.canRedo} onClick={p.onRedo}
          className="w-8 h-8 flex items-center justify-center">
          <span aria-hidden="true" className="inline-block w-8 h-8" style={{ backgroundColor: p.canRedo ? "#55BB55" : "#A8A8A8", WebkitMaskImage: `url(${REDO_PNG})`, maskImage: `url(${REDO_PNG})`, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }} />
        </button>
        <div className="w-px h-7 bg-[#B0B0B0] mx-1" />
        <button title="Create a new sudoku" aria-label="Create a new sudoku" onClick={() => p.onNew(chosen)}
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center border border-[#808080] bg-white shadow-[1px_1px_1px_rgba(0,0,0,0.25)]">
          <svg viewBox="0 0 32 32" className="w-7 h-7">
            <rect x="1" y="1" width="30" height="30" fill="#ffffff" stroke="#404040" strokeWidth="2"/>
            <line x1="16" y1="1" x2="16" y2="31" stroke="#404040" strokeWidth="2"/>
            <line x1="1" y1="16" x2="31" y2="16" stroke="#404040" strokeWidth="2"/>
            <text x="8" y="12" fontSize="12" fontWeight="700" textAnchor="middle" fill="#000000">2</text>
            <text x="24" y="28" fontSize="12" fontWeight="700" textAnchor="middle" fill="#000000">6</text>
            <line x1="4" y1="28" x2="28" y2="4" stroke="#c02020" strokeWidth="2" strokeDasharray="4 3"/>
            <circle cx="4" cy="28" r="3" fill="#20a020"/>
            <circle cx="28" cy="4" r="3" fill="#20a020"/>
          </svg>
        </button>
        <div className="w-px h-7 bg-[#B0B0B0] mx-1" />
        <select
          className="h-9 px-2 text-xs border border-[#808080] bg-gradient-to-b from-white to-[#e0e0e0] rounded-sm shadow-[inset_1px_1px_0_#ffffff,1px_1px_1px_rgba(0,0,0,0.2)]"
          value={chosen}
          onChange={(e) => setChosen(e.target.value as Level)}>
          {LEVELS.map(l => <option key={l} value={l}>New {l}</option>)}
        </select>
        <button title="Coloring color" aria-label="Coloring color" className="w-7 h-7 flex-shrink-0 border border-[#808080]" style={{ backgroundColor: "#86F280", boxShadow: "2px 2px 0 #f2a0a0" }} />
        <div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
          {ALL_DIGITS.map(d => {
            const on = p.digitFilter === d;
            const left = p.digitRemaining(d);
            return (
              <button key={d} onClick={() => p.onDigitFilter(on ? null : d)}
                title={`Highlight candidate ${d} (${left} remaining)`}
                className={`w-7 h-8 flex-shrink-0 flex items-center justify-center rounded transition-colors ${
                  on ? "bg-indigo-600 text-white" : "hover:bg-slate-300 text-[#6e6e6e]"
                } ${left === 0 && !on ? "opacity-30" : ""}`}>
                <span className="text-base font-semibold leading-none [text-shadow:1px_2px_1px_rgba(0,0,0,0.3)]">{d}</span>
              </button>
            );
          })}
          <button onClick={() => p.onDigitFilter(p.digitFilter === "xy" ? null : "xy")}
            title="Highlight bivalue cells (exactly 2 candidates)"
            className={`w-8 h-7 flex items-center justify-center rounded transition-colors ml-0.5 ${
              p.digitFilter === "xy" ? "bg-purple-600 text-white" : "hover:bg-slate-300 text-[#6e6e6e]"
            }`}>
            <span className="inline-flex items-baseline">
              <sup className="text-[11px] font-semibold mr-0.5 [text-shadow:1px_2px_1px_rgba(0,0,0,0.3)]">x</sup>
              <span className="text-sm font-semibold [text-shadow:1px_2px_1px_rgba(0,0,0,0.3)]">y</span>
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
