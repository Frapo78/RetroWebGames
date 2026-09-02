# The Great Empire — game contract

## Identity

- Slug: `the-great-empire`; short name (`data-rwg-game-name`): `The Great Empire`.
- Genre: basic real-time strategy, portrait-only, touch-first.
- Runtime: `games/the-great-empire/`, built on the pattern in `GAME-OOP-ARCHITECTURE.md`.
- Specialized validator: `scripts/validate-the-great-empire.mjs`.

## The match

A fixed, fully visible map — no camera, no scrolling, which is what makes an RTS workable on a phone held in one hand. The player's town center sits at the bottom, the enemy camp at the top, resource nodes in between.

Loop: **gather → build → advance → fight**, the shape of the 1997 original reduced to what a thumb can drive.

- **Villagers** walk to a resource node, gather up to a carry capacity, walk back to the town center and deposit. Three resources — **food, wood, gold** — and every unit costs a different mix, so a player who gathers only one stalls. Woodland, like in the original, does not grow back: a felled grove visibly thins and then disappears.
- **Ages.** Three of them: *Pietra → Bronzo → Ferro*. Advancement is researched at the town center, costs resources up front and takes time. Each age unlocks a unit **and strengthens every soldier already trained**, so advancing is felt immediately instead of applying only to future troops.
- **Military.** *Guerriero* (Stone, melee), *Arciere* (Bronze, ranged — shoots real projectiles that land on arrival), *Cavalleria* (Iron, fast and heavy). Idle soldiers auto-engage nearby raiders, so the game never demands constant micromanagement.
- **Buildings.** *Casa* raises the population ceiling (+4, exactly as houses do in the original, over a base of 4 from the town center). *Torre* turns wood and gold into a defence that keeps killing raiders while the army is away attacking — and can itself be knocked down, which is what stops it from trivialising the game.
- **Raiders** spawn in waves, prefer nearby soldiers, then villagers, then any player building in the way, and otherwise march on the town center. From level 5 every third raider is an archer.

**Win the level** by destroying the enemy camp. **Lose the run** when the town center falls, or when nothing is left: no units, nothing training, and not enough food to train a villager. That last condition exists so a hopeless position ends instead of stalling forever.

## Controls

Tap a unit to select it; tap what it should do. Tap an enemy or the camp to attack, a resource node to gather, empty ground to move; a group spreads instead of stacking. Double-tap a unit to select every unit of that kind. The command bar adds the four training options, the two buildings, age advancement, group selection and a one-tap assault; units the current age has not unlocked are shown locked rather than hidden, so the progression is visible from the first minute.

**Building placement slides.** Tapping *Casa* or *Torre* arms a build order; the next tap on the map places it. If that exact spot is occupied — and near home it often is, because woodland is deliberately close — the site slides to the nearest free ground within a short radius instead of refusing. A fingertip is far wider than a building, and a refusal that the player cannot see the reason for reads as a bug.

The command bar is an occupied region of the viewport, like the shared dock. Its height is **measured at runtime** and written to `--tge-actions`; the CSS value is only a pre-measurement fallback. A hardcoded guess let the bar cover the playfield by 30 px on a 390×690 viewport — do not reintroduce one.

## Levels

`levels.js` is pure and deterministic: level *N* always produces the same map. A `signature` derived from the node layout identifies it, and a snapshot claiming a different signature is refused rather than repaired.

Difficulty escalates inside a cycle of 20 levels — tougher camp, shorter wave interval, more and stronger raiders, less starting food — and then the campaign restarts at level 21 with a cycle multiplier, keeping score. Every curve is bounded so a very high level stays playable.

Balance note: starting gold and the wave interval were raised after a headless match showed level 1 could not be won by a competent player. Any change to those values must be re-checked with the validator's simulated match, not by eye — that match is the only thing standing between a tuning tweak and an unwinnable campaign.

## Platform contract

Standard and non-negotiable: `rwg:game-session-start` (via the shared start button), `rwg:game-ended` plus an explicit `RWGGameOver.open()` on defeat, `rwg:continue-game` for the one-credit Continue (restores the town center and clears raiders, keeping score and level), pause through `#pauseBtn` with the shared pause menu owning presentation, and `visibilitychange` pausing safely.

Interrupted-run leaderboard eligibility uses the centralized policy: 45 seconds of active play and **score > 200**, declared in `rwg-pause-menu.js`. See `PAUSE-MENU.md`.

## Resume

Adapter id `the-great-empire`, version 1, compatibility token `the-great-empire-state-v2-ages-wood-buildings`, envelope schema 2.

Schema 1 snapshots describe a game that no longer exists — no ages, no wood, no buildings — so they are **refused, not migrated**. That is the contract: a mismatch removes the snapshot rather than attempting an unsafe repair.

Serialization lives in `snapshot.js` as pure functions. Units and buildings are fixed-length numeric rows; a full empire serializes to a couple of kilobytes, far inside the shared 384 KiB limit. Validation refuses a snapshot whose layout signature, level, schema, age, node amounts, unit rows or building rows could not have come from a legitimate run — including a finished one, because a destroyed town center or camp is not a resumable state.

Arrows in flight are deliberately not persisted: each carries at most one pending hit, and rebuilding them would add schema for no player-visible continuity.

## Assets

Cover `assets/social/games/the-great-empire.jpg` (1200×630), wordmark `assets/brand/games/the-great-empire-wordmark.png` (1200×300, alpha), portrait artwork `assets/covers/games/the-great-empire-portrait.jpg` (1080×1920) and its 540×960 derivative. All four are rendered from the game's own drawing routines and palette, so the poster shows the actual units and buildings rather than unrelated art.

## Validation

```bash
bash scripts/validate-local.sh                              # full contract suite
bash scripts/validate-local.sh validate-the-great-empire.mjs
```

Browser smoke tests must still cover what static checks cannot: portrait layout across phone sizes, canvas and command bar clear of the shared dock, tap-to-order, gathering all three resources, placing a building, age advancement unlocking its unit, pause with an interactive dock, and reload → resume.
