(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('next');
  const nctx = nextCanvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const linesEl = document.getElementById('lines');
  const levelEl = document.getElementById('level');
  const bestEl = document.getElementById('best');
  const pauseBtn = document.getElementById('pauseBtn');
  const overlay = document.getElementById('overlay');
  const overlayText = document.getElementById('overlayText');
  const startBtn = document.getElementById('startBtn');
  const controlButtons = [...document.querySelectorAll('#controls button')];

  const COLS = 10;
  const ROWS = 20;
  const RESUME_SCHEMA = 1;
  const COLORS = {
    I: '#65e7ff', J: '#668cff', L: '#ff9a52', O: '#ffe66d',
    S: '#7cffb2', T: '#bb7cff', Z: '#ff6680'
  };
  const SHAPES = {
    I: [[1,1,1,1]], J: [[1,0,0],[1,1,1]], L: [[0,0,1],[1,1,1]],
    O: [[1,1],[1,1]], S: [[0,1,1],[1,1,0]], T: [[0,1,0],[1,1,1]], Z: [[1,1,0],[0,1,1]]
  };

  let board = makeBoard(), current = null, next = null, bag = [];
  let running = false, paused = false, score = 0, lines = 0, level = 1;
  let best = Number(localStorage.getItem('rwgBlockDropBest') || 0);
  let dropTimer = 0, lastTime = 0, cell = 24, dpr = 1, clearFlash = 0, clearedRows = [];
  let touchStart = null, touchMoved = false, repeatTimer = null;

  function makeBoard() { return Array.from({ length: ROWS }, () => Array(COLS).fill(null)); }
  function cloneMatrix(m) { return m.map(row => row.slice()); }
  function markSessionDirty(reason = 'state') { window.RWGSession?.markDirty?.(reason); }

  function refillBag() {
    const types = Object.keys(SHAPES);
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    bag.push(...types);
  }
  function takeType() { if (!bag.length) refillBag(); return bag.shift(); }
  function makePiece(type = takeType()) {
    const matrix = cloneMatrix(SHAPES[type]);
    return { type, matrix, x: Math.floor((COLS - matrix[0].length) / 2), y: -matrix.length, color: COLORS[type] };
  }
  function resetGame() {
    board = makeBoard(); bag = []; score = 0; lines = 0; level = 1; dropTimer = 0;
    clearFlash = 0; clearedRows = []; current = makePiece(); next = makePiece(); updateHud(); drawNext();
  }
  function updateHud() {
    scoreEl.textContent = score.toLocaleString('it-IT'); linesEl.textContent = lines; levelEl.textContent = level; bestEl.textContent = best.toLocaleString('it-IT');
  }
  function resize() {
    const rect = canvas.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr)); canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); cell = Math.min(rect.width / COLS, rect.height / ROWS); draw();
  }
  function collides(piece, dx = 0, dy = 0, matrix = piece.matrix) {
    for (let y = 0; y < matrix.length; y++) for (let x = 0; x < matrix[y].length; x++) {
      if (!matrix[y][x]) continue;
      const bx = piece.x + x + dx, by = piece.y + y + dy;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
    return false;
  }
  function move(dx) { if (running && !paused && current && !collides(current, dx, 0)) { current.x += dx; draw(); } }
  function rotateMatrix(matrix) {
    const h = matrix.length, w = matrix[0].length, out = Array.from({ length: w }, () => Array(h).fill(0));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[x][h - 1 - y] = matrix[y][x];
    return out;
  }
  function rotate() {
    if (!running || paused || !current || current.type === 'O') return;
    const rotated = rotateMatrix(current.matrix);
    for (const kick of [0, -1, 1, -2, 2]) if (!collides(current, kick, 0, rotated)) { current.x += kick; current.matrix = rotated; draw(); return; }
  }
  function softDrop(manual = true) {
    if (!running || paused || !current) return;
    if (!collides(current, 0, 1)) { current.y++; if (manual) score += 1; updateHud(); }
    else lockPiece();
    draw();
  }
  function hardDrop() {
    if (!running || paused || !current) return;
    let distance = 0; while (!collides(current, 0, distance + 1)) distance++;
    current.y += distance; score += distance * 2; lockPiece(); updateHud(); draw(); navigator.vibrate?.(12);
  }
  function lockPiece() {
    let aboveTop = false;
    for (let y = 0; y < current.matrix.length; y++) for (let x = 0; x < current.matrix[y].length; x++) {
      if (!current.matrix[y][x]) continue;
      const bx = current.x + x, by = current.y + y;
      if (by < 0) { aboveTop = true; continue; }
      if (by < ROWS && bx >= 0 && bx < COLS) board[by][bx] = current.type;
    }
    if (aboveTop) { endGame(); return; }
    const full = []; for (let y = 0; y < ROWS; y++) if (board[y].every(Boolean)) full.push(y);
    if (full.length) clearLines(full);
    current = next; current.x = Math.floor((COLS - current.matrix[0].length) / 2); current.y = -current.matrix.length;
    next = makePiece(); drawNext(); markSessionDirty('piece-lock');
    if (collides(current, 0, 0)) endGame();
  }
  function clearLines(rows) {
    clearedRows = rows.slice(); clearFlash = 0.13;
    for (let i = rows.length - 1; i >= 0; i--) board.splice(rows[i], 1);
    for (let i = 0; i < rows.length; i++) board.unshift(Array(COLS).fill(null));
    const table = [0, 100, 300, 500, 800]; score += (table[rows.length] || rows.length * 250) * level;
    lines += rows.length; level = Math.floor(lines / 10) + 1; updateHud(); navigator.vibrate?.(rows.length === 4 ? [20, 25, 40] : 18);
  }
  function fallInterval() { return Math.max(90, 760 * Math.pow(0.86, level - 1)); }
  function ghostY() { if (!current) return 0; let d = 0; while (!collides(current, 0, d + 1)) d++; return current.y + d; }
  function drawBlock(context, px, py, size, color, alpha = 1) {
    const pad = Math.max(1, size * 0.055); context.globalAlpha = alpha; context.fillStyle = color;
    context.fillRect(px + pad, py + pad, size - pad * 2, size - pad * 2); context.fillStyle = 'rgba(255,255,255,.24)';
    context.fillRect(px + pad * 2, py + pad * 2, size - pad * 4, Math.max(2, size * .09)); context.fillStyle = 'rgba(0,0,0,.22)';
    context.fillRect(px + pad * 2, py + size - pad * 3, size - pad * 4, Math.max(2, size * .07)); context.globalAlpha = 1;
  }
  function drawGrid(w, h) {
    ctx.fillStyle = '#030817'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = 'rgba(101,231,255,.045)'; ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) { const px = x * cell; ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, ROWS * cell); ctx.stroke(); }
    for (let y = 0; y <= ROWS; y++) { const py = y * cell; ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(COLS * cell, py); ctx.stroke(); }
  }
  function drawPiece(piece, yOverride = null, alpha = 1) {
    const baseY = yOverride === null ? piece.y : yOverride;
    for (let y = 0; y < piece.matrix.length; y++) for (let x = 0; x < piece.matrix[y].length; x++) {
      if (!piece.matrix[y][x]) continue; const by = baseY + y; if (by < 0) continue;
      drawBlock(ctx, (piece.x + x) * cell, by * cell, cell, piece.color, alpha);
    }
  }
  function draw() {
    const rect = canvas.getBoundingClientRect(), w = rect.width, h = rect.height; ctx.clearRect(0, 0, w, h); drawGrid(w, h);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const type = board[y][x]; if (type) drawBlock(ctx, x * cell, y * cell, cell, COLORS[type]); }
    if (current) { drawPiece(current, ghostY(), 0.18); drawPiece(current); }
    if (clearFlash > 0) { ctx.globalAlpha = Math.min(1, clearFlash * 7); ctx.fillStyle = '#ffffff'; for (const row of clearedRows) ctx.fillRect(0, row * cell, COLS * cell, cell); ctx.globalAlpha = 1; }
  }
  function drawNext() {
    const cssSize = nextCanvas.getBoundingClientRect().width || 56, ndpr = Math.min(window.devicePixelRatio || 1, 2);
    nextCanvas.width = Math.floor(cssSize * ndpr); nextCanvas.height = Math.floor(cssSize * ndpr); nctx.setTransform(ndpr, 0, 0, ndpr, 0, 0); nctx.clearRect(0, 0, cssSize, cssSize);
    if (!next) return; const size = Math.min(14, cssSize / 4.6), mw = next.matrix[0].length * size, mh = next.matrix.length * size, ox = (cssSize - mw) / 2, oy = (cssSize - mh) / 2;
    for (let y = 0; y < next.matrix.length; y++) for (let x = 0; x < next.matrix[y].length; x++) if (next.matrix[y][x]) drawBlock(nctx, ox + x * size, oy + y * size, size, next.color);
  }
  function endGame() {
    running = false; paused = false; best = Math.max(best, score); localStorage.setItem('rwgBlockDropBest', String(best)); updateHud();
    overlayText.innerHTML = `Partita terminata.<br>Punteggio <strong>${score.toLocaleString('it-IT')}</strong> • ${lines} linee • livello ${level}.`;
    startBtn.textContent = 'RIGIOCA'; overlay.classList.add('visible'); pauseBtn.textContent = 'Ⅱ';
    const detail = { game: 'Block Drop', score, lines, level, best }; window.dispatchEvent(new CustomEvent('rwg:game-ended', { detail })); requestAnimationFrame(() => window.RWGGameOver?.open?.(detail));
  }
  function startGame() {
    window.RWGSession?.clear?.(); resetGame(); running = true; paused = false; lastTime = performance.now(); overlay.classList.remove('visible'); pauseBtn.textContent = 'Ⅱ';
    markSessionDirty('new-game'); requestAnimationFrame(loop);
  }
  function togglePause() {
    if (!running) return; paused = !paused; pauseBtn.textContent = paused ? '▶' : 'Ⅱ';
    if (!paused) { lastTime = performance.now(); requestAnimationFrame(loop); } else window.RWGSession?.saveNow?.('pause');
    draw();
  }
  function loop(now) {
    if (!running || paused) return; const dt = Math.min(80, now - lastTime); lastTime = now; dropTimer += dt;
    if (clearFlash > 0) clearFlash = Math.max(0, clearFlash - dt / 1000);
    if (dropTimer >= fallInterval()) { dropTimer = 0; softDrop(false); }
    draw(); requestAnimationFrame(loop);
  }
  function action(name) {
    if (name === 'left') move(-1); else if (name === 'right') move(1); else if (name === 'rotate') rotate(); else if (name === 'down') softDrop(true); else if (name === 'drop') hardDrop();
  }
  function stopRepeat() { if (repeatTimer) clearInterval(repeatTimer); repeatTimer = null; }

  function validPiece(piece) {
    if (!piece || !Object.hasOwn(SHAPES, piece.type) || !Array.isArray(piece.matrix) || !piece.matrix.length) return false;
    if (!Number.isFinite(piece.x) || !Number.isFinite(piece.y) || piece.color !== COLORS[piece.type]) return false;
    return piece.matrix.every(row => Array.isArray(row) && row.length > 0 && row.every(v => v === 0 || v === 1));
  }
  function validateResumeState(s) {
    const types = new Set(Object.keys(SHAPES));
    if (!s || s.schema !== RESUME_SCHEMA || !Array.isArray(s.board) || s.board.length !== ROWS) return false;
    if (!s.board.every(row => Array.isArray(row) && row.length === COLS && row.every(v => v === null || types.has(v)))) return false;
    if (!validPiece(s.current) || !validPiece(s.next) || !Array.isArray(s.bag) || s.bag.some(v => !types.has(v)) || s.bag.length > 7) return false;
    if (![s.score, s.lines, s.level, s.dropTimer].every(Number.isFinite) || s.score < 0 || s.lines < 0 || s.level < 1 || s.dropTimer < 0) return false;
    return s.level === Math.floor(s.lines / 10) + 1;
  }
  function serializeResumeState() {
    return { schema: RESUME_SCHEMA, board: board.map(row => row.slice()), current: structuredClone(current), next: structuredClone(next), bag: bag.slice(), score, lines, level, dropTimer };
  }
  function restoreResumeState(s) {
    if (!validateResumeState(s)) return false;
    board = s.board.map(row => row.slice()); current = structuredClone(s.current); next = structuredClone(s.next); bag = s.bag.slice();
    score = Math.floor(s.score); lines = Math.floor(s.lines); level = Math.floor(s.level); dropTimer = s.dropTimer; clearFlash = 0; clearedRows = [];
    running = true; paused = false; overlay.classList.remove('visible'); startBtn.textContent = 'RIGIOCA'; pauseBtn.textContent = 'Ⅱ'; lastTime = performance.now();
    updateHud(); drawNext(); resize(); draw(); requestAnimationFrame(loop); return true;
  }
  const resumeAdapter = Object.freeze({
    id: 'block-drop', version: 1, compatibility: 'block-drop-state-v1-10x20-7bag',
    isInProgress: () => running, serialize: serializeResumeState, validate: validateResumeState, restore: restoreResumeState, startFresh: startGame,
    describe: s => `${Math.floor(s.lines || 0)} linee • livello ${Math.floor(s.level || 1)} • ${Math.floor(s.score || 0).toLocaleString('it-IT')} punti`
  });
  window.RWGResumeAdapter = resumeAdapter; window.RWGSession?.register?.(resumeAdapter);

  controlButtons.forEach(btn => {
    const name = btn.dataset.action;
    btn.addEventListener('pointerdown', e => { e.preventDefault(); action(name); stopRepeat(); if (name === 'left' || name === 'right' || name === 'down') repeatTimer = setInterval(() => action(name), name === 'down' ? 55 : 95); });
    btn.addEventListener('pointerup', stopRepeat); btn.addEventListener('pointercancel', stopRepeat); btn.addEventListener('pointerleave', stopRepeat);
  });
  canvas.addEventListener('pointerdown', e => { if (!running || paused) return; const r = canvas.getBoundingClientRect(); touchStart = { x: e.clientX - r.left, y: e.clientY - r.top }; touchMoved = false; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!touchStart || !running || paused) return; const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, dx = x - touchStart.x, dy = y - touchStart.y, threshold = Math.max(18, cell * .72);
    if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy)) { move(dx > 0 ? 1 : -1); touchStart.x = x; touchMoved = true; }
    else if (dy >= threshold && Math.abs(dy) > Math.abs(dx)) { softDrop(true); touchStart.y = y; touchMoved = true; }
  });
  canvas.addEventListener('pointerup', () => { if (!touchStart || !running || paused) return; if (!touchMoved) rotate(); touchStart = null; });
  canvas.addEventListener('pointercancel', () => { touchStart = null; });
  window.addEventListener('keydown', e => {
    const keys = ['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' ','KeyP']; if (keys.includes(e.code) || keys.includes(e.key)) e.preventDefault();
    if (e.key === 'ArrowLeft') move(-1); else if (e.key === 'ArrowRight') move(1); else if (e.key === 'ArrowDown') softDrop(true); else if (e.key === 'ArrowUp' || e.key === 'x' || e.key === 'X') rotate(); else if (e.code === 'Space') hardDrop(); else if (e.key === 'p' || e.key === 'P') togglePause();
  }, { passive: false });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) togglePause(); });
  window.addEventListener('rwg:continue-game', e => {
    score = Math.max(0, Math.floor(e.detail?.score ?? score)); for (let y = 0; y < 6; y++) board[y] = Array(COLS).fill(null);
    current = makePiece(); next = next || makePiece(); dropTimer = 0; clearFlash = 0; clearedRows = []; running = true; paused = false;
    overlay.classList.remove('visible'); startBtn.textContent = 'RIGIOCA'; pauseBtn.textContent = 'Ⅱ'; lastTime = performance.now(); updateHud(); drawNext(); draw(); markSessionDirty('credit-continue'); requestAnimationFrame(loop);
  });
  pauseBtn.addEventListener('click', togglePause); startBtn.addEventListener('click', startGame); window.addEventListener('resize', () => { resize(); drawNext(); });
  updateHud(); resetGame(); resize(); drawNext();
})();