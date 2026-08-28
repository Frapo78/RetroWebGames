# RetroWebGames — AGENTS.md

This file is the machine-oriented operating contract for coding agents working in this repository.

## 0. Priority

Preserve shared platform contracts before optimizing an individual game. A local game implementation MUST NOT silently replace a shared service.

If a requested change intentionally changes an invariant below, update the shared architecture, validators and documentation in the same change. Never bypass a shared contract locally.

## 1. Canonical identity

- Public product name: `RetroWebGames`.
- Technical namespace: `RWG` / `rwg`.
- Canonical production origin: `https://www.retrowebgames.it/`.
- Historical names such as WebGalaga or Sala Giochi WEB MUST NOT return as active branding.

## 2. Shared services are authoritative

Every game page MUST:

1. use `<body data-rwg-game="true">`;
2. load its own runtime/modules before shared bootstrap;
3. expose a complete `window.RWGResumeAdapter` before `../../game-hud.js` loads;
4. load `../../game-hud.js`;
5. load `../../orientation.js` after the HUD;
6. use shared profile/wallet/game-over/session/orientation infrastructure instead of local copies.

Shared root services:

- `rwg-profile.js` / `rwg-profile.css` — anonymous profile, local prototype wallet, credits, statistics;
- `rwg-avatar.js` / `rwg-avatar.css` — avatar identity;
- `rwg-session.js` / `rwg-session.css` — mandatory unfinished-run autosave, validation, lifecycle flush and resume prompt;
- `game-hud.js` / `game-hud.css` — shared navigation/bootstrap;
- `game-over.js` / `game-over.css` — terminal GAME OVER, metrics, achievements, sharing and credit Continue;
- `orientation.js` / `orientation.css` — portrait guard and resume countdown.

Game-local code may expose only the game-specific persistence adapter. It MUST NOT own the `localStorage` session namespace, autosave scheduler, lifecycle flush listeners or resume modal.

`game-hud.js` automatically boots `rwg-session.js` and `rwg-session.css` for every game page. A game must not duplicate those shared assets in its page.

Intermediate overlays such as pause, tutorial, level-clear or Star Swarm boss-clear are allowed. They MUST NOT replace terminal shared Game Over.

## 3. Game-over contract — CRITICAL

Regression history: Star Swarm once ended by showing only its local replay overlay, hiding centralized statistics/achievements/share/credit-continue UI. Do not repeat this.

When a run truly ends, a game engine MUST:

- stop its simulation;
- commit final score/best/level values;
- make `RIGIOCA` available as local fallback;
- emit `rwg:game-ended` as the authoritative terminal lifecycle event;
- explicitly request `window.RWGGameOver?.open?.()` after final state is committed;
- listen to `rwg:continue-game` and resume the interrupted run after a successful credit Continue;
- let normal new-game flow fully reset runtime state.

Shared `game-over.js` MUST retain:

- full-screen animated `GAME OVER` intro;
- compact statistics;
- achievements;
- SVG share actions;
- `Continua con 1`;
- `Nuova partita`;
- `Scegli un altro gioco`.

MutationObserver-based terminal detection is compatibility fallback only. Explicit lifecycle events remain authoritative.

## 4. Credits and persistence

Current wallet/profile state is a client-side prototype in `localStorage`.

- Initial grant: 10 credits once per local profile version.
- Credit Continue cost: 1 credit.
- Credit Continue preserves score/progress unless an intentionally documented game-specific rule says otherwise.
- Browser storage is not payment/security authority.
- Future paid credits require server-authoritative grant/debit/ledger/payment verification/idempotency.

Never scatter wallet mutations through game engines. Use `RWGContinueProvider` / `RWGProfile` abstractions.

## 4A. Resumable unfinished runs — CRITICAL AND MANDATORY

**Every current and future game MUST implement resumable unfinished-run persistence. This is not opt-in.**

`RWGSession` handles browser/app closure, reload, background discard and deliberate navigation away. This resume is free and MUST NOT debit credits or dispatch `rwg:continue-game`.

Shared `rwg-session.js` owns:

- storage namespace `rwg.session.v2:<game-id>`;
- platform envelope schema `2`;
- exact adapter-version matching;
- exact adapter `compatibility` token matching;
- semantic payload validation through `adapter.validate()`;
- automatic deletion of obsolete `rwg.session.v1:*` snapshots;
- dirty-save debounce: currently 750 ms;
- idle-friendly heartbeat: currently 5 seconds;
- forced lifecycle checkpoints on hidden/pagehide/beforeunload/freeze/navigation;
- snapshot-size guard;
- redundant-write suppression;
- shared modal **“Vuoi continuare la partita precedente?”**;
- `No` red on the left and `Sì` green on the right;
- automatic terminal clearing on `rwg:game-ended` / `rwg:session-completed`.

Every game MUST expose a non-empty adapter before `game-hud.js`:

```js
window.RWGResumeAdapter = Object.freeze({
  id: 'game-slug',
  version: 1,
  compatibility: 'game-state-v1-semantic-contract',
  isInProgress,
  serialize,
  validate,
  restore,
  startFresh,
  describe // optional
});
```

