# The Great Empire — game contract

## Identity

- Slug: `the-great-empire`; short name (`data-rwg-game-name`): `The Great Empire`.
- Genre: basic real-time strategy, portrait-only, touch-first.
- Runtime: `games/the-great-empire/`, built on the pattern in `GAME-OOP-ARCHITECTURE.md`.
- Specialized validator: `scripts/validate-the-great-empire.mjs`.

## The match

A fixed, fully visible map — no camera, no scrolling, which is what makes an RTS workable on a phone held in one hand. The player's town center sits at the bottom, the enemy camp at the top, resource nodes in between.

Loop: **gather → train → fight.**

- **Villagers** walk to a resource node, gather up to a carry capacity, walk back to the town center and deposit. Food and gold are separate; soldiers cost both, so gathering only food stalls the army. That tension is intentional.
- **Soldiers** attack raiders or the enemy camp. Idle soldiers auto-engage raiders within range, so the game does not demand constant micromanagement.
- **Raiders** spawn from the enemy camp in waves, prefer nearby soldiers, then villagers, and otherwise march on the town center.

**Win the level** by destroying the enemy camp. **Lose the run** when the town center falls, or when nothing is left: no units, nothing training, and not enough food to train a villager. That last condition exists so a hopeless position ends instead of stalling forever.

## Controls

Tap a unit to select it; tap what it should do. Tap an enemy or the camp to attack, a resource node to gather, empty ground to move; a group spreads instead of stacking. Double-tap a unit to select every unit of that kind. The command bar adds train villager, train soldier, select all villagers, select all soldiers and a one-tap assault.

The command bar is an occupied region of the viewport, like the shared dock. Its height is **measured at runtime** and written to `--tge-actions`; the CSS value is only a pre-measurement fallback. A hardcoded guess let the bar cover the playfield by 30 px on a 390×690 viewport — do not reintroduce one.

## Levels

`levels.js` is pure and deterministic: level *N* always produces the same map. A `signature` derived from the node layout identifies it, and a snapshot claiming a different signature is refused rather than repaired.

Difficulty escalates inside a cycle of 20 levels — tougher camp, shorter wave interval, more and stronger raiders, less starting food — and then the campaign restarts at level 21 with a cycle multiplier, keeping score. Every curve is bounded so a very high level stays playable.

Balance note: starting gold and the wave interval were raised after a headless match showed level 1 could not be won by a competent player. Any change to those two values must be re-checked with the validator's simulated match, not by eye.

## Platform contract

Standard and non-negotiable: `rwg:game-session-start` (via the shared start button), `rwg:game-ended` plus an explicit `RWGGameOver.open()` on defeat, `rwg:continue-game` for the one-credit Continue (restores the town center and clears raiders, keeping score and level), pause through `#pauseBtn` with the shared pause menu owning presentation, and `visibilitychange` pausing safely.

Interrupted-run leaderboard eligibility uses the centralized policy: 45 seconds of active play and **score > 200**, declared in `rwg-pause-menu.js`. See `PAUSE-MENU.md`.

## Resume

Adapter id `the-great-empire`, version 1, compatibility token `the-great-empire-state-v1-world100x140-levels`.

Serialization lives in `snapshot.js` as pure functions. Units are fixed-length numeric rows; a full army serializes to well under a kilobyte, far inside the shared 384 KiB limit. Validation refuses a snapshot whose layout signature, level, schema, node amounts, unit rows or building health could not have come from a legitimate run — including a finished one, because a destroyed town center or camp is not a resumable state.

## Assets

Cover `assets/social/games/the-great-empire.jpg` (1200×630), wordmark `assets/brand/games/the-great-empire-wordmark.png` (1200×300, alpha), portrait artwork `assets/covers/games/the-great-empire-portrait.jpg` (1080×1920) and its 540×960 derivative. All four are rendered from the game's own drawing routines and palette, so the poster shows the actual units and buildings rather than unrelated art.

## Validation

```bash
bash scripts/validate-local.sh                              # full contract suite
bash scripts/validate-local.sh validate-the-great-empire.mjs
```

Browser smoke tests must still cover what static checks cannot: portrait layout across phone sizes, canvas and command bar clear of the shared dock, tap-to-order, training, pause with an interactive dock, and reload → resume.
