# RetroWebGames architecture

## Goal

RetroWebGames is a static, mobile-first arcade platform. Individual games own gameplay simulation and rendering; platform-level identity, credits, resumable sessions, game-over, sharing and orientation are shared.

## Dependency flow

```text
Game page
  ├─ game-specific engine
  ├─ rwg-session.js / rwg-session.css (when explicitly preloaded by a resumable game)
  ├─ game-hud.js
  │    ├─ rwg-session.js / rwg-session.css (shared fallback/bootstrap)
  │    ├─ rwg-profile.js
  │    │    └─ rwg-profile.css
  │    ├─ rwg-avatar.js
  │    │    └─ rwg-avatar.css
  │    ├─ game-over.css
  │    └─ game-over.js
  └─ orientation.js
       └─ orientation.css
```

A game engine must never copy these shared systems locally. A resumable game owns only its small state adapter (`serialize`, `validate`, `restore`, `isInProgress`); storage cadence, lifecycle flush and resume UI belong to `rwg-session.js`.

## Game lifecycle contract

### Start

The page exposes a game-specific `#startBtn`. The shared Game Over component observes start/replay and begins a session when the label is `GIOCA` or `RIGIOCA`.

A resumable game may additionally register `window.RWGResumeAdapter`. If a compatible unfinished snapshot already exists, the shared resume service blocks normal startup with the prompt **“Vuoi continuare la partita precedente?”**. `No` discards that snapshot and starts a fresh game; `Sì` restores it.

### Running

The game owns simulation state. Shared components may read stable DOM metrics such as score, level, best, lines, player/cpu score.

Games that opt into resumable persistence call `RWGSession.markDirty()` only after meaningful discrete state changes. `rwg-session.js` throttles those writes and also performs a low-frequency heartbeat so timer/progress state is not lost even when no discrete move occurs.

### Resumable interruption / exit

Resumable-session persistence is distinct from credit Continue.

Shared `rwg-session.js` responsibilities:

- versioned per-game local envelope under `rwg.session.v1:<game-id>`;
- debounced save after discrete state changes;
- lightweight periodic checkpoint;
- forced synchronous checkpoint on `visibilitychange` hidden, `pagehide`, `beforeunload`, Page Lifecycle `freeze`, and same-tab navigation;
- corruption/incompatibility rejection before restore;
- shared resume modal with `No` red on the left and `Sì` green on the right;
- no storage writes per animation frame;
- no dependency on profile, avatar, Game Over or credits.

Game adapter responsibilities:

- report whether a run is genuinely in progress;
- serialize only the minimum authoritative state needed to resume;
- validate restored state strongly enough to reject impossible/corrupt snapshots;
- restore the exact run without counting it as a new game/deal;
- clear the resumable snapshot when the run is successfully completed or otherwise becomes terminal;
- start a clean run when the user declines resume.

Resume after browser close/menu exit is **free**. It must never debit a credit and must never dispatch `rwg:continue-game`.

### Pause/orientation

Local pause overlays are allowed. Orientation guard may pause/resume around landscape mode. These are not terminal run states. A paused resumable game is still considered an unfinished run and remains eligible for autosave/resume.

### Intermediate clear screens

Allowed examples:

- Star Swarm boss clear;
- Bubble Burst level clear;
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

### Credit Continue

`game-over.js` asks `RWGContinueProvider` for a one-credit continue. On success it dispatches `rwg:continue-game` with the preserved score and metadata.

The engine must restore the interrupted run, not reset it. This mechanism is unrelated to `RWGSession` browser/menu resume.

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

The validator intentionally checks architecture contracts rather than gameplay correctness. Device/browser playtests remain necessary for touch, timing, layout, lifecycle persistence and sensor behavior.

## Browser and production validation

The supported smoke matrix includes `/`, `/avatar/` and all eight game routes at 390×844, 375×667, 320×568 and desktop width. Tests must collect JavaScript console errors, page errors and failed/4xx/5xx requests, and exercise the shared Game Over, one-credit Continue and insufficient-credit path where applicable.

For resumable games, smoke tests must also cover: start → make progress → return to menu/reload → resume prompt → `Sì` exact-state restore; and repeat with `No` to verify a clean new run.

Neon Tilt production responses must send `accelerometer=(self)` and `gyroscope=(self)` in `Permissions-Policy`. HTTPS alone does not make device orientation usable when the response header disables the sensors. Real accelerometer behavior still requires a physical-device test.
