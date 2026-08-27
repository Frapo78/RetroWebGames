# RetroWebGames

**RetroWebGames** è una raccolta di giochi arcade mobile-first eseguiti direttamente nel browser.

Sito ufficiale: `https://www.retrowebgames.it/`

## Giochi

### Star Swarm
Space shooter originale con campagna di almeno 100 livelli, 10 boss, 8 forme Weapon, POWER 1..20, Shield, Tractor Beam, wingmen, boss-clear intermedi e Game Over condiviso.

Percorso: `games/star-swarm/`

### Bubble Burst
Bubble shooter con 200 configurazioni deterministiche, timer/bonus per livello, pressione progressiva del soffitto, Armor/Star/Prism Bubble, Bomb, Color Wipe e level-clear arcade intermedi.

Percorso: `games/bubble-burst/`

### Block Drop
Falling-block puzzle 10×20 con 7-bag, ghost piece, wall-kick, soft/hard drop, line clear, livelli progressivi e anteprima pezzo.

Percorso: `games/block-drop/`

### Maze Munch
Maze chase con quattro inseguitori, pathfinding, surge nodes, combo, bonus, vite e livelli.

Percorso: `games/maze-munch/`

### Neon Rally
Paddle duel verticale first-to-7 con CPU adattiva, rally record e velocità crescente.

Percorso: `games/neon-rally/`

### Neon Snake
Snake arcade 20×28 con partenza accessibile, accelerazione graduale, Turbo ×2 press-and-hold, combo, bonus orb, Shield e ostacoli progressivi.

Percorso: `games/neon-snake/`

### Neon Tilt
Gravity maze portrait con `DeviceOrientationEvent`, calibrazione, joystick touch/frecce di fallback, 12 labirinti deterministici, cristalli, pits, bumper, ghiaccio e boost.

Percorso: `games/neon-tilt/`

### Solitario
Klondike classico pesca-1 con 52 carte, sette colonne, quattro fondazioni, stock/scarti, drag/tap/doppio tap, Undo, hint, timer, punteggio e due stili di carte.

Percorso: `games/solitaire/`

### Prism Breaker
Brick-breaker verticale originale con 100 livelli deterministici e distinti, strutture distribuite anche nel centro/basso dell'area di gioco, otto classi di brick, sei power-up, fisica fixed-step a 120 Hz e 10 boss ai livelli 10, 20, …, 100. Dopo il livello 100 riparte dal livello 1 in un nuovo ciclo con velocità e boss progressivamente più difficili, mantenendo punteggio e vite.

Percorso: `games/prism-breaker/`

## Autosalvataggio e ripresa — obbligatori su tutta la piattaforma

Ogni gioco attuale e futuro implementa la ripresa della partita non conclusa tramite il servizio centrale `RWGSession`.

Il comportamento è uniforme:

- autosalvataggio dopo mutazioni logiche importanti;
- heartbeat centrale ogni 5 secondi per i giochi continui;
- checkpoint su background, chiusura/reload, `pagehide`, `beforeunload`, `freeze` e normale navigazione interna;
- alla riapertura del gioco compare **“Vuoi continuare la partita precedente?”**;
- `No` rosso a sinistra elimina il vecchio snapshot e parte con una nuova partita;
- `Sì` verde a destra ripristina gratuitamente lo stato salvato;
- il sistema è indipendente dal Continue a 1 credito mostrato dopo Game Over.

### Invalidazione automatica

Lo storage usa il namespace:

```text
rwg.session.v2:<game-id>
```

Un salvataggio viene ripristinato solo se coincidono:

1. schema dell'envelope centrale;
2. game id;
3. versione dell'adapter;
4. compatibility token del gioco;
5. validazione semantica dello snapshot.

Qualsiasi incongruenza elimina automaticamente lo snapshot invece di tentare un ripristino rischioso.

I giochi con contenuto deterministico effettuano controlli aggiuntivi: Bubble Burst verifica la signature del layout, Star Swarm la signature della campagna e l'identità del boss, Solitario verifica le 52 carte canoniche e la struttura Klondike, Prism Breaker verifica la signature del livello e l'identità/configurazione del boss.

Il servizio condiviso evita scritture per frame: debounce attuale 750 ms, heartbeat 5 s tramite `requestIdleCallback` quando disponibile e limite snapshot 384 KiB.

Vengono persistiti solo dati logici autorevoli; particelle, trail, cache Canvas, AudioContext, DOM e altri effetti ricostruibili restano esclusi.

Source of truth: `docs/SESSION-PERSISTENCE.md`.

## Futuri giochi: enforcement automatico

