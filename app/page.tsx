"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import MenuBar from "@/components/MenuBar";
import ProjectionPanel from "@/components/ProjectionPanel";
import SudokuGrid from "@/components/SudokuGrid";
import ColorPalette from "@/components/ColorPalette";
import { ALL_DIGITS, Game, Step, applyStep, candMask, candsOf, cellName, cloneGame, computeCands, countCands, isSolved, placeValue } from "@/lib/sudoku/core";
import { Level, countSolutions, generatePuzzle, levelOfRating, newGame, rateGame } from "@/lib/sudoku/solver";
import { TECHNIQUE_NAMES, findAllSteps, findNextStep } from "@/lib/sudoku/techniques";
import { BUILD_TAG } from "@/lib/version";

const cls = (...xs: (string | false | undefined)[]) => xs.filter(Boolean).join(" ");
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const TitleBar = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[#E0E0E0] border-b border-[#A0A0A0] px-2 py-1 text-xs font-bold text-slate-700">{children}</div>
);
const Panel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section className={`bg-white border border-[#A0A0A0] ${className}`}>{children}</section>
);

export default function Home() {
  const [game, setGame] = useState<Game | null>(null);
  const [history, setHistory] = useState<Game[]>([]);
  const [future, setFuture] = useState<Game[]>([]);
  const [pathSteps, setPathSteps] = useState<Step[]>([]);
  const [level, setLevel] = useState<Level>("Easy");
  const [sel, setSel] = useState(40);
  const [hint, setHint] = useState<Step | null>(null);
  const [hintMode, setHintMode] = useState<"vague" | "concrete">("concrete");
  type PanelTab = "summary" | "active" | "steps" | "path";
  const [panelTab, setPanelTab] = useState<PanelTab>("summary");
  const TABS: [PanelTab, string][] = [["summary","Summary"],["path","Solution path"],["steps","All possible steps"],["active","Active Cell"]];
  const PROGRESS = new Set(["Single", "Subset"]);
  const hintCells = (st: Step) => {
    const x = st as any;
    const cs: number[] = x.patternCells?.length ? x.patternCells :
      [...(x.candColors ?? []).map((c: { cell: number }) => c.cell),
       ...(x.eliminations ?? []).map((e: { cell: number }) => e.cell)];
    return [...new Set(cs)].map(cellName).join(", ");
  };
  const [allSteps, setAllSteps] = useState<Step[] | null>(null);
  const [showCands, setShowCands] = useState(true);
  const [filterMode, setFilterMode] = useState<"possible" | "excluded">("possible");
  const toggleFilterMode = () => setFilterMode(m => m === "possible" ? "excluded" : "possible");
  const [manualColors, setManualColors] = useState<Map<number, number>>(new Map());
  const [activeColor, setActiveColor] = useState<number | null>(8);
  const [color2, setColor2] = useState(4);
  const [colorMode, setColorMode] = useState<"default" | "cands" | "cells" | "links">("default");
  const [showHintBtns, setShowHintBtns] = useState(true);
  const [showReadout, setShowReadout] = useState(true);
  const [wingFilter, setWingFilter] = useState(0);
  const [savepoint, setSavepoint] = useState<null | { v: number[]; c: number[] }>(null);
  const [view, setView] = useState<"RC" | "RN" | "CN" | "BN">("RC");
  const [viewOpen, setViewOpen] = useState(false);
  const caret = (
    <div className="relative w-14 shrink-0">
      <button onClick={() => setViewOpen(o => !o)}
        className={"w-full h-7 rounded-md flex items-center justify-center group " + (viewOpen ? "bg-[#1f6feb]" : "hover:bg-[#1f6feb]")}>
        <svg viewBox="0 0 10 6"
          className={"w-3 h-2 transition-transform " + (viewOpen ? "rotate-180 fill-white" : "fill-black group-hover:fill-white")}>
          <path d="M0 0 L5 6 L10 0 Z" />
        </svg>
      </button>
      {viewOpen && (
        <div className="absolute z-40 mt-1 left-0 w-full border border-white bg-[#1f6feb] flex flex-col shadow">
          {(["RC", "RN", "CN", "BN"] as const).map(v => (
            <button key={v}
              onClick={() => { setView(v); setViewOpen(false); }}
              className={"h-7 text-xs font-bold text-left px-2 " + (view === v ? "bg-[#5a626b] text-white" : "text-white hover:bg-[#3b82f6]")}>
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
  const [coloringVisible, setColoringVisible] = useState(true);
  const [digitFilter, setDigitFilter] = useState<number | "xy" | null>(null);
  const [msg, setMsg] = useState("Ready — pick a difficulty, then click the New Game tile.");
  const [seconds, setSeconds] = useState(0);
  const [gameId, setGameId] = useState(0);
  const [generating, setGenerating] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const inited = useRef(false);

  const isIdle = !game || game.given.every((g) => !g);
  const startGame = useCallback((puzzle: number[], solution?: number[], label?: string, rating?: ReturnType<typeof rateGame>) => {
    const g = newGame(puzzle, solution);
    setGame(g);
    setHistory([]); setHint(null); setAllSteps(null); setDigitFilter(null);
    setManualColors(new Map());
    setFuture([]);
    setPathSteps([]);
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
    startGame(Array(81).fill(0), Array(81).fill(0));
    setMsg("Ready — pick a difficulty, then click the New Game tile.");
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
    setPathSteps(p => [...p, s]);
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
      const key = 100 + cell * 10 + d;
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

  const getHint = (mode?: unknown) => {
    if (mode === "vague" || mode === "concrete") setHintMode(mode);
    const m = mode === "vague" || mode === "concrete" ? mode : hintMode;
    if (!game || solved) return;
    try {
      const s = findNextStep(game);
      setAllSteps(null);
      setHint(s);
      setMsg(s ? (m === "vague" ? `${s.technique} in ${hintCells(s)}` : `${s.technique} — ${s.reason}`) : "No step found with the implemented techniques.");
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
    const taken: Step[] = [];
    withUndo(g => {
      for (let guard = 0; guard < 500 && !isSolved(g); guard++) {
        const s = findNextStep(g);
        if (!s) break;
        applyStep(g, s);
        taken.push(s);
      }
    });
    setPathSteps(p => [...p, ...taken]);
    setMsg("Auto-solved as far as the implemented techniques allow.");
  };

  const cancelHint = () => setHint(null);
  const solveUpTo = () => {
    if (!game || solved) return;
    const taken: Step[] = [];
    let stop: Step | null = null;
    withUndo(g => {
      for (let guard = 0; guard < 500 && !isSolved(g); guard++) {
        const st = findNextStep(g);
        if (!st) break;
        if (!PROGRESS.has(st.category)) { stop = st; return; }
        applyStep(g, st);
        taken.push(st);
      }
    });
    if (taken.length) setPathSteps(p2 => [...p2, ...taken]);
    const stopStep = stop as unknown as Step | null;
    if (stopStep) setHintMode("concrete");
    setHint(stopStep);
    setMsg(stopStep ? `Solved ${taken.length} step(s); next is ${stopStep.technique} — your turn.` : `Solved ${taken.length} step(s); nothing left in progress categories.`);
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
  const copy729 = () => {
    if (!game) return;
    const rows: string[] = [];
    for (let r = 0; r < 9; r++) {
      rows.push(Array.from({ length: 9 }, (_, c2) => {
        const i2 = r * 9 + c2;
        if (game.values[i2] !== 0) return String(game.values[i2]);
        return candsOf(game.cands[i2]).join("");
      }).join(" "));
    }
    navigator.clipboard?.writeText(rows.join("\n"));
    setMsg("Copied 729 candidate grid");
  };
  const resetCands = () => {
    if (!game) return;
    startGame([...game.values], game.solution, "Candidates reset");
  };
  const createSavepoint = () => {
    if (!game) return;
    setSavepoint({ v: [...game.values], c: [...game.cands] });
    setMsg("Savepoint created");
  };
  const restoreSavepoint = () => {
    if (!game || !savepoint) { setMsg("No savepoint stored"); return; }
    setGame({ ...game, values: [...savepoint.v], cands: [...savepoint.c] });
    setMsg("Savepoint restored");
  };
  const solutionCount = () => {
    if (!game) return;
    const n = countSolutions([...game.values], 2);
    setMsg(n === 1 ? "Solution count: 1 (unique)" : "Solution count: 2 or more");
  };

  const importPuzzle = () => {
    const raw = window.prompt("Paste an 81-character puzzle (digits and . for empty):");
    if (!raw) return;
    const clean = raw.replace(/[^0-9.]/g, "");
    if (clean.length !== 81) { setMsg("Import failed: need 81 characters."); return; }
    const puzzle = [...clean].map(ch => (ch === "." ? 0 : +ch));
    if (countSolutions(puzzle, 2) !== 1) { setMsg("Import failed: invalid or non-unique puzzle."); return; }
    startGame(puzzle, undefined, "Imported puzzle — unique solution confirmed");
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
  const peersSee = (d: number) => {
    if (!hasSel) return true;
    const r = Math.floor(sel / 9), c = sel % 9;
    for (let k = 0; k < 9; k++) if (game.values[r * 9 + k] === d || game.values[k * 9 + c] === d) return true;
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) if (game.values[(br + dr) * 9 + bc + dc] === d) return true;
    return false;
  };
  const progress = Math.round((81 - game.values.filter(v => v === 0).length) / 81 * 100);
  const BAND_HEX = (xr: number) => xr < 2 ? "#FFFFFF" : xr < 5 ? "#64FF64" : xr < 7 ? "#FFFF64" : xr < 8.5 ? "#FF9650" : "#FF6464";



  return (
    <main className="min-h-screen lg:h-screen bg-[#F2F2F2] text-slate-900 flex flex-col lg:overflow-hidden">
      <MenuBar idle={isIdle} level={level} onNew={newPuzzle} onRestart={restart} onImport={importPuzzle} onExport={exportPuzzle}
        onUndo={undo} onRedo={redo} canUndo={history.length > 0} canRedo={future.length > 0} onCheck={check} onAutoSolve={autoSolve}
        onHelp={() => setMsg(`Implemented: ${TECHNIQUE_NAMES.join(", ")}`)}
        showCands={showCands} setShowCands={setShowCands}
        digitFilter={digitFilter} dead={ALL_DIGITS.map(d => !game.cands.some(m => m & candMask(d)))} onDigitFilter={(f) => { if (f === null) { setDigitFilter(null); setMsg("Highlight cleared."); } else toggleFilter(f); }}
        digitRemaining={remaining} currentLevel={level} filterMode={filterMode} onToggleFilterMode={toggleFilterMode}
        onHintVague={() => getHint("vague")} onHintConcrete={() => getHint("concrete")}
        onHintNext={() => getHint()} onHintExecute={applyHint} onHintAbort={cancelHint}
        showHintBtns={showHintBtns} onToggleHintBtns={() => setShowHintBtns(v => !v)} showReadout={showReadout} onToggleReadout={() => setShowReadout(v => !v)} onCopy729={copy729} wingFilter={wingFilter} onWing={setWingFilter} onResetCands={resetCands} onSavepoint={createSavepoint} onRestoreSavepoint={restoreSavepoint} onSolutionCount={solutionCount} hintMode={hintMode} hasHint={!!hint} />

      <div className="flex flex-1 flex-row gap-4 p-4 lg:p-6 overflow-x-auto lg:overflow-hidden min-h-0">
        {/* GRID — generous, centered */}
        <div className="w-[94vw] shrink-0 flex flex-col gap-2 lg:min-h-0 lg:w-auto lg:flex-1 lg:shrink">
          <div className="flex flex-col items-center justify-center gap-1 lg:flex-1 lg:min-h-0 overflow-y-auto lg:overflow-y-hidden">
          
          {view === "RC" ? (
            <div className="w-[min(92vw,540px)] lg:w-[min(100%,calc(100vh-340px))] mx-auto flex flex-col gap-1">
          <div className="flex gap-1">
            <span className="w-14 shrink-0" />
            <div className="flex-1 text-center text-[10px] font-black tracking-wider text-[#111827] [font-family:Arial,Helvetica,sans-serif]">
              COL
            </div>
          </div>
          <div className="flex gap-1">
            {caret}
            <div className="flex-1 grid grid-cols-9 text-xs text-slate-500 font-mono">
              {[1,2,3,4,5,6,7,8,9].map(n => <span key={n} className="text-center">{n}</span>)}
            </div>
          </div>
          <div className="flex gap-1 items-stretch">
            <div className="w-14 flex items-stretch">
            <span
              className="self-center text-[10px] font-black tracking-wider text-[#111827] [font-family:Arial,Helvetica,sans-serif]"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
              ROWS
            </span>
            <div className="grid grid-rows-9 flex-1 text-xs text-slate-500 font-mono">
              {[1,2,3,4,5,6,7,8,9].map(n => <span key={n} className="flex items-center justify-center">{n}</span>)}
            </div>
            </div>
            <div className="flex-1">
              <SudokuGrid game={game} sel={sel} step={hintMode === "concrete" ? hint : null} showCands={showCands} filterMode={filterMode}
          digitFilter={digitFilter}
          manualColors={coloringVisible ? manualColors : new Map()} brush={activeColor} onPaintCand={paintCand}
          onSelect={setSel} onCandClick={toggleCand} colorMode={colorMode} wingFilter={wingFilter}
          onPaintCell={i => { if (activeColor !== null) setManualColors(m => new Map(m).set(i, activeColor)); }} />
            </div>
          </div>
        </div>
          ) : (
            <ProjectionPanel game={game}
              step={hintMode === "concrete" ? hint : null} view={view}
              onPick={(c) => { setSel(c); setView("RC"); }} corner={caret} />
          )}
          </div>
        </div>
        {/* RIGHT PANEL — wide like HoDoKu's, sections with real size */}
        <aside className="w-72 xl:w-80 shrink-0 flex flex-col gap-2 text-sm lg:overflow-y-auto lg:min-h-0 bg-[#EFEFEF] border border-[#989898] p-1.5 [&_section]:bg-transparent [&_section]:border-0">
          <div className="grid grid-cols-2 gap-px bg-[#A0A0A0] border border-[#A0A0A0] shrink-0">
            {TABS.map(([k, label]) => (
              <button key={k} onClick={() => setPanelTab(k)} className={"h-7 px-1 text-xs " + (panelTab === k ? "bg-white font-semibold" : "bg-[#F0F0F0] hover:bg-[#E4E4E4]")}>{label}</button>
            ))}
          </div>
          <div className="h-6 shrink-0 flex items-center justify-center bg-[#0084D4] text-white text-xs font-bold">{TABS.find(t => t[0] === panelTab)![1]}</div>
          {showReadout && game && (
            <div className="bg-white border border-[#A0A0A0] px-2 py-1 text-xs flex flex-col gap-0.5">
              <div className="flex justify-between"><span>Givens</span>
                <b>{game.given.filter(Boolean).length}</b></div>
              <div className="flex justify-between"><span>Pencilmarks</span>
                <b>{game.cands.reduce((acc, m, i) => acc + (game.values[i] === 0 ? candsOf(m).length : 0), 0)}</b></div>
              <div className="flex justify-between"><span>Rating category</span>
                <b>{isIdle ? "—" : level}</b></div>
            </div>
          )}
          {panelTab === "summary" && (<>
          {/* Summary */}
          <Panel>
            <TitleBar>Summary</TitleBar>
            <div className="scrollarea h-64 lg:h-auto lg:max-h-72 overflow-y-auto overflow-x-auto overscroll-contain">
              <table className="w-full text-xs">
                <tbody>
                  {Object.entries(pathSteps.reduce<Record<string, { n: number; xr: number }>>((acc, st) => {
                    const e = acc[st.technique] ?? (acc[st.technique] = { n: 0, xr: 0 });
                    e.n++; e.xr += st.score; return acc;
                  }, {})).map(([name, e]) => (
                    <tr key={name} style={{ backgroundColor: BAND_HEX(e.xr / e.n) }}>
                      <td className="px-2 py-0.5 text-right text-slate-600">{e.n}</td>
                      <td className="px-2 py-0.5">{name}</td>
                      <td className="px-2 py-0.5 text-right text-slate-600">{e.xr.toFixed(1)}</td>
                    </tr>
                  ))}
                  {!pathSteps.length && <tr><td colSpan={3} className="px-2 py-1 text-slate-400 italic">no steps yet</td></tr>}
                  <tr className="border-t border-[#A0A0A0] font-semibold">
                    <td className="px-2 py-0.5 text-right">{pathSteps.length}</td>
                    <td className="px-2 py-0.5">Total</td>
                    <td className="px-2 py-0.5 text-right">{pathSteps.reduce((a, st) => a + st.score, 0).toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>

          </>)}
          {panelTab === "active" && (<>
          {/* Active Cell */}
          <Panel>
            <TitleBar>Active Cell</TitleBar>
            <div className="px-3 py-2 text-xs">
              {hasSel ? `${cellName(sel)} — ${game.values[sel] !== 0
                ? `value ${game.values[sel]}${game.given[sel] ? " (given)" : ""}`
                : `candidates: ${candsOf(game.cands[sel]).join(" ") || "none"}`}`
                : "none"}
            </div>
          </Panel>

          {/* Set Value — HoDoKu-style: 3 rows of proper squares */}
          <Panel>
            <div className="px-2 pt-2 pb-1 text-xs font-semibold text-center text-slate-700">Set Value:</div>
            <div className="grid grid-cols-3 gap-1 w-fit mx-auto p-2">
              {ALL_DIGITS.map(d => (
                <button key={d} disabled={cellLocked || peersSee(d)}
                  className={"w-12 h-12 border text-base " + (cellLocked || peersSee(d) ? "border-[#C6C6C6] bg-[#C6C6C6] text-transparent" : "border-[#989898] bg-[#E0E0E0] text-black hover:bg-[#D6D6D6] active:bg-[#CCCCCC]")}
                  onClick={() => setValue(sel, d)}>
                  {d}
                </button>
              ))}
            </div>
          </Panel>

          {/* Exclude Candidates — same block style, tint marks present candidates */}
          <Panel>
            <div className="px-2 pt-2 pb-1 text-xs font-semibold text-center text-slate-700">Exclude Candidates:</div>
            <div className="grid grid-cols-3 gap-1 w-fit mx-auto p-2">
              {ALL_DIGITS.map(d => (
                <button key={d} disabled={cellLocked || !(hasSel && game.cands[sel] & candMask(d))}
                  className={"w-12 h-12 border text-base " + (cellLocked || !(hasSel && game.cands[sel] & candMask(d)) ? "border-[#C6C6C6] bg-[#C6C6C6] text-transparent" : "border-[#989898] bg-[#E0E0E0] text-black hover:bg-[#D6D6D6] active:bg-[#CCCCCC]")}
                  onClick={() => toggleCand(sel, d)}>
                  {d}
                </button>
              ))}
            </div>
          </Panel>
          {/* Coloring */}
          <Panel>
            <div className="px-3 py-2 pl-[calc((100%-9.5rem)/2)]">
              <ColorPalette active={activeColor} second={color2}
                onPick={i => setActiveColor(i)} onPickSecond={i => setColor2(i)}
                onSwap={() => { setActiveColor(color2); setColor2(c1 => (activeColor === null ? 8 : c1 === color2 ? color2 : activeColor)); }}
                onClearAll={() => setManualColors(new Map())}
                visible={coloringVisible} onToggleVisible={() => setColoringVisible(v => !v)}
                mode={colorMode} onMode={setColorMode} />
            </div>
          </Panel>

          </>)}
          {panelTab === "steps" && (<>
        {/* All-steps list (toggleable) */}
        {allSteps && (
          <div className="w-full">
            <Panel className="scrollarea h-64 lg:h-auto lg:max-h-72 overflow-y-auto overflow-x-auto overscroll-contain">
              {allSteps.map((s, idx) => (
                <button key={idx} className="block w-full text-left px-3 py-1 text-xs hover:bg-[#E0E0E0] flex justify-between border-b border-[#F0F0F0] last:border-0"
                  onClick={() => { setHint(s); setMsg(`${s.technique} — ${s.reason}`); }}>
                  <span>{s.technique}</span>
                  <span className="text-slate-400">XR {s.score}</span>
                </button>
              ))}
              {!allSteps.length && <div className="px-3 py-2 text-xs text-slate-400">No steps found.</div>}
            </Panel>
          </div>
        )}
          <div className="flex gap-1.5">
            <button className="flex-1 h-8 border border-[#A0A0A0] bg-white text-xs hover:bg-[#E0E0E0]"
              onClick={showAll}>{allSteps ? "Hide steps list" : "Find all steps"}</button>
            <button className="flex-1 h-8 border border-[#A0A0A0] bg-white text-xs hover:bg-[#E0E0E0] disabled:opacity-40"
              disabled={!hint} onClick={() => { if (hint) recordStep(hint); }}>Add to solution</button>
          </div>
          </>)}
          {panelTab === "path" && (<>
          <div className="flex flex-col gap-1.5">
            <button className="h-8 border border-[#A0A0A0] bg-white text-xs hover:bg-[#E0E0E0]"
              onClick={autoSolve}>Solve puzzle automatically</button>
          </div>
          {/* Solution path — tall, scrollable, a real area */}
          <Panel className="flex-1 min-h-40 flex flex-col">
            <TitleBar>Solution path</TitleBar>
            <ol className="scrollarea h-64 lg:h-auto lg:flex-1 lg:max-h-72 overflow-y-auto overflow-x-auto overscroll-contain touch-pan-y text-xs px-3 py-2">
              {pathSteps.map((st, i) => (
                <li key={i}>
                  <button className="w-full text-left py-0.5 px-1 border-b border-[#F0F0F0] last:border-0"
                    style={{ backgroundColor: BAND_HEX(st.score) }}
                    onClick={() => { setHint(st); setHintMode("concrete"); setMsg(`${st.technique} — ${st.reason}`); }}>
                    <span className="text-slate-500 mr-1.5">{i + 1}.</span>{st.technique}: {st.reason}
                  </button>
                </li>
              ))}
              {!pathSteps.length && <li className="text-slate-400 italic">no steps yet — solve or hint to begin</li>}
            </ol>
          </Panel>
          </>)}
        </aside>
      </div>

      <div className="px-4 pb-2 w-full">
        {/* HINTS BLOCK — full width, substantial, with title bar like a panel */}
        <div className="w-full flex-shrink-0">
          <Panel>
            <TitleBar>Hints</TitleBar>
            <div className="flex items-stretch gap-2 p-2">
              <div className="grid grid-cols-2 gap-1.5 shrink-0 content-start order-2">
                <button className="h-9 px-4 border border-[#A0A0A0] bg-[#E8E8E8] text-xs font-semibold hover:bg-[#D8D8D8] active:bg-[#C8C8C8]"
                  onClick={() => getHint()}>Next Hint</button>
                <button className="h-9 px-4 border border-[#A0A0A0] bg-[#E8E8E8] text-xs font-semibold hover:bg-[#D8D8D8] active:bg-[#C8C8C8] disabled:opacity-40"
                  disabled={!hint} onClick={applyHint}>Execute</button>
                <button className="h-9 px-3 border border-[#A0A0A0] bg-[#E8E8E8] text-xs font-semibold hover:bg-[#D8D8D8] active:bg-[#C8C8C8]"
                  onClick={solveUpTo}>Solve up to</button>
                <button className="h-9 px-3 border border-[#A0A0A0] bg-[#E8E8E8] text-xs font-semibold hover:bg-[#D8D8D8] active:bg-[#C8C8C8] disabled:opacity-40"
                  disabled={!hint} onClick={cancelHint}>Cancel</button>
              </div>
              <div className="flex-1 order-1 bg-white border border-[#A0A0A0] px-3 py-2 text-xs leading-relaxed min-h-20 overflow-y-scroll max-h-28 overscroll-contain scrollarea">
                {hint ? (
                  <p><b className="text-[#1a5276]">{hint.technique}:</b> {hintMode === "vague" ? `in ${hintCells(hint)}` : hint.reason}</p>
                ) : (
                  <p className="text-slate-500">{msg}</p>
                )}
              </div>
            </div>
          </Panel>
        </div>
      </div>
      {/* Status bar — their format */}
      <footer className="bg-[#0084D4] text-white text-[11px] px-1 py-1 flex items-center flex-wrap shrink-0 mt-auto lg:mt-0 border-t border-[#0060A0]">
        <span className="px-1 flex items-center gap-px">
          <i className="w-3 h-3 bg-white border border-black/40 inline-block" />
          {["FFC059","B1A5F3","F7A5A7","86E8D0","86F280","33CCFF"].map(h => (
            <i key={h} className="w-3 h-3 inline-block border border-black/40" style={{ backgroundColor: "#" + h }} />
          ))}
          <i className="w-3 h-3 bg-[#E8E8E8] border border-black/40 inline-block text-black text-[8px] text-center leading-3">R</i>
        </span>
        <span className="px-2 border-l border-white/40">Coloring: {activeColor === null ? "none" : "active"}</span>
        <span className="px-2 border-l border-white/40 flex items-center gap-1">
          <i aria-hidden="true" className="inline-block w-3 h-3 rounded-full border border-white" style={{ backgroundColor: isIdle ? "#9AA0AA" : ({ "Extremely Easy": "#7FD4FF", "Very Easy": "#64FF64", "Modestly Easy": "#A8E05F", "Easy": "#C8E040", "Moderate": "#FFFF64", "Tough": "#FFD44E", "Challenging": "#FFB04E", "Irritating": "#FF9650", "Frustrating": "#FF7A4E", "Hard": "#FF6464", "Demanding": "#FF4E86", "Expert": "#E05FE0", "Brutal": "#B05FFF", "Nightmare": "#6E4EFF" } as Record<string, string>)[level] }} />
          {isIdle ? "Ready" : level} · {isIdle ? 0 : progress}%
        </span>
        <span className="px-2 border-l border-white/40">Playing{hasSel ? " " + cellName(sel).toUpperCase() : ""}</span>
        <span className="px-2 border-l border-white/40 flex-1 truncate">{msg}</span>
        <span className="px-2 border-l border-white/40 text-white/80">{BUILD_TAG}</span>
        <span className="px-2 border-l border-white/40">{mmss(seconds)}</span>
      </footer>
    </main>
  );
}
