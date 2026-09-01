# Bubble Burst — design, progression and performance contract

This document is the gameplay source of truth for Bubble Burst.

## Runtime files

- `games/bubble-burst/index.html`
- `games/bubble-burst/levels.js` — deterministic 200-layout catalogue
- `games/bubble-burst/game.js` — authoritative gameplay/runtime
- `games/bubble-burst/style.css`

`levels.js` must load before `game.js`; shared `game-hud.js` and `orientation.js` remain authoritative for platform lifecycle/UI.

## Level catalogue

The base catalogue contains exactly 200 deterministic artistic configurations:

- 20 visual motif families;
- 10 deterministic variants per motif;
- 200 distinct layout signatures;
- top-connected height-profile construction so decorative silhouettes do not begin as unsupported floating islands;
- increasing row count, palette breadth and special-bubble density through the catalogue;
- after level 200 the geometric catalogue may cycle while difficulty continues to scale.

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

- level 1 first drop: **65 seconds**, therefore never below one minute;
- interval decreases exponentially by level with a floor of **16 seconds**;
- approximate intervals: level 10 ≈ 55 s, level 25 ≈ 42 s, level 50 ≈ 27 s, level 80+ ≈ 16 s;
- each drop starts at **0.5 row** at level 1 and gradually grows toward **0.9 row** by high levels;
- repeated drops continue within the same level until the board is cleared or reaches the danger line;
- the timer advances only while gameplay is actually running; pause/visibility/orientation pauses do not consume pressure time;
- if a pressure drop becomes due while a projectile is in flight, it waits until the projectile resolves so collision geometry does not jump mid-shot;
- the last 6 seconds before a drop show an arcade warning; the ceiling line itself is drawn so its downward movement is visually readable;
- a new level resets ceiling offset and pressure timer using that level's harder interval;
- a one-credit Continue preserves the descended board position but resets the pressure countdown, while the existing safety pruning may remove dangerous bottom rows.

This pressure system is separate from the miss-penalty row. Both mechanics may contribute to the board approaching the danger line.

## Difficulty

Difficulty increases through:

- larger/more complex silhouettes;
- palette growth from four toward six colors;
- progressively more special bubbles;
- miss limit tightening from 5 to 4 and eventually 3;
- modest baseline shot-speed increase by level, with launched speed globally multiplied by three;
- timed ceiling pressure becoming faster and slightly deeper per drop;
- continued scaling after the first 200 levels.

## Rendering and performance

The engine intentionally remains JavaScript + Canvas 2D.

Performance invariants:

- moving-shot collision uses nearby hex-cell lookup rather than scanning every bubble in the grid;
- high-speed projectiles are sub-stepped by travelled distance so the 3× launch speed cannot tunnel through bubbles or walls;
- the renderer reuses those sub-step positions for a short additive path and cached-sprite afterimages, improving perceived motion continuity without reducing speed or forcing a lower frame rate;
- aim tracing uses the same local collision lookup;
- pressure descent is represented as a fractional row-space ceiling offset instead of rewriting every bubble coordinate, so resize remains stable and the pressure update is O(1);
- bubble visuals are cached as 96×96 offscreen sprites by color/type/armor state instead of rebuilding radial gradients for every bubble every frame; the cover-matched treatment combines saturated spherical shading, top-left specular light, lower bounce light, a glass rim and a restrained outer glow, while the frame loop still performs only one `drawImage` per ordinary bubble;
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

Continue may prune dangerous bottom rows to make resumption playable, but must not reset score, level, elapsed level time or the start-of-level scoring baseline.
