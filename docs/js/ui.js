import {
  BET_CENTS,
  BIG_WIN_MULTIPLIER,
  DEFAULT_BET_CENTS,
  LINES,
  PAY_ORDER,
  PAYTABLE,
  STARTING_BALANCE_CENTS,
  SYMBOL_LABEL,
} from "./config.js";
import { canSpin, forceLine, forceLoss, formatMoney, playRound } from "./engine.js";
import { createRng } from "./rng.js";
import { spinReels } from "./reels.js";

const params = new URLSearchParams(location.search);
const testMode = params.get("test") === "1";
const seed = params.has("seed") ? Number(params.get("seed")) >>> 0 : (Math.random() * 0x100000000) >>> 0;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const IDLE = {
  grid: [
    ["A", "crown", "K"],
    ["sword", "J", "Q"],
    ["K", "shield", "sword"],
    ["7", "10", "crown"],
    ["Q", "A", "J"],
  ],
  top: ["wild", null, "scatter", null, "wild"],
};

const MAIN_FILL = ["10", "J", "Q", "K", "A", "10", "J", "Q", "crown", "sword", "shield", "7"];
const TOP_FILL = ["blank", "blank", "blank", "blank", "scatter", "wild", "blank"];

const state = {
  balance: STARTING_BALANCE_CENTS,
  bet: DEFAULT_BET_CENTS,
  win: 0,
  spinning: false,
  rng: createRng(seed),
  balanceLog: [],
};

const el = {
  intro: document.querySelector("#intro"),
  game: document.querySelector("#game"),
  enter: document.querySelector("#enter"),
  watch: document.querySelector("#watch"),
  video: document.querySelector("#intro-video"),
  balance: document.querySelector("#balance"),
  bet: document.querySelector("#bet"),
  win: document.querySelector("#win"),
  spin: document.querySelector("#spin"),
  betDown: document.querySelector("#bet-down"),
  betUp: document.querySelector("#bet-up"),
  betOpen: document.querySelector("#bet-open"),
  betSheet: document.querySelector("#bet-sheet"),
  note: document.querySelector("#note"),
  plaque: document.querySelector("#plaque"),
  plaqueTitle: document.querySelector("#plaque-title"),
  plaqueDetail: document.querySelector("#plaque-detail"),
  plaqueAmount: document.querySelector("#plaque-amount"),
  paytable: document.querySelector("#paytable"),
  payList: document.querySelector("#pay-list"),
  lineMaps: document.querySelector("#line-maps"),
  bigRule: document.querySelector("#big-win-rule"),
  bigwin: document.querySelector("#bigwin"),
  bigKicker: document.querySelector("#big-kicker"),
  bigDetail: document.querySelector("#big-detail"),
  bigAmount: document.querySelector("#big-amount"),
  collect: document.querySelector("#collect"),
  openPay: document.querySelector("#open-paytable"),
  closePay: document.querySelector("#paytable-close"),
  testPanel: document.querySelector("#test-panel"),
  forceCrown: document.querySelector("#force-crown"),
  forceSeven: document.querySelector("#force-seven"),
  forceSymbol: document.querySelector("#force-symbol"),
  forceSelect: document.querySelector("#force-symbol-select"),
  forceLoss: document.querySelector("#force-loss"),
};

function setBalance(cents) {
  state.balance = cents;
  state.balanceLog.push(cents);
  el.balance.textContent = formatMoney(cents);
  el.balance.dataset.cents = String(cents);
}

function setWin(cents) {
  state.win = cents;
  el.win.textContent = formatMoney(cents);
  el.win.dataset.cents = String(cents);
  el.win.classList.toggle("is-win", cents > 0);
}

function setBet(cents) {
  state.bet = cents;
  el.bet.textContent = formatMoney(cents);
  el.bet.dataset.cents = String(cents);
  renderBetSheet();
  updateControls();
}

