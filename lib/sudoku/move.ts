// Stage 0: the unified Move contract both lenses emit (audit Part 5).
export interface ChainNode {
  kind: "cand" | "biv" | "slice" | "als" | "ahs";
  digit?: number;         // cand / biv in-digit / slice digit
  digit2?: number;        // biv out-digit / ALS in-out pair
  cell?: number;          // cand / biv
  cells?: number[];       // slice / ALS / AHS
  record?: unknown;       // ALS_RCC record (Stage 4)
}
export interface ChainLink {
  from: ChainNode; to: ChainNode; strong: boolean;
}
export interface FishProof {
  digit: number; base: number[]; cover: number[]; k: number;
  fins: number[]; vertices: number[];
}
export interface Move {
  eliminations: { cell: number; cand: number }[];
  placements?: { cell: number; value: number }[];
  rating: number;
  structureName: string;
  form: "wing" | "ring" | "open" | "set" | "fish" | "uniqueness";
  lens: "chain" | "fish" | "direct";
  proof?: { nodes?: ChainNode[]; links?: ChainLink[]; fish?: FishProof };
  notation: string;
  aliases: string[];
}
