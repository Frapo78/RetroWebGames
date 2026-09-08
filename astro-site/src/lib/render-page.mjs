import fs from 'node:fs';
import path from 'node:path';
import { renderPilotPage } from '../../../astro-poc/src/lib/render-pilot-page.mjs';
import italianShared from '../../../src/i18n/it/shared.mjs';
import englishShared from '../../../src/i18n/en/shared.mjs';
import spanishShared from '../../../src/i18n/es/shared.mjs';
import italianGames from '../../../src/i18n/it/games.mjs';
import spanishGames from '../../../src/i18n/es/games.mjs';

const ORIGIN='https://www.retrowebgames.it';
export const PAGES=[
  {id:'home',route:'',source:'public/index.html',indexable:true},
  {id:'avatar',route:'avatar',source:'public/avatar/index.html',indexable:false},
  ...['star-swarm','bubble-burst','block-drop','maze-munch','neon-rally','neon-snake','neon-tilt','solitaire','prism-breaker','the-great-empire'].map(slug=>({id:slug,route:`games/${slug}`,source:`public/games/${slug}/index.html`,indexable:true}))
];

const META={
  'block-drop':{itTitle:'Block Drop: videogame puzzle gratis | RetroWebGames',enTitle:'Block Drop: free falling-block puzzle | RetroWebGames',itDesc:'Gioca gratis a Block Drop, videogame puzzle di blocchi e linee con controlli touch, livelli progressivi e partite rapide nel browser.',enDesc:'Play Block Drop free online: a falling-block puzzle with touch controls, progressive levels and quick browser sessions.',itAlt:'Block Drop — blocchi luminosi in caduta su una griglia arcade',enAlt:'Block Drop — glowing blocks falling across an arcade grid'},
  'bubble-burst':{itTitle:'Bubble Burst: bubble shooter gratis | RetroWebGames',enTitle:'Bubble Burst: free bubble shooter | RetroWebGames',itDesc:'Gioca gratis a Bubble Burst, web game bubble shooter con rimbalzi, combo, bombe e livelli originali, ottimizzato per smartphone.',enDesc:'Play Bubble Burst free online, an arcade bubble shooter with bank shots, combos, bombs and original mobile-friendly levels.',itAlt:'Bubble Burst — bubble shooter arcade con crew chibi e bolle al neon',enAlt:'Bubble Burst — arcade bubble shooter with a chibi crew and neon bubbles'},
  'maze-munch':{itTitle:'Maze Munch: retrogame arcade gratis | RetroWebGames',enTitle:'Maze Munch: free maze-chase retrogame | RetroWebGames',itDesc:'Gioca gratis a Maze Munch, retrogame arcade originale tra labirinti, inseguitori, nodi energia e combo, direttamente sul web.',enDesc:'Play Maze Munch free online: an original arcade maze chase with hunters, energy nodes and score-building combos.',itAlt:'Maze Munch — corsa arcade in un labirinto al neon',enAlt:'Maze Munch — an arcade chase through a neon maze'},
  'neon-rally':{itTitle:'Neon Rally: web game arcade gratis | RetroWebGames',enTitle:'Neon Rally: free arcade paddle game | RetroWebGames',itDesc:'Gioca gratis a Neon Rally, web game arcade di riflessi e rimbalzi contro la CPU, con controlli touch e sfide sempre più veloci.',enDesc:'Play Neon Rally free online: a fast arcade paddle duel against the CPU with touch controls and increasingly quick rallies.',itAlt:'Neon Rally — sfida arcade tra paddle ed energia al neon',enAlt:'Neon Rally — an arcade paddle duel powered by neon energy'},
  'neon-snake':{itTitle:'Snake gratis online: Neon Snake | RetroWebGames',enTitle:'Neon Snake: free Snake game online | RetroWebGames',itDesc:'Gioca a Snake gratis online con Neon Snake: cresci, crea combo, raccogli shield e supera ostacoli in un retrogame moderno per mobile.',enDesc:'Play Neon Snake free online: an original take on classic Snake with combos, shields, obstacles and hold-to-boost turbo.',itAlt:'Neon Snake — cyber-serpente luminoso su una griglia arcade',enAlt:'Neon Snake — a glowing snake racing across an arcade grid'},
  'neon-tilt':{itTitle:'Neon Tilt: videogame mobile gratis | RetroWebGames',enTitle:'Neon Tilt: free tilt-controlled maze game | RetroWebGames',itDesc:'Gioca gratis a Neon Tilt, videogame mobile di abilità: inclina lo smartphone e guida la biglia tra cristalli, bumper e labirinti.',enDesc:'Play Neon Tilt free online: tilt your phone to guide a marble through mazes, collect shards and survive bumpers, ice and pits.',itAlt:'Neon Tilt — sfera cromata in un labirinto inclinato al neon',enAlt:'Neon Tilt — a neon marble inside a tilt-controlled maze'},
  'prism-breaker':{itTitle:'Prism Breaker: brick breaker gratis | RetroWebGames',enTitle:'Prism Breaker: free brick breaker | RetroWebGames',itDesc:'Gioca gratis a Prism Breaker, videogame brick breaker con 100 livelli originali, power-up, mattoni speciali e boss arcade.',enDesc:'Play Prism Breaker free online: an arcade brick breaker with 100 levels, 10 bosses, power-ups, special bricks and touch controls.',itAlt:'Prism Breaker — palla e paddle tra prismi e mattoni al neon',enAlt:'Prism Breaker — an arcade brick breaker with neon blocks'},
  'solitaire':{itTitle:'Solitario gratis online (Solitaire) | RetroWebGames',enTitle:'Solitaire free online: Klondike and FreeCell | RetroWebGames',itDesc:'Gioca al Solitario gratis online: Solitaire Klondike e FreeCell con 52 carte, drag, tap, undo e suggerimenti, ottimizzato per smartphone.',enDesc:'Play Solitaire free online: Klondike and FreeCell with 52 classic cards, drag, tap, undo and hints, optimized for smartphones.',itAlt:'Solitario — carte francesi classiche su un tavolo verde arcade',enAlt:'Solitaire — classic French-suited cards on an arcade-green table'},
  'star-swarm':{itTitle:'Star Swarm: videogame space shooter gratis | RetroWebGames',enTitle:'Star Swarm: free space shooter | RetroWebGames',itDesc:'Gioca gratis a Star Swarm, videogame space shooter con 100 livelli, 10 boss, armi, POWER e wingmen, direttamente nel browser.',enDesc:'Play Star Swarm free online: a space shooter with 100 levels, 10 bosses, weapon upgrades, POWER and wingmen.',itAlt:'Star Swarm — nave arcade contro uno sciame alieno al neon',enAlt:'Star Swarm — an arcade ship fighting a neon alien swarm'},
  'the-great-empire':{itTitle:'The Great Empire: strategia gratis | RetroWebGames',enTitle:'The Great Empire: free real-time strategy game | RetroWebGames',itDesc:"Gioca gratis a The Great Empire, strategia in tempo reale per smartphone: raccogli risorse, addestra soldati e conquista l'accampamento nemico.",enDesc:'Play The Great Empire free online: gather resources, train an army and conquer the enemy camp in a mobile real-time strategy game.',itAlt:'The Great Empire — villaggio, contadini e soldati in battaglia strategica',enAlt:'The Great Empire — villagers and soldiers fighting for an expanding town'}
};

