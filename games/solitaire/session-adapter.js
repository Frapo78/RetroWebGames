(() => {
  'use strict';
  const base = window.RWGResumeAdapter;
  if (!base) throw new Error('Solitaire resume adapter missing');
  window.RWGResumeAdapter = Object.freeze({
    ...base,
    version: 2,
    compatibility: 'solitaire-klondike-state-v2-52cards-draw1'
  });
})();