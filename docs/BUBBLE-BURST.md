# Bubble Burst — design, progression and performance contract

This document is the gameplay source of truth for Bubble Burst.

## Runtime files

- `games/bubble-burst/index.html`
- `games/bubble-burst/levels.js` — deterministic open-ended clustered-layout generator
- `games/bubble-burst/game.js` — authoritative gameplay/runtime
- `games/bubble-burst/style.css`

`levels.js` must load before `game.js`; shared `game-hud.js` and `orientation.js` remain authoritative for platform lifecycle/UI.

## Level catalogue

The generator produces a deterministic new composition for every level. A given level number always reproduces exactly the same cells, colors, specials, clusters and signature on every run/device: there is no per-play randomness in level architecture. The first 200 remain the base named catalogue, while later levels continue producing new real arrangements rather than merely relabelling recycled geometry:

- 20 visual motif families;
- 10 deterministic variants per motif;
- at least the first 1000 levels are validator-guarded as distinct actual bubble compositions, not only distinct signatures;
- top-connected height-profile construction so decorative silhouettes do not begin as unsupported floating islands;
- deterministic downward lobe descriptors give every layout at least two attached bubble clusters;
- cluster count, depth and colored cohesion grow with progression, producing increasingly pronounced bunches toward the danger line;
- increasing row count, palette breadth and special-bubble density through long-run progression;
- motif names may cycle after level 200, but the geometry, clustered colors, special placement and signature continue changing from the absolute level seed.

Current motif families include Aurora Bands, Neon Crown, Twin Peaks, Pixel Wave, Diamond Sky, Arcade Steps, Cosmic Bowl, Double Arc, Star Ridge, Cascade, Portal Rim, Zigzag Field, Comet Tail, Butterfly, Fortress, Hyper Wave, Crystal Fan, Echo Valley, Nova Teeth and Mosaic Sky.

## Optimal-time scoring

Every generated level exposes a deterministic `optimalSeconds` value derived from its actual complexity: bubble count, row depth, palette breadth and Armor/Star/Prism density. It is not a single hard-coded time shared by every layout.

The upper gameplay UI includes a large centered timer immediately below `SCORE / LEVEL / FALLI`, rendered with centisecond precision as `MM:SS.CC`.

Timing tiers:

- **green** while `elapsed <= optimalSeconds`;
- **orange** after the optimal time and through `optimalSeconds + (optimalSeconds × 2.5)`, therefore through a total deadline of `3.5 × optimalSeconds`;
- **red** after that deadline, with no further timing threshold.

Completion bonus:

- green clear: `+50%` of points generated in that level;
- orange clear: `+25%`;
- red clear: no timing bonus.

`Punti livello` includes points earned during play plus the existing base level-clear award. The percentage bonus is applied to that per-level subtotal; the run total is then updated with the resulting bonus.

The level clock measures active gameplay time only. It pauses during explicit pause/background-orientation pause and during the intermediate completion presentation. A credit Continue after terminal death MUST NOT reset the level elapsed time or `levelStartScore`, otherwise timing bonuses could be farmed by continuing.

## Arcade level-clear presentation

Clearing the board is an INTERMEDIATE state, not terminal Game Over.

Gameplay freezes and an arcade overlay enters with animated starfield/panel and staggered rows:

1. `LIVELLO {level} COMPLETATO!`, identifying the level just cleared
2. `Punti livello: {points}`
3. `Tempo: {MM:SS.CC}`
4. `Bonus: +50% / +25% / NO BONUS!`
5. emphasized `Totale: {level total} punti!`
6. `TOCCA PER CONTINUARE`

The tap is accepted only after the calculation animation has had time to become readable, then the next level starts and its timer resets to zero.

This intermediate overlay MUST NOT emit `rwg:game-ended`, MUST NOT call shared `RWGGameOver`, and MUST NOT modify the terminal Game Over contract.

## Static special bubbles

Special bubbles appear progressively inside the structure to destroy.

### Armor Bubble

- introduced from level 8;
- visually armored;
- a normal color match first breaks the shell instead of immediately deleting it;
- forced special effects may destroy it directly.

### Star Bubble

- introduced from level 18;
- when removed, triggers a compact one-ring local blast;
- intentionally stronger than an ordinary match but kept uncommon.

### Prism Bubble

- introduced from level 35;
- acts as a wildcard when resolving a same-color connected component;
- visually distinct/rainbow-prismatic.

## Rare launched special shots

Normal ammunition remains dominant.

### Bomb

- unlocks from level 10;
- starts around 1.2% shot probability;
- slowly scales but is capped around 3%;
- detonates around the first structure bubble touched;
- removes bubbles in a compact local radius and then resolves disconnected groups.

### Color Wipe

- unlocks from level 22;
- starts around 0.7% shot probability;
- slowly scales but is capped around 2%;
- on impact removes every structure bubble sharing the touched bubble's color;
- then resolves disconnected groups.

Do not turn either special shot into frequent ammunition without an explicit balance decision.

## Consecutive popping-shot Bomb reward

Every fifth consecutive shot that removes at least one structure bubble awards a Bomb. A shot with no popped bubble resets the streak. The reward promotes the first normal current/next ammunition slot, so an already queued rare Bomb or Color Wipe is never overwritten; if both slots are special, the earned Bomb remains pending until a normal slot becomes available.

## Timed ceiling pressure

The bubble structure is not static for the whole stage. During active play the ceiling progressively moves downward toward the danger line.

Current pressure curve:

