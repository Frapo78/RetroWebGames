# RetroWebGames — resumable session persistence

## Status

Resumable unfinished-run persistence is mandatory for every current and future RetroWebGames title.

Authoritative shared implementation:

- `rwg-session.js` / `rwg-session.css`;
- bootstrap through `game-hud.js`;
- `docs/SESSION-PERSISTENCE.md` (this file);
- `scripts/validate-session.mjs`;
- pause-specific terminal guard also covered by `scripts/validate-shared-pause.mjs`.

A game must never implement its own storage namespace, resume modal, lifecycle listeners or autosave scheduler.

## User contract

If a genuine unfinished run survives reload, browser/app closure, background discard or normal navigation, reopening that game offers:

> Vuoi continuare la partita precedente?

- **No**: discard the old snapshot and start a genuine fresh run.
- **Sì**: restore the exact saved unfinished run.

This free restore is separate from one-credit Game Over Continue.

A run that has been deliberately and finally terminated MUST NOT be offered for resume.

## Storage envelope

Namespace: `rwg.session.v2:<game-id>`.

Envelope schema: `2`.

Stored envelope includes platform schema, game id, adapter version, compatibility token, save timestamp/reason and the game-owned logical payload. Obsolete `rwg.session.v1:*` data is discarded when an adapter registers.

## Adapter contract

Every game exposes before `game-hud.js`:

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

Semantics:

- `isInProgress()` is true whenever meaningful unfinished progress exists, including legitimate pause/intermission states;
- `serialize()` returns compact authoritative logical state;
- `validate()` rejects corrupt/impossible/incompatible state;
- `restore()` reconstructs exact logical progress;
- `startFresh()` creates a real new run after the user rejects resume;
- `compatibility` changes whenever old snapshots become semantically unsafe.

## Automatic invalidation

A snapshot is restorable only if all match: platform envelope schema, game id, adapter version, adapter compatibility token and current semantic validation. Any mismatch removes the snapshot rather than attempting an unsafe repair.

Deterministic games should validate content identity/signature too. Existing examples include Bubble Burst layout identity, Star Swarm campaign/boss identity, Solitario canonical deck semantics and Prism Breaker level/boss identity.

## Autosave scheduling

Shared defaults:

- dirty-save debounce: 750 ms;
- heartbeat: 5 seconds;
- `requestIdleCallback` where available;
- lifecycle checkpoints on hidden, `pagehide`, `beforeunload`, `freeze` and same-tab navigation;
- hard snapshot limit: 384 KiB;
- redundant payloads are not rewritten unnecessarily.

Games call `RWGSession.markDirty()` on meaningful logical mutations. Never write storage once per frame.

Persist gameplay authority only: board/map state, score/progression, positions/velocities required for continuity, lives, clocks, active gameplay effects and deterministic content identity. Do not persist particles, trails, Canvas caches, DOM nodes, AudioContext or pointer objects.

## Terminal suppression — CRITICAL

A terminal run must be impossible to re-save after its snapshot was cleared.

Without a guard this race is possible:

1. user confirms `TERMINA PARTITA`;
2. shared code deletes `rwg.session.v2:<game-id>`;
3. reload begins while the engine still reports `isInProgress() === true`;
4. `beforeunload` or `pagehide` performs a checkpoint;
5. the deleted run is written again;
6. the next load incorrectly asks to resume the terminated run.

`RWGSession` therefore maintains a central `terminalSuppressed` state.

### Entering terminal suppression

Suppression is activated by:

- `rwg:game-ended`;
- `rwg:session-completed`;
- explicit `RWGSession.terminate(reason)` from shared infrastructure.

When active, the service clears pending timers and current snapshot, rejects dirty saves, heartbeat writes and all forced lifecycle writes, and keeps suppression active through unload/reload.

### Leaving terminal suppression

Saving is re-enabled only when gameplay becomes live again through a shared lifecycle:

- `rwg:game-session-start` for a genuine new run;
- fresh adapter registration on a new page instance;
- `RWGSession.beginRun()` when shared infrastructure intentionally starts a run;
- `rwg:continue-game` when one-credit Continue revives a run after Game Over.

Credit Continue deliberately keeps the same competitive leaderboard run id, but resumable persistence must become active again for the revived gameplay.

Do not reset suppression merely because an intro overlay is visible. A playable run must actually begin or continue.

### Ownership rule

Games MUST NOT implement their own terminal-save flag. Star Swarm, Solitario and all future games rely on the same `RWGSession` protection.

## Pause semantics

A normal pause remains unfinished progress and therefore remains resumable. Pausing must not trigger terminal suppression.

The shared Pause Menu may checkpoint the run while paused. Only the final confirmed `TERMINA PARTITA` becomes terminal. See `docs/PAUSE-MENU.md`.

## Completion semantics

`rwg-session.js` clears and suppresses further saves for terminal Game Over, deliberate shared pause termination and successful non-Game-Over completion.

Starting a fresh run creates a new session lifecycle. Credit Continue revives the existing run and re-arms autosave without creating a new leaderboard run.

Do not confuse:

- free unfinished-run restore → `RWGSession`;
- one-credit Game Over Continue → `RWGContinueProvider` / `rwg:continue-game`.

## Current coverage

All current games must expose a valid adapter: Star Swarm, Bubble Burst, Block Drop, Maze Munch, Neon Rally, Neon Snake, Neon Tilt, Solitario and Prism Breaker.

## Future-game enforcement

`scripts/validate-session.mjs` discovers `games/*/index.html` dynamically and requires a conforming adapter loaded before `game-hud.js`. New games without session persistence fail repository validation automatically.

## Validation

```bash
node scripts/validate-session.mjs
node scripts/validate-shared-pause.mjs
node scripts/validate-contracts.mjs
```

Runtime smoke tests must include:

1. progress → reload → Sì → exact continuation;
2. progress → navigation → reopen → Sì;
3. progress → reload → No → genuine fresh run;
4. pause/background/reopen;
5. terminal Game Over → reload → no stale prompt;
6. successful completion → reload → no stale prompt;
7. pause menu `TERMINA PARTITA` → immediate reload → no stale prompt;
8. pause termination followed immediately by `beforeunload/pagehide` → no snapshot recreation;
9. Game Over → credit Continue → background/reload → continued run is resumable;
10. corrupt/version-mismatched snapshot → safe discard.
