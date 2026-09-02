# Block Drop — authoritative implementation notes

Block Drop is the 10×20 falling-block game implemented by:

- `games/block-drop/game.js` — board, seven-piece bag, input, Canvas renderer and resumable session;
- `games/block-drop/style.css` — portrait playfield and local action layout;
- shared `rwg-virtual-joystick.js` — left/right/down input;
- shared HUD, pause, orientation and Game Over components.

## Canvas geometry invariant

The visible Canvas CSS box, its backing-store dimensions, the drawing transform and the logical cell size must be updated as one atomic operation. Rendering uses the stored `renderWidth` / `renderHeight` from that operation; an animation frame must never combine a live CSS rectangle with an older backing store or `cell` value.

Block Drop observes the Canvas with `ResizeObserver` and coalesces geometry changes through one animation-frame scheduler. Window resize, Visual Viewport resize, orientation change, page load and font readiness are additional triggers. This is required because the shared controls and virtual joystick are loaded asynchronously and may change `#stage` after the game engine's initial layout pass.

The resize path is idempotent and must:

1. measure the final CSS box;
2. update stored CSS dimensions and capped DPR;
3. resize the backing store only when its pixel dimensions changed;
4. restore the DPR transform;
5. recalculate the 10×20 cell size;
6. redraw both the board and next-piece preview.

Do not read `getBoundingClientRect()` again from `draw()`. That previously allowed a new CSS width to clear only part of an old backing store while pieces continued using the old cell size.

## 2026-09-02 first-load rendering incident

On mobile, a cold first visit could load the shared-controls stylesheet before the virtual-joystick script added `.rwg-vjoy-enabled`, or in the inverse order. The latter class changes the stage bottom reserve. The existing one-shot synthetic window resize could therefore run between the two layout transitions.

Symptoms included:

- old piece frames accumulating in the rightmost columns;
- grid cells and tetromino cells using different apparent widths;
- pieces appearing stretched vertically or attached to the board edge;
- a reload apparently fixing the game because cached assets changed bootstrap order.

Root cause: the animation renderer read the new live Canvas CSS rectangle on every frame but retained the old backing-store size and old logical `cell` value until another window resize. This was a layout race, not corrupted game state and not fundamentally a service-worker cache defect.

Permanent fix: Canvas-owned `ResizeObserver`, coalesced atomic resizing and stored render dimensions. Cache-versioned local CSS/JS ensure old and new generations are not mixed during rollout.

## Local actions

Rotate and hard Drop are square, rounded, adjacent action buttons beside the joystick. Each uses an original inline SVG plus a short text label and a complete `aria-label`. Drop explicitly owns a yellow foreground and dark background with `!important` at the game-scoped selector: the dynamically loaded shared action style also uses `!important`, so relying on the old low-specificity dark foreground makes both its icon and label effectively invisible. Direction buttons remain hidden adapter targets once the shared joystick mounts.

## Required validation

```bash
bash scripts/validate-local.sh validate-block-drop.mjs
bash scripts/validate-local.sh
```

Browser smoke tests must exercise a cold load where the virtual-joystick script is delayed relative to its stylesheet, then verify the Canvas backing store tracks the final CSS box at 390×844, 375×667 and 320×568 without accumulated pixels or overflow.
