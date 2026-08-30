# Shared Pause Menu — AUTHORITATIVE CONTRACT

## Status and scope

This document is the source of truth for pause behavior on RetroWebGames.

**MANDATORY FOR HUMANS AND AI CODING AGENTS:** before adding a game or changing pause, resume, abandon-run, session, leaderboard or orientation behavior, read this document together with `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/SESSION-PERSISTENCE.md` and `docs/LEADERBOARDS.md`.

Pause is platform infrastructure, not a game-local feature. Every current and future game MUST use the shared `rwg-pause-menu.js` + `rwg-pause-menu.css` implementation. An agent MUST extend the shared component when new generally useful pause behavior is requested; it MUST NOT solve the request by adding a parallel overlay inside one game.

The visual reference is the former Solitario pause treatment: centered arcade panel, clear `GIOCO IN PAUSA` title, high-contrast resume action, compact current-run information and no game-specific clutter.

## Ownership boundary

The division of responsibility is strict.

### Shared pause layer owns

- pause overlay DOM and styling;
- visibility of the shared pause surface;
- current-run score/time presentation;
- active-play timing used for interrupted-run eligibility;
- `RIPRENDI` action presentation;
- `TERMINA PARTITA` UX;
- both termination confirmation stages;
- centralized minimum-time and per-game score policy;
- eligible interrupted-run submission through the existing leaderboard contract;
- clearing the resumable snapshot after a confirmed termination;
- coordination with Game Over, leaderboard registration and orientation pause.

### Individual game runtime owns only

- its gameplay-specific `paused`/running state;
- the actual pause/resume state transition behind the existing `#pauseBtn`;
- authoritative game state and `RWGResumeAdapter`;
- score/progression values that the shared layer can read/normalize.

A game MUST NOT own a second pause modal, a second termination flow, separate pause CSS, separate active-time eligibility logic or its own leaderboard submission path for pause termination.

`games/solitaire/pause-overlay.js` is only a legacy compatibility no-op shim. It is NOT an implementation example to copy.

## Required game integration

Every current/future game page already participates through the normal platform bootstrap. Agents adding a game MUST preserve these requirements:

1. `<body data-rwg-game="true" data-rwg-game-name="Short Game Name">`;
2. a game-specific `#pauseBtn` whose paused state is externally observable as `▶` and/or aria-label `Riprendi`;
3. a complete `window.RWGResumeAdapter` registered before `game-hud.js`;
4. `game-hud.js` loaded normally;
5. `orientation.js` loaded after the HUD;
6. no direct page-local inclusion or clone of `rwg-pause-menu.js` / `.css` unless the central bootstrap contract is intentionally redesigned repository-wide.

The shared pause assets are bootstrapped centrally and must work on desktop and mobile. Do not make pause depend on the handheld-only orientation branch.

## Visibility contract

The shared menu appears only when all relevant conditions agree that a real unfinished run is paused:

- `#pauseBtn` exposes paused state (`▶` or aria-label `Riprendi`);
- the registered `RWGResumeAdapter.isInProgress()` reports an unfinished run;
- shared Game Over is not open.

The standard surface contains:

1. short game identity;
2. current score;
3. accumulated active-play time;
4. `RIPRENDI`;
5. `TERMINA PARTITA`.

Game-specific information may be exposed to the shared layer through normalized adapter/state metrics when genuinely useful. Do not fork the pause UI merely to display one extra metric.

## Resume behavior

`RIPRENDI` must delegate to the game's normal pause transition, normally through `#pauseBtn`. The shared layer must not independently mutate private engine booleans.

A pause caused by the orientation guard is still a normal unfinished run. Orientation logic may invoke the same pause transition and later resume through the existing countdown, but must not create a competing pause implementation.

Free reload/session restore (`RWGSession`) and one-credit Game Over Continue are separate lifecycle concepts and must remain separate from pause/resume.

## Active-play timer

Interrupted-run eligibility uses a shared minimum of **45 seconds of active play**.

The timer:

