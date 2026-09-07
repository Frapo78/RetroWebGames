# RWG internationalization inventory

Baseline: Italian production source at `72897fc` (2026-09-07). This document is the human classification; `node scripts/audit-i18n.mjs` is the repeatable location-level candidate scanner.

## Method

The scanner walks project-owned `.html`, `.js`, `.mjs`, `.css` and `.webmanifest` files under `public/`, `server/leaderboards/` and the repository governance scripts, excluding binary assets, icons, dependencies and generated/vendor content. It reports file, line, category, occurrence kind and a bounded source excerpt. It deliberately over-reports candidates: I18N-2 decides whether each literal is player-facing, language-neutral, structured metadata, accessibility copy, analytics/debug text or a false positive.

Run:

```bash
node scripts/audit-i18n.mjs --summary
node scripts/audit-i18n.mjs > /tmp/rwg-i18n-inventory.json
```

## HTML e metadata

Scope: `public/index.html`, `public/avatar/index.html`, and every `public/games/*/index.html` (home + avatar + ten games). Inventory includes visible text, `title`, description, Open Graph/Twitter alt, image alt, `aria-label`, form labels, buttons, hints, live-region seed copy, JSON-LD names/descriptions and breadcrumb labels.

Current locale markers are intentionally Italian: `<html lang="it">`, `og:locale=it_IT` and JSON-LD `inLanguage=it-IT`. `scripts/seo-catalog.mjs`, `scripts/apply-seo.mjs`, `scripts/generate-sitemap.mjs` and the SEO validators are generator/contract surfaces for I18N-1.

Classification: SEO/discovery strings go to localized build data; gameplay intro controls go to `games.<slug>`; common actions go to shared namespaces; brand names and stable slugs remain language-neutral.

## Shared runtime

Primary files:

- `game-hud.js`, `orientation.js`, `rwg-controls.css`;
- `game-over.js`, `rwg-pause-menu.js`, `rwg-session.js`;
- `rwg-leaderboard.js`, `rwg-leaderboard-infinite.js`;
- `rwg-profile.js`, `rwg-avatar.js`, avatar editor;
- share, PWA install, common dock and virtual joystick scripts.

Inventory includes buttons, modal headings/copy, errors, status/live announcements, score labels, resume descriptions and accessibility labels. These become the I18N-2 namespaces `core`, `pause`, `session`, `gameOver`, `leaderboard`, `profile`, `avatar`, `orientation`, `share` and `pwa`.

Shared runtime currently contains explicit `it-IT` and `toLocaleString` calls, notably leaderboard, Game Over and pause formatting. These are extraction targets, not defects to change in I18N-0.

## Game runtime

Every `public/games/<slug>/` is in scope, including HTML, runtime modules and user-facing generated copy. For each of the ten games inventory covers HUD labels, tutorial/rules, buttons, phase/intermission banners, boss/level clear, terminal fallback, achievements, resume `describe()` output and accessibility labels.

State enums, numeric mechanics, game/variant slugs, compatibility tokens, achievement IDs, asset paths and analytics event names are language-neutral. A translated label must never enter a resumable snapshot. Solitario additionally has variant-facing labels for Klondike and FreeCell but its persisted `variantSlug` remains unchanged.

## CSS generated content

All non-empty project-owned `content:` declarations are inventoried. Decorative empty strings and purely symbolic glyphs remain presentation; linguistic examples such as `PESCA`, lock annotations and the footer attribution require catalog/template ownership or accessible DOM equivalents before a locale is complete.

## Manifest/PWA

`public/manifest.webmanifest`, install prompt copy, iOS instructions and service-worker offline behavior are in scope. One PWA app ID, origin, icon family and installation identity must remain shared. I18N-1 includes a spike before choosing one manifest or localized manifests; no PWA change occurs in I18N-0.

## API errors

`server/leaderboards/server.js` currently returns Italian `message` strings. Target contract: stable machine-readable error codes from the API, localized client presentation, and optional non-authoritative debug detail. Ranking keys remain `(gameSlug, variantSlug)` and never include locale. API conversion belongs to a later shared-runtime phase and must remain backward compatible.

## Analytics e debug

Analytics event names and enumerated values stay English/stable and are not translated. Future context adds `ui_locale`, `content_language` and `browser_language`. Console diagnostics and developer-only validator messages are classified `debug-only`; they need not be localized unless surfaced to a player.

## Formatter inventory

The scanner explicitly finds `it-IT`, `it_IT`, `toLocaleString`, `Intl.NumberFormat`, `Intl.DateTimeFormat` and `Intl.PluralRules`. Current direct formatting exists across shared leaderboard/Game Over/pause and several game HUD/resume descriptions. Migration replaces operational hardcoding namespace by namespace through `RWGI18n`; no formatter is globally rewritten in one mechanical pass.

## Extraction order and ownership

1. shared modal/lifecycle surfaces;
2. home shell and discovery metadata;
3. one game namespace at a time;
4. accessibility copy with the same feature owner;
5. CSS linguistic content moved to DOM/catalog ownership;
6. API error codes and localized client mapping;
7. analytics locale context without translated event names.

The scanner is an inventory guard, not a translation validator. Once Italian catalogs exist, `validate-i18n.mjs` will additionally enforce complete key shape, placeholders and absence of migrated literals outside the catalog.
