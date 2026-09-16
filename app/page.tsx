"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import MenuBar from "@/components/MenuBar";
import SudokuGrid from "@/components/SudokuGrid";
import ColorPalette from "@/components/ColorPalette";
import { ALL_DIGITS, Game, Step, applyStep, candMask, candsOf, cellName, cloneGame, computeCands, countCands, isSolved, placeValue } from "@/lib/sudoku/core";
import { Level, countSolutions, generatePuzzle, levelOfRating, newGame, rateGame } from "@/lib/sudoku/solver";
import { TECHNIQUE_NAMES, findAllSteps, findNextStep } from "@/lib/sudoku/techniques";
import { BUILD_TAG } from "@/lib/version";

const cls = (...xs: (string | false | undefined)[]) => xs.filter(Boolean).join(" ");
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function Home() {
  const [game, setGame] = useState<Game | null>(null);
  const [history, setHistory] = useState<Game[]>([]);
  const [future, setFuture] = useState<Game[]>([]);
  const [solutionPath, setSolutionPath] = useState<string[]>([]);
  const [level, setLevel] = useState<Level>("Easy");
  const [sel, setSel] = useState(40);
  const [hint, setHint] = useState<Step | null>(null);
  const [allSteps, setAllSteps] = useState<Step[] | null>(null);
  const [showCands, setShowCands] = useState(true);
  const [manualColors, setManualColors] = useState<Map<number, number>>(new Map());
  const [activeColor, setActiveColor] = useState<number | null>(null);
  const [digitFilter, setDigitFilter] = useState<number | "xy" | null>(null);
  const [msg, setMsg] = useState("Generating puzzle…");
  const [seconds, setSeconds] = useState(0);
  const [gameId, setGameId] = useState(0);
  const [generating, setGenerating] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const inited = useRef(false);

  const startGame = useCallback((puzzle: number[], solution?: number[], label?: string, rating?: ReturnType<typeof rateGame>) => {
    const g = newGame(puzzle, solution);
    setGame(g);
    setHistory([]); setHint(null); setAllSteps(null); setDigitFilter(null);
    setManualColors(new Map());
    setFuture([]);
    setSolutionPath([]);
    setSeconds(0); setGameId(id => id + 1);
    workerRef.current?.terminate();
    workerRef.current = null;
    setGenerating(false);
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
    setFuture([]);
    setHistory(hist => [...hist.slice(-199), game]);
    setGame(h);
  };

  const recordStep = (s: Step) => {
    setSolutionPath(p => [...p, s.technique]);
  };

  const newPuzzle = (lvl: Level) => {
    setLevel(lvl);
    setGenerating(true);
    setMsg(`Generating ${lvl} puzzle…`);
    workerRef.current?.terminate();
    try {
      const w = new Worker(new URL("../lib/sudoku/generate.worker.ts", import.meta.url));
      workerRef.current = w;
      w.onmessage = (e: MessageEvent) => {
        workerRef.current = null;
        w.terminate();
        setGenerating(false);
        startGame(e.data.puzzle, e.data.solution, `${lvl} puzzle`, e.data.rating);
      };
      w.onerror = () => {
        workerRef.current = null;
        w.terminate();
        setTimeout(() => {
          setGenerating(false);
          const res = generatePuzzle(lvl);
          startGame(res.puzzle, res.solution, `${lvl} puzzle · main thread`, res.rating);
        }, 30);
      };
      w.postMessage({ level: lvl });
    } catch {
      setTimeout(() => {
        setGenerating(false);
        const res = generatePuzzle(lvl);
        startGame(res.puzzle, res.solution, `${lvl} puzzle · main thread`, res.rating);
      }, 30);
    }
  };

  const setValue = (cell: number, value: number) => {
    if (!game || cell < 0 || game.given[cell] || game.values[cell] !== 0) return;
    withUndo(g => placeValue(g, cell, value));
    setHint(null);
    setMsg(`${cellName(cell)} set to ${value}`);
    setSolutionPath(p => [...p, `Direct: ${cellName(cell)} = ${value}`]);
  };

  const toggleCand = (cell: number, d: number) => {
    if (!game || cell < 0 || game.given[cell] || game.values[cell] !== 0) return;
    withUndo(g => { g.cands[cell] ^= candMask(d); });
    setMsg(`${cellName(cell)}: candidate ${d} ${game.cands[cell] & candMask(d) ? "excluded" : "restored"}`);
  };

  const paintCand = (cell: number, d: number) => {
    if (activeColor === null) return;
    setManualColors(m => {
      const next = new Map(m);
      const key = cell * 10 + d;
      if (next.get(key) === activeColor) next.delete(key);
      else next.set(key, activeColor);
      return next;
    });
  };

  const clearCell = (cell: number) => {
    if (!game || cell < 0 || game.given[cell]) return;
    withUndo(g => { g.values[cell] = 0; g.cands = computeCands(g.values); });
  };

  const redo = () => {
    if (!future.length || !game) return;
    setHistory(h => [...h, game]);
    setGame(future[future.length - 1]);
    setFuture(future.slice(0, -1));
    setHint(null);
    setMsg("Redo.");
  };

  const undo = () => {
    if (!history.length || !game) return;
    setFuture(f => [...f, game]);
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
    if (game && hint) {
      withUndo(g => applyStep(g, hint));
      recordStep(hint);
    }
    setHint(null);
  };

  const showAll = () => {
    if (!game) return;
    if (allSteps) { setAllSteps(null); return; }
    setHint(null);
    setAllSteps(findAllSteps(game));
    setMsg("All steps found — click one to highlight it.");
  };

  const autoSolve = () => {
    if (!game) return;
    const taken: string[] = [];
    withUndo(g => {
      for (let guard = 0; guard < 500 && !isSolved(g); guard++) {
        const s = findNextStep(g);
        if (!s) break;
        applyStep(g, s);
        taken.push(s.technique);
      }
    });
    setSolutionPath(p => [...p, ...taken]);
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
      else if (k.toLowerCase() === "y" && (e.ctrlKey || e.metaKey)) redo();
      else if (k.toLowerCase() === "z" && e.shiftKey && (e.ctrlKey || e.metaKey)) redo();
      else if (k.toLowerCase() === "z" && (e.ctrlKey || e.metaKey)) undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (!game) return <main className="p-8 text-slate-700">Loading…</main>;

  const remaining = (d: number) => 9 - game.values.filter(v => v === d).length;
  const hasSel = sel >= 0;
  const cellLocked = !hasSel || game.given[sel] || game.values[sel] !== 0;
  const progress = Math.round((81 - game.values.filter(v => v === 0).length) / 81 * 100);

  return (
    <main className="min-h-screen bg-[#F2F2F2] text-slate-900 flex flex-col">
      {/* ZONE 1: menu + toolbar (MenuBar already carries both) */}
      <MenuBar onNew={newPuzzle} onRestart={restart} onImport={importPuzzle} onExport={exportPuzzle}
        onUndo={undo} onRedo={redo} canUndo={history.length > 0} canRedo={future.length > 0} onCheck={check} onAutoSolve={autoSolve}
        onHelp={() => setMsg(`Implemented: ${TECHNIQUE_NAMES.join(", ")}`)}
        showCands={showCands} setShowCands={setShowCands}
        digitFilter={digitFilter} onDigitFilter={(f) => { if (f === null) { setDigitFilter(null); setMsg("Highlight cleared."); } else toggleFilter(f); }}
        digitRemaining={remaining} />

      {/* ZONE 2+3: grid left, panel right */}
      <div className="flex flex-1 items-start justify-center gap-4 p-3 flex-wrap">
        <SudokuGrid game={game} sel={sel} step={hint} showCands={showCands}
          digitFilter={digitFilter}
          manualColors={manualColors} brush={activeColor} onPaintCand={paintCand}
          onSelect={setSel} onCandClick={toggleCand} />

        {/* HoDoKu right panel: Summary, Active Cell, Set Value, Exclude, buttons, Solution path */}
        <aside className="w-64 flex flex-col gap-1.5 text-sm">
          {/* Summary */}
          <section className="bg-white border border-[#B0B0B0]">
            <div className="bg-[#E8E8E8] border-b border-[#B0B0B0] px-2 py-0.5 text-xs font-bold">Summary</div>
            <div className="px-2 py-1 text-xs space-y-0.5">
              <div className="flex justify-between"><span>Level</span><span>{level}</span></div>
              <div className="flex justify-between"><span>Time</span><span>{mmss(seconds)}</span></div>
              <div className="flex justify-between"><span>Progress</span><span>{progress}%</span></div>
              <div className="flex justify-between"><span>Build</span><span>{BUILD_TAG}</span></div>
            </div>
          </section>

          {/* Active Cell */}
          <section className="bg-white border border-[#B0B0B0]">
            <div className="bg-[#E8E8E8] border-b border-[#B0B0B0] px-2 py-0.5 text-xs font-bold">Active Cell</div>
            <div className="px-2 py-1 text-xs">
              {hasSel ? `${cellName(sel)} — ${game.values[sel] !== 0
                ? `value ${game.values[sel]}${game.given[sel] ? " (given)" : ""}`
                : `candidates: ${candsOf(game.cands[sel]).join(" ") || "none"}`}`
                : "none"}
            </div>
          </section>

          {/* Set Value */}
          <section className="bg-white border border-[#B0B0B0]">
            <div className="bg-[#E8E8E8] border-b border-[#B0B0B0] px-2 py-0.5 text-xs font-bold">Set Value</div>
            <div className="grid grid-cols-9 gap-px p-1">
              {ALL_DIGITS.map(d => (
                <button key={d} disabled={cellLocked}
                  className="h-7 border border-[#C0C0C0] bg-white text-xs hover:bg-[#E0E0E0] disabled:opacity-40"
                  onClick={() => setValue(sel, d)}>
                  {d}
                </button>
              ))}
            </div>
          </section>

          {/* Exclude Candidates */}
          <section className="bg-white border border-[#B0B0B0]">
            <div className="bg-[#E8E8E8] border-b border-[#B0B0B0] px-2 py-0.5 text-xs font-bold">Exclude Candidates</div>
            <div className="grid grid-cols-9 gap-px p-1">
              {ALL_DIGITS.map(d => (
                <button key={d} disabled={cellLocked}
                  className={cls("h-7 border text-xs disabled:opacity-40",
                    hasSel && game.cands[sel] & candMask(d)
                      ? "border-[#C0C0C0] bg-[#F8D0D0]" : "border-[#C0C0C0] bg-white",
                    !hasSel && "opacity-40")}
                  onClick={() => toggleCand(sel, d)}>
                  {d}
                </button>
              ))}
            </div>
          </section>

          {/* Coloring */}
          <section className="bg-white border border-[#B0B0B0]">
            <div className="bg-[#E8E8E8] border-b border-[#B0B0B0] px-2 py-0.5 text-xs font-bold">Coloring</div>
            <div className="px-2 py-1.5">
              <ColorPalette active={activeColor} onPick={c => setActiveColor(a => (a === c ? null : c))}
                onClearAll={() => setManualColors(new Map())} anySet={manualColors.size > 0} />
            </div>
          </section>

          {/* Action buttons */}
          <section className="flex flex-col gap-1">
            <button className="h-7 border border-[#B0B0B0] bg-white text-xs hover:bg-[#E0E0E0]"
              onClick={showAll}>{allSteps ? "Hide" : "Show"} all possible steps</button>
            <button className="h-7 border border-[#B0B0B0] bg-white text-xs hover:bg-[#E0E0E0]"
              onClick={autoSolve}>Solve puzzle automatically</button>
          </section>

          {/* Solution path */}
          <section className="bg-white border border-[#B0B0B0] flex-1 min-h-0 flex flex-col">
            <div className="bg-[#E8E8E8] border-b border-[#B0B0B0] px-2 py-0.5 text-xs font-bold">Solution path</div>
            <ol className="overflow-y-auto text-[11px] px-2 py-1 max-h-64 flex-1">
              {solutionPath.map((t, i) => (
                <li key={i} className="py-px border-b border-[#F0F0F0] last:border-0">
                  <span className="text-slate-400 mr-1">{i + 1}.</span>{t}
                </li>
              ))}
              {!solutionPath.length && <li className="text-slate-400 italic">no steps yet — solve or hint to begin</li>}
            </ol>
          </section>
        </aside>
      </div>

      {/* All-steps list (toggleable, above the hints block) */}
      {allSteps && (
        <div className="px-3 pb-1">
          <div className="bg-white border border-[#B0B0B0] max-h-40 overflow-y-auto">
            {allSteps.map((s, idx) => (
              <button key={idx} className="block w-full text-left px-2 py-0.5 text-xs hover:bg-[#E0E0E0] flex justify-between border-b border-[#F0F0F0] last:border-0"
                onClick={() => { setHint(s); setMsg(`${s.technique} — ${s.reason}`); }}>
                <span>{s.technique}</span>
                <span className="text-slate-400">XR {s.score}</span>
              </button>
            ))}
            {!allSteps.length && <div className="px-2 py-1 text-xs text-slate-400">No steps found.</div>}
          </div>
        </div>
      )}

      {/* ZONE 4: Hints block — full width, bottom, HoDoKu signature */}
      <div className="bg-white border-t border-[#B0B0B0] px-3 py-2 mt-auto">
        <div className="flex items-start gap-2">
          <div className="flex flex-col gap-1 shrink-0">
            <button className="h-7 px-3 border border-[#B0B0B0] bg-[#E8E8E8] text-xs hover:bg-[#D8D8D8]"
              onClick={getHint}>Next Hint</button>
            <button className="h-7 px-3 border border-[#B0B0B0] bg-[#E8E8E8] text-xs hover:bg-[#D8D8D8] disabled:opacity-40"
              disabled={!hint} onClick={applyHint}>Execute</button>
          </div>
          <div className="flex-1 bg-[#FAFAFA] border border-[#D0D0D0] px-2 py-1 text-xs min-h-10 overflow-y-auto max-h-20">
            {hint ? (
              <p><b className="text-[#1a5276]">{hint.technique}:</b> {hint.reason}</p>
            ) : (
              <p className="text-slate-500">{msg}</p>
            )}
          </div>
        </div>
      </div>

      {/* Status bar — their format: coloring · level · progress · mode · cell */}
      <footer className="bg-[#404040] text-[#E8E8E8] text-[11px] px-3 py-0.5 flex gap-3 flex-wrap">
        <span>Coloring: {activeColor === null ? "none" : "active"}</span>
        <span>{level} · {progress}%</span>
        <span>{solved ? "Solved" : "Playing"} {hasSel ? cellName(sel) : ""}</span>
        <span className="flex-1 truncate">{msg}</span>
        <span>{mmss(seconds)}</span>
      </footer>
    </main>
  );
}
