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

1. use `<body data-rwg-game="true" data-rwg-game-name="Short Game Name">`, where the second attribute is the short player-facing identity and never the SEO title;
2. load its own runtime/modules before shared bootstrap;
3. expose a complete `window.RWGResumeAdapter` before `../../game-hud.js` loads;
4. load `../../game-hud.js`;
5. load `../../orientation.js` after the HUD;
6. use shared profile/wallet/game-over/session/pause/orientation infrastructure instead of local copies.

Shared root services include:

- `rwg-profile.js` / `rwg-profile.css` — anonymous profile, local prototype wallet, credits, statistics;
- `rwg-avatar.js` / `rwg-avatar.css` — avatar identity;
- `rwg-session.js` / `rwg-session.css` — mandatory unfinished-run autosave, validation, lifecycle flush and resume prompt;
- `rwg-pause-menu.js` / `rwg-pause-menu.css` — **mandatory shared pause UI, active-play timing, double-confirm run termination and interrupted-run leaderboard eligibility**;
- `game-hud.js` / `game-hud.css` — shared navigation/bootstrap;
- `game-over.js` / `game-over.css` — terminal GAME OVER, metrics, achievements, sharing and credit Continue;
- `orientation.js` / `orientation.css` — portrait guard and resume countdown.

Game-local code may expose game-specific state/adapters and the actual pause state transition. It MUST NOT own the `localStorage` session namespace, autosave scheduler, lifecycle flush listeners, resume modal, pause overlay, pause termination confirmation flow, pause active-time eligibility logic or a pause-specific leaderboard submission path.

`game-hud.js` automatically boots shared platform infrastructure. A game must not duplicate shared assets in its page.

Tutorial, level-clear and boss-clear overlays may remain game-specific because they represent game mechanics. **Pause is no longer in that category.** A local pause overlay is forbidden. `games/solitaire/pause-overlay.js` is a legacy no-op shim, not a pattern to copy.

### 2A. Shared pause contract — CRITICAL AND MANDATORY

Before any pause-related modification or before adding a game, agents MUST read `docs/PAUSE-MENU.md`. That document is the detailed source of truth.

Every current and future game MUST:

- expose a usable `#pauseBtn` whose paused state is externally observable as `▶` and/or aria-label `Riprendi`;
- keep `RWGResumeAdapter.isInProgress()` true during a legitimate pause;
- let the shared pause component own pause presentation;
- let the shared component resume through the game's existing pause transition rather than mutating private engine state;
- use the centralized 45-second active-play minimum for manually terminated-run leaderboard eligibility;
- have an explicit centralized per-game score threshold for interrupted-run eligibility;
- preserve the two-stage `TERMINA PARTITA` confirmation;
- preserve `RWGSession`, shared leaderboard and Game Over contracts.

When adding a future game, the agent MUST add an appropriate score threshold to the centralized pause policy and update `docs/PAUSE-MENU.md`. Do not copy thresholds into the game runtime.

When a requested pause feature is useful across games, implement it in `rwg-pause-menu.js` / `.css`. Do not create a local shortcut because it is faster.

Forbidden regressions include:

- game-local pause modal/overlay/CSS;
- reusing the local intro `#overlay` as ordinary pause UI, which hides the shared dock on mobile;
- one-click destructive termination;
- native `window.confirm()` as a replacement for the shared double-confirm flow;
- game-local active-time counters for interruption eligibility;
- direct leaderboard API calls from pause/game code;
- clearing `rwg.session.v2:*` merely because a run is paused;
- using shared Game Over as the ordinary pause screen.

After pause-related work run at minimum:

```bash
node scripts/validate-shared-pause.mjs
node scripts/validate-session.mjs
node scripts/validate-leaderboards.mjs
node scripts/validate-contracts.mjs
```

Also run the target game's specialized validator when present and perform browser smoke tests described in `docs/PAUSE-MENU.md`.

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

Shared `game-over.js` MUST retain its centralized GAME OVER presentation, statistics, achievements, sharing, credit Continue, replay and game-selection actions. Games MUST NOT implement local nickname prompts or terminal substitutes.

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

Shared `rwg-session.js` owns storage namespace `rwg.session.v2:<game-id>`, envelope/schema validation, adapter compatibility, dirty-save debounce, heartbeat, lifecycle checkpoints, snapshot-size guards, redundant-write suppression, resume UI and terminal clearing.

Every game MUST expose before `game-hud.js`:

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

`isInProgress()` must remain true for meaningful unfinished progress, including legitimate pause/intermission states. Persist authoritative logical state only; never write storage once per animation frame. See `docs/SESSION-PERSISTENCE.md`.

`scripts/validate-session.mjs` dynamically discovers every game and rejects future games without this contract.

## 4B. Avatar / player identity — SHARED AND REGRESSION-CRITICAL

`rwg-avatar.js` / `.css`, `/avatar/`, `docs/AVATAR.md` and `scripts/validate-avatar.mjs` are authoritative. Do not create game-local avatar renderers or remove migration compatibility.

## 4C. Game social covers and wordmarks

Every game must retain both `assets/social/games/<slug>.jpg` (1200×630 JPEG) and a separate `assets/brand/games/<slug>-wordmark.png` (1200×300 transparent PNG). Game HTML must expose the dedicated cover through static Open Graph, Twitter/X and JSON-LD metadata; social crawlers must never depend on JavaScript or fall back to the generic home cover.

The initial screen of every game must also render that same dedicated 1200×630 cover inside `h1.rwg-intro-cover-title`, with the canonical game name as the image `alt`. Keep the responsive implementation centralized in `game-hud.css`; do not restore a font-rendered local intro title.

