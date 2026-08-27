# RetroWebGames architecture

## Goal

RetroWebGames is a static, mobile-first arcade platform. Individual games own gameplay simulation and rendering; platform-level identity, credits, game-over, sharing and orientation are shared.

## Dependency flow

```text
Game page
  ├─ game-specific engine
  ├─ game-hud.js
  │    ├─ rwg-profile.js
  │    │    └─ rwg-profile.css
  │    ├─ rwg-avatar.js
  │    │    └─ rwg-avatar.css
  │    ├─ game-over.css
  │    └─ game-over.js
  └─ orientation.js
       └─ orientation.css
```

A game engine must never copy these shared systems locally.

## Game lifecycle contract

### Start

The page exposes a game-specific `#startBtn`. The shared Game Over component observes start/replay and begins a session when the label is `GIOCA` or `RIGIOCA`.

### Running

The game owns simulation state. Shared components may read stable DOM metrics such as score, level, best, lines, player/cpu score.

### Pause/orientation

Local pause overlays are allowed. Orientation guard may pause/resume around landscape mode. These are not terminal run states.

### Intermediate clear screens

Allowed examples:

- Star Swarm boss clear;
- future stage/mission clear;
- tutorial/intermission screens.

These must pause the engine without triggering terminal Game Over.

### Terminal Game Over

Authoritative presentation lives in root `game-over.js` / `game-over.css`.

Game engine responsibilities:

1. commit final score/level/best values to DOM;
2. stop simulation;
3. make local replay state available (`RIGIOCA`) as fallback;
4. emit `rwg:game-ended`;
5. request `window.RWGGameOver.open()`.

Shared responsibilities:

- animated GAME OVER intro;
- metrics;
- achievements;
- sharing;
- continue via credit provider;
- replay;
- main menu.

### Continue

`game-over.js` asks `RWGContinueProvider` for a one-credit continue. On success it dispatches `rwg:continue-game` with the preserved score and metadata.

The engine must restore the interrupted run, not reset it.

### Replay

Shared Game Over dispatches `rwg:game-replay`, then uses the game start button. The normal new-game path must completely reset runtime state.

## Profile / wallet

Current profile state is stored locally under `rwg.profile.v1` and contains a pseudonymous browser ID, credits, totals, per-game statistics and history.

This is a prototype persistence layer, not payment security. Future paid credits require server authority and an append-only/idempotent ledger.

The per-game record contains `attempts`, `gameOvers`, `continues`, `playTimeMs`, `bestScore`, `lastScore`, `maxLevel`, `maxLines`, `maxCombo`, `maxRally`, `recordValue` and unlocked `achievements`. Continue debits exactly one local prototype credit and dispatches the preserved score to the engine.

## Avatar

`rwg-avatar.js` renders a lightweight CSS/DOM 3D avatar and stores its configuration in the profile. `/avatar/` is the editor. Games should consume avatar identity through shared components instead of storing copies.

## Shared game-over invariants

The centralized terminal modal is a platform feature. It must retain:

- GAME OVER intro animation;
- compact mobile layout;
- statistics;
- achievement strip with auto-scroll on overflow;
- SVG-only share buttons;
- one-credit continue;
- new game;
- choose another game.

## Static validation

Run:

```bash
node scripts/validate-contracts.mjs
```

The validator intentionally checks architecture contracts rather than gameplay correctness. Device/browser playtests remain necessary for touch, timing, layout and sensor behavior.

## Browser and production validation

The supported smoke matrix includes `/`, `/avatar/` and all seven game routes at 390×844, 375×667, 320×568 and desktop width. Tests must collect JavaScript console errors, page errors and failed/4xx/5xx requests, and exercise the shared Game Over, one-credit Continue and insufficient-credit path.

Neon Tilt production responses must send `accelerometer=(self)` and `gyroscope=(self)` in `Permissions-Policy`. HTTPS alone does not make device orientation usable when the response header disables the sensors. Real accelerometer behavior still requires a physical-device test.
