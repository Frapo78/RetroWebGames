# RetroWebGames — TODO

> Backlog operativo del progetto. Questo file descrive il piano di lavoro e l'ordine di esecuzione; non sostituisce i contratti autorevoli in `AGENTS.md` e `docs/`. In caso di conflitto prevalgono sempre i documenti source-of-truth e i validator del repository.

## Obiettivo principale — migrazione dei giochi verso un'architettura OOP ad alte prestazioni

Trasformare progressivamente i runtime dei giochi da monoliti o singleton globali a un'architettura modulare, object-oriented e orientata alla composizione, mantenendo o migliorando le prestazioni su mobile e desktop.

La migrazione NON deve diventare un esercizio di OOP accademica. L'obiettivo è ottenere contemporaneamente:

- codice più leggibile e modificabile;
- responsabilità isolate e testabili;
- minore rischio di regressioni;
- game loop più prevedibili;
- meno allocazioni e meno garbage collection nei percorsi caldi;
- rendering più efficiente;
- serializzazione dello stato più semplice e sicura;
- possibilità di profilare e ottimizzare sistemi isolati;
- nessuna duplicazione dei servizi condivisi RWG;
- nessuna perdita delle meccaniche o del bilanciamento attuale.

### Principio architetturale

Adottare un modello ibrido **OOP + data-oriented hot paths**:

```text
Game / orchestrator
  ├─ State / authoritative logical state
  ├─ Simulation systems
  ├─ Renderer
  ├─ Input controller
  ├─ Audio / feedback
  ├─ game-specific adapters
  └─ RWG platform integration
```

Usare classi per componenti con identità, responsabilità o ciclo di vita. Nei loop ad alta frequenza preferire strutture dati semplici, array riutilizzati, typed array quando misurato utile, funzioni pure e sistemi che elaborano dati in batch.

Non creare una gerarchia universale `BaseGame -> ArcadeGame -> ShooterGame -> ...`. Ogni gioco deve poter usare la composizione più adatta al proprio dominio. Una piccola interfaccia concettuale comune è accettabile, un super-framework condiviso non lo è.

---

# 1. Vincoli non negoziabili

- [ ] Conservare `AGENTS.md` e `docs/ARCHITECTURE.md` come autorità sui confini piattaforma/gioco.
- [ ] I giochi continuano a possedere simulazione, rendering e stato gameplay privato.
- [ ] `RWGSession`, Game Over, pause, profilo, avatar, credits, leaderboard, share, orientation e controlli condivisi restano servizi root.
- [ ] Ogni `RWGResumeAdapter` deve essere disponibile prima di `game-hud.js`.
- [ ] Non introdurre un nuovo storage locale per le sessioni dei giochi.
- [ ] Non serializzare DOM, Canvas, cache, AudioContext, pointer state, particelle ricostruibili o altri oggetti visual-only.
- [ ] Non cambiare gameplay e architettura nello stesso passo, salvo fix indispensabili e documentati.
- [ ] Non cambiare schema/compatibility token di resume se il payload autorevole resta semanticamente identico.
- [ ] Se lo schema cambia davvero, aggiornare versione, compatibility token, doc e validator nello stesso intervento.
- [ ] Non introdurre dipendenze runtime esterne, framework di gioco o bundler solo per ottenere OOP.
- [ ] Nella prima migrazione mantenere script classici ordinati esplicitamente; valutare ES Modules solo dopo avere risolto in modo formale il bootstrap sincrono del `RWGResumeAdapter`.
- [ ] Non introdurre WebAssembly senza misurazioni conformi a `docs/WASM-EVALUATION.md`.
- [ ] Non introdurre GitHub Actions: validazione locale obbligatoria.

---

# 2. Strategia prestazionale generale

## 2.1 Misurare prima di ottimizzare

Prima di rifattorizzare ogni gioco:

- [ ] registrare baseline funzionale;
- [ ] registrare baseline prestazionale su almeno un viewport mobile portrait e desktop;
- [ ] misurare script time/frame, frame pacing, long task, heap, GC visibili e numero approssimativo di entità attive;
- [ ] identificare i veri hot path prima di introdurre pooling, spatial hash o typed array;
- [ ] conservare i risultati in una sezione performance della doc specifica del gioco o in una futura doc dedicata.

Baseline già disponibile in `docs/WASM-EVALUATION.md` del 27/08/2026:

- Star Swarm headless 390x844: circa 0,68 ms di script/frame;
- Neon Tilt headless 390x844: circa 1,54 ms di script/frame.

Questi dati non sostituiscono benchmark su telefoni reali.

## 2.2 Budget frame

Target generale per Canvas games:

- [ ] puntare a 60 Hz fluidi sui moderni smartphone supportati;
- [ ] evitare che simulation + game rendering consumino l'intero budget di 16,7 ms;
- [ ] mantenere idealmente il lavoro JS di gameplay sotto circa 4 ms/frame nei carichi ordinari, coerentemente con la soglia di indagine WASM già documentata;
- [ ] nessuna regressione significativa rispetto alla baseline dello stesso gioco senza motivazione misurata;
- [ ] monitorare p95/p99 frame time, non soltanto la media;
- [ ] considerare separatamente costo JS, painting/compositing e GPU/Canvas.

La soglia di merge non deve dipendere da un unico numero assoluto: ogni refactor deve essere almeno equivalente alla baseline e preferibilmente migliore nei percorsi critici.

## 2.3 Allocazioni e garbage collection

Regole per tutti i game loop:

- [ ] evitare `new`, object spread, array temporanei e closure create per frame nei loop più caldi quando possono essere riutilizzati;
- [ ] non trasformare ogni proiettile, particella o cella in un'istanza di classe se ciò aumenta churn e dereference senza vantaggi reali;
- [ ] preferire pool solo per entità ad alto churn e solo se il profiler mostra pressione GC;
- [ ] riutilizzare buffer/array per query spaziali, collision results e path temporanei;
- [ ] usare swap-remove o compattazione in-place dove l'ordine non è semanticamente importante;
- [ ] evitare `Array.shift()` nei percorsi ripetuti; usare indici di coda, come già previsto in Bubble Burst;
- [ ] evitare `filter/map/reduce` per frame sulle collezioni grandi se una singola scansione in-place è più economica;
- [ ] evitare `structuredClone` nei percorsi di frame; limitarlo a snapshot/azioni discrete se davvero necessario.

## 2.4 Data layout

- [ ] mantenere plain objects per entità poco numerose e semantiche;
- [ ] valutare Structure-of-Arrays/TypedArrays soltanto per sistemi con molte entità e vantaggio misurato;
- [ ] separare dati autorevoli da dati render-only;
- [ ] mantenere indici/id stabili quando aiutano collisioni, resume e pooling;
- [ ] non introdurre getter/setter o proxy nei percorsi caldi;
- [ ] preferire proprietà con shape stabile negli oggetti frequentemente elaborati per aiutare l'ottimizzazione JIT.

## 2.5 Rendering Canvas 2D

- [ ] conservare il cap di `devicePixelRatio` dove già presente e verificarne l'effetto visivo/prestazionale;
- [ ] minimizzare cambi ripetuti di `fillStyle`, `strokeStyle`, `shadowBlur`, `globalCompositeOperation`, font e transform;
- [ ] raggruppare draw call per stile quando non cambia l'ordine visivo;
- [ ] usare cache offscreen per artwork statico, gradienti costosi, sprite procedurali e background;
- [ ] invalidare le cache solo quando cambiano dimensione/configurazione;
- [ ] evitare gradienti/ombre costose ricostruite per ogni entità a ogni frame;
- [ ] non ridisegnare HUD DOM se il valore visualizzato non è cambiato;
- [ ] mantenere trail/particles bounded;
- [ ] evitare salvataggi/ripristini Canvas (`save/restore`) annidati inutilmente nei loop con molte entità;
- [ ] misurare prima di introdurre dirty rectangles: su Canvas full-screen moderni possono complicare il codice senza migliorare il risultato.

