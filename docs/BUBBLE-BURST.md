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

## Difficulty

Difficulty increases through:

- larger/more complex silhouettes;
- palette growth from four toward six colors;
- progressively more special bubbles;
- miss limit tightening from 5 to 4 and eventually 3;
- modest shot-speed increase;
- continued scaling after the first 200 levels.

## Rendering and performance

The engine intentionally remains JavaScript + Canvas 2D.

Performance invariants:

- moving-shot collision uses nearby hex-cell lookup rather than scanning every bubble in the grid;
- aim tracing uses the same local collision lookup;
- bubble visuals are cached to offscreen canvases by color/type/armor state instead of rebuilding radial gradients for every bubble every frame;
- background artwork is cached and rebuilt only on resize;
- chibi launcher characters are cached pixel sprites;
- graph traversal uses index-based queues rather than repeated `Array.shift()`;
- particle/falling visual counts are bounded;
- no external rendering dependency is required.

WASM is not justified for the current board sizes. Reconsider only after measured profiling demonstrates a numeric hot loop above the project thresholds documented in `docs/WASM-EVALUATION.md`.

## Chibi launcher crew

Bubble Burst includes two original pixel-art chibi operators rendered from cached Canvas sprites:

- the left operator manages/fires the launcher and reacts to a shot;
- the right operator acts as ammo handler and visibly holds the next bubble;
- sprites are original project graphics and do not depend on external game assets.

## Shared lifecycle

Terminal death must:

1. commit final score/level/best;
2. emit `rwg:game-ended`;
3. explicitly request the shared `RWGGameOver` presentation;
4. preserve full score on the one-credit `rwg:continue-game` path.

Continue may prune dangerous bottom rows to make resumption playable, but must not reset score or level.
