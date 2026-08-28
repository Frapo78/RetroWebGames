# RetroWebGames — social sharing covers

## Current contract

Every public RetroWebGames page exposes static Open Graph and Twitter/X metadata in its HTML `<head>`. Social crawlers must not depend on JavaScript.

The current global fallback cover is:

`assets/social/retrowebgames-cover.jpg`

Production URL:

`https://www.retrowebgames.it/assets/social/retrowebgames-cover.jpg`

For now home and every game page use this image. The current committed cover is a 600×315 JPEG (the minimum large-preview 1.91:1 format). New dedicated covers should preferably be 1200×630 JPEGs.

## Future per-game covers

Use the convention:

`assets/social/games/<slug>.jpg`

When a dedicated cover is created for a game, update only that game page's `og:image`, `og:image:secure_url`, dimensions/type/alt metadata and `twitter:image`/alt. Keep `og:url` equal to the page canonical URL and use absolute HTTPS image URLs.

## Validation

Every page must have exactly one static Open Graph and Twitter/X `summary_large_image` metadata set.

Run `node scripts/validate-social-sharing.mjs` or `node scripts/validate-contracts.mjs`.