## 2.6 DOM e layout

- [ ] cache delle referenze DOM in fase di bootstrap;
- [ ] niente `querySelector` ripetuti nel game loop;
- [ ] niente letture layout (`getBoundingClientRect`, `offsetWidth`, ecc.) mischiate a scritture per frame salvo casi indispensabili;
- [ ] `ResizeObserver` per container che possono cambiare indipendentemente dal viewport;
- [ ] resize idempotente e separato dal frame loop;
- [ ] aggiornare timer/HUD solo quando cambia il testo effettivamente mostrato;
- [ ] Solitario deve continuare a renderizzare solo dopo mutazioni discrete, eccetto timer/animazioni.

## 2.7 Input

- [ ] un solo controller per gioco traduce DOM/Pointer/keyboard/sensor in intenti semplici;
- [ ] nessuna logica gameplay duplicata nei listener;
- [ ] usare pointer capture quando serve;
- [ ] evitare listener per-entità DOM quando è possibile event delegation;
- [ ] stati transitori come Turbo, drag e gesture non vanno persistiti;
- [ ] normalizzare input una volta per frame o per evento, non in più sistemi indipendenti.

## 2.8 Audio e feedback

- [ ] un solo AudioContext per gioco o servizio audio locale;
- [ ] evitare creazione/inizializzazione ripetuta di AudioContext;
- [ ] separare chiamate sonore dalla logica core tramite metodi/eventi leggeri;
- [ ] non creare sistemi event-bus generici per ogni collisione: nei hot path usare chiamate dirette o piccoli command buffer;
- [ ] vibrazione sempre discreta, mai per frame.

## 2.9 Collisioni e query spaziali

- [ ] usare broad-phase solo dove il costo O(n*m) è misurabile;
- [ ] preferire grid/hash coerenti con la geometria naturale del gioco;
- [ ] conservare substep per proiettili veloci dove già necessario;
- [ ] evitare allocazioni per ogni collision test;
- [ ] precalcolare geometria statica e adjacency quando possibile;
- [ ] per pathfinding statico valutare distance maps/precomputed graph rispetto a BFS completi ripetuti.

## 2.10 Timing

- [ ] distinguere simulation time, active play time, UI/intermission time e wall clock;
- [ ] fixed timestep per fisiche che lo richiedono, interpolazione/render separato solo se offre vantaggi reali;
- [ ] accumulatori bounded per evitare spiral of death dopo background/tab stall;
- [ ] `dt` clamp obbligatorio nei loop variabili;
- [ ] pausa/orientation/background non devono consumare timer di gameplay quando il contratto lo vieta.

## 2.11 Persistenza

- [ ] `serialize()` deve fare lavoro proporzionato allo stato logico, non allo stato visuale;
- [ ] evitare di costruire snapshot durante ogni RAF;
- [ ] chiamare `markDirty()` solo per mutazioni significative;
- [ ] lasciare debounce, heartbeat e deduplicazione a `RWGSession`;
- [ ] validazione semantica rigorosa ma non eseguita continuamente nel game loop;
- [ ] mantenere snapshot compatti e deterministici.

---

# 3. Architettura target comune, senza super-framework

## 3.1 Composition root

Ogni gioco deve arrivare progressivamente a un orchestratore esplicito, per esempio:

```js
class NeonRallyGame {
  constructor({ state, physics, renderer, input, audio, ui }) {}
  start() {}
  pause() {}
  resume() {}
  update(dt) {}
  render(now) {}
  endRun() {}
}
```

Responsabilità del `Game`:

- lifecycle;
- coordinamento dei sistemi;
- transizioni di fase;
- collegamento con RWG;
- start/new run/Continue/restore;
- ownership del RAF se il gioco è real-time.

Non deve contenere centinaia di righe di collisioni o rendering specifico.

## 3.2 State

Lo stato autorevole deve essere esplicito e serializzabile:

```text
GameState
  score
  level
  lives
  phase
  entities / board
  gameplay timers
  deterministic progression state
```

Regole:

- niente DOM;
- niente CanvasRenderingContext2D;
- niente AudioContext;
- niente cache;
- niente funzioni nel payload serializzato;
- niente pointer event;
- niente particelle visual-only se ricostruibili.

Non è obbligatorio che `GameState` sia una classe. Nei giochi ad alto throughput può essere un plain object stabile gestito da sistemi.

## 3.3 Systems

Preferire sistemi verticali e piccoli:

```text
PhysicsSystem
CollisionSystem
EnemySystem
ProjectileSystem
PowerUpSystem
BoardSystem
ScoringSystem
PressureSystem
BossSystem
```

Un sistema può essere classe o modulo funzionale. La scelta dipende da:

- stato interno;
- ciclo di vita;
- necessità di cache/buffer;
- costo nel hot path.

## 3.4 Renderer

Il renderer riceve stato e view metrics, non decide le regole.

Permesso:

- cache Canvas;
- sprite cache;
- layout metrics;
- view-only animation phase;
- interpolation/render trails.

Non permesso:

- assegnare punti;
- togliere vite;
- decidere collisioni authoritative;
- modificare progressione o snapshot.

## 3.5 Input controller

L'input controller produce intenzioni:

```text
moveX / moveY
requestedDirection
launch
fire
rotate
hardDrop
pause request
```

Le regole restano nel gioco/sistema corretto.

## 3.6 Adapter RWG

L'adapter deve restare semplice e sottile:

```text
serialize -> state autorevole
validate -> schema + semantica
restore -> ricostruzione state
startFresh -> game.startNewRun()
```

Il refactor non deve trasformare `RWGResumeAdapter` in un secondo engine.

---

# 4. Fase 0 — infrastruttura di migrazione e performance harness

Priorità: P0.

- [x] Creare `docs/GAME-OOP-ARCHITECTURE.md` dopo l'approvazione del pattern del primo gioco. *(2026-09-02, pattern stabilito da The Great Empire)*
- [x] Documentare ufficialmente il modello OOP + data-oriented.
- [x] Aggiungere in `AGENTS.md` il riferimento al nuovo documento quando diventa contratto stabile.
- [x] Definire naming convenzionale dei moduli locali senza imporre file identici a ogni gioco. *(levels/state/systems/snapshot/renderer/input + composition root)*
- [ ] Definire regola: nessuna allocazione intenzionale per-frame nei hot path dei giochi heavy, salvo misurazione che dimostri irrilevanza.
- [ ] Definire regola: nessuna query DOM ripetuta per frame.
- [ ] Definire regola: nessuna scrittura DOM se valore invariato.
- [ ] Creare un piccolo benchmark harness locale ripetibile, senza GitHub Actions.
- [ ] Il harness deve poter raccogliere almeno RAF count, elapsed time, JS heap quando disponibile e marker custom per update/render.
- [ ] Aggiungere scenari manuali o scriptabili per 390x844, 375x667, 320x568 e desktop.
- [ ] Conservare baseline pre-refactor per ogni gioco prima di modificarlo.
- [ ] Aggiornare `scripts/validate-contracts.mjs` solo quando il nuovo layout dei file rende i controlli letterali troppo legati al monolite.
- [ ] I validator devono verificare contratti/behavior marker nel nuovo modulo corretto, non obbligare artificialmente a ricopiare codice in `game.js`.
- [x] Non avviare migrazioni massive finché il pattern non è dimostrato. *(dimostrato su un gioco nuovo invece che su una migrazione: nessun gameplay esistente a rischio)*