Every game intro must expose exactly one `.rwg-intro-leaderboard-slot` in place of descriptive caption copy. The shared leaderboard replaces that slot with the dynamically viewport-fitted High Scores board. Engines that retain an `#overlayText` reference must use an empty `.rwg-intro-runtime-copy` status node; never delete the node blindly or restore visible intro prose.

Every game also owns `assets/covers/games/<slug>-portrait.jpg` (1080×1920) and its `-portrait-540.jpg` responsive derivative. Home cards must load these through `rwg-lazy-images.js`; do not restore procedural CSS thumbnails or eagerly download every full-size portrait. The card's semantic `h2` must render the matching wordmark through that same loader and retain the canonical game name as a non-empty image `alt`.

`scripts/seo-catalog.mjs`, `scripts/apply-seo.mjs`, `docs/SOCIAL-SHARING.md`, `docs/LAZY-IMAGES.md`, `scripts/validate-social-sharing.mjs` and `scripts/validate-lazy-images.mjs` form the authoritative contract. Do not replace the home wordmark heading with plain text or make its accessible name empty.

## 4D. Responsive dock geometry and asset revisions — REGRESSION-CRITICAL

The shared bottom dock is an occupied viewport region, not a decorative overlay. Simulation canvases, gesture hints, virtual joysticks and game-specific controls must end above `--rwg-common-dock-reserve`, including Android browser/navigation insets. In particular, Neon Snake must keep playfield, hint, joystick/Turbo and dock disjoint; Neon Rally must size its actual canvas above the dock so the player paddle remains visible. Never hide a collision with z-index or paint gameplay underneath the dock.

Game pages load `game-hud.js` and `orientation.js` with one matching release query. Those bootstraps propagate that query to dynamic shared dependencies. When shared UI changes, bump the query across every game page; version any directly changed local CSS/JS too. Do not rely on the service worker cache name alone, because the browser HTTP cache can otherwise produce a mixed-generation UI. `docs/SHARED-HUD-CONTROLS.md` and `scripts/validate-shared-controls.mjs` are authoritative.

## 5. Game-specific sources of truth

Before modifying a game, read its dedicated documentation when present. Important current contracts include:

- `docs/STAR-SWARM.md`;
- `docs/BUBBLE-BURST.md`;
- `docs/SOLITAIRE.md`;
- `docs/PRISM-BREAKER.md`;
- `docs/NEON-SNAKE.md`.

Game-specific documentation may define mechanics, content, physics, rendering and semantic snapshot validation. It cannot override shared pause/session/Game Over/leaderboard contracts unless the platform documentation and validators are intentionally changed in the same work.

For Solitario specifically, `games/solitaire/pause-overlay.js` must remain a compatibility no-op while referenced. Do not restore its old local pause implementation.

### Star Swarm offensive axes — CRITICAL

Do not conflate these two systems.

- **Weapon Upgrade** controls firing pattern/type progression and has exactly **8 firing forms**: SINGLE FIRE, DOUBLE FIRE, TRIPLE DIAGONAL FIRE, 4 FIRE LINEAR, FIREBALLS 3 WAY, LASER, 3 WAY LASERS and 5 WAY LASERS.
- **POWER** controls per-projectile damage strength. POWER range: **1..20**, with twenty projectile colors and independent progression from Weapon.

Life loss without Shield reduces Weapon by two forms and POWER by two levels. Lasers continue through normal enemies and each laser projectile damages a given target at most once unless the mechanic is intentionally redesigned together with documentation and validators. Detailed campaign, boss and drop-rate invariants remain authoritative in `docs/STAR-SWARM.md`.

## 6. Rendering and performance

Current architecture intentionally uses JavaScript + Canvas 2D for arcade games and DOM/CSS where appropriate for Solitario.

Do not port whole games to WebAssembly without measured evidence. WASM is justified only for isolated numeric hot loops after profiling. Keep Canvas, DOM, Pointer Events, Device Orientation, Web Audio and storage in JavaScript. See `docs/WASM-EVALUATION.md`.

### Bubble Burst launcher crew

Bubble Burst launcher characters are raster atlases aligned with the social-cover identity. Preserve the four emotional poses, decoded-image cache, shared trajectory-driven pupils and transform-only breathing/reaction animation. Do not restore procedural character bodies, allocate canvases/images per frame or duplicate aim prediction for eye tracking.

## 7. Regression guardrail workflow

Before a change is considered complete:

1. read `AGENTS.md`, `docs/ARCHITECTURE.md` and all source-of-truth docs for the affected shared/game systems;
2. inspect existing shared implementations before adding code;
3. prefer extending shared components over local duplication;
4. update documentation and validators whenever a contract changes;
5. run repository-wide and relevant specialized validators locally;
6. perform browser/device smoke tests for behavior static validators cannot prove.

Do not introduce GitHub Actions as a substitute for required local validation.

Core validation entrypoint:

```bash
node scripts/validate-contracts.mjs
```

Pause-related work additionally requires `node scripts/validate-shared-pause.mjs`.

## 8. Documentation authority map

Agents should resolve uncertainty from these documents before inventing behavior:

- `docs/ARCHITECTURE.md` — platform ownership/lifecycle;
- `docs/PAUSE-MENU.md` — **authoritative pause, active-time, termination and interrupted-run contract**;
- `docs/SESSION-PERSISTENCE.md` — unfinished-run storage/resume;
- `docs/LEADERBOARDS.md` — global ranking/submission;
- `docs/SHARED-HUD-CONTROLS.md` — shared HUD/control placement;
- `docs/AVATAR.md` — player identity;
- game-specific docs — gameplay invariants.

If code and these docs disagree, do not silently choose whichever is easier. Investigate the discrepancy and bring code, docs and validators back to one explicit contract.
