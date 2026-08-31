# Siti Partner

La home di RetroWebGames ospita in fondo la sezione `Siti Partner`, pensata
per segnalare esperienze web indipendenti affini al pubblico della sala giochi.

Ogni partner usa una card statica e indicizzabile con nome, categoria,
descrizione breve, URL HTTPS e immagine locale autorizzata. Le immagini devono
passare dal loader condiviso `rwg-lazy-images.js`, avere dimensioni intrinseche
e vivere in `assets/partners/`. I link esterni aprono una nuova scheda con
`rel="external noopener noreferrer"`.

## Afelio

- URL: `https://afelio.space/`
- Categoria: gestionale strategico spaziale
- Asset master: `assets/partners/afelio-portrait.webp` (1080×1920)
- Asset home: `assets/partners/afelio-portrait-540.webp` (540×960)
- Provenienza asset: elaborazione locale della risorsa ufficiale
  `art/planet-rocky.webp`, estratta dall’archivio Safari autenticato fornito dal
  proprietario il 30 agosto 2026. Il pianeta resta il soggetto originale; per la
  card RWG sono stati aggiunti un campo nero con stelle lontane e il wordmark
  `AFELIO`, centrato orizzontalmente e verticalmente. La composizione 9:16 usa
  una coppia responsive e `object-fit: contain`, così pianeta e wordmark non
  vengono tagliati neppure nelle card più alte su smartphone stretti. Il vecchio
  asset quadrato resta archiviato come derivazione storica, ma non è operativo.

Per aggiungere un partner, replicare una `.partner-site-card`, mantenere il
lazy loading e aggiornare `scripts/validate-partners.mjs` con il nuovo elemento.
