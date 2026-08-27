# WebAssembly evaluation

## Decision

Do not rewrite RetroWebGames or Star Swarm wholesale in WebAssembly at the current scale.

Current architecture remains JavaScript + Canvas 2D because most browser-facing work still lives in JavaScript/browser APIs:

- Canvas drawing;
- DOM/HUD updates;
- Pointer Events;
- Device Orientation;
- Web Audio;
- local/session storage;
- shared Game Over/profile/avatar UI.

Moving the entire runtime to WASM would not remove those boundaries and would increase build complexity, debugging cost and JS↔WASM data transfer.

## Current Star Swarm workload

Typical hot work per frame is still modest:

- tens of enemies;
- dozens to low hundreds of projectiles/hazards in ordinary play;
- simple circle/segment collision tests;
- Canvas 2D rendering;
- lightweight AI/state machines.

That workload is not, by itself, a reason to introduce Rust/C/C++ + WASM.

## When WASM becomes justified

Profile on representative mobile hardware first. Consider extracting a numeric core only if one or more of these are repeatedly true:

- simulation/collision work alone exceeds roughly 3–4 ms per 16.7 ms frame;
- sustained projectile counts move into several hundreds/thousands;
- broad-phase collision, pathfinding or physics becomes the dominant CPU cost;
- garbage collection caused by JS entity churn becomes a measured frame-time problem;
- a compute-heavy system can be expressed as contiguous numeric arrays and processed in batches.

## Best future WASM boundary

If needed, move only a deterministic numeric subsystem, for example:

```text
JavaScript
  input + state orchestration
       ↓ typed arrays / batched command buffer
WASM
  movement integration
  broad-phase collision
  projectile/target hit resolution
       ↓ compact result buffers
JavaScript
  Canvas rendering
  DOM/HUD
  audio
  profile/credits/game-over
```

Rules for a future WASM module:

- prefer Structure-of-Arrays / TypedArrays;
- batch one/few calls per frame;
- avoid per-entity JS↔WASM calls;
- keep object allocation outside inner loops;
- benchmark against the current JS implementation on actual phones;
- do not merge a WASM port that is merely equal/slower while being harder to maintain.

## Near-term performance work before WASM

Prefer these optimizations first:

1. pool projectile/particle objects if GC is measured;
2. use spatial bucketing only when entity counts justify it;
3. reduce Canvas state changes/shadow operations if rendering becomes expensive;
4. cap devicePixelRatio where appropriate (already common in the project);
5. avoid repeated DOM writes inside frame loops;
6. profile with browser Performance tools before changing architecture.

## Neon Tilt

The same decision applies to Neon Tilt. Its physics is intentionally isolated so it can be ported later if profiling shows a real bottleneck. A single ball plus maze collision is currently far below the complexity that merits WASM.

## Audit measurement — 2026-08-27

A five-second Chrome-for-Testing headless run at 390×844 measured approximately:

| Game | RAF frames | Script time / frame | JS heap delta |
|---|---:|---:|---:|
| Star Swarm | 302 | 0.68 ms | +1.06 MiB |
| Neon Tilt | 290 | 1.54 ms | -0.16 MiB |

These are VPS/headless measurements, not representative-phone benchmarks, and the broader browser task duration includes headless rendering overhead. The script-time figures are nevertheless below the 3–4 ms/frame investigation threshold, so this audit found no evidence that a WASM core would improve the current games. JavaScript + Canvas 2D remains the deliberate architecture.
