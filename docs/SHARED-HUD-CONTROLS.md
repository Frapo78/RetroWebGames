# Shared HUD and in-game controls

This document is the source of truth for common RetroWebGames in-game HUD and control ergonomics.

## Ownership

Platform-level controls are shared infrastructure. Games keep gameplay semantics and event handlers, but MUST NOT invent a competing visual language for common controls when the shared layer can represent them.

Authoritative shared files:

- `game-hud.js` / `game-hud.css` — shared game tools, profile/services and intro actions;
- `rwg-controls.css` — common in-game HUD/control sizing, visibility and positioning rules;
- `rwg-virtual-joystick.js` / `rwg-virtual-joystick.css` — reusable virtual analog joystick;
- `orientation.js` — mandatory page-level bootstrap currently responsible for loading the shared controls assets before applying handheld orientation gating.

Game runtimes remain authoritative for pause, mute, movement and game-specific action behavior. The shared layer reuses those contracts instead of duplicating gameplay logic.

## Visual hierarchy

Every game should follow this hierarchy as closely as its layout permits:

1. **Metrics HUD** — score, level, lives, time, combo, lines or other read-only run statistics.
2. **System controls** — return to games, share, audio and pause. These must remain visible, tappable and visually consistent.
3. **Game-specific status/actions** — examples: sensor state/calibration, Solitario Undo/Hint/New Deal, Neon Snake Turbo, Block Drop Rotate/Drop.
4. **Movement control** — shared virtual joystick where a visible directional pad/button cluster would otherwise exist.

A game-specific adaptation may move or compact a control, but it must preserve this hierarchy and must not make a common action harder to identify than in other games.

## Common controls

Common buttons use the shared minimum touch target, border radius, contrast, focus treatment and responsive sizing from `rwg-controls.css`.

- Return to games and Share remain owned by `game-hud.js` through `.rwg-game-tools`.
- `#pauseBtn` remains the canonical pause control because orientation and shared lifecycle code depend on it.
- `#muteBtn`, when the game has audio, remains the canonical audio toggle.
- Game-specific controls may stay alongside the common bar but must retain a separate visual role.

On narrow screens labels may collapse to icons to preserve the playfield, but the accessible `aria-label` remains mandatory.

## Virtual joystick

`window.RWGVirtualJoystick` is the only reusable on-screen directional-control component.

The component provides:

- normalized analog vector `x/y` in `[-1, 1]`;
- configurable dead zone;
- optional four-way/discrete direction resolution;
- configurable allowed directions;
- pointer capture and neutral reset on release/cancel;
- a shared `rwg:joystick-input` event carrying `{ x, y, active, direction, gameSlug }`;
- reusable mounting through `RWGVirtualJoystick.mount()`;
- automatic migration of known legacy directional button clusters.

Legacy direction buttons may remain in the DOM temporarily as an adapter target for existing game handlers, but they are visually hidden by the shared layer. New games must consume the shared joystick API/event directly instead of creating a new D-pad implementation.

## Current game mapping

### Maze Munch

The former four-button directional cluster is visually replaced by the shared joystick. Direction transitions are bridged to the existing `M.setDir()` handler through the legacy button adapter. Swipe and keyboard remain valid alternative inputs.

### Neon Snake

The former D-pad is visually replaced by the shared joystick. TURBO remains a separate game-specific hold action to the right of the stick. Swipe, arrow/WASD input and Shift Turbo remain available.

### Block Drop

Left/right/down movement moves to the shared joystick. Up is intentionally neutral because rotation is not movement. `RUOTA` and `DROP` remain separate game actions beside the stick. Existing repeat timing and keyboard/touch-on-board behavior remain authoritative.

### Neon Tilt

The shared joystick emits the full analog vector and feeds the existing `touchInput` path, preserving proportional gravity control. Device tilt remains the preferred sensor input when granted; keyboard remains available. The old local floating touch-stick visual is suppressed when the shared joystick is mounted.

### Pointer-native games

Star Swarm, Bubble Burst, Neon Rally, Prism Breaker and Solitario do not receive a movement joystick merely because they accept pointer or keyboard input. Their primary interactions are direct manipulation/aiming/dragging and should not be degraded into a directional pad abstraction.

## Responsive behavior

The common controls must not hide the playfield or fall outside the visual viewport.

- shared system controls use approximately 36–40 px targets depending on available height/width;
- the joystick is 104 px normally and contracts to 88 px on small/short screens;
- Block Drop reserves extra bottom stage space for joystick + actions;
- Neon Tilt reserves vertical space below the canvas for its persistent analog stick;
- Solitario keeps its game-specific action row but adopts the shared button geometry and common tools placement.

Any future layout exception belongs in `rwg-controls.css`, scoped by `data-rwg-game-name`, rather than in duplicated per-game common-control CSS.

## Validation

Run after changes to shared HUD/control behavior:

```bash
node --check rwg-virtual-joystick.js
node --check orientation.js
node --check games/neon-tilt/game.js
node scripts/validate-shared-controls.mjs
node scripts/validate-contracts.mjs
```

Browser smoke tests should cover at least 320×568, 390×844 and desktop width for every game. For Maze Munch, Neon Snake, Block Drop and Neon Tilt specifically verify joystick center/release, all permitted directions, edge/dead-zone behavior and simultaneous game-specific actions. Common Menu/Share/Audio/Pause controls must remain visible and reachable during active gameplay.
