# RWG I18N-0 baseline

Purpose: preserve the current Italian rendering and bootstrap while introducing catalogs and an Astro static pilot. No screenshot is committed; reproducible hashes and measurements are recorded from project-owned files and `/apps/preview-tools` runs.

## Source baseline

- Upstream commit: `72897fc`.
- Routes in current static source: `/`, `/avatar/`, ten `/games/<slug>/` pages.
- Locale state: Italian-only, unprefixed.
- Frontend runtime: classic scripts, no frontend package dependency or build requirement.
- Production frontend: Nginx static `public/`.
- Dynamic service: Fastify leaderboard only.

## Required comparison pair for I18N-1

- home `/`;
- game `/games/block-drop/`;
- viewports `320×568`, `390×844`, `1366×768`;
- Chromium and WebKit-equivalent smoke where available.

Capture for each route/viewport:

- full-page screenshot SHA-256 and optional visual diff;
- DOM node count and serialized HTML bytes;
- project-owned JS/CSS request count, transfer bytes and decoded bytes;
- `domContentLoadedEventEnd`, `loadEventEnd`, first paint and first contentful paint when exposed;
- console errors and failed project-owned requests;
- ordered list of runtime scripts;
- title, canonical, `html lang`, Open Graph locale and JSON-LD language;
- session/profile/leaderboard storage namespaces before and after.

## Acceptance budgets

- Italian game runtime script ordering: exact match.
- Gameplay JavaScript bytes: no increase caused by Astro.
- Runtime i18n core + current locale + current game payload: target ≤ 12 KiB gzip; hard gate to be confirmed from the pilot.
- No runtime Astro client bundle unless explicitly justified.
- No new frontend process, API request for initial language, or Italian-language flash.
- Zero missing project-owned request, console error, horizontal overflow or CTA displacement.
- Existing session, profile, credits and leaderboard keys unchanged.

## Captured production baseline — 2026-09-07

Playwright Chromium reported zero project-owned console/network failures.

| Route | Viewport | DOM nodes | HTML bytes | JS/CSS requests | Transfer / decoded | DCL / load | Screenshot SHA-256 |
|---|---:|---:|---:|---:|---:|---:|---|
| `/` | 320×568 | 543 | 43,572 | 16 | 129,092 / 124,292 | 239 / 737 ms | `cf750cd540ed600aad02892e0cce57511eeed1f57adc591771c9f89e405d520c` |
| `/` | 390×844 | 551 | 44,038 | 16 | 129,092 / 124,292 | 158 / 482 ms | `9a615d3b5b96aab9b1860e0ccf0bea74668b7e3fa8d29b2b809ae40323c23736` |
| `/` | 1366×768 | 548 | 43,813 | 16 | 129,092 / 124,292 | 152 / 591 ms | `e6139b06e1efca9a3a1e72e33f2b51ffa2b331bc4cb9f4413f991614efc5a9c6` |
| `/games/block-drop/` | 320×568 | 348 | 34,785 | 26 | 269,194 / 261,394 | 114 / 410 ms | `f0b774e7f961c30158379c5d671d7b70d082278af9243dfdc944860fd1b3c45c` |
| `/games/block-drop/` | 390×844 | 350 | 34,881 | 26 | 269,194 / 261,394 | 124 / 399 ms | `0ad6abc5396339bc78bec87469184e0f5c3f8f0c53353354a06f716219762343` |
| `/games/block-drop/` | 1366×768 | 353 | 34,989 | 26 | 269,194 / 261,394 | 137 / 467 ms | `30316d8a6e052d522ffc8d47bccb8fb2caa0b8554bbc0613e8d14ebe6ad6dfb0` |

SEO identity was stable in all captures: `lang=it`, `og:locale=it_IT`, self-canonical URL and the current production title. Block Drop preserved the ordered bootstrap `game.js` → `game-hud.js` → session/leaderboard/profile → `orientation.js` → controls/pause/Game Over/avatar.

## Reproduction

Use `/apps/preview-tools/bin/preview-tools-doctor` and `/apps/preview-tools/bin/preview-node` for browser capture. Run repository validation through `bash scripts/validate-local.sh` on the adapted VPS checkout. I18N-1 must store its measured before/after report next to this document before the Astro gate is accepted.
