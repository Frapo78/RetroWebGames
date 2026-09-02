# Shared Pause Menu — AUTHORITATIVE CONTRACT

## Status
This is the source of truth for pause, resume and deliberate run termination. Humans and AI coding agents must also read `AGENTS.md`, `ARCHITECTURE.md`, `SESSION-PERSISTENCE.md`, `LEADERBOARDS.md` and `SHARED-HUD-CONTROLS.md`.

Pause is platform infrastructure. Every current/future game MUST use `rwg-pause-menu.js` + `rwg-pause-menu.css`. A game-local pause overlay, timer, threshold or termination path is a regression. `games/solitaire/pause-overlay.js` is only a legacy no-op shim.

## Ownership
Shared pause owns its DOM/CSS, score/time summary, active-play timing, RIPRENDI, TERMINA PARTITA, both confirmations, interrupted-run eligibility, leaderboard coordination and terminal session cleanup. A game owns only its private paused/running transition behind `#pauseBtn`, authoritative logical state and gameplay metrics.

Every game preserves `<body data-rwg-game="true" data-rwg-game-name="…">`, `#pauseBtn`, a complete `RWGResumeAdapter` before `game-hud.js`, and shared bootstrap. `isInProgress()` remains true during legitimate pause.

## Ordinary pause
The local intro `#overlay` is reserved for intro and terminal states. Ordinary pause MUST NOT make it visible: that modal state hides the global dock and can make Resume unreachable on touch devices.

The shared surface appears only while paused, the adapter reports unfinished progress and Game Over is closed. It is intentionally a non-modal accessibility region because the global dock remains usable outside the pause card.

Home/Games, Share, Audio/Mute, Pause/Resume, Credits and Avatar remain visible and interactive above the pause veil. Movement and game-specific mechanic controls may remain unavailable. Intro, saved-session resume, terminal Game Over, completed/win screens and destructive finalization may hide/block the dock.

## Active-play timer
Interrupted-run eligibility requires at least **45 seconds** active play. The timer advances only while the run is in progress, foregrounded and not paused. It persists by run id, checkpoints on lifecycle visibility/pagehide boundaries and stops permanently for a terminal run.

## TERMINA PARTITA
Termination requires two explicit confirmations: `SÌ, TERMINA`, then `CONFERMA DEFINITIVA`. Before the final action there is always ANNULLA/INDIETRO. Native `confirm()`, one-click destruction and game-local storage deletion are forbidden.

Eligibility requires both active time >= 45 seconds and score strictly greater than the centralized threshold:

| Game | Score > |
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
| The Great Empire | 200 |

## Terminal suppression — CRITICAL
At the exact moment the user presses `CONFERMA DEFINITIVA`, shared pause first captures the immutable score/state/time needed for optional leaderboard submission, then synchronously calls `RWGSession.terminate('pause-terminate')` **before any asynchronous leaderboard/network work**.

This ordering is mandatory. It prevents Home, pagehide, beforeunload, freeze, heartbeat or another navigation checkpoint from resurrecting the deleted snapshot while score registration is pending. The common dock is blocked during this short finalization state.

After terminal suppression, an eligible result is emitted through `rwg:leaderboard-result` using the already captured data. Pause never calls the leaderboard HTTP API directly. Registration may finish through the normal idempotent/offline shared client; a bounded fallback reload prevents the UI from hanging forever. Non-eligible runs reload directly after terminal cleanup.

The same centralized `45 seconds + per-game score threshold` policy also evaluates a saved run when the player answers **No** to the resume prompt. `RWGSession` first terminal-suppresses the saved run with `terminate('resume-declined')`; shared pause then evaluates the immutable saved payload and persisted active time, emits an eligible result through the normal leaderboard event, and leaves the player on the intro of that same game. It never invokes the adapter's `startFresh()` and never auto-starts gameplay. A `rwg:pause-ready` / `rwg:leaderboard-ready` handshake makes the path safe even when shared scripts finish bootstrap in a different order.

A normal pause remains resumable and must not clear the session. Saving is enabled again only by a genuine `rwg:game-session-start` or `rwg:continue-game` lifecycle.

## Orientation and Game Over
Orientation may pause through `#pauseBtn` and resume with the shared countdown; it does not own another pause UI and is non-terminal. Real Game Over suppresses pause. Deliberate pause termination does not open a second Game Over presentation while finalizing.

## AI-agent rules
1. Shared behavior belongs in the shared pause/HUD/session layer.
2. Keep only private pause-state transitions in game runtimes.
3. Never hide Home/global dock during ordinary pause.
4. Block the dock after irreversible termination confirmation.
5. Keep thresholds centralized.
6. Preserve RWGSession, leaderboard and Game Over lifecycle contracts.
7. Never defer terminal suppression until after asynchronous registration.

## Required validation
```bash
node scripts/validate-shared-pause.mjs
node scripts/validate-shared-controls.mjs
node scripts/validate-session.mjs
node scripts/validate-leaderboards.mjs
node scripts/validate-contracts.mjs
```
Browser smoke tests cover pause/resume, Home and Share from pause, dock tapability on iOS Safari, both confirmations, threshold cases, eligible registration, reload/resume active time, immediate terminal suppression, no stale resume prompt, blocked dock during finalization and Game Over suppression.