const META_ES={
  home:{title:'Videojuegos gratis y retrogames online | RetroWebGames',desc:'Juega gratis online a videojuegos y retrogames originales: arcade, Snake, Solitario, puzles, shooters y web games optimizados para móvil.',alt:'RetroWebGames — clásicos arcade reinventados para la web'},
  avatar:{title:'Crea tu avatar | RetroWebGames',desc:'Personaliza el avatar local que usas en los videojuegos de RetroWebGames y encuéntralo junto a tus créditos durante las partidas.'},
  'block-drop':{title:'Block Drop: videojuego de puzle gratis | RetroWebGames',desc:'Juega gratis a Block Drop, un puzle de bloques y líneas con controles táctiles, niveles progresivos y partidas rápidas en el navegador.',alt:'Block Drop — bloques luminosos cayendo sobre una cuadrícula arcade'},
  'bubble-burst':{title:'Bubble Burst: bubble shooter gratis online | RetroWebGames',desc:'Juega gratis a Bubble Burst, un bubble shooter con rebotes, combos, bombas y niveles originales, optimizado para móvil.',alt:'Bubble Burst — bubble shooter arcade con equipo chibi y burbujas de neón'},
  'maze-munch':{title:'Maze Munch: juego arcade retro gratis | RetroWebGames',desc:'Juega gratis a Maze Munch, un retrogame arcade original con laberintos, perseguidores, nodos de energía y combos.',alt:'Maze Munch — persecución arcade en un laberinto de neón'},
  'neon-rally':{title:'Neon Rally: juego arcade gratis online | RetroWebGames',desc:'Juega gratis a Neon Rally, un duelo arcade de reflejos y rebotes contra la CPU con controles táctiles.',alt:'Neon Rally — duelo arcade de palas y energía de neón'},
  'neon-snake':{title:'Neon Snake: juego Snake gratis online | RetroWebGames',desc:'Juega gratis a Snake online con Neon Snake: crece, crea combos, recoge escudos y supera obstáculos en un retrogame moderno.',alt:'Neon Snake — serpiente luminosa sobre una cuadrícula arcade'},
  'neon-tilt':{title:'Neon Tilt: videojuego móvil gratis | RetroWebGames',desc:'Juega gratis a Neon Tilt: inclina el móvil y guía la canica entre cristales, bumpers, hielo y laberintos.',alt:'Neon Tilt — esfera cromada en un laberinto inclinado de neón'},
  'prism-breaker':{title:'Prism Breaker: rompebloques gratis | RetroWebGames',desc:'Juega gratis a Prism Breaker, un brick breaker con 100 niveles originales, power-ups, ladrillos especiales y bosses arcade.',alt:'Prism Breaker — bola y pala entre prismas y ladrillos de neón'},
  solitaire:{title:'Solitario gratis online: Klondike y FreeCell | RetroWebGames',desc:'Juega gratis al Solitario online: Klondike y FreeCell con 52 cartas, drag, tap, deshacer y pistas, optimizado para móvil.',alt:'Solitario — cartas francesas clásicas sobre una mesa verde arcade'},
  'star-swarm':{title:'Star Swarm: videojuego space shooter gratis | RetroWebGames',desc:'Juega gratis a Star Swarm, un space shooter con 100 niveles, 10 bosses, mejoras de armas, POWER y wingmen.',alt:'Star Swarm — nave arcade contra un enjambre alienígena de neón'},
  'the-great-empire':{title:'The Great Empire: estrategia gratis | RetroWebGames',desc:'Juega gratis a The Great Empire: recoge recursos, entrena un ejército y conquista el campamento enemigo.',alt:'The Great Empire — aldeanos y soldados luchando por una ciudad en expansión'}
};

