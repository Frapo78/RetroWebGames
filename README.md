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

## Struttura

```text
/
├── index.html                  # hub RetroWebGames
├── hub.css                     # stile della home
├── manifest.webmanifest        # manifest condiviso
├── game.js                     # motore Star Swarm
├── style.css                   # stile Star Swarm
└── games/
    ├── star-swarm/
    │   └── index.html
    └── bubble-burst/
        ├── index.html
        ├── style.css
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

L'interfaccia usa Canvas HTML5, Pointer Events e Web Audio API. È ottimizzata per browser mobile moderni e supporta mouse anche su desktop. I record vengono salvati nel browser tramite `localStorage`.

## Nota sui giochi originali

RetroWebGames è un tributo ai generi arcade classici. Codice, nomi e grafica del progetto sono originali e non include asset, marchi, personaggi o contenuti dei videogiochi commerciali a cui il gameplay può ricordare.
