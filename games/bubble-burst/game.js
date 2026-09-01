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
  const levelTimerEl = $('levelTimer');
  const levelClearEl = $('levelClear'), levelClearTitleEl = $('levelClearTitle');
  const clearPointsEl = $('clearPoints'), clearTimeEl = $('clearTime'), clearBonusEl = $('clearBonus'), clearTotalEl = $('clearTotal');

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
  const ORANGE_DEADLINE_MULTIPLIER = 3.5;
  const LEVEL_BONUS_FAST = .50;
  const LEVEL_BONUS_GOOD = .25;
  const LEVEL_CLEAR_CELEBRATION_MS = 2000;
  const RESUME_SCHEMA = 1;

  let W = 390, H = 844, DPR = 1;
  let R = 16, CELL = 32, ROW_H = 28, TOP = 108;
  let launcherX = W / 2, launcherY = H - 96;
  let running = false, paused = false, muted = false, aiming = false;
  let aimX = W / 2, aimY = H * .42, last = 0;
  let score = 0, level = 1, misses = 0, missLimit = 5, colorCount = 4;
  let currentShot = { kind: SHOT_NORMAL, color: PALETTE[0] };
  let nextShot = { kind: SHOT_NORMAL, color: PALETTE[1] };
  let moving = null, banner = '', bannerTime = 0, operatorPulse = 0;
  let crewMood = 'idle', crewMoodTime = 0;
  let poppingShotStreak = 0, rewardBombsPending = 0;
  let boardMeta = null, backgroundCache = null, audio = null;
  let pressureRows = 0, pressureElapsed = 0, pressureInterval = PRESSURE_START_SECONDS, pressureDue = false, pressurePulse = 0;
  let levelElapsed = 0, levelStartScore = 0, lastTimerCentis = -1;
  let levelClearActive = false, levelClearReadyAt = 0, levelClearCelebrationStartedAt = 0, levelClearPanelShown = false;
  let best = Number(localStorage.getItem('bubbleBurstBest') || 0);

  const grid = new Map();
  const particles = [];
  const falling = [];
  const bubbleSprites = new Map();
  const CREW_POSES = Object.freeze({ idle: 0, joy: 1, fear: 2, sad: 3 });
  const LEVEL_CLEAR_JUMP_FRAMES = Object.freeze({
    operator: Object.freeze([
      Object.freeze([0, 0, 10, -.08, .92, 1.08]),
      Object.freeze([.16, -5, -27, .10, 1.08, .92]),
      Object.freeze([.34, 4, -70, -.12, .96, 1.08]),
      Object.freeze([.52, 9, -48, .09, 1.03, .97]),
      Object.freeze([.70, -3, -75, -.08, .98, 1.06]),
      Object.freeze([.86, -7, -22, .05, 1.08, .91]),
      Object.freeze([1, 0, 0, 0, 1, 1])
    ]),
    loader: Object.freeze([
      Object.freeze([0, 0, 12, .08, .91, 1.09]),
      Object.freeze([.14, 6, -24, -.11, 1.09, .91]),
      Object.freeze([.32, -5, -64, .13, .96, 1.09]),
      Object.freeze([.50, -10, -43, -.10, 1.04, .96]),
      Object.freeze([.69, 4, -71, .09, .97, 1.07]),
      Object.freeze([.85, 7, -20, -.05, 1.09, .91]),
      Object.freeze([1, 0, 0, 0, 1, 1])
    ])
  });
  const CREW_EYES = Object.freeze({
    operator: Object.freeze({
      idle: [[146, 236], [204, 219]], joy: [[116, 225], [180, 210]],
      fear: [[108, 233], [172, 220]], sad: [[83, 260], [147, 247]]
    }),
    loader: Object.freeze({
      idle: [[104, 229], [163, 240]], joy: [[106, 228], [170, 214]],
      fear: [[100, 234], [163, 223]], sad: [[80, 260], [143, 248]]
    })
  });
  const crewSheets = Object.create(null);
  let crewSheetsReady = 0;
  let lastAimFocus = { x: launcherX, y: TOP };

  const key = (r, c) => `${r},${c}`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const markSessionDirty = reason => window.RWGSession?.markDirty?.(reason);
  for (const role of ['operator', 'loader']) {
    const image = new Image(); image.decoding = 'async'; let ready = false;
    const markReady = () => { if (!ready && image.naturalWidth) { ready = true; crewSheetsReady++; } };
    image.src = `../../assets/sprites/bubble-burst/${role}-sheet.png?v=20260831.5`;
    image.decode().then(markReady, () => image.complete ? markReady() : image.addEventListener('load', markReady, { once: true }));
    crewSheets[role] = image;
  }
  const pressureIntervalFor = lvl => Math.max(PRESSURE_MIN_SECONDS, PRESSURE_START_SECONDS * Math.pow(PRESSURE_DECAY, Math.max(0, lvl - 1)));
  const pressureStepFor = lvl => Math.min(PRESSURE_MAX_ROWS, PRESSURE_START_ROWS + Math.max(0, lvl - 1) * PRESSURE_ROW_GROWTH);
  const ceilingY = () => TOP + pressureRows * ROW_H;

  function formatLevelTime(seconds) {
    const centis = Math.max(0, Math.floor(seconds * 100));
    const minutes = Math.floor(centis / 6000);
    const secs = Math.floor((centis % 6000) / 100);
    const cs = centis % 100;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  function timerTier(seconds = levelElapsed) {
    const optimal = Math.max(1, Number(boardMeta?.optimalSeconds) || 60);
    if (seconds <= optimal) return 'green';
    if (seconds <= optimal * ORANGE_DEADLINE_MULTIPLIER) return 'orange';
    return 'red';
  }

  function updateLevelTimer(force = false) {
    if (!levelTimerEl) return;
    const centis = Math.floor(levelElapsed * 100);
    if (!force && centis === lastTimerCentis) return;
    lastTimerCentis = centis;
    const tier = timerTier();
    levelTimerEl.textContent = formatLevelTime(levelElapsed);
    levelTimerEl.className = `is-${tier}`;
    const optimal = Math.max(1, Number(boardMeta?.optimalSeconds) || 60);
    levelTimerEl.setAttribute('aria-label', `Tempo livello ${formatLevelTime(levelElapsed)}. Tempo ottimale ${formatLevelTime(optimal)}.`);
    levelTimerEl.title = `Tempo ottimale: ${formatLevelTime(optimal)} • soglia +25%: ${formatLevelTime(optimal * ORANGE_DEADLINE_MULTIPLIER)}`;
  }

  function resetLevelMetrics() {
    levelElapsed = 0;
    levelStartScore = score;
    lastTimerCentis = -1;
    updateLevelTimer(true);
  }

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
    TOP = Math.max(106, H * .13);
    launcherX = W / 2; launcherY = H - Math.max(96, H * .115);
    aimX = clamp(aimX, R, W - R); aimY = Math.min(launcherY - 45, aimY);
    bubbleSprites.clear(); for (const color of PALETTE) makeBubbleSprite(color); backgroundCache = buildBackgroundCache();
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

  function applyPendingBombReward() {
    while (rewardBombsPending > 0) {
      if (currentShot.kind === SHOT_NORMAL) currentShot = { kind: SHOT_BOMB, color: currentShot.color };
      else if (nextShot.kind === SHOT_NORMAL) nextShot = { kind: SHOT_BOMB, color: nextShot.color };
      else break;
      rewardBombsPending--;
    }
  }

  function registerPoppingShot(popped) {
    if (!popped) { poppingShotStreak = 0; return; }
    poppingShotStreak++;
    if (poppingShotStreak < 5) return;
    poppingShotStreak = 0; rewardBombsPending++; applyPendingBombReward();
    banner = 'COMBO ×5 • BOMBA PRONTA!'; bannerTime = 1.35; tone(1040, .12, 'triangle', .04, 360); navigator.vibrate?.([12, 18, 28]);
  }

  function updateNextPreview() {
    nextDot.className = '';
    nextDot.textContent = '';
    nextDot.style.removeProperty('background');
    nextDot.style.setProperty('--rwg-next-bubble', nextShot.color);
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
      grid.set(key(cell.r, cell.c), { r: cell.r, c: cell.c, color, type: cell.special || STATIC_NORMAL, armor: cell.special === STATIC_ARMOR ? 1 : 0 });
    }
  }

  function hideLevelClear() {
    levelClearActive = false; levelClearReadyAt = 0; levelClearCelebrationStartedAt = 0; levelClearPanelShown = false;
    levelClearEl?.classList.remove('is-visible'); levelClearEl?.setAttribute('aria-hidden', 'true');
  }

  function showLevelClearPanel() {
    if (!levelClearActive || levelClearPanelShown) return;
    levelClearPanelShown = true;
    levelClearEl.classList.remove('is-visible'); levelClearEl.setAttribute('aria-hidden', 'false');
    void levelClearEl.offsetWidth; levelClearEl.classList.add('is-visible');
  }

  function resetGame() {
    score = 0; level = 1; misses = 0; missLimit = 5; moving = null; aiming = false;
    particles.length = 0; falling.length = 0; operatorPulse = 0; crewMood = 'idle'; crewMoodTime = 0; poppingShotStreak = 0; rewardBombsPending = 0;
    hideLevelClear(); resetPressure(); spawnBoard(); resetLevelMetrics();
    currentShot = makeQueuedShot(); nextShot = makeQueuedShot();
    banner = `LIVELLO 001 • ${boardMeta.name}`; bannerTime = 1.6; updateHud();
  }

  function updateHud() {
    scoreEl.textContent = score.toLocaleString('it-IT'); levelEl.textContent = level; missesEl.textContent = `${misses}/${missLimit}`;
    bestEl.textContent = best.toLocaleString('it-IT'); updateNextPreview(); updateLevelTimer();
  }

  function burst(x, y, color, count = 10, speed = 140) {
    const room = Math.max(0, 460 - particles.length); count = Math.min(count, room);
    for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * speed; particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: .35 + Math.random() * .45, max: .8, size: 1.5 + Math.random() * 3 }); }
  }

  function aimVector() {
    const dx = aimX - launcherX, dy = Math.min(-40, aimY - launcherY); let angle = Math.atan2(dy, dx); angle = clamp(angle, -Math.PI + .24, -.24);
    return { x: Math.cos(angle), y: Math.sin(angle), angle };
  }

  function shoot() {
    if (!running || paused || moving || levelClearActive) return;
    const v = aimVector(), baseSpeed = Math.min(720, 535 + level * .85 + H * .05), speed = baseSpeed * 3;
    moving = { x: launcherX + v.x * (R + 16), y: launcherY + v.y * (R + 16), vx: v.x * speed, vy: v.y * speed, renderTrail: [], ...currentShot };
    currentShot = nextShot; nextShot = makeQueuedShot(); applyPendingBombReward(); operatorPulse = .18;
    updateHud(); tone(moving.kind === SHOT_BOMB ? 320 : moving.kind === SHOT_COLOR_CLEAR ? 820 : 520, .055, 'triangle', .028, 180);
  }

  function findNearestEmpty(x, y) {
    const baseR = Math.max(0, Math.round((y - ceilingY() - R) / ROW_H)); let bestCell = null, bestDist = Infinity;
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
    const target = targetColor || start.color, queue = [[startR, startC]], seen = new Set([key(startR, startC)]), out = [];
    for (let qi = 0; qi < queue.length; qi++) {
      const [r, c] = queue[qi], b = grid.get(key(r, c)); if (!b || (b.type !== STATIC_PRISM && b.color !== target)) continue;
      out.push([r, c]);
      for (const [nr, nc] of neighbors(r, c)) { const nk = key(nr, nc), nb = grid.get(nk); if (!seen.has(nk) && nb && (nb.type === STATIC_PRISM || nb.color === target)) { seen.add(nk); queue.push([nr, nc]); } }
    }
    return out;
  }

  function removeCells(cells, pointsPer = 35, force = false) {
    const pending = [...cells], queued = new Set(pending.map(([r, c]) => key(r, c))), starBursts = []; let removed = 0;
    for (let i = 0; i < pending.length; i++) {
      const [r, c] = pending[i], k = key(r, c), b = grid.get(k); if (!b) continue; const p = cellPos(r, c);
      if (b.type === STATIC_ARMOR && b.armor > 0 && !force) { b.armor = 0; b.type = STATIC_NORMAL; score += Math.round(pointsPer * .55); burst(p.x, p.y, '#d9ecff', 9, 105); tone(185, .05, 'square', .02, 80); continue; }
      grid.delete(k); removed++; score += pointsPer + (b.type === STATIC_STAR ? 55 : b.type === STATIC_PRISM ? 35 : b.type === STATIC_ARMOR ? 25 : 0);
      burst(p.x, p.y, b.type === STATIC_PRISM ? '#f4ecff' : b.color, b.type === STATIC_STAR ? 18 : 10, b.type === STATIC_STAR ? 190 : 145); if (b.type === STATIC_STAR) starBursts.push([r, c]);
    }
    for (const [sr, sc] of starBursts) for (const [nr, nc] of neighbors(sr, sc)) { const nk = key(nr, nc); if (queued.has(nk) || !grid.has(nk)) continue; queued.add(nk); pending.push([nr, nc]); }
    if (starBursts.length) {
      for (let i = cells.length; i < pending.length; i++) { const [r, c] = pending[i], k = key(r, c), b = grid.get(k); if (!b) continue; const p = cellPos(r, c); grid.delete(k); removed++; score += Math.round(pointsPer * .8); burst(p.x, p.y, '#ffe66d', 10, 170); }
      tone(860, .09, 'triangle', .035, -260);
    }
    return removed;
  }

  function dropDisconnected() {
    const anchored = new Set(), queue = [];
    for (let c = 0; c < COLS; c++) { const k = key(0, c); if (validCell(0, c) && grid.has(k)) { anchored.add(k); queue.push([0, c]); } }
    for (let qi = 0; qi < queue.length; qi++) { const [r, c] = queue[qi]; for (const [nr, nc] of neighbors(r, c)) { const nk = key(nr, nc); if (grid.has(nk) && !anchored.has(nk)) { anchored.add(nk); queue.push([nr, nc]); } } }
    let dropped = 0;
    for (const [k, b] of grid) { if (anchored.has(k)) continue; const p = cellPos(b.r, b.c); falling.push({ x: p.x, y: p.y, color: b.color, type: b.type, armor: b.armor, vx: (Math.random() - .5) * 90, vy: 35 + Math.random() * 60 }); grid.delete(k); score += 55; dropped++; }
    if (falling.length > 180) falling.splice(0, falling.length - 180); return dropped;
  }

  function addPenaltyRow() {
    const shifted = new Map();
    for (const b of grid.values()) { const nr = b.r + 1; if (validCell(nr, b.c)) shifted.set(key(nr, b.c), { ...b, r: nr }); }
    grid.clear(); for (const [k, b] of shifted) grid.set(k, b);
    for (let c = 0; c < COLS; c++) { if (!validCell(0, c)) continue; const color = PALETTE[Math.floor(Math.random() * colorCount)]; grid.set(key(0, c), { r: 0, c, color, type: STATIC_NORMAL, armor: 0 }); }
    misses = 0; banner = 'PRESSIONE +1 • NUOVA RIGA!'; bannerTime = 1.15; tone(135, .16, 'sawtooth', .035, -55); navigator.vibrate?.(35);
  }

  function reconcileQueue() {
    const colors = activeColors(); if (!colors.includes(currentShot.color)) currentShot.color = pickColor(); if (!colors.includes(nextShot.color)) nextShot.color = pickColor();
  }

  function levelBonusRate() {
    const optimal = Math.max(1, Number(boardMeta?.optimalSeconds) || 60); if (levelElapsed <= optimal) return LEVEL_BONUS_FAST; if (levelElapsed <= optimal * ORANGE_DEADLINE_MULTIPLIER) return LEVEL_BONUS_GOOD; return 0;
  }

  function completeLevel() {
    if (levelClearActive || !running) return;
    setCrewMood('joy', 2.2);
    const clearAward = 700 + Math.min(2300, (level + 1) * 22); score += clearAward;
    const levelPoints = Math.max(0, score - levelStartScore), bonusRate = levelBonusRate(), bonusPoints = Math.round(levelPoints * bonusRate), levelTotal = levelPoints + bonusPoints; score += bonusPoints; updateHud();
    levelClearActive = true; paused = true; aiming = false; moving = null; levelClearCelebrationStartedAt = performance.now(); levelClearPanelShown = false; levelClearReadyAt = levelClearCelebrationStartedAt + LEVEL_CLEAR_CELEBRATION_MS + 2200;
    levelClearTitleEl.textContent = `LIVELLO ${level} COMPLETATO!`; clearPointsEl.textContent = `Punti livello: ${levelPoints.toLocaleString('it-IT')}`; clearTimeEl.textContent = `Tempo: ${formatLevelTime(levelElapsed)}`;
    clearBonusEl.textContent = bonusRate > 0 ? `Bonus: +${Math.round(bonusRate * 100)}% (+${bonusPoints.toLocaleString('it-IT')})` : 'Bonus: NO BONUS!'; clearTotalEl.textContent = `Totale: ${levelTotal.toLocaleString('it-IT')} punti!`;
    levelClearEl.classList.remove('is-visible'); levelClearEl.setAttribute('aria-hidden', 'true');
    window.RWGSession?.saveNow?.('level-clear');
    tone(620, .09, 'square', .03, 260); setTimeout(() => tone(760, .08, 'square', .03, 220), 360); setTimeout(() => tone(920, .09, 'triangle', .035, 320), 720); setTimeout(() => tone(bonusRate ? 1180 : 330, .13, bonusRate ? 'triangle' : 'square', .04, bonusRate ? 420 : -70), 1320);
    navigator.vibrate?.(bonusRate === LEVEL_BONUS_FAST ? [20, 25, 20, 25, 45] : [18, 25, 35]);
  }

  function finishResolution({ resetMisses = true } = {}) {
    if (resetMisses) misses = 0; markSessionDirty('shot-resolved');
    if (!grid.size) { completeLevel(); return; } reconcileQueue(); updateHud(); checkDanger();
  }

  function resolveNormalShot(cell) {
    const matches = component(cell.r, cell.c, grid.get(key(cell.r, cell.c))?.color);
    if (matches.length >= 3) { const removed = removeCells(matches, 35, false), dropped = dropDisconnected(); setCrewMood('joy', dropped ? 1.35 : .9); score += Math.max(0, matches.length - 3) * 15; tone(640, .09, 'triangle', .04, 280); if (dropped) tone(330, .14, 'sine', .035, -110); registerPoppingShot(removed > 0); finishResolution({ resetMisses: removed > 0 || matches.length >= 3 }); }
    else { setCrewMood('sad', 1.05); registerPoppingShot(false); misses++; tone(210, .04, 'square', .018, -35); if (misses >= missLimit) addPenaltyRow(); if (!grid.size) completeLevel(); else { reconcileQueue(); updateHud(); checkDanger(); markSessionDirty('miss'); } }
  }

  function resolveBomb(hit) {
    const hp = hit ? cellPos(hit.r, hit.c) : { x: moving.x, y: moving.y }, radius = CELL * 1.55, cells = [];
    for (const b of nearbyBubbles(hp.x, hp.y, 2)) { const p = cellPos(b.r, b.c); if ((p.x - hp.x) ** 2 + (p.y - hp.y) ** 2 <= radius * radius) cells.push([b.r, b.c]); }
    moving = null; const removed = removeCells(cells, 48, true), dropped = dropDisconnected(); setCrewMood(removed > 0 ? 'joy' : 'sad', removed > 0 ? 1.25 : .9); burst(hp.x, hp.y, '#ff934f', 34, 260); tone(110, .14, 'sawtooth', .05, 420); navigator.vibrate?.([22, 18, 35]); if (dropped) score += dropped * 18; registerPoppingShot(removed > 0); finishResolution();
  }

  function resolveColorClear(hit) {
    const targetColor = hit?.color || moving.color || pickColor(), cells = []; for (const b of grid.values()) if (b.color === targetColor) cells.push([b.r, b.c]);
    const x = hit ? cellPos(hit.r, hit.c).x : moving.x, y = hit ? cellPos(hit.r, hit.c).y : moving.y; moving = null;
    const removed = removeCells(cells, 42, true), dropped = dropDisconnected(); setCrewMood(removed > 0 ? 'joy' : 'sad', removed > 0 ? 1.25 : .9); score += removed * 8; burst(x, y, targetColor, 30, 230); tone(980, .14, 'triangle', .045, -450); navigator.vibrate?.([12, 12, 12]); if (dropped) score += dropped * 18; registerPoppingShot(removed > 0); finishResolution();
  }

  function attachNormal() {
    if (!moving) return; const cell = findNearestEmpty(moving.x, moving.y); if (!cell) { endGame(); return; }
    const p = cellPos(cell.r, cell.c), color = moving.color; moving = null; grid.set(key(cell.r, cell.c), { r: cell.r, c: cell.c, color, type: STATIC_NORMAL, armor: 0 }); burst(p.x, p.y, color, 5, 65); tone(360, .035, 'sine', .018, 60); resolveNormalShot(cell);
  }
  function resolveImpact(hit = null) { if (!moving) return; if (hit && moving.kind === SHOT_BOMB) { resolveBomb(hit); return; } if (hit && moving.kind === SHOT_COLOR_CLEAR) { resolveColorClear(hit); return; } attachNormal(); }

  function startNextLevel() {
    hideLevelClear(); level++; misses = 0; missLimit = level >= 80 ? 3 : level >= 28 ? 4 : 5; resetPressure(); spawnBoard(); resetLevelMetrics(); currentShot = makeQueuedShot(); nextShot = makeQueuedShot();
    const intro = level === 8 ? 'ARMOR BUBBLES!' : level === 18 ? 'STAR BUBBLES!' : level === 35 ? 'PRISM BUBBLES!' : null;
    banner = intro || `LIVELLO ${String(level).padStart(3, '0')} • ${boardMeta.name}`; bannerTime = intro ? 2 : 1.5; paused = false; tone(480, .18, 'triangle', .045, 480); updateHud(); last = performance.now(); markSessionDirty('next-level');
  }

  function checkDanger() {
    const dangerY = launcherY - R * 3.4; for (const b of grid.values()) if (cellPos(b.r, b.c).y + R >= dangerY) { endGame(); return true; } return false;
  }

  function applyPressureDrop() {
    pressureDue = false; pressureElapsed = 0; pressureRows += pressureStepFor(level); pressurePulse = .85; setCrewMood('fear', 1.3); banner = '↓ STRUTTURA IN DISCESA!'; bannerTime = 1.15; tone(128, .13, 'sawtooth', .032, -40); navigator.vibrate?.([18, 22, 28]); markSessionDirty('pressure'); checkDanger();
  }
  function updatePressure(dt) { pressureElapsed += dt; pressurePulse = Math.max(0, pressurePulse - dt); if (pressureElapsed >= pressureInterval) pressureDue = true; if (pressureDue && !moving) applyPressureDrop(); }

  function endGame() {
    if (!running || levelClearActive) return; running = false; paused = false; aiming = false; moving = null; best = Math.max(best, score); localStorage.setItem('bubbleBurstBest', String(best)); updateHud();
    overlayText.innerHTML = `Le bolle hanno raggiunto la linea di pericolo.<br>Punteggio <strong>${score.toLocaleString('it-IT')}</strong> • livello ${level}.`; startBtn.textContent = 'RIGIOCA'; overlay.classList.add('visible'); pauseBtn.textContent = 'Ⅱ'; tone(95, .25, 'sawtooth', .05, -55);
    const detail = { game: 'Bubble Burst', score, level, best, layout: boardMeta?.id || level, levelTime: levelElapsed }; window.dispatchEvent(new CustomEvent('rwg:game-ended', { detail })); requestAnimationFrame(() => window.RWGGameOver?.open?.(detail));
  }

  function collisionBubble(x, y) {
    let closest = null, bestD = Infinity; for (const b of nearbyBubbles(x, y, 2)) { const p = cellPos(b.r, b.c), d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d <= (R * 1.88) ** 2 && d < bestD) { bestD = d; closest = b; } } return closest;
  }

  function updateMoving(dt) {
    if (!moving) return; const renderTrail = moving.renderTrail || (moving.renderTrail = []); renderTrail.length = 0; renderTrail.push(moving.x, moving.y);
    const distance = Math.hypot(moving.vx, moving.vy) * dt, steps = Math.max(1, Math.ceil(distance / Math.max(4, R * .75))), stepDt = dt / steps;
    for (let step = 0; step < steps && moving; step++) {
      moving.x += moving.vx * stepDt; moving.y += moving.vy * stepDt;
      if (moving.x <= R) { moving.x = R; moving.vx = Math.abs(moving.vx); tone(290, .025, 'square', .012, 30); }
      else if (moving.x >= W - R) { moving.x = W - R; moving.vx = -Math.abs(moving.vx); tone(290, .025, 'square', .012, 30); }
      renderTrail.push(moving.x, moving.y); const hit = collisionBubble(moving.x, moving.y); if (hit) { resolveImpact(hit); return; }
      const top = ceilingY(); if (moving.y - R <= top) { moving.y = top + R; resolveImpact(null); return; }
    }
  }

  function update(dt) {
    if (!running || paused || levelClearActive) return; levelElapsed += dt; updateLevelTimer(); updateMoving(dt); if (!running || paused || levelClearActive) return; updatePressure(dt); if (!running || paused || levelClearActive) return;
    bannerTime = Math.max(0, bannerTime - dt); operatorPulse = Math.max(0, operatorPulse - dt); crewMoodTime = Math.max(0, crewMoodTime - dt);
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(.08, dt); p.vy *= Math.pow(.08, dt); p.life -= dt; if (p.life <= 0) particles.splice(i, 1); }
    for (let i = falling.length - 1; i >= 0; i--) { const b = falling[i]; b.vy += 720 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.y > H + R * 3) falling.splice(i, 1); }
  }

  function mixBubbleColor(color, target, amount) {
    const parse = value => {
      const hex = /^#([0-9a-f]{6})$/i.exec(value)?.[1] || '65e7ff';
      return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)];
    };
    const source = parse(color), destination = parse(target);
    const channel = index => Math.round(source[index] + (destination[index] - source[index]) * amount);
    return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`;
  }

  function makeBubbleSprite(color, type = STATIC_NORMAL, armor = 0) {
    const cacheKey = `${color}|${type}|${armor}`; if (bubbleSprites.has(cacheKey)) return bubbleSprites.get(cacheKey);
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d'), x = 48, y = 48, rr = 34;
    const normalColor = /^#[0-9a-f]{6}$/i.test(color) ? color : PALETTE[0];
    const glowColor = type === STATIC_PRISM || type === SHOT_COLOR_CLEAR ? '#d586ff' : type === SHOT_BOMB ? '#ff5f73' : normalColor;

    g.save();
    g.shadowBlur = 16; g.shadowColor = glowColor; g.fillStyle = glowColor;
    g.globalAlpha = .34; g.beginPath(); g.arc(x, y, rr + 1, 0, Math.PI * 2); g.fill();
    g.restore();

    const sphere = g.createRadialGradient(34, 29, 2, 51, 52, 39);
    if (type === SHOT_BOMB) {
      sphere.addColorStop(0, '#fff7d7'); sphere.addColorStop(.10, '#ffcb65'); sphere.addColorStop(.36, '#ff704f'); sphere.addColorStop(.68, '#bd254f'); sphere.addColorStop(1, '#250619');
    } else if (type === SHOT_COLOR_CLEAR || type === STATIC_PRISM) {
      sphere.addColorStop(0, '#ffffff'); sphere.addColorStop(.14, '#8ff5ff'); sphere.addColorStop(.36, '#6f8cff'); sphere.addColorStop(.58, '#f05fe8'); sphere.addColorStop(.79, '#ffd85b'); sphere.addColorStop(1, '#3a147c');
    } else {
      sphere.addColorStop(0, '#ffffff');
      sphere.addColorStop(.09, mixBubbleColor(normalColor, '#ffffff', .78));
      sphere.addColorStop(.30, mixBubbleColor(normalColor, '#ffffff', .24));
      sphere.addColorStop(.62, normalColor);
      sphere.addColorStop(.84, mixBubbleColor(normalColor, '#071126', .58));
      sphere.addColorStop(1, mixBubbleColor(normalColor, '#02040c', .86));
    }
    g.fillStyle = sphere; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();

    g.save();
    g.beginPath(); g.arc(x, y, rr - .7, 0, Math.PI * 2); g.clip();
    g.globalCompositeOperation = 'screen';
    const specular = g.createRadialGradient(33, 27, 0, 34, 28, 16);
    specular.addColorStop(0, 'rgba(255,255,255,.98)'); specular.addColorStop(.18, 'rgba(255,255,255,.88)'); specular.addColorStop(.48, 'rgba(255,255,255,.22)'); specular.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = specular; g.fillRect(16, 10, 38, 38);
    const bounce = g.createRadialGradient(57, 65, 0, 57, 65, 25);
    bounce.addColorStop(0, 'rgba(255,255,255,.26)'); bounce.addColorStop(.42, 'rgba(255,255,255,.08)'); bounce.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = bounce; g.fillRect(30, 39, 54, 48);
    g.restore();

    const rim = g.createLinearGradient(24, 20, 72, 76);
    rim.addColorStop(0, 'rgba(255,255,255,.88)'); rim.addColorStop(.34, 'rgba(255,255,255,.34)'); rim.addColorStop(.7, 'rgba(255,255,255,.08)'); rim.addColorStop(1, 'rgba(3,8,24,.78)');
    g.strokeStyle = rim; g.lineWidth = 2.2; g.beginPath(); g.arc(x, y, rr - 1.1, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.42)'; g.lineWidth = 1.7; g.beginPath(); g.arc(x, y, rr - 5, 3.72, 5.05); g.stroke();

    if (type === STATIC_ARMOR && armor > 0) { g.strokeStyle = '#e8f1ff'; g.lineWidth = 5; g.beginPath(); g.arc(x, y, rr - 5, .2, 2.75); g.stroke(); g.beginPath(); g.arc(x, y, rr - 5, 3.25, 5.8); g.stroke(); g.fillStyle = '#91a9c2'; [[24,43],[67,40],[43,20],[47,68]].forEach(([px,py])=>g.fillRect(px,py,6,6)); }
    else if (type === STATIC_STAR) { g.fillStyle = '#fff6a8'; g.shadowBlur = 7; g.shadowColor = '#ffe66d'; const pts=[[48,23],[53,40],[70,40],[56,50],[62,67],[48,57],[34,67],[40,50],[26,40],[43,40]]; g.beginPath(); pts.forEach(([px,py],i)=>i?g.lineTo(px,py):g.moveTo(px,py)); g.closePath(); g.fill(); g.shadowBlur = 0; }
    else if (type === STATIC_PRISM || type === SHOT_COLOR_CLEAR) { g.strokeStyle = '#fff'; g.shadowBlur = 8; g.shadowColor = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(48,23); g.lineTo(69,48); g.lineTo(48,73); g.lineTo(27,48); g.closePath(); g.stroke(); g.shadowBlur = 0; }
    else if (type === SHOT_BOMB) { g.fillStyle = '#fff0cb'; g.fillRect(42,42,12,12); g.fillStyle = '#ffdf5d'; g.fillRect(61,18,6,11); g.fillRect(66,14,6,6); }
    bubbleSprites.set(cacheKey, c); return c;
  }
  function drawBubble(x, y, color, radius = R, type = STATIC_NORMAL, armor = 0) { const sprite = makeBubbleSprite(color, type, armor), d = radius * 2.7; ctx.drawImage(sprite, x - d / 2, y - d / 2, d, d); }
  function drawMovingBubble() {
    if (!moving) return; const trail = moving.renderTrail;
    if (trail?.length >= 4) { const samples = trail.length / 2, stride = Math.max(1, Math.ceil((samples - 1) / 3)); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = .16; ctx.strokeStyle = moving.kind === SHOT_BOMB ? '#ff934f' : moving.kind === SHOT_COLOR_CLEAR ? '#ffffff' : moving.color; ctx.lineWidth = Math.max(5, R * .9); ctx.shadowBlur = R; ctx.shadowColor = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(trail[0], trail[1]); for (let i = 2; i < trail.length; i += 2) ctx.lineTo(trail[i], trail[i + 1]); ctx.stroke(); ctx.shadowBlur = 0; for (let sample = stride; sample < samples - 1; sample += stride) { const progress = sample / (samples - 1); ctx.globalAlpha = .05 + progress * .1; drawBubble(trail[sample * 2], trail[sample * 2 + 1], moving.color, R * (.62 + progress * .2), moving.kind, 0); } ctx.restore(); }
    drawBubble(moving.x, moving.y, moving.color, R, moving.kind, 0); if (moving) moving.renderTrail.length = 0;
  }

  function roundedRectPath(g, x, y, w, h, radius) { const r = Math.min(radius, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }

  function setCrewMood(mood, duration) {
    crewMood = CREW_POSES[mood] === undefined ? 'idle' : mood;
    crewMoodTime = Math.max(crewMoodTime, duration);
  }
  function currentCrewMood() {
    const remaining = pressureInterval - pressureElapsed;
    if (crewMoodTime > 0) return crewMood;
    return misses >= Math.max(1, missLimit - 1) || pressureDue || remaining <= 6 ? 'fear' : 'idle';
  }
  function drawTrackedEyes(g, gaze, role, mood) {
    const iris = role === 'operator' ? '#7b3cff' : '#087da8';
    const eyes = CREW_EYES[role][mood] || CREW_EYES[role].idle;
    for (const [x, y] of eyes) {
      const px = x - 128 + gaze.x * 9, py = y + gaze.y * 7;
      g.fillStyle = iris; g.beginPath(); g.ellipse(px, py, 12, 14, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#10162b'; g.beginPath(); g.ellipse(px, py + 1, 6.5, 8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(px - 3.2, py - 4.2, 3, 0, Math.PI * 2); g.fill();
    }
  }
  function predictAimTrajectory(){const v=aimVector();let x=launcherX+v.x*(R+20),y=launcherY+v.y*(R+20),vx=v.x,vy=v.y;const points=[{x,y}],step=13,top=ceilingY();let firstBounce=null,impact=null;for(let i=0;i<46;i++){x+=vx*step;y+=vy*step;if(x<=R){x=R;vx=Math.abs(vx);firstBounce||={x,y,type:'bounce'};}else if(x>=W-R){x=W-R;vx=-Math.abs(vx);firstBounce||={x,y,type:'bounce'};}const hit=collisionBubble(x,y),reachedTop=y<=top+R;points.push({x,y});if(hit||reachedTop){impact={x,y,type:hit?'attach':'ceiling',hit};break;}}return{points,firstBounce,impact,fallback:points[points.length-1]};}
  function predictAimFocusPoint(prediction=predictAimTrajectory()){return prediction.firstBounce||prediction.impact||prediction.fallback||{x:launcherX,y:TOP};}
  function drawMangaChibiCharacter(role, centerX, topY, width, height, focusPoint, mood, now) {
    const sprite = crewSheets[role]; if (!sprite?.complete || !sprite.naturalWidth) return;
    const eyeY = topY + height * .45, dx = focusPoint.x - centerX, dy = Math.min(-10, focusPoint.y - eyeY), magnitude = Math.max(1, Math.hypot(dx, dy));
    const gaze = { x: clamp(dx / magnitude, -1, 1), y: clamp(dy / magnitude, -1, -.18) }, rolePhase = role === 'operator' ? 0 : Math.PI;
    const breath = Math.sin(now * .0035 + rolePhase), joyBounce = mood === 'joy' ? Math.abs(Math.sin(now * .013 + rolePhase)) * 2.4 : 0;
    const fearShake = mood === 'fear' ? Math.sin(now * .045 + rolePhase) * .9 : 0, sadDrop = mood === 'sad' ? 2 : 0;
    const turn = gaze.x * (role === 'operator' ? .045 : .038), sourceX = CREW_POSES[mood] * 256;
    ctx.save(); ctx.translate(centerX + fearShake, topY - joyBounce + sadDrop); ctx.rotate(turn + fearShake * .004);
    ctx.scale(width / 256 * (1 - breath * .008), height / 512 * (1 + breath * .014));
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(sprite, sourceX, 0, 256, 512, -128, 0, 256, 512);
    drawTrackedEyes(ctx, gaze, role, mood); ctx.restore();
  }
  function drawMangaChibiCrew(focusPoint) {
    const sizeW = clamp(W * .16, 50, 68), sizeH = sizeW * 2, off = clamp(W * .22, 68, 92), now = performance.now();
    const breathBob = Math.sin(now * .0035) * 1.2, recoil = operatorPulse > 0 ? Math.sin((1 - operatorPulse / .18) * Math.PI) * 4 : 0, mood = currentCrewMood();
    const operatorX = launcherX - off, loaderX = launcherX + off, operatorTop = launcherY - sizeH * .78 + breathBob + recoil, loaderTop = launcherY - sizeH * .78 - breathBob;
    if (crewSheetsReady === 2) {
      drawMangaChibiCharacter('operator', operatorX, operatorTop, sizeW, sizeH, focusPoint, mood, now);
      drawMangaChibiCharacter('loader', loaderX, loaderTop, sizeW, sizeH, focusPoint, mood, now);
    }
    drawBubble(loaderX - sizeW * .32, loaderTop + sizeH * .68, nextShot.color, R * .48, nextShot.kind, 0);
  }
  function sampleLevelClearJump(frames, progress) {
    const p = clamp(progress, 0, 1);
    let right = frames.length - 1;
    for (let i = 1; i < frames.length; i++) { if (p <= frames[i][0]) { right = i; break; } }
    const a = frames[Math.max(0, right - 1)], b = frames[right], span = Math.max(.0001, b[0] - a[0]);
    const t = (p - a[0]) / span, eased = t * t * (3 - 2 * t);
    return [a[1] + (b[1] - a[1]) * eased, a[2] + (b[2] - a[2]) * eased, a[3] + (b[3] - a[3]) * eased, a[4] + (b[4] - a[4]) * eased, a[5] + (b[5] - a[5]) * eased];
  }
  function drawStarEye(g, x, y, radius, rotation = 0) {
    g.save(); g.translate(x, y); g.rotate(rotation); g.beginPath();
    for (let i = 0; i < 10; i++) { const angle = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? radius * .43 : radius; const px = Math.cos(angle) * r, py = Math.sin(angle) * r; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.closePath(); g.fillStyle = '#ffe66d'; g.shadowColor = '#ffca3a'; g.shadowBlur = 8; g.fill(); g.restore();
  }
  function drawHeartEye(g, x, y, size, rotation = 0) {
    g.save(); g.translate(x, y); g.rotate(rotation); g.beginPath(); g.moveTo(0, size * .82);
    g.bezierCurveTo(-size * 1.25, size * .08, -size * .78, -size, 0, -size * .28);
    g.bezierCurveTo(size * .78, -size, size * 1.25, size * .08, 0, size * .82);
    g.closePath(); g.fillStyle = '#ff5f9e'; g.shadowColor = '#ff2f83'; g.shadowBlur = 8; g.fill(); g.restore();
  }
  function drawLevelClearEyes(g, role) {
    const eyes = CREW_EYES[role].joy;
    for (let i = 0; i < eyes.length; i++) {
      const x = eyes[i][0] - 128, y = eyes[i][1];
      if (role === 'operator') drawStarEye(g, x, y, 15, i ? .12 : -.12);
      else drawHeartEye(g, x, y, 12, i ? .10 : -.10);
    }
  }
  function drawLevelClearCharacter(role, centerX, topY, width, progress) {
    const sprite = crewSheets[role]; if (!sprite?.complete || !sprite.naturalWidth) return;
    const pose = sampleLevelClearJump(LEVEL_CLEAR_JUMP_FRAMES[role], progress), height = width * 2;
    ctx.save(); ctx.translate(centerX + pose[0], topY + pose[1]); ctx.rotate(pose[2]);
    ctx.scale(width / 256 * pose[3], height / 512 * pose[4]); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sprite, CREW_POSES.joy * 256, 0, 256, 512, -128, 0, 256, 512);
    drawLevelClearEyes(ctx, role); ctx.restore();
  }
  function drawLevelClearCelebration(now) {
    if (!levelClearActive || levelClearPanelShown || !levelClearCelebrationStartedAt) return;
    const progress = clamp((now - levelClearCelebrationStartedAt) / LEVEL_CLEAR_CELEBRATION_MS, 0, 1);
    const intro = clamp(progress / .24, 0, 1), overshoot = 1 + 2.70158 * Math.pow(intro - 1, 3) + 1.70158 * Math.pow(intro - 1, 2);
    const settle = clamp((progress - .24) / .30, 0, 1), titleScale = (.12 + overshoot * 1.08) * (1 - settle) + (1 + Math.sin(progress * Math.PI * 8) * .018) * settle;
    const titleRotation = (-.52 * (1 - intro)) + Math.sin(progress * Math.PI * 5) * .025 * (1 - settle);
    ctx.save(); ctx.fillStyle = 'rgba(2,4,15,.80)'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 30; i++) {
      const phase = progress * (1.8 + i % 4) + i * .173, x = (i * 73.7 + Math.sin(phase * 5) * 22) % W, y = (i * 41.3 + phase * H * .52) % H;
      ctx.globalAlpha = .28 + (i % 5) * .11; ctx.fillStyle = i % 3 === 0 ? '#ffe66d' : i % 3 === 1 ? '#65e7ff' : '#ff5f9e';
      ctx.fillRect(x, y, 2 + i % 3, 2 + i % 3);
    }
    ctx.globalAlpha = Math.min(1, intro * 1.8); ctx.translate(W / 2, H * .32); ctx.rotate(titleRotation); ctx.scale(titleScale, titleScale);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 ' + clamp(W * .078, 25, 34) + 'px ui-monospace, monospace'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#071124'; ctx.lineWidth = 9; ctx.shadowColor = '#65e7ff'; ctx.shadowBlur = 22; ctx.strokeText('LIVELLO', 0, -20); ctx.strokeText('COMPLETATO!', 0, 20);
    const gradient = ctx.createLinearGradient(-W * .32, -35, W * .32, 35); gradient.addColorStop(0, '#65e7ff'); gradient.addColorStop(.48, '#ffffff'); gradient.addColorStop(.72, '#ffe66d'); gradient.addColorStop(1, '#ff5f9e');
    ctx.fillStyle = gradient; ctx.fillText('LIVELLO', 0, -20); ctx.fillText('COMPLETATO!', 0, 20); ctx.restore();
    const crewWidth = clamp(W * .25, 76, 104), crewTop = H * .61;
    if (crewSheetsReady === 2) {
      drawLevelClearCharacter('operator', W * .26, crewTop, crewWidth, progress);
      drawLevelClearCharacter('loader', W * .74, crewTop, crewWidth, progress);
    }
  }
  function updateLevelClearPresentation(now) {
    if (levelClearActive && !levelClearPanelShown && levelClearCelebrationStartedAt && now - levelClearCelebrationStartedAt >= LEVEL_CLEAR_CELEBRATION_MS) showLevelClearPanel();
  }

  function traceAim(prediction){if(!prediction||!running||paused||moving||levelClearActive)return;const{points}=prediction;ctx.save();for(let i=1;i<points.length;i+=2){const p=points[i];ctx.globalAlpha=.7*(1-i/Math.max(56,points.length+10));ctx.fillStyle=currentShot.kind===SHOT_NORMAL?currentShot.color:'#ffffff';ctx.beginPath();ctx.arc(p.x,p.y,2.2,0,Math.PI*2);ctx.fill();}ctx.restore();}
  function drawLauncher(focusPoint){drawMangaChibiCrew(focusPoint);const v=aimVector();ctx.save();ctx.translate(launcherX,launcherY);ctx.rotate(v.angle+Math.PI/2);const g=ctx.createLinearGradient(-8,0,8,0);g.addColorStop(0,'#37445f');g.addColorStop(.45,'#e7f2ff');g.addColorStop(.65,'#65e7ff');g.addColorStop(1,'#3d4c68');ctx.fillStyle=g;ctx.fillRect(-8,-43,16,45);ctx.strokeStyle='rgba(101,231,255,.5)';ctx.lineWidth=1.5;ctx.strokeRect(-8,-43,16,45);ctx.restore();ctx.fillStyle='#18233b';ctx.beginPath();ctx.arc(launcherX,launcherY+3,R+10,Math.PI,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.22)';ctx.stroke();if(!moving)drawBubble(launcherX,launcherY-5,currentShot.color,R,currentShot.kind,0);}

  function buildBackgroundCache(){const c=document.createElement('canvas');c.width=Math.ceil(W);c.height=Math.ceil(H);const g=c.getContext('2d'),grad=g.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#122d54');grad.addColorStop(.46,'#08142d');grad.addColorStop(1,'#03050d');g.fillStyle=grad;g.fillRect(0,0,W,H);for(let i=0;i<70;i++){const x=(i*83.17)%W,y=TOP+((i*47.31)%Math.max(20,launcherY-TOP));g.globalAlpha=.08+(i%5)*.025;g.fillStyle=i%7===0?'#ff5ecf':'#65e7ff';g.fillRect(x,y,i%4===0?2:1,i%4===0?2:1);}g.globalAlpha=.08;g.strokeStyle='#65e7ff';g.lineWidth=1;for(let y=TOP+12;y<launcherY-40;y+=38){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}g.globalAlpha=1;return c;}
  function drawPressureStatus(){if(!running||levelClearActive)return;const remaining=Math.max(0,pressureInterval-pressureElapsed);if(remaining>6&&pressurePulse<=0)return;const dangerY=launcherY-R*3.4,label=pressurePulse>0?'↓ STRUTTURA IN DISCESA':`↓ DISCESA IN ${Math.max(1,Math.ceil(remaining))}s`;ctx.save();ctx.font='900 9px ui-monospace, monospace';ctx.textAlign='center';const width=ctx.measureText(label).width+18,y=dangerY-19;ctx.globalAlpha=pressurePulse>0?.95:.72+Math.sin(performance.now()*.012)*.18;ctx.fillStyle='rgba(44,8,20,.82)';ctx.fillRect(W/2-width/2,y-11,width,17);ctx.fillStyle='#ff9aaa';ctx.fillText(label,W/2,y+1);ctx.restore();}
  function drawBackground(){if(backgroundCache)ctx.drawImage(backgroundCache,0,0,W,H);else{ctx.fillStyle='#071126';ctx.fillRect(0,0,W,H);}const dangerY=launcherY-R*3.4,top=ceilingY();ctx.save();ctx.strokeStyle='rgba(255,230,109,.3)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,top);ctx.lineTo(W,top);ctx.stroke();ctx.setLineDash([5,8]);ctx.strokeStyle='rgba(255,95,115,.42)';ctx.beginPath();ctx.moveTo(0,dangerY);ctx.lineTo(W,dangerY);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(255,95,115,.62)';ctx.font='8px ui-monospace, monospace';ctx.fillText('DANGER',10,dangerY-6);ctx.restore();}
  function draw(now = performance.now()){const aimPrediction=running&&!paused&&!moving&&!levelClearActive?predictAimTrajectory():null;if(aimPrediction)lastAimFocus=predictAimFocusPoint(aimPrediction);ctx.clearRect(0,0,W,H);drawBackground();traceAim(aimPrediction);for(const b of grid.values()){const p=cellPos(b.r,b.c);drawBubble(p.x,p.y,b.color,R,b.type,b.armor);}for(const b of falling)drawBubble(b.x,b.y,b.color,R*.92,b.type,b.armor);drawMovingBubble();drawLauncher(lastAimFocus);for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}ctx.globalAlpha=1;drawPressureStatus();if(bannerTime>0&&running&&!levelClearActive){ctx.save();ctx.globalAlpha=Math.min(1,bannerTime*2);ctx.textAlign='center';ctx.font='900 17px ui-monospace, monospace';ctx.fillStyle='#f7fbff';ctx.shadowBlur=15;ctx.shadowColor='#65e7ff';ctx.fillText(banner,W/2,H*.55);ctx.restore();}if(paused&&running&&!levelClearActive){ctx.fillStyle='rgba(2,5,14,.62)';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.font='900 22px ui-monospace, monospace';ctx.fillStyle='#fff';ctx.fillText('PAUSA',W/2,H/2);}if(levelClearActive&&!levelClearPanelShown)drawLevelClearCelebration(now);}
  function frame(ts){const dt=Math.min(.033,Math.max(0,(ts-last)/1000||0));last=ts;update(dt);updateLevelClearPresentation(ts);draw(ts);requestAnimationFrame(frame);}
  function pointerPos(e){const rect=canvas.getBoundingClientRect();return{x:(e.clientX-rect.left)*(W/rect.width),y:(e.clientY-rect.top)*(H/rect.height)};}
  function setAim(e){const p=pointerPos(e);aimX=clamp(p.x,R,W-R);aimY=Math.min(launcherY-40,p.y);}

  function validShot(s){return Boolean(s&&[SHOT_NORMAL,SHOT_BOMB,SHOT_COLOR_CLEAR].includes(s.kind)&&PALETTE.includes(s.color));}
  function validateResumeState(s){
    if(!s||s.schema!==RESUME_SCHEMA||!Number.isInteger(s.level)||s.level<1||!Number.isInteger(s.misses)||s.misses<0||!Number.isInteger(s.missLimit)||!Number.isInteger(s.colorCount))return false;
    const meta=Levels.getLevel(s.level,COLS),expectedLimit=s.level>=80?3:s.level>=28?4:5;if(s.layoutSignature!==meta.signature||s.colorCount!==meta.colorCount||s.missLimit!==expectedLimit)return false;
    if(![s.score,s.pressureRows,s.pressureElapsed,s.pressureInterval,s.levelElapsed,s.levelStartScore].every(Number.isFinite)||s.score<0||s.pressureRows<0||s.pressureElapsed<0||s.levelElapsed<0||s.levelStartScore<0)return false;
    if(Math.abs(s.pressureInterval-pressureIntervalFor(s.level))>.001||s.pressureRows>100||s.pressureElapsed>s.pressureInterval+300)return false;
    if(!validShot(s.currentShot)||!validShot(s.nextShot)||!Number.isInteger(s.poppingShotStreak)||s.poppingShotStreak<0||s.poppingShotStreak>4||!Number.isInteger(s.rewardBombsPending)||s.rewardBombsPending<0||s.rewardBombsPending>20)return false;
    if(!Array.isArray(s.grid)||new Set(s.grid.map(b=>`${b.r},${b.c}`)).size!==s.grid.length)return false;
    const types=new Set([STATIC_NORMAL,STATIC_ARMOR,STATIC_STAR,STATIC_PRISM]);
    if(s.grid.some(b=>!b||!Number.isInteger(b.r)||b.r<0||!Number.isInteger(b.c)||b.c<0||b.c>=COLS||!PALETTE.includes(b.color)||!types.has(b.type)||![0,1].includes(b.armor)))return false;
    if(!s.levelClearActive&&!s.grid.length)return false;
    if(s.moving!==null&&(!validShot(s.moving)||![s.moving.x,s.moving.y,s.moving.vx,s.moving.vy].every(Number.isFinite)))return false;
    if(typeof s.pressureDue!=='boolean'||typeof s.levelClearActive!=='boolean')return false;
    if(s.levelClearActive&&(!s.clearSummary||['title','points','time','bonus','total'].some(k=>typeof s.clearSummary[k]!=='string')))return false;
    return true;
  }
  function serializeResumeState(){return{schema:RESUME_SCHEMA,layoutSignature:boardMeta?.signature||'',score,level,misses,missLimit,colorCount,currentShot:{...currentShot},nextShot:{...nextShot},moving:moving?{kind:moving.kind,color:moving.color,x:moving.x,y:moving.y,vx:moving.vx,vy:moving.vy}:null,poppingShotStreak,rewardBombsPending,pressureRows,pressureElapsed,pressureInterval,pressureDue,levelElapsed,levelStartScore,levelClearActive,clearSummary:levelClearActive?{title:levelClearTitleEl.textContent,points:clearPointsEl.textContent,time:clearTimeEl.textContent,bonus:clearBonusEl.textContent,total:clearTotalEl.textContent}:null,grid:[...grid.values()].map(b=>({...b}))};}
  function restoreResumeState(s){if(!validateResumeState(s))return false;score=Math.floor(s.score);level=s.level;misses=s.misses;missLimit=s.missLimit;colorCount=s.colorCount;boardMeta=Levels.getLevel(level,COLS);grid.clear();for(const b of s.grid)grid.set(key(b.r,b.c),{...b});currentShot={...s.currentShot};nextShot={...s.nextShot};moving=s.moving?{...s.moving,renderTrail:[]}:null;poppingShotStreak=s.poppingShotStreak;rewardBombsPending=s.rewardBombsPending;pressureRows=s.pressureRows;pressureElapsed=s.pressureElapsed;pressureInterval=s.pressureInterval;pressureDue=s.pressureDue;pressurePulse=0;levelElapsed=s.levelElapsed;levelStartScore=s.levelStartScore;lastTimerCentis=-1;particles.length=0;falling.length=0;operatorPulse=0;aiming=false;running=true;levelClearActive=s.levelClearActive;paused=levelClearActive;resize();if(levelClearActive){levelClearTitleEl.textContent=s.clearSummary.title;clearPointsEl.textContent=s.clearSummary.points;clearTimeEl.textContent=s.clearSummary.time;clearBonusEl.textContent=s.clearSummary.bonus;clearTotalEl.textContent=s.clearSummary.total;levelClearCelebrationStartedAt=0;levelClearPanelShown=true;levelClearReadyAt=performance.now()+500;levelClearEl.setAttribute('aria-hidden','false');levelClearEl.classList.add('is-visible');}else hideLevelClear();overlay.classList.remove('visible');startBtn.textContent='RIGIOCA';pauseBtn.textContent=paused&&!levelClearActive?'▶':'Ⅱ';last=performance.now();updateHud();draw();return true;}
  function startFreshResume(){ensureAudio();window.RWGSession?.clear?.();resetGame();running=true;paused=false;startBtn.textContent='GIOCA';overlay.classList.remove('visible');pauseBtn.textContent='Ⅱ';last=performance.now();markSessionDirty('new-game');}
  const resumeAdapter=Object.freeze({id:'bubble-burst',version:1,compatibility:'bubble-burst-state-v1-layouts200-pressure2-specials1',isInProgress:()=>running,serialize:serializeResumeState,validate:validateResumeState,restore:restoreResumeState,startFresh:startFreshResume,describe:s=>`livello ${s.level} • ${formatLevelTime(s.levelElapsed||0)} • ${Math.floor(s.score||0).toLocaleString('it-IT')} punti`});window.RWGResumeAdapter=resumeAdapter;window.RWGSession?.register?.(resumeAdapter);

  canvas.addEventListener('pointerdown',e=>{if(!running||paused||moving||levelClearActive)return;e.preventDefault();aiming=true;canvas.setPointerCapture?.(e.pointerId);setAim(e);ensureAudio();});
  canvas.addEventListener('pointermove',e=>{if(!aiming)return;e.preventDefault();setAim(e);});
  canvas.addEventListener('pointerup',e=>{if(!aiming)return;e.preventDefault();setAim(e);aiming=false;shoot();});canvas.addEventListener('pointercancel',()=>{aiming=false;});
  levelClearEl?.addEventListener('pointerdown',e=>{if(!levelClearActive||performance.now()<levelClearReadyAt)return;e.preventDefault();startNextLevel();});
  startBtn.addEventListener('click',()=>{startFreshResume();});
  pauseBtn.addEventListener('click',()=>{if(!running||levelClearActive)return;paused=!paused;aiming=false;pauseBtn.textContent=paused?'▶':'Ⅱ';if(!paused)last=performance.now();else window.RWGSession?.saveNow?.('pause');});
  muteBtn.addEventListener('click',()=>{muted=!muted;muteBtn.textContent=muted?'🔇':'🔊';if(!muted)ensureAudio();});
  window.addEventListener('rwg:continue-game',e=>{score=Math.max(0,Math.floor(e.detail?.score??score));misses=0;moving=null;aiming=false;pressureElapsed=0;pressureDue=false;pressurePulse=0;const dangerY=launcherY-R*3.4;let guard=0;while(guard++<20){let maxRow=-1,dangerous=false;for(const b of grid.values()){maxRow=Math.max(maxRow,b.r);if(cellPos(b.r,b.c).y+R>=dangerY-R*1.15)dangerous=true;}if(!dangerous)break;for(const[k,b]of grid)if(b.r===maxRow)grid.delete(k);if(!grid.size){resetPressure();spawnBoard();break;}}reconcileQueue();currentShot=makeQueuedShot();nextShot=makeQueuedShot();running=true;paused=false;hideLevelClear();overlay.classList.remove('visible');startBtn.textContent='RIGIOCA';pauseBtn.textContent='Ⅱ';banner='CONTINUA!';bannerTime=1.2;last=performance.now();updateHud();ensureAudio();tone(520,.16,'triangle',.035,900);markSessionDirty('credit-continue');});
  window.addEventListener('resize',resize);window.addEventListener('orientationchange',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused&&!levelClearActive){paused=true;aiming=false;pauseBtn.textContent='▶';}});
  resize();updateHud();draw();requestAnimationFrame(frame);
})();