// Stage 0: declarative rule table for the naming layer (audit Part 4).
// Matching logic ships with Stage 1; rows are data, most-specific first.
export interface Rule {
  name: string;
  form: "wing" | "ring" | "open";
  pri: number;                 // 10 ring, 20 named, 30 family, 40 fallback
  nodes: string;               // signature, e.g. "cand cand cand cand"
  links: string;               // link-type signature, e.g. "0 0"
  constraints: string;         // free-form, matched by engine
  aliases: string[];
  xr: number;
}
export const RULES: Rule[] = [
  { name: "X-Wing", form: "ring", pri: 10, nodes: "cand cand cand cand", links: "0-2 0-2", constraints: "2R x 2C or 2C x 2R", aliases: ["fish-2"], xr: 3.0 },
  { name: "XY-Ring", form: "ring", pri: 10, nodes: "biv biv biv biv", links: "4 4 4 4", constraints: "4 distinct digits", aliases: ["XY-Chain:ring"], xr: 6.2 },
  { name: "Skyscraper", form: "wing", pri: 20, nodes: "cand cand cand cand", links: "0 0", constraints: "R+R or C+C", aliases: ["Siamese sashimi X-Wing"], xr: 3.8 },
  { name: "2-String Kite", form: "wing", pri: 20, nodes: "cand cand cand cand", links: "0 1", constraints: "R+C", aliases: ["finned mutant X-Wing"], xr: 4.0 },
  { name: "Empty Rectangle", form: "wing", pri: 20, nodes: "slice cand", links: "3 0", constraints: "B+R or B+C", aliases: ["sashimi franken X-Wing", "ERi"], xr: 4.4 },
  { name: "XY-Wing", form: "wing", pri: 20, nodes: "biv biv biv", links: "4 4 4", constraints: "3 digits", aliases: ["ALS-XY", "BARNs-3"], xr: 4.6 },
  { name: "W-Wing", form: "wing", pri: 20, nodes: "biv link biv", links: "4 0-3 4", constraints: "identical bivalves", aliases: [], xr: 5.2 },
  { name: "M(2)-Wing", form: "wing", pri: 20, nodes: "biv link link", links: "4 0/1 0/1", constraints: "", aliases: [], xr: 5.2 },
  { name: "iW-Wing", form: "wing", pri: 20, nodes: "cand cand cand cand", links: "inv-W", constraints: "", aliases: ["inversion"], xr: 5.2 },
  { name: "X-Chain", form: "open", pri: 30, nodes: "cand*", links: "0*", constraints: "single digit", aliases: [], xr: 5.8 },
  { name: "XY-Chain", form: "open", pri: 30, nodes: "biv*", links: "4*", constraints: "", aliases: [], xr: 6.0 },
  { name: "Remote Pair", form: "open", pri: 30, nodes: "biv*", links: "4*", constraints: "2 unique digits", aliases: [], xr: 4.0 },
  { name: "AIC length-n", form: "open", pri: 40, nodes: "any", links: "any", constraints: "fallback", aliases: [], xr: 0 },
];
