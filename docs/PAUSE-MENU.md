# Shared Pause Menu — AUTHORITATIVE CONTRACT

## Status

This file is the source of truth for pause, resume and deliberate run termination on RetroWebGames.

**Humans and AI coding agents MUST read this file before changing pause, session, abandon-run, leaderboard or orientation behavior.** Also read `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/SESSION-PERSISTENCE.md` and `docs/LEADERBOARDS.md`.

Pause is platform infrastructure. Every current and future game MUST use `rwg-pause-menu.js` + `rwg-pause-menu.css`. A game-local pause overlay, timer or termination path is a regression.

## Ownership boundary

The shared pause layer owns:

- pause overlay DOM/CSS;
- score/time summary shown while paused;
- active-play timing for interrupted-run eligibility;
- `RIPRENDI` presentation;
- `TERMINA PARTITA` UX;
- both destructive confirmation stages;
- centralized minimum-time and per-game score policy;
- eligible interrupted-run submission through the shared leaderboard;
- terminal session cleanup and coordination with reload/background lifecycle;
- coordination with Game Over, leaderboard registration and orientation pause.

The individual game owns only:

- its gameplay-specific paused/running state;
- the state transition behind `#pauseBtn`;
- authoritative logical state and `RWGResumeAdapter`;
- gameplay metrics consumed by shared infrastructure.

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

The shared menu appears only when:

- the game is paused;
- the adapter reports an unfinished run;
- Game Over is not open.

It contains:

- game identity;
- current score;
- accumulated active-play time;
- `RIPRENDI`;
- `TERMINA PARTITA`.

`RIPRENDI` delegates to the existing `#pauseBtn` transition. Shared code must not mutate private engine booleans.

## Active-play timer

Interrupted-run eligibility uses a common minimum of **45 seconds** of active play.

The timer:

- advances only while the run is in progress and not paused;
- stops while the document is hidden/backgrounded;
- is associated with the current leaderboard run id;
- is persisted approximately every 5 seconds so reload/resume does not reset it;
- may use a larger authoritative game duration (`elapsed`, `totalTime` or normalized equivalent);
- MUST NOT be duplicated in game runtimes.

## `TERMINA PARTITA`

Termination is destructive and requires two explicit confirmations:

1. `SÌ, TERMINA`, after explaining High Score eligibility;
2. `CONFERMA DEFINITIVA`, clearly stating that the unfinished run will be deleted.

Before final confirmation there must always be `ANNULLA`/`INDIETRO`. One-click destruction, native `window.confirm()` and direct storage deletion are forbidden.

## Interrupted-run High Score eligibility

A manually terminated run is submitted only when BOTH are true:

- active play time >= 45 seconds;
- score is strictly greater than the game-specific threshold.

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

These thresholds live in the centralized pause policy, never in game engines.

A future game must add and justify its own centralized interrupted-run threshold before it is complete.

## Leaderboard lifecycle

Eligible termination reuses the existing shared leaderboard pipeline through `rwg:leaderboard-result` with the current run identity and normalized terminal metadata including:

- `outcome: game-over`;
- `terminalReason: pause-terminate`;
- score;
- progression when available;
- active duration;
- bounded game-specific metrics.

The pause flow waits for matching `rwg:leaderboard-registered` before final cleanup. This preserves nickname entry, idempotency and offline queueing.

If score or time is below threshold, no leaderboard result is emitted; final confirmation still terminates the unfinished run.

Never call the leaderboard HTTP API directly from a game or pause implementation.

## Terminal suppression — CRITICAL

A confirmed `TERMINA PARTITA` must never reappear as **“Vuoi continuare la partita precedente?”**.

The historical failure mode was:

1. pause termination cleared the snapshot;
2. the page started reloading;
3. `beforeunload`/`pagehide` observed the engine still reporting `isInProgress() === true`;
4. the lifecycle checkpoint wrote the just-deleted snapshot again;
5. the next page load offered the terminated run for resume.

`RWGSession` therefore owns a **terminal suppression** state. When `rwg:game-ended`, `rwg:session-completed` or explicit `RWGSession.terminate()` marks a run terminal:

- pending dirty saves are cancelled;
- the resumable snapshot is deleted;
- heartbeat writes stop;
- `hidden`, `pagehide`, `beforeunload`, `freeze` and navigation checkpoints MUST NOT write that run again;
- suppression remains active through reload/unload;
- saving is enabled again only when a genuine new run begins (`rwg:game-session-start`, adapter registration for a fresh page, or explicit shared begin-run lifecycle).

Do not fix this bug in Star Swarm or any other game. The protection belongs in `rwg-session.js` and applies platform-wide.

## Interaction with RWGSession

A normal pause remains resumable and must not clear `rwg.session.v2:<game-id>`.

Only final confirmed termination, real Game Over, successful completion or another documented terminal lifecycle clears unfinished-run persistence.

Pause may request a checkpoint through `RWGSession`, but may not create another gameplay snapshot namespace.

## Interaction with Game Over

Ordinary pause is non-terminal and must not open shared Game Over. Real terminal Game Over suppresses the pause surface.

A pause-menu termination is a deliberate abandon-run lifecycle. Its optional leaderboard registration completes first, then the session becomes terminal and cannot be autosaved again.

## Interaction with orientation

Orientation may pause the game through the same `#pauseBtn` contract and resume with the shared countdown. It must not create another pause UI or mark the run terminal.

## AI-agent decision rules

For any pause-related request:

1. if behavior is useful across games, change `rwg-pause-menu.js/.css` or the relevant shared service;
2. keep only the game's private pause-state transition in the game runtime;
3. change abandonment thresholds centrally;
4. use authoritative adapter metrics rather than local UI forks;
5. preserve `RWGSession` instead of adding storage;
6. preserve shared leaderboard and Game Over flows;
7. if a local pause workaround seems easier, stop and fix the shared layer.

Any intentional exception requires updates to `AGENTS.md`, architecture docs and validators in the same change.

## Required validation

Run at minimum:

```bash
node scripts/validate-shared-pause.mjs
node scripts/validate-session.mjs
node scripts/validate-leaderboards.mjs
node scripts/validate-contracts.mjs
```

Also run the affected game's validator.

Browser smoke tests must cover:

- pause/resume;
- cancellation at both confirm stages;
- <45 s interruption;
- >=45 s but below score threshold;
- eligible termination with saved nickname;
- first-ever eligible termination requiring nickname;
- offline queueing;
- reload/resume preserving active time;
- confirmed termination followed by reload with **no resume prompt**;
- background/unload immediately after termination with no snapshot recreation;
- Solitario using only the shared pause UI;
- Game Over suppression;
- pause Top 3 compatibility.

## Forbidden regressions

```js
// game-local pause overlay
const pauseOverlay = document.createElement('div');

// game-local interrupted score threshold
const MIN_ABORT_SCORE = 500;

// one-step destructive termination
endButton.onclick = () => localStorage.removeItem(sessionKey);

// direct leaderboard API
fetch('/api/leaderboards/v1/runs', { method: 'POST' });
```

Use the shared contracts instead.
