(() => {
  'use strict';

  const VARIANTS = Object.freeze({
    klondike: Object.freeze({
      id: 'klondike',
      name: 'Classico',
      subtitle: 'Klondike • pesca 1',
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
    })
  });

  const FUTURE = Object.freeze([
    { id: 'klondike-draw3', name: 'Classico • pesca 3' },
    { id: 'spider', name: 'Spider' },
    { id: 'freecell', name: 'FreeCell' },
    { id: 'pyramid', name: 'Piramide' }
  ]);

  const get = id => VARIANTS[id] || VARIANTS.klondike;
  const list = () => Object.values(VARIANTS);

  window.RWGSolitaireVariants = Object.freeze({
    DEFAULT_ID: 'klondike',
    VARIANTS,
    FUTURE,
    get,
    list
  });
})();
