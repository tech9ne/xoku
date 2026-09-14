"use client";
import { useState } from "react";
import type { Level } from "@/lib/sudoku/solver";

const LEVELS: Level[] = ["Easy", "Medium", "Hard", "Diabolical", "Extreme"];

interface Props {
  onNew: (l: Level) => void; onRestart: () => void; onImport: () => void; onExport: () => void;
  onUndo: () => void; onCheck: () => void; onAutoSolve: () => void; onHelp: () => void;
  showCands: boolean; setShowCands: (v: boolean) => void;
}

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
    Edit: [["Undo (Ctrl+Z)", p.onUndo]],
    Mode: [["Solve (active)", () => {}], ["Practice (soon)", () => {}], ["Edit (soon)", () => {}]],
    Options: [toggleCands],
    Puzzle: [["Check", p.onCheck], ["Auto solve", p.onAutoSolve]],
    View: [toggleCands],
    Help: [
      ["Implemented techniques…", p.onHelp],
      ["Tap cell = select (again = deselect) · long-press/right-click pencil mark = exclude · 1-9 set · Shift+1-9 candidate · Esc deselect · Ctrl+Z undo", () => {}],
    ],
  };
  return (
    <nav className="bg-slate-800 text-slate-100 text-sm flex">
      <span className="px-3 py-1.5 font-bold tracking-widest text-purple-300">XOKU</span>
      {Object.entries(menus).map(([title, entries]) => (
        <div key={title} className="relative">
          <button className="px-3 py-1.5 hover:bg-slate-700"
            onClick={() => setOpen(o => (o === title ? null : title))}>{title}</button>
          {open === title && (
            <div className="absolute left-0 top-full z-20 bg-white text-slate-900 border shadow-lg min-w-56">
              {entries.map(([label, action]) => (
                <button key={label} className="block w-full text-left px-3 py-1.5 hover:bg-slate-100"
                  onClick={() => { setOpen(null); action(); }}>{label}</button>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
