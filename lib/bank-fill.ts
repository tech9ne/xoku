// Xoku puzzle bank - design D, step 2: background fill orchestration.
// One worker at a time, lowest-stock tier first (round-robin through
// ties so a hopeless tier cannot monopolize), page-visibility gated,
// 30s bursts with breathing pauses (phone thermals). Dormant until the
// page calls startBankFill(tiers) - D step 3. Never touches engine
// semantics: it only stores what generatePuzzle already accepted.
import { bankAvailable, bankCounts, bankPut, BANK_CAP_PER_LEVEL } from "./puzzle-bank";
import type { BankResult } from "./puzzle-bank";
import type { Level } from "./sudoku/solver";

const FILL_BUDGET_MS = 30000; // one burst per tier turn
const BREATH_MS = 750; // CPU breather between bursts
const ALL_CAPPED_POLL_MS = 10000; // every tier at cap - coast
const HIDDEN_POLL_MS = 2000; // page hidden - wait quietly

let tiers: Level[] = [];
let running = false;
let seq = 0;
let cursor = 0; // round-robin among equal-stock tiers
let worker: Worker | null = null;
let listening = false;

export function startBankFill(levels: Level[]): void {
  if (typeof document === "undefined" || !bankAvailable()) return;
  // Special tiers never fill: Unknown is the instant quick path, Lulz
  // is census-proved ungeneratable at target (1000/1000 stall at 40
  // clues), Abyssal/Transcendent need the unvendored ALS-DOF engine.
  tiers = levels.filter(
    (l) => l !== "Unknown" && l !== "Lulz" && l !== "Abyssal" && l !== "Transcendent",
  );
  if (running || tiers.length === 0) return;
  running = true;
  if (!listening) {
    listening = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") abandonBurst();
    });
  }
  void fillLoop(seq);
}

export function stopBankFill(): void {
  running = false;
  seq++;
  abandonBurst();
}

function abandonBurst(): void {
  worker?.terminate();
  worker = null;
}

async function fillLoop(s: number): Promise<void> {
  while (running && s === seq) {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      await sleep(HIDDEN_POLL_MS);
      continue;
    }
    const counts = await bankCounts();
    const target = pickTier(counts);
    if (!target) {
      await sleep(ALL_CAPPED_POLL_MS);
      continue;
    }
    const r = await burst(target, s);
    if (r && !("failed" in r)) await bankPut(target, r);
    await sleep(BREATH_MS);
  }
}

// Lowest stock first; round-robin through ties.
function pickTier(counts: Record<string, number>): Level | null {
  const open = tiers.filter((l) => (counts[l] ?? 0) < BANK_CAP_PER_LEVEL);
  if (open.length === 0) return null;
  let best: Level[] = [];
  let bestCount = Infinity;
  for (const l of open) {
    const c = counts[l] ?? 0;
    if (c < bestCount) {
      bestCount = c;
      best = [l];
    } else if (c === bestCount) {
      best.push(l);
    }
  }
  if (best.length === 1) return best[0];
  cursor = (cursor + 1) % best.length;
  return best[cursor];
}

// One bounded generation burst on a dedicated worker; resolves with the
// accepted result, { failed: true }, or null (worker error). Hang-safe.
function burst(level: Level, s: number): Promise<BankResult | { failed: true } | null> {
  return new Promise((resolve) => {
    if (!running || s !== seq) {
      resolve(null);
      return;
    }
    abandonBurst();
    const w = new Worker(new URL("./sudoku/generate.worker.ts", import.meta.url));
    worker = w;
    let done = false;
    const finish = (v: BankResult | { failed: true } | null) => {
      if (done) return;
      done = true;
      try {
        w.terminate();
      } catch {
        // already dead
      }
      if (worker === w) worker = null;
      resolve(v);
    };
    w.onmessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; result?: BankResult };
      if (m && m.type === "result" && m.result) finish(m.result);
      else if (m && m.type === "failed") finish({ failed: true });
      // progress messages are ignored by the filler
    };
    w.onerror = () => finish(null);
    w.postMessage({ type: "generate", level, budgetMs: FILL_BUDGET_MS, sliceMs: 4000 });
    setTimeout(() => finish({ failed: true }), FILL_BUDGET_MS + 15000);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
