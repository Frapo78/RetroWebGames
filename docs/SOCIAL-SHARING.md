# RetroWebGames — social sharing covers

## Current contract

Every public RetroWebGames page exposes static Open Graph and Twitter/X metadata in its HTML `<head>`. Social crawlers must not depend on JavaScript.

The global fallback cover for the home and avatar editor is:

`assets/social/retrowebgames-cover-1280.jpg`

Production URL:

`https://www.retrowebgames.it/assets/social/retrowebgames-cover-1280.jpg`

The fallback is a 1280×672 JPEG. Every game instead owns an original 1200×630 JPEG under `assets/social/games/<slug>.jpg`.

The nine covers are gameplay-derived artistic reinterpretations in a dynamic 1980s/1990s coin-op poster language. They use only original project imagery and preserve a centered, social-safe title treatment.

Each game also owns a separate transparent 1200×300 RGBA PNG wordmark under `assets/brand/games/<slug>-wordmark.png`. Keeping it separate prevents later cover crops, alternate campaign art or UI reuse from depending on text baked into a particular background.

## Game intro sharing controls

Every game start screen automatically receives an icon-only social row at the bottom of its intro panel through the shared platform layer:

- `rwg-intro-share.js`
- `rwg-intro-share.css`
- bootstrap: `game-hud.js`

The visible controls contain logos only; accessible names remain available through `aria-label`.

Current networks:

- WhatsApp
- Facebook
- X
- Telegram
- LinkedIn

Each control shares the canonical URL of the current game, not the generic home URL. The row is removed from view as soon as the game starts or a saved session is resumed, so it does not reappear in pause overlays.

This feature is inherited automatically by future games because every `data-rwg-game="true"` page is required to load `../../game-hud.js`. Do not duplicate the social row in individual game HTML files.

## Per-game cover contract

For every `games/<slug>/index.html`, Open Graph, Twitter/X and JSON-LD must use the game's absolute HTTPS cover URL. Both social dimensions are 1200×630, both alt fields describe the actual artwork, and the matching standalone wordmark must exist even when it is not rendered by the game UI.

The intro share buttons automatically use the same game's canonical link, so no per-game JavaScript change is required when a dedicated cover is introduced.

`scripts/seo-catalog.mjs` is the source of truth for cover URLs and alt text. `scripts/apply-seo.mjs` must preserve this mapping whenever SEO metadata is regenerated.

## Validation

Every public page must have exactly one static Open Graph and Twitter/X `summary_large_image` metadata set. Current coverage is 11 pages: home, the avatar editor and nine games.

The social validator checks the metadata mapping, JPEG headers and exact cover dimensions, as well as existence, dimensions and alpha channel of every standalone wordmark. It also checks that `game-hud.js` automatically loads the shared intro-sharing component and that all game intros inherit the five icon-only social actions.

Run `node scripts/validate-social-sharing.mjs` or `node scripts/validate-contracts.mjs`.
