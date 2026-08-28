(() => {
  'use strict';

  const Variants = window.RWGSolitaireVariants;
  if (!Variants?.get) throw new Error('Solitaire variants module missing');
  const CardArt = window.RWGSolitaireCardArt;
  if (!CardArt?.getCardFaceSvg || !CardArt?.getCardBackSvg) throw new Error('Solitaire card-art module missing');
  const AutoMove = window.RWGSolitaireAutoMove;
  if (!AutoMove?.chooseNext) throw new Error('Solitaire auto-move module missing');

  const $ = id => document.getElementById(id);
  const board = $('board');
  const tableauEl = $('tableau');
  const stockEl = $('stock');
  const wasteEl = $('waste');
  const movesEl = $('moves');
  const timerEl = $('timer');
  const scoreEl = $('score');
  const variantNameEl = $('variantName');
  const variantSelect = $('variantSelect');
  const cardStyleSelect = $('cardStyleSelect');
  const cardStyleLabel = $('cardStyleLabel');
  const overlay = $('overlay');
  const startBtn = $('startBtn');
  const undoBtn = $('undoBtn');
  const pauseBtn = $('pauseBtn');
  const hintBtn = $('hintBtn');
  const newDealBtn = $('newDealBtn');
  const toastEl = $('toast');
  const winScreen = $('winScreen');
  const winTimeEl = $('winTime');
  const winMovesEl = $('winMoves');
  const winScoreEl = $('winScore');
  const bestTimeLine = $('bestTimeLine');
  const winNewBtn = $('winNewBtn');

  const SUITS = ['s', 'h', 'd', 'c'];
  const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const RED_SUITS = new Set(['h', 'd']);
  const RANK_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const STORAGE_KEY = 'rwg.solitaire.stats.v1';
  const CARD_STYLE_KEY = 'rwg.solitaire.card-style.v1';
  const HISTORY_LIMIT = 100;
  const RESUME_SCHEMA = 1;
  const AUTO_MOVE_DURATION_MS = 210;

  let variant = Variants.get(Variants.DEFAULT_ID);
  let stock = [];
  let waste = [];
  let foundations = { s: [], h: [], d: [], c: [] };
  let tableau = Array.from({ length: 7 }, () => []);
  let selected = null;
  let history = [];
  let moves = 0;
  let score = 0;
  let elapsed = 0;
  let running = false;
  let paused = false;
  let won = false;
  let lastFrame = performance.now();
  let lastTimerSecond = -1;
  let toastTimer = 0;
  let hintTimer = 0;
  let pointerDrag = null;
  let lastTap = { key: '', at: 0 };
  let autoMoveCursor = null;
  let autoMoveLocked = false;
  let stats = loadStats();
  let cardStyle = loadCardStyle();

  function loadStats() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        wins: Math.max(0, Number(parsed.wins) || 0),
        deals: Math.max(0, Number(parsed.deals) || 0),
        bestTime: Number.isFinite(Number(parsed.bestTime)) && Number(parsed.bestTime) > 0 ? Number(parsed.bestTime) : null,
        bestScore: Math.max(0, Number(parsed.bestScore) || 0)
      };
    } catch (_) {
      return { wins: 0, deals: 0, bestTime: null, bestScore: 0 };
    }
  }

  function saveStats() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (_) {}
  }

  function loadCardStyle() {
    try { return localStorage.getItem(CARD_STYLE_KEY) === 'classic' ? 'classic' : 'essential'; }
    catch (_) { return 'essential'; }
  }

  function syncCardStyleControl() {
    cardStyleSelect.value = cardStyle;
    cardStyleLabel.textContent = cardStyle === 'essential' ? 'MIN.' : 'CLASS.';
  }

  function changeCardStyle(nextStyle) {
    cardStyle = nextStyle === 'essential' ? 'essential' : 'classic';
    try { localStorage.setItem(CARD_STYLE_KEY, cardStyle); } catch (_) {}
    syncCardStyleControl();
    render();
    showToast(cardStyle === 'essential' ? 'MAZZO ESSENZIALE' : 'MAZZO CLASSICO');
  }

  function cardColor(card) { return RED_SUITS.has(card.suit) ? 'red' : 'black'; }
  function rankLabel(rank) { return RANK_LABEL[rank] || String(rank); }
  function cardLabel(card) { return `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function markSessionDirty(reason = 'state') { window.RWGSession?.markDirty?.(reason); }

  function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) deck.push({ id: `${suit}${rank}`, suit, rank, faceUp: false });
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function deal() {
    const deck = createDeck();
    tableau = Array.from({ length: variant.tableauColumns }, () => []);
    for (let col = 0; col < variant.tableauColumns; col++) {
      for (let i = 0; i <= col; i++) {
        const card = deck.pop();
        card.faceUp = i === col;
        tableau[col].push(card);
      }
    }
    stock = deck.map(card => ({ ...card, faceUp: false }));
    waste = [];
    foundations = { s: [], h: [], d: [], c: [] };
  }

  function resetAutoMoveCycle() {
    autoMoveCursor = null;
    autoMoveLocked = false;
    lastTap = { key: '', at: 0 };
    board.classList.remove('auto-move-active');
  }

  function newGame() {
    window.RWGSession?.clear?.();
    variant = Variants.get(variantSelect?.value || Variants.DEFAULT_ID);
    deal();
    selected = null;
    history = [];
    moves = 0;
    score = 0;
    elapsed = 0;
    running = true;
    paused = false;
    won = false;
    resetAutoMoveCycle();
    lastFrame = performance.now();
    lastTimerSecond = -1;
    stats.deals++;
    saveStats();
    overlay.classList.remove('visible');
    hideWin();
    pauseBtn.textContent = 'Ⅱ';
    pauseBtn.setAttribute('aria-label', 'Pausa');
    variantNameEl.textContent = variant.name.toUpperCase();
    render();
    markSessionDirty('new-game');
    showToast('NUOVA MANO • BUONA FORTUNA!');
  }

  function snapshot() {
    return {
      stock: clone(stock), waste: clone(waste), foundations: clone(foundations), tableau: clone(tableau),
      moves, score
    };
  }

  function pushHistory() {
    history.push(snapshot());
    if (history.length > HISTORY_LIMIT) history.shift();
  }

  function undo() {
    if (!running || paused || won || !history.length) return;
    const state = history.pop();
    stock = state.stock;
    waste = state.waste;
    foundations = state.foundations;
    tableau = state.tableau;
    moves = state.moves;
    score = state.score;
    selected = null;
    resetAutoMoveCycle();
    render();
    markSessionDirty('undo');
    showToast('MOSSA ANNULLATA');
  }

  function drawStock() {
    if (!running || paused || won) return;
    if (!stock.length && !waste.length) return;
    pushHistory();
    selected = null;
    resetAutoMoveCycle();
    if (stock.length) {
      for (let i = 0; i < variant.drawCount && stock.length; i++) {
        const card = stock.pop();
        card.faceUp = true;
        waste.push(card);
      }
      moves++;
    } else {
      stock = waste.reverse().map(card => ({ ...card, faceUp: false }));
      waste = [];
      moves++;
      showToast('MAZZO RICARICATO');
    }
    render();
    markSessionDirty('stock');
  }

  function sourceKey(source) {
    if (!source) return '';
    if (source.type === 'tableau') return `t:${source.col}:${source.index}`;
    if (source.type === 'foundation') return `f:${source.suit}`;
    return source.type;
  }

  function isValidRun(cards) {
    if (!cards.length || cards.some(card => !card.faceUp)) return false;
    for (let i = 0; i < cards.length - 1; i++) {
      if (cards[i].rank !== cards[i + 1].rank + 1) return false;
      if (cardColor(cards[i]) === cardColor(cards[i + 1])) return false;
    }
    return true;
  }

  function getSourceCards(source) {
    if (!source) return null;
    if (source.type === 'waste') return waste.length ? [waste[waste.length - 1]] : null;
    if (source.type === 'foundation') {
      const pile = foundations[source.suit];
      return pile?.length ? [pile[pile.length - 1]] : null;
    }
    if (source.type === 'tableau') {
      const pile = tableau[source.col];
      if (!pile || source.index < 0 || source.index >= pile.length || !pile[source.index].faceUp) return null;
      const cards = pile.slice(source.index);
      return isValidRun(cards) ? cards : null;
    }
    return null;
  }

  function canMoveToTableau(cards, col) {
    if (!cards?.length || col < 0 || col >= tableau.length) return false;
    const first = cards[0];
    const target = tableau[col];
    if (!target.length) return first.rank === 13;
    const top = target[target.length - 1];
    return top.faceUp && top.rank === first.rank + 1 && cardColor(top) !== cardColor(first);
  }

  function canMoveToFoundation(cards, suit) {
    if (!cards || cards.length !== 1 || !SUITS.includes(suit)) return false;
    const card = cards[0];
    if (card.suit !== suit) return false;
    return card.rank === foundations[suit].length + 1;
  }

  function removeSource(source, count) {
    if (source.type === 'waste') return [waste.pop()];
    if (source.type === 'foundation') return [foundations[source.suit].pop()];
    if (source.type === 'tableau') return tableau[source.col].splice(source.index, count);
    return [];
  }

  function revealExposed(col) {
    if (col == null) return 0;
    const pile = tableau[col];
    const top = pile[pile.length - 1];
    if (top && !top.faceUp) {
      top.faceUp = true;
      return variant.scoring.reveal;
    }
    return 0;
  }

  function moveScoreDelta(source, target) {
    if (target.type === 'foundation') return variant.scoring.toFoundation;
    if (target.type === 'tableau' && source.type === 'waste') return variant.scoring.wasteToTableau;
    if (target.type === 'tableau' && source.type === 'foundation') return variant.scoring.foundationToTableau;
    if (target.type === 'tableau' && source.type === 'tableau') return variant.scoring.tableauToTableau;
    return 0;
  }

  function performMove(source, target, { silentInvalid = false, preserveAutoCycle = false } = {}) {
    const cards = getSourceCards(source);
    if (!cards?.length || !target) return false;
    const valid = target.type === 'tableau'
      ? canMoveToTableau(cards, target.col)
      : target.type === 'foundation'
        ? canMoveToFoundation(cards, target.suit)
        : false;
    if (!valid) {
      if (!silentInvalid) showToast('MOSSA NON VALIDA');
      return false;
    }

    if (!preserveAutoCycle) resetAutoMoveCycle();

    pushHistory();
    const movedCards = removeSource(source, cards.length);
    if (target.type === 'tableau') tableau[target.col].push(...movedCards);
    else foundations[target.suit].push(...movedCards);

    score = Math.max(0, score + moveScoreDelta(source, target));
    if (source.type === 'tableau') score += revealExposed(source.col);
    moves++;
    selected = null;
    render();
    markSessionDirty('move');
    checkWin();
    return true;
  }

  function cardElementById(cardId) {
    return board.querySelector(`.playing-card[data-card-id="${cardId}"]`);
  }

  function captureCardRects(cards) {
    return new Map(cards.map(card => [card.id, cardElementById(card.id)?.getBoundingClientRect()]).filter(([, rect]) => rect));
  }

  function finishAutoMoveAnimation(elements) {
    for (const element of elements) element.classList.remove('auto-moving-card');
    autoMoveLocked = false;
    board.classList.remove('auto-move-active');
  }

  function animateAutoMove(cards, fromRects) {
    const elements = cards.map(card => cardElementById(card.id)).filter(Boolean);
    if (!elements.length || typeof elements[0].animate !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishAutoMoveAnimation(elements);
      return;
    }

    const animations = [];
    for (const element of elements) {
      const from = fromRects.get(element.dataset.cardId);
      const to = element.getBoundingClientRect();
      if (!from || (!Math.abs(from.left - to.left) && !Math.abs(from.top - to.top))) continue;
      element.classList.add('auto-moving-card');
      const animation = element.animate([
        { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(.985)`, filter: 'brightness(1.14)' },
        { transform: 'translate(0, 0) scale(1)', filter: 'brightness(1)' }
      ], { duration: AUTO_MOVE_DURATION_MS, easing: 'cubic-bezier(.2,.82,.25,1)', fill: 'none' });
      animations.push(animation.finished.catch(() => {}));
    }

    if (!animations.length) return finishAutoMoveAnimation(elements);
    Promise.all(animations).finally(() => finishAutoMoveAnimation(elements));
  }

  function autoMoveCard(source) {
    if (autoMoveLocked) return false;
    const cards = getSourceCards(source);
    if (!cards?.length) return false;
    const leadCard = cards[0];
    const choice = AutoMove.chooseNext({
      card: leadCard,
      tableauColumns: tableau.length,
      cursor: autoMoveCursor,
      isLegal: target => target.type === 'foundation'
        ? canMoveToFoundation(cards, target.suit)
        : !(source.type === 'tableau' && source.col === target.col) && canMoveToTableau(cards, target.col)
    });
    if (!choice) {
      autoMoveCursor = null;
      return false;
    }

    const fromRects = captureCardRects(cards);
    autoMoveLocked = true;
    board.classList.add('auto-move-active');
    if (!performMove(source, choice.target, { silentInvalid: true, preserveAutoCycle: true })) {
      finishAutoMoveAnimation([]);
      return false;
    }
    autoMoveCursor = choice.cursor;
    animateAutoMove(cards, fromRects);
    return true;
  }

  function sourceFromElement(el) {
    const card = el?.closest?.('.playing-card[data-source]');
    if (!card) return null;
    const type = card.dataset.source;
    if (type === 'tableau') return { type, col: Number(card.dataset.col), index: Number(card.dataset.index) };
    if (type === 'foundation') return { type, suit: card.dataset.suit };
    if (type === 'waste') return { type };
    return null;
  }

  function targetFromElement(el) {
    const drop = el?.closest?.('[data-drop]');
    if (!drop) return null;
    if (drop.dataset.drop === 'tableau') return { type: 'tableau', col: Number(drop.dataset.col) };
    if (drop.dataset.drop === 'foundation') return { type: 'foundation', suit: drop.dataset.suit };
    return null;
  }

  function handleTap(el) {
    if (!running || paused || won) return;
    const source = sourceFromElement(el);
    const target = targetFromElement(el);
    const now = performance.now();
    const key = sourceKey(source);

    if (source && key && lastTap.key === key && now - lastTap.at < 340) {
      lastTap = { key: '', at: 0 };
      if (!autoMoveCard(source)) {
        selected = null;
        render();
      }
      return;
    }
    lastTap = { key, at: now };

    if (selected && target && performMove(selected, target, { silentInvalid: true })) return;

    if (source && getSourceCards(source)) {
      selected = selected && sourceKey(selected) === key ? null : source;
      render();
      return;
    }

    if (selected && target) performMove(selected, target);
    else {
      selected = null;
      render();
    }
  }

  function cardInner(card) {
    return CardArt.getCardFaceSvg(card, cardStyle);
  }

  function cardMarkup(card, attrs = '', extraClass = '', top = 0, z = 1) {
    if (!card.faceUp) return `<div class="playing-card card-back ${extraClass}" data-card-id="${card.id}" ${attrs} style="top:${top}px;z-index:${z}" aria-label="Carta coperta">${CardArt.getCardBackSvg()}</div>`;
    return `<div class="playing-card face-up ${cardColor(card)} ${extraClass}" data-card-id="${card.id}" ${attrs} style="top:${top}px;z-index:${z}" aria-label="${cardLabel(card)}">${cardInner(card)}</div>`;
  }

  function selectedClass(source) {
    return selected && sourceKey(selected) === sourceKey(source) ? 'selected' : '';
  }

  function layoutMetrics() {
    const width = Math.max(280, board.clientWidth || innerWidth - 16);
    const gap = width <= 350 ? 3 : 4;
    const cardW = (width - gap * 6) / 7;
    const cardH = cardW / .704;
    const available = Math.max(cardH + 40, tableauEl.clientHeight || innerHeight * .67);
    let faceGap = Math.min(29, Math.max(17, cardW * .5));
    let backGap = Math.min(15, Math.max(9, cardW * .27));
    let worst = 0;
    for (const pile of tableau) {
      let h = cardH;
      for (let i = 0; i < pile.length - 1; i++) h += pile[i].faceUp ? faceGap : backGap;
      worst = Math.max(worst, h);
    }
    if (worst > available && worst > cardH) {
      const ratio = Math.max(.55, (available - cardH) / (worst - cardH));
      faceGap *= ratio;
      backGap *= ratio;
    }
    return { cardW, cardH, faceGap, backGap };
  }

  function renderStockWaste() {
    stockEl.className = `pile-slot stock-slot ${stock.length ? 'has-cards' : 'is-empty'}`;
    stockEl.innerHTML = stock.length ? CardArt.getCardBackSvg() : '';
    stockEl.setAttribute('aria-label', stock.length ? `Mazzo: ${stock.length} carte` : waste.length ? 'Ricarica il mazzo' : 'Mazzo vuoto');
    const top = waste[waste.length - 1];
    wasteEl.innerHTML = top ? cardMarkup(top, 'data-source="waste"', selectedClass({ type: 'waste' })) : '';
  }

  function renderFoundations() {
    for (const suit of SUITS) {
      const el = $(`foundation-${suit}`);
      const pile = foundations[suit];
      const top = pile[pile.length - 1];
      const placeholder = `<span class="slot-suit">${SUIT_SYMBOL[suit]}</span>`;
      el.innerHTML = top ? `${placeholder}${cardMarkup(top, `data-source="foundation" data-suit="${suit}"`, selectedClass({ type: 'foundation', suit }))}` : placeholder;
      el.setAttribute('aria-label', `Fondazione ${SUIT_SYMBOL[suit]}: ${pile.length ? cardLabel(top) : 'vuota'}`);
    }
  }

  function renderTableau() {
    const metrics = layoutMetrics();
    tableauEl.innerHTML = tableau.map((pile, col) => {
      let top = 0;
      const cards = pile.map((card, index) => {
        const source = { type: 'tableau', col, index };
        const html = cardMarkup(card, `data-source="tableau" data-col="${col}" data-index="${index}"`, selectedClass(source), top, index + 1);
        if (index < pile.length - 1) top += card.faceUp ? metrics.faceGap : metrics.backGap;
        return html;
      }).join('');
      return `<div class="tableau-col" data-drop="tableau" data-col="${col}" aria-label="Colonna ${col + 1}">${cards}</div>`;
    }).join('');
  }

  function renderHud() {
    movesEl.textContent = moves;
    scoreEl.textContent = score.toLocaleString('it-IT');
    undoBtn.disabled = !history.length || !running || paused || won;
    hintBtn.disabled = !running || paused || won;
    newDealBtn.disabled = !running && !won;
    updateTimer(true);
  }

  function render() {
    renderStockWaste();
    renderFoundations();
    renderTableau();
    renderHud();
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function updateTimer(force = false) {
    const second = Math.floor(elapsed);
    if (!force && second === lastTimerSecond) return;
    lastTimerSecond = second;
    timerEl.textContent = formatTime(elapsed);
  }

  function frame(now) {
    const dt = Math.min(.1, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (running && !paused && !won) {
      elapsed += dt;
      updateTimer();
    }
    requestAnimationFrame(frame);
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1500);
  }

  function clearHint() {
    clearTimeout(hintTimer);
    board.querySelectorAll('.hint-source,.hint-target').forEach(el => el.classList.remove('hint-source', 'hint-target'));
  }

  function findHint() {
    const wasteSource = waste.length ? { type: 'waste' } : null;
    if (wasteSource) {
      const card = waste[waste.length - 1];
      if (canMoveToFoundation([card], card.suit)) return { source: wasteSource, target: { type: 'foundation', suit: card.suit }, label: 'Porta lo scarto in fondazione' };
    }
    for (let col = 0; col < tableau.length; col++) {
      const pile = tableau[col];
      if (!pile.length) continue;
      const index = pile.findIndex(card => card.faceUp);
      if (index >= 0) {
        for (let i = index; i < pile.length; i++) {
          const source = { type: 'tableau', col, index: i };
          const cards = getSourceCards(source);
          if (cards?.length === 1 && canMoveToFoundation(cards, cards[0].suit)) return { source, target: { type: 'foundation', suit: cards[0].suit }, label: 'Carta disponibile per la fondazione' };
        }
      }
    }
    if (wasteSource) {
      const cards = getSourceCards(wasteSource);
      for (let col = 0; col < tableau.length; col++) if (canMoveToTableau(cards, col)) return { source: wasteSource, target: { type: 'tableau', col }, label: 'Sposta lo scarto sul tableau' };
    }
    for (let from = 0; from < tableau.length; from++) {
      for (let index = 0; index < tableau[from].length; index++) {
        const source = { type: 'tableau', col: from, index };
        const cards = getSourceCards(source);
        if (!cards) continue;
        for (let to = 0; to < tableau.length; to++) {
          if (to !== from && canMoveToTableau(cards, to)) return { source, target: { type: 'tableau', col: to }, label: 'C’è una sequenza spostabile' };
        }
      }
    }
    if (stock.length || waste.length) return { source: null, target: { type: 'stock' }, label: stock.length ? 'Pesca una carta' : 'Ricarica il mazzo' };
    return null;
  }

  function sourceElement(source) {
    if (!source) return null;
    if (source.type === 'waste') return wasteEl.querySelector('.playing-card');
    if (source.type === 'foundation') return $(`foundation-${source.suit}`)?.querySelector('.playing-card');
    if (source.type === 'tableau') return tableauEl.querySelector(`.playing-card[data-col="${source.col}"][data-index="${source.index}"]`);
    return null;
  }

  function targetElement(target) {
    if (!target) return null;
    if (target.type === 'stock') return stockEl;
    if (target.type === 'foundation') return $(`foundation-${target.suit}`);
    if (target.type === 'tableau') return tableauEl.querySelector(`.tableau-col[data-col="${target.col}"]`);
    return null;
  }

  function showHint() {
    if (!running || paused || won) return;
    clearHint();
    const hint = findHint();
    if (!hint) return showToast('NESSUN SUGGERIMENTO IMMEDIATO');
    sourceElement(hint.source)?.classList.add('hint-source');
    targetElement(hint.target)?.classList.add('hint-target');
    showToast(hint.label.toUpperCase());
    hintTimer = setTimeout(clearHint, 2300);
  }

  function checkWin() {
    if (SUITS.reduce((sum, suit) => sum + foundations[suit].length, 0) !== 52) return;
    won = true;
    running = false;
    paused = false;
    window.RWGSession?.clear?.();
    score += Math.max(0, 1000 - Math.floor(elapsed) * 2);
    stats.wins++;
    stats.bestScore = Math.max(stats.bestScore, score);
    if (!stats.bestTime || elapsed < stats.bestTime) stats.bestTime = elapsed;
    saveStats();
    renderHud();
    winTimeEl.textContent = formatTime(elapsed);
    winMovesEl.textContent = moves;
    winScoreEl.textContent = score.toLocaleString('it-IT');
    bestTimeLine.textContent = `MIGLIOR TEMPO ${formatTime(stats.bestTime)}`;
    celebrate();
    winScreen.classList.add('visible');
    winScreen.setAttribute('aria-hidden', 'false');
  }

  function celebrate() {
    winScreen.querySelectorAll('.confetti-card').forEach(el => el.remove());
    const symbols = ['♠', '♥', '♦', '♣'];
    for (let i = 0; i < 28; i++) {
      const piece = document.createElement('i');
      piece.className = `confetti-card ${i % 4 === 1 || i % 4 === 2 ? 'is-red' : ''}`;
      piece.textContent = symbols[i % 4];
      piece.style.left = `${(i * 37.7) % 100}%`;
      piece.style.setProperty('--delay', `${(i % 9) * -.21}s`);
      piece.style.setProperty('--drift', `${-28 + (i * 19) % 56}px`);
      winScreen.appendChild(piece);
    }
  }

  function hideWin() {
    winScreen.classList.remove('visible');
    winScreen.setAttribute('aria-hidden', 'true');
    winScreen.querySelectorAll('.confetti-card').forEach(el => el.remove());
  }

  function togglePause() {
    if (!running || won) return;
    paused = !paused;
    selected = null;
    resetAutoMoveCycle();
    pauseBtn.textContent = paused ? '▶' : 'Ⅱ';
    pauseBtn.setAttribute('aria-label', paused ? 'Riprendi' : 'Pausa');
    lastFrame = performance.now();
    render();
    if (paused) {
      window.RWGSession?.saveNow?.('pause');
      showToast('PAUSA');
    }
  }

  function createDragGhost(source, cards, width) {
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.setProperty('--ghost-w', `${width}px`);
    const gap = Math.max(15, Math.min(27, width * .48));
    ghost.innerHTML = cards.map((card, index) => cardMarkup(card, '', '', index * gap, index + 1)).join('');
    ghost.style.height = `${width / .704 + gap * Math.max(0, cards.length - 1)}px`;
    document.body.appendChild(ghost);
    return ghost;
  }

  function positionGhost(ghost, x, y) {
    const width = parseFloat(getComputedStyle(ghost).getPropertyValue('--ghost-w')) || 50;
    ghost.style.left = `${x - width / 2}px`;
    ghost.style.top = `${y - 18}px`;
  }

  function validResumeCard(card) {
    return Boolean(
      card &&
      SUITS.includes(card.suit) &&
      Number.isInteger(card.rank) && card.rank >= 1 && card.rank <= 13 &&
      card.id === `${card.suit}${card.rank}` &&
      typeof card.faceUp === 'boolean'
    );
  }

  function validateResumeState(state) {
    if (!state || state.schema !== RESUME_SCHEMA || typeof state.variantId !== 'string') return false;
    const resumeVariant = Variants.get(state.variantId);
    if (!resumeVariant || resumeVariant.id !== state.variantId) return false;
    if (!Array.isArray(state.stock) || !Array.isArray(state.waste) || !Array.isArray(state.tableau) || state.tableau.length !== resumeVariant.tableauColumns) return false;
    if (!state.foundations || typeof state.foundations !== 'object' || SUITS.some(suit => !Array.isArray(state.foundations[suit]))) return false;
    if (![state.moves, state.score, state.elapsed].every(value => Number.isFinite(Number(value)) && Number(value) >= 0)) return false;

    const allCards = [
      ...state.stock,
      ...state.waste,
      ...SUITS.flatMap(suit => state.foundations[suit]),
      ...state.tableau.flat()
    ];
    if (allCards.length !== 52 || allCards.some(card => !validResumeCard(card))) return false;
    if (new Set(allCards.map(card => card.id)).size !== 52) return false;
    if (state.stock.some(card => card.faceUp) || state.waste.some(card => !card.faceUp)) return false;

    for (const suit of SUITS) {
      const pile = state.foundations[suit];
      for (let i = 0; i < pile.length; i++) {
        const card = pile[i];
        if (!card.faceUp || card.suit !== suit || card.rank !== i + 1) return false;
      }
    }

    for (const pile of state.tableau) {
      let firstFaceUp = -1;
      for (let i = 0; i < pile.length; i++) {
        if (pile[i].faceUp && firstFaceUp < 0) firstFaceUp = i;
        if (!pile[i].faceUp && firstFaceUp >= 0) return false;
      }
      if (firstFaceUp >= 0 && !isValidRun(pile.slice(firstFaceUp))) return false;
    }
    return true;
  }

  function serializeResumeState() {
    return {
      schema: RESUME_SCHEMA,
      variantId: variant.id,
      stock: clone(stock),
      waste: clone(waste),
      foundations: clone(foundations),
      tableau: clone(tableau),
      moves,
      score,
      elapsed: Math.round(elapsed * 1000) / 1000
    };
  }

  function restoreResumeState(state) {
    if (!validateResumeState(state)) return false;
    variant = Variants.get(state.variantId);
    variantSelect.value = variant.id;
    stock = clone(state.stock);
    waste = clone(state.waste);
    foundations = clone(state.foundations);
    tableau = clone(state.tableau);
    moves = Math.floor(Number(state.moves));
    score = Math.floor(Number(state.score));
    elapsed = Number(state.elapsed);
    selected = null;
    resetAutoMoveCycle();
    history = [];
    pointerDrag?.ghost?.remove();
    pointerDrag = null;
    running = true;
    paused = false;
    won = false;
    lastFrame = performance.now();
    lastTimerSecond = -1;
    overlay.classList.remove('visible');
    hideWin();
    pauseBtn.textContent = 'Ⅱ';
    pauseBtn.setAttribute('aria-label', 'Pausa');
    variantNameEl.textContent = variant.name.toUpperCase();
    render();
    showToast('PARTITA PRECEDENTE RIPRESA');
    return true;
  }

  function describeResumeState(state) {
    const foundationCount = state?.foundations ? SUITS.reduce((sum, suit) => sum + (state.foundations[suit]?.length || 0), 0) : 0;
    return `${Math.floor(Number(state?.moves) || 0)} mosse • ${formatTime(Number(state?.elapsed) || 0)} • ${foundationCount}/52 in fondazione`;
  }

  const resumeAdapter = Object.freeze({
    id: 'solitaire',
    version: 1,
    isInProgress: () => running && !won,
    serialize: serializeResumeState,
    validate: validateResumeState,
    restore: restoreResumeState,
    startFresh: newGame,
    describe: describeResumeState
  });
  window.RWGResumeAdapter = resumeAdapter;
  window.RWGSession?.register?.(resumeAdapter);

  board.addEventListener('pointerdown', event => {
    if (!running || paused || won || autoMoveLocked) return;
    const source = sourceFromElement(event.target);
    const cards = getSourceCards(source);
    if (!source || !cards?.length) return;
    const cardEl = event.target.closest('.playing-card');
    pointerDrag = { id: event.pointerId, source, cards: clone(cards), x: event.clientX, y: event.clientY, moved: false, ghost: null, width: cardEl.getBoundingClientRect().width };
    cardEl.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  document.addEventListener('pointermove', event => {
    if (!pointerDrag || pointerDrag.id !== event.pointerId) return;
    const dx = event.clientX - pointerDrag.x, dy = event.clientY - pointerDrag.y;
    if (!pointerDrag.moved && Math.hypot(dx, dy) > 7) {
      pointerDrag.moved = true;
      pointerDrag.ghost = createDragGhost(pointerDrag.source, pointerDrag.cards, pointerDrag.width);
      selected = pointerDrag.source;
      render();
    }
    if (pointerDrag.moved && pointerDrag.ghost) positionGhost(pointerDrag.ghost, event.clientX, event.clientY);
  }, { passive: false });

  document.addEventListener('pointerup', event => {
    if (!pointerDrag || pointerDrag.id !== event.pointerId) return;
    const drag = pointerDrag;
    pointerDrag = null;
    if (drag.ghost) drag.ghost.remove();
    if (drag.moved) {
      const targetEl = document.elementFromPoint(event.clientX, event.clientY);
      const target = targetFromElement(targetEl);
      if (!performMove(drag.source, target, { silentInvalid: true })) {
        selected = null;
        render();
      }
    } else {
      handleTap(event.target);
    }
  });

  document.addEventListener('pointercancel', () => {
    pointerDrag?.ghost?.remove();
    pointerDrag = null;
  });

  stockEl.addEventListener('click', drawStock);
  undoBtn.addEventListener('click', undo);
  pauseBtn.addEventListener('click', togglePause);
  hintBtn.addEventListener('click', showHint);
  newDealBtn.addEventListener('click', newGame);
  startBtn.addEventListener('click', newGame);
  winNewBtn.addEventListener('click', newGame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running && !paused && !won) {
      paused = true;
      selected = null;
      pauseBtn.textContent = '▶';
      pauseBtn.setAttribute('aria-label', 'Riprendi');
      render();
    }
    lastFrame = performance.now();
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => render(), 90);
  });

  variantNameEl.textContent = variant.name.toUpperCase();
  cardStyleSelect.addEventListener('change', () => changeCardStyle(cardStyleSelect.value));
  syncCardStyleControl();
  render();
  requestAnimationFrame(frame);
})();
