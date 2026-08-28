# RetroWebGames — Analytics

Google Analytics 4 is centralized in `rwg-analytics.js`.

Measurement ID: `G-ZSWLC4L8GW`.

## Loading contract

- The hub (`/`) and non-game pages such as `/avatar/` load `/rwg-analytics.js` directly.
- Every game inherits Analytics through the shared `game-hud.js` bootstrap.
- Game engines must **not** embed their own Google tag snippets or call a second `gtag('config', ...)`.
- `rwg-analytics.js` owns `window.dataLayer`, the `gtag()` queue, loading `https://www.googletagmanager.com/gtag/js`, and the GA4 config call.

This keeps the measurement ID and behavior events in one place and makes future changes auditable.

## Events

The shared module records behavioral signals useful for product analysis and later marketing segmentation without sending names, email addresses or other user-entered PII.

Core navigation / acquisition:

- `rwg_page_context` — hub, game or avatar context.
- `select_content` — a game card selected from the hub (`content_type=game`, `item_id=<slug>`).
- `share` — social/native share method and shared game/site.
- `profile_open` — avatar/profile entry point.
- `pwa_install_prompt` — installability prompt became available.
- `pwa_install` — web app installed.

Gameplay funnel:

- `game_intro_view` — game intro displayed.
- `game_start` — first new run from the intro.
- `game_restart` — another new run after a previous run/start.
- `gameplay_begin` — engagement clock starts after new, restart, resume or paid Continue.
- `game_resume` — unfinished autosaved run restored.
- `game_resume_declined` — user chose a fresh run instead of restoring.
- `game_resume_failed` — saved state could not be restored safely.
- `game_continue` — shared one-credit Continue granted.
- `level_reached` — shared level HUD advanced.
- `game_engagement` — visible-play milestones at 30, 120, 300, 600 and 1200 seconds.
- `game_pause_toggle` — pause/resume control.
- `game_background` — active run moved to background.
- `game_exit` — user intentionally returned to the game menu, with unfinished-state flag.
- `game_leave_in_progress` — page lifecycle ended while a resumable run still existed.
- `game_end` — terminal Game Over with available numeric result fields.
- `game_complete` — successful non-Game-Over completion event where supported.

Useful controls are grouped under `game_control` (Undo, Hint, New Deal, calibration, mute, card style) and `game_variant_select`.

## Event parameter rules

Use low-cardinality dimensions where possible: `game_id`, `game_name`, `page_kind`, `method`, `result`, `phase`, `control`, `variant`. Score, level, time and counters stay numeric.

Do not send:

- email addresses;
- real names;
- profile fingerprints / browser IDs;
- free-form user content;
- saved-game payloads;
- payment identifiers.

## Future games

A future game gets Analytics automatically by loading the mandatory shared `game-hud.js`. Standard `#startBtn`, `#level`, `#pauseBtn`, shared lifecycle events and `RWGResumeAdapter` make the common funnel measurable without game-local GA code.

If a future mechanic needs a new business-relevant event, add it to `rwg-analytics.js` or expose a stable platform event and document it here. Do not add a second GA implementation to the game engine.

## Validation

Run:

```bash
node scripts/validate-analytics.mjs
node scripts/validate-contracts.mjs
```

The validator checks the measurement ID, centralized Google-tag loader, expected behavioral event vocabulary, hub/avatar loading and automatic game bootstrap.