# Star Swarm — design, progression and balance contract

This document is the gameplay source of truth for Star Swarm. Keep it synchronized with `games/star-swarm/engine.js`, `campaign.js` and `bosses.js`.

## Runtime files

- `games/star-swarm/index.html`
- `games/star-swarm/engine.js` — authoritative runtime
- `games/star-swarm/campaign.js` — 100+ stage formations/entry choreography
- `games/star-swarm/bosses.js` — boss roster and scaling
- `games/star-swarm/campaign.css` — boss HUD and clear screen

`games/star-swarm/index.html` must load `engine.js`. A root `/game.js` Star Swarm runtime must remain absent.

## Campaign

- Base campaign: levels 1–100.
- First 100 levels use distinct formation/entry signatures.
- Boss every 10 levels after the normal wave: 10, 20, 30, …, 100.
- Boss clear is an intermission, not terminal Game Over.
- After boss 100, base campaign completion is shown and progression may continue in Overdrive.

`scripts/validate-contracts.mjs` executes the campaign and boss configuration in an isolated VM. It rejects duplicate signatures in levels 1–100, a changed 10-level boss cadence, fewer or more than ten base bosses, or duplicated boss name, shape, AI or attack identities.

## Inter-wave continuity — CRITICAL

Ordinary wave completion must be visually and mechanically continuous. The short `wave → transition → next wave/boss` interval is **not a pause** and must not freeze the simulation.

During that transition:

- stars/player/wingmen keep animating;
- already-fired player projectiles keep travelling until they naturally leave the playfield or collide;
- already-fired enemy projectiles keep travelling under their normal rules;
- power-ups already falling keep descending and remain collectable;
- existing particles may finish naturally;
- no new automatic player volley is emitted until the next `wave` or `boss` phase starts.

`startWave()` and `spawnBoss()` must therefore clear only stage-specific actors/hazards that cannot belong to the next stage. They must **not** wipe `bullets`, `enemyBullets` or `powerups` merely because the level number changes.

Boss defeat may pause for the explicit boss-clear intermission, but bullets/power-ups must remain in memory and resume after the intermission rather than being discarded. Terminal Game Over is the separate boundary where the run ends.

This is a regression-critical gameplay rule: a drop earned by killing the final enemy must never vanish because that kill also completed the wave.

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

### Iron Manta balance guardrail

Iron Manta, the fourth boss, keeps its mine identity but its projectile density is deliberately lower than the original implementation:

- each attack launches exactly 2 mines rather than 3;
- each mine explodes into 5 radial projectiles rather than 8, so a mine volley produces 10 radial projectiles instead of 24;
- the additional aimed triad fires every third mine attack rather than every second;
- its attack delay multiplier is `1.18`, making mine volleys approximately 18% less frequent than the generic cadence would otherwise produce.

Do not restore the old 3 × 8 mine wall without an explicit balance decision.

### Boss Shield milestones

Starting with boss 4, every completed 10% segment of boss max HP removed releases one guaranteed Shield pickup. The ten thresholds are 10%, 20%, …, 100%; a large hit that crosses more than one threshold releases one Shield for each crossed segment.

These guaranteed boss rewards are independent of the ordinary random Shield drop cap. They remain normal falling power-ups, so the inter-wave continuity contract also applies to a Shield released by the final blow at 100% damage.

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

## Two independent offensive progressions — do not conflate them

Star Swarm has two deliberately separate offensive axes:

1. **Weapon Upgrade** — the red diamond. Changes the firing pattern/type through 8 forms.
2. **POWER** — the damage-strength pickup. Raises the damage of each player projectile through 20 fine-grained strength levels.

This distinction is a critical regression guardrail. Do not expand Weapon to 20 merely because POWER has 20 levels, and do not apply POWER rarity rules to the red Weapon Upgrade.

## Weapon Upgrade progression — 8 firing forms

Weapon level changes the shape/type of fire. Each advancement also adds a **small** damage multiplier, so at identical POWER a later weapon is modestly stronger without replacing POWER as the main damage axis.

Target progression:

1. SINGLE FIRE — damage coefficient `×1.00`
2. DOUBLE FIRE — `×1.03`
3. TRIPLE DIAGONAL FIRE — `×1.06`
4. 4 FIRE LINEAR — `×1.09`
5. FIREBALLS 3 WAY — `×1.12`
6. LASER — `×1.15`
7. 3 WAY LASERS — `×1.18`
8. 5 WAY LASERS — `×1.21`

The coefficient grows gently by roughly 3% per weapon advancement. Most of the gameplay advantage of Weapon Upgrade comes from the new firing geometry/type; POWER remains the primary per-projectile strength system.

### Laser invariant

A laser projectile is not consumed by a normal enemy collision. It:

- may damage each enemy once;
- keeps travelling whether the target survives or is destroyed;
- can cross additional enemies;
- exits only when it leaves the screen (or the run changes state).

