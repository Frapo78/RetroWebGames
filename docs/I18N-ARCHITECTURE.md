# ADR — Internationalization architecture

Status: Accepted after the I18N-1 proof-of-concept gate

Date: 2026-09-07

## Context

RetroWebGames must support Italian, English, German, French and Spanish without duplicating game engines, changing gameplay state, splitting player identity or weakening static SEO. The current frontend is static HTML/CSS/JavaScript, game loops are JavaScript + Canvas 2D (Solitario uses DOM/CSS), global leaderboards use Fastify, and FraPoVPS publishes `public/` through Nginx.

The migration must preserve the existing Italian URLs, installed PWA identity, bootstrap order (`game runtime` → `RWGResumeAdapter` → shared bootstrap), cache behavior and rollback path.

## Decision

Use **Astro static output** as a build-time page and metadata generator, subject to the I18N-1 proof-of-concept gate. Astro will not own game state, game loops, shared browser services or leaderboard APIs. Production remains a static Nginx publication with no frontend Node process.

The accepted locale contract is:

- `it`, `en`, `de`, `fr`, `es`;
- Italiano senza prefisso and permanent default;
- `/` and `/games/<slug>/` remain the Italian canonical URLs;
- other locales use `/<locale>/` and `/<locale>/games/<slug>/`;
- game slugs and brand names do not change between locales;
- `x-default` points to the Italian canonical;
- the route, not `navigator.language`, is authoritative for rendered content;
- no automatic locale redirect; a first-visit suggestion may be introduced later;
- one static page contains one visible language.

Astro will generate shells, localized HTML, canonical/alternate metadata, JSON-LD and sitemap entries. Existing scripts remain classic browser scripts in their current order during the pilot. `RWGI18n` will be a small synchronous classic-script-compatible service whose payload contains shared namespaces plus only the current game namespace.

## Language-neutral domain boundary

Locale is presentation only. The following remain language-neutral and shared across all routes:

- player/profile/avatar/wallet IDs and storage;
- credits and Continue accounting;
- session keys, schemas, compatibility tokens and serialized enums;
- run IDs, game slugs, variant slugs and achievement IDs;
- leaderboard ranking and persistence;
- analytics event names and stable enum values.

Changing language during a run must checkpoint the same snapshot and resume it for free at the equivalent route. Labels are formatted at render time; translated sentences are never persisted.

## Catalog contract

Italian is the source catalog. Keys are stable semantic identifiers grouped under `core`, `home`, `pause`, `session`, `gameOver`, `leaderboard`, `profile`, `avatar`, `orientation`, `share`, `pwa` and `games.<slug>`. Keys are never derived from visible Italian text.

Catalog leaves are non-empty strings with named placeholders. Complete locales must have exactly the source shape and identical placeholder sets. Arbitrary HTML, scripts, event attributes and `javascript:` values are forbidden. Formatting uses `Intl.NumberFormat`, `Intl.DateTimeFormat` and `Intl.PluralRules` behind `RWGI18n`; game code must not hardcode `it-IT` once its namespace is migrated.

Brand names remain unchanged. The controlled international display name for the current Italian “Solitario” is “Solitaire” in EN/DE/FR and “Solitario” in IT/ES; Klondike and FreeCell remain invariant.

## Build and deployment boundary

I18N-1 proved all of the following; evidence is recorded in `docs/I18N-ASTRO-POC.md`:

1. deterministic static output compatible with Appmanager `astro-static` and FraPoVPS `public/`;
2. unchanged runtime script order and shared lifecycle behavior;
3. equivalent Italian DOM, metadata, byte budget and screenshots for home and Block Drop;
4. correct IT/EN canonical, reciprocal `hreflang`, JSON-LD and sitemap;
5. no frontend server process and no runtime framework in game hot paths;
6. dependency versions pinned, audited and reproducible;
7. dry-run deploy and documented rollback both succeed.

The gate passed. I18N-3 promotes Astro to the production static page generator for the complete Italian and English route sets. The generated `public/` directory remains the sole Nginx artifact; game runtimes and shared browser services remain framework-free.

## Alternatives considered

- PHP and FraPoFW add a server runtime without solving client-side game strings or improving Canvas execution.
- A React/Vue/Svelte SPA adds bootstrap and SEO complexity without a useful gameplay benefit.
- Five hand-maintained copies create immediate drift and are forbidden.
- Custom static generators can work but would reproduce routing, templating, sitemap and metadata concerns already covered by Astro.
- A heavy runtime i18n library is unnecessary unless later profiling proves the small service insufficient.

## Risks and mitigations

- Bootstrap regression: compare exact script ordering and run existing session/pause/Game Over validators.
- Italian visual drift: screenshot and DOM baselines before templating.
- incomplete translated pages: build fails for any locale marked complete with missing/extra keys.
- cache/PWA split: retain one app ID, use explicit cache generations and test monolingual upgrades.
- German overflow: mandatory 320×568 visual gate and long-string fixtures.
- SEO duplication: self-canonical pages, reciprocal alternates and sitemap validation.
- dependency exposure: Astro and sitemap versions are pinned exactly; dependency audit remains part of every toolchain update.

## Rollback

Each rollout remains a normal immutable static release. Rollback restores the previous FraPoVPS release/current symlink and the previous static project source; the Fastify leaderboard and database are unaffected because language is not part of their keys or schema. I18N-1 rehearsed this successfully before any localized route was published.

## Consequences

I18N-0 introduced contracts and inventory tooling. I18N-1 accepted Astro after an isolated Home + Block Drop IT/EN pilot. I18N-2 extracted the Italian shared platform into a generated synchronous catalog runtime. I18N-3 publishes complete IT/EN home, avatar and ten-game route sets, keeps state language-neutral, adds reciprocal SEO metadata and a locale-aware offline shell, and is documented in `I18N-EN-ROLLOUT.md`. I18N-4 adds ES, FR and DE one complete locale at a time.
