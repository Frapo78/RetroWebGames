# WebGalaga — Star Swarm

**Star Swarm** è una web app arcade mobile-first, pensata soprattutto per smartphone in verticale. Il gameplay richiama i classici fixed shooter spaziali: formazione di nemici, attacchi in picchiata, fuoco automatico, livelli progressivi, vite, punteggio e power-up.

## Caratteristiche

- Canvas HTML5, zero dipendenze esterne
- Controllo touch tramite trascinamento
- Fuoco automatico
- Nemici in formazione con attacchi in picchiata
- Proiettili nemici direzionati verso il giocatore
- Tre famiglie di nemici con punteggi e resistenza differenti
- Power-up `Rapid Fire`
- Livelli progressivi
- High score salvato in `localStorage`
- Effetti particellari, screen shake e audio generato con Web Audio API
- Layout verticale con supporto safe-area iPhone
- Manifest PWA di base

## Avvio locale

Essendo un progetto statico, basta servire la cartella con un web server:

```bash
python3 -m http.server 8080
```

Poi aprire `http://localhost:8080`.

## Controlli

Trascina la nave con dito o mouse. Il fuoco è automatico. I pulsanti in basso permettono di mettere in pausa e disattivare l'audio.

## Nota

Il progetto è un omaggio ai classici arcade spaziali e usa grafica, nomi e codice originali. Non include asset, marchi o contenuti del gioco Galaga originale.
