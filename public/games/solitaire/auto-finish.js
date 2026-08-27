(() => {
  'use strict';

  const SUITS = ['s', 'h', 'd', 'c'];

  function isCard(card) {
    return Boolean(
      card && SUITS.includes(card.suit) && Number.isInteger(card.rank) &&
      card.rank >= 1 && card.rank <= 13 && card.id === `${card.suit}${card.rank}` &&
      typeof card.faceUp === 'boolean'
    );
  }

  function plan(state) {
    if (!state || !Array.isArray(state.stock) || state.stock.length) return null;
    if (!Array.isArray(state.waste) || !Array.isArray(state.tableau) || !state.foundations) return null;
    if (state.waste.some(card => !isCard(card) || !card.faceUp)) return null;
    if (state.tableau.some(pile => !Array.isArray(pile) || pile.some(card => !isCard(card) || !card.faceUp))) return null;

    const foundationRanks = {};
    const foundationCards = [];
    for (const suit of SUITS) {
      const pile = state.foundations[suit];
      if (!Array.isArray(pile)) return null;
      for (let index = 0; index < pile.length; index++) {
        const card = pile[index];
        if (!isCard(card) || !card.faceUp || card.suit !== suit || card.rank !== index + 1) return null;
        foundationCards.push(card);
      }
      foundationRanks[suit] = pile.length;
    }

    const allCards = [...foundationCards, ...state.waste, ...state.tableau.flat()];
    if (allCards.length !== 52 || new Set(allCards.map(card => card.id)).size !== 52) return null;

    const waste = state.waste.slice();
    const tableau = state.tableau.map(pile => pile.slice());
    const steps = [];

    while (steps.length < 52) {
      const candidates = [];
      const wasteCard = waste[waste.length - 1];
      if (wasteCard && wasteCard.rank === foundationRanks[wasteCard.suit] + 1) {
        candidates.push({ card: wasteCard, source: { type: 'waste' }, order: -1 });
      }
      for (let col = 0; col < tableau.length; col++) {
        const card = tableau[col][tableau[col].length - 1];
        if (card && card.rank === foundationRanks[card.suit] + 1) {
          candidates.push({ card, source: { type: 'tableau', col, index: tableau[col].length - 1 }, order: col });
        }
      }
      if (!candidates.length) break;

      candidates.sort((a, b) => a.card.rank - b.card.rank || a.order - b.order);
      const next = candidates[0];
      if (next.source.type === 'waste') waste.pop();
      else tableau[next.source.col].pop();
      foundationRanks[next.card.suit]++;
      steps.push({
        cardId: next.card.id,
        source: next.source,
        target: { type: 'foundation', suit: next.card.suit }
      });
    }

    const completed = SUITS.reduce((sum, suit) => sum + foundationRanks[suit], 0) === 52;
    return completed && !waste.length && tableau.every(pile => !pile.length) ? steps : null;
  }

  window.RWGSolitaireAutoFinish = Object.freeze({ plan });
})();
