# RetroWebGames architecture

## Goal

RetroWebGames is a static, mobile-first arcade platform. Individual games own gameplay simulation and rendering; platform-level identity, credits, resumable unfinished runs, game-over, sharing and orientation are shared.

Resumable unfinished-run persistence is mandatory for every current and future game.

## Dependency flow

```text
Game page
  ├─ game-specific runtime/modules
  ├─ game-specific RWGResumeAdapter
  ├─ game-hud.js
  │    ├─ rwg-session.js / rwg-session.css
  │    ├─ rwg-profile.js / rwg-profile.css
  │    ├─ rwg-avatar.js / rwg-avatar.css
  │    ├─ rwg-intro-share.js / rwg-intro-share.css
  │    └─ game-over.js / game-over.css
  └─ orientation.js / orientation.css
```

A game must never copy shared systems locally. It owns only the small logical persistence adapter and its gameplay-specific state.

`game-hud.js` is the centralized bootstrap for `RWGSession`; game pages must not separately load root `rwg-session.js` or `rwg-session.css`.

## Game lifecycle contract

### Start

Every page exposes a game-specific `#startBtn` and a complete `window.RWGResumeAdapter` before `game-hud.js` loads.

When no unfinished snapshot exists, normal start behavior is unchanged.

When a valid unfinished snapshot exists, `RWGSession` shows:

**“Vuoi continuare la partita precedente?”**

- `No` — red, left: discard the old snapshot and start a genuine fresh run.
- `Sì` — green, right: restore the saved run.

This restore is free and is not the one-credit Game Over Continue.

### Running

The game owns simulation state. Shared components may read stable DOM metrics such as score, level, best, lines and match score.

Games call `RWGSession.markDirty()` after meaningful discrete logical mutations. Continuous simulations rely on the shared heartbeat for moving position/velocity continuity between those mutations.

Never write persistence per animation frame.

## RWGSession v2

Shared `rwg-session.js` owns all persistence scheduling, storage and UI.

Current platform contract:

- namespace: `rwg.session.v2:<game-id>`;
- envelope schema: `2`;
- dirty-save debounce: 750 ms;
- heartbeat: 5 seconds;
- heartbeat prefers `requestIdleCallback`;
- lifecycle checkpoint on hidden, `pagehide`, `beforeunload`, `freeze` and normal same-tab navigation;
- unchanged payloads are not rewritten unnecessarily;
- snapshot-size limit: 384 KiB;
- obsolete `rwg.session.v1:*` snapshots are removed when an adapter registers.

A stored run is accepted only if all of these match:

1. platform envelope schema;
2. game id;
3. adapter version;
4. adapter compatibility token;
5. current semantic `adapter.validate(payload, envelope)`.

Any mismatch invalidates and removes the snapshot instead of attempting unsafe migration.

See `SESSION-PERSISTENCE.md` for the complete persistence contract.

## Game adapter contract

Every game exposes:

```js
window.RWGResumeAdapter = Object.freeze({
  id,
  version,
  compatibility,
  isInProgress,
  serialize,
  validate,
  restore,
  startFresh,
  describe // optional
});
```

Responsibilities:

- report whether meaningful unfinished progress exists;
- serialize minimum authoritative logical state;
- validate corruption and semantic compatibility;
- restore exact logical progress without counting it as a new run/deal;
- start cleanly after No;
- bump version and/or compatibility whenever an engine/content/state change makes old snapshots unsafe.

Persist logical gameplay state, not visual caches. Particles, trails, Canvas caches, starfields, AudioContext, DOM nodes and pointer objects should normally be reconstructed.

## Automatic invalidation examples

Current adapters add game-specific validation beyond the shared envelope:

- **Star Swarm** checks campaign signature and boss identity in addition to combat state;
- **Bubble Burst** persists and validates the current deterministic layout signature;
- **Block Drop** validates the 10×20 board, piece domains and 7-bag state;
- **Maze Munch** validates map pellet/power-node domains and actor state;
- **Neon Rally** validates first-to-7 match bounds and ball/paddle state;
- **Neon Snake** validates grid bounds, unique snake cells, obstacles and pickups;
- **Neon Tilt** validates level identity, physics state and collected shard indices;
- **Solitario** validates exactly 52 unique canonical cards and legal Klondike structure;
- **Prism Breaker** validates campaign, boss and deterministic physics contracts.

## Pause/orientation

Local pause overlays are allowed. Orientation guard may pause/resume around landscape mode. These are not terminal states.

A paused game remains an unfinished run and must remain eligible for persistence.

## Intermediate clear screens

Allowed examples:

- Star Swarm boss clear;
- Bubble Burst level clear;
- future mission/stage clears.

These pause or transition the game without triggering terminal Game Over. If the intermediate state itself contains meaningful progress, the adapter must represent it safely.

## Terminal Game Over

Authoritative terminal presentation lives in root `game-over.js` / `game-over.css`.

Game engine responsibilities:

1. commit final score/level/best values;
2. stop simulation;
3. make local replay state available (`RIGIOCA`) as fallback;
4. emit `rwg:game-ended`;
5. request `window.RWGGameOver.open()`.

`RWGSession` automatically clears unfinished-run persistence on terminal `rwg:game-ended`.

Shared Game Over owns:

- animated GAME OVER intro;
- metrics;
- achievements;
- sharing;
- one-credit Continue;
- replay;
- main menu.

## Credit Continue

