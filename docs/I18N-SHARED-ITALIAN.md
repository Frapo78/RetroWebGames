# I18N-2 — Shared platform italiana

Status: **PASS — non pubblicato**

Date: 2026-09-08

## Risultato

La UI condivisa italiana usa ora un catalogo sorgente unico (`src/i18n/it/shared.mjs`) e il piccolo runtime sincrono `RWGI18n`. La migrazione copre Game Over, pausa e conferme, resume, leaderboard/nickname, profilo/crediti/avatar, dock/share/orientation, PWA install e shell essenziale di Home.

Il testo resta italiano e l’aspetto non cambia. Questa fase non crea route pubbliche incomplete e non modifica motori, snapshot, chiavi storage, run id, classifiche o accounting dei crediti.

## Build e bootstrap

```bash
npm run build:i18n
```

`scripts/build-i18n.mjs` genera deterministicamente `public/rwg-i18n.js`. Ogni pagina italiana lo carica una sola volta, in modo sincrono e prima dei runtime shared/game. Le pagine conservano copy italiano di fallback nel markup; il binding dichiarativo viene applicato solo quando `html[lang="it"]`, quindi il POC EN isolato non viene sovrascritto.

API disponibile:

```text
RWGI18n.locale / languageTag / catalog
RWGI18n.t(key, namedParams)
RWGI18n.number(value)
RWGI18n.date(value)
RWGI18n.duration(milliseconds)
RWGI18n.pluralCategory(value)
RWGI18n.localize(root)
```

Le chiavi mancanti generano un errore esplicito. I formatter `Intl` sono lazy: non gravano sul bootstrap se la pagina non li usa.

## Cache e compatibilità

- query condivisa: `20260908.1` su `game-hud.js` e `orientation.js`, propagata alle dipendenze;
- Home e Avatar versionano direttamente i runtime modificati;
- service worker ruotato a `rwg-shell-v4` e `rwg-i18n.js` aggiunto alla shell;
- profile `rwg.profile.v1`, session `rwg.session.v2:*`, avatar versionato e queue leaderboard restano language-neutral.

## Verifica

- `bash scripts/validate-local.sh`: PASS;
- `bash scripts/validate-local.sh validate-i18n.mjs`: PASS;
- Playwright: 12 pagine × 3 viewport (`320×568`, `390×844`, `1366×768`) = 36/36 PASS;
- overflow orizzontale: nessuno;
- errori pagina/network non API: nessuno;
- bootstrap I18N p95 headless: **0,30 ms**, budget **15 ms**;
- runtime non compresso: sotto il guardrail di 24 KiB.

Lo smoke è ripetibile con `node scripts/smoke-i18n-shared.mjs` mentre `public/` è servita su `127.0.0.1:4330` (oppure impostando `RWG_I18N_BASE`).

## Rollout

Nessun deploy in I18N-2. Il prossimo gate è I18N-3: catalogo inglese completo, Home/discovery e tutti i giochi EN, metadata/route/sitemap/hreflang e revisione umana. Solo una lingua completa può essere pubblicata.
