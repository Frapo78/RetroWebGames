# RetroWebGames — object-oriented game runtime architecture

## Status

Reference pattern for game runtimes, established by **The Great Empire** (2026-09-02), the first game written this way. It is the model the TODO migration follows for existing games; it is **not** a framework, and no game is required to mirror it file for file.

Authoritative companions: `AGENTS.md`, `ARCHITECTURE.md`, `SESSION-PERSISTENCE.md`, `PAUSE-MENU.md`, `THE-GREAT-EMPIRE.md`.

## The problem it solves

The older runtimes are single files that own state, rules, rendering, input, audio and platform wiring together. They work, but they are hard to profile, hard to test without a browser, and easy to break: any change can reach any value.

## The shape

```text
game.js        composition root — wiring, platform contract, shell
  levels.js    content and balance          (pure)
  state.js     authoritative logical state  (no DOM)
  systems.js   simulation                   (no DOM)
  snapshot.js  serialization/validation     (pure)
  renderer.js  presentation                 (reads state, never writes)
  input.js     interaction                  (produces orders, never values)
```

Rules that make the split real rather than cosmetic:

1. **One direction of authority.** Input produces *orders*; systems apply them; the renderer only reads. A renderer that mutates a score, or an input handler that assigns lives, is a defect — not a shortcut.
2. **Orders are the only entry point.** All external mutation goes through one exported `orders` object. When every write funnels through one place, "who changed this?" stops being a question.
3. **The DOM stops at the composition root.** Everything below it can run in `node:vm`. That is what lets the specialized validator play entire matches headlessly.
4. **Fixed timestep.** Simulation advances in fixed steps with a bounded accumulator, so behaviour does not depend on frame rate and a backgrounded tab cannot fast-forward the game on wake-up.
5. **Preallocated pools, no hot-path allocation.** Entity slots are created once and recycled through a free list; a per-tick event sink is a single reused object. A match allocates nothing per frame.
6. **Platform integration stays thin.** Session, pause, Game Over, leaderboards and analytics are RetroWebGames services. The root emits and listens; it never reimplements.

## What this deliberately is not

- No `BaseGame → ArcadeGame → ShooterGame` hierarchy.
- No generic ECS, no dependency-injection container, no event bus for internal calls.
- No class per particle, no getters on hot-path coordinates.
- No shared super-framework: each game composes what its genre needs.

## Choosing structure over cleverness

Optimize what a measurement showed, not what looks slow. The Great Empire uses a linear scan for proximity queries because a match holds at most a few dozen units; a spatial index there would add complexity with nothing behind it. The same rule applies in reverse: when a profile does show a hot loop, a typed array or a data-oriented layout is the right answer, and it goes in the system that owns that loop, not in a global utility.

## Testability is the payoff

Because rules, state, simulation and serialization are DOM-free, `scripts/validate-the-great-empire.mjs` can:

- prove the campaign is deterministic and escalates;
- play a full match to victory and another to defeat;
- assert the unit pool is reused with no leaked slots;
- round-trip a snapshot and refuse thirteen tampered variants.

None of that needs a browser, and none of it can be faked by a source grep. Browser smoke tests then cover only what genuinely needs a browser: layout, touch and the shared platform surfaces.

## Adopting it in an existing game

Migrate one game at a time, never mixing an architecture change with a balance or UI change in the same step. Keep the resume `compatibility` token unchanged when the authoritative payload stays semantically identical; change version, token, docs and validator together when it does not. See `TODO.md` for the ordered plan and its acceptance gates.
