# RetroWebGames

**RetroWebGames** è una raccolta di piccoli giochi arcade mobile-first eseguiti direttamente nel browser. Il progetto nasce da Star Swarm ed è stato ampliato come raccolta di giochi pensata soprattutto per smartphone in verticale.

Sito ufficiale: `https://www.retrowebgames.it/`

## Giochi

### Star Swarm
Space shooter originale ispirato al genere dei classici fixed shooter arcade.
- controllo touch tramite trascinamento
- fuoco automatico
- campagna di almeno 100 livelli
- nei primi 100 stage ogni livello usa una combinazione univoca formazione/ingresso, con seed, geometria, curve, ritardi e coreografie dedicate
- ogni livello multiplo di 10 presenta prima una wave di scorta e poi un boss gigante
- 10 boss differenti nei livelli 10, 20, …, 100, con forme, energia, movimento, IA e armi differenti
- barra energia boss aggiornata in tempo reale, con stato critico e indicazione dello scudo quando previsto
- pattern boss progressivi: raffiche mirate, ventagli, teletrasporto, anelli radiali, mine, homing, torrette, laser a corsia e a scansione, pattern combinati finali
- dopo ogni boss appare una schermata arcade dedicata con riepilogo punti, vite, arma, POWER, wingmen e tempo boss, starfield in movimento e ripresa al tap
- dopo il boss del livello 100 viene mostrato il completamento campagna e si sblocca la prosecuzione Overdrive
- cinque fasce grafiche/resistenza dei nemici: Scout, Striker, Guardian, Armored e Dread, con HP crescenti lungo la campagna
- vite, punteggio e high score locale
- power-up giallo Rapid Fire temporaneo
- power-up rosso Weapon Upgrade con 8 forme: Single Fire, Double Fire, Triple Diagonal Fire, 4 Fire Linear, Fireballs 3 Way, Laser, 3 Way Lasers e 5 Way Lasers
- ogni avanzamento Weapon aggiunge anche un piccolo coefficiente di danno, da ×1,00 a ×1,21, indipendente dal livello POWER
- POWER è la forza del singolo colpo ed è segmentato in 20 livelli, con 20 colori differenti; la curva resta circa nella precedente escursione di danno 1→10
- il bonus POWER è più raro del precedente bilanciamento: base circa 1% per kill prima del moltiplicatore elite, massimo due drop POWER per stage
- Weapon Upgrade resta raro ma non usa la rarità dimezzata per errore: base 0,86% sui commander/type-2 e 0,49% sugli altri, prima del moltiplicatore elite
- Shield massimo uno per livello, capace di assorbire un colpo senza perdita vita/downgrade
- alla perdita di una vita senza Shield: Weapon -2 forme e POWER -2 livelli
- power-up verde Tractor Beam raro, al massimo uno ogni due livelli, per risucchiare fino a 2 navicelle nemiche
- nemici catturati convertiti in wingmen che affiancano il player e sparano sempre in Single Fire base
- wingmen vulnerabili a proiettili e collisioni nemiche
- fireball e laser con comportamento e grafica propri
- i laser attraversano ogni nemico colpito e continuano fino all'uscita dallo schermo; lo stesso laser colpisce ogni singolo bersaglio una sola volta
- stato arma, POWER, Rapid Fire, Tractor Beam, Shield e numero di wingmen mostrati direttamente sul campo
- terminal Game Over sempre delegato al componente condiviso con statistiche, achievement, share, Continue con 1 credito, Nuova partita e scelta altro gioco
- particelle, vibrazione e Web Audio

Percorso: `games/star-swarm/`

