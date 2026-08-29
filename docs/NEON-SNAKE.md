# Neon Snake — speed and control contract

Neon Snake runs on a 20×28 logical grid. `games/neon-snake/game.js` is authoritative for movement, scoring, collisions, pickups, Continue and resumable state; rendering remains Canvas 2D and controls remain DOM/Pointer Events.

## Accessible speed curve

The base movement interval starts at **1000 ms per cell**. This is intentionally much calmer than the historical 154 ms start. Each level multiplies the interval by `0.965`, producing small, predictable increases instead of the old aggressive linear reductions. The unboosted late-game interval is capped at 170 ms.

`movementIntervalMs()` is the only runtime movement cadence. Level progression must remain monotonic and gradual; do not reintroduce the old `154 - level × 9` curve.

## Hold-to-boost

The dedicated `TURBO ×2` control is momentary, not a toggle. While its pointer remains pressed, the current interval is divided by exactly two. Pointer up, pointer cancellation, lost capture, pause, backgrounding, window blur, Game Over, Continue, restore and new game all release Turbo. Keyboard users may hold either Shift key.

Turbo is transient input and is intentionally absent from the resumable snapshot. Restored and continued games always resume at their normal level speed.

A completed press is measured through the centralized GA4 `game_control` event with `control=turbo`; no pointer identifiers or continuous movement samples are sent.

## Pace-aware timers

Because movement is deliberately slower, the combo opportunity and temporary Bonus/Shield availability derive from the current unboosted step interval. This preserves a comparable number of reachable grid cells instead of letting old real-time deadlines make pickups impossible. Turbo can be used tactically within those windows.

## Validation

Run:

```bash
node scripts/validate-neon-snake.mjs
node scripts/validate-session.mjs
node scripts/validate-contracts.mjs
```

Browser smoke tests must cover normal cadence, continuous held Turbo, release outside the visual button through pointer capture, pause/background release, direction input while Turbo is held and 390×844, 375×667 and 320×568 viewports.
