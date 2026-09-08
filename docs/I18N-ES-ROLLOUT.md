# I18N-4 — Spanish rollout

Status: **PASS — production rollout authorized**

Date: 2026-09-08

## Scope

Spanish is the third complete RetroWebGames locale. Astro generates Home, Avatar and all ten games at `/es/`, while Italian remains unprefixed and English remains under `/en/`. `src/i18n/es/shared.mjs` and `src/i18n/es/games.mjs` mirror the Italian source shapes and named placeholders; generated pages load one synchronous ES shared/game bootstrap before any game or shared runtime.

Profile, wallet, avatar, saved sessions, achievements, run IDs, game/variant slugs and global leaderboard records remain language-neutral. No game engine, score rule or persistence schema changes as part of localization.

## Route, SEO and cache contract

- 12 Spanish routes mirror IT and EN, including the noindex Avatar utility;
- 33 indexable canonical URLs are present in the sitemap;
- every published page exposes reciprocal `it`, `en`, `es` and `x-default` links;
- ES uses `lang=es`, `og:locale=es_ES`, self-canonical metadata and Spanish JSON-LD;
- the language selector links to the equivalent route and never redirects automatically;
- service-worker cache `rwg-shell-v6` includes the three Home shells and shared locale bootstraps while retaining one PWA identity.

All localized static and lazy assets are root-absolute. Runtime-created assets follow the same rule; Bubble Burst sprite atlases were corrected from `../../assets/...` to `/assets/...` so prefixed routes cannot resolve them below the locale directory.

## Additional fixes found by visual QA

- regenerated the stale EN publication that requested Home artwork and `rwg-leaderboard.js` below `/en/`;
- protected Avatar `id` and `data-i18n` keys from short text-replacement collisions;
- moved the shared virtual-joystick labels and runtime help text into semantic IT/EN/ES catalog keys;
- corrected the contextual Solitario EN action from `CANCEL` to `UNDO`;
- bumped Bubble Burst and shared-loader asset revisions so mobile caches receive the fixes.
- made the legacy VPS sitemap generator byte-equivalent to the Astro finalizer: it now preserves exact reciprocal `it`, `en`, `es` and `x-default` URLs instead of stripping or rewriting localized alternates; SEO validation checks every expected alternate URL, not presence alone.

## Validation

- deterministic Astro build: 36 pages;
- catalog structure/placeholders and bootstrap budget: PASS;
- SEO/GEO and 33-entry localized sitemap: PASS;
- Playwright local smoke: 36 routes × 3 viewports (320×568, 390×844, 1366×768), 108 checks: PASS;
- the full route/viewport smoke mocks leaderboard responses by default; use a separate low-volume production smoke for live rankings so QA does not trigger the API rate limiter;
- production EN hotfix smoke: Home images, all ten Home rankings and Solitario shared controls at 390×844 and 320×568: PASS;
- repository-wide contracts and production ES smoke are required again immediately before and after deployment.

## Rollback

FraPoVPS can restore the previous immutable static release. The leaderboard service and database require no rollback because the rollout changes presentation only. A source rollback reverts the rollout commit and republishes the Astro output.

## Next step

Continue I18N-4 with French as a separate complete-locale rollout. Do not expose `/fr/` until its catalog, metadata, responsive QA and production smoke are all green.
