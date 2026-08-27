(() => {
  'use strict';

  const Levels = window.BubbleBurstLevels;
  if (!Levels?.getLevel) throw new Error('Bubble Burst levels module missing');

  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const scoreEl = $('score'), levelEl = $('level'), missesEl = $('misses'), bestEl = $('best');
  const overlay = $('overlay'), overlayText = $('overlayText'), startBtn = $('startBtn');
  const pauseBtn = $('pauseBtn'), muteBtn = $('muteBtn'), nextBubbleEl = $('nextBubble');
  const nextDot = document.querySelector('#nextBubble i');

  const PALETTE = ['#ff5f73', '#65e7ff', '#ffe66d', '#8d7cff', '#7cffb2', '#ff934f'];
  const SHOT_NORMAL = 'normal', SHOT_BOMB = 'bomb', SHOT_COLOR_CLEAR = 'colorClear';
  const STATIC_NORMAL = 'normal', STATIC_ARMOR = 'armor', STATIC_STAR = 'star', STATIC_PRISM = 'prism';
  const COLS = 11;
  const PRESSURE_START_SECONDS = 65;
  const PRESSURE_MIN_SECONDS = 16;
  const PRESSURE_DECAY = .982;
  const PRESSURE_START_ROWS = .5;
  const PRESSURE_MAX_ROWS = .9;
  const PRESSURE_ROW_GROWTH = .004;

  let W = 390, H = 844, DPR = 1;
  let R = 16, CELL = 32, ROW_H = 28, TOP = 82;
  let launcherX = W / 2, launcherY = H - 96;
  let running = false, paused = false, muted = false, aiming = false;
  let aimX = W / 2, aimY = H * .42, last = 0;
  let score = 0, level = 1, misses = 0, missLimit = 5, colorCount = 4;
  let currentShot = { kind: SHOT_NORMAL, color: PALETTE[0] };
  let nextShot = { kind: SHOT_NORMAL, color: PALETTE[1] };
  let moving = null, banner = '', bannerTime = 0, operatorPulse = 0;
  let boardMeta = null, backgroundCache = null, audio = null;
  let pressureRows = 0, pressureElapsed = 0, pressureInterval = PRESSURE_START_SECONDS, pressureDue = false, pressurePulse = 0;
  let best = Number(localStorage.getItem('bubbleBurstBest') || 0);

  const grid = new Map();
  const particles = [];
  const falling = [];
  const bubbleSprites = new Map();
  const chibiSprites = new Map();

  const key = (r, c) => `${r},${c}`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pressureIntervalFor = lvl => Math.max(PRESSURE_MIN_SECONDS, PRESSURE_START_SECONDS * Math.pow(PRESSURE_DECAY, Math.max(0, lvl - 1)));
  const pressureStepFor = lvl => Math.min(PRESSURE_MAX_ROWS, PRESSURE_START_ROWS + Math.max(0, lvl - 1) * PRESSURE_ROW_GROWTH);
  const ceilingY = () => TOP + pressureRows * ROW_H;

  function resetPressure() {
    pressureRows = 0;
    pressureElapsed = 0;
    pressureInterval = pressureIntervalFor(level);
    pressureDue = false;
    pressurePulse = 0;
  }

  function ensureAudio() {
    if (!audio) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audio = new AudioCtx();
    }
    if (audio?.state === 'suspended') audio.resume().catch(() => {});
  }

  function tone(freq, duration = .06, type = 'sine', volume = .025, slide = 0) {
    if (muted) return;
    ensureAudio();
    if (!audio || audio.state !== 'running') return;
    try {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audio.currentTime);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(25, freq + slide), audio.currentTime + duration);
      gain.gain.setValueAtTime(volume, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
      osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
    } catch (_) {}
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(280, rect.width); H = Math.max(480, rect.height);
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    R = clamp((W - 14) / (COLS * 2 + 1), 13, 17.2);
    CELL = R * 2; ROW_H = R * 1.73;
    TOP = Math.max(76, H * .105);
    launcherX = W / 2; launcherY = H - Math.max(96, H * .115);
    aimX = clamp(aimX, R, W - R); aimY = Math.min(launcherY - 45, aimY);
    bubbleSprites.clear(); backgroundCache = buildBackgroundCache();
  }

  function cellPos(r, c) {
    const offset = r % 2 ? R : 0;
    return { x: R + c * CELL + offset, y: ceilingY() + R + r * ROW_H };
  }

  function validCell(r, c) {
    if (r < 0 || c < 0 || c >= COLS) return false;
    const p = cellPos(r, c);
    return p.x >= R - .1 && p.x <= W - R + .1;
  }

  function neighbors(r, c) {
    const out = [[r, c - 1], [r, c + 1]];
    if (r % 2 === 0) out.push([r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]);
    else out.push([r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]);
    return out.filter(([rr, cc]) => validCell(rr, cc));
  }

  function nearbyBubbles(x, y, radiusRows = 2) {
    const baseR = Math.max(0, Math.round((y - ceilingY() - R) / ROW_H));
    const out = [];
    for (let rr = Math.max(0, baseR - radiusRows); rr <= baseR + radiusRows; rr++) {
      const offset = rr % 2 ? R : 0;
      const baseC = Math.round((x - R - offset) / CELL);
      for (let cc = baseC - 2; cc <= baseC + 2; cc++) {
        const b = grid.get(key(rr, cc)); if (b) out.push(b);
      }
    }
    return out;
  }

  function activeColors() {
    const present = new Set();
    for (const b of grid.values()) if (b.color) present.add(b.color);
    return present.size ? [...present] : PALETTE.slice(0, colorCount);
  }

  function pickColor() {
    const colors = activeColors();
    return colors[Math.floor(Math.random() * colors.length)] || PALETTE[0];
  }

  function makeQueuedShot() {
    const color = pickColor();
    const roll = Math.random();
    const bombChance = level >= 10 ? Math.min(.03, .012 + (level - 10) * .00011) : 0;
    const clearChance = level >= 22 ? Math.min(.02, .007 + (level - 22) * .000075) : 0;
    if (roll < clearChance) return { kind: SHOT_COLOR_CLEAR, color };
    if (roll < clearChance + bombChance) return { kind: SHOT_BOMB, color };
    return { kind: SHOT_NORMAL, color };
  }

  function shotLabel(shot) {
    if (shot.kind === SHOT_BOMB) return 'BOMBA';
    if (shot.kind === SHOT_COLOR_CLEAR) return 'COLOR WIPE';
    return 'NORMALE';
  }

  function updateNextPreview() {
    nextDot.className = '';
    nextDot.textContent = '';
    nextDot.style.background = nextShot.color;
    nextDot.style.color = nextShot.color;
    if (nextShot.kind === SHOT_BOMB) { nextDot.classList.add('is-bomb'); nextDot.textContent = '✦'; }
    if (nextShot.kind === SHOT_COLOR_CLEAR) { nextDot.classList.add('is-color-clear'); nextDot.textContent = '◆'; }
    nextBubbleEl?.setAttribute('aria-label', `Prossima bolla: ${shotLabel(nextShot)}`);
  }

  function spawnBoard() {
    grid.clear();
    boardMeta = Levels.getLevel(level, COLS);
    colorCount = boardMeta.colorCount;
    for (const cell of boardMeta.cells) {
      if (!validCell(cell.r, cell.c)) continue;
      const color = PALETTE[cell.colorIndex % colorCount];
      grid.set(key(cell.r, cell.c), {
        r: cell.r, c: cell.c, color,
        type: cell.special || STATIC_NORMAL,
        armor: cell.special === STATIC_ARMOR ? 1 : 0
      });
    }
  }

  function resetGame() {
    score = 0; level = 1; misses = 0; missLimit = 5; moving = null; aiming = false;
    particles.length = 0; falling.length = 0; operatorPulse = 0;
    resetPressure(); spawnBoard(); currentShot = makeQueuedShot(); nextShot = makeQueuedShot();
    banner = `LIVELLO 001 • ${boardMeta.name}`; bannerTime = 1.6; updateHud();
  }

  function updateHud() {
    scoreEl.textContent = score.toLocaleString('it-IT');
    levelEl.textContent = level; missesEl.textContent = `${misses}/${missLimit}`;
    bestEl.textContent = best.toLocaleString('it-IT'); updateNextPreview();
  }

  function burst(x, y, color, count = 10, speed = 140) {
    const room = Math.max(0, 460 - particles.length); count = Math.min(count, room);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * speed;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: .35 + Math.random() * .45, max: .8, size: 1.5 + Math.random() * 3 });
    }
  }

  function aimVector() {
    const dx = aimX - launcherX, dy = Math.min(-40, aimY - launcherY);
    let angle = Math.atan2(dy, dx); angle = clamp(angle, -Math.PI + .24, -.24);
    return { x: Math.cos(angle), y: Math.sin(angle), angle };
  }

  function shoot() {
    if (!running || paused || moving) return;
    const v = aimVector(), speed = Math.min(720, 535 + level * .85 + H * .05);
    moving = { x: launcherX + v.x * (R + 16), y: launcherY + v.y * (R + 16), vx: v.x * speed, vy: v.y * speed, ...currentShot };
    currentShot = nextShot; nextShot = makeQueuedShot(); operatorPulse = .18;
    updateHud(); tone(moving.kind === SHOT_BOMB ? 320 : moving.kind === SHOT_COLOR_CLEAR ? 820 : 520, .055, 'triangle', .028, 180);
  }

  function findNearestEmpty(x, y) {
    const baseR = Math.max(0, Math.round((y - ceilingY() - R) / ROW_H));
    let bestCell = null, bestDist = Infinity;
    for (let rr = Math.max(0, baseR - 3); rr <= baseR + 3; rr++) {
      const offset = rr % 2 ? R : 0, baseC = Math.round((x - R - offset) / CELL);
      for (let cc = baseC - 3; cc <= baseC + 3; cc++) {
        if (!validCell(rr, cc) || grid.has(key(rr, cc))) continue;
        const p = cellPos(rr, cc), d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bestDist) { bestDist = d; bestCell = { r: rr, c: cc }; }
      }
    }
    return bestCell;
  }

  function component(startR, startC, targetColor = null) {
    const start = grid.get(key(startR, startC)); if (!start) return [];
    const target = targetColor || start.color;
    const queue = [[startR, startC]], seen = new Set([key(startR, startC)]), out = [];
    for (let qi = 0; qi < queue.length; qi++) {
      const [r, c] = queue[qi], b = grid.get(key(r, c));
      if (!b || (b.type !== STATIC_PRISM && b.color !== target)) continue;
      out.push([r, c]);
      for (const [nr, nc] of neighbors(r, c)) {
        const nk = key(nr, nc), nb = grid.get(nk);
        if (!seen.has(nk) && nb && (nb.type === STATIC_PRISM || nb.color === target)) { seen.add(nk); queue.push([nr, nc]); }
      }
    }
    return out;
  }

  function removeCells(cells, pointsPer = 35, force = false) {
    const pending = [...cells], queued = new Set(pending.map(([r, c]) => key(r, c))), starBursts = [];
    let removed = 0;
    for (let i = 0; i < pending.length; i++) {
      const [r, c] = pending[i], k = key(r, c), b = grid.get(k); if (!b) continue;
      const p = cellPos(r, c);
      if (b.type === STATIC_ARMOR && b.armor > 0 && !force) {
        b.armor = 0; b.type = STATIC_NORMAL; score += Math.round(pointsPer * .55);
        burst(p.x, p.y, '#d9ecff', 9, 105); tone(185, .05, 'square', .02, 80); continue;
      }
      grid.delete(k); removed++; score += pointsPer + (b.type === STATIC_STAR ? 55 : b.type === STATIC_PRISM ? 35 : b.type === STATIC_ARMOR ? 25 : 0);
      burst(p.x, p.y, b.type === STATIC_PRISM ? '#f4ecff' : b.color, b.type === STATIC_STAR ? 18 : 10, b.type === STATIC_STAR ? 190 : 145);
      if (b.type === STATIC_STAR) starBursts.push([r, c]);
    }
    for (const [sr, sc] of starBursts) {
      for (const [nr, nc] of neighbors(sr, sc)) {
        const nk = key(nr, nc); if (queued.has(nk) || !grid.has(nk)) continue;
        queued.add(nk); pending.push([nr, nc]);
      }
    }
    if (starBursts.length) {
      for (let i = cells.length; i < pending.length; i++) {
        const [r, c] = pending[i], k = key(r, c), b = grid.get(k); if (!b) continue;
        const p = cellPos(r, c); grid.delete(k); removed++; score += Math.round(pointsPer * .8);
        burst(p.x, p.y, '#ffe66d', 10, 170);
      }
      tone(860, .09, 'triangle', .035, -260);
    }
    return removed;
  }

  function dropDisconnected() {
    const anchored = new Set(), queue = [];
    for (let c = 0; c < COLS; c++) {
      const k = key(0, c); if (validCell(0, c) && grid.has(k)) { anchored.add(k); queue.push([0, c]); }
    }
    for (let qi = 0; qi < queue.length; qi++) {
      const [r, c] = queue[qi];
      for (const [nr, nc] of neighbors(r, c)) {
        const nk = key(nr, nc); if (grid.has(nk) && !anchored.has(nk)) { anchored.add(nk); queue.push([nr, nc]); }
      }
    }
    let dropped = 0;
    for (const [k, b] of grid) {
      if (anchored.has(k)) continue;
      const p = cellPos(b.r, b.c); falling.push({ x: p.x, y: p.y, color: b.color, type: b.type, armor: b.armor, vx: (Math.random() - .5) * 90, vy: 35 + Math.random() * 60 });
      grid.delete(k); score += 55; dropped++;
    }
    if (falling.length > 180) falling.splice(0, falling.length - 180);
    return dropped;
  }

  function addPenaltyRow() {
    const shifted = new Map();
    for (const b of grid.values()) {
      const nr = b.r + 1; if (validCell(nr, b.c)) shifted.set(key(nr, b.c), { ...b, r: nr });
    }
    grid.clear(); for (const [k, b] of shifted) grid.set(k, b);
    for (let c = 0; c < COLS; c++) {
      if (!validCell(0, c)) continue;
      const color = PALETTE[Math.floor(Math.random() * colorCount)]; grid.set(key(0, c), { r: 0, c, color, type: STATIC_NORMAL, armor: 0 });
    }
    misses = 0; banner = 'PRESSIONE +1 • NUOVA RIGA!'; bannerTime = 1.15; tone(135, .16, 'sawtooth', .035, -55); navigator.vibrate?.(35);
  }

  function reconcileQueue() {
    const colors = activeColors();
    if (!colors.includes(currentShot.color)) currentShot.color = pickColor();
    if (!colors.includes(nextShot.color)) nextShot.color = pickColor();
  }

  function finishResolution({ resetMisses = true } = {}) {
    if (resetMisses) misses = 0;
    if (!grid.size) { nextLevel(); return; }
    reconcileQueue(); updateHud(); checkDanger();
  }

  function resolveNormalShot(cell) {
    const matches = component(cell.r, cell.c, grid.get(key(cell.r, cell.c))?.color);
    if (matches.length >= 3) {
      const removed = removeCells(matches, 35, false), dropped = dropDisconnected();
      score += Math.max(0, matches.length - 3) * 15; tone(640, .09, 'triangle', .04, 280); if (dropped) tone(330, .14, 'sine', .035, -110);
      finishResolution({ resetMisses: removed > 0 || matches.length >= 3 });
    } else {
      misses++; tone(210, .04, 'square', .018, -35); if (misses >= missLimit) addPenaltyRow();
      if (!grid.size) nextLevel(); else { reconcileQueue(); updateHud(); checkDanger(); }
    }
  }

  function resolveBomb(hit) {
    const hp = hit ? cellPos(hit.r, hit.c) : { x: moving.x, y: moving.y };
    const radius = CELL * 1.55, cells = [];
    for (const b of nearbyBubbles(hp.x, hp.y, 2)) {
      const p = cellPos(b.r, b.c); if ((p.x - hp.x) ** 2 + (p.y - hp.y) ** 2 <= radius * radius) cells.push([b.r, b.c]);
    }
    moving = null; removeCells(cells, 48, true); const dropped = dropDisconnected();
    burst(hp.x, hp.y, '#ff934f', 34, 260); tone(110, .14, 'sawtooth', .05, 420); navigator.vibrate?.([22, 18, 35]);
    if (dropped) score += dropped * 18; finishResolution();
  }

  function resolveColorClear(hit) {
    const targetColor = hit?.color || moving.color || pickColor(), cells = [];
    for (const b of grid.values()) if (b.color === targetColor) cells.push([b.r, b.c]);
    const x = hit ? cellPos(hit.r, hit.c).x : moving.x, y = hit ? cellPos(hit.r, hit.c).y : moving.y;
    moving = null; const removed = removeCells(cells, 42, true), dropped = dropDisconnected(); score += removed * 8;
    burst(x, y, targetColor, 30, 230); tone(980, .14, 'triangle', .045, -450); navigator.vibrate?.([12, 12, 12]);
    if (dropped) score += dropped * 18; finishResolution();
  }

  function attachNormal() {
    if (!moving) return;
    const cell = findNearestEmpty(moving.x, moving.y); if (!cell) { endGame(); return; }
    const p = cellPos(cell.r, cell.c), color = moving.color; moving = null;
    grid.set(key(cell.r, cell.c), { r: cell.r, c: cell.c, color, type: STATIC_NORMAL, armor: 0 });
    burst(p.x, p.y, color, 5, 65); tone(360, .035, 'sine', .018, 60); resolveNormalShot(cell);
  }

  function resolveImpact(hit = null) {
    if (!moving) return;
    if (hit && moving.kind === SHOT_BOMB) { resolveBomb(hit); return; }
    if (hit && moving.kind === SHOT_COLOR_CLEAR) { resolveColorClear(hit); return; }
    attachNormal();
  }

  function nextLevel() {
    level++; misses = 0;
    missLimit = level >= 80 ? 3 : level >= 28 ? 4 : 5;
    score += 700 + Math.min(2300, level * 22);
    resetPressure(); spawnBoard(); currentShot = makeQueuedShot(); nextShot = makeQueuedShot();
    const intro = level === 8 ? 'ARMOR BUBBLES!' : level === 18 ? 'STAR BUBBLES!' : level === 35 ? 'PRISM BUBBLES!' : null;
    banner = intro || `LIVELLO ${String(level).padStart(3, '0')} • ${boardMeta.name}`; bannerTime = intro ? 2 : 1.5;
    tone(480, .18, 'triangle', .045, 480); updateHud();
  }

  function checkDanger() {
    const dangerY = launcherY - R * 3.4;
    for (const b of grid.values()) if (cellPos(b.r, b.c).y + R >= dangerY) { endGame(); return true; }
    return false;
  }

  function applyPressureDrop() {
    pressureDue = false;
    pressureElapsed = 0;
    pressureRows += pressureStepFor(level);
    pressurePulse = .85;
    banner = '↓ STRUTTURA IN DISCESA!'; bannerTime = 1.15;
    tone(128, .13, 'sawtooth', .032, -40); navigator.vibrate?.([18, 22, 28]);
    checkDanger();
  }

  function updatePressure(dt) {
    pressureElapsed += dt;
    pressurePulse = Math.max(0, pressurePulse - dt);
    if (pressureElapsed >= pressureInterval) pressureDue = true;
    if (pressureDue && !moving) applyPressureDrop();
  }

  function endGame() {
    if (!running) return;
    running = false; paused = false; aiming = false; moving = null;
    best = Math.max(best, score); localStorage.setItem('bubbleBurstBest', String(best)); updateHud();
    overlayText.innerHTML = `Le bolle hanno raggiunto la linea di pericolo.<br>Punteggio <strong>${score.toLocaleString('it-IT')}</strong> • livello ${level}.`;
    startBtn.textContent = 'RIGIOCA'; overlay.classList.add('visible'); pauseBtn.textContent = 'Ⅱ'; tone(95, .25, 'sawtooth', .05, -55);
    const detail = { game: 'Bubble Burst', score, level, best, layout: boardMeta?.id || level };
    window.dispatchEvent(new CustomEvent('rwg:game-ended', { detail })); requestAnimationFrame(() => window.RWGGameOver?.open?.(detail));
  }

  function collisionBubble(x, y) {
    let closest = null, bestD = Infinity;
    for (const b of nearbyBubbles(x, y, 2)) {
      const p = cellPos(b.r, b.c), d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d <= (R * 1.88) ** 2 && d < bestD) { bestD = d; closest = b; }
    }
    return closest;
  }

  function updateMoving(dt) {
    if (!moving) return;
    moving.x += moving.vx * dt; moving.y += moving.vy * dt;
    if (moving.x <= R) { moving.x = R; moving.vx = Math.abs(moving.vx); tone(290, .025, 'square', .012, 30); }
    else if (moving.x >= W - R) { moving.x = W - R; moving.vx = -Math.abs(moving.vx); tone(290, .025, 'square', .012, 30); }
    const hit = collisionBubble(moving.x, moving.y);
    if (hit) { resolveImpact(hit); return; }
    const top = ceilingY();
    if (moving.y - R <= top) { moving.y = top + R; resolveImpact(null); }
  }

  function update(dt) {
    if (!running || paused) return;
    updateMoving(dt);
    if (!running) return;
    updatePressure(dt);
    if (!running) return;
    bannerTime = Math.max(0, bannerTime - dt); operatorPulse = Math.max(0, operatorPulse - dt);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(.08, dt); p.vy *= Math.pow(.08, dt); p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = falling.length - 1; i >= 0; i--) {
      const b = falling[i]; b.vy += 720 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > H + R * 3) falling.splice(i, 1);
    }
  }

  function makeBubbleSprite(color, type = STATIC_NORMAL, armor = 0) {
    const cacheKey = `${color}|${type}|${armor}`; if (bubbleSprites.has(cacheKey)) return bubbleSprites.get(cacheKey);
    const c = document.createElement('canvas'); c.width = c.height = 72; const g = c.getContext('2d');
    const x = 36, y = 36, rr = 24;
    g.shadowBlur = 13; g.shadowColor = type === STATIC_PRISM ? '#d586ff' : type === SHOT_BOMB ? '#ff5f73' : color;
    const grad = g.createRadialGradient(27, 25, 2, 36, 36, 27);
    if (type === SHOT_BOMB) { grad.addColorStop(0, '#ffb05c'); grad.addColorStop(.28, '#cb384e'); grad.addColorStop(1, '#2a0b17'); }
    else if (type === SHOT_COLOR_CLEAR || type === STATIC_PRISM) { grad.addColorStop(0, '#ffffff'); grad.addColorStop(.27, '#65e7ff'); grad.addColorStop(.52, '#ff5ecf'); grad.addColorStop(.76, '#ffe66d'); grad.addColorStop(1, '#765cff'); }
    else { grad.addColorStop(0, '#ffffff'); grad.addColorStop(.2, color); grad.addColorStop(1, '#071126'); }
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,255,255,.52)'; g.lineWidth = 2; g.stroke();
    if (type === STATIC_ARMOR && armor > 0) {
      g.strokeStyle = '#d8e4f5'; g.lineWidth = 5; g.beginPath(); g.arc(x, y, rr - 4, .2, 2.75); g.stroke(); g.beginPath(); g.arc(x, y, rr - 4, 3.25, 5.8); g.stroke();
      g.fillStyle = '#8fa6bd'; [[18,32],[51,30],[32,15],[35,51]].forEach(([px,py])=>g.fillRect(px,py,5,5));
    } else if (type === STATIC_STAR) {
      g.fillStyle = '#fff6a8'; const pts=[[36,17],[40,29],[53,29],[43,37],[47,50],[36,42],[25,50],[29,37],[19,29],[32,29]]; g.beginPath(); pts.forEach(([px,py],i)=>i?g.lineTo(px,py):g.moveTo(px,py)); g.closePath(); g.fill();
    } else if (type === STATIC_PRISM || type === SHOT_COLOR_CLEAR) {
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(36,17); g.lineTo(52,36); g.lineTo(36,55); g.lineTo(20,36); g.closePath(); g.stroke();
    } else if (type === SHOT_BOMB) {
      g.fillStyle = '#fff0cb'; g.fillRect(31,31,10,10); g.fillStyle = '#ffdf5d'; g.fillRect(46,13,5,9); g.fillRect(50,10,5,5);
    }
    bubbleSprites.set(cacheKey, c); return c;
  }

  function drawBubble(x, y, color, radius = R, type = STATIC_NORMAL, armor = 0) {
    const sprite = makeBubbleSprite(color, type, armor), d = radius * 2.55;
    ctx.drawImage(sprite, x - d / 2, y - d / 2, d, d);
  }

  function makeChibiSprite(role, pose = 'idle') {
    const cacheKey = `${role}|${pose}`; if (chibiSprites.has(cacheKey)) return chibiSprites.get(cacheKey);
    const c = document.createElement('canvas'); c.width = 32; c.height = 40; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const left = role === 'operator';
    const hair = left ? '#ff5ecf' : '#65e7ff', suit = left ? '#65e7ff' : '#ffe66d', accent = left ? '#ffe66d' : '#7cffb2';
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(7,36,18,3);
    g.fillStyle = '#11172a'; g.fillRect(8,6,16,14); g.fillRect(6,10,20,9);
    g.fillStyle = hair; g.fillRect(8,5,16,5); g.fillRect(left?7:18,8,7,7); g.fillRect(left?20:7,7,5,4);
    g.fillStyle = '#ffd8bd'; g.fillRect(9,11,14,11); g.fillRect(7,14,3,5); g.fillRect(22,14,3,5);
    g.fillStyle = '#172038'; g.fillRect(11,14,3,3); g.fillRect(19,14,3,3);
    g.fillStyle = pose === 'fire' && left ? '#ff5f73' : '#c7667d'; g.fillRect(14,19,5,2);
    g.fillStyle = suit; g.fillRect(9,23,14,10); g.fillRect(6,24,4,8); g.fillRect(22,24,4,8);
    g.fillStyle = accent; g.fillRect(13,23,6,10);
    g.fillStyle = '#ddeaff'; g.fillRect(7,31,5,4); g.fillRect(20,31,5,4);
    g.fillStyle = '#222c48'; g.fillRect(10,33,5,5); g.fillRect(18,33,5,5);
    if (!left) { g.fillStyle = '#6f7b96'; g.fillRect(4,27,4,7); g.fillRect(24,27,4,7); g.strokeStyle='#b9c8da'; g.strokeRect(4,26,24,9); }
    chibiSprites.set(cacheKey, c); return c;
  }

  function drawChibiCrew() {
    const sizeW = clamp(W * .12, 42, 54), sizeH = sizeW * 1.25, off = clamp(W * .205, 60, 79);
    const bob = Math.sin(performance.now() * .004) * 1.4;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    const operator = makeChibiSprite('operator', operatorPulse > 0 ? 'fire' : 'idle');
    const loader = makeChibiSprite('loader', 'idle');
    ctx.drawImage(operator, launcherX - off - sizeW / 2, launcherY - sizeH * .52 + bob + (operatorPulse > 0 ? 3 : 0), sizeW, sizeH);
    ctx.drawImage(loader, launcherX + off - sizeW / 2, launcherY - sizeH * .52 - bob, sizeW, sizeH);
    ctx.restore();
    drawBubble(launcherX + off + sizeW * .15, launcherY - sizeH * .36 - bob, nextShot.color, R * .48, nextShot.kind, 0);
  }

  function traceAim() {
    if (!running || paused || moving) return;
    const v = aimVector(); let x = launcherX + v.x * (R + 20), y = launcherY + v.y * (R + 20), vx = v.x, vy = v.y;
    const step = 13, top = ceilingY(); ctx.save();
    for (let i = 0; i < 46; i++) {
      x += vx * step; y += vy * step;
      if (x <= R) { x = R; vx = Math.abs(vx); } if (x >= W - R) { x = W - R; vx = -Math.abs(vx); }
      const stop = y <= top + R || Boolean(collisionBubble(x, y));
      if (i % 2 === 0) { ctx.globalAlpha = .7 * (1 - i / 56); ctx.fillStyle = currentShot.kind === SHOT_NORMAL ? currentShot.color : '#ffffff'; ctx.fillRect(x - 2, y - 2, 4, 4); }
      if (stop) break;
    }
    ctx.restore();
  }

  function drawLauncher() {
    drawChibiCrew();
    const v = aimVector(); ctx.save(); ctx.translate(launcherX, launcherY); ctx.rotate(v.angle + Math.PI / 2);
    const g = ctx.createLinearGradient(-8, 0, 8, 0); g.addColorStop(0, '#37445f'); g.addColorStop(.45, '#e7f2ff'); g.addColorStop(.65, '#65e7ff'); g.addColorStop(1, '#3d4c68');
    ctx.fillStyle = g; ctx.fillRect(-8, -43, 16, 45); ctx.strokeStyle = 'rgba(101,231,255,.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(-8, -43, 16, 45); ctx.restore();
    ctx.fillStyle = '#18233b'; ctx.beginPath(); ctx.arc(launcherX, launcherY + 3, R + 10, Math.PI, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.stroke();
    if (!moving) drawBubble(launcherX, launcherY - 5, currentShot.color, R, currentShot.kind, 0);
  }

  function buildBackgroundCache() {
    const c = document.createElement('canvas'); c.width = Math.ceil(W); c.height = Math.ceil(H); const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#122d54'); grad.addColorStop(.46, '#08142d'); grad.addColorStop(1, '#03050d'); g.fillStyle = grad; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { const x = (i * 83.17) % W, y = TOP + ((i * 47.31) % Math.max(20, launcherY - TOP)); g.globalAlpha = .08 + (i % 5) * .025; g.fillStyle = i % 7 === 0 ? '#ff5ecf' : '#65e7ff'; g.fillRect(x, y, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1); }
    g.globalAlpha = .08; g.strokeStyle = '#65e7ff'; g.lineWidth = 1;
    for (let y = TOP + 12; y < launcherY - 40; y += 38) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.globalAlpha = 1; return c;
  }

  function drawPressureStatus() {
    if (!running) return;
    const remaining = Math.max(0, pressureInterval - pressureElapsed);
    if (remaining > 6 && pressurePulse <= 0) return;
    const dangerY = launcherY - R * 3.4;
    const label = pressurePulse > 0 ? '↓ STRUTTURA IN DISCESA' : `↓ DISCESA IN ${Math.max(1, Math.ceil(remaining))}s`;
    ctx.save(); ctx.font = '900 9px ui-monospace, monospace'; ctx.textAlign = 'center';
    const width = ctx.measureText(label).width + 18, y = dangerY - 19;
    ctx.globalAlpha = pressurePulse > 0 ? .95 : .72 + Math.sin(performance.now() * .012) * .18;
    ctx.fillStyle = 'rgba(44,8,20,.82)'; ctx.fillRect(W / 2 - width / 2, y - 11, width, 17);
    ctx.fillStyle = '#ff9aaa'; ctx.fillText(label, W / 2, y + 1); ctx.restore();
  }

  function drawBackground() {
    if (backgroundCache) ctx.drawImage(backgroundCache, 0, 0, W, H); else { ctx.fillStyle = '#071126'; ctx.fillRect(0, 0, W, H); }
    const dangerY = launcherY - R * 3.4, top = ceilingY(); ctx.save();
    ctx.strokeStyle = 'rgba(255,230,109,.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(W, top); ctx.stroke();
    ctx.setLineDash([5, 8]); ctx.strokeStyle = 'rgba(255,95,115,.42)'; ctx.beginPath(); ctx.moveTo(0, dangerY); ctx.lineTo(W, dangerY); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,95,115,.62)'; ctx.font = '8px ui-monospace, monospace'; ctx.fillText('DANGER', 10, dangerY - 6); ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H); drawBackground(); traceAim();
    for (const b of grid.values()) { const p = cellPos(b.r, b.c); drawBubble(p.x, p.y, b.color, R, b.type, b.armor); }
    for (const b of falling) drawBubble(b.x, b.y, b.color, R * .92, b.type, b.armor);
    if (moving) drawBubble(moving.x, moving.y, moving.color, R, moving.kind, 0);
    drawLauncher();
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); } ctx.globalAlpha = 1;
    drawPressureStatus();
    if (bannerTime > 0 && running) { ctx.save(); ctx.globalAlpha = Math.min(1, bannerTime * 2); ctx.textAlign = 'center'; ctx.font = '900 17px ui-monospace, monospace'; ctx.fillStyle = '#f7fbff'; ctx.shadowBlur = 15; ctx.shadowColor = '#65e7ff'; ctx.fillText(banner, W / 2, H * .55); ctx.restore(); }
    if (paused && running) { ctx.fillStyle = 'rgba(2,5,14,.62)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.font = '900 22px ui-monospace, monospace'; ctx.fillStyle = '#fff'; ctx.fillText('PAUSA', W / 2, H / 2); }
  }

  function frame(ts) { const dt = Math.min(.033, Math.max(0, (ts - last) / 1000 || 0)); last = ts; update(dt); draw(); requestAnimationFrame(frame); }
  function pointerPos(e) { const rect = canvas.getBoundingClientRect(); return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) }; }
  function setAim(e) { const p = pointerPos(e); aimX = clamp(p.x, R, W - R); aimY = Math.min(launcherY - 40, p.y); }

  canvas.addEventListener('pointerdown', e => { if (!running || paused || moving) return; e.preventDefault(); aiming = true; canvas.setPointerCapture?.(e.pointerId); setAim(e); ensureAudio(); });
  canvas.addEventListener('pointermove', e => { if (!aiming) return; e.preventDefault(); setAim(e); });
  canvas.addEventListener('pointerup', e => { if (!aiming) return; e.preventDefault(); setAim(e); aiming = false; shoot(); });
  canvas.addEventListener('pointercancel', () => { aiming = false; });

  startBtn.addEventListener('click', () => { ensureAudio(); resetGame(); running = true; paused = false; startBtn.textContent = 'GIOCA'; overlay.classList.remove('visible'); pauseBtn.textContent = 'Ⅱ'; last = performance.now(); });
  pauseBtn.addEventListener('click', () => { if (!running) return; paused = !paused; aiming = false; pauseBtn.textContent = paused ? '▶' : 'Ⅱ'; if (!paused) last = performance.now(); });
  muteBtn.addEventListener('click', () => { muted = !muted; muteBtn.textContent = muted ? '🔇' : '🔊'; if (!muted) ensureAudio(); });

  window.addEventListener('rwg:continue-game', e => {
    score = Math.max(0, Math.floor(e.detail?.score ?? score)); misses = 0; moving = null; aiming = false;
    pressureElapsed = 0; pressureDue = false; pressurePulse = 0;
    const dangerY = launcherY - R * 3.4;
    let guard = 0;
    while (guard++ < 20) {
      let maxRow = -1, dangerous = false;
      for (const b of grid.values()) { maxRow = Math.max(maxRow, b.r); if (cellPos(b.r, b.c).y + R >= dangerY - R * 1.15) dangerous = true; }
      if (!dangerous) break;
      for (const [k, b] of grid) if (b.r === maxRow) grid.delete(k);
      if (!grid.size) { resetPressure(); spawnBoard(); break; }
    }
    reconcileQueue(); currentShot = makeQueuedShot(); nextShot = makeQueuedShot();
    running = true; paused = false; overlay.classList.remove('visible'); startBtn.textContent = 'RIGIOCA'; pauseBtn.textContent = 'Ⅱ'; banner = 'CONTINUA!'; bannerTime = 1.2; last = performance.now(); updateHud(); ensureAudio(); tone(520, .16, 'triangle', .035, 900);
  });

  window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) { paused = true; aiming = false; pauseBtn.textContent = '▶'; } });

  resize(); updateHud(); draw(); requestAnimationFrame(frame);
})();