### Bubble Burst
Bubble shooter originale con campagna procedurale deterministica e grafica arcade dedicata.
- trascinamento per mirare e rilascio per sparare
- traiettoria visualizzata e rimbalzi laterali
- griglia esagonale a lookup locale
- **200 configurazioni artistiche distinte**: 20 famiglie visive × 10 varianti, con difficoltà crescente
- combinazioni di almeno tre bolle dello stesso colore e caduta automatica dei gruppi non più collegati al soffitto
- Armor Bubble dal livello 8: il primo match rompe la corazza
- Star Bubble dal livello 18: quando eliminata genera un'esplosione locale
- Prism Bubble dal livello 35: wildcard nei gruppi dello stesso colore
- rara munizione **Bomba** dal livello 10, con esplosione locale e probabilità massima circa 3%
- rara munizione **Color Wipe** dal livello 22, che cancella tutte le bolle del colore toccato e resta sotto circa il 2%
- penalità con nuova riga dopo una serie di tiri senza combinazioni
- difficoltà crescente tramite geometrie, numero di colori, special bubble, limite errori e velocità di tiro
- due personaggi **chibi pixel-art originali** gestiscono il lanciatore: operatore a sinistra e addetto munizioni a destra con preview della prossima bolla
- rendering ottimizzato con sprite Canvas cache, background cache e collisioni limitate alle celle vicine invece di scansioni complete della griglia
- lifecycle Game Over/Continue delegato all'infrastruttura condivisa RetroWebGames
- punteggio, livelli, high score locale, particelle, vibrazione e Web Audio

Percorso: `games/bubble-burst/`

### Block Drop
Falling-block puzzle originale ispirato ai classici giochi di incastro a blocchi.
- campo 10×20
- sette famiglie di pezzi distribuite con sistema 7-bag
- spostamento, rotazione, soft drop e hard drop
- piccoli wall-kick durante la rotazione
- ghost piece
- eliminazione da una a quattro linee contemporaneamente
- punteggio moltiplicato per il livello
- aumento di velocità ogni 10 linee
- anteprima del prossimo pezzo
- controlli touch e gesture
- supporto tastiera su desktop
- high score in `localStorage`

Percorso: `games/block-drop/`

### Maze Munch
Maze-chase originale ispirato ai grandi classici da sala giochi basati su labirinti e inseguimenti.
- labirinto con punti e tunnel laterale
- quattro inseguitori con strategie differenti
- pathfinding sul labirinto
- surge nodes e combo catture
- bonus temporanei
- vite, punteggio, livelli e high score
- swipe, controlli touch e frecce/WASD
- vibrazione e Web Audio

Percorso: `games/maze-munch/`

### Neon Rally
Paddle duel originale ispirato ai classici giochi arcade a racchette e pallina.
- campo verticale
- racchetta touch
- CPU adattiva
- rimbalzi basati sul punto d'impatto
- velocità crescente
- primo a 7 punti
- rally record
- mouse e tastiera desktop
- vibrazione e Web Audio

Percorso: `games/neon-rally/`

### Neon Snake
Snake arcade originale con meccaniche aggiuntive.
- griglia 20×28
- swipe, pulsanti e frecce/WASD
- combo fino a ×5
- orb bonus e shield
- ostacoli progressivi
- accelerazione graduale
- particelle, vibrazione e Web Audio
- high score locale

Percorso: `games/neon-snake/`

### Neon Tilt
Gravity maze originale progettato per sfruttare accelerometro e giroscopio dei telefoni moderni.
- controllo principale tramite `DeviceOrientationEvent` in HTTPS
- richiesta permesso sensori avviata dal tap dell'utente quando richiesta dal browser
- calibrazione della posizione neutra e pulsante `CAL` per ricalibrare
- filtro dell'input, dead-zone e limite di inclinazione
- fallback completo tramite joystick touch sul canvas e frecce/WASD
- 12 labirinti portrait 13×19 generati con seed deterministici e percorso garantito
- cristalli obbligatori per aprire il portale
- voragini, bumper, ghiaccio e boost direzionali
- fisica con accelerazione, attrito, velocità massima, sub-step e collisioni circle/AABB
- tre vite, punteggio, bonus tempo, livelli continui e high score
- particelle, vibrazione e Web Audio
- integrazione con portrait guard, HUD comune, profilo, crediti, continue e modal game-over
- motore fisico separato in `physics.js`, pronto per un eventuale porting WebAssembly se il profiling reale lo renderà utile

Percorso: `games/neon-tilt/`

## Condivisione
La home include un dock di condivisione mobile-first con WhatsApp come azione principale e collegamenti rapidi a Facebook, X, Telegram e LinkedIn. Le pagine gioco dispongono inoltre dell'HUD condiviso e del riepilogo game-over con condivisione del risultato.

