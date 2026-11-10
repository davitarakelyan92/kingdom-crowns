/** Mulberry32. Same seed, same sequence, in the browser and in Node. */

export function createRng(seed) {
  let state = seed >>> 0;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    seed: seed >>> 0,
    next,
    /** Integer in [0, n). */
    int(n) {
      if (n <= 0) throw new Error("n must be positive");
      return Math.floor(next() * n);
    },
    getState() {
      return state >>> 0;
    },
  };
}