Required semantics:

- `isInProgress()` returns true whenever unfinished progress should survive leaving/reload, including legitimate pause/intermission states.
- `serialize()` returns compact JSON-serializable authoritative logical state.
- `validate()` rejects corrupt, impossible or currently incompatible state.
- `restore()` reconstructs the exact logical run and returns false on failure.
- `startFresh()` starts a real new run after the user chooses No.
- `compatibility` MUST change whenever engine/content/state semantics make old snapshots unsafe.

### Automatic invalidation rules

A snapshot is restorable only when all of these match the current runtime:

1. platform envelope schema;
2. game id;
3. adapter version;
4. adapter compatibility token;
5. semantic `validate(payload, envelope)`.

If any check fails, remove the snapshot and start safely rather than attempting best-effort mutation.

For deterministic content, validate content identity too. Existing examples:

- Bubble Burst validates deterministic layout signature;
- Star Swarm validates campaign signature and boss identity;
- Solitario validates canonical 52-card state and Klondike semantics;
- fixed-grid games validate dimensions, coordinates and entity/object domains.

### Autosave performance rules

- NEVER write storage once per animation frame.
- Call `markDirty()` on meaningful discrete logical mutations.
- Continuous simulations use the shared 5-second heartbeat for position/velocity continuity.
- Persist authoritative logical state only.
- Do not persist Canvas caches, particles, starfields, trails, DOM nodes, AudioContext, pointer objects or rebuildable decoration.
- Large Undo/history rings require explicit storage/performance justification.
- Forced lifecycle writes may be synchronous because they are rare and protect progress.

See `docs/SESSION-PERSISTENCE.md` for the full source of truth.

### Future-game enforcement

`scripts/validate-session.mjs` dynamically discovers every `games/*/index.html` with `data-rwg-game="true"`. It does NOT rely on a manually maintained list.

For every discovered game it requires a versioned, compatible `RWGResumeAdapter` loaded before `game-hud.js`. Therefore adding a future game without autosave/resume MUST fail validation automatically.

`scripts/validate-contracts.mjs` invokes `scripts/validate-session.mjs`.

## 5. Star Swarm source of truth

Authoritative files:

- `games/star-swarm/engine.js` — runtime;
- `games/star-swarm/campaign.js` — formations/entry choreography;
- `games/star-swarm/bosses.js` — boss roster/config;
- `docs/STAR-SWARM.md` — detailed contract.

The obsolete root `/game.js` MUST remain absent.

### Campaign invariants

- At least 100 campaign levels.
- First 100 campaign signatures are distinct.
- Boss stages: 10, 20, …, 100.
- Ten distinct base bosses with different forms, AI and attacks.
- Boss defeat uses an intermediate boss-clear, not terminal Game Over.
- Boss 100 completes the base campaign and may continue into Overdrive.

### Offensive axes — CRITICAL semantic distinction

Do not conflate these two systems.

- **Weapon Upgrade** = firing pattern/type progression.
- **POWER** = per-projectile damage-strength progression.

Weapon progression has exactly **8 firing forms**:

1. SINGLE FIRE
2. DOUBLE FIRE
3. TRIPLE DIAGONAL FIRE
4. 4 FIRE LINEAR
5. FIREBALLS 3 WAY
6. LASER
7. 3 WAY LASERS
8. 5 WAY LASERS

Weapon coefficient rises modestly, approximately ×1.00 → ×1.21.

POWER range: **1..20**. POWER remains the main damage axis, approximately 1.00 → 10.00 base damage, with 20 projectile colors.

Life loss without Shield: Weapon -2 forms, POWER -2 levels. Lasers continue through normal enemies and each laser projectile damages a given target at most once unless intentionally redesigned.

Drop invariants:

- Weapon Upgrade baseline remains approximately 0.86% commander/type-2 and 0.49% ordinary before elite multiplier.
- POWER baseline remains approximately 1.0% before elite multiplier, max two per level.
- Shield max one per level.
- Tractor Beam max one eligible drop every two levels.

## 6. Bubble Burst source of truth

Authoritative files:

- `games/bubble-burst/levels.js` — deterministic catalogue;
- `games/bubble-burst/game.js` — runtime;
- `docs/BUBBLE-BURST.md` — detailed contract.

Core invariants:

- exactly 200 deterministic base layout signatures;
- every layout has complexity-derived `optimalSeconds`;
- green timer through optimal time, orange through 3.5× optimal, red after;
- green clear +50%, orange +25%, red +0%;
- intermediate level-clear is not terminal Game Over;
- level-1 ceiling pressure begins no earlier than 60 s, current target 65 s;
- Armor from level 8, Star from 18, Prism from 35;
- Bomb from level 10 capped around 3%, Color Wipe from 22 capped around 2%;
- every fifth consecutive popping shot awards one deferred Bomb without overwriting a rare queued shot;
- collision/aim hot paths use local `nearbyBubbles()` lookup;
- launched shot speed remains 3× baseline with distance sub-stepping;
- cached bubble/chibi/background rendering remains in place;
- no `queue.shift()` regression in graph traversal.

