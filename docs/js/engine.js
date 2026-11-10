import { BIG_WIN_MULTIPLIER, LINES, PAYTABLE, REEL_COUNT, ROW_COUNT } from "./config.js";

/**
 * Symbol used for a line cell.
 * A crown-row wild stands in for every row of its reel.
 * Scatter, blank, and a missing crown cell do not.
 */
export function effectiveSymbol(grid, top, reel, row) {
  if (top && top[reel] === "wild") return "wild";
  return grid[reel][row];
}

/**
 * Evaluate the five fixed lines.
 *
 * A line pays only as 5 of a kind. Wilds fill in for one paying symbol.
 * They do not fill in for scatter. Scatter pays nothing.
 * A line that is entirely wild pays nothing: wild has no prize of its own,
 * and there is no paying symbol left for it to substitute.
 * Each winning line awards (multiplier × total bet). Line wins are added.
 */
export function evaluate(grid, top, betCents, paytable = PAYTABLE) {
  if (!Number.isInteger(betCents) || betCents < 0) {
    throw new Error("betCents must be a non-negative integer");
  }

  const wins = [];
  for (const line of LINES) {
    const symbols = line.path.map(([reel, row]) => effectiveSymbol(grid, top, reel, row));
    const natural = symbols.filter((symbol) => symbol !== "wild");
    if (natural.length === 0) continue;

    const symbol = natural[0];
    const multiplier = paytable[symbol];
    if (multiplier == null) continue;
    if (!natural.every((entry) => entry === symbol)) continue;

    const wildReels = [];
    for (const [reel] of line.path) {
      if (top && top[reel] === "wild" && !wildReels.includes(reel)) wildReels.push(reel);
    }

    wins.push({
      lineId: line.id,
      label: line.label,
      symbol,
      multiplier,
      amountCents: multiplier * betCents,
      cells: line.path.map(([reel, row]) => ({ reel, row })),
      wildReels,
    });
  }

  const scatters = [];
  for (let reel = 0; reel < REEL_COUNT; reel += 1) {
    if (top && top[reel] === "scatter") scatters.push({ reel, where: "top" });
    for (let row = 0; row < ROW_COUNT; row += 1) {
      if (grid[reel][row] === "scatter") scatters.push({ reel, row, where: "grid" });
    }
  }

  const totalCents = wins.reduce((sum, win) => sum + win.amountCents, 0);
  return {
    wins,
    totalCents,
    scatters,
    crownLine: wins.some((win) => win.symbol === "crown"),
    bigWin: betCents > 0 && totalCents >= BIG_WIN_MULTIPLIER * betCents,
  };
}

export function canSpin(balanceCents, betCents, spinning) {
  return !spinning && betCents > 0 && balanceCents >= betCents;
}

/**
 * Deduct the bet, then credit whatever evaluate() returns.
 * Forced outcomes use this same path.
 */
export function playRound(balanceCents, betCents, outcome, paytable = PAYTABLE) {
  if (!canSpin(balanceCents, betCents, false)) {
    return { ok: false, reason: "insufficient", balanceCents, result: null };
  }
  const balanceAfterBet = balanceCents - betCents;
  const result = evaluate(outcome.grid, outcome.top, betCents, paytable);
  return {
    ok: true,
    balanceAfterBet,
    balanceCents: balanceAfterBet + result.totalCents,
    result,
  };
}

const LOSS_ROWS = [
  ["A", "K", "Q", "J", "10"],
  ["K", "Q", "J", "10", "A"],
  ["Q", "J", "10", "sword", "shield"],
];

/** Middle row is `symbol`. The other rows cannot complete a second line. */
export function forceLine(symbol) {
  const grid = [];
  for (let reel = 0; reel < REEL_COUNT; reel += 1) {
    grid.push([LOSS_ROWS[0][reel], symbol, LOSS_ROWS[2][reel]]);
  }
  return {
    grid,
    top: ["blank", null, "blank", null, "blank"],
    forced: symbol,
  };
}

export function forceLoss() {
  const grid = [];
  for (let reel = 0; reel < REEL_COUNT; reel += 1) {
    grid.push([LOSS_ROWS[0][reel], LOSS_ROWS[1][reel], LOSS_ROWS[2][reel]]);
  }
  return {
    grid,
    top: ["blank", null, "scatter", null, "blank"],
    forced: "loss",
  };
}

export function formatMoney(cents) {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  const withCommas = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${withCommas}.${fraction}`;
}
