# Star Swarm — design, progression and balance contract

This document is the gameplay source of truth for Star Swarm. Keep it synchronized with `games/star-swarm/engine.js`, `campaign.js` and `bosses.js`.

## Runtime files

- `games/star-swarm/index.html`
- `games/star-swarm/engine.js` — authoritative runtime
- `games/star-swarm/campaign.js` — 100+ stage formations/entry choreography
- `games/star-swarm/bosses.js` — boss roster and scaling
- `games/star-swarm/campaign.css` — boss HUD and clear screen

`games/star-swarm/index.html` must load `engine.js`, never root `game.js`.

## Campaign

- Base campaign: levels 1–100.
- First 100 levels use distinct formation/entry signatures.
- Boss every 10 levels after the normal wave: 10, 20, 30, …, 100.
- Boss clear is an intermission, not terminal Game Over.
- After boss 100, base campaign completion is shown and progression may continue in Overdrive.

`scripts/validate-contracts.mjs` executes the campaign and boss configuration in an isolated VM. It rejects duplicate signatures in levels 1–100, a changed 10-level boss cadence, fewer or more than ten base bosses, or duplicated boss name, shape, AI or attack identities.

## Bosses

Ten base bosses:

1. Sentinel Core
2. Twin Fang
3. Prism Eye
4. Iron Manta
5. Nova Queen
6. Hydra Grid
7. Void Serpent
8. Eclipse Forge
9. Chrono Warden
10. Omega Swarm

Bosses differ in visuals, movement AI and attack patterns. Boss HP scales again in Overdrive.

## Enemy durability tiers

Normal enemies are separated visually and mechanically into five durability families:

| Tier | Name | Base HP | Growth cadence | Role |
|---|---|---:|---:|---|
| 0 | SCOUT | 1 | +1 / 18 levels | weak/fast baseline |
| 1 | STRIKER | 2 | +1 / 14 levels | medium |
| 2 | GUARDIAN | 4 | +1 / 11 levels | durable |
| 3 | ARMORED | 6 | +1 / 9 levels | heavy armor |
| 4 | DREAD | 9 | +1 / 7 levels | high-resistance elite |

Higher tiers appear more often as campaign level rises. Enemies with meaningful HP show an individual health strip.

## Weapon progression — 20 segments

Weapon level is independent from POWER. Every weapon segment has a small damage coefficient. At the same POWER value, later weapon segments are modestly more damaging.

Target progression:

1. SINGLE FIRE
2. SINGLE FIRE +
3. DOUBLE FIRE
4. DOUBLE FIRE FOCUS
5. DOUBLE FIRE WIDE
6. TRIPLE DIAGONAL
7. TRIPLE DIAGONAL +
8. TRIPLE WIDE
9. 4 FIRE LINEAR
10. 4 FIRE LINEAR +
11. FIREBALLS 3 WAY
12. FIREBALLS 3 WAY +
13. FIREBALLS WIDE
14. LASER
15. LASER MK II
16. TWIN LASERS
17. 3 WAY LASERS
18. 3 WAY LASERS WIDE
19. 5 WAY LASERS
20. 5 WAY LASERS OVERDRIVE

Damage coefficient should rise gently from about `1.00` to `1.38`, rather than doubling damage through weapon level alone.

### Laser invariant

A laser projectile is not consumed by a normal enemy collision. It:

- may damage each enemy once;
- keeps travelling;
- can cross additional enemies;
- exits only when it leaves the screen (or the run changes state).

The same projectile must not repeatedly damage the same enemy every frame.

## POWER progression

POWER is a second, independent damage axis.

- range: 1–10;
- one distinct projectile color per level;
- POWER affects damage regardless of weapon spread/type;
- fireballs may retain a small intrinsic damage bonus;
- wingmen always use base single-fire damage and do not inherit POWER.

A POWER pickup advances one level until 10.

## Life-loss penalties

An unshielded damaging hit that costs a life applies:

- weapon progression `-2` segments, min segment 1;
- POWER `-2`, min POWER 1;
- tractor beam cancelled;
- normal respawn invulnerability.

A shielded hit consumes Shield and does not lose a life or downgrade weapon/POWER.

## Power-up economy

Drop limits are per level and reset when a new wave begins.

### Rapid Fire

Uncommon temporary fire-rate boost. It was intentionally reduced from the original frequent drop implementation.

Current base kill probabilities before elite multiplier:

- commander/type-2 enemy: about `2.4%`;
- other enemies: about `1.35%`.

### Weapon Upgrade

Extremely rare. The previous already-reduced probability is halved again in the current balance target:

- commander/type-2: `0.43%` per eligible kill;
- others: `0.245%` per eligible kill;
- elite multiplier may modestly raise these values.

Do not casually increase this rate. Twenty weapon segments are intended to make a high weapon tier valuable across a long run.

### Tractor Beam

- no more than one drop in an eligible level;
- eligible only once every two levels;
- only when fewer than two wingmen are present;
- captured enemies become wingmen, max two.

### POWER

- max 2 drops per level;
- advances POWER by one, capped at 10.

### Shield

- max 1 drop per level;
- stores one-hit protection;
- a new shield pickup while shielded refreshes/replaces the single protection rather than stacking multiple shields.

## Wingmen

- max two;
- captured through Tractor Beam;
- visually reflect captured enemy tier;
- follow the player at left/right offsets;
- shoot single basic bolts;
- vulnerable to enemy bullets and ramming;
- persist across ordinary level transitions until destroyed.

## Terminal Game Over

Star Swarm must use the root shared Game Over component.

On terminal death `engine.js` must:

1. update final HUD values;
2. set local button to `RIGIOCA` only as fallback;
3. emit `rwg:game-ended`;
4. invoke `window.RWGGameOver?.open?.()` after state commit.

The local Star Swarm start overlay is not the terminal result screen.

The shared result UI owns statistics, achievements, social sharing, credit continue, new game and main-menu navigation.

## Continue

Credit continue must resume the interrupted wave or boss with current score. It must not restart campaign state.

The engine keeps the interrupted stage phase so `rwg:continue-game` can restore it.
The preserved phase is either the normal wave or the active boss fight; Continue must restore the matching HUD and simulation state without resetting score.
