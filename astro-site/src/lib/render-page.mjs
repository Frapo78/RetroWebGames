import fs from 'node:fs';
import path from 'node:path';
import { renderPilotPage } from '../../../astro-poc/src/lib/render-pilot-page.mjs';
import italianShared from '../../../src/i18n/it/shared.mjs';
import englishShared from '../../../src/i18n/en/shared.mjs';

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

const flatten=(value,prefix='',out=[])=>{for(const [key,item] of Object.entries(value)){const full=prefix?`${prefix}.${key}`:key;if(typeof item==='string')out.push([full,item]);else flatten(item,full,out);}return out;};
const sharedPairs=flatten(italianShared).map(([key,it])=>[it,flatten(englishShared).find(([candidate])=>candidate===key)?.[1]]).filter(([it,en])=>en&&it.length>=4&&it!==en).sort((a,b)=>b[0].length-a[0].length);
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
  return `  <link rel="alternate" hreflang="it" href="${it}" />\n  <link rel="alternate" hreflang="en" href="${en}" />\n  <link rel="alternate" hreflang="x-default" href="${it}" />\n`;
}

function setSeo(html,page,locale){
  const suffix=page.route?`/${page.route}/`:'/';
  const canonical=`${ORIGIN}${locale==='it'?suffix:`/en${suffix}`}`;
  html=html.replace(/\s*<link rel="alternate"[^>]+>\n?/g,'\n');
  html=html.replace(/\s*<meta property="og:locale:alternate"[^>]+>\n?/g,'\n');
  html=html.replace(/  <link rel="canonical"[^>]+>\n/,`${alternates(page)}  <link rel="canonical" href="${canonical}" />\n`);
  if(locale==='en'){
    html=html.replace('<html lang="it">','<html lang="en">');
    html=html.replace('<meta property="og:locale" content="it_IT" />','<meta property="og:locale" content="en_US" />\n  <meta property="og:locale:alternate" content="it_IT" />');
    html=replaceAll(html,'"inLanguage": "it-IT"','"inLanguage": "en"');
    if(page.route) html=replaceAll(html,`${ORIGIN}${suffix}`,canonical);
  }else{
    html=html.replace('<meta property="og:locale" content="it_IT" />','<meta property="og:locale" content="it_IT" />\n  <meta property="og:locale:alternate" content="en_US" />');
  }
  return html;
}

function localizeNavigation(html,page,locale){
  const suffix=page.route?`/${page.route}/`:'/';
  const itHref=suffix;
  const enHref=`/en${suffix}`;
  html=html.replace(/<nav class="rwg-language-switcher"[\s\S]*?<\/nav>/,`<nav class="rwg-language-switcher" aria-label="Language"><a href="${itHref}" data-rwg-language="it"${locale==='it'?' aria-current="page"':''}>IT</a><a href="${enHref}" data-rwg-language="en"${locale==='en'?' aria-current="page"':''}>EN</a></nav>`);
  if(locale==='en'){
    html=html.replace(/(<a\b[^>]*\bhref=")https:\/\/www\.retrowebgames\.it\/("[^>]*>)/g,`$1/en/$2`);
    html=html.replace(/(<a\b[^>]*\bhref=")\/("[^>]*>)/g,`$1/en/$2`);
  }
  return html;
}

function translateGeneric(html){
  for(const [from,to] of sharedPairs) html=replaceAll(html,from,to);
  for(const [from,to] of COMMON.sort((a,b)=>b[0].length-a[0].length)) html=replaceAll(html,from,to);
  return html;
}

export function renderPage(pageId,locale){
  const page=PAGES.find(item=>item.id===pageId);
  if(!page||!['it','en'].includes(locale))throw new Error(`Unsupported page ${pageId}/${locale}`);
  let html;
  if(locale==='it') html=restoreItalianAssetStyle(resolveAssets(fs.readFileSync(path.resolve(page.source),'utf8'),page),page);
  else if(page.id==='home') html=renderPilotPage('home',locale);
  else if(page.id==='block-drop') html=renderPilotPage('blockDrop',locale);
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
    html=html.replace(/\/rwg-i18n\.js\?v=[^"']+/g,'/rwg-i18n.en.js?v=20260908.2');
    if(page.id!=='home'&&page.id!=='avatar') html=replaceAll(html,`/i18n/it/games/${page.id}.js?v=20260908.2`,`/i18n/en/games/${page.id}.js?v=20260908.2`);
  }else html=replaceAll(html,'/rwg-i18n.js?v=20260908.1','/rwg-i18n.js?v=20260908.2');
  html=localizeNavigation(html,page,locale);
  if(locale==='en'&&page.id==='home'){
    for(const game of PAGES.filter(item=>item.route.startsWith('games/'))) html=replaceAll(html,`href="/${game.route}/"`,`href="/en/${game.route}/"`);
  }
  return html;
}
