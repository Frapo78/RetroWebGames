# Shared lazy images

`rwg-lazy-images.js` is the reusable image-loading controller for RetroWebGames public sections.

## Markup contract

Images managed by the controller must reserve their layout space and keep the network source out of `src` until they approach the viewport:

```html
<img
  data-rwg-src="/assets/example.png"
  width="640"
  height="360"
  alt="Descrizione"
  loading="lazy"
  decoding="async"
/>
```

Optional responsive fields are `data-rwg-srcset` and `data-rwg-sizes`. The loader transfers them to the native properties immediately before the source.

## Runtime behavior

- `IntersectionObserver` loads images within a 280 px prefetch margin.
- Browsers without IntersectionObserver load the marked images immediately rather than leaving missing content.
- A shared `MutationObserver` discovers marked images inserted after bootstrap.
- `window.RWGLazyImages.observe(root)` registers a newly rendered section explicitly.
- `window.RWGLazyImages.load(image)` is available for a deliberate immediate load.
- Width and height are mandatory to prevent layout shift.

The home loads the module directly. Other public sections can reuse it by including `/rwg-lazy-images.js` and following the same markup contract.

## Home game covers

Every game card uses a gameplay-derived 9:16 raster cover under `assets/covers/games/`. The 1080×1920 `*-portrait.jpg` file is the reusable vertical/social master; the paired 540×960 `*-portrait-540.jpg` file is the lightweight home candidate. Markup exposes both through `data-rwg-srcset`, while the card keeps the title in semantic HTML and treats the artwork as decorative.

Do not restore the former procedural thumbnail CSS or load the 1080 px source unconditionally. New games must provide both portrait sizes and use the shared lazy loader.

## Validation

```bash
node scripts/validate-lazy-images.mjs
node scripts/validate-contracts.mjs
```

The specialized validator inventories every home `img` and rejects eager `src`, missing lazy/async hints or missing intrinsic dimensions. It also verifies all nine responsive cover pairs and their exact JPEG dimensions.