const COMMON=[
  ['Consigliato in verticale','Best in portrait'],['Caricamento High Scores','Loading High Scores'],['Torna a RetroWebGames','Back to RetroWebGames'],['Attiva o disattiva audio','Toggle audio'],['Controlli direzionali','Directional controls'],['Sposta a sinistra','Move left'],['Sposta a destra','Move right'],['Ruota pezzo','Rotate piece'],['Caduta rapida','Hard drop'],['Prossimo pezzo','Next piece'],['Tieni premuto per velocità doppia','Hold for double speed'],['Ricalibra inclinazione','Recalibrate tilt'],['TOCCA PER CONTINUARE','TAP TO CONTINUE'],['TORNA AL MENU','BACK TO MENU'],['Qualsiasi sistema con browser moderno','Any system with a modern browser'],['videogame gratis','free videogames'],['Strategia in tempo reale','Real-time strategy'],['Pausa','Pause'],['Controlli','Controls'],['Sinistra','Left'],['Destra','Right'],['Scendi','Move down'],['Su','Up'],['Giù','Down'],['Verticale','Portrait'],['GIOCA','PLAY'],['PRONTO','READY'],['VITE','LIVES'],['FALLI','MISSES']
];

const GAME_COPY={
  'bubble-burst':[['Prossima bolla','Next bubble'],['COMPLETATO!','COMPLETE!'],['Tempo livello','Level time'],['LIVELLO 1 COMPLETATO!','LEVEL 1 COMPLETE!'],['Punti livello: 0','Level points: 0'],['Tempo: 00:00.00','Time: 00:00.00'],['Totale: 0 punti!','Total: 0 points!'],['rimbalzi sulle pareti','bank shots off the walls']],
  'maze-munch':[['Scorri sul labirinto oppure usa le frecce. Raccogli tutti i punti e attiva i surge nodes.','Swipe across the maze or use the arrow keys. Collect every dot and activate the surge nodes.'],['touch / swipe • tastiera','touch / swipe • keyboard']],
  'neon-rally':[['Trascina il dito orizzontalmente per muovere la racchetta. Primo a 7 punti.','Drag horizontally to move your paddle. First to 7 points wins.'],['TU','YOU'],['touch / mouse • tastiera','touch / mouse • keyboard']],
  'neon-snake':[['Swipe o frecce per muoverti. Tieni premuto TURBO per andare a velocità doppia.','Swipe or use the arrow keys to move. Hold TURBO for double speed.'],['frecce / WASD','arrow keys / WASD']],
  'neon-tilt':[['INCLINA','TILT'],[' il telefono per guidare la biglia.',' your phone to guide the marble.'],['Touch/frecce restano sempre available.','Touch and arrow-key controls are always available.'],['Touch/frecce restano sempre disponibili.','Touch and arrow-key controls are always available.'],['Al primo avvio il browser potrebbe chiedere accesso ai sensori di movimento.','On first play, your browser may ask for motion-sensor access.']],
  'prism-breaker':[['Trascina la barra • tap per lanciare • frecce / A-D su tastiera','Drag the paddle • tap to launch • arrow keys / A-D on keyboard'],['autosalvataggio','autosave']],
  'solitaire':[['Solitario','Solitaire'],['SOLITARIO','SOLITAIRE'],['MOSSE','MOVES'],['TEMPO','TIME'],['PUNTI','SCORE'],['VARIANTE','VARIANT'],['CLASSICO','CLASSIC'],['CARTE CLASSICHE','CLASSIC CARDS'],['CARTE ESSENZIALI','ESSENTIAL CARDS'],['Scegli lo stile delle carte','Choose the card style'],['Stile delle carte','Card style'],['Tavolo del Solitaire','Solitaire table'],['Cella libera','Free cell'],['Fondazione picche','Spades foundation'],['Fondazione cuori','Hearts foundation'],['Fondazione quadri','Diamonds foundation'],['Fondazione fiori','Clubs foundation'],['Colonne del tavolo','Tableau columns'],['Mazzo di pesca e carta girata','Stock and waste piles'],['Mazzo','Stock'],['Carta girata','Waste'],['Annulla ultima mossa','Undo last move'],['ANNULLA','UNDO'],['Mostra un suggerimento','Show a hint'],['AIUTO','HINT'],['Nuova mano','New deal'],['NUOVA','NEW'],['MANO IN CORSO','DEAL IN PROGRESS'],['NUOVA PARTITA?','NEW GAME?'],['Vuoi davvero terminare questa partita e iniziarne una nuova? Tutti i progressi della mano attuale andranno persi.','Do you really want to end this game and start a new one? All progress in the current deal will be lost.'],['CONTINUA A GIOCARE','KEEP PLAYING'],['SÌ, NUOVA PARTITA','YES, NEW GAME'],['PARTITA COMPLETATA!','GAME COMPLETE!'],['MIGLIOR TEMPO','BEST TIME'],['NUOVA MANO','NEW DEAL'],['RETROWEBGAMES • CARTE','RETROWEBGAMES • CARDS'],['Variante del Solitaire','Solitaire variant'],['FREECELL • 4 CELLE LIBERE','FREECELL • 4 FREE CELLS'],['Scegli la variante prima di iniziare.','Choose a variant before starting.'],['PESCA 1','DRAW 1'],['7 COLONNE','7 COLUMNS'],['52 CARTE','52 CARDS'],['Tap per selezionare • trascina per spostare • doppio tap per mossa automatica','Tap to select • drag to move • double-tap for an automatic move'],['LIBERA','FREE']],
  'star-swarm':[['Energia boss','Boss energy'],['Boss sconfitto','Boss defeated'],['BOSS SCONFITTO!!','BOSS DEFEATED!!']],
  'the-great-empire':[["tocca un'unità, poi tocca dove mandarla",'tap a unit, then tap its destination'],['Raccogli, costruisci, avanza di Età e conquista','Gather, build, advance through the Ages and conquer'],['Mappa di The Great Empire','The Great Empire map'],['Comandi','Commands'],['CIBO','FOOD'],['LEGNO','WOOD'],['ORO','GOLD'],['PUNTI','SCORE'],['ETÀ PIETRA','STONE AGE'],['CONTADINO','VILLAGER'],['GUERRIERO','WARRIOR'],['ARCIERE','ARCHER'],['CAVALLERIA','CAVALRY'],['CASA','HOUSE'],['TORRE','TOWER'],['BRONZO','BRONZE'],['CONTADINI','VILLAGERS'],['SOLDATI','SOLDIERS'],['ASSALTO','ASSAULT'],['RETROWEBGAMES • STRATEGIA','RETROWEBGAMES • STRATEGY']]
};

