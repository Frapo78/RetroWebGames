import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = 'https://www.retrowebgames.it';
const sources = {
  home: 'public/index.html',
  blockDrop: 'public/games/block-drop/index.html'
};

const english = new Map([
  ['Videogame gratis e retrogame online | RetroWebGames', 'Free videogames and retrogames online | RetroWebGames'],
  ['Gioca gratis online a videogame e retrogame originali: arcade, Snake, Solitario, puzzle, shooter e web game ottimizzati per smartphone.', 'Play original videogames and retrogames online for free: arcade, Snake, Solitaire, puzzle, shooters and web games made for smartphones.'],
  ['Block Drop: videogame puzzle gratis | RetroWebGames', 'Block Drop: free falling-block puzzle | RetroWebGames'],
  ['Gioca gratis a Block Drop, videogame puzzle di blocchi e linee con controlli touch, livelli progressivi e partite rapide nel browser.', 'Play Block Drop free online: a falling-block puzzle with touch controls, progressive levels and quick browser sessions.'],
  ['Block Drop — blocchi luminosi in caduta su una griglia arcade', 'Block Drop — glowing blocks falling across an arcade grid'],
  ['Qualsiasi sistema con browser moderno', 'Any system with a modern browser'],
  ['Torna a RetroWebGames', 'Back to RetroWebGames'],
  ['LINEE', 'LINES'], ['Pausa', 'Pause'], ['Prossimo pezzo', 'Next piece'], ['Controlli', 'Controls'],
  ['Sposta a sinistra', 'Move left'], ['Ruota pezzo', 'Rotate piece'], ['Sposta a destra', 'Move right'],
  ['Scendi', 'Move down'], ['Caduta rapida', 'Hard drop'], ['RUOTA', 'ROTATE'],
  ['RETROWEBGAMES • FALLING BLOCK PUZZLE', 'RETROWEBGAMES • FALLING BLOCK PUZZLE'],
  ['Caricamento High Scores', 'Loading High Scores'], ['GIOCA', 'PLAY'], ['TORNA AL MENU', 'BACK TO MENU'],
  ['Verticale • touch / tastiera • nessun asset esterno', 'Portrait • touch / keyboard • no external assets'],
  ['ARCADE MOBILE • ZERO INSTALLAZIONE', 'MOBILE ARCADE • ZERO INSTALLS'],
  ['Videogame gratis e retrogame originali da giocare subito nel browser. Scegli un web game e parti: controlli touch, sessioni veloci e record salvati sul dispositivo.', 'Free original videogames and retrogames you can play right in your browser. Pick a web game and jump in: touch controls, quick sessions and records saved on your device.'],
  ['9 GIOCHI DISPONIBILI', '10 GAMES AVAILABLE'], ['Giochi disponibili', 'Available games'],
  ['Formazioni aliene, picchiate, fuoco automatico e livelli sempre più rapidi.', 'Alien formations, dive attacks, automatic fire and increasingly fast levels.'],
  ['Mira, sfrutta i rimbalzi e combina le bolle per far crollare interi grappoli.', 'Aim, use bank shots and match bubbles to bring down entire clusters.'],
  ['Incastra i pezzi, completa le linee e tieni il passo con una velocità sempre maggiore.', 'Fit the pieces, clear lines and keep up as the speed rises.'],
  ['Ripulisci il labirinto, sfrutta i surge nodes e ribalta la caccia con combo sempre più ricche.', 'Clear the maze, use surge nodes and turn the chase around with richer combos.'],
  ["Difendi la tua linea, controlla l'angolo del rimbalzo e supera la CPU in scambi sempre più veloci.", 'Defend your line, control the rebound angle and beat the CPU through ever-faster rallies.'],
  ['Cresci, costruisci combo, raccogli shield e schiva ostacoli mentre la griglia accelera.', 'Grow, build combos, collect shields and dodge obstacles as the grid accelerates.'],
  ['Inclina lo smartphone, guida la biglia nel labirinto, raccogli i cristalli e schiva voragini e bumper.', 'Tilt your phone, guide the marble through the maze, collect crystals and avoid pits and bumpers.'],
  ['Scegli tra Klondike e FreeCell: due classici con 52 carte, drag, tap e mosse annullabili.', 'Choose Klondike or FreeCell: two 52-card classics with drag, tap and undo.'],
  ['100 strutture originali, power-up, brick speciali e un boss ogni dieci livelli.', '100 original layouts, power-ups, special bricks and a boss every ten levels.'],
  ["Raccogli cibo e oro, addestra contadini e soldati e abbatti l'accampamento nemico.", 'Gather food and gold, train villagers and soldiers, and destroy the enemy camp.'],
  ['RWG sempre a portata di tap', 'RWG always one tap away'],
  ['Aggiungilo alla Home e la sala giochi è subito lì.', 'Add it to your Home Screen and the arcade is right there.'],
  ['INSTALLA LA WEB APP', 'INSTALL WEB APP'], ['INSTALLA', 'INSTALL'],
  ['Chiudi avviso installazione', 'Close install notice'],
  ['VERTICALE', 'PORTRAIT'], ['MIRA', 'AIM'], ['CARTE', 'CARDS'],
  ['STRATEGIA IN TEMPO REALE', 'REAL-TIME STRATEGY'], ['STRATEGIA', 'STRATEGY'], ['LIVELLI', 'LEVELS'],
  ['ARCADE NEL BROWSER', 'ARCADE IN YOUR BROWSER'],
  ['Videogame gratis e retrogame online', 'Free videogames and retrogames online'],
  ['RetroWebGames raccoglie videogame originali ispirati ai generi arcade classici, pronti da giocare senza download. Trovi shooter, puzzle, ', 'RetroWebGames brings together original videogames inspired by classic arcade genres, ready to play with no download. Discover shooters, puzzles, '],
  ['Snake gratis online', 'free online Snake'], ['Solitario Klondike (Solitaire)', 'Klondike Solitaire'],
  ['I giochi sono davvero gratis?', 'Are the games really free?'],
  ['Sì. Tutti i web game disponibili si avviano gratuitamente dal browser, senza account o pagamenti.', 'Yes. Every web game starts free in your browser, with no account or payment.'],
  ['Sono copie dei videogame classici?', 'Are these copies of classic videogames?'],
  ['No. Codice, nomi e grafica sono originali; ogni gioco è un tributo al proprio genere arcade o retrogame.', 'No. The code, names and artwork are original; each game is a tribute to its arcade or retrogame genre.'],
  ['Devo installare qualcosa?', 'Do I need to install anything?'],
  ['No. Puoi giocare subito sul web; l’installazione della scorciatoia è facoltativa e rende più rapido l’accesso dalla Home.', 'No. Play instantly on the web; adding the shortcut is optional and gives you faster Home Screen access.'],
  ['Porta la sala giochi in Home', 'Bring the arcade to your Home Screen'],
  ['Un tap e sei dentro. Niente app pesanti: solo la scorciatoia e pochissimo spazio.', 'One tap and you are in. No heavy app: just a tiny shortcut.'],
  ['ALTRI MONDI DA ESPLORARE', 'MORE WORLDS TO EXPLORE'], ['Siti Partner', 'Partner Sites'],
  ['Esperienze web indipendenti che meritano un salto fuori dalla sala giochi.', 'Independent web experiences worth a quick trip beyond the arcade.'],
  ['GESTIONALE STRATEGICO SPAZIALE', 'SPACE STRATEGY MANAGEMENT'],
  ['Fai crescere il tuo pianeta, dosa le risorse e prepara flotte e tecnologie: nello spazio, anche una miniera ben piazzata può cambiare la galassia.', 'Grow your planet, balance resources, and prepare fleets and technology: in space, even one well-placed mine can change the galaxy.'],
  ['PROVA AFELIO', 'TRY AFELIO'], ['STRATEGIA MULTIPLAYER IN TEMPO REALE', 'REAL-TIME MULTIPLAYER STRATEGY'],
  ['Scegli Gatti Ninja, Corgi Imperiali o Capibara Zen: costruisci il tuo regno, conquista territori e soprattutto non farti rubare i Biscotti.', 'Choose Ninja Cats, Imperial Corgis or Zen Capybaras: build your kingdom, conquer territory and, above all, protect the Biscuits.'],
  ['CONQUISTA I BISCOTTI', 'CONQUER THE BISCUITS'],
  ["RetroWebGames continua a crescere. L'architettura è pronta per aggiungere nuovi giochi senza cambiare l'esperienza di navigazione.", 'RetroWebGames keeps growing. Its architecture is ready for new games without changing the way you play and browse.'],
  ['RetroWebGames usa codice, nomi e grafica originali. I giochi sono tributi di genere ai classici arcade e non includono asset dei titoli originali.', 'RetroWebGames uses original code, names and artwork. Its games are genre tributes to arcade classics and contain no assets from the original titles.'],
  ['Condividi RetroWebGames', 'Share RetroWebGames'], ['Condividi su WhatsApp', 'Share on WhatsApp'],
  ['Invita subito un amico a giocare', 'Invite a friend to play'], ['Condividi su Facebook', 'Share on Facebook'],
  ['Condividi su X', 'Share on X'], ['Condividi su Telegram', 'Share on Telegram'],
  ['Condividi su LinkedIn', 'Share on LinkedIn'], ['Altre opzioni di condivisione', 'More sharing options'], ['Altro', 'More'],
  ['Visita Afelio, gestionale strategico spaziale', 'Visit Afelio, a space strategy management game'],
  ['Visita Purrfect Dominion, strategico multiplayer di fazioni animali', 'Visit Purrfect Dominion, a multiplayer animal-faction strategy game'],
  ['Pianeta roccioso di Afelio nello spazio stellato', 'Afelio rocky planet in a starry space'],
  ['Gatto Ninja, Corgi Imperiale e Capibara Zen di Purrfect Dominion', 'Ninja Cat, Imperial Corgi and Zen Capybara from Purrfect Dominion'],
  ['"name": "Solitario"', '"name": "Solitaire"'], ['"genre": [\n              "Solitario",', '"genre": [\n              "Solitaire",'],
  ['"Strategia in tempo reale"', '"Real-time strategy"'], ['alt="Solitario"', 'alt="Solitaire"']
]);

