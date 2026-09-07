export const BRAND_TERMS = Object.freeze({
  RetroWebGames: 'never-translate', RWG: 'never-translate',
  'Star Swarm': 'never-translate', 'Bubble Burst': 'never-translate',
  'Block Drop': 'never-translate', 'Maze Munch': 'never-translate',
  'Neon Rally': 'never-translate', 'Neon Snake': 'never-translate',
  'Neon Tilt': 'never-translate', 'Prism Breaker': 'never-translate',
  'The Great Empire': 'never-translate'
});

export const CONTROLLED_TERMS = Object.freeze({
  solitaire: Object.freeze({ it: 'Solitario', en: 'Solitaire', de: 'Solitaire', fr: 'Solitaire', es: 'Solitario' }),
  klondike: Object.freeze({ it: 'Klondike', en: 'Klondike', de: 'Klondike', fr: 'Klondike', es: 'Klondike' }),
  freecell: Object.freeze({ it: 'FreeCell', en: 'FreeCell', de: 'FreeCell', fr: 'FreeCell', es: 'FreeCell' }),
  highScores: Object.freeze({ it: 'High Scores', en: 'High Scores', de: 'Bestenliste', fr: 'Meilleurs scores', es: 'Mejores puntuaciones' }),
  continue: Object.freeze({ it: 'Continua', en: 'Continue', de: 'Fortsetzen', fr: 'Continuer', es: 'Continuar' })
});

export const MACHINE_VALUES = Object.freeze([
  'gameSlug', 'variantSlug', 'runId', 'achievementId', 'compatibility',
  'rwg:game-ended', 'rwg:continue-game', 'rwg:leaderboard-scope-change'
]);
