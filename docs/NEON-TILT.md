# Neon Tilt

Neon Tilt is a portrait gravity maze driven by device orientation, analog touch or keyboard. Its 12 deterministic maze definitions repeat in progressively faster cycles; calibration and input method never alter scoring.

## Scoring v2

`games/neon-tilt/scoring.js` is the pure scoring authority. Version 2 is stored in the separate `scoring-v2` leaderboard season; historical and unversioned runs remain in `legacy-v1`.

For each cleared level:

```text
levelBase      = 820 + absoluteLevel × 145
timeFactor     = clamp((par / max(activeLevelTime, par × 0.30, 4s))^0.60, 0.45, 1.40)
integrityFactor= clamp(1 - livesLost × 0.14 - extraFalls × 0.03, 0.58, 1.00)
clearScore     = round(levelBase × timeFactor × integrityFactor)
shardScore     = 36 + absoluteLevel × 4 per shard
```

The absolute level, rather than the repeated map index, keeps later cycles more valuable. Shards are a small additive reward and cannot dominate a clear. Pit falls count as both a fall and a lost life, but are penalized only once by the current engine path. Cosmetic wall contact, bumpers, boost tiles, calibration, tilt, touch and keyboard are score-neutral.

The active simulation clock excludes intro, pause, hidden-page pause and Game Over. Terminal metrics include level/run time, levels cleared, lives lost, falls, pit falls, shards, clear/shard subtotals and best/last clear time.

## Persistence compatibility

The existing adapter schema and compatibility token remain valid. New snapshots store `scoringVersion: 2` and all counters. Old snapshots without a version restore in legacy mode and continue using the old formula, so one resumed run cannot cross leaderboard seasons. A genuine new run always starts in v2.

## Validation

```bash
node scripts/validate-neon-tilt.mjs
node scripts/validate-scoring.mjs
node scripts/validate-contracts.mjs
```

The dedicated validator checks monotonic time and life-loss behavior, cycle progression, clamps, shard weight, terminal metrics, persistence markers and script ordering. Browser smoke must also cover start/pause/resume, all three input fallbacks and mobile layout. Real accelerometer behavior still requires a physical secure-context device.
