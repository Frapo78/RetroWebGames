(() => {
  'use strict';

  function orderedTargets(card, tableauColumns) {
    const targets = [{ type: 'foundation', suit: card.suit }];
    for (let col = 0; col < tableauColumns; col++) targets.push({ type: 'tableau', col });
    return targets;
  }

  function targetKey(target) {
    return target.type === 'foundation' ? `f:${target.suit}` : `t:${target.col}`;
  }

  function chooseNext({ card, tableauColumns, cursor, isLegal }) {
    if (!card?.id || typeof isLegal !== 'function') return null;
    const targets = orderedTargets(card, tableauColumns);
    const startIndex = cursor?.cardId === card.id && Number.isInteger(cursor.nextIndex)
      ? ((cursor.nextIndex % targets.length) + targets.length) % targets.length
      : 0;

    for (let offset = 0; offset < targets.length; offset++) {
      const index = (startIndex + offset) % targets.length;
      const target = targets[index];
      if (!isLegal(target)) continue;
      return {
        target,
        targetKey: targetKey(target),
        cursor: { cardId: card.id, nextIndex: (index + 1) % targets.length }
      };
    }
    return null;
  }

  window.RWGSolitaireAutoMove = Object.freeze({ orderedTargets, targetKey, chooseNext });
})();
