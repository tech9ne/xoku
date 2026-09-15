#!/usr/bin/env bash
set -e
cd ~/xoku

python3 - <<'PY'
P = "app/page.tsx"
src = open(P).read()

# 1) state + ref after gameId
anchor = "  const [gameId, setGameId] = useState(0);"
assert src.count(anchor) == 1, "gameId anchor"
i = src.index(anchor)
src = src[:i + len(anchor)] + "\n  const [generating, setGenerating] = useState(false);\n  const workerRef = useRef<Worker | null>(null);" + src[i + len(anchor):]

# 2) any new game kills an in-flight generation (restart/import race guard)
anchor = "    setSeconds(0); setGameId(id => id + 1);"
assert src.count(anchor) == 1, "startGame reset anchor"
i = src.index(anchor)
src = src[:i] + "    workerRef.current?.terminate();\n    workerRef.current = null;\n    setGenerating(false);\n" + src[i:]

# 3) replace newPuzzle (brace-walk: first exact '  };' after its opening)
lines = src.split("\n")
start = next(k for k, l in enumerate(lines) if l == "  const newPuzzle = (lvl: Level) => {")
end = next(k for k in range(start + 1, start + 20) if lines[k] == "  };")
assert "generatePuzzle" in "\n".join(lines[start:end + 1]), "newPuzzle region sanity failed"

NEW = '''  const finishGeneration = (lvl: Level, res: { puzzle: number[]; solution: number[]; rating: ReturnType<typeof rateGame> }, how: string) => {
    setGenerating(false);
    startGame(res.puzzle, res.solution, `${lvl} puzzle · ${how}`, res.rating);
  };

  const generateOnMainThread = (lvl: Level) => {
    setTimeout(() => {
      finishGeneration(lvl, generatePuzzle(lvl), "main thread");
    }, 30);
  };

  const newPuzzle = (lvl: Level) => {
    setLevel(lvl);
    setGenerating(true);
    setMsg(`Generating ${lvl} puzzle…`);
    workerRef.current?.terminate(); // latest request wins
    try {
      const w = new Worker(new URL("../lib/sudoku/generate.worker.ts", import.meta.url));
      workerRef.current = w;
      w.onmessage = (e: MessageEvent) => {
        workerRef.current = null;
        w.terminate();
        finishGeneration(lvl, e.data, "background");
      };
      w.onerror = () => {
        workerRef.current = null;
        w.terminate();
        generateOnMainThread(lvl);
      };
      w.postMessage({ level: lvl });
    } catch {
      generateOnMainThread(lvl);
    }
  };'''
lines[start:end + 1] = NEW.split("\n")
src = "\n".join(lines)

# 4) unmount cleanup + live counter
anchor = "  const withUndo = (fn: (g: Game) => void) => {"
assert src.count(anchor) == 1, "withUndo anchor"
i = src.index(anchor)
effects = """  useEffect(() => () => { workerRef.current?.terminate(); }, []);

  useEffect(() => {
    if (!generating) return;
    let n = 0;
    const t = setInterval(() => {
      n++;
      setMsg(`Generating ${level} puzzle… ${n}s (deep levels can take up to ~30 s)`);
    }, 1000);
    return () => clearInterval(t);
  }, [generating, level]);

"""
src = src[:i] + effects + src[i:]

open(P, "w").write(src)
print("    page wired: worker generation + fallback + counter")
PY

echo "==> Sanity"
grep -n "workerRef\|generateOnMainThread\|finishGeneration" app/page.tsx | head -n 10

echo "==> GATE"
npx tsc --noEmit && echo "types OK"