### Gate Fase 0

- [ ] benchmark ripetibile;
- [ ] contratti piattaforma invariati;
- [ ] strategia file-loading definita;
- [ ] nessuna dipendenza esterna aggiunta;
- [ ] core validator verdi.

---

# 5. Fase 1 — The Great Empire, progetto pilota ✅

Priorità: P0. **Completata il 2026-09-02.**

Il pilota non è più Neon Rally. Su richiesta, il pattern è stato dimostrato scrivendo da zero un gioco nuovo — `games/the-great-empire/` — invece di rifattorizzare un runtime esistente.

Il motivo per cui questa scelta è migliore, e non solo diversa: una migrazione deve provare contemporaneamente che l'architettura funziona *e* che il gameplay è rimasto identico. Con un gioco nuovo il secondo vincolo non esiste, quindi il pattern si giudica per quello che è. Non c'era inoltre alcun resume, punteggio o bilanciamento già in mano ai giocatori da mettere a rischio.

Risultato: `levels.js` (contenuto puro), `state.js` (stato autorevole), `systems.js` (simulazione), `snapshot.js` (serializzazione pura), `renderer.js`, `input.js` e `game.js` come composition root. Il DOM si ferma alla radice, quindi `scripts/validate-the-great-empire.mjs` gioca partite intere senza browser: vittoria, sconfitta, tetto di popolazione, riuso del pool e rifiuto di tredici snapshot manomessi.

Neon Rally resta un candidato alla migrazione, ora con un pattern già provato alle spalle. I task qui sotto restano validi per quel lavoro.

## Neon Rally — migrazione (rimandata, non annullata)

## Struttura target indicativa

```text
games/neon-rally/
  config.js
  state.js
  physics.js
  renderer.js
  input.js
  audio.js
  game.js
```

Possibili componenti:

- `NeonRallyGame`;
- `RallyState` o plain state object;
- `RallyPhysics`;
- `RallyAI` se la CPU merita isolamento;
- `RallyRenderer`;
- `RallyInputController`;
- `RallyAudio`.

## Task

- [ ] Baseline FPS/frame time/heap.
- [ ] Spostare costanti/config fuori dal runtime orchestration.
- [ ] Separare stato autorevole da view state (`trail`, `flash` se non persistenti).
- [ ] Estrarre collisione palla/racchetta e point resolution.
- [ ] Estrarre CPU prediction senza creare oggetti temporanei per frame.
- [ ] Estrarre renderer e riusare gradient/background cache se il profiler mostra costo utile da eliminare.
- [ ] Evitare creazione del gradient di background ogni frame: precalcolare/cachare a resize.
- [ ] Valutare trail come ring buffer o array riutilizzato invece di churn push/shift.
- [ ] Estrarre input; nessuna logica partita nei listener.
- [ ] Estrarre audio.
- [ ] Lasciare `game.js` come bootstrap/composition root + lifecycle RWG.
- [ ] Conservare compatibility `neon-rally-state-v1-first-to-7` se payload e semantica restano identici.
- [ ] Verificare Continue con punteggio pieno.
- [ ] Verificare pause shared, orientation e resize post-load CSS.
- [ ] Aggiornare validator se necessario.

### Criteri di accettazione

- [ ] gameplay indistinguibile;
- [ ] stessa curva CPU/ball speed;
- [ ] stessa first-to-7 logic;
- [ ] stessa semantica best rally;
- [ ] resume precedente ancora valido se schema invariato;
- [ ] nessun aumento misurabile significativo del frame cost;
- [ ] preferibile riduzione di allocazioni del trail e del rendering;
- [ ] validator repository-wide verdi.

Dopo questa fase decidere il pattern definitivo da documentare in `docs/GAME-OOP-ARCHITECTURE.md`.

---

# 6. Fase 2 — Block Drop

Priorità: P0/P1.

## Architettura target

- `BlockDropGame`;
- `Board` o `BoardState`;
- `PieceBag`;
- `PieceRules` / funzioni pure collision/rotation;
- `BlockDropRenderer`;
- `BlockDropInputController`.

## Ottimizzazioni specifiche

- [ ] board 10x20 rappresentata in modo semplice e cache-friendly;
- [ ] valutare array piatto di 200 celle invece di array di array solo se migliora chiarezza/performance misurata;
- [ ] evitare clone della matrice durante il normale movimento;
- [ ] precalcolare le quattro rotazioni dei tetramini invece di costruire matrici a ogni rotazione;
- [ ] collision test senza allocazioni;
- [ ] `ghostY` può restare scansione lineare: board piccola; ottimizzare solo se misurato;
- [ ] 7-bag senza `shift()` ripetuti: usare indice cursor o stack se utile;
- [ ] renderer separato con accesso read-only allo state;
- [ ] preview next piece aggiornata solo quando cambia il pezzo;
- [ ] session snapshot deve restare compatto e semanticamente validato.

### Gate

- [ ] nessuna modifica a scoring/wall-kick/drop interval;
- [ ] input touch/keyboard identico;
- [ ] resume e Continue invariati;
- [ ] zero regressioni nei validator shared.

---

# 7. Fase 3 — Neon Snake

Priorità: P1.

## Architettura target

- `NeonSnakeGame`;
- `SnakeState`;
- `MovementSystem`;
- `SpawnSystem`;
- `CollisionSystem`;
- `PickupSystem`;
- `SnakeRenderer`;
- `SnakeInputController`.

## Ottimizzazioni specifiche

- [ ] eliminare scansioni lineari ripetute per occupancy se diventano costo misurabile;
- [ ] mantenere una occupancy grid/bitset 20x28 aggiornata incrementalmente se conveniente;
- [ ] con occupancy O(1), `emptyCell()` evita ricostruire Set completi a ogni spawn;
- [ ] collisione corpo O(1) usando occupancy, preservando la semantica della coda che si libera nello stesso step;
- [ ] ostacoli/pickup sulla stessa occupancy con flag distinti se serve;
- [ ] particelle bounded e aggiornate in-place;
- [ ] nessun oggetto temporaneo nei normali movement step se evitabile;
- [ ] mantenere `movementIntervalMs()` come unica cadence autorevole;
- [ ] Turbo resta transient input, mai nello snapshot;
- [ ] combo/pickup timers restano pace-aware secondo `docs/NEON-SNAKE.md`.

### Gate

- [ ] curve `1000 ms`, `0.965`, floor `170 ms` inalterate;
- [ ] Turbo esattamente x2 press-and-hold;
- [ ] Turbo sempre rilasciato su pause/background/restore/Continue;
- [ ] resume semantico invariato;
- [ ] validator Neon Snake + shared verdi.

---

# 8. Fase 4 — Neon Tilt

Priorità: P1.

Neon Tilt possiede già `physics.js`, `render.js` e `levels.js`. La migrazione deve valorizzare questa separazione e ridurre il peso di `game.js`.

## Architettura target

- `NeonTiltGame`;
- `TiltState`;
- `TiltSensorController`;
- `TiltInputMixer`;
- physics module mantenuto puro/isolato;
- renderer mantenuto isolato;
- resume adapter sottile.

## Ottimizzazioni specifiche

- [ ] parsing livelli una sola volta per livello e cache delle strutture statiche se utile;
- [ ] evitare `.find()` sui boost per ogni physics query: indicizzazione per cella o map precomputata;
- [ ] superfici statiche lookup O(1);
- [ ] shard collection senza scansioni costose se il numero cresce in futuro;
- [ ] particles aggiornate in-place invece di `forEach + filter` se profiler mostra churn;
- [ ] sensore smoothing senza allocazioni per frame;
- [ ] campioni calibrazione limitati e liberati dopo uso;
- [ ] renderer non modifica state autorevole;
- [ ] mantenere physics sufficientemente isolata per una futura estrazione WASM solo se i criteri documentati diventano veri.

