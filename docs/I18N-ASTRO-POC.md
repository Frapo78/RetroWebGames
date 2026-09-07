# I18N-1 — Astro static proof of concept

Date: 2026-09-08

Status: **PASS — adopt Astro incrementally for page generation**. This branch is intentionally not deployable to production as a complete multilingual release: it proves the build boundary with Home and Block Drop only.

## Scope and decision

The pilot generates these four pages from two shared templates:

- `/` and `/en/`;
- `/games/block-drop/` and `/en/games/block-drop/`.

Astro is accepted as the staged static page generator. It does not enter any game loop, browser service, leaderboard API or persistent frontend process. Existing Italian HTML remains authoritative while the remaining migration stages extract shared and game copy.

Pinned toolchain:

- Node 22.22.1 on the VPS;
- Astro 7.3.1;
- `@astrojs/sitemap` 3.7.4;
- exact versions recorded in `package-lock.json`;
- `npm audit`: 0 vulnerabilities on 193 packages.

## Source/output separation

- current source publication: `public/`;
- Astro source: `astro-poc/src/`;
- prepared immutable assets: `.work/astro-poc-static/`;
- normal pilot output: `.work/astro-poc/public/`;
- deploy-contract output: selectable with `RWG_ASTRO_OUT_DIR`.

`scripts/prepare-astro-poc.mjs` copies current static assets while excluding the pages and sitemap owned by the pilot. It never writes into the current `public/` tree. The four Astro routes share `PilotDocument.astro` and a build-time renderer, so no Astro client runtime is shipped.

Commands:

```bash
npm ci
npm run build:astro-poc
npm run validate:astro-poc
python3 -m http.server 4328 --bind 127.0.0.1 --directory .work/astro-poc/public
/apps/preview-tools/bin/preview-node scripts/smoke-astro-poc.mjs
```

## Gate evidence

- deterministic build: 4 localized pages plus sitemap index/partition;
- HTML language, self-canonical, reciprocal `hreflang`, `x-default`, Open Graph locale and JSON-LD language validated;
- sitemap contains exactly the four pilot canonicals, reciprocal localized alternates and `x-default`;
- Italian combined HTML byte delta: **+1.76%**, entirely attributable to localized SEO links and normalized absolute asset URLs;
- Block Drop `game.js`, HUD, session, leaderboard and CSS copies are byte-identical to their source files;
- Block Drop bootstrap remains `game.js` → `game-hud.js` → `orientation.js`;
- no `/_astro/` client asset or frontend server process;
- Playwright smoke: **12/12 PASS** across 320×568, 390×844 and 1366×768 for all four routes, with no horizontal overflow or project-owned failed request;
- visual geometry comparison: **6/6 source/pilot pairs PASS** for Home and Block Drop at the same three viewports; screenshots remain ignored under `.work/astro-poc/screenshots/`;
- dependency audit: **PASS, 0 vulnerabilities**.

The English pilot translates metadata and all static shell/game copy. Runtime strings supplied by existing shared scripts deliberately remain Italian until I18N-2/I18N-3; therefore `/en/` must not be published yet.

## FraPoVPS dry-run

A deploy-like build was generated under `/tmp/rwg-astro-deploy-poc.rat9VS/public`, then compared with an empty release target using `rsync -ain --delete`: 187 publication entries, no writes to a live release and no Nginx/service changes. The artifact has the `public/` convention expected by Appmanager `astro-static`, contains static files only and requires no frontend process.

When rollout is authorized, the project registry/build command must set the Astro output to the staging project `public/` before the normal immutable FraPoVPS release sync. That registry transition is explicitly outside this unpublished pilot.

## Rollback rehearsal

No live release or `/projects/RWG` working tree was changed, so the pilot rollback is a no-op: stop the temporary server and discard `.work/astro-poc` or the temporary deploy directory. For the future rollout, rollback remains the documented FraPoVPS immutable-release operation: restore the prior `current` symlink/release and reload Nginx. The leaderboard service/database remain untouched because locale never enters their storage identity.

## Gate conclusion

**Astro: YES**, within the boundaries in `docs/I18N-ARCHITECTURE.md`.

Proceed to I18N-2 by extracting the Italian shared platform into synchronous catalogs while keeping the rendered Italian interface and bootstrap timing unchanged. Do not publish English routes until shared and game namespaces are complete and reviewed.