const EXTRA_COPY={
  solitaire:[['CONTINUA A PLAYRE','KEEP PLAYING'],['PARTITA','GAME'],['COMPLETATA!','COMPLETE!'],['MIGLIOR TIME','BEST TIME'],['PAUSA','PAUSE']],
  'star-swarm':[['Consigliato to portrait','Best in portrait']],
  'block-drop':[['MISSESNG BLOCK PUZZLE','FALLING BLOCK PUZZLE']],
  'the-great-empire':[['AGE PIETRA','STONE AGE'],['PIETRA','STONE'],['LIV','LVL'],['ETÀ','AGE']]
};

const STATIC_ES=[
[' maze game e brick breaker.',' juegos de laberinto y brick breakers.'],['Verticale • touch / tastiera • nessun asset esterno','Vertical • touch / teclado • sin recursos externos'],
['Consigliato in verticale','Recomendado en vertical'],['Caricamento High Scores','Cargando High Scores'],['Torna a RetroWebGames','Volver a RetroWebGames'],['Attiva o disattiva audio','Activar o desactivar el audio'],['Controlli direzionali','Controles de dirección'],['Sposta a sinistra','Mover a la izquierda'],['Sposta a destra','Mover a la derecha'],['Ruota pezzo','Girar pieza'],['Caduta rapida','Caída rápida'],['Prossimo pezzo','Próxima pieza'],['Tieni premuto per velocità doppia','Mantén pulsado para duplicar la velocidad'],['Ricalibra inclinazione','Recalibrar inclinación'],['TOCCA PER CONTINUARE','TOCA PARA CONTINUAR'],['TORNA AL MENU','VOLVER AL MENÚ'],['Qualsiasi sistema con browser moderno','Cualquier sistema con un navegador moderno'],['Strategia in tempo reale','Estrategia en tiempo real'],['Controlli','Controles'],['Sinistra','Izquierda'],['Destra','Derecha'],['Scendi','Bajar'],['Su','Arriba'],['Giù','Abajo'],['Verticale','Vertical'],['GIOCA','JUGAR'],['PRONTO','LISTO'],['VITE','VIDAS'],['FALLI','FALLOS'],
['Formazioni aliene, picchiate, fuoco automatico e livelli sempre più rapidi.','Formaciones alienígenas, ataques en picado, fuego automático y niveles cada vez más rápidos.'],['Mira, sfrutta i rimbalzi e combina le bolle per far crollare interi grappoli.','Apunta, aprovecha los rebotes y combina burbujas para derribar racimos enteros.'],['Incastra i pezzi, completa le linee e tieni il passo con una velocità sempre maggiore.','Encaja las piezas, completa líneas y sigue el ritmo mientras aumenta la velocidad.'],['Ripulisci il labirinto, sfrutta i surge nodes e ribalta la caccia con combo sempre più ricche.','Limpia el laberinto, usa los nodos de energía y da la vuelta a la persecución con grandes combos.'],["Difendi la tua linea, controlla l'angolo del rimbalzo e supera la CPU in scambi sempre più veloci.",'Defiende tu línea, controla el ángulo del rebote y supera a la CPU en intercambios cada vez más rápidos.'],['Cresci, costruisci combo, raccogli shield e schiva ostacoli mentre la griglia accelera.','Crece, encadena combos, recoge escudos y esquiva obstáculos mientras acelera la cuadrícula.'],['Inclina lo smartphone, guida la biglia nel labirinto, raccogli i cristalli e schiva voragini e bumper.','Inclina el móvil, guía la canica por el laberinto, recoge cristales y esquiva fosos y bumpers.'],['Scegli tra Klondike e FreeCell: due classici con 52 carte, drag, tap e mosse annullabili.','Elige entre Klondike y FreeCell: dos clásicos de 52 cartas con drag, tap y movimientos deshacibles.'],['100 strutture originali, power-up, brick speciali e un boss ogni dieci livelli.','100 estructuras originales, power-ups, ladrillos especiales y un boss cada diez niveles.'],["Raccogli cibo e oro, addestra contadini e soldati e abbatti l'accampamento nemico.",'Recoge comida y oro, entrena aldeanos y soldados y destruye el campamento enemigo.'],['STRATEGIA IN TEMPO REALE','ESTRATEGIA EN TIEMPO REAL'],['MIRA','PUNTERÍA'],['LIVELLI','NIVELES'],['CARTE','CARTAS'],
['ARCADE NEL BROWSER','ARCADE EN EL NAVEGADOR'],['Videogame gratis e retrogame online','Videojuegos gratis y retrogames online'],['RetroWebGames raccoglie videogame originali ispirati ai generi arcade classici, pronti da giocare senza download. Trovi shooter, puzzle, ','RetroWebGames reúne videojuegos originales inspirados en los géneros arcade clásicos, listos para jugar sin descargas. Encontrarás shooters, puzles, '],['Snake gratis online','Snake gratis online'],['Solitario Klondike (Solitaire)','Solitario Klondike'],['I giochi sono davvero gratis?','¿Los juegos son realmente gratis?'],['Sì. Tutti i web game disponibili si avviano gratuitamente dal browser, senza account o pagamenti.','Sí. Todos los web games disponibles se inician gratis desde el navegador, sin cuenta ni pagos.'],['Sono copie dei videogame classici?','¿Son copias de videojuegos clásicos?'],['No. Codice, nomi e grafica sono originali; ogni gioco è un tributo al proprio genere arcade o retrogame.','No. El código, los nombres y los gráficos son originales; cada juego es un homenaje a su género arcade o retrogame.'],['Devo installare qualcosa?','¿Tengo que instalar algo?'],['No. Puoi giocare subito sul web; l’installazione della scorciatoia è facoltativa e rende più rapido l’accesso dalla Home.','No. Puedes jugar directamente en la web; instalar el acceso directo es opcional y agiliza la entrada desde la pantalla de inicio.'],
['ALTRI MONDI DA ESPLORARE','OTROS MUNDOS POR EXPLORAR'],['Siti Partner','Sitios asociados'],['Esperienze web indipendenti che meritano un salto fuori dalla sala giochi.','Experiencias web independientes que merecen una visita fuera del arcade.'],['Visita Afelio, gestionale strategico spaziale','Visita Afelio, juego de gestión estratégica espacial'],['Pianeta roccioso di Afelio nello spazio stellato','Planeta rocoso de Afelio en el espacio estrellado'],['GESTIONALE STRATEGICO SPAZIALE','GESTIÓN ESTRATÉGICA ESPACIAL'],['Fai crescere il tuo pianeta, dosa le risorse e prepara flotte e tecnologie: nello spazio, anche una miniera ben piazzata può cambiare la galassia.','Haz crecer tu planeta, administra recursos y prepara flotas y tecnologías: en el espacio, hasta una mina bien situada puede cambiar la galaxia.'],['PROVA AFELIO','PRUEBA AFELIO'],['Visita Purrfect Dominion, strategico multiplayer di fazioni animali','Visita Purrfect Dominion, estrategia multijugador con facciones animales'],['Gatto Ninja, Corgi Imperiale e Capibara Zen di Purrfect Dominion','Gato Ninja, Corgi Imperial y Capibara Zen de Purrfect Dominion'],['STRATEGIA MULTIPLAYER IN TEMPO REALE','ESTRATEGIA MULTIJUGADOR EN TIEMPO REAL'],['Scegli Gatti Ninja, Corgi Imperiali o Capibara Zen: costruisci il tuo regno, conquista territori e soprattutto non farti rubare i Biscotti.','Elige Gatos Ninja, Corgis Imperiales o Capibaras Zen: construye tu reino, conquista territorios y, sobre todo, protege tus Galletas.'],['CONQUISTA I BISCOTTI','CONQUISTA LAS GALLETAS'],["RetroWebGames continua a crescere. L'architettura è pronta per aggiungere nuovi giochi senza cambiare l'esperienza di navigazione.",'RetroWebGames sigue creciendo. La arquitectura está lista para añadir nuevos juegos sin cambiar la experiencia de navegación.'],['RetroWebGames usa codice, nomi e grafica originali. I giochi sono tributi di genere ai classici arcade e non includono asset dei titoli originali.','RetroWebGames utiliza código, nombres y gráficos originales. Sus juegos homenajean géneros arcade clásicos y no incluyen recursos de títulos originales.'],
['Prossima bolla','Próxima burbuja'],['COMPLETATO!','¡COMPLETADO!'],['Tempo livello','Tiempo del nivel'],['Punti livello: 0','Puntos del nivel: 0'],['Tempo: 00:00.00','Tiempo: 00:00.00'],['Totale: 0 punti!','¡Total: 0 puntos!'],['rimbalzi sulle pareti','rebotes en las paredes'],
['Scorri sul labirinto oppure usa le frecce. Raccogli tutti i punti e attiva i surge nodes.','Desliza por el laberinto o usa las flechas. Recoge todos los puntos y activa los nodos de energía.'],['touch / swipe • tastiera','touch / swipe • teclado'],['Trascina il dito orizzontalmente per muovere la racchetta. Primo a 7 punti.','Arrastra el dedo horizontalmente para mover la pala. Gana quien llegue primero a 7 puntos.'],['TU','TÚ'],['touch / mouse • tastiera','touch / ratón • teclado'],['Swipe o frecce per muoverti. Tieni premuto TURBO per andare a velocità doppia.','Desliza o usa las flechas para moverte. Mantén TURBO pulsado para duplicar la velocidad.'],['frecce / WASD','flechas / WASD'],['INCLINA','INCLINA'],[' il telefono per guidare la biglia.',' el teléfono para guiar la canica.'],['Touch/frecce restano sempre disponibili.','Touch y las flechas están siempre disponibles.'],['Al primo avvio il browser potrebbe chiedere accesso ai sensori di movimento.','En la primera partida, el navegador puede pedir acceso a los sensores de movimiento.'],['Trascina la barra • tap per lanciare • frecce / A-D su tastiera','Arrastra la pala • toca para lanzar • flechas / A-D en el teclado'],['autosalvataggio','guardado automático'],
['Solitario','Solitario'],['MOSSE','MOVIMIENTOS'],['TEMPO','TIEMPO'],['PUNTI','PUNTOS'],['VARIANTE','VARIANTE'],['CLASSICO','CLÁSICO'],['CARTE CLASSICHE','CARTAS CLÁSICAS'],['CARTE ESSENZIALI','CARTAS ESENCIALES'],['Scegli lo stile delle carte','Elige el estilo de las cartas'],['Stile delle carte','Estilo de las cartas'],['Tavolo del Solitaire','Mesa del Solitario'],['Cella libera','Celda libre'],['Fondazione picche','Fundación de picas'],['Fondazione cuori','Fundación de corazones'],['Fondazione quadri','Fundación de diamantes'],['Fondazione fiori','Fundación de tréboles'],['Colonne del tavolo','Columnas del tablero'],['Mazzo di pesca e carta girata','Mazo y descarte'],['Mazzo','Mazo'],['Carta girata','Descarte'],['Annulla ultima mossa','Deshacer último movimiento'],['ANNULLA','DESHACER'],['Mostra un suggerimento','Mostrar una pista'],['AIUTO','PISTA'],['Nuova mano','Nueva partida'],['NUOVA','NUEVA'],['MANO IN CORSO','PARTIDA EN CURSO'],['NUOVA PARTITA?','¿NUEVA PARTIDA?'],['Vuoi davvero terminare questa partita e iniziarne una nuova? Tutti i progressi della mano attuale andranno persi.','¿Quieres terminar esta partida e iniciar una nueva? Perderás todo el progreso actual.'],['CONTINUA A GIOCARE','SEGUIR JUGANDO'],['SÌ, NUOVA PARTITA','SÍ, NUEVA PARTIDA'],['PARTITA COMPLETATA!','¡PARTIDA COMPLETADA!'],['MIGLIOR TEMPO','MEJOR TIEMPO'],['NUOVA MANO','NUEVA PARTIDA'],['RETROWEBGAMES • CARTE','RETROWEBGAMES • CARTAS'],['Variante del Solitaire','Variante del Solitario'],['FREECELL • 4 CELLE LIBERE','FREECELL • 4 CELDAS LIBRES'],['Scegli la variante prima di iniziare.','Elige la variante antes de empezar.'],['PESCA 1','ROBA 1'],['7 COLONNE','7 COLUMNAS'],['52 CARTE','52 CARTAS'],['Tap per selezionare • trascina per spostare • doppio tap per mossa automatica','Toca para seleccionar • arrastra para mover • doble toque para movimiento automático'],['LIBERA','LIBRE'],
['Energia boss','Energía del boss'],['Boss sconfitto','Boss derrotado'],['BOSS SCONFITTO!!','¡¡BOSS DERROTADO!!'],["tocca un'unità, poi tocca dove mandarla",'toca una unidad y luego su destino'],['Raccogli, costruisci, avanza di Età e conquista','Recoge, construye, avanza de Era y conquista'],['Mappa di The Great Empire','Mapa de The Great Empire'],['Comandi','Órdenes'],['CIBO','COMIDA'],['LEGNO','MADERA'],['ORO','ORO'],['ETÀ PIETRA','EDAD DE PIEDRA'],['CONTADINO','ALDEANO'],['GUERRIERO','GUERRERO'],['ARCIERE','ARQUERO'],['CAVALLERIA','CABALLERÍA'],['CASA','CASA'],['TORRE','TORRE'],['BRONZO','BRONCE'],['CONTADINI','ALDEANOS'],['SOLDATI','SOLDADOS'],['ASSALTO','ASALTO'],['RETROWEBGAMES • STRATEGIA','RETROWEBGAMES • ESTRATEGIA']
];

