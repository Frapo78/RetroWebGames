# RetroWebGames — Avatar / Player Identity

## Status

The avatar is a shared platform identity rendered by `rwg-avatar.js` / `rwg-avatar.css`. `/avatar/` is the only editor. Games consume the shared renderer through the HUD bootstrap and must not create local avatar implementations.

Current avatar schema: **v2**.

## Visual contract

The character is built around a readable **stickman / arcade-player skeleton**, not a soft blocky doll.

The shared renderer uses a scalable inline SVG:

- circular head;
- visible central spine/shoulder/hip skeleton reference;
- articulated stick-like arms and legs with joint points;
- outfit layers drawn over the skeleton;
- gear layers independent from the base body;
- holographic aura/platform treatment for full-size presentation;
- the same SVG remains recognizable in the compact in-game avatar badge.

This is intentional. Do not regress to independent CSS rectangles for torso/arms/legs or to game-specific raster avatars.

## Shared state

`rwg-avatar.js` owns the storage schema and normalization.

Current v2 fields:

- `skin`
- `hairColor`
- `eyeColor`
- `shirtColor`
- `pantsColor`
- `shoeColor`
- `hairStyle`
- `faceStyle`
- `topStyle`
- `bottomStyle`
- `bodyStyle`
- `eyewear`
- `headgear`
- `emblem`
- `aura`

All values are normalized against `RWGAvatar.options`; arbitrary colors or class names are not accepted.

## v1 migration

The old v1 schema had one combined `accessory` slot.

v2 migrates it without discarding an existing player:

- `glasses` / `visor` → `eyewear`;
- `cap` / `headphones` → `headgear`;
- new `emblem` defaults to `none`;
- new `aura` defaults to `cyan`.

The v2 storage key is `rwg.avatar.v2:<fingerprint>`. If it is absent, the renderer reads `rwg.avatar.v1:<fingerprint>`, normalizes the data, writes v2 and continues.

Do not delete this migration path while meaningful v1 clients may still exist.

## Renderer contract

`RWGAvatar` exposes:

- `get()`
- `save(next, meta)`
- `randomAvatar(seed)`
- `randomize(seed)`
- `normalize(value)`
- `renderInto(host, options)`
- `markup(avatar, mode)`
- `options`
- `version`
- `storageKey`
- `legacyStorageKey`
- `editorUrl`

Supported render modes:

- `full` — editor/full identity;
- `mini` — compact badge next to credits.

The renderer is shared. A visual change must be tested in both modes.

## Editor UX

`/avatar/` is a gaming loadout configurator rather than a long flat form.

Four top-level tabs are mandatory:

1. **Corpo** — body, skin, expression;
2. **Testa** — eyes, hair style/color;
3. **Outfit** — top, top color, bottoms, pants color, shoes;
4. **Gear** — eyewear, headgear, chest emblem, aura.

The editor owns a large live preview, drag-to-rotate view, loadout summary, random loadout, undo unsaved changes and explicit save.

Unsaved editor changes must not mutate the globally stored avatar until Save is pressed.

## Performance

The avatar is DOM/SVG, not Canvas.

- no animation-frame storage writes;
- no external image requests for the character;
- no duplicated per-game assets;
- full idle/aura animation must honor `prefers-reduced-motion`;
- mini mode disables nonessential animation/detail where possible.

## Accessibility

- editor controls are native buttons;
- selection uses `aria-pressed`;
- tabs use `role=tab`, `aria-selected` and keyboard arrow navigation;
- the rendered decorative SVG is hidden from assistive technology;
- the avatar editor remains `noindex,follow`.

## Validation

Run:

```bash
node scripts/validate-avatar.mjs
node scripts/validate-contracts.mjs
```

The avatar validator guards v2 migration, stickman/SVG structure, independent gear slots, loadout tabs and the shared mini/full renderer.