function updateControls() {
  const affordable = state.balance >= state.bet;
  el.spin.disabled = !canSpin(state.balance, state.bet, state.spinning);
  el.betDown.disabled = state.spinning || BET_CENTS.indexOf(state.bet) <= 0;
  el.betUp.disabled = state.spinning || BET_CENTS.indexOf(state.bet) >= BET_CENTS.length - 1;
  el.betOpen.disabled = state.spinning;
  el.openPay.disabled = state.spinning;
  for (const button of el.testPanel.querySelectorAll("button")) button.disabled = state.spinning;
  el.forceSelect.disabled = state.spinning;
  el.note.hidden = state.spinning || affordable;
  if (!state.spinning) {
    document.body.dataset.spin = state.balanceLog.length > 1 ? "done" : "idle";
  }
}

function face(symbol) {
  if (symbol === "blank") return `<div class="face blank" role="img" aria-label="Empty"></div>`;
  const label = SYMBOL_LABEL[symbol] ?? symbol;
  return `<img class="face" alt="${label}" src="assets/tiles/${symbol}.webp" draggable="false">`;
}

function paint(strip, symbols) {
  strip.style.transition = "none";
  strip.style.transform = "translate3d(0,0,0)";
  strip.innerHTML = symbols.map(face).join("");
}

function showStatic(outcome) {
  document.querySelectorAll(".reel").forEach((reel) => {
    const index = Number(reel.dataset.reel);
    paint(reel.querySelector(".strip"), outcome.grid[index]);
  });
  document.querySelectorAll(".top-reel").forEach((reel) => {
    const index = Number(reel.dataset.top);
    const symbol = outcome.top[index] ?? "blank";
    paint(reel.querySelector(".strip"), [symbol]);
    reel.classList.toggle("is-blank", symbol === "blank");
  });
}

