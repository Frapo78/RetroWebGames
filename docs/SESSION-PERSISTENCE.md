# RetroWebGames — resumable session persistence

## Status

Resumable unfinished-run persistence is a mandatory platform contract for **every RetroWebGames game**, current and future.

The shared implementation lives in:

- `rwg-session.js`
- `rwg-session.css`
- bootstrap: `game-hud.js`
- repository guard: `scripts/validate-session.mjs`

A game must never implement its own storage namespace, resume modal, lifecycle listeners or autosave scheduler.

## User contract

If a game has an unfinished run and the user:

- closes or crashes/restarts the browser/app;
- reloads the page;
- backgrounds the page long enough for the browser to discard it;
- deliberately leaves the game for the RetroWebGames menu or another normal link;

then opening that game again must offer the shared modal:

> Vuoi continuare la partita precedente?

Actions are intentionally ordered:

- **No** — red, left: discard the old snapshot and immediately start a fresh run.
- **Sì** — green, right: restore the saved unfinished run.

This resume is free. It is **not** the one-credit `Continue` offered after terminal Game Over.

## Central storage envelope

Current namespace:

`rwg.session.v2:<game-id>`

Envelope schema: `2`.

Each stored envelope contains:

- platform envelope schema;
- game id;
- adapter version;
- adapter compatibility token;
- save timestamp/reason;
- game-owned logical payload.

The previous `rwg.session.v1:*` namespace is deliberately removed when an adapter registers. No v1 snapshot is silently migrated into v2.

## Automatic invalidation

A saved run is restorable only when **all** checks pass:

1. platform envelope schema matches;
2. saved `gameId` matches the adapter;
3. `adapterVersion` matches exactly;
4. saved compatibility token matches exactly;
5. the current adapter's semantic `validate(payload, envelope)` returns true.

If any check fails, the snapshot is removed and is not offered to the user.

### Compatibility-token rule

Every adapter MUST expose a non-empty `compatibility` string.

Change that token whenever an engine change can make an old logical snapshot unsafe or semantically different, including changes to:

- board/map dimensions;
- campaign/level catalogue identity;
- boss/config semantics;
- physics/state units;
- state-machine phases;
- card/deck rules;
- object schemas;
- scoring/progression state required to resume correctly.

Do not bump it for purely cosmetic changes that leave the logical snapshot fully compatible.

Deterministic content should add stronger semantic checks when possible. Examples currently implemented:

- Bubble Burst stores and validates the current deterministic layout signature;
- Star Swarm validates current campaign signature and boss identity;
- Solitario validates exactly 52 unique canonical cards plus legal foundations/tableau visibility;
- fixed-grid games validate their dimensions, coordinates and object types.

## Mandatory adapter API

Every game must expose, before `game-hud.js` loads:

```js
window.RWGResumeAdapter = Object.freeze({
  id: 'game-slug',
  version: 1,
  compatibility: 'game-state-v1-some-semantic-contract',
  isInProgress,
  serialize,
  validate,
  restore,
  startFresh,
  describe // optional
});
```

Required functions:

- `isInProgress()` — true whenever there is unfinished user progress worth resuming, including legitimate pause/intermission states;
- `serialize()` — returns a small JSON-serializable logical snapshot;
- `validate(payload, envelope)` — rejects corrupt, impossible or incompatible state;
- `restore(payload, envelope)` — reconstructs the run and returns `false` on failure;
- `startFresh()` — starts a genuine new run after the user chooses No;
- `describe()` — optional compact metadata for the resume modal.

An adapter may live inside the game engine or in a small game-local `session-adapter.js` when the engine already exposes a stable state object. The adapter must not own storage or modal UI.

## Autosave scheduling and performance

Shared defaults:

- dirty-save debounce: **750 ms**;
- heartbeat checkpoint: **5 seconds**;
- heartbeat prefers `requestIdleCallback`, with fallback scheduling;
- hard snapshot limit: **384 KiB**;
- unchanged payloads are not rewritten unnecessarily.

Games should call `RWGSession.markDirty()` only after meaningful logical mutations. Continuous games rely on the heartbeat for moving positions/velocities between discrete mutations.

Forced synchronous checkpoints are intentionally used for rare lifecycle boundaries where losing progress would be worse than a tiny write cost:

- `visibilitychange` → hidden;
- `pagehide`;
- `beforeunload`;
- page `freeze` where available;
- normal same-tab link navigation;
- explicit pause checkpoints where a game opts in.

Never write localStorage once per animation frame.

## What belongs in a snapshot

Persist authoritative logical gameplay state, for example:

- board/map contents;
- player/entity positions and velocities needed for continuity;
- score, level, lives, clocks and progression;
- active pickups/status effects whose loss changes gameplay;
- deterministic level identity/signature;
- current state-machine phase;
- current/next pieces, cards, shots or equivalent state.

Do **not** persist reconstructable visual/runtime data by default:

- particles;
- starfields;
- motion trails;
- Canvas sprite/gradient caches;
- DOM nodes;
- AudioContext/oscillators;
- transient pointer objects;
- large Undo/history rings unless explicitly justified.

## Completion semantics

`rwg-session.js` automatically clears unfinished snapshots on:

- `rwg:game-ended` — terminal run ended and shared Game Over owns the next flow;
- `rwg:session-completed` — successful non-Game-Over completion, for games such as Solitario victory when explicitly dispatched/cleared by the game.

Starting a fresh run should also clear/replace the previous unfinished snapshot.

Do not confuse:

- **resume after leaving/reload/crash** → free `RWGSession` restore;
- **Continue after Game Over** → `RWGContinueProvider`, one credit, `rwg:continue-game`.

## Current coverage

All current games are required to expose a resume adapter:

- Star Swarm
- Bubble Burst
- Block Drop
- Maze Munch
- Neon Rally
- Neon Snake
- Neon Tilt
- Solitario

`game-hud.js` boots the central service for every `data-rwg-game="true"` page.

## Future-game enforcement

`node scripts/validate-session.mjs` does **not** use a manually maintained list of games.

It discovers every `games/*/index.html` that has `data-rwg-game="true"`, reads the local scripts loaded before `../../game-hud.js`, and requires a conforming `RWGResumeAdapter` with version, compatibility token and the complete adapter contract.

Therefore a new game that omits resumable persistence fails validation automatically.

The repository-wide validator invokes this validator, so normal validation remains:

```bash
node scripts/validate-contracts.mjs
```

Direct session validation is also available:

```bash
node scripts/validate-session.mjs
```

## Required runtime smoke tests

Static validation cannot prove browser persistence behavior. For each new/changed adapter test at least:

1. start a run and make meaningful progress;
2. reload → choose Sì → verify exact logical continuation;
3. leave through the menu → reopen → choose Sì;
4. repeat and choose No → verify a fresh run;
5. pause/background/reopen path;
6. terminal Game Over or successful completion → verify no stale resume prompt;
7. intentionally corrupt/version-mismatch a stored snapshot → verify safe discard rather than crash.
