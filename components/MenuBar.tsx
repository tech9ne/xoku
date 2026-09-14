"use client";
import { useState } from "react";
import type { Level } from "@/lib/sudoku/solver";

const LEVELS: Level[] = ["Easy", "Medium", "Hard", "Diabolical", "Extreme"];

interface Props {
  onNew: (l: Level) => void; onRestart: () => void; onImport: () => void; onExport: () => void;
  onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean;
  onCheck: () => void; onAutoSolve: () => void; onHelp: () => void;
  showCands: boolean; setShowCands: (v: boolean) => void;
}

const UndoIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);
const RedoIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <nav className="bg-slate-200 text-slate-800 text-sm flex items-stretch border-b border-slate-300">
      {Object.entries(menus).map(([title, entries]) => (
        <div key={title} className="relative flex items-stretch">
          <button className="px-3 hover:bg-slate-300"
            onClick={() => setOpen(o => (o === title ? null : title))}>{title}</button>
          {open === title && (
            <div className="absolute left-0 top-full z-30 bg-white text-slate-900 border border-slate-300 shadow-lg min-w-56">
              {entries.map(([label, action]) => (
                <button key={label} className="block w-full text-left px-3 py-1.5 hover:bg-slate-100"
                  onClick={() => { setOpen(null); action(); }}>{label}</button>
              ))}
            </div>
          )}
        </div>
      ))}
      {/* toolbar: undo / redo, HoDoKu-style, right end of the bar */}
      <div className="ml-auto flex items-center gap-0.5 px-2">
        <button title="Undo (Ctrl+Z)" disabled={!p.canUndo} onClick={p.onUndo}
          className="p-1.5 rounded hover:bg-slate-300 disabled:opacity-30 disabled:hover:bg-transparent">
          <UndoIcon />
        </button>
        <button title="Redo (Ctrl+Y)" disabled={!p.canRedo} onClick={p.onRedo}
          className="p-1.5 rounded hover:bg-slate-300 disabled:opacity-30 disabled:hover:bg-transparent">
          <RedoIcon />
        </button>
      </div>
    </nav>
  );
}