The same projectile must not repeatedly damage the same enemy every frame.

## POWER strength progression — 20 levels

POWER is the independent damage-strength axis and is intentionally more granular than Weapon.

- range: 1–20;
- 20 distinct projectile colors;
- POWER affects the damage of every player projectile regardless of weapon spread/type;
- the 20 levels subdivide roughly the former `1 → 10` damage range rather than doubling maximum strength;
- current base damage curve: `1.00 → 10.00` across 20 steps;
- fireballs retain a small intrinsic damage bonus before the weapon coefficient;
- wingmen always use base single-fire damage and do not inherit POWER or Weapon damage multipliers.

A POWER pickup advances one level until 20.

## Damage composition

For ordinary player fire, damage is conceptually:

`POWER base damage × current Weapon damage coefficient`

Fireballs add their intrinsic bonus before the Weapon multiplier.

This means two players at POWER 10 do not necessarily inflict identical damage if their Weapon form differs: the later Weapon has the intended small multiplier.

## Life-loss penalties

An unshielded damaging hit that costs a life applies:

- Weapon progression `-2` forms, minimum form 1;
- POWER `-2` levels, minimum POWER 1;
- Tractor Beam cancelled;
- normal respawn invulnerability.

A shielded hit consumes exactly one Shield layer and does not lose a life or downgrade Weapon/POWER. Any remaining Shield layers stay active.

## Power-up economy

Ordinary random drop limits are per level and reset when a new wave begins. Guaranteed boss Shield milestones are an explicit exception to the ordinary random Shield cap.

### Rapid Fire

Uncommon temporary fire-rate boost. It was intentionally reduced from the original frequent drop implementation.

Current base kill probabilities before elite multiplier:

- commander/type-2 enemy: about `2.4%`;
- other enemies: about `1.35%`.

### Weapon Upgrade — red diamond

Weapon Upgrade uses the already-reduced rarity target that existed before the Weapon/POWER misunderstanding:

- commander/type-2: `0.86%` per eligible kill;
- others: `0.49%` per eligible kill;
- elite multiplier may modestly raise these values.

These values are intentionally uncommon, but **must not be confused with the rarer POWER-strength rebalancing**. Do not halve them again unless an explicit future balance decision changes Weapon Upgrade itself.

### POWER — damage strength

POWER is the pickup whose frequency was intentionally reduced while being expanded to 20 levels.

- base probability: about `1.0%` per eligible kill before elite multiplier;
- this is half the previous `2.0%` POWER baseline;
- max 2 POWER drops per level;
- each pickup advances POWER by one, capped at 20.

### Tractor Beam

- no more than one drop in an eligible level;
- eligible only once every two levels;
- only when fewer than two wingmen are present;
- captured enemies become wingmen, max two.

### Shield

- ordinary random enemies can release max 1 random Shield per level;
- Shield protection stacks from `0..3` layers;
- every Shield pickup adds exactly one missing layer, capped at 3;
- a damaging hit consumes exactly one layer, after which another Shield pickup can restore that layer;
- layer 1 is the original cyan ring (`#65e7ff`) at the original radius;
- layer 2 is larger and uses the intermediate cyan/yellow color `#b2e6b6`;
- layer 3 is the largest and uses yellow `#ffe66d`;
- from boss 4 onward the guaranteed 10%-HP Shield rewards are not limited by the one-random-Shield-per-level cap.

### 1UP — extra life

- random normal-enemy pickup;
- base probability is `0.45%` per eligible kill before the elite multiplier;
- at most one 1UP may be released in a level;
- after a 1UP is released, another cannot be released until at least 5 level numbers later;
- the cooldown is based on release, not collection, so ignoring or missing a falling 1UP does not permit an immediate replacement;
- collecting it adds one life, capped at 9 lives.

## Wingmen

- max two;
- captured through Tractor Beam;
- visually reflect captured enemy tier;
- follow the player at left/right offsets;
- shoot single basic bolts;
- vulnerable to enemy bullets and ramming;
- persist across ordinary level transitions until destroyed.

## Resumable state

The current Star Swarm resume adapter is version 2 with compatibility token `star-swarm-state-v2-campaign100-boss10-weapon8-power20-shield3-1up5`.

The snapshot must preserve and validate the Shield layer count `0..3`, pending `1UP` power-ups, the per-level 1UP counter and `lastOneUpLevel`, in addition to the existing campaign/boss identity and gameplay state. Mine projectiles persist their bounded explosion fragment count. Version-1 Star Swarm snapshots are intentionally incompatible with these new gameplay semantics and must be discarded by the shared session layer.

Run `node scripts/validate-star-swarm-balance.mjs` after changes to Star Swarm bosses, Shield, 1UP or related drop rules. Repository-wide `node scripts/validate-contracts.mjs` remains mandatory.

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
