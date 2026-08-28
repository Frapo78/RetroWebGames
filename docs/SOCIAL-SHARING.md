# RetroWebGames — social sharing covers

## Current contract

Every public RetroWebGames page exposes static Open Graph and Twitter/X metadata in its HTML `<head>`. Social crawlers must not depend on JavaScript.

The current global fallback cover is:

`assets/social/retrowebgames-cover.jpg`

Production URL:

`https://www.retrowebgames.it/assets/social/retrowebgames-cover.jpg`

For now home, the public avatar editor and every game page use this image. The current committed cover is a 600×315 JPEG (the minimum large-preview 1.91:1 format). New dedicated covers should preferably be 1200×630 JPEGs.

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

## Future per-game covers

Use the convention:

`assets/social/games/<slug>.jpg`

When a dedicated cover is created for a game, update only that game page's `og:image`, `og:image:secure_url`, dimensions/type/alt metadata and `twitter:image`/alt. Keep `og:url` equal to the page canonical URL and use absolute HTTPS image URLs.

The intro share buttons automatically use the same game's canonical link, so no per-game JavaScript change is required when a dedicated cover is introduced.

## Validation

Every public page must have exactly one static Open Graph and Twitter/X `summary_large_image` metadata set. Current coverage is 11 pages: home, the avatar editor and nine games.

The social validator also checks that `game-hud.js` automatically loads the shared intro-sharing component and that all game intros inherit the five icon-only social actions.

Run `node scripts/validate-social-sharing.mjs` or `node scripts/validate-contracts.mjs`.
