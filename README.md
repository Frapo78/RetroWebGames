# RetroWebGames

**RetroWebGames** è una raccolta di piccoli giochi arcade mobile-first eseguiti direttamente nel browser. Il progetto nasce da Star Swarm ed è stato ampliato come raccolta di giochi pensata soprattutto per smartphone in verticale.

Demo VPS indicata per il progetto: `http://91.134.23.24:8112/`

## Giochi

### Star Swarm

Space shooter originale ispirato al genere dei classici fixed shooter arcade.

- controllo touch tramite trascinamento
- fuoco automatico
- formazione di nemici e attacchi in picchiata
- proiettili nemici
- livelli progressivi
- vite, punteggio e high score locale
- power-up Rapid Fire
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
- ghost piece per mostrare il punto di caduta
- eliminazione da una a quattro linee contemporaneamente
- punteggio moltiplicato per il livello
- aumento di velocità ogni 10 linee
- anteprima del prossimo pezzo
- controlli touch dedicati e gesture sul campo
- supporto tastiera su desktop
- pausa automatica quando la pagina passa in background
- high score salvato in `localStorage`

Percorso: `games/block-drop/`

### Maze Munch

Maze-chase originale ispirato ai grandi classici da sala giochi basati su labirinti e inseguimenti.

- labirinto completo con punti da raccogliere e tunnel laterale
- quattro inseguitori con strategie di caccia differenti
- pathfinding sul labirinto per evitare movimenti casuali o loop banali
- surge nodes che rendono temporaneamente vulnerabili gli inseguitori
- combo progressiva catturando più nemici durante lo stesso surge
- bonus temporanei che appaiono durante il livello
- vite, punteggio, livelli e high score locale
- difficoltà crescente con inseguitori più rapidi
- controlli touch tramite swipe e pulsanti direzionali
- supporto frecce/WASD su desktop
- pausa, vibrazione e Web Audio

Percorso: `games/maze-munch/`

## Struttura

```text
/
├── index.html                  # hub RetroWebGames
├── hub.css                     # stile principale della home
├── hub-games.css               # illustrazioni aggiuntive del catalogo
├── manifest.webmanifest        # manifest condiviso
├── game.js                     # motore Star Swarm
├── style.css                   # stile Star Swarm
└── games/
    ├── star-swarm/
    │   └── index.html
    ├── bubble-burst/
    │   ├── index.html
    │   ├── style.css
    │   └── game.js
    ├── block-drop/
    │   ├── index.html
    │   ├── style.css
    │   └── game.js
    └── maze-munch/
        ├── index.html
        ├── style.css
        ├── config.js
        ├── engine.js
        ├── render.js
        └── game.js
```

La struttura mantiene ogni nuovo gioco in `games/<slug>/`, mentre la root resta il catalogo. Star Swarm continua a riutilizzare i file originali in root per evitare una migrazione distruttiva del primo motore.

## Avvio locale

Il progetto è statico e non ha dipendenze esterne:

```bash
python3 -m http.server 8080
```

Aprire poi `http://localhost:8080/`.

## Compatibilità

L'interfaccia usa Canvas HTML5 e Pointer Events, con Web Audio API nei giochi che includono effetti sonori. È ottimizzata per browser mobile moderni e supporta mouse/tastiera anche su desktop. I record vengono salvati nel browser tramite `localStorage`.

## Nota sui giochi originali

RetroWebGames è un tributo ai generi arcade classici. Codice, nomi e grafica del progetto sono originali e non include asset, marchi, personaggi o contenuti dei videogiochi commerciali a cui il gameplay può ricordare.
