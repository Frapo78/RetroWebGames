# RetroWebGames architecture

## Goal
RetroWebGames is a static, mobile-first arcade platform. Games own simulation, rendering and private gameplay state. Identity, credits, common controls, pause/termination, resumable sessions, Game Over, sharing, leaderboards and orientation are platform infrastructure and MUST stay shared.

Resumable unfinished-run persistence is mandatory for every current and future game.

## Dependency flow
```text
Game page
  ├─ game runtime/modules
  ├─ game RWGResumeAdapter
  ├─ game-hud.js
  │    ├─ rwg-session.js / css
  │    ├─ rwg-profile.js / css
  │    ├─ rwg-avatar.js / css
  │    ├─ rwg-intro-share.js / css
  │    ├─ rwg-leaderboard.js / css
  │    └─ game-over.js / css
  └─ orientation.js / css
       ├─ rwg-controls.css
       ├─ rwg-virtual-joystick.js / css
       └─ rwg-pause-menu.js / css
```
A game must never copy a shared system locally. `game-hud.js` is the centralized bootstrap for session/profile/Game Over services; `orientation.js` bootstraps the shared in-game control, joystick and pause layers for every game, including non-handheld execution before its handheld-only early return.

## Game lifecycle
Every game page exposes `#startBtn`, `#pauseBtn`, `<body data-rwg-game="true" data-rwg-game-name="…">` and a complete `window.RWGResumeAdapter` before `game-hud.js`.

A genuine new run emits `rwg:game-session-start`. A credit Continue emits `rwg:continue-game`. Terminal Game Over emits `rwg:game-ended`. Successful completion may emit `rwg:session-completed`. These events are platform contracts, not presentation details.

Rejecting a valid saved run is also terminal. `RWGSession` clears/suppresses the snapshot, delegates the immutable payload to shared pause eligibility, and leaves the same-game intro idle. Eligible interrupted results use the shared leaderboard event; rejection must never call the game adapter's `startFresh()`.

## RWGSession v2
`rwg-session.js` exclusively owns unfinished-run persistence. Namespace is `rwg.session.v2:<game-id>`, envelope schema 2, dirty debounce 750 ms, heartbeat 5 seconds, snapshot limit 384 KiB. It checkpoints on hidden, pagehide, beforeunload, freeze and same-tab navigation and validates adapter version, compatibility and semantic payload before restore.

Every adapter exposes `id`, `version`, `compatibility`, `isInProgress`, `serialize`, `validate`, `restore`, `startFresh` and optionally `describe`. Persist authoritative logical state, not particles, Canvas caches, DOM nodes, AudioContext or pointer objects.

Terminal suppression is mandatory. Once a run is terminal, dirty saves, heartbeat and lifecycle checkpoints must not recreate its deleted snapshot. Saving is re-enabled only by a genuine new/revived run. Deliberate termination must call `RWGSession.terminate()` synchronously with the irreversible user confirmation, before any asynchronous leaderboard/network work.

See `SESSION-PERSISTENCE.md`.

## Shared pause — mandatory
Game-local pause overlays are **forbidden**. Every current and future game uses `rwg-pause-menu.js` + `rwg-pause-menu.css`; only the private paused/running state transition behind `#pauseBtn` remains game-owned.

Ordinary pause is non-terminal and resumable. The shared pause surface owns active-play timing, score/time summary, resume, the two-stage `TERMINA PARTITA` confirmation, centralized interrupted-run thresholds, leaderboard coordination and terminal cleanup.

During an ordinary pause the common Home/Share/Audio/Pause/Credits/Avatar controls remain reachable. The pause surface is therefore intentionally non-modal in accessibility semantics. Destructive confirmation finalization is different: after `CONFERMA DEFINITIVA`, the run is immediately terminal and the common dock is blocked while registration/reload completes.

See `PAUSE-MENU.md`.

## Shared HUD and controls
Metrics such as score, level, lives, lines and best remain game-specific HUD data. Global actions are shared platform controls. Their visual rail and behavior come from `rwg-controls.css`/`game-hud.js`; game-specific actions such as rotate, turbo, hint, calibrate or new deal stay outside it.

Shared control CSS is loaded dynamically by `orientation.js`. Because it can change the final playfield geometry after a game engine's first layout pass, the bootstrap emits one synthetic `resize` after `rwg-controls.css` finishes loading. Canvas engines must continue to implement an idempotent resize handler; `ResizeObserver` is preferred when a game has additional runtime container changes.

Pointer-native games are not forced onto the virtual joystick. Directional legacy games use the centralized adapter; Neon Tilt consumes the full analog vector. See `SHARED-HUD-CONTROLS.md`.

## Modal states
Intro/start, saved-session resume, terminal Game Over, successful completion and destructive confirmations may hide/block the common dock. Ordinary pause must not. A surface declaring `aria-modal="true"` must not intentionally leave unrelated controls outside it interactive.

## Terminal Game Over and Continue
Authoritative terminal presentation is root `game-over.js` / `game-over.css`. Engines commit final metrics, stop simulation, emit `rwg:game-ended` and request `RWGGameOver.open()`. Shared Game Over owns presentation, metrics, achievements, sharing, one-credit Continue, replay and main-menu actions.

Credit Continue is distinct from free unfinished-session restore. It revives the terminal run through `rwg:continue-game`, preserving score/metadata and re-enabling session persistence.

## Profile, credits and avatar
`rwg-profile.js` owns local prototype profile/credit state. `rwg-avatar.js` owns shared player identity; `/avatar/` is the only editor. Games must not maintain local copies. Paid credits require server authority and an idempotent ledger.

## Leaderboards
`rwg-leaderboard.js` is the only browser leaderboard client. Games and pause code communicate through shared lifecycle events; they never call leaderboard HTTP endpoints directly. A run id spans unfinished-session restore and credit Continue, while a true new game receives a new id. Offline submission remains idempotently queued.

## Orientation
Orientation guard may pause through the same `#pauseBtn` contract and resume with the shared countdown. It must never create another pause UI or mark the run terminal.

## Future-game enforcement
`scripts/validate-session.mjs` discovers `games/*/index.html` with `data-rwg-game="true"` and requires a conforming adapter before `game-hud.js`. It also invokes the shared pause/control validators, so the repository-wide `validate-contracts.mjs` path covers these platform contracts transitively.

## Required validation
Run before merging/pushing platform changes:
```bash
node scripts/validate-contracts.mjs
node scripts/validate-session.mjs
node scripts/validate-shared-pause.mjs
node scripts/validate-shared-controls.mjs
node scripts/validate-leaderboards.mjs
```
Specialized game validators remain required for touched games. Static validators cover contracts, not full gameplay correctness.

Browser smoke tests must cover common phone sizes and desktop, pause/resume, Home from pause, Share from pause, dock tapability, both termination confirmations, eligible interrupted leaderboard registration, reload/resume, confirmed termination with no stale resume prompt, modal dock blocking and terminal Game Over. Canvas games whose playfield geometry is changed by shared controls must be checked after CSS load as well as after a real viewport resize.

## Related authoritative docs
Read `AGENTS.md`, `SESSION-PERSISTENCE.md`, `PAUSE-MENU.md`, `SHARED-HUD-CONTROLS.md`, `LEADERBOARDS.md`, `AVATAR.md`, `SEO-GEO.md` and `PWA-INSTALL.md` before changing their respective systems.
