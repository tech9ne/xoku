// Background puzzle generation. Runs generatePuzzle off the main thread so
// the UI stays fully interactive while deep levels hunt for a valid puzzle.
import { generatePuzzle } from "./solver";
import type { Level } from "./solver";

const ctx = self as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage: (m: unknown) => void };

ctx.onmessage = (e: MessageEvent) => {
  const { level } = e.data as { level: Level };
  const result = generatePuzzle(level);
  ctx.postMessage(result);
};
