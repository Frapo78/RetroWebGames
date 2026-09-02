export const SITE = Object.freeze({
  name: 'RetroWebGames',
  alternateName: 'RWG',
  origin: 'https://www.retrowebgames.it',
  image: 'https://www.retrowebgames.it/assets/social/retrowebgames-cover-1280.jpg',
  language: 'it-IT'
});

const SOCIAL_ALTS = Object.freeze({
  'star-swarm': 'Star Swarm — nave arcade contro uno sciame alieno al neon',
  'bubble-burst': 'Bubble Burst — bubble shooter arcade con crew chibi e bolle al neon',
  'block-drop': 'Block Drop — blocchi luminosi in caduta su una griglia arcade',
  'maze-munch': 'Maze Munch — corsa arcade in un labirinto al neon',
  'neon-rally': 'Neon Rally — sfida arcade tra paddle ed energia al neon',
  'neon-snake': 'Neon Snake — cyber-serpente luminoso su una griglia arcade',
  'neon-tilt': 'Neon Tilt — sfera cromata in un labirinto inclinato al neon',
  solitaire: 'Solitario — carte francesi classiche su un tavolo verde arcade',
  'prism-breaker': 'Prism Breaker — palla e paddle tra prismi e mattoni al neon',
  'the-great-empire': 'The Great Empire — villaggio, contadini e soldati in battaglia strategica'
});

export function getGameSocial(game) {
  return Object.freeze({
    image: `${SITE.origin}/assets/social/games/${game.slug}.jpg`,
    wordmark: `/assets/brand/games/${game.slug}-wordmark.png`,
    alt: SOCIAL_ALTS[game.slug]
  });
}

export const GAMES = Object.freeze([
  { slug: 'star-swarm', name: 'Star Swarm', title: 'Star Swarm: videogame space shooter gratis | RetroWebGames', description: 'Gioca gratis a Star Swarm, videogame space shooter con 100 livelli, 10 boss, armi, POWER e wingmen, direttamente nel browser.', genres: ['Space shooter', 'Arcade'] },
  { slug: 'bubble-burst', name: 'Bubble Burst', title: 'Bubble Burst: bubble shooter gratis | RetroWebGames', description: 'Gioca gratis a Bubble Burst, web game bubble shooter con rimbalzi, combo, bombe e livelli originali, ottimizzato per smartphone.', genres: ['Bubble shooter', 'Puzzle'] },
  { slug: 'block-drop', name: 'Block Drop', title: 'Block Drop: videogame puzzle gratis | RetroWebGames', description: 'Gioca gratis a Block Drop, videogame puzzle di blocchi e linee con controlli touch, livelli progressivi e partite rapide nel browser.', genres: ['Falling block puzzle', 'Arcade'] },
  { slug: 'maze-munch', name: 'Maze Munch', title: 'Maze Munch: retrogame arcade gratis | RetroWebGames', description: 'Gioca gratis a Maze Munch, retrogame arcade originale tra labirinti, inseguitori, nodi energia e combo, direttamente sul web.', genres: ['Maze chase', 'Arcade'] },
  { slug: 'neon-rally', name: 'Neon Rally', title: 'Neon Rally: web game arcade gratis | RetroWebGames', description: 'Gioca gratis a Neon Rally, web game arcade di riflessi e rimbalzi contro la CPU, con controlli touch e sfide sempre più veloci.', genres: ['Paddle game', 'Arcade'] },
  { slug: 'neon-snake', name: 'Neon Snake', title: 'Snake gratis online: Neon Snake | RetroWebGames', description: 'Gioca a Snake gratis online con Neon Snake: cresci, crea combo, raccogli shield e supera ostacoli in un retrogame moderno per mobile.', genres: ['Snake', 'Arcade'] },
  { slug: 'neon-tilt', name: 'Neon Tilt', title: 'Neon Tilt: videogame mobile gratis | RetroWebGames', description: 'Gioca gratis a Neon Tilt, videogame mobile di abilità: inclina lo smartphone e guida la biglia tra cristalli, bumper e labirinti.', genres: ['Maze', 'Physics'] },
  { slug: 'solitaire', name: 'Solitario', alternateName: 'Solitaire', title: 'Solitario gratis online (Solitaire) | RetroWebGames', description: 'Gioca al Solitario gratis online: Solitaire Klondike con 52 carte, drag, tap, undo e suggerimenti, ottimizzato per smartphone.', genres: ['Solitario', 'Solitaire', 'Card game'] },
  { slug: 'prism-breaker', name: 'Prism Breaker', title: 'Prism Breaker: brick breaker gratis | RetroWebGames', description: 'Gioca gratis a Prism Breaker, videogame brick breaker con 100 livelli originali, power-up, mattoni speciali e boss arcade.', genres: ['Brick breaker', 'Arcade'] },
  { slug: 'the-great-empire', name: 'The Great Empire', title: 'The Great Empire: strategia gratis | RetroWebGames', description: 'Gioca gratis a The Great Empire, strategia in tempo reale per smartphone: raccogli risorse, addestra soldati e conquista l\'accampamento nemico.', genres: ['Strategia in tempo reale', 'Arcade'] }
]);