### Gate

- [ ] sensore iOS permission flow invariato;
- [ ] touch/keyboard fallback invariati;
- [ ] calibrazione invariata;
- [ ] layout 12 livelli invariato;
- [ ] resume invariato;
- [ ] benchmark almeno equivalente alla baseline esistente.

---

# 9. Fase 5 — Maze Munch

Priorità: P1.

Maze Munch è già modulare ma usa `window.MM` come singleton mutabile condiviso. Obiettivo: conservare la modularità eliminando l'accoppiamento globale.

## Architettura target

- `MazeMunchGame`;
- `MazeState`;
- `MazeMap` / immutable level geometry;
- `ActorSystem`;
- `HunterAI`;
- `MazeRenderer`;
- `MazeInputController`;
- session adapter sottile.

## Ottimizzazioni specifiche

- [ ] precalcolare grafo delle celle camminabili;
- [ ] evitare `nearest()` che scansiona tutta la mappa ad ogni target se possibile;
- [ ] evitare BFS completo ripetuto per ogni direzione di ogni hunter a ogni incrocio;
- [ ] valutare distance map reverse-BFS per target corrente, condivisa tra decisioni compatibili;
- [ ] precomputare neighbors per ciascuna cella, incluso warp tunnel;
- [ ] usare indici numerici per celle invece di stringhe `"x,y"` nei hot path se porta vantaggio misurato;
- [ ] conservare pathfinding corretto prima di ottimizzare aggressivamente;
- [ ] non cambiare AI personality dei quattro hunter durante il refactor;
- [ ] rendering e audio fuori dall'AI.

### Gate

- [ ] pathfinding behavior equivalente;
- [ ] warp invariato;
- [ ] combo/frightened/eyes/release invariati;
- [ ] collisioni e movement centering invariati;
- [ ] nessuna regressione su session/Continue/Game Over.

---

# 10. Fase 6 — Prism Breaker

Priorità: P1/P2.

Primo refactor heavy. Il fixed step a 120 Hz e i substep della palla sono contratti gameplay/performance.

## Architettura target

- `PrismBreakerGame`;
- `PrismState`;
- `PaddleSystem`;
- `BallSystem`;
- `BrickSystem`;
- `BossSystem`;
- `PowerUpSystem`;
- `ProjectileSystem`;
- `PrismRenderer`;
- `PrismInputController`.

`levels.js` e `bosses.js` restano content/config modules autorevoli.

## Ottimizzazioni specifiche

- [ ] preservare 120 Hz fixed simulation step;
- [ ] accumulator bounded;
- [ ] substep solo in funzione della distanza necessaria, non un numero fisso eccessivo;
- [ ] precalcolare geometry/layout statici dove compatibile con moving bricks;
- [ ] evitare ricostruzione ripetuta di rect statici se dimensione e brick non cambiano;
- [ ] moving bricks calcolati separatamente;
- [ ] broad-phase collision ball/brick per righe/celle se il profiler dimostra beneficio;
- [ ] powerup/laser/enemy bullet array aggiornati in-place;
- [ ] pool di particle/projectile solo se GC misurata;
- [ ] cache Canvas per brick visual types se gradient/shadow risultano costosi;
- [ ] ridurre shadow state changes;
- [ ] boss AI e boss rendering separati;
- [ ] snapshot non contiene particles/cache;
- [ ] mantenere `stageSignature` validation e boss identity validation.

### Gate

- [ ] 100 livelli + 10 boss invariati;
- [ ] ciclo 100->1 invariato;
- [ ] ball physics e bounce invariati;
- [ ] power-up invariati;
- [ ] resume token invariato se schema identico;
- [ ] `validate-prism-breaker.mjs` + shared validators verdi;
- [ ] benchmark su scena multiball/boss/high level, non solo livello 1.

---

# 11. Fase 7 — Solitario

Priorità: P2.

Solitario è DOM-based e richiede una strategia diversa dai Canvas games. L'obiettivo non è inseguire 60 FPS nel board statico, ma ridurre lavoro DOM, separare regole e rendere semplici future varianti.

## Architettura target

- `SolitaireGame` / shell;
- `KlondikeState`;
- `KlondikeRules`;
- `MoveExecutor`;
- `UndoManager`;
- `BoardRenderer`;
- `SolitaireInputController`;
- `VictoryController`.

Conservare puri:

- `auto-move.js`;
- `auto-finish.js`;
- eventuali nuovi rules helpers puri.

## Ottimizzazioni specifiche

- [ ] non rerenderizzare board per frame;
- [ ] render solo su mutazione discreta;
- [ ] timer DOM solo quando cambia secondo visualizzato;
- [ ] event delegation mantenuta;
- [ ] evitare clone JSON completi per operazioni che possono usare transaction/move record più piccoli, se sicuro;
- [ ] history con representation minima sufficiente per Undo;
- [ ] ridurre layout thrash durante FLIP: leggere rect in batch, poi scrivere/animare;
- [ ] cache card SVG già presente da preservare;
- [ ] evitare rigenerazione card markup quando cambia solo selezione/highlight se misurato utile;
- [ ] mantenere max 52 card nodes + UI;
- [ ] mantenere draw pile dock lower-right e browser zoom guard invariati;
- [ ] preparare rules boundary per future varianti senza hard-code nel renderer.

### Gate

- [ ] tutte le regole Klondike documentate invariate;
- [ ] doppio tap/ciclo destinazioni invariato;
- [ ] Undo invariato;
- [ ] auto-finish invariato;
- [ ] victory lifecycle invariato e senza `rwg:game-ended`;
- [ ] resume v2 wrapper invariato se payload compatibile;
- [ ] `validate-solitaire.mjs` e smoke mobile completi verdi.

---

# 12. Fase 8 — Bubble Burst

Priorità: P2.

Runtime heavy con board esagonale, collisioni, trajectory prediction, special bubbles, pressure, scoring, sprite cache e crew procedurale.

## Architettura target

- `BubbleBurstGame`;
- `BubbleState`;
- `HexBoard`;
- `ShotSystem`;
- `MatchSystem`;
- `PressureSystem`;
- `ScoringSystem`;
- `AimPredictor`;
- `BubbleRenderer`;
- `BubbleSpriteCache`;
- `CrewRenderer`;
- `BubbleInputController`.

## Ottimizzazioni specifiche

- [ ] conservare local nearby hex lookup per collisioni;
- [ ] evitare string key `r,c` nei loop se una chiave numerica semplice porta beneficio senza peggiorare la leggibilità;
- [ ] precomputare adjacency delle celle valide per la geometria corrente se utile;
- [ ] riusare buffer per component traversal/drop-disconnected;
- [ ] mantenere index-based queues;
- [ ] collision substep per proiettili 3x invariato;
- [ ] aim prediction calcolata una volta per frame e condivisa tra dotted trajectory e gaze;
- [ ] considerare caching dell'aim quando input/state non cambiano, invalidandolo su pointer move, resize, pressure, shot resolution e board mutation;
- [ ] sprite cache bubble mantenuta;
- [ ] chibi static body cache mantenuta;
- [ ] background cache mantenuta;
- [ ] ridurre `save/restore` e shadow state changes per centinaia di bubble se profiler indica rendering dominante;
- [ ] particles/falling bounded e aggiornati in-place;
- [ ] pressure O(1) con fractional ceiling offset invariata;
- [ ] timer DOM soltanto su cambio centisecondo, come già previsto;
- [ ] nessuna serializzazione delle cache o trail.

