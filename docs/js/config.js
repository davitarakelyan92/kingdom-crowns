/** Kingdom Crowns rules. Change pays here and nowhere else. */

/** Multiplier of the total bet for a 5-of-a-kind line. Wild and scatter are absent on purpose. */
export const PAYTABLE = {
  crown: 1000,
  "7": 500,
  sword: 100,
  shield: 75,
  A: 40,
  K: 30,
  Q: 25,
  J: 20,
  "10": 10,
};

export const PAY_ORDER = ["crown", "7", "sword", "shield", "A", "K", "Q", "J", "10"];

export const SYMBOL_LABEL = {
  wild: "Wild",
  scatter: "Scatter",
  crown: "Crown",
  sword: "Sword",
  shield: "Shield",
  "7": "7",
  A: "A",
  K: "K",
  Q: "Q",
  J: "J",
  "10": "10",
};

/**
 * Five fixed lines on the 5×3 reels. Coordinates are [reel, row]
 * with reel 0 on the left and row 0 the top of the 5×3.
 * The crown row above reels 1, 3 and 5 is not a payline.
 *
 *   top:        row0 across
 *   middle:     row1 across
 *   bottom:     row2 across
 *   V:          row0, row1, row2, row1, row0   (point down)
 *   inverted V: row2, row1, row0, row1, row2   (point up)
 */
export const LINES = [
  {
    id: "top",
    label: "Top line",
    path: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  },
  {
    id: "middle",
    label: "Middle line",
    path: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]],
  },
  {
    id: "bottom",
    label: "Bottom line",
    path: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]],
  },
  {
    id: "v",
    label: "V",
    path: [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0]],
  },
  {
    id: "inverted-v",
    label: "Inverted V",
    path: [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2]],
  },
];

/** Crown-row cells exist only above these reels. */
export const TOP_REELS = [0, 2, 4];

export const BET_CENTS = [20, 50, 100, 200, 500, 1000];
export const DEFAULT_BET_CENTS = 100;
export const STARTING_BALANCE_CENTS = 100_000;
export const BIG_WIN_MULTIPLIER = 100;

export const REEL_COUNT = 5;
export const ROW_COUNT = 3;
