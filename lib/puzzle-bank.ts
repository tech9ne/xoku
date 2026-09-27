// Xoku puzzle bank - design D, step 1 (client-side, static-export safe).
// Per-tier store of pre-generated puzzles so tier selection is instant
// when stocked. Filled by the background fill worker (D step 2); every
// entry passed generatePuzzle's two-stage acceptance (solver.ts, his
// index.html:13339) before it got here. The bank never re-rates,
// re-solves, or re-labels anything.
// All entry points no-op gracefully without IndexedDB (SSR, private
// browsing, old browsers): counts -> {}, take -> null, put -> false.

import type { Level } from "./sudoku/solver";

export interface BankEntry {
  id: string;
  level: Level;
  puzzle: string; // 81 chars, "0" = empty
  solution: string; // 81 chars
  hardest: number;
  hardestTechnique: string;
  score: number;
  createdAt: number;
}

// Structural slice of generatePuzzle's success return (avoids import cycle).
export interface BankResult {
  puzzle: number[];
  solution: number[];
  rating: { score: number; hardest: number; hardestTechnique: string };
}

const DB_NAME = "xoku-bank";
const STORE = "puzzles";
const DB_VERSION = 1;
export const BANK_CAP_PER_LEVEL = 20;

let dbPromise: Promise<IDBDatabase> | null = null;

export function bankAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null; // allow a later retry
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

// Single-request store operation; every op in this module is one request.
function storeOp<T>(
  mode: IDBTransactionMode,
  make: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = make(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

async function allEntries(): Promise<BankEntry[]> {
  try {
    return await storeOp<BankEntry[]>(
      "readonly",
      (s) => s.getAll() as IDBRequest<BankEntry[]>,
    );
  } catch {
    return [];
  }
}

export async function bankCounts(): Promise<Record<string, number>> {
  if (!bankAvailable()) return {};
  const counts: Record<string, number> = {};
  for (const e of await allEntries()) {
    counts[e.level] = (counts[e.level] ?? 0) + 1;
  }
  return counts;
}

// Stores an accepted generatePuzzle result. Returns false when the bank
// is unavailable or the per-level cap is reached (filler moves on).
export async function bankPut(level: Level, r: BankResult): Promise<boolean> {
  if (!bankAvailable()) return false;
  const mine = (await allEntries()).filter((e) => e.level === level);
  if (mine.length >= BANK_CAP_PER_LEVEL) return false;
  const entry: BankEntry = {
    id: newId(),
    level,
    puzzle: r.puzzle.map(String).join(""),
    solution: r.solution.map(String).join(""),
    hardest: r.rating.hardest,
    hardestTechnique: r.rating.hardestTechnique,
    score: r.rating.score,
    createdAt: Date.now(),
  };
  try {
    await storeOp("readwrite", (s) => s.add(entry));
    return true;
  } catch {
    return false;
  }
}

// Serves one puzzle of the tier (uniform random pick) and removes it
// from the bank; the background filler refills. null = not stocked.
export async function bankTake(level: Level): Promise<BankEntry | null> {
  if (!bankAvailable()) return null;
  const mine = (await allEntries()).filter((e) => e.level === level);
  if (mine.length === 0) return null;
  const pick = mine[Math.floor(Math.random() * mine.length)];
  try {
    await storeOp("readwrite", (s) => s.delete(pick.id));
    return pick;
  } catch {
    return null;
  }
}

// Dev/reset: empty the bank.
export async function bankClear(): Promise<void> {
  if (!bankAvailable()) return;
  try {
    await storeOp("readwrite", (s) => s.clear());
  } catch {
    // ignore - the bank is best-effort
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