### Gate

- [ ] 200 layout signatures invariati;
- [ ] optimalSeconds e bonus invariati;
- [ ] pressure curve invariata;
- [ ] Armor/Star/Prism/Bomb/Color Wipe invariati;
- [ ] fifth popping-shot Bomb reward invariato;
- [ ] intermediate level clear non diventa Game Over;
- [ ] Continue conserva score, livello, elapsed e levelStartScore;
- [ ] validator Bubble Burst + session + contracts verdi;
- [ ] benchmark con board densa, shot in movimento e aim attivo.

---

# 13. Fase 9 — Star Swarm

Priorità: P2/P3, ultimo grande refactor.

Star Swarm è il test finale dell'architettura: molte entità dinamiche, boss, powerup economy, projectiles, wingmen, transizioni e resume schema v3.

## Architettura target

- `StarSwarmGame`;
- `StarSwarmState`;
- `PlayerSystem`;
- `WeaponSystem`;
- `ProjectileSystem`;
- `EnemySystem`;
- `EnemyFireSystem`;
- `BossSystem`;
- `PowerUpSystem`;
- `WingmanSystem`;
- `CollisionSystem`;
- `StageController`;
- `StarSwarmRenderer`;
- `StarSwarmInputController`;
- `StarSwarmAudio`.

Campaign e bosses restano config/content modules.

## Data-oriented strategy

Non creare classi individuali pesanti per ogni bullet/enemy/particle.

Preferenza iniziale:

```text
Systems
  -> array di plain objects con shape stabile
  -> buffer riutilizzati
  -> pooling solo se il profiler mostra GC
```

Se un futuro carico numerico aumenta molto:

```text
ProjectileSystem
  x[] y[] vx[] vy[] radius[] kind[] damage[] active[]
```

va valutato solo con benchmark e senza compromettere resume/rendering.

## Ottimizzazioni specifiche

- [ ] mantenere 8 Weapon forms e 20 POWER levels distinti;
- [ ] laser hit-set: evitare allocazioni eccessive; valutare id generation/bitset/local hit buffer se il profiler mostra costo;
- [ ] collision broad-phase tramite spatial grid solo se entity count la giustifica;
- [ ] separare update degli existing transients dalla generazione nuovi shot durante `transition`;
- [ ] non cancellare bullets/enemyBullets/powerups tra wave e wave/boss;
- [ ] particles bounded e possibilmente pooled se GC misurata;
- [ ] stars preallocate e mutate in place;
- [ ] evitare `Math.hypot` nei collision hot path quando squared distance è sufficiente e il profiler mostra beneficio;
- [ ] enemy tier config immutable/precomputed;
- [ ] boss attacks evitano array temporanei per ogni volley dove possibile;
- [ ] projectile creation centralizzata;
- [ ] render batching per kind/color quando non altera layering;
- [ ] minimizzare shadowBlur e composite state churn;
- [ ] HUD aggiornato su cambio valori, non richiamato come proxy di dirty marking;
- [ ] separare `markSessionDirty()` dai normali HUD refresh per evitare dirty signal ridondanti;
- [ ] snapshot v3 conserva shield, 1UP cooldown, drops e boss shieldDropIndex;
- [ ] nessun transient render-only nello snapshot.

### Profiling scenari obbligatori

- [ ] wave normale densa;
- [ ] Weapon 8 + POWER 20;
- [ ] due wingmen;
- [ ] laser multipli;
- [ ] boss 4+ con threshold Shield;
- [ ] boss projectile-dense;
- [ ] transition con projectiles/powerups persistenti;
- [ ] Continue in boss e wave;
- [ ] restore di snapshot v3.

### Gate

- [ ] zero regressioni sui 100 stage signatures;
- [ ] boss cadence ogni 10 invariata;
- [ ] 10 boss identità distinte invariate;
- [ ] Weapon 8 e POWER 20 invariati;
- [ ] drop probabilities/caps invariati;
- [ ] inter-wave continuity invariata;
- [ ] laser invariant invariato;
- [ ] resume v3 invariato se schema non cambia;
- [ ] `validate-star-swarm.mjs` + contracts/session/shared verdi;
- [ ] prestazioni almeno equivalenti alla baseline e preferibilmente con meno churn.

---

# 14. Revisione trasversale dopo tutti i giochi

Priorità: P3.

- [ ] Cercare duplicazioni emerse naturalmente tra i nuovi componenti.
- [ ] Condividere solo utility realmente generiche e stabili.
- [ ] Non estrarre un framework astratto sulla base di una sola implementazione.
- [ ] Valutare una micro-libreria game-runtime RWG solo se almeno 3-4 giochi usano lo stesso identico comportamento e non invade i servizi condivisi esistenti.
- [ ] Possibili utility condivisibili: clamp/math, bounded pool, fixed-step helper, resize metrics, ma soltanto se riducono davvero codice e bug.
- [ ] Non condividere physics, scoring, phase machine o renderer specifici solo perché hanno nomi simili.
- [ ] Riesaminare lo script loading dopo la migrazione.
- [ ] Valutare ES Modules con un bootstrap che garantisca `RWGResumeAdapter` prima di `game-hud.js`.
- [ ] Se ES Modules richiedono un cambiamento di lifecycle, documentare e aggiornare validator prima della conversione.
- [ ] Rieseguire audit WASM solo dopo benchmark reali post-refactor.

---

# 15. Performance regression harness — obiettivo futuro

Creare strumenti locali, non CI GitHub Actions, per confrontare automaticamente prima/dopo.

## Metriche desiderate

- [ ] frame count;
- [ ] average frame interval;
- [ ] p95 frame interval;
- [ ] p99 frame interval;
- [ ] long frames > 16,7 / 33,3 ms;
- [ ] update time;
- [ ] render time;
- [ ] entity counts;
- [ ] heap start/end quando API disponibile;
- [ ] GC/long-task markers quando osservabili;
- [ ] snapshot serialize time e size;
- [ ] resize cost per Canvas game.

## Regole di interpretazione

- [ ] confrontare stesso browser, viewport e scenario;
- [ ] warm-up prima della misura;
- [ ] più run, non una singola esecuzione;
- [ ] mediana + p95, non solo media;
- [ ] performance improvement non giustifica una regressione gameplay;
- [ ] una differenza minima dentro il rumore non giustifica complessità aggiuntiva.

---

# 16. Definition of Done per ogni migrazione

Un gioco è considerato migrato solo quando tutte queste condizioni sono vere:

## Architettura

- [ ] orchestrator leggibile e significativamente più piccolo del monolite originale;
- [ ] simulation rules fuori dal renderer;
- [ ] input fuori dalla simulation;
- [ ] audio/feedback separati dove utile;
- [ ] stato autorevole identificabile;
- [ ] dipendenze direzionali chiare;
- [ ] nessun nuovo global singleton mutabile non necessario.

## Performance

- [ ] baseline pre-refactor disponibile;
- [ ] benchmark post-refactor disponibile;
- [ ] nessuna regressione significativa non spiegata;
- [ ] nessuna nuova allocazione massiva per frame;
- [ ] niente query DOM per frame non necessarie;
- [ ] niente storage write per frame;
- [ ] particelle/trail/effects bounded.

## Gameplay

- [ ] scoring invariato;
- [ ] difficulty/progression invariata;
- [ ] collisioni invariati;
- [ ] intermission/transition invariati;
- [ ] pause/orientation invariati;
- [ ] Game Over/Continue invariati;
- [ ] input mobile/desktop invariato.

## Persistenza