const flatten=(value,prefix='',out=[])=>{for(const [key,item] of Object.entries(value)){const full=prefix?`${prefix}.${key}`:key;if(typeof item==='string')out.push([full,item]);else flatten(item,full,out);}return out;};
const sharedPairs=flatten(italianShared).map(([key,it])=>[it,flatten(englishShared).find(([candidate])=>candidate===key)?.[1]]).filter(([it,en])=>en&&it.length>=4&&it!==en).sort((a,b)=>b[0].length-a[0].length);
const spanishLookup=new Map([...flatten(spanishShared),...flatten({games:spanishGames})]);
const spanishPairs=[...flatten(italianShared),...flatten({games:italianGames})].map(([key,it])=>[it,spanishLookup.get(key)]).filter(([it,es])=>es&&it.length>=4&&it!==es).sort((a,b)=>b[0].length-a[0].length);
const replaceAll=(html,from,to)=>html.split(from).join(to);

function resolveAssets(html,page){
  const base=page.id==='home'?'/' : `/${page.route}/`;
  html=html.replace(/\b(src|href|data-rwg-src)=(['"])(?!\/|https?:|#|data:)([^'"]+)\2/g,(_,attr,quote,ref)=>{
    const resolved=path.posix.normalize(path.posix.join(base,ref));
    return `${attr}=${quote}${resolved.startsWith('/')?resolved:'/'+resolved}${quote}`;
  });
  return html.replace(/\bdata-rwg-srcset=(['"])([^'"]+)\1/g,(_,quote,value)=>{
    const resolved=value.split(',').map(candidate=>{
      const parts=candidate.trim().split(/\s+/);
      if(!parts[0]||parts[0].startsWith('/')||/^(?:https?:|data:)/.test(parts[0]))return candidate.trim();
      parts[0]=path.posix.normalize(path.posix.join(base,parts[0]));
      if(!parts[0].startsWith('/'))parts[0]='/'+parts[0];
      return parts.join(' ');
    }).join(', ');
    return `data-rwg-srcset=${quote}${resolved}${quote}`;
  });
}

function restoreItalianAssetStyle(html,page){
  if(page.id==='home'){
    const sourceRelative=new Set([
      'manifest.webmanifest','hub.css','brand.css','hub-games.css','hub-partners.css',
      'hub-share.css','pwa-install.css','rwg-profile.js','rwg-avatar.js','hub-share.js'
    ]);
    return html.replace(/\b(src|href)=(['"])\/([^'"]+)\2/g,(whole,attr,quote,ref)=>{
      const clean=ref.split('?')[0];
      return sourceRelative.has(clean)?`${attr}=${quote}${ref}${quote}`:whole;
    });
  }
  if(page.id==='avatar'){
    html=html.replace(/\b(src|href)=(['"])\/avatar\/([^'"]+)\2/g,(_,attr,quote,ref)=>`${attr}=${quote}${ref}${quote}`);
    return html.replace(/\b(src|href)=(['"])\/(?!en\/|games\/|avatar\/)([^'"]+)\2/g,(_,attr,quote,ref)=>`${attr}=${quote}../${ref}${quote}`);
  }
  const localPrefix=`/${page.route}/`;
  html=html.replace(/\b(src|href)=(['"])([^'"]+)\2/g,(whole,attr,quote,ref)=>ref.startsWith(localPrefix)?`${attr}=${quote}${ref.slice(localPrefix.length)}${quote}`:whole);
  return html.replace(/\b(src|href)=(['"])\/(?!en\/|games\/|i18n\/)([^'"]+)\2/g,(_,attr,quote,ref)=>`${attr}=${quote}../../${ref}${quote}`);
}

function alternates(page){
  const suffix=page.route?`/${page.route}/`:'/';
  const it=`${ORIGIN}${suffix}`;
  const en=`${ORIGIN}/en${suffix}`;
  const es=`${ORIGIN}/es${suffix}`;
  return `  <link rel="alternate" hreflang="it" href="${it}" />\n  <link rel="alternate" hreflang="en" href="${en}" />\n  <link rel="alternate" hreflang="es" href="${es}" />\n  <link rel="alternate" hreflang="x-default" href="${it}" />\n`;
}

function setSeo(html,page,locale){
  const suffix=page.route?`/${page.route}/`:'/';
  const canonical=`${ORIGIN}${locale==='it'?suffix:`/${locale}${suffix}`}`;
  html=html.replace(/\s*<link rel="alternate"[^>]+>\n?/g,'\n');
  html=html.replace(/\s*<meta property="og:locale:alternate"[^>]+>\n?/g,'\n');
  html=html.replace(/  <link rel="canonical"[^>]+>\n/,`${alternates(page)}  <link rel="canonical" href="${canonical}" />\n`);
  if(locale==='en'){
    html=html.replace('<html lang="it">','<html lang="en">');
    html=html.replace('<meta property="og:locale" content="it_IT" />','<meta property="og:locale" content="en_US" />\n  <meta property="og:locale:alternate" content="it_IT" />');
    html=replaceAll(html,'"inLanguage": "it-IT"','"inLanguage": "en"');
    if(page.route) html=replaceAll(html,`${ORIGIN}${suffix}`,canonical);
  }else if(locale==='es'){
    html=html.replace('<html lang="it">','<html lang="es">');
    html=html.replace('<meta property="og:locale" content="it_IT" />','<meta property="og:locale" content="es_ES" />\n  <meta property="og:locale:alternate" content="it_IT" />\n  <meta property="og:locale:alternate" content="en_US" />');
    html=replaceAll(html,'"inLanguage": "it-IT"','"inLanguage": "es"');
    if(page.route)html=replaceAll(html,`${ORIGIN}${suffix}`,canonical);
    else{
      html=replaceAll(html,`<meta property="og:url" content="${ORIGIN}/" />`,`<meta property="og:url" content="${ORIGIN}/es/" />`);
      html=replaceAll(html,`"@type": "WebPage",\n      "@id": "${ORIGIN}/#webpage",\n      "url": "${ORIGIN}/"`,`"@type": "WebPage",\n      "@id": "${ORIGIN}/es/#webpage",\n      "url": "${ORIGIN}/es/"`);
      html=replaceAll(html,`"url": "${ORIGIN}/games/`,`"url": "${ORIGIN}/es/games/`);
    }
  }else{
    html=html.replace('<meta property="og:locale" content="it_IT" />','<meta property="og:locale" content="it_IT" />\n  <meta property="og:locale:alternate" content="en_US" />\n  <meta property="og:locale:alternate" content="es_ES" />');
  }
  return html;
}

function localizeNavigation(html,page,locale){
  const suffix=page.route?`/${page.route}/`:'/';
  const itHref=suffix;
  const enHref=`/en${suffix}`;
  const esHref=`/es${suffix}`;
  html=html.replace(/<nav class="rwg-language-switcher"[\s\S]*?<\/nav>/,`<nav class="rwg-language-switcher" aria-label="Language"><a href="${itHref}" data-rwg-language="it"${locale==='it'?' aria-current="page"':''}>IT</a><a href="${enHref}" data-rwg-language="en"${locale==='en'?' aria-current="page"':''}>EN</a><a href="${esHref}" data-rwg-language="es"${locale==='es'?' aria-current="page"':''}>ES</a></nav>`);
  if(locale!=='it'){
    html=html.replace(/(<a\b[^>]*\bhref=")https:\/\/www\.retrowebgames\.it\/("[^>]*>)/g,`$1/en/$2`);
    html=html.replace(/(<a\b[^>]*\bhref=")\/("[^>]*>)/g,`$1/en/$2`);
    if(locale==='es')html=html.replace(/href="\/en\//g,'href="/es/');
  }
  html=html.replace(/<nav class="rwg-language-switcher"[\s\S]*?<\/nav>/,`<nav class="rwg-language-switcher" aria-label="Language"><a href="${itHref}" data-rwg-language="it"${locale==='it'?' aria-current="page"':''}>IT</a><a href="${enHref}" data-rwg-language="en"${locale==='en'?' aria-current="page"':''}>EN</a><a href="${esHref}" data-rwg-language="es"${locale==='es'?' aria-current="page"':''}>ES</a></nav>`);
  return html;
}

function translateGeneric(html){
  for(const [from,to] of sharedPairs) html=replaceAll(html,from,to);
  for(const [from,to] of COMMON.sort((a,b)=>b[0].length-a[0].length)) html=replaceAll(html,from,to);
  return html;
}

export function renderPage(pageId,locale){
  const page=PAGES.find(item=>item.id===pageId);
  if(!page||!['it','en','es'].includes(locale))throw new Error(`Unsupported page ${pageId}/${locale}`);
  let html;
  if(locale==='it') html=restoreItalianAssetStyle(resolveAssets(fs.readFileSync(path.resolve(page.source),'utf8'),page),page);
  else if(locale==='en'&&page.id==='home') html=renderPilotPage('home',locale);
  else if(locale==='en'&&page.id==='block-drop') html=renderPilotPage('blockDrop',locale);
  else html=resolveAssets(fs.readFileSync(path.resolve(page.source),'utf8'),page);
  html=setSeo(html,page,locale);
  if(locale==='en'){
    if(page.id==='home') html=replaceAll(html,'STRATEGY MULTIPLAYER IN TEMPO REALE','REAL-TIME MULTIPLAYER STRATEGY');
    if(page.id==='avatar'){
      for(const [from,to] of [['Crea il tuo avatar | RetroWebGames','Create your avatar | RetroWebGames'],['Personalizza l’avatar locale usato nei videogame di RetroWebGames e ritrovalo accanto ai crediti durante le partite.','Customize the local avatar used across RetroWebGames and find it beside your credits while you play.'],['SALA GIOCHI','ARCADE'],['CREA IL TUO','CREATE YOUR']]) html=replaceAll(html,from,to);
      html=translateGeneric(html);
    }else if(page.id!=='home'&&page.id!=='block-drop'){
      const meta=META[page.id];
      for(const [from,to] of [[meta.itTitle,meta.enTitle],[meta.itDesc,meta.enDesc],[meta.itAlt,meta.enAlt]]) html=replaceAll(html,from,to);
      html=translateGeneric(html);
      const pageCopy=[...(GAME_COPY[page.id]||[]),...(EXTRA_COPY[page.id]||[])];
      for(const [from,to] of pageCopy.sort((a,b)=>b[0].length-a[0].length)) html=replaceAll(html,from,to);
    }
    if(page.id==='block-drop'){html=translateGeneric(html);for(const [from,to] of EXTRA_COPY['block-drop']) html=replaceAll(html,from,to);}
    if(page.id==='solitaire')html=replaceAll(html,'↶ <span>CANCEL</span>','↶ <span>UNDO</span>');
    html=html.replace(/\/rwg-i18n\.js\?v=[^"']+/g,'/rwg-i18n.en.js?v=20260908.2');
    if(page.id!=='home'&&page.id!=='avatar') html=replaceAll(html,`/i18n/it/games/${page.id}.js?v=20260908.2`,`/i18n/en/games/${page.id}.js?v=20260908.2`);
  }else if(locale==='es'){
    const meta=META_ES[page.id];
    if(page.id==='home')for(const [from,to]of [['Videogame gratis e retrogame online | RetroWebGames',meta.title],['Gioca gratis online a videogame e retrogame originali: arcade, Snake, Solitario, puzzle, shooter e web game ottimizzati per smartphone.',meta.desc],['RetroWebGames — arcade classics, reimagined for the web',meta.alt]])html=replaceAll(html,from,to);
    else if(page.id==='avatar')for(const [from,to]of [['Crea il tuo avatar | RetroWebGames',meta.title],['Personalizza l’avatar locale usato nei videogame di RetroWebGames e ritrovalo accanto ai crediti durante le partite.',meta.desc],['SALA GIOCHI','ARCADE'],['CREA IL TUO','CREA TU']])html=replaceAll(html,from,to);
    else{const source=META[page.id];for(const [from,to]of [[source.itTitle,meta.title],[source.itDesc,meta.desc],[source.itAlt,meta.alt]])html=replaceAll(html,from,to);}
    for(const [from,to]of STATIC_ES.sort((a,b)=>b[0].length-a[0].length))html=replaceAll(html,from,to);
    for(const [from,to]of spanishPairs)html=replaceAll(html,from,to);
    html=replaceAll(html,'SCEGLI IL TÚO STILE','ELIGE TU ESTILO');
    html=replaceAll(html,'PARTITA<br><span>COMPLETATA!','¡PARTIDA<br><span>COMPLETADA!');
    html=html.replace(/\/rwg-i18n\.js\?v=[^"']+/g,'/rwg-i18n.es.js?v=20260908.3');
    if(page.id!=='home'&&page.id!=='avatar')html=replaceAll(html,`/i18n/it/games/${page.id}.js?v=20260908.2`,`/i18n/es/games/${page.id}.js?v=20260908.3`);
  }else html=replaceAll(html,'/rwg-i18n.js?v=20260908.1','/rwg-i18n.js?v=20260908.2');
  html=localizeNavigation(html,page,locale);
  html=replaceAll(html,'loadoutUpmmary','loadoutSummary');
  html=replaceAll(html,'loadoutArribammary','loadoutSummary');
  if(locale!=='it'&&page.id==='home'){
    for(const game of PAGES.filter(item=>item.route.startsWith('games/'))) html=replaceAll(html,`href="/${game.route}/"`,`href="/en/${game.route}/"`);
    if(locale==='es')html=html.replace(/href="\/en\/games\//g,'href="/es/games/');
  }
  return html;
}