`scripts/validate-session.mjs` scopre automaticamente ogni `games/*/index.html` con `data-rwg-game="true"`.

Un nuovo gioco deve esporre prima di `game-hud.js` un `RWGResumeAdapter` completo con:

```text
id
version
compatibility
isInProgress
serialize
validate
restore
startFresh
```

Il validator non usa una lista manuale: aggiungere un futuro gioco senza autosalvataggio fa fallire automaticamente la validazione del repository.

## Servizi condivisi

- `rwg-profile.js / .css` — profilo anonimo, statistiche e crediti prototipo;
- `rwg-avatar.js / .css` — avatar;
- `rwg-session.js / .css` — autosave/resume centralizzato;
- `game-hud.js / .css` — bootstrap e HUD condivisi;
- `game-over.js / .css` — Game Over, statistiche, achievement, share, Continue e replay;
- `orientation.js / .css` — portrait guard e countdown di ripresa.

I motori non devono duplicare questi servizi.

## Game Over e Continue

Quando una run termina davvero, il motore:

- ferma la simulazione;
- aggiorna i dati finali;
- emette `rwg:game-ended`;
- apre il Game Over condiviso.

Il Game Over offre condivisione, statistiche, achievement, `Continua con 1`, nuova partita e ritorno alla raccolta.

`RWGSession` free-resume e `rwg:continue-game` a credito sono due flussi distinti.

## Profilo, crediti e avatar

Il profilo anonimo persistente mantiene statistiche e saldo crediti nel browser. Ogni nuovo profilo riceve 10 crediti iniziali. Il wallet attuale è un prototipo client-side e non deve essere considerato autorità per futuri pagamenti reali.

È disponibile anche un avatar personalizzabile nella pagina `avatar/`.

## Condivisione social

Home, editor avatar e pagine gioco espongono metadati statici Open Graph e Twitter/X. Le intro dei giochi ricevono dal bootstrap condiviso cinque azioni social icon-only, senza markup duplicato nei singoli giochi. Il contratto completo è in `docs/SOCIAL-SHARING.md`.

## SEO e ricerca generativa

Home e nove giochi hanno title/description unici, canonical HTTPS, direttive rich-preview e grafi JSON-LD Schema.org (`WebSite`, `WebPage`, `ItemList`, `VideoGame`, breadcrumb). `scripts/seo-catalog.mjs` è la sorgente centralizzata; `scripts/apply-seo.mjs` rigenera il markup in modo idempotente, `scripts/generate-sitemap.mjs` crea la sitemap con `lastmod` Git e `scripts/validate-seo-geo.mjs` impedisce regressioni. L’editor avatar è intenzionalmente `noindex,follow`. Strategia, fonti ufficiali e limiti sono in `docs/SEO-GEO.md`.

## Modalità verticale

I giochi condividono un guard di orientamento per smartphone. In landscape la partita viene messa in pausa; tornando portrait viene mostrato il countdown `3 → 2 → 1 → GO!`.

Neon Tilt richiede inoltre un secure context e una `Permissions-Policy` che non blocchi accelerometro/giroscopio.

## Guardrail e documentazione tecnica

- `AGENTS.md` — contratto machine-oriented obbligatorio;
- `docs/ARCHITECTURE.md` — lifecycle e responsabilità condivise;
- `docs/SESSION-PERSISTENCE.md` — source of truth autosave/resume e invalidazione;
- `docs/STAR-SWARM.md` — source of truth Star Swarm;
- `docs/BUBBLE-BURST.md` — source of truth Bubble Burst;
- `docs/SOLITAIRE.md` — source of truth Solitario;
- `docs/PRISM-BREAKER.md` — source of truth Prism Breaker;
- `docs/SOCIAL-SHARING.md` — metadati pubblici e condivisione dalle intro;
- `docs/SEO-GEO.md` — strategia SEO/GEO, fonti e policy di indicizzazione;
- `docs/WASM-EVALUATION.md` — criteri per eventuale WASM;
- `scripts/validate-contracts.mjs` — validazione repository-wide;
- `scripts/validate-session.mjs` — coverage automatica autosave presente/futuro;
- `scripts/validate-bubble-burst.mjs` — invarianti Bubble Burst;
- `scripts/validate-solitaire.mjs` — invarianti Solitario;
- `scripts/validate-prism-breaker.mjs` — invarianti campagna/boss/fisica Prism Breaker;
- `scripts/validate-social-sharing.mjs` — copertura automatica metadati social.
- `scripts/validate-seo-geo.mjs` — canonical, metadati unici e dati strutturati.

Validazione completa:

