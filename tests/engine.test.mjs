import assert from "node:assert/strict";
import test from "node:test";
import { PAYTABLE, PAY_ORDER, TOP_REELS } from "../docs/js/config.js";
import {
  canSpin,
  effectiveSymbol,
  evaluate,
  forceLine,
  forceLoss,
  formatMoney,
  playRound,
} from "../docs/js/engine.js";
import { createRng } from "../docs/js/rng.js";
import { CROWN_COUNTS, STRIPS, TOP_STRIPS, spinReels } from "../docs/js/reels.js";

test("paytable is the only prize list and matches the brief", () => {
  assert.deepEqual(PAYTABLE, {
    crown: 1000,
    "7": 500,
    sword: 100,
    shield: 75,
    A: 40,
    K: 30,
    Q: 25,
    J: 20,
    "10": 10,
  });
  assert.deepEqual(PAY_ORDER, ["crown", "7", "sword", "shield", "A", "K", "Q", "J", "10"]);
  assert.equal(PAYTABLE.wild, undefined);
  assert.equal(PAYTABLE.scatter, undefined);
});

test("a crown line pays 1000× the total bet and a forced one credits that", () => {
  const round = playRound(100_000, 100, forceLine("crown"));
  assert.equal(round.ok, true);
  assert.equal(round.balanceAfterBet, 99_900);
  assert.equal(round.balanceCents, 199_900);
  assert.equal(round.result.wins.length, 1);
  assert.equal(round.result.wins[0].symbol, "crown");
  assert.equal(round.result.wins[0].multiplier, 1000);
  assert.equal(round.result.wins[0].amountCents, 100_000);
  assert.equal(round.result.crownLine, true);
  assert.equal(round.result.bigWin, true);
  assert.equal(formatMoney(round.balanceAfterBet), "999.00");
  assert.equal(formatMoney(round.balanceCents), "1,999.00");
});

test("each paying symbol has exactly one forced line at its multiplier", () => {
  for (const symbol of PAY_ORDER) {
    const result = evaluate(forceLine(symbol).grid, forceLine(symbol).top, 100);
    assert.equal(result.wins.length, 1, symbol);
    assert.equal(result.wins[0].symbol, symbol);
    assert.equal(result.wins[0].lineId, "middle");
    assert.equal(result.totalCents, PAYTABLE[symbol] * 100);
  }
});

test("wild on the grid substitutes, including four wilds and one crown", () => {
  const grid = [
    ["crown", "K", "Q"],
    ["wild", "A", "J"],
    ["wild", "10", "A"],
    ["wild", "Q", "K"],
    ["wild", "J", "10"],
  ];
  const top = ["blank", null, "blank", null, "blank"];
  const result = evaluate(grid, top, 50);
  assert.equal(result.wins.length, 1);
  assert.equal(result.wins[0].symbol, "crown");
  assert.equal(result.totalCents, 1000 * 50);
});

test("a crown-row wild covers every row of its reel", () => {
  const grid = [
    ["crown", "crown", "crown"],
    ["crown", "crown", "crown"],
    ["sword", "shield", "A"],
    ["crown", "crown", "crown"],
    ["crown", "crown", "crown"],
  ];
  const top = ["blank", null, "wild", null, "blank"];
  assert.equal(effectiveSymbol(grid, top, 2, 0), "wild");
  assert.equal(effectiveSymbol(grid, top, 2, 1), "wild");
  assert.equal(effectiveSymbol(grid, top, 2, 2), "wild");
  assert.equal(effectiveSymbol(grid, top, 1, 1), "crown");

  const result = evaluate(grid, top, 100);
  assert.equal(result.wins.length, 5);
  assert.ok(result.wins.every((win) => win.symbol === "crown"));
  assert.equal(result.totalCents, 5 * 1000 * 100);
  assert.ok(result.wins.every((win) => win.wildReels.includes(2)));
});

test("a crown-row wild completes one crown line without paying the other rows", () => {
  const grid = [
    ["A", "crown", "Q"],
    ["K", "crown", "J"],
    ["sword", "sword", "10"],
    ["J", "crown", "A"],
    ["10", "crown", "K"],
  ];
  const top = ["blank", null, "wild", null, "blank"];
  const result = evaluate(grid, top, 100);
  assert.deepEqual(result.wins.map((win) => win.lineId), ["middle"]);
  assert.equal(result.totalCents, 100_000);
});

