# RetroWebGames — AGENTS.md

This file is the machine-oriented operating contract for coding agents working in this repository.

## 0. Priority

When modifying the repository, preserve the shared platform contracts before optimizing an individual game. A local game implementation MUST NOT silently replace a shared service.

If a requested change conflicts with an invariant below, update the invariant and the shared architecture intentionally in the same change. Do not bypass it locally.

## 1. Canonical identity

- Public product name: `RetroWebGames`.
- Technical namespace: `RWG` / `rwg`.
- Canonical production origin: `https://www.retrowebgames.it/`.
- Old names such as WebGalaga or Sala Giochi WEB are historical only and MUST NOT return as active branding.

## 2. Shared services are authoritative

Every game page MUST:

1. use `<body data-rwg-game="true">`;
2. load its own engine first;
3. load `../../game-hud.js`;
4. load `../../orientation.js`;
5. use the shared profile/wallet/game-over infrastructure bootstrapped by `game-hud.js`.

The following root components are shared infrastructure and MUST NOT be reimplemented inside a game:

- `rwg-profile.js` / `rwg-profile.css`: anonymous profile, local prototype wallet, credits, statistics;
- `rwg-avatar.js` / `rwg-avatar.css`: avatar identity;
- `game-hud.js` / `game-hud.css`: common HUD/navigation/bootstrap;
- `game-over.js` / `game-over.css`: terminal GAME OVER presentation, statistics, achievements, sharing, continue/new game/main menu;
- `orientation.js` / `orientation.css`: portrait guard and resume countdown.

A game may have intermediate overlays such as pause, level clear, tutorial, or Star Swarm boss-clear. These MUST NOT replace the terminal shared Game Over modal.

## 3. Game-over contract — CRITICAL

Regression history: Star Swarm once ended by showing only its local start/replay overlay. This hid the centralized statistics/achievements/share/credit-continue UI. Do not repeat this.

When a run truly ends, a game engine MUST:

- stop its simulation;
- update final score/best/level DOM values;
- set the local start button to `RIGIOCA` as a fallback lifecycle signal;
- emit `rwg:game-ended` as the authoritative terminal lifecycle event;
- explicitly request the shared presentation with `window.RWGGameOver?.open?.()` after the final DOM state is committed;
- keep listening to `rwg:continue-game` and resume the exact interrupted run when credit continue succeeds;
- allow the shared `Nuova partita` action to reset through the normal start button path.

The shared `game-over.js` MUST listen to `rwg:game-ended` and recover/create a session when necessary. This is deliberately independent from the older MutationObserver path, because the asynchronous HUD bootstrap may otherwise miss a very early initial tap on `GIOCA`. MutationObserver detection is compatibility fallback only.

The shared Game Over is expected to retain:

- full-screen animated `GAME OVER` intro;
- compact statistics;
- achievement marquee/strip;
- SVG-only social share buttons;
- `Continua con 1` credit CTA;
- `Nuova partita`;
- `Scegli un altro gioco`;
- continue count in statistics/share text when used.

Do not build a second terminal game-over modal inside any game.

## 4. Credits and persistence

Current wallet/profile state is a client-side prototype in `localStorage`.

- Initial credit grant: 10 credits once per local profile version.
- Continue cost: 1 credit.
- Continue MUST preserve current score/progress unless a game-specific rule has been explicitly approved.
- Browser storage is NOT security authority and MUST NOT be represented as anti-tamper.
- Future paid credits MUST move wallet authority, grant, debit, transaction ledger, PayPal verification and idempotency server-side.

Never scatter wallet mutations through game engines. Use `RWGContinueProvider` / `RWGProfile` abstractions.

## 5. Star Swarm source of truth

Star Swarm files:

- `games/star-swarm/index.html`
- `games/star-swarm/engine.js` — authoritative runtime.
- `games/star-swarm/campaign.js` — campaign formations and entry choreography.
- `games/star-swarm/bosses.js` — boss roster/configuration.
- `games/star-swarm/campaign.css` — boss HUD / boss-clear presentation.

The obsolete root `/game.js` Star Swarm runtime was deleted and MUST remain absent. `games/star-swarm/index.html` must load only the authoritative game engine under `games/star-swarm/engine.js`.

### Star Swarm campaign invariants

- At least 100 campaign levels.
- The first 100 stage signatures must remain distinct by formation/entry choreography.
- Boss stages: 10, 20, 30, …, 100.
- Ten distinct base bosses with different visual forms and IA/attack patterns.
- Boss energy bar is visible and live-updated.
- Boss defeat is an INTERMEDIATE boss-clear screen with moving starfield and tap-to-resume.
- Defeating a boss MUST NOT invoke terminal Game Over.
- Defeating boss 100 completes the base campaign and may continue into Overdrive.

### Star Swarm offensive axes — CRITICAL semantic distinction

Do not conflate these two systems:

- **Weapon Upgrade** = red diamond = firing pattern/type progression.
- **POWER** = damage-strength pickup = per-projectile strength progression.

Regression history: these concepts were once accidentally reversed, producing 20 Weapon forms and only 10 POWER levels while also applying the intended POWER rarity reduction to Weapon Upgrade. Do not repeat this.

### Star Swarm Weapon invariants