- [ ] resume snapshot valido;
- [ ] vecchi snapshot continuano a funzionare se compatibility non è cambiata;
- [ ] incompatibilità reali invalidano in modo esplicito;
- [ ] restore non ricrea effetti transitori sbagliati;
- [ ] Continue e free-resume restano flussi distinti.

## Validazione

- [ ] `node --check` su tutti i file JS toccati;
- [ ] validator specifico del gioco;
- [ ] `node scripts/validate-contracts.mjs`;
- [ ] `node scripts/validate-session.mjs`;
- [ ] `node scripts/validate-shared-pause.mjs` quando coinvolto il lifecycle/pause;
- [ ] `node scripts/validate-shared-controls.mjs` quando cambia layout/input;
- [ ] `node scripts/validate-leaderboards.mjs` quando cambia terminal lifecycle;
- [ ] smoke test browser su mobile portrait e desktop;
- [ ] test reload/resume;
- [ ] test background/foreground;
- [ ] test orientation;
- [ ] test Game Over + credit Continue.

---

# 17. Ordine di esecuzione raccomandato

Ordine attuale, progettato per minimizzare rischio e massimizzare apprendimento architetturale:

1. **Fase 0 — performance harness + regole migrazione**
2. **Neon Rally — pilota**
3. **Block Drop**
4. **Neon Snake**
5. **Neon Tilt**
6. **Maze Munch**
7. **Prism Breaker**
8. **Solitario**
9. **Bubble Burst**
10. **Star Swarm**
11. **revisione trasversale e possibile consolidamento utility**

Motivazione:

- Neon Rally espone quasi tutti i confini con poco codice;
- Block Drop valida board/puzzle architecture;
- Neon Snake valida grid + real-time cadence;
- Neon Tilt e Maze Munch consolidano moduli già parzialmente separati;
- Prism Breaker introduce fixed-step e sistemi multipli;
- Solitario valida il modello DOM/event-driven;
- Bubble Burst verifica board complessa + cache + predictor;
- Star Swarm viene affrontato quando il pattern è già provato su tutti i principali archetipi.

---

# 18. Anti-pattern da evitare durante la migrazione

- [ ] `class Entity` base per qualunque cosa si muova;
- [ ] ereditarietà profonda;
- [ ] event bus globale usato per ogni interazione interna;
- [ ] dependency injection framework;
- [ ] ECS generico introdotto senza necessità misurata;
- [ ] un oggetto/classe per ogni particle;
- [ ] getter/setter per coordinate nei hot path;
- [ ] classi wrapper che contengono solo una funzione senza stato o responsabilità;
- [ ] `Map/Set` introdotti automaticamente dove un array/grid è più veloce e semplice;
- [ ] object spread dentro collision/update loops;
- [ ] clonare stato completo per implementare ogni azione;
- [ ] snapshot derivato dal renderer;
- [ ] renderer che modifica lo stato gameplay;
- [ ] input listener che assegna score/lives/level;
- [ ] ottimizzazione prematura che rende il codice più complesso senza benchmark;
- [ ] refactor big-bang di più giochi nello stesso commit;
- [ ] cambiare contemporaneamente OOP architecture, gameplay balance e UI.

---

# 19. Obiettivo finale

A migrazione conclusa, RetroWebGames deve avere nove runtime con caratteristiche comuni ma non artificialmente uniformi:

- composition root piccolo;
- stato autorevole chiaramente separato;
- systems o rules modules dedicati;
- renderer indipendente;
- input indipendente;
- integrazione RWG sottile;
- hot path senza overhead OOP superfluo;
- allocazioni controllate;
- rendering Canvas/DOM ottimizzato per il genere specifico;
- snapshot compatti;
- benchmark ripetibili;
- contratti shared preservati;
- gameplay indistinguibile salvo modifiche intenzionali future.

L'obiettivo non è "avere più classi". L'obiettivo è ottenere motori **più veloci da eseguire, più facili da profilare, più facili da evolvere e molto più difficili da rompere**.

---

# 20. Internazionalizzazione EN / IT / DE / FR / ES

Stato: **piano approvato, implementazione non iniziata**.

Priorità: P1. Esecuzione incrementale, senza big-bang e senza riscrivere i motori di gioco.

## 20.1 Obiettivo e perimetro

Rendere RetroWebGames completamente fruibile e indicizzabile in italiano (`it`), inglese (`en`), tedesco (`de`), francese (`fr`) e spagnolo (`es`).

La localizzazione deve coprire:

- home, card e sezione partner;
- pagine e intro dei dieci giochi;
- HUD, tutorial, intermission e messaggi gameplay;
- UI shared: pausa, resume, Game Over, leaderboard, profilo, crediti, avatar, orientation, condivisione e PWA;
- accessibilità: alt, label, live region e annunci;
- title, description, Open Graph, JSON-LD, canonical, `hreflang` e sitemap;
- formatter di numeri, date, durata e plurali.

La lingua è presentazione. ID giocatore, crediti, avatar, achievements, sessioni, run id, record locali e classifiche globali restano unici fra tutte le lingue.

## 20.2 Decisione architetturale proposta

Adottare **Astro con output statico** per generare shell, route, HTML e metadata. Conservare:

- JavaScript + Canvas 2D dei giochi;
- DOM/CSS del Solitario;
- servizi shared RWG nel browser;
- Fastify per le leaderboard;
- Nginx statico in produzione;
- nessun processo Node persistente per il frontend.

Astro è un generatore di pagine: non entra nei game loop e non diventa un framework di gioco.

### Alternative escluse salvo nuove evidenze

- **PHP semplice:** aggiunge runtime server-side senza risolvere le stringhe client-side.
- **FraPoFW:** adatto a siti dinamici/gestionali, ma per RWG introdurrebbe PHP-FPM, routing e superficie operativa non necessari; non offre oggi un contratto i18n pubblico già pronto per questo caso.
- **React/Vue/Svelte SPA:** aumentano bootstrap, bundle e rischio SEO/mobile senza vantaggi per Canvas.
- **Statico attuale + generatori custom:** possibile, ma replicherebbe template, routing, sitemap e controlli già disponibili in Astro.

### Gate Astro obbligatorio

- [ ] Scrivere `docs/I18N-ARCHITECTURE.md` come ADR con scelta, alternative, rischi e rollback.
- [ ] Fissare una versione Astro/`@astrojs/sitemap` validata e senza vulnerabilità note.
- [ ] Creare una build pilota isolata e non pubblicata: home + Block Drop in IT/EN.
- [ ] Dimostrare output compatibile con `/apps/deploy`, Appmanager `astro-static` e convenzione `public/`.
- [ ] Confrontare DOM, byte, metadata, screenshot e comportamento con la produzione attuale.
- [ ] Dimostrare che runtime e ordine di bootstrap dei giochi restano invariati.
- [ ] Provare e documentare il rollback al deploy statico precedente.
- [ ] Procedere solo con validator e smoke test verdi.

## 20.3 URL, routing e SEO

Preservare gli URL italiani già indicizzati e condivisi:

```text
/                              italiano
/games/<slug>/                 italiano
/avatar/                       italiano, noindex

/en/                           inglese
/en/games/<slug>/              inglese
/en/avatar/                    inglese, noindex

/de/...  /fr/...  /es/...
```

Contratti:

- [ ] italiano default senza prefisso (`prefixDefaultLocale: false`);
- [ ] slug dei giochi invariati in tutte le lingue;
- [ ] nessun redirect degli URL italiani esistenti;
- [ ] canonical autoreferenziale su ogni variante;
- [ ] alternate reciproci e fully-qualified `hreflang="it|en|de|fr|es"`;
- [ ] `x-default` verso il fallback scelto nell'ADR;
- [ ] ogni gruppo alternate include se stesso e tutte le traduzioni effettivamente pubblicate;
- [ ] nessun alternate verso pagine mancanti o incomplete;
- [ ] `html lang`, `og:locale`, `og:locale:alternate` e JSON-LD `inLanguage` coerenti;
- [ ] sitemap con tutte e sole le canonical indicizzabili più alternate localizzati;
- [ ] utility sottili `noindex,follow` in ogni lingua;
- [ ] una sola lingua visibile per pagina, salvo brand e termini intenzionali;
- [ ] nessun redirect automatico basato su IP, browser o `Accept-Language`;
- [ ] selettore lingua composto da veri link HTML crawlable.

## 20.4 Catalogo e identità

Evolvere `scripts/seo-catalog.mjs` separando dati language-neutral e copy localizzata:

```text
Game identity
  slug, brandName, alternateName
  capabilities, genres, asset paths

Localized discovery copy
  displayName, title, description
  socialAlt, card copy, structured-data labels
```

- [ ] `brandName` immutabile distinto da `localizedDisplayName`.
- [ ] Non tradurre automaticamente i brand dei giochi.
- [ ] Decidere esplicitamente `Solitario` vs `Solitaire` nelle lingue non italiane.
- [ ] Riutilizzare inizialmente cover e wordmark esistenti.
- [ ] Tradurre alt e metadata anche quando il raster non cambia.
- [ ] Non produrre subito cinque cover social per gioco senza necessità editoriale misurata.
- [ ] Vietare metadata italiani di fallback su una route dichiarata completa in altra lingua.

## 20.5 Runtime `RWGI18n`

Creare un servizio condiviso disponibile prima dei motori e dei bootstrap shared:

```js
RWGI18n.locale
RWGI18n.t('gameOver.playAgain')
RWGI18n.t('session.resumeQuestion', { level: 6 })
RWGI18n.number(score)
RWGI18n.date(value)
RWGI18n.duration(activeMs)
RWGI18n.plural('credits', credits)
```

Struttura target indicativa:

```text
src/i18n/
  schema.ts
  glossary.ts
  it/{core,home,games/*}
  en/{core,home,games/*}
  de/{core,home,games/*}
  fr/{core,home,games/*}
  es/{core,home,games/*}
```

Contratti:

- [ ] locale determinato dalla route, non soltanto da `navigator.language`;
- [ ] italiano come catalogo sorgente iniziale;
- [ ] fallback italiano consentito in sviluppo, vietato per lingue marcate complete in produzione;
- [ ] chiavi stabili e namespaced: `core`, `home`, `pause`, `session`, `gameOver`, `leaderboard`, `pwa`, `games.<slug>`;
- [ ] interpolazione con parametri nominati;
- [ ] plurali tramite `Intl.PluralRules` o astrazione equivalente;
- [ ] numeri/date tramite `Intl.NumberFormat` e `Intl.DateTimeFormat`;
- [ ] durate tramite formatter condiviso, non concatenazioni grammaticali;
- [ ] niente HTML arbitrario nei dizionari;
- [ ] niente chiavi derivate dal testo visibile;
- [ ] niente flash della lingua italiana in attesa di fetch;
- [ ] bootstrap sincrono o payload locale disponibile prima del rendering;
- [ ] caricare shared namespace + solo il gioco corrente, non tutti i cataloghi;
- [ ] API compatibile con gli script classici attuali;
- [ ] nessuna libreria i18n runtime pesante senza benchmark e ADR.

## 20.6 Persistenza language-neutral

- [ ] Non aggiungere la lingua alle chiavi di profilo, wallet, avatar, best score o sessione.
- [ ] Una partita iniziata in IT deve riprendersi in EN con lo stesso snapshot.
- [ ] Snapshot con enum/codici, mai label tradotte.
- [ ] `RWGResumeAdapter.describe()` formatta nella lingua corrente al momento dell'uso.
- [ ] Nessun compatibility token cambia per la sola traduzione.
- [ ] Achievements salvati per id, non per label.
- [ ] Metriche leaderboard tradotte da codici stabili.
- [ ] Errori API come codici machine-readable mappati dal client.
- [ ] Classifiche globali unificate fra lingue.
- [ ] `locale`/timezone usati per analisi, non per separare ranking.
- [ ] Cambio lingua durante una run: lifecycle autosave, route equivalente, resume gratuito.
- [ ] Vietare che il cambio lingua avvii una partita o consumi crediti.

## 20.7 Selettore e rilevamento

- [ ] Selettore accessibile in home e intro di ogni gioco.
- [ ] Valutare accesso dal dock/pausa senza collisioni mobile.
- [ ] Codice corto `IT/EN/DE/FR/ES` più nome esteso accessibile.
- [ ] Lingua corrente con `aria-current`.
- [ ] Link sempre verso la stessa pagina/gioco nella lingua scelta.
- [ ] Preferenza esplicita in `rwg.locale.preference.v1`.
- [ ] Prima visita: al massimo un suggerimento non invasivo se browser e route divergono.
- [ ] Suggerimento non ripetuto dopo scelta o dismiss.
- [ ] Nessun cambio lingua durante gameplay senza gesto esplicito.
- [ ] Eventi `language_suggestion_shown` e `language_selected` con provenienza.
- [ ] Non usare bandiere come unica rappresentazione della lingua.

## 20.8 PWA e service worker

Eseguire uno spike prima di scegliere manifest unico o manifest localizzati.

- [ ] Mantenere un solo app id ed evitare cinque installazioni involontarie.
- [ ] Preservare le installazioni italiane esistenti.
- [ ] Definire la lingua di apertura della shortcut installata.
- [ ] Tradurre description/prompt dove tecnicamente affidabile.
- [ ] Mantenere icone, origin e scope comuni.
- [ ] Service worker consapevole delle route localizzate.
- [ ] Nessun fallback offline nella lingua sbagliata.
- [ ] Precache limitato: non scaricare tutte le lingue e tutti i giochi.
- [ ] Cache distinte naturalmente dagli URL localizzati.
- [ ] Test offline home + gioco visitato per lingua.
- [ ] Test upgrade dal service worker monolingua.
- [ ] Bump esplicito della cache generation al rollout.

## 20.9 Analytics

- [ ] Aggiungere `ui_locale`, `content_language` e `browser_language` ai contesti GA appropriati.
- [ ] Tracciare suggerimento, selezione e cambio lingua.
- [ ] Non tradurre nomi evento o valori enumerati.
- [ ] Segmentare PWA install, start, resume, Game Over e Continue per lingua.
- [ ] Non inviare copy tradotta quando basta una chiave stabile.
- [ ] Documentare eventuali dimensioni custom GA4.
- [ ] Aggiornare `docs/ANALYTICS.md` e `scripts/validate-analytics.mjs`.

## 20.10 Strategia editoriale

- [ ] Glossario arcade prima della traduzione EN.
- [ ] Classificare brand, termini invarianti e termini traducibili.
- [ ] Copy breve, naturale, arcade e mobile-first.
- [ ] Revisione umana prima di dichiarare completa una lingua.
- [ ] Placeholder, numeri, tag e nomi gioco protetti.
- [ ] Nessuna traduzione automatica massiva pubblicata senza revisione.
- [ ] Verificare genere, plurali e formalità per lingua.
- [ ] Frasi autonome, non concatenazioni basate sull'ordine italiano.
- [ ] Segnalare traduzioni obsolete quando cambia il significato della sorgente.

## 20.11 Piano di implementazione

### I18N-0 — inventario e contratti

