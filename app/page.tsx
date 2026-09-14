"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import MenuBar from "@/components/MenuBar";
import SudokuGrid from "@/components/SudokuGrid";
import { ALL_DIGITS, Game, Step, applyStep, candMask, candsOf, cellName, cloneGame, computeCands, countCands, isSolved, placeValue } from "@/lib/sudoku/core";
import { Level, countSolutions, generatePuzzle, levelOfRating, newGame, rateGame } from "@/lib/sudoku/solver";
import { TECHNIQUE_NAMES, findAllSteps, findNextStep } from "@/lib/sudoku/techniques";
import { BUILD_TAG } from "@/lib/version";

const cls = (...xs: (string | false | undefined)[]) => xs.filter(Boolean).join(" ");
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function Home() {
  const [game, setGame] = useState<Game | null>(null);
  const [history, setHistory] = useState<Game[]>([]);
  const [level, setLevel] = useState<Level>("Easy");
  const [sel, setSel] = useState(40);
  const [hint, setHint] = useState<Step | null>(null);
  const [allSteps, setAllSteps] = useState<Step[] | null>(null);
  const [showCands, setShowCands] = useState(true);
  const [digitFilter, setDigitFilter] = useState<number | "xy" | null>(null);
  const [msg, setMsg] = useState("Generating puzzle…");
  const [seconds, setSeconds] = useState(0);
  const [gameId, setGameId] = useState(0);
  const inited = useRef(false);

  const startGame = useCallback((puzzle: number[], solution?: number[], label?: string, rating?: ReturnType<typeof rateGame>) => {
    const g = newGame(puzzle, solution);
    setGame(g);
    setHistory([]); setHint(null); setAllSteps(null); setDigitFilter(null);
    setSeconds(0); setGameId(id => id + 1);
    const r = rating ?? rateGame(g);
    setMsg(`${label ?? "New game"} — XR ${r.hardest.toFixed(1)} · ${levelOfRating(r)} · hardest: ${r.hardestTechnique}`);
  }, []);

  useEffect(() => {
    if (inited.current) return;
    inited.current = true;
    const { puzzle, solution, rating } = generatePuzzle("Easy");
    startGame(puzzle, solution, undefined, rating);
  }, [startGame]);

  const solved = !!game && isSolved(game);
  useEffect(() => {
    if (solved) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [gameId, solved]);

  const withUndo = (fn: (g: Game) => void) => {
    if (!game) return;
    const h = cloneGame(game);
    fn(h);
    setHistory(hist => [...hist.slice(-199), game]);
    setGame(h);
  };

  const newPuzzle = (lvl: Level) => {
    setLevel(lvl);
    setMsg(`Generating ${lvl} puzzle…`);
    setTimeout(() => {
      const { puzzle, solution, rating } = generatePuzzle(lvl);
      startGame(puzzle, solution, `${lvl} puzzle`, rating);
    }, 30);
  };

  const setValue = (cell: number, value: number) => {
    if (!game || cell < 0 || game.given[cell] || game.values[cell] !== 0) return;
    withUndo(g => placeValue(g, cell, value));
    setHint(null);
    setMsg(`${cellName(cell)} set to ${value}`);
  };

  const toggleCand = (cell: number, d: number) => {
    if (!game || cell < 0 || game.given[cell] || game.values[cell] !== 0) return;
    withUndo(g => { g.cands[cell] ^= candMask(d); });
    setMsg(`${cellName(cell)}: candidate ${d} ${game.cands[cell] & candMask(d) ? "excluded" : "restored"}`);
  };

  const clearCell = (cell: number) => {
    if (!game || cell < 0 || game.given[cell]) return;
    withUndo(g => { g.values[cell] = 0; g.cands = computeCands(g.values); });
  };

  const undo = () => {
    if (!history.length || !game) return;
    setGame(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    setHint(null);
    setMsg("Undo.");
  };

  const getHint = () => {
    if (!game || solved) return;
    try {
      const s = findNextStep(game);
      setAllSteps(null);
      setHint(s);
      setMsg(s ? `${s.technique} — ${s.reason}` : "No step found with the implemented techniques.");
    } catch (e) {
      setMsg(`Hint error: ${String((e as Error).message).slice(0, 120)}`);
    }
  };

  const applyHint = () => {
    if (game && hint) withUndo(g => applyStep(g, hint));
    setHint(null);
  };

  const showAll = () => {
    if (!game) return;
    if (allSteps) { setAllSteps(null); return; }
    try {
      setHint(null);
      setAllSteps(findAllSteps(game));
      setMsg("All steps found — click one to highlight it.");
    } catch (e) {
      setMsg(`Show-all error: ${String((e as Error).message).slice(0, 120)}`);
    }
  };

  const autoSolve = () => {
    if (!game) return;
    withUndo(g => {
      for (let guard = 0; guard < 500 && !isSolved(g); guard++) {
        const s = findNextStep(g);
        if (!s) break;
        applyStep(g, s);
      }
    });
    setMsg("Auto-solved as far as the implemented techniques allow.");
  };

  const check = () => {
    if (!game) return;
    const wrong = game.values.filter((v, i) => v !== 0 && !game.given[i] && v !== game.solution[i]).length;
    const empty = game.values.filter(v => v === 0).length;
    setMsg(wrong ? `${wrong} wrong value(s).` : empty ? `No mistakes — ${empty} cells to go.` : "Solved correctly!");
  };

  const restart = () => {
    if (!game) return;
    startGame(game.values.map((v, i) => (game.given[i] ? v : 0)), game.solution, "Restarted");
  };

  const exportPuzzle = () => {
    if (!game) return;
    const s = game.values.map(v => (v === 0 ? "." : String(v))).join("");
    navigator.clipboard?.writeText(s);
    setMsg(`Copied: ${s}`);
  };

  const importPuzzle = () => {
    const raw = window.prompt("Paste an 81-character puzzle (digits and . for empty):");
    if (!raw) return;
    const clean = raw.replace(/[^0-9.]/g, "");
    if (clean.length !== 81) { setMsg("Import failed: need 81 characters."); return; }
    const puzzle = [...clean].map(ch => (ch === "." ? 0 : +ch));
    if (countSolutions(puzzle, 2) !== 1) { setMsg("Import failed: invalid or non-unique puzzle."); return; }
    startGame(puzzle, undefined, "Imported puzzle");
  };

  // ---- 1-9 / x^y highlight row ----
  const toggleFilter = (f: number | "xy") => {
    if (!game) return;
    const next = digitFilter === f ? null : f;
    setDigitFilter(next);
    if (next === null) { setMsg("Highlight cleared."); return; }
    if (next === "xy") {
      const n = game.values.reduce((a, v, i) => a + (v === 0 && countCands(game.cands[i]) === 2 ? 1 : 0), 0);
      setMsg(`x^y — ${n} bivalue cells highlighted`);
    } else {
      const placed = game.values.filter(v => v === next).length;
      const n = game.values.reduce((a, v, i) => a + (v === 0 && game.cands[i] & candMask(next) ? 1 : 0), 0);
      setMsg(`${next} — placed ${placed}/9, candidate in ${n} cells`);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!game) return;
      const k = e.key;
      if (k >= "1" && k <= "9") {
        if (e.shiftKey) toggleCand(sel, +k); else setValue(sel, +k);
      } else if (k === "Escape") {
        setSel(-1);
      } else if (k.startsWith("Arrow")) {
        e.preventDefault();
        setSel(i => {
          if (i < 0) return 40;
          const r = Math.floor(i / 9), c = i % 9;
          if (k === "ArrowUp") return ((r + 8) % 9) * 9 + c;
          if (k === "ArrowDown") return ((r + 1) % 9) * 9 + c;
          if (k === "ArrowLeft") return r * 9 + (c + 8) % 9;
          return r * 9 + (c + 1) % 9;
        });
      } else if (k === "Backspace" || k === "Delete") clearCell(sel);
      else if (k.toLowerCase() === "z" && (e.ctrlKey || e.metaKey)) undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!game) return <main className="p-8 text-slate-700">Loading…</main>;

  const remaining = (d: number) => 9 - game.values.filter(v => v === d).length;
  const hasSel = sel >= 0;
  const cellLocked = !hasSel || game.given[sel] || game.values[sel] !== 0;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      <MenuBar onNew={newPuzzle} onRestart={restart} onImport={importPuzzle} onExport={exportPuzzle}
        onUndo={undo} onCheck={check} onAutoSolve={autoSolve}
        onHelp={() => setMsg(`Implemented: ${TECHNIQUE_NAMES.join(", ")}`)}
        showCands={showCands} setShowCands={setShowCands} />

      {/* HoDoKu-style candidate filter row */}
      <div className="bg-slate-200 border-b border-slate-300 flex flex-wrap items-center justify-center gap-1 px-2 py-1.5">
        {ALL_DIGITS.map(d => {
          const on = digitFilter === d;
          const left = remaining(d);
          return (
            <button key={d} onClick={() => toggleFilter(d)}
              title={`Highlight candidate ${d} (${left} remaining)`}
              className={cls("w-9 h-12 rounded-md flex items-center justify-center transition-colors",
                on ? "bg-indigo-600 text-white"
                   : "text-slate-800 hover:bg-slate-200/70",
                left === 0 && !on && "opacity-30")}>
              <span className="text-2xl font-medium leading-none">{d}</span>
            </button>
          );
        })}
        <button onClick={() => toggleFilter("xy")} title="Highlight bivalue cells (exactly 2 candidates)"
          className={cls("h-9 px-3 rounded-md border-2 text-base font-semibold shadow-sm",
            digitFilter === "xy" ? "bg-purple-600 text-white border-purple-700 shadow-md"
              : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100")}>
          <span className="inline-flex items-baseline">
            <sup className="text-[13px] font-semibold mr-0.5">x</sup>
            <span className="text-base font-semibold">y</span>
          </span>
        </button>
        {digitFilter !== null && (
          <button onClick={() => { setDigitFilter(null); setMsg("Highlight cleared."); }}
            className="h-8 px-2 rounded border text-xs bg-white text-slate-600 border-slate-300 hover:bg-slate-100">
            clear
          </button>
        )}
      </div>

      <div className="flex flex-1 items-start justify-center gap-6 p-4 flex-wrap">
        <SudokuGrid game={game} sel={sel} step={hint} showCands={showCands}
          digitFilter={digitFilter} onSelect={setSel} onCandClick={toggleCand} />

        <aside className="w-72 flex flex-col gap-4">
          <section className="bg-white rounded shadow p-3">
            <h2 className="font-semibold text-sm mb-2">Set value:</h2>
            <div className="grid grid-cols-3 gap-1">
              {ALL_DIGITS.map(d => (
                <button key={d} disabled={cellLocked}
                  className="h-12 rounded-md flex flex-col items-center justify-center transition-colors hover:bg-slate-200/70 disabled:opacity-30"
                  onClick={() => setValue(sel, d)}>
                  <span className="text-xl font-medium leading-none">{d}</span>
                  <span className="text-[10px] leading-none mt-1 text-slate-400">{remaining(d)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white rounded shadow p-3">
            <h2 className="font-semibold text-sm mb-1">Exclude candidate:</h2>
            <p className="text-[11px] text-slate-500 mb-2">
              Tinted = candidate present. Tap to exclude, tap again to restore.
              Or long-press / right-click a pencil mark in the grid.
            </p>
            <div className="grid grid-cols-3 gap-1">
              {ALL_DIGITS.map(d => (
                <button key={d} disabled={cellLocked}
                  className={cls("h-11 rounded-md flex items-center justify-center transition-colors text-slate-800 hover:bg-red-100/60 disabled:opacity-30",
                    hasSel && game.cands[sel] & candMask(d) ? "bg-red-100" : "")}
                  onClick={() => toggleCand(sel, d)}>
                  <span className="text-xl font-medium leading-none">{d}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white rounded shadow p-3 text-sm">
            <h2 className="font-semibold mb-2">Hints</h2>
            <div className="flex flex-wrap gap-1 mb-2">
              <button className="px-2 py-1 border rounded hover:bg-slate-100" onClick={getHint}>Get next hint</button>
              <button className="px-2 py-1 border rounded hover:bg-slate-100 disabled:opacity-40"
                disabled={!hint} onClick={applyHint}>Apply</button>
              <button className="px-2 py-1 border rounded hover:bg-slate-100" onClick={showAll}>
                {allSteps ? "Hide" : "Show"} all possible steps
              </button>
            </div>
            {hint && (
              <div className="mb-2 p-2 bg-yellow-50 border rounded">
                <b>{hint.technique}</b> <span className="text-xs text-slate-500">(XR {hint.score})</span>
                <p>{hint.reason}</p>
              </div>
            )}
            {allSteps && (
              <ul className="max-h-56 overflow-auto">
                {allSteps.map((s, idx) => (
                  <li key={idx}>
                    <button className="text-left w-full px-1 py-0.5 hover:bg-slate-100 flex justify-between"
                      onClick={() => { setHint(s); setMsg(`${s.technique} — ${s.reason}`); }}>
                      <span>{s.technique}</span>
                      <span className="text-xs text-slate-400">{s.score}</span>
                    </button>
                  </li>
                ))}
                {!allSteps.length && <li className="text-slate-500">No steps found.</li>}
              </ul>
            )}
          </section>

          <section className="bg-white rounded shadow p-3 text-sm">
            <h2 className="font-semibold mb-1">Active cell</h2>
            {hasSel ? (
              <p>{cellName(sel)} — {game.values[sel] !== 0
                ? `value ${game.values[sel]}${game.given[sel] ? " (given)" : ""}`
                : `candidates: ${candsOf(game.cands[sel]).join(" ") || "none"}`}
                <span className="block text-[11px] text-slate-400">tap the cell again to deselect</span>
              </p>
            ) : (
              <p className="text-slate-500">none — tap a cell to select it</p>
            )}
          </section>
        </aside>
      </div>

      <footer className="bg-slate-800 text-slate-200 text-xs px-4 py-2 flex gap-4 flex-wrap">
        <span>Level: {level}</span>
        <span>Build: {BUILD_TAG}</span>
        <span>Time: {mmss(seconds)}</span>
        <span>Progress: {81 - game.values.filter(v => v === 0).length}/81</span>
        {solved && <span className="text-green-400 font-bold">Solved!</span>}
        <span className="flex-1">{msg}</span>
      </footer>
    </main>
  );
}
