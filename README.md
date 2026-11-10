# Kingdom Crowns

A fictional 18+ slot demo. No real money, no real operator, and no tracking. The approved art stays in `source/`. The playable game is a static site in `docs/`.

## GitHub Pages

Serve the **`/docs`** folder.

In the repository settings: **Pages → Build and deployment → Deploy from a branch → Branch `main` → Folder `/docs`**. The site root is `docs/index.html`. Paths inside the page are relative, so that folder is the whole site.

Locally, from the repository root:

```bash
npm start
```

Then open `http://127.0.0.1:4173`. Any static file server pointed at `docs/` works the same way. There is no build step. `npm install` is only for the headless browser test.

## How a spin works

- The balance starts at **1,000.00**. The bet starts at **1.00**. Steps are 0.20, 0.50, 1.00, 2.00, 5.00 and 10.00.
- Spin deducts the bet first. If the balance is below the bet, the spin does not run.
- The window is five reels by three rows, plus a crown row with cells only above reels 1, 3 and 5. Those cells show a wild, a scatter, or nothing.
- Five fixed lines. Coordinates are reel then row, reels left to right, row 0 at the top of the 5×3:

  | Line | Path |
  | --- | --- |
  | Top | (1,0) (2,0) (3,0) (4,0) (5,0) |
  | Middle | (1,1) (2,1) (3,1) (4,1) (5,1) |
  | Bottom | (1,2) (2,2) (3,2) (4,2) (5,2) |
  | V, point down | (1,0) (2,1) (3,2) (4,1) (5,0) |
  | Inverted V, point up | (1,2) (2,1) (3,0) (4,1) (5,2) |

- The crown row is not a payline.
- Only a full line of five pays. Three of a kind and four of a kind pay nothing.
- Each winning line pays its multiplier times the **total bet**. The multipliers live in one object, `PAYTABLE` in `docs/js/config.js`. Line wins are added.

  | Symbol | 5 of a kind |
  | --- | --- |
  | Crown | 1,000× |
  | 7 | 500× |
  | Sword | 100× |
  | Shield | 75× |
  | A | 40× |
  | K | 30× |
  | Q | 25× |
  | J | 20× |
  | 10 | 10× |

- A win of **100×** the bet or more is a Big Win. Crown, 7 and sword lines all qualify on their own.
- Add `?test=1` for the test panel. It can force a crown line, a 7 line, any symbol line, or a loss. Forced spins still deduct the bet and pay through the same evaluator. `?seed=` fixes the reel RNG.

## Rule calls

- **Wild** substitutes for one paying symbol. It does not substitute for scatter, and it is not in the pay table. A line that is entirely wild pays nothing: there is no paying symbol left for the wilds to stand in for.
- A **wild in the crown row** is wild for every row of that reel, on every line. One crown-row wild can complete all five lines at once if the other reels cooperate.
- **Scatter** is highlighted, pays nothing, and starts no feature. A scatter sitting on a line breaks that line.
- In normal play, wild and scatter land only in the crown row. The five main strips carry the paying symbols. The evaluator still treats a wild drawn onto a main cell as a substitute, which is what the forced-line and unit tests use.
- Reel strips are weighted so a spin with at least one crown line (five crowns, or crowns completed by wilds) lands about **once in 1,000** spins. Across three seeds and 6,000,000 spins the rate was 6,024 crown-line spins, **1 in 996**. The 100,000-spin script below is one sample of that strip and will move around that figure.

The background painting includes a printed control bar. The web copy is the full frame, only resized. The live dock is drawn on top of that printed bar.

## Checks

```bash
npm test                 # line evaluation
npm run simulate         # 100,000 spins, seed 20261110
npm run test:browser     # built page in headless Chrome
```

`npm run simulate` on seed `20261110`:

- Crown-line spins: **95 (1 in 1,052.6)**. Crown lines awarded: 95.
- Hit rate: **4.04%** (4,041 winning spins).
- RTP: **138.07%** (138,070.00 returned on 100,000.00 staked).

Most ordinary hits are 10-of-a-kind at 10×. The return sits above 100% because a 1,000× crown line near 1/1,000 already returns about the stake, and the low-symbol lines add the rest. No extra pays were invented to push the hit rate higher. A longer run of the same strip (seed 1, 2,000,000 spins) was 1 in 998, hit rate 4.03%, RTP 143.45%.

The browser test opens `docs/` with `?test=1`, forces a crown line at bet 1.00, and checks the balance moves **1,000.00 → 999.00 → 1,999.00**. It then checks that a normal spin deducts the bet before crediting any win. It also fails on console errors, any response that is not 200, or any request that leaves the page. Desktop, a 390px portrait and a short landscape are checked for horizontal overflow.

## Art

`source/` is the approved r6 art and is not modified. `source/SOURCE-SHA256.txt` lists the hashes. Web copies (resized WebP, and a smaller intro video) are written to `docs/assets/` by `tools/optimize-assets.py`. Fonts are the Latin subsets of Cinzel, Cinzel Decorative and Barlow Semi Condensed, stored under `docs/fonts/`. Nothing is loaded from a third party at runtime.