- level 1 first drop: **32.5 seconds**, exactly half of the previous 65-second window;
- the base interval decreases exponentially by level with a floor of **8 seconds**, exactly half of the previous 16-second floor;
- approximate first-drop intervals: level 10 ≈ 27.6 s, level 25 ≈ 21 s, level 50 ≈ 13.4 s, level 80+ ≈ 8 s;
- after every descent inside the same level, the next interval is multiplied by **0.86**, so sustained play accelerates the ceiling step by step until the 8-second floor;
- each drop starts at **0.5 row** at level 1 and gradually grows toward **0.9 row** by high levels;
- repeated drops continue within the same level until the board is cleared or reaches the danger line;
- the timer advances only while gameplay is actually running; pause/visibility/orientation pauses do not consume pressure time;
- if a pressure drop becomes due while a projectile is in flight, it waits until the projectile resolves so collision geometry does not jump mid-shot;
- the last 6 seconds before a drop show an arcade warning; the ceiling line itself is drawn so its downward movement is visually readable;
- a new level resets ceiling offset and pressure timer using that level's harder interval;
- a one-credit Continue preserves the descended board position, drop count and accelerated interval but resets the current countdown, while the existing safety pruning may remove dangerous bottom rows.

This pressure system is separate from the miss-penalty row. Both mechanics may contribute to the board approaching the danger line.

## Difficulty

Difficulty increases through:

- larger/more complex silhouettes;
- palette growth from four toward six colors;
- progressively more special bubbles;
- miss limit tightening from 5 to 4 and eventually 3;
- modest baseline shot-speed increase by level, with launched speed globally multiplied by three;
- timed ceiling pressure beginning twice as fast, accelerating after every same-level drop and becoming slightly deeper per drop;
- continued scaling after the first 200 levels.

## Rendering and performance

The engine intentionally remains JavaScript + Canvas 2D.

Performance invariants:

- moving-shot collision uses nearby hex-cell lookup rather than scanning every bubble in the grid;
- high-speed projectiles are sub-stepped by travelled distance so the 3× launch speed cannot tunnel through bubbles or walls;
- the renderer reuses those sub-step positions for a short additive path and cached-sprite afterimages, improving perceived motion continuity without reducing speed or forcing a lower frame rate;
- aim tracing uses the same local collision lookup;
- pressure descent is represented as a fractional row-space ceiling offset instead of rewriting every bubble coordinate, so resize remains stable and the pressure update is O(1);
- bubble visuals are cached as 96×96 offscreen sprites by color/type/armor state instead of rebuilding gradients for every bubble every frame; ordinary cover-matched marbles use the vivid raster-cover palette, a full-color center, a dark softly blended inner ring, solid-color rim, thick upper-left reflection, smaller lower-right counter-reflection and restrained internal glass texture;
- special materials remain immediately distinguishable without extra per-frame work: Bomb is a black spherical bomb with neck, fuse and spark; Armor is brushed/riveted metal (and visibly cracked after its shell breaks); Star is carved stone; Prism and Color Wipe are faceted translucent acrylic/plastic;
- the frame loop still performs exactly one cached `drawImage` per bubble, including specials;
- background artwork is cached and rebuilt only on resize;
- the two 1024×512 RGBA character sheets are decoded once and reused; the frame loop performs only two cropped raster draws plus lightweight eye/transform work;
- aim dots and character gaze reuse one trajectory prediction per active preview frame;
- graph traversal uses index-based queues rather than repeated `Array.shift()`;
- particle/falling visual counts are bounded;
- timer DOM text is updated only when the displayed centisecond changes;
- no external rendering dependency is required.

WASM is not justified for the current board sizes. Reconsider only after measured profiling demonstrates a numeric hot loop above the project thresholds documented in `docs/WASM-EVALUATION.md`.

## Manga-chibi launcher crew

Bubble Burst includes two original manga-chibi operators derived from the visual identity of the game cover:

- `assets/sprites/bubble-burst/operator-sheet.png` and `loader-sheet.png` are original transparent raster atlases with idle, joy, fear and sadness poses;
- both sheets are preloaded and decoded once; no per-frame sprite generation, temporary canvas or external rendering dependency is allowed;
- continuous breathing, opposite-phase bob, subtle directional turn, fear shake, joy bounce and shot recoil use Canvas transforms around the cached sheets;
- successful pops trigger joy, misses trigger sadness, and imminent miss/pressure danger selects fear; reactions are bounded state timers and never mutate the DOM per frame;
- large expressive pupils remain procedural and track upward toward the first predicted wall bounce, otherwise the first attach/ceiling impact, with the current upward aim as fallback;
- `predictAimTrajectory()` is shared by the dotted preview and `predictAimFocusPoint()`, preventing visual disagreement;
- the right loader remains beside the next-bubble preview without covering the launcher or playfield;
- release query `20260831.5` protects both atlases from stale mobile caches; the Bubble Burst runtime is independently versioned in the page.
- a successful level clear first runs a dedicated 2-second Canvas celebration, then reveals the existing score/time/bonus summary: the arcade title zooms and rotates into place while both cached joy sprites perform seven-keyframe manga jumps;
- each jump is interpolated on every `requestAnimationFrame` with squash/stretch and alternating airborne poses; the operator receives star eyes and the loader heart eyes as lightweight procedural overlays, without extra textures, DOM mutation or per-frame image allocation;
- resumed sessions already saved on the level-clear screen open the summary directly and do not replay or block on the celebration.
- a restored level-clear intermission keeps the HUD pause control in its neutral state, so the shared pause menu cannot cover the summary or trap the player on its termination action.

## Shared lifecycle

Terminal death must:

1. commit final score/level/best;
2. emit `rwg:game-ended`;
3. explicitly request the shared `RWGGameOver` presentation;
4. preserve full score on the one-credit `rwg:continue-game` path.

Continue may prune dangerous bottom rows to make resumption playable, but must not reset score, level, elapsed level time, the start-of-level scoring baseline or accumulated same-level pressure acceleration.
