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
- `pwa_install_cta` — install CTA outcome or platform-specific guidance shown.

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

Leaderboard funnel:

- `leaderboard_view` — intro Top 10 loaded from network or cache, with row count and anonymous personal-rank flags;
- `leaderboard_home_top3` — aggregate home load result across all game podiums, with network/cache/error counts;
- `leaderboard_home_retry` — manual refresh of one home podium, identified only by the low-cardinality game slug;
- `leaderboard_pause_view` — compact in-game podium became visible for a resume prompt or explicit pause;
- `leaderboard_retry` — manual refresh requested;
- `leaderboard_load_error` — neither network nor cached ranking was available;
- `leaderboard_entry_view` — first-use coin-op name prompt shown; the entered name is never sent;
- `leaderboard_auto_submit_start` — a later result started silent submission with the locally saved nickname;
- `leaderboard_auto_submit` — silent submission completed live or entered the offline queue;
- `leaderboard_name_saved` — first nickname choice completed live or entered the offline queue, without sending the name;
- `leaderboard_rank_card_view` — Game Over position card displayed, with numeric position, Top Ten flag and known/pending status;
- `leaderboard_submit_error` — local nickname-format or server-validation rejection, never the entered value;
- `leaderboard_submit_queued` — result stored for a later retry;
- `leaderboard_queue_flush` — aggregate delivered/remaining counts after a retry pass;
- `post_score` — GA4 recommended gaming event, emitted only after the leaderboard server accepts the result, with numeric `score`, optional `level`, ranking position, Continue count and `delivery=live|queue_retry`.

The name typed by the player, device/profile identifiers, run IDs and raw server messages are deliberately excluded from every Analytics event. Custom parameters such as `delivery`, `row_count`, `leaderboard_position`, `error_type`, `delivered_count` and `remaining_count` require matching GA4 custom dimensions/metrics before they appear in standard reports or Explorations.

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

Solitario uses the existing centralized `window.RWGAnalytics.track()` API for `solitaire_auto_finish`, with low-cardinality `phase` (`start` or `complete`) and numeric `cards_moved`. It never sends card identities or the saved-hand payload.

The destructive new-deal confirmation uses `solitaire_new_deal_confirm` with low-cardinality `phase` (`open`, `cancel` or `confirm`). It sends no card state, score, saved-hand payload or free-form user content.

## Validation

Run:

```bash
node scripts/validate-analytics.mjs
node scripts/validate-contracts.mjs
```

The validator checks the measurement ID, centralized Google-tag loader, expected behavioral event vocabulary, hub/avatar loading and automatic game bootstrap.
