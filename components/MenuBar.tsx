"use client";
import { useState } from "react";
import type { Level } from "@/lib/sudoku/solver";
import { ALL_DIGITS } from "@/lib/sudoku/core";

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
      <div className="flex items-center flex-nowrap gap-1 px-1 h-9">
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
        <div className="flex items-center gap-0.5 ml-2 min-w-0 flex-1 overflow-x-auto">
          {ALL_DIGITS.map(d => {
            const on = p.digitFilter === d;
            const left = p.digitRemaining(d);
            return (
              <button key={d} onClick={() => p.onDigitFilter(on ? null : d)}
                title={`Highlight candidate ${d} (${left} remaining)`}
                className={`w-7 h-8 flex-shrink-0 flex items-center justify-center rounded transition-colors ${
                  on ? "bg-indigo-600 text-white" : "hover:bg-slate-300"
                } ${left === 0 && !on ? "opacity-30" : ""}`}>
                <span className="text-base font-semibold leading-none">{d}</span>
              </button>
            );
          })}
          <button onClick={() => p.onDigitFilter(p.digitFilter === "xy" ? null : "xy")}
            title="Highlight bivalue cells (exactly 2 candidates)"
            className={`w-8 h-7 flex items-center justify-center rounded transition-colors ml-0.5 ${
              p.digitFilter === "xy" ? "bg-purple-600 text-white" : "hover:bg-slate-300"
            }`}>
            <span className="inline-flex items-baseline">
              <sup className="text-[11px] font-semibold mr-0.5">x</sup>
              <span className="text-sm font-semibold">y</span>
            </span>
          </button>
          {p.digitFilter !== null && (
            <button onClick={() => p.onDigitFilter(null)}
              className="h-6 px-1 ml-0.5 rounded text-[11px] text-slate-500 hover:bg-slate-300 shrink-0">
              clear
            </button>
          )}
        </div>
      </div>

      {/* toolbar row 2: BIG undo/redo + difficulty */}
      <div className="flex items-center gap-2 px-2 h-11 bg-[#E8E8E8] border-b border-[#A0A0A0]">
        <button title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!p.canUndo} onClick={p.onUndo}
          className="w-8 h-8 flex items-center justify-center">
          <svg viewBox="0 0 32 32" className="w-8 h-8" fill={p.canUndo ? "#5588CC" : "#A8A8A8"}>
            <rect x="2" y="6" width="2" height="1"/>
            <rect x="2" y="7" width="3" height="1"/>
            <rect x="15" y="7" width="5" height="1"/>
            <rect x="2" y="8" width="4" height="1"/>
            <rect x="10" y="8" width="11" height="1"/>
            <rect x="2" y="9" width="5" height="1"/>
            <rect x="10" y="9" width="15" height="1"/>
            <rect x="2" y="10" width="24" height="1"/>
            <rect x="2" y="11" width="25" height="1"/>
            <rect x="2" y="12" width="26" height="1"/>
            <rect x="2" y="13" width="27" height="1"/>
            <rect x="2" y="14" width="28" height="2"/>
            <rect x="2" y="16" width="18" height="1"/>
            <rect x="25" y="16" width="5" height="1"/>
            <rect x="2" y="17" width="16" height="1"/>
            <rect x="27" y="17" width="4" height="1"/>
            <rect x="2" y="18" width="15" height="2"/>
            <rect x="28" y="18" width="3" height="1"/>
            <rect x="29" y="19" width="2" height="1"/>
            <rect x="2" y="20" width="16" height="1"/>
            <rect x="2" y="21" width="17" height="1"/>
            <rect x="2" y="22" width="18" height="1"/>
            <rect x="2" y="23" width="19" height="2"/>
          </svg>
        </button>
        <button title="Redo (Ctrl+Y)" aria-label="Redo" disabled={!p.canRedo} onClick={p.onRedo}
          className="w-8 h-8 flex items-center justify-center">
          <svg viewBox="0 0 32 32" className="w-8 h-8" fill={p.canRedo ? "#55BB55" : "#A8A8A8"}>
            <rect x="28" y="6" width="2" height="1"/>
            <rect x="12" y="7" width="5" height="1"/>
            <rect x="27" y="7" width="3" height="1"/>
            <rect x="9" y="8" width="11" height="1"/>
            <rect x="26" y="8" width="4" height="1"/>
            <rect x="7" y="9" width="15" height="1"/>
            <rect x="25" y="9" width="5" height="1"/>
            <rect x="6" y="10" width="24" height="1"/>
            <rect x="5" y="11" width="25" height="1"/>
            <rect x="4" y="12" width="26" height="1"/>
            <rect x="3" y="13" width="27" height="1"/>
            <rect x="2" y="14" width="28" height="2"/>
            <rect x="2" y="16" width="5" height="1"/>
            <rect x="12" y="16" width="18" height="1"/>
            <rect x="1" y="17" width="4" height="1"/>
            <rect x="14" y="17" width="16" height="1"/>
            <rect x="1" y="18" width="3" height="1"/>
            <rect x="15" y="18" width="15" height="2"/>
            <rect x="1" y="19" width="2" height="1"/>
            <rect x="14" y="20" width="16" height="1"/>
            <rect x="13" y="21" width="17" height="1"/>
            <rect x="12" y="22" width="18" height="1"/>
            <rect x="11" y="23" width="19" height="2"/>
          </svg>
        </button>
        <div className="w-px h-7 bg-[#B0B0B0] mx-1" />
        <select
          className="h-9 px-2 text-xs border-2 border-[#808080] bg-white rounded-sm"
          value={p.currentLevel}
          onChange={(e) => p.onNew(e.target.value as Level)}>
          {LEVELS.map(l => <option key={l} value={l}>New {l}</option>)}
        </select>
      </div>
    </nav>
  );
}