- Weapon progression has exactly **8 firing forms**:
  1. SINGLE FIRE
  2. DOUBLE FIRE
  3. TRIPLE DIAGONAL FIRE
  4. 4 FIRE LINEAR
  5. FIREBALLS 3 WAY
  6. LASER
  7. 3 WAY LASERS
  8. 5 WAY LASERS
- Every Weapon advancement also carries a small increasing damage coefficient; current target is approximately `×1.00 → ×1.21` across the 8 forms.
- At equal POWER, a later Weapon therefore deals modestly more damage per projectile, but POWER remains the main damage-strength axis.
- Losing an unshielded life: Weapon `-2` forms, clamped to minimum; POWER `-2` levels, clamped to 1.
- Laser projectiles MUST continue through enemies to screen exit; hitting or destroying an enemy MUST NOT consume a laser projectile.
- A laser may damage each individual target at most once per projectile unless explicitly redesigned.
- Captured wingmen always shoot basic single-fire damage and do not inherit player Weapon/POWER upgrades.

### Star Swarm POWER invariants

- POWER range: **1..20**.
- POWER determines base per-projectile damage independently of Weapon spread/type.
- The 20 levels finely subdivide roughly the old `1..10` total base-damage range; expanding to 20 MUST NOT accidentally double maximum damage.
- There are 20 distinct projectile colors, one per POWER level.
- Current POWER base damage curve is approximately `1.00 → 10.00` over 20 levels.
- POWER bonus: maximum 2 drops per level.
- Shield: maximum 1 drop per level and absorbs one damaging hit without life/Weapon/POWER loss.

### Star Swarm drop rarity invariants

Treat rarity as gameplay economy. Do not return to the original high drop flood.

- Rapid Fire remains uncommon (already reduced from the original implementation).
- Weapon Upgrade uses the intended already-reduced baseline: approximately `0.86%` for commander/type-2 kills and `0.49%` for ordinary kills before elite multiplier. Do NOT halve these values merely because POWER was made rarer.
- POWER is the pickup whose frequency was intentionally halved: approximately `1.0%` per eligible kill before elite multiplier, with max 2 per level.
- Tractor Beam: maximum one eligible drop every two levels; no more than one in an eligible level.
- Shield: max 1 per level.

## 6. Rendering and performance

Current architecture intentionally uses JavaScript + Canvas 2D.

Do NOT port whole games to WebAssembly without measured evidence.

WASM is justified only for an isolated numeric hot loop when profiling shows a meaningful CPU bottleneck. Prefer:

- batch typed-array input/output;
- one/few JS↔WASM calls per frame;
- keeping Canvas, DOM, Pointer Events, Device Orientation, Web Audio and storage in JavaScript.

See `docs/WASM-EVALUATION.md`.

## 7. Regression guardrail workflow

Before publishing a gameplay change:

1. run `node --check` on every modified `.js` file;
2. run `node scripts/validate-contracts.mjs`;
3. verify the affected game HTML still loads shared HUD/orientation;
4. verify terminal death opens shared Game Over;
5. verify Continue with credit resumes rather than starts a new run;
6. verify New Game resets state;
7. verify intermediate screens (boss clear, level clear) do not trigger terminal Game Over;
8. verify mobile portrait layout has no essential action below an unreachable viewport.

If a real browser/device test cannot be run, state that limitation explicitly. Static validation is not a substitute for a playtest.

## 8. Anti-regression coding rules

- Prefer explicit lifecycle events/APIs over DOM mutation detection alone.
- Keep mutation observers only as compatibility fallbacks.
- Do not duplicate shared UI markup in game engines.
- Do not silently change canonical domain or game slugs.
- Do not remove `data-rwg-game`.
- Do not replace `game-hud.js` bootstrap with direct copies of profile/game-over code.
- Do not make localStorage authoritative for future paid wallet data.
- Do not introduce external libraries for a small feature when the repository is currently dependency-free unless benefits justify the new dependency.
- Preserve mobile-first portrait behavior and touch controls.

## 9. Documentation maintenance

Any material gameplay/architecture change MUST update the relevant document in the same task:

- global architecture → `docs/ARCHITECTURE.md`;
- Star Swarm balance/progression → `docs/STAR-SWARM.md`;
- performance/WASM decision → `docs/WASM-EVALUATION.md`;
- new invariant/regression → this `AGENTS.md` and/or validator.

Documentation is part of the implementation, not optional cleanup.

## 10. Errors not to repeat

- Do not ship a production `Permissions-Policy` with `accelerometer=()` or
  `gyroscope=()`: Neon Tilt needs both capabilities from the canonical same
  origin. Keep unrelated capabilities disabled and allow only `(self)` for
  these motion sensors.
- Shared HUD additions (credits, avatar, navigation, sharing) must be tested
  after bootstrap at `320×568`. Static markup may fit before injected controls
  and overflow only after shared components mount.
- When the VPS adaptation moves assets under `public/`, an upstream deletion
  must remain a deletion. Never resurrect obsolete root `game.js` through a
  rename/delete conflict.
- Do not confuse Star Swarm Weapon Upgrade with POWER strength. Weapon has 8 firing forms and a small damage coefficient per advancement; POWER has 20 damage-strength levels and is the pickup whose drop probability was halved.
- Static validation does not replace browser checks for console errors, failed
  requests, narrow viewports and credit debit flows.