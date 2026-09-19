export type LinkType = 0 | 1 | 2 | 3 | 4;
// 0: bivalve/bi-location single (x=x)
// 1: grouped-to-single (xxx=x)
// 2: grouped-to-grouped (xxx=xxx)
// 3: ERi (hyper-dimensional XOR)
// 4: size-1 ALS (bivalve, tracked for ALS chains)

export type NodeKind = 'V' | 'L'; // Value or Location
export type WeakKind = 'c' | 's'; // cell peer or sector exclusion

export interface ChainRule {
  name: string;
  nodeSignature: NodeKind[];
  weakSignature: WeakKind[];
  allowedLinkTypes: LinkType[][];
  isRing: boolean;
  priority: number;
  aliases: string[];
  minNodes?: number;
  maxNodes?: number;
}

export const CHAIN_RULES: ChainRule[] = [
  // --- Length 2 (Single Digit Chains / Fish Equivalents) ---
  { name: "X-Wing", nodeSignature: ['L', 'L'], weakSignature: ['s'], allowedLinkTypes: [[2], [2]], isRing: true, priority: 10, aliases: ["Size 2 Fish"] },
  { name: "Skyscraper", nodeSignature: ['L', 'L'], weakSignature: ['s'], allowedLinkTypes: [[0], [0]], isRing: false, priority: 10, aliases: [] },
  { name: "2-String Kite", nodeSignature: ['L', 'L'], weakSignature: ['s'], allowedLinkTypes: [[0,1], [0,1]], isRing: false, priority: 10, aliases: [] },
  { name: "Empty Rectangle", nodeSignature: ['L', 'L'], weakSignature: ['s'], allowedLinkTypes: [[3,0], [0,3]], isRing: false, priority: 10, aliases: [] },

  // --- Length 3 (Wings) ---
  { name: "XY-Wing", nodeSignature: ['V', 'V', 'V'], weakSignature: ['c', 'c'], allowedLinkTypes: [[4], [4], [4]], isRing: false, priority: 10, aliases: ["Y-Wing", "BARNS-3"] },
  { name: "W-Wing", nodeSignature: ['V', 'L', 'V'], weakSignature: ['s', 'c'], allowedLinkTypes: [[4], [0,1,2,3], [4]], isRing: false, priority: 10, aliases: [] },
  { name: "S-Wing", nodeSignature: ['L', 'V', 'L'], weakSignature: ['s', 's'], allowedLinkTypes: [[0,1,2,3], [4], [0,1,2,3]], isRing: false, priority: 10, aliases: ["Split Wing"] },
  { name: "M2-Wing", nodeSignature: ['V', 'L', 'L'], weakSignature: ['s', 's'], allowedLinkTypes: [[4], [0,1], [0,1]], isRing: false, priority: 10, aliases: [] },
  { name: "L1-Wing", nodeSignature: ['L', 'L', 'L'], weakSignature: ['s', 's'], allowedLinkTypes: [[0,1,2,3], [0,1,2,3], [0,1,2,3]], isRing: false, priority: 10, aliases: ["3x ERI", "Dual ERI", "Rec't Kite"] },
  { name: "H1-Wing", nodeSignature: ['L', 'L', 'V'], weakSignature: ['s', 's'], allowedLinkTypes: [[4], [0,3], [0,1,2,3]], isRing: false, priority: 10, aliases: [] },
  { name: "H2-Wing", nodeSignature: ['L', 'V', 'V'], weakSignature: ['c', 's'], allowedLinkTypes: [[4], [4], [0,1,2,3]], isRing: false, priority: 10, aliases: [] },

  // --- Length 4+ (Chains) ---
  { name: "XY-Chain", nodeSignature: ['V'], weakSignature: ['c'], allowedLinkTypes: [[4]], isRing: false, priority: 50, aliases: [], minNodes: 4 },
  { name: "Remote Pair", nodeSignature: ['V'], weakSignature: ['c'], allowedLinkTypes: [[4]], isRing: false, priority: 40, aliases: [], minNodes: 4 },
  { name: "X-Chain", nodeSignature: ['L'], weakSignature: ['s'], allowedLinkTypes: [[0,1,2,3]], isRing: false, priority: 50, aliases: [], minNodes: 4 },
];

export function matchRule(
  nodes: NodeKind[],
  weaks: WeakKind[],
  links: LinkType[],
  isRing: boolean
): ChainRule | null {
  const sorted = [...CHAIN_RULES].sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    if (rule.isRing !== isRing) continue;
    const nLen = nodes.length;
    if (rule.minNodes && nLen < rule.minNodes) continue;
    if (rule.maxNodes && nLen > rule.maxNodes) continue;
    
    let nodeMatch = true, weakMatch = true, linkMatch = true;
    
    if (rule.nodeSignature.length === 1) {
       nodeMatch = nodes.every(n => n === rule.nodeSignature[0]);
       weakMatch = weaks.every(w => w === rule.weakSignature[0]);
       linkMatch = links.every(l => rule.allowedLinkTypes[0].includes(l));
    } else {
       if (nLen !== rule.nodeSignature.length) continue;
       if (weaks.length !== rule.weakSignature.length) continue;
       if (links.length !== rule.allowedLinkTypes.length) continue;
       
       for (let i = 0; i < nLen; i++) {
         if (nodes[i] !== rule.nodeSignature[i]) { nodeMatch = false; break; }
         if (!rule.allowedLinkTypes[i].includes(links[i])) { linkMatch = false; break; }
       }
       for (let i = 0; i < weaks.length; i++) {
         if (weaks[i] !== rule.weakSignature[i]) { weakMatch = false; break; }
       }
    }
    if (nodeMatch && weakMatch && linkMatch) return rule;
  }
  return null;
}
