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
- dopo ogni boss appare una schermata arcade dedicata con riepilogo punti, vite, arma, wingmen e tempo boss, starfield in movimento e ripresa al tap
- dopo il boss del livello 100 viene mostrato il completamento campagna e si sblocca la prosecuzione Overdrive
- vite, punteggio e high score locale
- power-up giallo Rapid Fire temporaneo
- power-up rosso a rombo con 8 livelli arma: Single Fire, Double Fire, Triple Diagonal, 4 Fire Linear, Fireballs 3 Way, Laser, 3 Way Lasers e 5 Way Lasers
- power-up verde Tractor Beam per risucchiare fino a 2 navicelle nemiche
- nemici catturati convertiti in wingmen che affiancano il player e sparano sempre in Single Fire
- wingmen vulnerabili a proiettili e collisioni nemiche
- fireball e laser con comportamento e grafica propri; i laser possono attraversare più bersagli
- stato arma, Rapid Fire, Tractor Beam e numero di wingmen mostrati direttamente sul campo
- particelle, vibrazione e Web Audio

Percorso: `games/star-swarm/`

### Bubble Burst
Bubble shooter originale ispirato ai classici puzzle arcade a bolle.
- trascinamento per mirare e rilascio per sparare
- traiettoria visualizzata e rimbalzi laterali
- griglia esagonale
- combinazioni di almeno tre bolle dello stesso colore
- caduta automatica dei gruppi non più collegati al soffitto
- penalità con nuova riga dopo una serie di tiri senza combinazioni
- difficoltà crescente, più colori e limite errori più severo
- punteggio, livelli e high score locale
- effetti particellari, vibrazione e Web Audio

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
`favicon.svg` è l'icona vettoriale ufficiale. La moneta dei crediti usa una skin pixel-art originale con animazione continua in stile arcade.

## Struttura

```text
/
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
├── avatar/
└── games/
    ├── star-swarm/
    │   ├── index.html
    │   ├── campaign.js
    │   ├── bosses.js
    │   └── campaign.css
    ├── bubble-burst/
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