test("scatter pays nothing, is reported, and is not substituted", () => {
  const loss = forceLoss();
  const lost = evaluate(loss.grid, loss.top, 100);
  assert.equal(lost.totalCents, 0);
  assert.equal(lost.wins.length, 0);
  assert.deepEqual(lost.scatters, [{ reel: 2, where: "top" }]);

  const blocked = [
    ["crown", "A", "K"],
    ["crown", "Q", "J"],
    ["scatter", "10", "A"],
    ["crown", "J", "Q"],
    ["crown", "K", "10"],
  ];
  const result = evaluate(blocked, ["blank", null, "blank", null, "blank"], 100);
  assert.equal(result.totalCents, 0);
  assert.equal(result.scatters.length, 1);
  assert.equal(result.scatters[0].where, "grid");
});

test("a crown-row scatter does not change the reel and an all-wild line pays nothing", () => {
  const crowned = forceLine("crown");
  crowned.top = ["blank", null, "scatter", null, "blank"];
  const result = evaluate(crowned.grid, crowned.top, 100);
  assert.equal(result.wins.length, 1);
  assert.equal(result.totalCents, 100_000);
  assert.equal(result.scatters.length, 1);

  const wilds = [
    ["wild", "wild", "wild"],
    ["wild", "wild", "wild"],
    ["wild", "wild", "wild"],
    ["wild", "wild", "wild"],
    ["wild", "wild", "wild"],
  ];
  const nothing = evaluate(wilds, ["wild", null, "wild", null, "wild"], 100);
  assert.equal(nothing.totalCents, 0);
  assert.equal(nothing.wins.length, 0);
});

test("separate lines are added and sword at 100× is a big win", () => {
  const grid = [
    ["sword", "shield", "A"],
    ["sword", "shield", "K"],
    ["sword", "shield", "Q"],
    ["sword", "shield", "J"],
    ["sword", "shield", "10"],
  ];
  const result = evaluate(grid, ["blank", null, "blank", null, "blank"], 100);
  assert.equal(result.wins.length, 2);
  assert.equal(result.totalCents, (100 + 75) * 100);
  assert.equal(result.bigWin, true);

  const shield = evaluate(forceLine("shield").grid, forceLine("shield").top, 100);
  assert.equal(shield.totalCents, 7500);
  assert.equal(shield.bigWin, false);
});

test("a spin below the bet is blocked and does not move the balance", () => {
  assert.equal(canSpin(50, 100, false), false);
  assert.equal(canSpin(100, 100, true), false);
  const round = playRound(50, 100, forceLine("crown"));
  assert.equal(round.ok, false);
  assert.equal(round.balanceCents, 50);
  assert.equal(round.result, null);
});

test("reel strips only place paying symbols, and the crown row is wild, scatter, or blank", () => {
  STRIPS.forEach((strip, reel) => {
    assert.equal(strip.length, 200);
    assert.equal(strip.filter((symbol) => symbol === "crown").length, CROWN_COUNTS[reel]);
    for (const symbol of strip) assert.ok(PAYTABLE[symbol], symbol);
  });
  for (let reel = 0; reel < 5; reel += 1) {
    if (TOP_REELS.includes(reel)) {
      assert.ok(TOP_STRIPS[reel].every((symbol) => ["wild", "scatter", "blank"].includes(symbol)));
    } else {
      assert.equal(TOP_STRIPS[reel], null);
    }
  }
});

test("the seeded reel draw is stable", () => {
  const first = spinReels(createRng(20261110));
  const second = spinReels(createRng(20261110));
  assert.deepEqual(first.grid, second.grid);
  assert.deepEqual(first.top, second.top);
  const other = spinReels(createRng(7));
  assert.notDeepEqual(first.grid, other.grid);
});

test("money formatting", () => {
  assert.equal(formatMoney(0), "0.00");
  assert.equal(formatMoney(100000), "1,000.00");
  assert.equal(formatMoney(20), "0.20");
  assert.equal(formatMoney(-150), "-1.50");
});