## Modalità verticale
Tutti i giochi condividono un guard di orientamento per smartphone. In landscape la partita viene messa in pausa e appare un avviso animato. Tornando portrait viene mostrato il countdown `3 → 2 → 1 → GO!` prima della ripresa.

## Profilo, crediti e avatar
Il client mantiene attualmente un profilo anonimo persistente nel browser con statistiche di gioco e saldo crediti. Ogni nuovo profilo riceve 10 crediti iniziali. Il sistema è già astratto per una futura autorità server-side e per l'integrazione acquisti. È disponibile anche un avatar personalizzabile e persistente nella pagina `avatar/`.

## Identità visiva
`favicon.svg` è l'icona vettoriale ufficiale. Il manifest include anche icone PNG 192×192, 512×512 e 512×512 maskable per l'installazione PWA. La moneta dei crediti usa una skin pixel-art originale con animazione continua in stile arcade.

## Guardrail e documentazione tecnica

Il repository contiene contratti espliciti per evitare regressioni tra motori di gioco e servizi condivisi:

- `AGENTS.md` — istruzioni machine-oriented e invarianti obbligatorie per agenti/coding assistant
- `docs/ARCHITECTURE.md` — lifecycle e responsabilità dei componenti condivisi
- `docs/STAR-SWARM.md` — source of truth per campagna, boss, drop, Weapon/POWER/Shield/wingmen
- `docs/BUBBLE-BURST.md` — source of truth per 200 layout, special bubble, munizioni rare e performance
- `docs/WASM-EVALUATION.md` — decisione e soglie tecniche per un eventuale uso futuro di WebAssembly
- `scripts/validate-contracts.mjs` — validatore statico anti-regressione repository-wide
- `scripts/validate-bubble-burst.mjs` — guardrail specifici Bubble Burst

Dopo modifiche architetturali o gameplay eseguire:

```bash
node scripts/validate-contracts.mjs
```

Per modifiche Bubble Burst eseguire inoltre:

```bash
node scripts/validate-bubble-burst.mjs
```

oltre a `node --check` sui JavaScript modificati.

## Struttura

```text
/
├── AGENTS.md
├── README.md
├── index.html
├── favicon.svg
├── hub.css
├── hub-games.css
├── hub-share.css
├── hub-share.js
├── rwg-profile.js / rwg-profile.css
├── rwg-avatar.js / rwg-avatar.css
├── game-hud.js / game-hud.css
├── game-over.js / game-over.css
├── orientation.js / orientation.css
├── manifest.webmanifest
├── docs/
│   ├── ARCHITECTURE.md
│   ├── STAR-SWARM.md
│   ├── BUBBLE-BURST.md
│   └── WASM-EVALUATION.md
├── scripts/
│   ├── validate-contracts.mjs
│   └── validate-bubble-burst.mjs
├── avatar/
└── games/
    ├── star-swarm/
    ├── bubble-burst/
    │   ├── index.html
    │   ├── levels.js
    │   ├── game.js
    │   └── style.css
    ├── block-drop/
    ├── maze-munch/
    ├── neon-rally/
    ├── neon-snake/
    └── neon-tilt/
        ├── index.html
        ├── style.css
        ├── levels.js
        ├── physics.js
        ├── render.js
        └── game.js
```

## Avvio locale
Il progetto è statico e non ha dipendenze esterne:

```bash
python3 -m http.server 8080
```

Aprire poi `http://localhost:8080/`. I sensori di orientamento richiedono un secure context; per il test reale del tilt usare il dominio HTTPS o un ambiente locale considerato sicuro dal browser.

## Compatibilità
L'interfaccia usa Canvas HTML5, Pointer Events, Web Audio API e, per Neon Tilt, Device Orientation Events. È ottimizzata per browser mobile moderni e mantiene fallback touch/tastiera quando i sensori non sono disponibili o il permesso viene negato.

## Nota sui giochi originali
RetroWebGames è un tributo ai generi arcade classici. Codice, nomi e grafica del progetto sono originali e non includono asset, marchi, personaggi o contenuti dei videogiochi commerciali a cui il gameplay può ricordare.
