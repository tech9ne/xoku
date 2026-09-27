// Dev smoke: the bank module loads and no-ops cleanly where IndexedDB is
// absent (node). Browser paths are exercised by D step 3 (page wiring).
import {
  bankAvailable,
  bankCounts,
  bankPut,
  bankTake,
  BANK_CAP_PER_LEVEL,
} from "../lib/puzzle-bank";

void (async () => {
  console.log("available:", bankAvailable());
  console.log("counts:", JSON.stringify(await bankCounts()));
  console.log("take:", await bankTake("Easy"));
  console.log(
    "put:",
    await bankPut("Easy", {
      puzzle: [],
      solution: [],
      rating: { score: 0, hardest: 0, hardestTechnique: "" },
    }),
  );
  console.log("cap:", BANK_CAP_PER_LEVEL);
})();