function sequence(finalSymbols, extra, pool) {
  const symbols = [];
  for (let i = 0; i < extra; i += 1) {
    symbols.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  symbols.push(...finalSymbols);
  return symbols;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function animateTo(outcome) {
  const jobs = [];
  document.querySelectorAll(".reel").forEach((reel) => {
    const index = Number(reel.dataset.reel);
    const duration = reduced ? 0 : 680 + index * 150;
    const symbols = sequence(outcome.grid[index], reduced ? 0 : 14 + index * 2, MAIN_FILL);
    jobs.push(spinStrip(reel.querySelector(".strip"), symbols, 3, duration).then(() => {
      paint(reel.querySelector(".strip"), outcome.grid[index]);
    }));
  });
  document.querySelectorAll(".top-reel").forEach((reel) => {
    const index = Number(reel.dataset.top);
    const symbol = outcome.top[index] ?? "blank";
    const duration = reduced ? 0 : 680 + index * 150;
    const symbols = sequence([symbol], reduced ? 0 : 12 + index, TOP_FILL);
    jobs.push(spinStrip(reel.querySelector(".strip"), symbols, 1, duration).then(() => {
      paint(reel.querySelector(".strip"), [symbol]);
      reel.classList.toggle("is-blank", symbol === "blank");
    }));
  });
  await Promise.all(jobs);
}

async function spinStrip(strip, symbols, visible, duration) {
  paint(strip, symbols);
  if (duration <= 0 || symbols.length <= visible) return;
  const faceEl = strip.querySelector(".face");
  const faceHeight = faceEl.getBoundingClientRect().height;
  if (faceHeight < 1) return;
  const distance = (symbols.length - visible) * faceHeight;
  strip.getBoundingClientRect();
  strip.style.transition = `transform ${duration}ms cubic-bezier(.12,.7,.05,1)`;
  strip.style.transform = `translate3d(0,${-distance}px,0)`;
  await wait(duration + 40);
}

function clearHighlights() {
  document.querySelectorAll(".hit").forEach((hit) => {
    hit.className = "hit";
    if (hit.dataset.row != null) hit.dataset.row = hit.dataset.row;
  });
  document.querySelectorAll(".top-reel").forEach((reel) => {
    reel.classList.remove("win", "scatter");
  });
}

function showHighlights(result) {
  clearHighlights();
  for (const win of result.wins) {
    for (const cell of win.cells) {
      const hit = document.querySelector(`.reel[data-reel="${cell.reel}"] .hit[data-row="${cell.row}"]`);
      hit.classList.add("on");
      if (win.wildReels.includes(cell.reel)) hit.classList.add("covered");
    }
    for (const reel of win.wildReels) {
      document.querySelector(`.top-reel[data-top="${reel}"]`)?.classList.add("win");
    }
  }
  for (const scatter of result.scatters) {
    if (scatter.where === "top") {
      document.querySelector(`.top-reel[data-top="${scatter.reel}"]`)?.classList.add("scatter");
    } else {
      document.querySelector(`.reel[data-reel="${scatter.reel}"] .hit[data-row="${scatter.row}"]`)?.classList.add("scatter");
    }
  }
}

function winTitle(result) {
  const names = new Set(result.wins.map((win) => win.symbol));
  if (names.size === 1) {
    const label = SYMBOL_LABEL[result.wins[0].symbol];
    return result.wins.length > 1 ? `${label} lines` : `${label} line`;
  }
  return `${result.wins.length} lines`;
}

function winDetail(result) {
  if (result.wins.length === 1) {
    const win = result.wins[0];
    return `${win.multiplier.toLocaleString("en-US")}× · Bet ${formatMoney(state.bet)}`;
  }
  return `Bet ${formatMoney(state.bet)}`;
}

function present(result) {
  if (result.totalCents <= 0) {
    el.plaque.hidden = true;
    el.bigwin.hidden = true;
    return;
  }
  if (result.bigWin) {
    el.plaque.hidden = true;
    el.bigKicker.textContent = winTitle(result);
    el.bigDetail.textContent = winDetail(result);
    el.bigAmount.textContent = formatMoney(result.totalCents);
    el.bigwin.hidden = false;
    el.collect.focus();
    return;
  }
  el.bigwin.hidden = true;
  el.plaqueTitle.textContent = winTitle(result);
  el.plaqueDetail.textContent = winDetail(result);
  el.plaqueAmount.textContent = formatMoney(result.totalCents);
  el.plaque.hidden = false;
}

async function startSpin(forced) {
  if (!canSpin(state.balance, state.bet, state.spinning)) {
    updateControls();
    return;
  }
  state.spinning = true;
  document.body.dataset.spin = "spinning";
  el.bigwin.hidden = true;
  el.plaque.hidden = true;
  el.betSheet.hidden = true;
  clearHighlights();
  setWin(0);
  updateControls();

  const outcome = forced ?? spinReels(state.rng);
  const round = playRound(state.balance, state.bet, outcome);
  setBalance(round.balanceAfterBet);
  await animateTo(outcome);
  setBalance(round.balanceCents);
  setWin(round.result.totalCents);
  showHighlights(round.result);
  present(round.result);
  state.spinning = false;
  document.body.dataset.spin = "done";
  updateControls();
}

function renderBetSheet() {
  el.betSheet.replaceChildren();
  for (const cents of BET_CENTS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = cents === state.bet ? "chip on" : "chip";
    button.textContent = formatMoney(cents);
    button.addEventListener("click", () => {
      setBet(cents);
      el.betSheet.hidden = true;
      el.betOpen.setAttribute("aria-expanded", "false");
    });
    el.betSheet.append(button);
  }
}

function renderPaytable() {
  el.payList.replaceChildren();
  for (const symbol of PAY_ORDER) {
    const item = document.createElement("li");
    const image = document.createElement("img");
    image.src = `assets/tiles/${symbol}.webp`;
    image.alt = "";
    const name = document.createElement("span");
    name.className = "pay-name";
    name.textContent = SYMBOL_LABEL[symbol];
    const mult = document.createElement("span");
    mult.className = "pay-mult";
    mult.textContent = `${PAYTABLE[symbol].toLocaleString("en-US")}×`;
    item.append(image, name, mult);
    el.payList.append(item);
  }

  el.lineMaps.replaceChildren();
  for (const line of LINES) {
    const figure = document.createElement("figure");
    const grid = document.createElement("div");
    grid.className = "mini";
    const active = new Set(line.path.map(([reel, row]) => `${reel}-${row}`));
    for (let row = 0; row < 3; row += 1) {
      for (let reel = 0; reel < 5; reel += 1) {
        const cell = document.createElement("i");
        if (active.has(`${reel}-${row}`)) cell.className = "on";
        grid.append(cell);
      }
    }
    const caption = document.createElement("figcaption");
    caption.textContent = line.label;
    figure.append(grid, caption);
    el.lineMaps.append(figure);
  }

  el.bigRule.textContent = `A win of ${BIG_WIN_MULTIPLIER}× the bet or more is presented as a Big Win.`;
}

function stepBet(direction) {
  const index = BET_CENTS.indexOf(state.bet);
  const next = BET_CENTS[index + direction];
  if (next != null) setBet(next);
}

function openPaytable() {
  el.paytable.hidden = false;
  el.closePay.focus();
}

function closePaytable() {
  el.paytable.hidden = true;
  el.openPay.focus();
}

el.enter.addEventListener("click", () => {
  el.video.pause();
  el.intro.hidden = true;
  el.game.hidden = false;
  document.body.dataset.screen = "game";
});

el.watch.addEventListener("click", () => {
  if (!el.video.getAttribute("src")) el.video.src = "assets/intro.mp4";
  el.video.hidden = false;
  el.video.play();
});

el.spin.addEventListener("click", () => startSpin());
el.betDown.addEventListener("click", () => stepBet(-1));
el.betUp.addEventListener("click", () => stepBet(1));
el.betOpen.addEventListener("click", () => {
  el.betSheet.hidden = !el.betSheet.hidden;
  el.betOpen.setAttribute("aria-expanded", String(!el.betSheet.hidden));
});
el.openPay.addEventListener("click", openPaytable);
el.closePay.addEventListener("click", closePaytable);
el.collect.addEventListener("click", () => {
  el.bigwin.hidden = true;
  el.spin.focus();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!el.bigwin.hidden) el.bigwin.hidden = true;
    else if (!el.paytable.hidden) closePaytable();
    return;
  }
  if (event.code !== "Space") return;
  if (event.target.closest("button, select, input, textarea")) return;
  if (!el.game.hidden && el.bigwin.hidden && el.paytable.hidden) {
    event.preventDefault();
    startSpin();
  }
});

const choices = [...PAY_ORDER, "wild", "scatter"];
for (const symbol of choices) {
  const option = document.createElement("option");
  option.value = symbol;
  option.textContent = SYMBOL_LABEL[symbol];
  el.forceSelect.append(option);
}
el.forceCrown.addEventListener("click", () => startSpin(forceLine("crown")));
el.forceSeven.addEventListener("click", () => startSpin(forceLine("7")));
el.forceSymbol.addEventListener("click", () => startSpin(forceLine(el.forceSelect.value)));
el.forceLoss.addEventListener("click", () => startSpin(forceLoss()));

if (testMode) {
  el.testPanel.hidden = false;
  window.__kc = {
    get balanceLog() { return state.balanceLog.slice(); },
    get balance() { return state.balance; },
    get seed() { return seed; },
  };
}

renderPaytable();
renderBetSheet();
showStatic(IDLE);
setBalance(STARTING_BALANCE_CENTS);
setBet(DEFAULT_BET_CENTS);
setWin(0);
updateControls();
