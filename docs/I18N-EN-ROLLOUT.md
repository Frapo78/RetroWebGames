# I18N-3 — English rollout

Status: **PASS — production rollout authorized**

Date: 2026-09-08

## Scope

Astro now generates 24 static pages from the existing Italian sources: Home, Avatar and all ten games in Italian and English. Italian canonical URLs remain unprefixed; English equivalents use `/en/`. The Canvas/DOM engines, shared lifecycle, profile, credits, sessions and leaderboard service are unchanged.

English is a complete locale, not a runtime fallback. `src/i18n/en/shared.mjs` mirrors the Italian shared catalog, while `src/i18n/en/games.mjs` mirrors all game namespaces. The deterministic build emits a shared-only bootstrap for non-game pages and one self-contained shared-plus-game bundle for each locale/game pair.

## Build and publication

```bash
npm run build:site
npm run publish:site
```

`build:site` regenerates catalogs, prepares static assets, creates all routes and writes the localized sitemap. `publish:site` copies only the generated HTML route set and sitemap back into `public/`; FraPoVPS continues to deploy `public/` as an immutable static release with no frontend Node process.

## Route and SEO contract

- `/` and `/games/<slug>/`: Italian canonical routes;
- `/en/` and `/en/games/<slug>/`: English canonical routes;
- every indexable page has reciprocal `it`, `en` and `x-default` alternates;
- `x-default` points to Italian;
- English pages use `lang=en`, `og:locale=en_US` and English JSON-LD/metadata;
- `sitemap.xml` contains 22 indexable route entries; both Avatar utility routes remain `noindex` and excluded;
- language selectors are crawlable links to the equivalent page, never automatic redirects.

## State, analytics and PWA

Locale remains presentation-only. Profile, wallet, avatar, session keys, game/variant IDs, run IDs and global rankings are shared. Runtime summaries are formatted when rendered; Bubble Burst level-clear snapshots now persist numeric summary values and remain backward compatible with older snapshots.

GA4 event names stay stable. Every event includes `ui_locale`, `content_language` and `browser_language`; explicit selector use emits `language_selected` without PII. The selected locale is stored only as the presentation preference `rwg.locale.preference.v1`.

The service-worker shell is `rwg-shell-v5`. It precaches the two Home shells and shared locale bootstraps, but not every game in every language. Navigation fallback keeps `/en/` requests English instead of silently returning Italian.

## Validation gate

The release gate requires:

- exact IT/EN catalog shape and placeholder parity;
- deterministic Astro output with 12 routes per locale;
- no known visible Italian fallback on English pages;
- correct canonical, alternate, Open Graph and sitemap output;
- repository-wide contracts and syntax checks;
- Playwright smoke on production for Home, Avatar and all games at mobile and desktop viewports;
- no console errors, unexpected failed resources or horizontal overflow.

Production evidence and the final commit SHA are recorded in the deployment report for this change.

## Rollback

FraPoVPS rollback restores the prior immutable static release/current symlink. If source rollback is required, revert the I18N-3 commit and redeploy. Leaderboard data, player identity and saved sessions require no migration or rollback because their schemas and keys remain language-neutral.

## Next step

I18N-4 adds Spanish, French and German one complete locale at a time. No route for an incomplete locale may be published.
