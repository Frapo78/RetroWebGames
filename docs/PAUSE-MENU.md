# Shared Pause Menu

## Goal

Pause is a platform-level lifecycle surface. Every game uses the shared `rwg-pause-menu.js` + `rwg-pause-menu.css` implementation instead of creating a local pause overlay.

The visual reference is the former Solitario pause treatment: centered arcade panel, clear `GIOCO IN PAUSA` title, high-contrast resume action, compact current-run information and no game-specific clutter.

## Shared behavior

The menu appears only when:

- the game exposes `#pauseBtn` in the paused state (`▶` or aria-label `Riprendi`);
- the registered `RWGResumeAdapter` reports an in-progress run;
- shared Game Over is not open.

The standard menu contains:

1. game identity;
2. current score;
3. accumulated active-play time;
4. `RIPRENDI`;
5. `TERMINA PARTITA`.

Game-specific pause implementations must not duplicate this UI. `games/solitaire/pause-overlay.js` remains only as a legacy no-op shim while old static references exist.

## Active-play timer

Interrupted-run eligibility uses a shared minimum of **45 seconds of active play**.

The timer:

- advances only while the adapter reports an in-progress run;
- does not advance while paused or when the document is hidden;
- is keyed by the leaderboard run id;
- is persisted locally every ~5 seconds so reload/resume does not reset eligibility;
- may be supplemented by an authoritative game-state duration (`elapsed` or `totalTime`) when available.

45 seconds intentionally rejects accidental starts and immediate score farming without penalizing legitimate short arcade runs.

## Terminate protection

Termination is deliberately harder to trigger than resume.

The user must pass two explicit confirmation stages after choosing `TERMINA PARTITA`:

1. `SÌ, TERMINA` after seeing whether the current result qualifies for High Scores;
2. `CONFERMA DEFINITIVA`, which clearly states that the saved run will be deleted.

There is always an `ANNULLA`/`INDIETRO` path before the final action.

## Interrupted-run leaderboard eligibility

The run is submitted only when **both** conditions are met:

- active play time is at least 45 seconds;
- score is strictly greater than the game-specific minimum below.

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

These values are one centralized balancing policy, not game-engine constants. They can be tuned from observed play data without changing the individual games.

## Submission lifecycle

Eligible interruption uses the existing shared leaderboard event `rwg:leaderboard-result` with:

- the existing run id;
- `outcome: game-over`;
- `terminalReason: pause-terminate`;
- score, level and active duration;
- bounded game-state metrics when available.

The pause menu waits for the matching `rwg:leaderboard-registered` event before clearing the resumable session and returning to a fresh page. This preserves first-time nickname registration and the offline/idempotent queue contract.

If the interrupted run is below either threshold, no leaderboard result event is emitted. The unfinished snapshot is cleared and the page returns to the normal intro.

## Architecture

The shared pause assets are loaded before the handheld-only orientation early return, so desktop and mobile use the same pause implementation.

Pause owns presentation, active-time tracking, termination confirmation and interruption submission. Individual game runtimes continue to own only their pause boolean/state transition through their existing `#pauseBtn` handler.

## Validation

Run:

```bash
node scripts/validate-shared-pause.mjs
node scripts/validate-contracts.mjs
```

Browser smoke tests should cover at least:

- pause/resume in every game;
- two-step termination cancellation at both stages;
- an ineligible early interruption;
- an eligible interruption with an already saved nickname;
- an eligible first-ever result requiring nickname entry;
- offline queueing;
- reload/resume preserving accumulated active time;
- Solitario using only the shared pause UI.
