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

  const cancelHint = () => setHint(null);
  const solveUpTo = () => {
    if (!game || solved) return;
    const taken: string[] = [];
    let stop: Step | null = null;
    withUndo(g => {
      for (let guard = 0; guard < 500 && !isSolved(g); guard++) {
        const st = findNextStep(g);
        if (!st) break;
        if (!PROGRESS.has(st.category)) { stop = st; return; }
        applyStep(g, st);
        taken.push(st.technique);
      }
    });
    if (taken.length) setSolutionPath(p2 => [...p2, ...taken]);
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

  const TitleBar = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-[#E0E0E0] border-b border-[#A0A0A0] px-2 py-1 text-xs font-bold text-slate-700">{children}</div>
  );
  const Panel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <section className={`bg-white border border-[#A0A0A0] ${className}`}>{children}</section>
  );

  return (
    <main className="min-h-screen lg:h-screen bg-[#F2F2F2] text-slate-900 flex flex-col lg:overflow-hidden">
      <MenuBar onNew={newPuzzle} onRestart={restart} onImport={importPuzzle} onExport={exportPuzzle}
        onUndo={undo} onRedo={redo} canUndo={history.length > 0} canRedo={future.length > 0} onCheck={check} onAutoSolve={autoSolve}
        onHelp={() => setMsg(`Implemented: ${TECHNIQUE_NAMES.join(", ")}`)}
        showCands={showCands} setShowCands={setShowCands}
        digitFilter={digitFilter} onDigitFilter={(f) => { if (f === null) { setDigitFilter(null); setMsg("Highlight cleared."); } else toggleFilter(f); }}
        digitRemaining={remaining} currentLevel={level} filterMode={filterMode} onToggleFilterMode={toggleFilterMode}
        onHintVague={() => getHint("vague")} onHintConcrete={() => getHint("concrete")}
        onHintNext={() => getHint()} onHintExecute={applyHint} onHintAbort={cancelHint}
        hintMode={hintMode} hasHint={!!hint} />

      <div className="flex flex-1 flex-row gap-4 p-4 lg:p-6 overflow-x-auto lg:overflow-hidden min-h-0">
        {/* GRID — generous, centered */}
        <div className="w-[94vw] shrink-0 flex flex-col gap-2 lg:min-h-0 lg:w-auto lg:flex-1 lg:shrink">
          <div className="flex items-center justify-center lg:flex-1 lg:min-h-0">
          <SudokuGrid game={game} sel={sel} step={hintMode === "concrete" ? hint : null} showCands={showCands} filterMode={filterMode}
          digitFilter={digitFilter}
          manualColors={manualColors} brush={activeColor} onPaintCand={paintCand}
          onSelect={setSel} onCandClick={toggleCand} />

          </div>
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
              <div className="flex-1 order-1 bg-white border border-[#A0A0A0] px-3 py-2 text-xs leading-relaxed min-h-20 overflow-y-auto max-h-28">
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
        {/* RIGHT PANEL — wide like HoDoKu's, sections with real size */}
        <aside className="w-72 xl:w-80 shrink-0 flex flex-col gap-2 text-sm lg:overflow-y-auto lg:min-h-0">
          <div className="grid grid-cols-2 gap-px bg-[#A0A0A0] border border-[#A0A0A0] shrink-0">
            {TABS.map(([k, label]) => (
              <button key={k} onClick={() => setPanelTab(k)} className={"h-7 px-1 text-xs " + (panelTab === k ? "bg-white font-semibold" : "bg-[#F0F0F0] hover:bg-[#E4E4E4]")}>{label}</button>
            ))}
          </div>
          <div className="h-6 shrink-0 flex items-center justify-center bg-[#0084D4] text-white text-xs font-bold">{TABS.find(t => t[0] === panelTab)![1]}</div>
          {panelTab === "summary" && (<>
          {/* Summary */}
          <Panel>
            <TitleBar>Summary</TitleBar>
            <div className="px-3 py-2 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Level</span><span className="font-semibold">{level}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Time</span><span>{mmss(seconds)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Progress</span><span>{progress}%</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Build</span><span className="text-slate-400">{BUILD_TAG}</span></div>
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
            <TitleBar>Set Value</TitleBar>
            <div className="grid grid-cols-3 gap-1.5 p-2">
              {ALL_DIGITS.map(d => (
                <button key={d} disabled={cellLocked}
                  className="h-10 border border-[#A0A0A0] bg-white text-base hover:bg-[#E0E0E0] active:bg-[#D0D0D0] disabled:opacity-40 shadow-sm"
                  onClick={() => setValue(sel, d)}>
                  {d}
                </button>
              ))}
            </div>
          </Panel>

          {/* Exclude Candidates — same block style, tint marks present candidates */}
          <Panel>
            <TitleBar>Exclude Candidates</TitleBar>
            <div className="grid grid-cols-3 gap-1.5 p-2">
              {ALL_DIGITS.map(d => (
                <button key={d} disabled={cellLocked}
                  className={cls("h-10 border text-base disabled:opacity-40 shadow-sm",
                    hasSel && game.cands[sel] & candMask(d)
                      ? "border-[#A0A0A0] bg-[#F8D7D7]" : "border-[#A0A0A0] bg-white hover:bg-[#E0E0E0]")}
                  onClick={() => toggleCand(sel, d)}>
                  {d}
                </button>
              ))}
            </div>
          </Panel>
          {/* Coloring */}
          <Panel>
            <TitleBar>Coloring</TitleBar>
            <div className="px-3 py-2">
              <ColorPalette active={activeColor} onPick={c => setActiveColor(a => (a === c ? null : c))}
                onClearAll={() => setManualColors(new Map())} anySet={manualColors.size > 0} />
            </div>
          </Panel>

          </>)}
          {panelTab === "steps" && (<>
          <div className="flex flex-col gap-1.5">
            <button className="h-8 border border-[#A0A0A0] bg-white text-xs hover:bg-[#E0E0E0]"
              onClick={showAll}>{allSteps ? "Hide" : "Show"} all possible steps</button>
          </div>
        {/* All-steps list (toggleable) */}
        {allSteps && (
          <div className="w-full">
            <Panel>
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
          </>)}
          {panelTab === "path" && (<>
          <div className="flex flex-col gap-1.5">
            <button className="h-8 border border-[#A0A0A0] bg-white text-xs hover:bg-[#E0E0E0]"
              onClick={autoSolve}>Solve puzzle automatically</button>
          </div>
          {/* Solution path — tall, scrollable, a real area */}
          <Panel className="flex-1 min-h-40 flex flex-col">
            <TitleBar>Solution path</TitleBar>
            <ol className="overflow-y-auto text-xs px-3 py-2 flex-1">
              {solutionPath.map((t, i) => (
                <li key={i} className="py-0.5 border-b border-[#F0F0F0] last:border-0">
                  <span className="text-slate-400 mr-1.5">{i + 1}.</span>{t}
                </li>
              ))}
              {!solutionPath.length && <li className="text-slate-400 italic">no steps yet — solve or hint to begin</li>}
            </ol>
          </Panel>
          </>)}
        </aside>
      </div>

      {/* Status bar — their format */}
      <footer className="bg-[#D6D9DE] text-black text-[11px] px-1 py-1 flex items-center flex-wrap shrink-0 mt-auto lg:mt-0 border-t border-[#9aa0aa]">
        <span className="px-2">Coloring: {activeColor === null ? "none" : "active"}</span>
        <span className="px-2 border-l border-[#b0b4bb] flex items-center gap-1">
          <i aria-hidden="true" className="inline-block w-3 h-3 rounded-full border border-black" style={{ backgroundColor: ({ Easy: "#FFFFFF", Moderate: "#64FF64", Hard: "#FFFF64", Brutal: "#FF9650", Nightmare: "#FF6464" } as Record<string, string>)[level] }} />
          {level} · {progress}%
        </span>
        <span className="px-2 border-l border-[#b0b4bb]">{solved ? "Solved" : "Playing"} {hasSel ? cellName(sel) : ""}</span>
        <span className="px-2 border-l border-[#b0b4bb] flex-1 truncate">{msg}</span>
        <span className="px-2 border-l border-[#b0b4bb]">{mmss(seconds)}</span>
      </footer>
    </main>
  );
}