`game-over.js` asks `RWGContinueProvider` for one credit. On success it dispatches `rwg:continue-game` with preserved score/metadata.

This is distinct from free `RWGSession` restore after reload/navigation.

## Successful non-Game-Over completion

A game that completes successfully without terminal GAME OVER, such as Solitario victory, must ensure the unfinished snapshot is cleared. `RWGSession` also understands `rwg:session-completed` as a shared completion signal.

## Profile / wallet

Current profile state is stored locally under `rwg.profile.v1` and contains a pseudonymous browser ID, credits, totals, per-game statistics and history.

This is a prototype persistence layer, not payment security. Future paid credits require server authority and an append-only/idempotent ledger.

## Avatar

`rwg-avatar.js` renders the shared avatar identity and `/avatar/` is the editor. Games consume shared identity instead of maintaining copies.

## Social metadata and intro sharing

Every public page, including `/avatar/`, owns a complete static Open Graph and Twitter/X metadata set. Game intro share controls are injected once by the shared `game-hud.js` bootstrap through `rwg-intro-share.js`; games must not duplicate them. `scripts/validate-social-sharing.mjs` discovers the home page, standalone public pages and game pages so omissions fail repository validation.

## SEO and generative discovery

`scripts/seo-catalog.mjs` is the canonical inventory for search-facing game identity. `scripts/apply-seo.mjs` projects it into unique HTML metadata and static Schema.org graphs; runtime JavaScript is never required by a crawler. The home graph connects `Organization`, `WebSite`, `WebPage` and the complete game `ItemList`; each game graph adds its authoritative `VideoGame` and breadcrumb. Structured facts must remain visible, accurate and supported by the product.

All game routes are indexable and permit large image/full snippet previews. `/avatar/` is a thin local editor and remains `noindex,follow`; `scripts/generate-sitemap.mjs` therefore excludes it and emits Git-derived `lastmod` dates for the ten canonical landing routes. Do not introduce hidden copy, keyword stuffing, doorway pages, fabricated ratings or `llms.txt` shortcuts. See `SEO-GEO.md` and run `node scripts/validate-seo-geo.mjs`.

## Future-game enforcement

`scripts/validate-session.mjs` dynamically discovers every `games/*/index.html` with `data-rwg-game="true"`.

For every discovered game it requires a conforming `RWGResumeAdapter` loaded before `game-hud.js`. Because discovery is filesystem-driven rather than list-driven, adding a new game without autosave/resume fails validation automatically.

The repository-wide validator invokes this guard.

## Static validation

Run:

```bash
node scripts/validate-contracts.mjs
```

Direct specialized checks:

```bash
node scripts/validate-session.mjs
node scripts/validate-bubble-burst.mjs
node scripts/validate-solitaire.mjs
node scripts/validate-prism-breaker.mjs
node scripts/validate-social-sharing.mjs
node scripts/validate-seo-geo.mjs
```

The validators cover architecture/invariants, not full gameplay correctness.

## Browser and production validation

The supported smoke matrix includes `/`, `/avatar/` and all game routes at common phone sizes plus desktop width.

For resumable persistence test at least:

1. start and make meaningful progress;
2. reload or return to menu;
3. reopen and choose Sì, verifying exact logical continuation;
4. repeat and choose No, verifying a fresh run;
5. background/pause and reopen;
6. terminal Game Over or successful completion, verifying no stale prompt;
7. intentionally stale/corrupt/version-mismatched storage, verifying safe discard rather than crash.

Neon Tilt production responses must allow accelerometer/gyroscope through `Permissions-Policy`, and real sensor behavior still requires a physical-device test.

## PWA installation flow

The home owns the install-acquisition layer. `pwa-install.js` captures `beforeinstallprompt`, shows the first-visit notice after 2 seconds only once, controls the persistent end-of-list card, hides both surfaces in standalone mode and detects iPhone and modern desktop-UA iPadOS, hides non-functional install buttons there and shows the system instructions directly. `sw.js` is root-scoped and network-first, caching successful same-origin responses only for offline fallback. UI lives in `pwa-install.css`; games and shared Game Over must not duplicate install prompts. See `docs/PWA-INSTALL.md`.

## Shared lazy-image layer

`rwg-lazy-images.js` is the reusable public-page image loader. Home images expose `data-rwg-src` rather than eager `src`, reserve width/height, and keep native lazy/async hints. A 280 px IntersectionObserver margin prefetches near-viewport images; the fallback loads immediately, while MutationObserver and `RWGLazyImages.observe(root)` cover dynamically inserted sections. See `docs/LAZY-IMAGES.md`.

## Server-backed global leaderboards

The static games use a narrowly scoped dynamic service without changing gameplay ownership:

```text
Game lifecycle → rwg-leaderboard.js → /api/leaderboards/v1/
                                      → rwg-leaderboard.service (127.0.0.1:3112)
                                      → MariaDB rwg_leaderboards
```

`game-hud.js` centrally boots the client. Shared Game Over emits normalized statistics; Solitario emits the successful-completion event directly. One run id spans credit Continue and unfinished-session resume, while a true new game starts a new id. The top 10 contains runs, and a current-device row outside the top 10 reports that anonymous player's best run.

The service is same-origin, rate-limited and idempotent. Browser telemetry remains untrusted input and is bounded/normalized before storage. Credentials and database state remain outside the public repository. See `LEADERBOARDS.md`.
