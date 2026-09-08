(() => {
  'use strict';
  const t = (key, params = {}) => window.RWGI18n.t(key, params);

  const VARIANTS = Object.freeze({
    klondike: Object.freeze({
      id: 'klondike',
      name: t('games.solitaire.variantClassic'),
      subtitle: t('games.solitaire.subtitleKlondike'),
      deckCount: 1,
      drawCount: 1,
      tableauColumns: 7,
      foundationCount: 4,
      stockPasses: Infinity,
      tableauBuild: 'alternating-descending',
      emptyTableau: 'king-only',
      foundationBuild: 'same-suit-ascending',
      scoring: Object.freeze({
        reveal: 5,
        toFoundation: 10,
        wasteToTableau: 5,
        tableauToTableau: 3,
        foundationToTableau: -10
      })
    }),
    freecell: Object.freeze({
      id: 'freecell',
      name: t('games.solitaire.variantFreeCell'),
      subtitle: t('games.solitaire.subtitleFreeCell'),
      deckCount: 1,
      drawCount: 0,
      tableauColumns: 8,
      foundationCount: 4,
      freeCellCount: 4,
      stockPasses: 0,
      tableauBuild: 'alternating-descending',
      emptyTableau: 'any-card',
      foundationBuild: 'same-suit-ascending',
      scoring: Object.freeze({
        reveal: 0,
        toFoundation: 10,
        tableauToTableau: 3,
        tableauToFreeCell: 1,
        freeCellToTableau: 3,
        freeCellToFoundation: 10,
        foundationToTableau: -10,
        foundationToFreeCell: -10
      })
    })
  });

  const FUTURE = Object.freeze([
    { id: 'klondike-draw3', name: 'Classico • pesca 3' },
    { id: 'spider', name: 'Spider' },
    { id: 'pyramid', name: 'Piramide' }
  ]);

  function freeCellMoveCapacity(freeCells, tableau, targetCol) {
    const emptyCells = freeCells.filter(card => card == null).length;
    const emptyColumns = tableau.reduce((count, pile, col) => count + (!pile.length && col !== targetCol ? 1 : 0), 0);
    return (emptyCells + 1) * (2 ** emptyColumns);
  }

  const get = id => VARIANTS[id] || VARIANTS.klondike;
  const list = () => Object.values(VARIANTS);

  window.RWGSolitaireVariants = Object.freeze({
    DEFAULT_ID: 'klondike',
    VARIANTS,
    FUTURE,
    get,
    list,
    freeCellMoveCapacity
  });
})();