```bash
node scripts/validate-contracts.mjs
```

Validator specifici:

```bash
node scripts/validate-session.mjs
node scripts/validate-bubble-burst.mjs
node scripts/validate-solitaire.mjs
node scripts/validate-prism-breaker.mjs
node scripts/validate-social-sharing.mjs
node scripts/validate-pwa-install.mjs
node scripts/validate-lazy-images.mjs
node scripts/validate-seo-geo.mjs
```

## Struttura essenziale

```text
/
├── AGENTS.md
├── README.md
├── index.html
├── rwg-profile.js / rwg-profile.css
├── rwg-avatar.js / rwg-avatar.css
├── rwg-session.js / rwg-session.css
├── game-hud.js / game-hud.css
├── game-over.js / game-over.css
├── orientation.js / orientation.css
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SESSION-PERSISTENCE.md
│   ├── STAR-SWARM.md
│   ├── BUBBLE-BURST.md
│   ├── SOLITAIRE.md
│   ├── PRISM-BREAKER.md
│   ├── SOCIAL-SHARING.md
│   ├── PWA-INSTALL.md
│   ├── LAZY-IMAGES.md
│   ├── SEO-GEO.md
│   └── WASM-EVALUATION.md
├── scripts/
│   ├── seo-catalog.mjs
│   ├── apply-seo.mjs
│   ├── generate-sitemap.mjs
│   ├── validate-contracts.mjs
│   ├── validate-session.mjs
│   ├── validate-bubble-burst.mjs
│   ├── validate-solitaire.mjs
│   ├── validate-prism-breaker.mjs
│   ├── validate-social-sharing.mjs
│   ├── validate-pwa-install.mjs
│   ├── validate-lazy-images.mjs
│   └── validate-seo-geo.mjs
├── avatar/
└── games/
    ├── star-swarm/
    ├── bubble-burst/
    ├── block-drop/
    ├── maze-munch/
    ├── neon-rally/
    ├── neon-snake/
    ├── neon-tilt/
    ├── solitaire/
    └── prism-breaker/
```

## Avvio locale

Il progetto è statico e non ha dipendenze esterne:

```bash
python3 -m http.server 8080 --directory public
```

Aprire `http://localhost:8080/`. Per il test reale dei sensori di Neon Tilt usare HTTPS o un ambiente considerato sicuro dal browser.

## Compatibilità

Canvas HTML5, DOM/CSS, Pointer Events, Web Audio API e Device Orientation Events dove necessario. L'interfaccia è ottimizzata per browser mobile moderni con fallback touch/tastiera.

## Nota sui giochi originali

RetroWebGames è un tributo ai generi arcade classici. Codice, nomi e grafica del progetto sono originali e non includono asset, marchi o personaggi dei videogiochi commerciali a cui il gameplay può ricordare.

## Installazione PWA

La home offre due superfici condivise e non invasive: un avviso slide-in dopo 2 secondi, mostrato una sola volta per browser, e una card dopo la lista giochi. `pwa-install.js` conserva il prompt nativo Chromium, gestisce il completamento e su iPhone/iPad nasconde i pulsanti non utilizzabili e mostra direttamente la procedura obbligatoria Condividi → Aggiungi alla schermata Home. `sw.js` usa una cache network-first per mantenere freschi i deploy online e offrire un fallback offline. La wordmark home deriva dalla cover approvata e conserva margini trasparenti più un gutter CSS, così nessun glifo può essere tagliato. Contratti e limiti sono in `docs/PWA-INSTALL.md` e `scripts/validate-pwa-install.mjs`.

## Caricamento immagini condiviso

La home usa `rwg-lazy-images.js` per caricare tutte le immagini soltanto quando si avvicinano al viewport. Il modulo supporta contenuti inseriti dinamicamente, fallback senza IntersectionObserver e un’API riutilizzabile nelle altre sezioni. Il markup conserva sempre dimensioni intrinseche, `loading="lazy"`, `decoding="async"` e la sorgente differita in `data-rwg-src`. Vedi `docs/LAZY-IMAGES.md` e `scripts/validate-lazy-images.mjs`.

## Classifiche globali

Ogni gioco mostra nell'intro la top 10 globale e, quando necessario, la posizione del browser corrente. A fine partita il pannello coin-op condiviso registra nickname, risultato, progressione, achievement e metriche di gioco nel servizio MariaDB del VPS. I Continue aggiornano la stessa partita e ne dichiarano il conteggio; una nuova partita crea invece una nuova voce. Dettagli tecnici, privacy, API e runbook sono in `docs/LEADERBOARDS.md`.
