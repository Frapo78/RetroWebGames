# Shared HUD and in-game controls — AUTHORITATIVE CONTRACT

This document is the source of truth for common RetroWebGames in-game HUD and control ergonomics.

## Ownership

Platform-level controls are shared infrastructure. Games keep gameplay semantics and event handlers, but MUST NOT invent a competing visual language or placement scheme for common controls when the shared layer can represent them.

Authoritative shared files:

- `game-hud.js` / `game-hud.css` — shared game tools, profile/services and intro actions;
- `rwg-controls.css` — common in-game HUD/control sizing, visibility, dock placement and game-specific spacing adaptations;
- `rwg-virtual-joystick.js` / `rwg-virtual-joystick.css` — reusable virtual analog joystick;
- `orientation.js` — mandatory bootstrap that currently loads shared control assets before handheld orientation gating.

AI agents changing any game HUD MUST read this document before adding/moving controls.

## Visual hierarchy

Every game follows the same hierarchy:

1. **Metrics HUD** — score, level, lives, time, combo, lines or other read-only run statistics.
2. **Shared common-control dock** — Home/Games, Share, Audio when present, Pause, Credits and Avatar.
3. **Game-specific status/actions** — examples: sensor state/calibration, Solitario Undo/Hint/New Deal, Neon Snake Turbo, Block Drop Rotate/Drop.
4. **Movement control** — shared virtual joystick where directional input is required.

The common-control dock is now visually independent from local `#hud`, `#topbar` and `#gameControls` containers. Common controls may remain as DOM children of those legacy containers for compatibility, but `rwg-controls.css` removes them from local layout and pins them to one shared bottom rail.

Games MUST NOT reposition Home, Share, Audio, Pause, Credits or Avatar locally. Any platform-wide placement change belongs in the shared layer.

## Shared common-control dock

The dock uses one fixed bottom rail centered on the current viewport/app width. Order and visual grouping are stable:

- left: Home/Games, Share;
- center: Audio (when present), Pause;
- right: Credits, Avatar.

Properties:

- common controls use one target size, border radius, contrast and focus treatment;
- labels may collapse to icons on narrow screens but `aria-label` remains mandatory;
- the Share tray opens upward so it remains inside the visual viewport;
- the dock has a reserved vertical budget exposed as `--rwg-common-dock-reserve`;
- game-specific controls and joysticks must live above the reserved dock region;
- profile modules may still mount Credits/Avatar into legacy containers, but shared CSS places them in the dock visually;
- empty legacy topbars must not continue reserving a second visible controls row.

Do not create a second common toolbar above/below the dock. Do not mix game-specific actions into the common dock merely to save space.

## KPI/playfield separation

Read-only KPI cards may remain game-specific in number and labels, but interactive simulation must not use the KPI region as playable coordinates when this makes moving entities pass underneath the HUD.

If a game's canvas previously filled the whole viewport behind KPI cards, adapt that game's playfield bounds so the physics/rendering coordinate space starts below the KPI/boss/status region and ends above the common dock where necessary.

**Prism Breaker is the reference regression:** its ball/paddle/brick canvas must exclude the top KPI/boss-HUD reserve and the bottom common-dock reserve. A ball passing behind Score/Level/Lives is a contract failure, not an acceptable overlay effect.

Game-specific playfield reservation belongs in the target game's layout CSS when it changes the actual simulation viewport; common control geometry itself stays in `rwg-controls.css`.

## Game-specific actions

Game-specific controls remain outside the common dock:

- Solitario: Undo, Hint, New Deal;
- Block Drop: Rotate, Drop;
- Neon Snake: Turbo;
- Neon Tilt: calibration/sensor status where required;
- future mechanic-specific actions.

They should be grouped clearly and must not visually impersonate Home/Share/Audio/Pause.

## Virtual joystick

`window.RWGVirtualJoystick` is the only reusable on-screen directional-control component.

It provides normalized analog `x/y` in `[-1,1]`, dead zone, discrete direction resolution, allowed-direction filtering, pointer capture, neutral reset, `rwg:joystick-input` and reusable mounting.

Legacy direction buttons may remain hidden temporarily as adapter targets. New games must consume the shared joystick contract rather than create another D-pad.

### Current mapping

- **Maze Munch** — shared joystick replaces four directional buttons; swipe/keyboard remain alternatives.
- **Neon Snake** — shared joystick replaces D-pad; Turbo remains separate.
- **Block Drop** — left/right/down via joystick; Up is neutral; Rotate/Drop separate.
- **Neon Tilt** — full analog vector feeds existing touch-input physics; sensor/keyboard remain alternatives.
- **Star Swarm, Bubble Burst, Neon Rally, Prism Breaker, Solitario** — pointer/direct-manipulation games; no artificial movement joystick.

## Responsive behavior

The shared dock must remain visible inside the visual viewport on small iPhone/Safari layouts. Joystick/game-specific controls must not collide with it.

Current shared adaptations include:

- Block Drop stage/joystick raised above dock reserve;
- Maze Munch and Neon Snake joystick host separated from dock;
- Neon Tilt analog host/canvas height reserves dock space;
- Solitario local row contains only Undo/Hint/New Deal while common actions stay in the dock;
- Prism Breaker simulation viewport reserves both KPI and common-dock space.

Any future common-control exception belongs in `rwg-controls.css`, scoped by `data-rwg-game-name`. Do not solve it by editing the same common button differently in multiple game stylesheets.

## AI-agent rules

When changing HUD/controls:

1. identify whether an element is KPI, common system control, game-specific action or movement;
2. never place a common system control in a game-specific row;
3. never implement a new direction pad if `RWGVirtualJoystick` applies;
4. if a shared dock collision occurs, adjust shared reserve/adaptation first;
5. if the simulation itself occupies reserved UI space, adjust the game playfield bounds rather than raising z-index and hiding the bug;
6. update this document and `scripts/validate-shared-controls.mjs` whenever the shared contract changes.

## Validation

Run after shared HUD/control changes:

```bash
node --check rwg-virtual-joystick.js
node --check orientation.js
node scripts/validate-shared-controls.mjs
node scripts/validate-contracts.mjs
```

Browser smoke tests must cover every game at least at 320×568, 390×844 and desktop width, with special attention to real iOS Safari visual viewport behavior.

Verify:

- Home/Share always left, Audio/Pause center, Credits/Avatar right;
- no common controls remain visually stranded in KPI/topbar/game-specific rows;
- no duplicate common toolbar;
- Share tray opens upward and is reachable;
- joystick/game-specific actions do not collide with the dock;
- KPI labels remain readable;
- Prism Breaker ball/brick/paddle coordinates never pass under KPI cards;
- Solitario game-specific controls remain usable above the dock;
- all permitted joystick directions and dead-zone behavior remain correct.
