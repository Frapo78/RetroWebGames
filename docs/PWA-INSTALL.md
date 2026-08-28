# PWA installation

RetroWebGames is installable from the home page as a lightweight Progressive Web App.

## User flow

- On the first home visit only, after 500 ms, a compact notice slides in from the top.
- The notice is recorded under `rwg.pwa.install.notice.v1` in localStorage, with a cookie fallback if storage is unavailable.
- A permanent install card follows the game list until the app is running in standalone mode or installation completes.
- Chromium browsers use the deferred `beforeinstallprompt` event: the CTA opens the native install prompt directly.
- iOS/iPadOS Safari does not expose a programmable install prompt. The same CTA therefore reveals the shortest correct system path: Share, then “Add to Home Screen”.
- Other unsupported browsers receive equivalent menu guidance.

The wording must not claim zero disk usage. The app is lightweight, but the browser can retain shell/game resources in its cache.

## Installability and offline behavior

`manifest.webmanifest` remains the source of app identity, theme and icons. `pwa-install.js` registers `sw.js` at root scope. The service worker:

1. precaches the small home shell;
2. uses the network first for same-origin GET requests;
3. refreshes cached successful responses in the background of that request;
4. uses cached content only when the network fails;
5. falls back to the cached home page for offline navigation.

This network-first strategy avoids serving stale online deploys while providing a useful offline fallback.

## UI contracts

- `pwa-install.css` owns both the fixed notice and end-of-list card.
- The notice must remain within the viewport down to 320 px and respect the top safe area.
- All install buttons use `data-pwa-install`; fallback messages use `data-pwa-guidance`.
- Installed/standalone sessions must not show either install surface.
- The home wordmark is a complete transparent 1600×250 asset generated from the approved cover. CSS uses `contain`, centered positioning, visible overflow and an normal page gutter.

## Analytics

The shared analytics layer records browser availability/install completion with `pwa_install_prompt` and `pwa_install`. CTA outcomes are recorded by the install controller as `pwa_install_cta` with low-cardinality `method` and `result`.

## Validation

Run:

```bash
node scripts/validate-pwa-install.mjs
node scripts/validate-contracts.mjs
```

Browser smoke tests must cover a fresh context, repeat visit, supported native prompt, iOS guidance, standalone mode and 320/375/390 px widths.
