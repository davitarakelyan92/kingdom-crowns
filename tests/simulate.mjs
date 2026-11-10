import { evaluate } from "../docs/js/engine.js";
import { createRng } from "../docs/js/rng.js";
import { spinReels } from "../docs/js/reels.js";

const spins = Number(process.argv[2] ?? 100_000);
const seed = Number(process.argv[3] ?? 20261110) >>> 0;
const bet = 100;
const rng = createRng(seed);

let returned = 0;
let hits = 0;
let crownSpins = 0;
let crownLines = 0;
const lineCounts = {};

for (let i = 0; i < spins; i += 1) {
  const outcome = spinReels(rng);
  const result = evaluate(outcome.grid, outcome.top, bet);
  returned += result.totalCents;
  if (result.totalCents > 0) hits += 1;
  if (result.crownLine) crownSpins += 1;
  for (const win of result.wins) {
    lineCounts[win.symbol] = (lineCounts[win.symbol] ?? 0) + 1;
    if (win.symbol === "crown") crownLines += 1;
  }
}

const stake = spins * bet;
const oneIn = crownSpins === 0 ? null : spins / crownSpins;
const report = {
  spins,
  seed,
  betCents: bet,
  crownSpins,
  crownLines,
  crownOneIn: oneIn,
  hitRate: hits / spins,
  hits,
  rtp: returned / stake,
  returnedCents: returned,
  stakeCents: stake,
  lineCounts,
};

console.log(`Kingdom Crowns — ${spins.toLocaleString("en-US")} spins — seed ${seed} — bet 1.00`);
console.log(`Crown-line spins: ${crownSpins.toLocaleString("en-US")} (1 in ${oneIn ? oneIn.toFixed(1) : "—"})`);
console.log(`Crown lines awarded: ${crownLines.toLocaleString("en-US")}`);
console.log(`Hit rate: ${(100 * report.hitRate).toFixed(2)}% (${hits.toLocaleString("en-US")} winning spins)`);
console.log(`RTP: ${(100 * report.rtp).toFixed(2)}%`);
console.log(`Returned ${(returned / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} on ${(stake / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} staked`);
console.log("Winning lines by symbol:");
for (const [symbol, count] of Object.entries(lineCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${symbol.padEnd(8)} ${count.toLocaleString("en-US")}`);
}
console.log(`JSON:${JSON.stringify(report)}`);
