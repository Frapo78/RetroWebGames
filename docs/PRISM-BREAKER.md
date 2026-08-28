# Prism Breaker — design and runtime contract

Prism Breaker is RetroWebGames' original vertical brick-breaker. It takes genre inspiration from late-1980s paddle-and-ball arcade games while using original names, layouts, graphics, code and boss designs.

## Campaign

- exactly **100 deterministic base levels**;
- every level has a unique signature;
- boss fights occur at levels **10, 20, 30, 40, 50, 60, 70, 80, 90 and 100**;
- after level 100 the campaign restarts at level 1 as the next cycle;
- score and lives continue into the next cycle;
- each extra cycle increases ball/boss difficulty rather than creating a second set of layouts.

`levels.js` is authoritative for layouts. `bosses.js` is authoritative for the 10-boss roster. `engine.js` must not contain copied layouts or proprietary assets from commercial games.

## Level composition

The campaign intentionally avoids a repeated wall of bricks confined to the top of the screen. Pattern families include waves, rings, towers, crosses, arches, islands, spirals, canyons and glyph-like structures. Structures can occupy upper, middle and lower regions of the safe brick field.

Brick types unlock progressively:

- `normal` — one hit;
- `tough` — multiple hits;
- `armored` — heavier multi-hit brick;
- `glass` — fragile/high-contrast brick;
- `explosive` — destroys nearby destructible bricks;
- `prism` — high-value brick with increased power-up chance;
- `moving` — oscillates horizontally;
- `steel` — indestructible geometry and does not count toward clear conditions.

Normal level completion requires all destructible bricks to reach zero HP. Steel may remain.

## Bosses

There are exactly 10 base bosses with distinct names/shapes and varied movement/attack behavior. Boss arenas retain a small amount of surrounding brick architecture instead of reverting to an unrelated game mode.

A boss is defeated only when its HP reaches zero. Support bricks do not replace the boss victory condition.

## Physics

The runtime uses a **120 Hz fixed simulation step** and ball movement substeps based on travelled distance. This is required to reduce tunnelling through thin bricks/paddle surfaces as ball speed rises.

Paddle bounce angle depends on impact position. Multiple balls are capped to keep simulation bounded.

## Power-ups

The initial set is:

- Expand paddle;
- Multiball;
- Slow;
- Laser;
- Catch;
- Extra life.

Power-up drops are uncommon and level-dependent. Prism bricks have a higher drop probability.

## Loop after level 100

At level 100 completion:

1. `level` returns to `1`;
2. `cycle` increments;
3. current score/lives continue;
4. ball speed uses a cycle multiplier;
5. boss HP/fire cadence scales with cycle.

Do not clone another 100 layout files for later cycles.

## Shared platform contracts

Prism Breaker must:

- load `levels.js` → `bosses.js` → `engine.js` → `game-hud.js` → `orientation.js`;
- emit `rwg:game-ended` only on terminal loss;
- use shared `RWGGameOver`;
- support full-score one-credit `rwg:continue-game`;
- use shared `RWGSession` autosave/resume rather than local session storage;
- retain `data-rwg-game="true"` and the intro `TORNA AL MENU` action.

## Resume validation

The logical snapshot includes the current base level/cycle, score/lives, paddle/ball state, brick HP state, boss state, active power-ups/projectiles and timers.

The snapshot carries the current deterministic `stageSignature`. If the current `levels.js` produces a different signature, restore must be rejected automatically. Boss snapshots also validate the current boss identity/configuration.

Visual-only particles and Canvas caches are not persisted.

Compatibility token:

`prism-breaker-state-v1-levels100-boss10-physics120hz`

Bump the adapter version/compatibility token whenever a state-format, physics-unit, campaign or boss change makes old snapshots unsafe.

## Validation

```bash
node scripts/validate-prism-breaker.mjs
node scripts/validate-contracts.mjs
```

Browser smoke tests should cover touch paddle control, launch, every power-up class, life loss, boss damage/projectiles, level transition, 100→1 cycle transition, resume Sì/No and shared credit Continue.