- advances only while the adapter reports an in-progress run;
- does not advance while paused;
- does not advance while the document is hidden/backgrounded;
- is associated with the current leaderboard run id;
- is persisted locally approximately every 5 seconds so reload/resume does not reset eligibility;
- may use a larger authoritative duration already present in game state (`elapsed`, `totalTime` or an explicitly normalized equivalent);
- must never be implemented separately in individual games.

45 seconds is a platform policy intended to reject accidental starts and trivial farming while retaining legitimate short arcade runs. Change this value only in the centralized pause policy and update this document plus validators in the same change.

## `TERMINA PARTITA` — destructive action contract

Termination is deliberately harder to trigger than resume. One click must never destroy an unfinished run.

After `TERMINA PARTITA`, the user must pass **two explicit confirmations**:

1. first confirmation: `SÌ, TERMINA`, after the UI explains whether the current result is eligible for High Scores;
2. second confirmation: `CONFERMA DEFINITIVA`, clearly stating that the saved unfinished run will be deleted.

Before the final action there must always be an `ANNULLA`/`INDIETRO` path. Escape/back navigation supported by the component must also leave the run intact until final confirmation.

Agents MUST NOT weaken this to a single confirm, native `window.confirm()`, immediate reload, direct `localStorage` deletion or a game-local dialog.

## Interrupted-run leaderboard eligibility

A manually terminated run is submitted only when **both** conditions are true:

- active play time is at least 45 seconds;
- score is strictly greater than the centralized game-specific minimum.

Current thresholds:

| Game | Score must be > |
| --- | ---: |
| Block Drop | 100 |
| Bubble Burst | 100 |
| Maze Munch | 100 |
| Neon Rally | 0 (therefore at least 1 point) |
| Neon Snake | 100 |
| Neon Tilt | 150 |
| Prism Breaker | 250 |
| Solitario | 10 |
| Star Swarm | 500 |

These thresholds are platform balancing policy. They MUST NOT be copied into game engines.

### Adding a future game

An agent adding a new game MUST explicitly add and justify its interrupted-run score threshold in the centralized pause policy before the feature is considered complete. Choose a threshold that demonstrates meaningful play for that game's score scale; do not silently inherit an arbitrary threshold from another game.

The new game must still satisfy the common 45-second active-time floor unless the platform policy is intentionally redesigned for all games.

## Submission lifecycle

Eligible interruption reuses the existing shared leaderboard pipeline. It is not a second leaderboard implementation.

The pause layer emits `rwg:leaderboard-result` using the current run identity and normalized terminal metadata including:

- existing run id;
- `outcome: game-over`;
- `terminalReason: pause-terminate`;
- score;
- progression/level when available;
- active duration;
- bounded game-specific metrics when available.

The shared pause flow waits for the matching `rwg:leaderboard-registered` completion before final cleanup/return. This preserves the normal nickname, idempotency and offline queue behavior.

If either eligibility threshold is not met, **no leaderboard result is emitted**. Final confirmation still abandons the unfinished run, clears its resumable state through the shared lifecycle and returns to the normal intro/fresh state.

Do not call the leaderboard API directly from a game or from a new pause implementation.

## Interaction with `RWGSession`

A merely paused game remains in progress and must remain resumable. Pausing MUST NOT dispatch terminal completion or clear `rwg.session.v2:<game-id>`.

Only final confirmed `TERMINA PARTITA`, true terminal Game Over, successful completion or another documented terminal lifecycle may clear unfinished-run persistence.

The pause component may request an immediate session checkpoint when entering pause. It must use `RWGSession` rather than creating another storage namespace for gameplay snapshots.

The active-time bookkeeping owned by the shared pause service is not a replacement for the game's authoritative resumable snapshot.

## Interaction with shared Game Over

Pause is non-terminal. Shared Game Over must suppress/replace pause presentation when the run truly ends.

Do not route ordinary pause through `RWGGameOver.open()`. Conversely, do not use the pause menu as a substitute for terminal Game Over.

A user-confirmed pause termination is a deliberate abandon-run lifecycle whose optional leaderboard registration is handled by the pause service before cleanup.

