# Shared Pause Menu — AUTHORITATIVE CONTRACT

## Status

This file is the source of truth for pause, resume and deliberate run termination on RetroWebGames.

**Humans and AI coding agents MUST read this file before changing pause, session, abandon-run, leaderboard or orientation behavior.** Also read `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/SESSION-PERSISTENCE.md`, `docs/LEADERBOARDS.md` and `docs/SHARED-HUD-CONTROLS.md`.

Pause is platform infrastructure. Every current and future game MUST use `rwg-pause-menu.js` + `rwg-pause-menu.css`. A game-local pause overlay, timer or termination path is a regression.

## Ownership boundary

The shared pause layer owns pause overlay DOM/CSS, score/time summary, active-play timing, `RIPRENDI`, `TERMINA PARTITA`, both confirmations, centralized score/time policy, interrupted-run leaderboard submission, terminal session cleanup and coordination with Game Over/orientation.

The individual game owns only its private paused/running state, the state transition behind `#pauseBtn`, authoritative logical state/`RWGResumeAdapter` and gameplay metrics.

`games/solitaire/pause-overlay.js` is a legacy no-op shim, not an implementation example.

## Required integration

Every game must preserve:

1. `<body data-rwg-game="true" data-rwg-game-name="Short Game Name">`;
2. `#pauseBtn`, whose paused state is observable as `▶` and/or aria-label `Riprendi`;
3. a complete `window.RWGResumeAdapter` before `game-hud.js`;
4. shared bootstrap through `game-hud.js` and `orientation.js`;
5. no page-local clone of shared pause assets.

`RWGResumeAdapter.isInProgress()` MUST remain true during a legitimate pause, because pause is non-terminal until the user explicitly ends the run.

## Standard pause surface

The shared menu appears only when the game is paused, the adapter reports an unfinished run and Game Over is not open.

It contains game identity, current score, accumulated active-play time, `RIPRENDI` and `TERMINA PARTITA`.

`RIPRENDI` delegates to the existing `#pauseBtn` transition. Shared code must not mutate private engine booleans.

## Global dock while paused — MANDATORY

Ordinary pause MUST NOT trap the user inside the pause card.

The shared common dock defined in `docs/SHARED-HUD-CONTROLS.md` remains visible and interactive above the pause veil. This applies to every game.

While paused, the user must still be able to use:

- **Home/Games** — especially important: the user can intentionally leave the game without first resuming it;
- Share;
- Audio/Mute when present;
- Pause/Resume;
- Credits;
- Avatar/Profile.

Implementation requirements:

- `rwg-controls.css` MUST NOT hide the dock for `html.rwg-shared-pause-open`;
- `rwg-pause-menu.css` must reserve bottom space for the dock;
- during pause, dock controls must have a stacking level above `.rwg-pause-menu`, otherwise they may look present but remain untappable;
- the pause card must not overlap the dock on short/mobile viewports.

Movement controls and game-specific mechanic actions may remain unavailable while paused. They are not part of the global dock.

The dock may still be hidden for genuinely modal non-gameplay states such as initial intro/start screen, saved-session resume prompt, terminal Game Over and completed/win screens.

## Active-play timer

Interrupted-run eligibility uses a common minimum of **45 seconds** of active play. It advances only while the run is in progress and not paused, stops in background, persists by run id and MUST NOT be duplicated in game runtimes.

## `TERMINA PARTITA`

Termination is destructive and requires two explicit confirmations:

1. `SÌ, TERMINA`, after explaining High Score eligibility;
2. `CONFERMA DEFINITIVA`, clearly stating that the unfinished run will be deleted.

Before final confirmation there must always be `ANNULLA`/`INDIETRO`. One-click destruction, native `window.confirm()` and direct storage deletion are forbidden.

## Interrupted-run High Score eligibility

A manually terminated run is submitted only when BOTH are true: active play time >= 45 seconds and score is strictly greater than the game-specific threshold.

| Game | Score must be > |
| --- | ---: |
| Block Drop | 100 |
| Bubble Burst | 100 |
| Maze Munch | 100 |
| Neon Rally | 0 |
| Neon Snake | 100 |
| Neon Tilt | 150 |
| Prism Breaker | 250 |
| Solitario | 10 |
| Star Swarm | 500 |

These thresholds live in the centralized pause policy, never in game engines. A future game must add and justify its own threshold.

## Leaderboard lifecycle

Eligible termination reuses `rwg:leaderboard-result` with current run identity and normalized terminal metadata. The pause flow waits for matching `rwg:leaderboard-registered` before final cleanup, preserving nickname entry, idempotency and offline queueing.

If score or time is below threshold, no leaderboard result is emitted; final confirmation still terminates the unfinished run.

Never call the leaderboard HTTP API directly from a game or pause implementation.

## Terminal suppression — CRITICAL

A confirmed `TERMINA PARTITA` must never reappear as **“Vuoi continuare la partita precedente?”**.

The historical race was: termination clears the snapshot, reload starts, `beforeunload/pagehide` sees the engine still in progress and writes the deleted snapshot again. `RWGSession` therefore owns terminal suppression.

When `rwg:game-ended`, `rwg:session-completed` or explicit `RWGSession.terminate()` marks a run terminal:

- pending dirty saves are cancelled;
- the resumable snapshot is deleted;
- heartbeat writes stop;
- `hidden`, `pagehide`, `beforeunload`, `freeze` and navigation checkpoints MUST NOT write that run again;
- suppression remains active through unload;
- saving is enabled again only for a genuine new/revived run, including `rwg:game-session-start` or `rwg:continue-game`.

Do not fix this per game. The protection belongs in `rwg-session.js`.

## Interaction with RWGSession

A normal pause remains resumable and must not clear `rwg.session.v2:<game-id>`. Only final confirmed termination, real Game Over, successful completion or another documented terminal lifecycle clears unfinished-run persistence.

## Interaction with Game Over

Ordinary pause is non-terminal and must not open shared Game Over. Real terminal Game Over suppresses the pause surface.

A pause-menu termination is a deliberate abandon-run lifecycle. Its optional leaderboard registration completes first, then the session becomes terminal and cannot be autosaved again.

## Interaction with orientation

Orientation may pause through the same `#pauseBtn` contract and resume with the shared countdown. It must not create another pause UI or mark the run terminal.

## AI-agent decision rules

For any pause-related request:

1. if behavior is useful across games, change the shared pause/HUD/session layer;
2. keep only the private pause-state transition in the game runtime;
3. never hide Home/the shared dock during ordinary pause;
4. change abandonment thresholds centrally;
5. preserve `RWGSession`, shared leaderboard and Game Over contracts;
6. if a local workaround seems easier, stop and fix the shared layer.

## Required validation

```bash
node scripts/validate-shared-pause.mjs
node scripts/validate-shared-controls.mjs
node scripts/validate-session.mjs
node scripts/validate-leaderboards.mjs
node scripts/validate-contracts.mjs
```

Browser smoke tests must cover pause/resume, Home from pause, Share from pause, dock tapability on iOS Safari, both termination confirmations, threshold cases, eligible leaderboard registration, reload/resume active time, confirmed termination with no stale resume prompt, and Game Over suppression.

## Forbidden regressions

```js
const pauseOverlay = document.createElement('div'); // game-local pause
const MIN_ABORT_SCORE = 500;                       // game-local threshold
endButton.onclick = () => localStorage.removeItem(sessionKey); // one-step termination
fetch('/api/leaderboards/v1/runs', { method: 'POST' });        // direct leaderboard API
```

Use the shared contracts instead.