function replaceAll(html, from, to) { return html.split(from).join(to); }

function normalizeAssetUrls(html, page) {
  if (page === 'home') {
    for (const name of ['manifest.webmanifest', 'hub.css', 'brand.css', 'hub-games.css', 'hub-partners.css', 'hub-share.css', 'pwa-install.css', 'rwg-profile.js', 'rwg-avatar.js', 'hub-share.js']) {
      html = html.replace(new RegExp(`([\"'])${name.replace('.', '\\.')}`, 'g'), `$1/${name}`);
    }
  } else {
    html = html.replace(/(["'])style\.css/g, '$1/games/block-drop/style.css');
    html = html.replace(/(["'])game\.js/g, '$1/games/block-drop/game.js');
    html = html.replace(/(["'])\.\.\/\.\.\//g, '$1/');
  }
  return html;
}

function localizedUrl(page, locale) {
  const suffix = page === 'home' ? '/' : '/games/block-drop/';
  return locale === 'it' ? `${ORIGIN}${suffix}` : `${ORIGIN}/${locale}${suffix}`;
}

function alternateMarkup(page) {
  const it = localizedUrl(page, 'it');
  const en = localizedUrl(page, 'en');
  return `  <link rel="alternate" hreflang="it" href="${it}" />\n  <link rel="alternate" hreflang="en" href="${en}" />\n  <link rel="alternate" hreflang="x-default" href="${it}" />\n`;
}

export function renderPilotPage(page, locale) {
  if (!sources[page] || !['it', 'en'].includes(locale)) throw new Error(`Unsupported pilot page/locale: ${page}/${locale}`);
  let html = fs.readFileSync(path.resolve(sources[page]), 'utf8');
  html = normalizeAssetUrls(html, page);
  const canonicalIt = localizedUrl(page, 'it');
  const canonical = localizedUrl(page, locale);
  if (locale === 'en') {
    html = html.replace('<html lang="it">', '<html lang="en">');
    html = replaceAll(html, canonicalIt, canonical);
    if (page === 'home') {
      html = replaceAll(html, canonical + 'assets/', ORIGIN + '/assets/');
      html = replaceAll(html, canonical + 'icons/', ORIGIN + '/icons/');
      for (const slug of ['star-swarm', 'bubble-burst', 'maze-munch', 'neon-rally', 'neon-snake', 'neon-tilt', 'solitaire', 'prism-breaker', 'the-great-empire']) {
        html = replaceAll(html, canonical + 'games/' + slug + '/', ORIGIN + '/games/' + slug + '/');
      }
    }
    html = html.replace('<meta property="og:locale" content="it_IT" />', '<meta property="og:locale" content="en_US" />\n  <meta property="og:locale:alternate" content="it_IT" />');
    html = replaceAll(html, '"inLanguage": "it-IT"', '"inLanguage": "en"');
    for (const [from, to] of english) html = replaceAll(html, from, to);
    if (page === 'home') {
      html = html.replaceAll('href="https://www.retrowebgames.it/games/block-drop/', 'href="https://www.retrowebgames.it/en/games/block-drop/');
      html = html.replaceAll('href="/games/block-drop/', 'href="/en/games/block-drop/');
    }
  } else {
    html = html.replace('<meta property="og:locale" content="it_IT" />', '<meta property="og:locale" content="it_IT" />\n  <meta property="og:locale:alternate" content="en_US" />');
  }
  html = html.replace(/  <link rel="canonical"[^>]+>\n/, alternateMarkup(page) + "  <link rel=\"canonical\" href=\"" + canonical + "\" />\n");
  return html;
}
