import { REEL_COUNT, ROW_COUNT, TOP_REELS } from "./config.js";

export const REEL_LENGTH = 200;
export const TOP_LENGTH = 100;

/**
 * Crown counts are the tuning knob for the 1-in-1000 crown-line target.
 * Calibrated with a multi-million-spin search (see README). Each reel has
 * this many crowns; the rest of the strip is the fixed mix below.
 * 10 takes whatever stops are left so the strip length stays exact.
 */
/** Per reel, left to right. Mixed 34/35 so a crown line lands about once in 1,000 spins. */
export const CROWN_COUNTS = [34, 35, 34, 35, 34];

/** Stops besides the crown. 10 fills the rest of the 200-stop strip. */
const FIXED_COUNTS = {
  "7": 10,
  sword: 8,
  shield: 8,
  A: 12,
  K: 14,
  Q: 16,
  J: 22,
};

/** Crown-row strip. Only wild, scatter, or blank. */
export const TOP_COUNTS = { wild: 2, scatter: 3, blank: 95 };

const PLACE_ORDER = ["crown", "7", "sword", "shield", "A", "K", "Q", "J", "10"];
const TOP_ORDER = ["wild", "scatter", "blank"];

export function buildStrip(length, counts, order) {
  const names = order ?? Object.keys(counts);
  const total = names.reduce((sum, name) => sum + (counts[name] ?? 0), 0);
  if (total !== length) {
    throw new Error(`strip counts add up to ${total}, expected ${length}`);
  }
  const strip = new Array(length).fill(null);
  for (const symbol of names) {
    const count = counts[symbol] ?? 0;
    for (let i = 0; i < count; i += 1) {
      const ideal = Math.round(((i + 0.5) * length) / count - 0.5);
      let placed = false;
      for (let distance = 0; distance < length && !placed; distance += 1) {
        const candidates = distance === 0
          ? [ideal]
          : [(ideal + distance) % length, (ideal - distance + length) % length];
        for (const index of candidates) {
          if (strip[index] == null) {
            strip[index] = symbol;
            placed = true;
            break;
          }
        }
      }
      if (!placed) throw new Error(`no open stop for ${symbol}`);
    }
  }
  return strip;
}

export function rotate(strip, offset) {
  const shift = ((offset % strip.length) + strip.length) % strip.length;
  if (shift === 0) return strip.slice();
  return strip.slice(shift).concat(strip.slice(0, shift));
}

export function countsForCrown(crown) {
  const counts = { crown, ...FIXED_COUNTS };
  const used = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const tens = REEL_LENGTH - used;
  if (tens < 1) throw new Error(`crown count ${crown} leaves no room for 10`);
  counts["10"] = tens;
  return counts;
}

export function createStrips(crownCounts = CROWN_COUNTS) {
  return crownCounts.map((crown, reel) => {
    const strip = buildStrip(REEL_LENGTH, countsForCrown(crown), PLACE_ORDER);
    return rotate(strip, reel * 37);
  });
}

export function createTopStrips(counts = TOP_COUNTS) {
  const base = buildStrip(TOP_LENGTH, counts, TOP_ORDER);
  const strips = [null, null, null, null, null];
  TOP_REELS.forEach((reel, index) => {
    strips[reel] = rotate(base, index * 19);
  });
  return strips;
}

export const STRIPS = createStrips();
export const TOP_STRIPS = createTopStrips();

export function spinReels(rng, strips = STRIPS, topStrips = TOP_STRIPS) {
  const grid = [];
  const stops = [];
  for (let reel = 0; reel < REEL_COUNT; reel += 1) {
    const strip = strips[reel];
    const stop = rng.int(strip.length);
    stops.push(stop);
    const column = [];
    for (let row = 0; row < ROW_COUNT; row += 1) {
      column.push(strip[(stop + row) % strip.length]);
    }
    grid.push(column);
  }

  const top = [null, null, null, null, null];
  const topStops = [null, null, null, null, null];
  for (const reel of TOP_REELS) {
    const strip = topStrips[reel];
    const stop = rng.int(strip.length);
    topStops[reel] = stop;
    top[reel] = strip[stop];
  }

  return { grid, top, stops, topStops };
}