Bubble resumable state MUST preserve and validate `boardMeta.signature`, grid, current/next shot, pressure state, level timer/baseline and intermediate level-clear state when applicable.

Run `node scripts/validate-bubble-burst.mjs` after Bubble changes.

## 7. Solitario source of truth

Authoritative files:

- `games/solitaire/variants.js` — rules registry;
- `games/solitaire/card-art.js` — card rendering;
- `games/solitaire/game.js` — gameplay and logical snapshot implementation;
- `games/solitaire/session-adapter.js` — current persistence compatibility/version wrapper;
- `docs/SOLITAIRE.md` — detailed contract.

Current game is classic Klondike draw-one:

- one 52-card deck;
- seven tableau columns;
- four foundations;
- alternating descending tableau;
- King-only empty tableau;
- same-suit ascending foundations;
- Undo history up to current runtime limit;
- classic/essential card styles, essential default.

### Resumable-hand invariants

- Logical snapshot includes variant, stock, waste, foundations, tableau, moves, score and elapsed time.
- Undo history is not persisted unless explicitly reviewed.
- Validation requires exactly 52 unique canonical cards and legal visibility/foundation structure.
- Resuming MUST NOT increment the deal counter.
- Win clears the unfinished snapshot.
- Every move, stock draw/recycle and Undo marks the session dirty.
- Current persistence wrapper exposes adapter version 2 and compatibility `solitaire-klondike-state-v2-52cards-draw1`.
- Shared session bootstrap comes only from `game-hud.js`; do not re-add page-local `../../rwg-session.js` or CSS.

Run `node scripts/validate-solitaire.mjs` after Solitario changes.

## 8. Rendering and performance

Current architecture intentionally uses JavaScript + Canvas 2D for arcade games and DOM/CSS where appropriate for Solitario.

Do not port whole games to WebAssembly without measured evidence. WASM is justified only for isolated numeric hot loops after profiling. Keep Canvas, DOM, Pointer Events, Device Orientation, Web Audio and storage in JavaScript. See `docs/WASM-EVALUATION.md`.

## 9. Regression guardrail workflow

Before a change is considered complete, run:

```bash
node scripts/validate-contracts.mjs
```

The repository-wide validator checks every JavaScript file with `node --check` and invokes specialized validators, including mandatory session coverage.

When relevant also run directly:

```bash
node scripts/validate-session.mjs
node scripts/validate-bubble-burst.mjs
node scripts/validate-solitaire.mjs
```

Do not weaken a validator merely to make a failing implementation pass. If a validator is brittle because it depends on formatting rather than semantics, make the assertion semantic while preserving the invariant.

Static validation does not replace browser smoke testing. Changed games must be tested for start, pause/resume, terminal flow, free unfinished-run resume, No/fresh-start behavior, one-credit Continue where applicable, sharing and mobile orientation.

## 10. Adding a new game

A new game is incomplete until it:

1. lives under `games/<slug>/`;
2. uses `data-rwg-game="true"`;
3. loads game modules, then a complete versioned `RWGResumeAdapter`, then `game-hud.js`, then `orientation.js`;
4. uses shared Game Over when terminal;
5. supports shared credit Continue if terminal continuation is appropriate;
6. saves/restores unfinished progress through `RWGSession`;
7. validates corrupt/incompatible snapshots and exposes a meaningful compatibility token;
8. passes `node scripts/validate-contracts.mjs`;
9. passes runtime smoke tests for resume Yes/No and stale-snapshot invalidation;
10. is added to human-facing README/home navigation as appropriate.

The autosave/resume requirement is permanent platform infrastructure, not a per-game feature flag.


## Social sharing contract — REQUIRED

Every current and future public page must expose static Open Graph + Twitter/X metadata; social crawlers must not rely on JavaScript. The global fallback is `assets/social/retrowebgames-cover-1280.jpg`. Future game-specific covers belong under `assets/social/games/<slug>.jpg` and may override only that game's image metadata. Keep absolute production HTTPS URLs and `twitter:card=summary_large_image`. See `docs/SOCIAL-SHARING.md` and run `node scripts/validate-social-sharing.mjs`.

The social validator inventory must cover home, every standalone public page (currently `/avatar/`) and every game page. Adding a public HTML route without validator discovery is a regression.


## Analytics contract — CRITICAL

- GA4 is centralized in `rwg-analytics.js` with measurement ID `G-ZSWLC4L8GW`.
- Games inherit Analytics through mandatory `game-hud.js`; do not embed Google tag snippets in game engines/pages.
- Hub/avatar load the same shared module directly.
- Common funnel events (start, resume, Continue, level, end, engagement, exit, share, install) belong in the shared module.
- Never send email, names, browser/profile fingerprints, payment identifiers, saved-game payloads or free-form user content to Analytics.
- Any future game must remain measurable through shared lifecycle/HUD contracts; new marketing-relevant semantics should be exposed centrally rather than by duplicating GA code.
- See `docs/ANALYTICS.md` and `scripts/validate-analytics.mjs`.