## Interaction with leaderboard Top 3

The leaderboard client already owns the compact Top 3 shown during resume/pause. Agents must preserve compatibility between that surface and the shared pause overlay. Do not add a game-local ranking panel to the pause menu.

If pause markup/visibility semantics change, verify `rwg-leaderboard.js` pause-board detection in the same change.

## AI-agent decision rules

When an AI coding agent receives a pause-related request, use this decision order:

1. **Is the requested behavior useful across games?** Implement it in `rwg-pause-menu.js` / `.css` and update shared docs/tests.
2. **Is it only a gameplay state transition?** Keep that tiny transition in the game runtime and let the shared pause UI call it.
3. **Does it change abandonment/high-score eligibility?** Change the centralized policy, never individual game constants.
4. **Does it require a new metric?** Prefer exposing/normalizing authoritative state to the shared component rather than forking UI.
5. **Does it touch persistence?** Preserve `RWGSession`; do not introduce a second gameplay snapshot system.
6. **Does it touch terminal results?** Preserve the existing leaderboard and Game Over contracts; do not create direct API submission.
7. **Is a local overlay being considered because it is quicker?** Stop: that violates the architecture unless the surface is a genuinely game-specific non-pause intermission such as tutorial/level-clear.

Any intentional exception requires an explicit architecture decision documented in `AGENTS.md`, `docs/ARCHITECTURE.md` and this file, plus validator changes. A silent exception is a regression.

## Files agents should inspect before modifying pause

At minimum:

- `AGENTS.md`;
- `docs/PAUSE-MENU.md`;
- `docs/ARCHITECTURE.md`;
- `docs/SESSION-PERSISTENCE.md`;
- `docs/LEADERBOARDS.md`;
- `rwg-pause-menu.js`;
- `rwg-pause-menu.css`;
- `game-hud.js`;
- `orientation.js`;
- `rwg-leaderboard.js`;
- the target game's `RWGResumeAdapter` and pause handler;
- `scripts/validate-shared-pause.mjs`.

## Required validation after pause-related work

Run at minimum:

```bash
node scripts/validate-shared-pause.mjs
node scripts/validate-session.mjs
node scripts/validate-leaderboards.mjs
node scripts/validate-contracts.mjs
```

Also run the target game's specialized validator when one exists.

Browser smoke tests must cover:

- pause/resume in every affected game;
- no duplicate pause overlay;
- correct shared score/time display;
- timer stopping during pause/background;
- orientation-triggered pause/resume;
- cancellation at both termination confirmation stages;
- an interruption before 45 seconds;
- a run above 45 seconds but below score threshold;
- an eligible interruption with saved nickname;
- an eligible first-ever result requiring nickname entry;
- offline leaderboard queueing;
- reload/resume preserving accumulated active time;
- confirmed termination removing the resumable run;
- Solitario using only the shared implementation;
- Game Over suppressing pause correctly;
- compact pause Top 3 remaining functional.

## Definition of done for a new game

A new game is not pause-complete until:

- it has a working `#pauseBtn` with the shared observable state;
- its `RWGResumeAdapter.isInProgress()` remains true while legitimately paused;
- the shared pause menu opens/resumes it without local overlay code;
- a centralized interrupted-run score threshold has been added;
- 45-second active-time eligibility works across reload/resume;
- double-confirm termination works;
- eligible termination reaches the normal leaderboard pipeline;
- ineligible termination does not submit;
- session cleanup is correct;
- shared validators and browser smoke tests pass.

## Regression examples — forbidden

Do not reintroduce any of these patterns:

```js
// FORBIDDEN: game-local pause overlay
const pauseOverlay = document.createElement('div');

// FORBIDDEN: game-local interrupted-run threshold
const MIN_ABORT_SCORE = 500;

// FORBIDDEN: destructive one-step termination
endButton.onclick = () => localStorage.removeItem(sessionKey);

// FORBIDDEN: direct leaderboard API from game pause
fetch('/api/leaderboards/v1/runs', { method: 'POST' });
```

Use the shared contracts instead.