- [ ] Censire stringhe in HTML, shared JS, giochi, CSS generated content, manifest e API errors.
- [ ] Classificare brand, SEO, shared, gameplay, accessibilità, analytics e debug-only.
- [ ] Censire `it-IT`, `toLocaleString`, formatter e concatenazioni.
- [ ] Definire schema, glossario e naming delle chiavi.
- [ ] Scrivere ADR i18n.
- [ ] Aggiungere invarianti ad `AGENTS.md`/architettura solo dopo approvazione.
- [ ] Creare `scripts/validate-i18n.mjs` iniziale.
- [ ] Registrare baseline bundle, SEO, screenshot e bootstrap.

Gate: inventario completo, ADR approvato, nessun cambiamento visibile.

### I18N-1 — proof of concept Astro

- [ ] Scaffold Astro statico su branch dedicato.
- [ ] Separare asset sorgente dall'output build `public/`.
- [ ] Home IT/EN da template comune.
- [ ] Block Drop IT/EN da template gioco comune.
- [ ] Metadata, JSON-LD, canonical, alternate e sitemap corretti.
- [ ] Gioco, sessione, leaderboard e dock invariati.
- [ ] Confronto Playwright prima/dopo mobile e desktop.
- [ ] Dry-run deploy FraPoVPS e rollback documentato.

Gate: output equivalente e decisione definitiva Astro sì/no.

### I18N-2 — shared platform in italiano

Estrarre le stringhe italiane, senza aggiungere nuove lingue, da:

- [ ] Game Over;
- [ ] pausa e doppia conferma;
- [ ] resume session;
- [ ] leaderboard e nickname;
- [ ] profile/credits/avatar;
- [ ] common dock, share e orientation;
- [ ] PWA install;
- [ ] home shell.

Gate: UI italiana visivamente identica, zero chiavi mancanti, bootstrap entro budget.

### I18N-3 — inglese pilota completo

- [ ] Shared platform EN.
- [ ] Home/discovery EN.
- [ ] Tutti i dieci giochi EN.
- [ ] Route, metadata, sitemap e `hreflang` EN.
- [ ] Revisione umana.
- [ ] Rollout EN con monitoraggio analytics/Search Console.

Gate: nessun fallback italiano visibile su EN; tutti i giochi verdi.

### I18N-4 — ES, FR, DE progressivi

Ordine suggerito: ES, FR, DE. Ogni lingua è un rollout indipendente.

Per ciascuna:

- [ ] catalogo completo e revisione umana;
- [ ] chiavi/placeholder verificati;
- [ ] Playwright visuale e test 320×568;
- [ ] SEO/hreflang/sitemap;
- [ ] deploy e monitoraggio prima della lingua successiva.

Il tedesco ha un gate visuale più severo per la lunghezza delle stringhe.

### I18N-5 — consolidamento

- [ ] Rimuovere stringhe operative residue fuori catalogo.
- [ ] Rimuovere fallback temporanei.
- [ ] Documentare workflow per nuova feature/nuovo gioco.
- [ ] Aggiungere template dizionario di un gioco.
- [ ] Aggiornare checklist deploy e audit.
- [ ] Riesaminare cover social localizzate e manifest dopo dati reali.

## 20.12 Validator obbligatori

`validate-i18n.mjs` deve progressivamente verificare:

- [ ] stessa struttura di chiavi per le lingue complete;
- [ ] nessuna chiave mancante/extra o stringa vuota;
- [ ] placeholder identici;
- [ ] nessun HTML/script non autorizzato nei cataloghi;
- [ ] assenza di locale italiano hardcoded nei formatter operativi;
- [ ] assenza ragionata di copy italiano fuori catalogo;
- [ ] `html lang`, canonical, `hreflang`, `og:locale` e JSON-LD corretti;
- [ ] sitemap con esattamente le route attese;
- [ ] utility noindex escluse;
- [ ] route/slug simmetrici;
- [ ] selettore verso pagina equivalente;
- [ ] storage/session namespace language-neutral;
- [ ] analytics event name stabili con locale come parametro;
- [ ] build bloccata per lingue incomplete.

Integrare il validator in `validate-contracts.mjs` quando il primo contratto i18n diventa autorevole.

## 20.13 Browser e visual QA

Viewport minimi per lingua:

- [ ] 320×568;
- [ ] 375×667;
- [ ] 390×844;
- [ ] Android moderno rappresentativo;
- [ ] iPhone Safari/WebKit rappresentativo;
- [ ] desktop almeno 1366×768.

Superfici obbligatorie:

- [ ] home/card/partner;
- [ ] intro e high scores di ogni gioco;
- [ ] avvio e HUD;
- [ ] pausa e doppia conferma;
- [ ] resume sì/no;
- [ ] orientation guard;
- [ ] level/boss clear;
- [ ] Game Over, nickname e rank card;
- [ ] Continue/crediti insufficienti;
- [ ] avatar/editor;
- [ ] PWA Android e istruzioni iOS;
- [ ] share con URL localizzato;
- [ ] offline e service-worker update;
- [ ] cambio lingua con run attiva e successivo resume.

Automazione:

- [ ] build/test HTML su cinque lingue;
- [ ] screenshot diff delle superfici shared;
- [ ] smoke per gioco e lingua;
- [ ] zero console errors/failed requests;
- [ ] zero overflow, clipping o CTA fuori viewport;
- [ ] scenari dedicati alle stringhe tedesche lunghe.

## 20.14 Definition of Done

- [ ] Cinque lingue su route stabili.
- [ ] Home, dieci giochi e shared UI completi in ogni lingua.
- [ ] Nessun fallback italiano visibile nelle lingue complete.
- [ ] Classifiche globali uniche e funzionanti.
- [ ] Sessione e Continue validi attraverso cambio lingua.
- [ ] PWA mantiene identità e installazioni esistenti.
- [ ] Canonical, `hreflang`, sitemap e JSON-LD validi.
- [ ] Build Astro deterministica e ripetibile.
- [ ] Frontend statico in produzione.
- [ ] Nessuna regressione funzionale o prestazionale dei giochi.
- [ ] Validator repository-wide e matrice Playwright verdi.
- [ ] Workflow per nuove stringhe e nuovi giochi documentato.
- [ ] Rollback dell'ultima release provato.

## 20.15 Decisioni aperte da chiudere nell'ADR

- [ ] Confermare italiano come default permanente.
- [ ] Definire `x-default` definitivo.
- [ ] Definire display name internazionale del Solitario.
- [ ] Posizione finale del selettore lingua.
- [ ] Manifest unico o strategia localizzata con un solo app id.
- [ ] Revisori umani EN/DE/FR/ES.
- [ ] Se/quando creare cover social localizzate.
- [ ] Budget massimo del runtime/dizionario i18n.
- [ ] Piano Search Console per i nuovi prefissi.

## 20.16 Anti-pattern i18n

- [ ] Non duplicare cinque copie manuali dei giochi.
- [ ] Non separare profilo, crediti o leaderboard per lingua.
- [ ] Non salvare frasi tradotte negli snapshot.
- [ ] Non tradurre nomi evento analytics o codici API.
- [ ] Non affidarsi solo a `navigator.language`.
- [ ] Non usare query string come canonical di lingua.
- [ ] Non fare redirect automatici aggressivi.
- [ ] Non pubblicare route parzialmente tradotte.
- [ ] Non concatenare traduzioni secondo grammatica italiana.
- [ ] Non introdurre framework UI nei game loop.
- [ ] Non migrare Astro, tutti i giochi e tutte le lingue in un solo rilascio.
- [ ] Non cambiare gameplay, session schema o scoring durante l'estrazione testi.
- [ ] Non indebolire validator esistenti per facilitare la build.
