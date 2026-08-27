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

## 5B. Bubble Burst source of truth

Bubble Burst files:

- `games/bubble-burst/index.html`
- `games/bubble-burst/levels.js` — authoritative deterministic level catalogue
- `games/bubble-burst/game.js` — authoritative gameplay/runtime
- `games/bubble-burst/style.css`
- `docs/BUBBLE-BURST.md`

`levels.js` MUST load before `game.js`. Do not collapse the catalogue back into random `spawnBoard()` rows.

### Bubble Burst level invariants

- Base catalogue: exactly **200 deterministic artistic layout signatures**.
- The first 200 signatures MUST remain unique.
- Current construction uses 20 motif families × 10 variants.
- Layout geometry must remain top-connected/playable; decorative floating islands must not be generated initially.
- Every layout MUST expose a deterministic `optimalSeconds` derived from actual layout complexity rather than one global hard-coded target.
- Difficulty may continue beyond level 200 by cycling geometry while increasing rows/colors/special pressure.

### Bubble Burst timing/bonus invariants — CRITICAL

- The gameplay timer is large, centered immediately below the upper `SCORE / LEVEL / FALLI` HUD and displays centiseconds as `MM:SS.CC`.
- Timer is **green** through `optimalSeconds`.
- Timer is **orange** after optimal time through `optimalSeconds + (optimalSeconds × 2.5)`, therefore total orange deadline = `3.5 × optimalSeconds`.
- Timer is **red** after that deadline with no additional threshold.
- Green clear awards `+50%` of points generated in the level.
- Orange clear awards `+25%`.
- Red clear gives no timing bonus.
- Level points include gameplay points plus the existing base clear award; percentage bonus is applied to that level subtotal.
- Timer advances only during active gameplay. Pause/background/orientation pause and the level-clear summary MUST freeze it.
- Credit Continue MUST preserve elapsed level time and the start-of-level score baseline. Resetting either would allow bonus farming.
- Board clear opens an INTERMEDIATE arcade calculation screen with `LIVELLO {level} COMPLETATO!`, points, time, bonus and emphasized total, then advances only after user tap.
- Intermediate level-clear MUST NOT emit `rwg:game-ended` or invoke `RWGGameOver`.

### Bubble Burst consecutive-pop reward

- Every fifth consecutive shot that removes at least one bubble awards one Bomb.
- A shot that removes no bubble resets the streak.
- Reward delivery MUST NOT overwrite an already queued rare Bomb or Color Wipe; defer to the first normal ammunition slot.

### Bubble Burst timed-pressure invariants

- Level 1 ceiling descent must not begin before 60 seconds; current target is 65 seconds.
- Descent interval contracts progressively with level, currently floored around 16 seconds.
- Descent step grows gradually from roughly 0.5 row toward a cap below one full row.
- Pressure countdown runs only during active gameplay and waits for an in-flight projectile before moving geometry.
- The final six seconds must visibly warn the player.
- Continue preserves accumulated ceiling descent but resets only the next pressure countdown.

### Bubble Burst special-structure invariants

- Armor Bubble begins from level 8 and needs a normal color-match hit to break its shell before ordinary removal.
- Star Bubble begins from level 18 and triggers a compact local blast when removed.
- Prism Bubble unlocks from level 35 and acts as a wildcard in same-color component matching.
- These special structure bubbles become more common gradually; do not flood early levels.

### Bubble Burst rare launched-shot invariants

- Bomb unlocks from level 10, starts around 1.2% probability and is capped around 3%.
- Color Wipe unlocks from level 22, starts around 0.7% probability and is capped around 2%.
- Bomb removes a compact local radius on first structure contact.
- Color Wipe removes all structure bubbles matching the color of the bubble first touched.
- Both resolve disconnected groups afterward.
- Normal ammunition must remain dominant.

### Bubble Burst performance invariants

- Moving-shot collision and aim tracing use `nearbyBubbles()`/local hex lookup, not full-grid scans per trajectory step.
- Launched bubbles use exactly 3× the established baseline speed; distance-based sub-stepping MUST remain in `updateMoving()` to prevent collision tunneling.
- `drawMovingBubble()` reuses the sub-step path for the lightweight additive trail/afterimages; do not replace native `requestAnimationFrame` with a forced 50 fps cap.
- Bubble visual gradients/shadows are cached in `bubbleSprites`; do not recreate them for every bubble every frame.
- Clean manga-chibi launcher bases are cached in `mangaChibiSprites`; the removed 32×40 pixel-art renderer MUST NOT return.
- Bubble Burst aim dots and both crew members MUST share `predictAimTrajectory()`; eyes focus on the first wall bounce before attach, otherwise first attach/ceiling impact, with upward aim fallback.
- Static background artwork is cached and rebuilt on resize rather than recomputed each frame.
- BFS/graph traversal must use index-based queues; do not reintroduce repeated `queue.shift()` in hot paths.
- Keep particle/falling visual counts bounded.
- Timer DOM text should update only when the displayed centisecond changes, not with redundant same-value writes.
- Current scale does not justify WASM; profile first and follow `docs/WASM-EVALUATION.md` thresholds.

Run `node scripts/validate-bubble-burst.mjs` after Bubble Burst gameplay/layout changes in addition to the repository-wide validator.

## 6. Rendering and performance

### Solitaire classic-card invariants

- `games/solitaire/card-art.js` is the presentation source of truth for the 52-card deck and classic back.
- Cards use original inline SVG with traditional French suits, mirrored indices, standard pip layouts A–10, mirrored J/Q/K portraits and an ornamental Ace of Spades.
- Do not replace the classic deck with arcade/cartoon styling, external branded assets or per-render uncached SVG generation.
- Artwork changes MUST preserve the existing card aspect ratio, DOM hitboxes and multi-card drag behavior.

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
3. when Bubble Burst is touched, also run `node scripts/validate-bubble-burst.mjs`;
4. verify the affected game HTML still loads shared HUD/orientation;
5. verify terminal death opens shared Game Over;
6. verify Continue with credit resumes rather than starts a new run;
7. verify New Game resets state;
8. verify intermediate screens (boss clear, level clear) do not trigger terminal Game Over;
9. verify mobile portrait layout has no essential action below an unreachable viewport.

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
- Bubble Burst layout/special/performance contract → `docs/BUBBLE-BURST.md`;
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
- Do not regress Bubble Burst to fully random rectangular boards, full-grid collision scans, per-frame gradient construction, frequent Bomb/Color Wipe ammunition, or a level-clear overlay that accidentally invokes terminal Game Over.
- Static validation does not replace browser checks for console errors, failed
  requests, narrow viewports and credit debit flows.
