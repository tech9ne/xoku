// Background puzzle generation. Protocol v2 (H-bank-b):
//   { type: "generate", level, budgetMs?, sliceMs? } -> sliced run:
//     { type: "progress", attempts, elapsedMs, diag } between slices,
//     then { type: "result", result, attempts, elapsedMs } on success
//     or { type: "failed", attempts, elapsedMs, level } on exhaustion.
//   { type: "cancel" } -> stops after the current slice.
//   Legacy { level } (no type) -> old behavior exactly: one wall-free
//     run, raw result posted back. Pre-wiring callers keep working.
// generatePuzzle is synchronous, so a run is sliced by calling it with a
// bounded timeBudgetMs per slice; between slices we post progress and
// yield (setTimeout 0) so a queued cancel can arrive. Each slice starts
// the attempt loop fresh - statistically equivalent for hit rate.
import { generatePuzzle } from "./solver";
import type { Level } from "./solver";

type GenMessage =
  | { type?: undefined; level: Level }
  | { type: "generate"; level: Level; budgetMs?: number; sliceMs?: number }
  | { type: "cancel" };

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (m: unknown) => void;
};

let busy = false;
let cancelled = false;

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data as GenMessage;
  if (msg && msg.type === "cancel") {
    cancelled = true;
    return;
  }
  if (!msg || !("type" in msg) || msg.type === undefined) {
    // Legacy path: byte-for-byte the v1 protocol.
    const legacy = msg as { level: Level };
    const result = generatePuzzle(legacy.level, { timeBudgetMs: 0 });
    ctx.postMessage(result);
    return;
  }
  if (msg.type !== "generate" || busy) return;
  const gen = msg as Extract<GenMessage, { type: "generate" }>;
  busy = true;
  cancelled = false;
  void run(gen.level, gen.budgetMs ?? 0, gen.sliceMs ?? 4000);
};

async function run(level: Level, totalBudgetMs: number, sliceMs: number): Promise<void> {
  const t0 = Date.now();
  let attempts = 0;
  try {
    while (!cancelled) {
      const elapsed = Date.now() - t0;
      const remain = totalBudgetMs > 0 ? totalBudgetMs - elapsed : sliceMs;
      if (remain <= 0) break;
      const slice = Math.min(sliceMs, remain);
      const r = generatePuzzle(level, { timeBudgetMs: slice });
      attempts += (r as { attempts?: number }).attempts ?? 0;
      if (!("failed" in r)) {
        ctx.postMessage({ type: "result", result: r, attempts, elapsedMs: Date.now() - t0 });
        return;
      }
      ctx.postMessage({ type: "progress", attempts, elapsedMs: Date.now() - t0, diag: (r as { diag?: unknown }).diag ?? null });
      await new Promise((res) => setTimeout(res, 0)); // yield for cancel
    }
    ctx.postMessage({ type: "failed", attempts, elapsedMs: Date.now() - t0, level });
  } finally {
    busy = false;
  }
}
