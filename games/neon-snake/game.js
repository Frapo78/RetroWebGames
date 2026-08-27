(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const comboEl = document.getElementById('combo');
  const bestEl = document.getElementById('best');
  const shieldBadge = document.getElementById('shieldBadge');
  const bannerEl = document.getElementById('banner');
  const overlay = document.getElementById('overlay');
  const overlayText = document.getElementById('overlayText');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const muteBtn = document.getElementById('muteBtn');

  const COLS = 20;
  const ROWS = 28;
  const DIR = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
  };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

  let W = 390, H = 620, DPR = 1, cell = 20, ox = 0, oy = 0;
  let running = false, paused = false, muted = false;
  let snake = [], dir = 'right', queuedDir = 'right';
  let food = null, bonus = null, shieldOrb = null, obstacles = [];
  let score = 0, level = 1, foods = 0, combo = 1, shield = false;
  let best = Number(localStorage.getItem('rwgNeonSnakeBest') || 0);
  let accumulator = 0, last = 0, lastEatAt = 0, bonusTTL = 0, shieldTTL = 0, bannerTimer = 0;
  let particles = [], swipe = null, audio = null;

  const key = p => `${p.x},${p.y}`;
  const same = (a, b) => a && b && a.x === b.x && a.y === b.y;
  const rand = n => Math.floor(Math.random() * n);

  function ensureAudio() {
    if (audio) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audio = new AC();
  }

  function tone(freq, duration = .05, type = 'square', volume = .02, end = freq) {
    if (muted) return;
    ensureAudio();
    if (!audio) return;
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, end), audio.currentTime + duration);
    g.gain.setValueAtTime(volume, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + duration);
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.max(1, Math.floor(W * DPR));
    canvas.height = Math.max(1, Math.floor(H * DPR));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cell = Math.min(W / COLS, H / ROWS);
    ox = (W - cell * COLS) / 2;
    oy = (H - cell * ROWS) / 2;
    draw();
  }

  function occupiedSet(includeHead = true) {
    const s = new Set();
    snake.forEach((p, i) => { if (includeHead || i > 0) s.add(key(p)); });
    obstacles.forEach(p => s.add(key(p)));
    if (food) s.add(key(food));
    if (bonus) s.add(key(bonus));
    if (shieldOrb) s.add(key(shieldOrb));
    return s;
  }

  function emptyCell(extra = new Set()) {
    const blocked = occupiedSet();
    for (const x of extra) blocked.add(x);
    for (let tries = 0; tries < 1000; tries++) {
      const p = { x: rand(COLS), y: rand(ROWS) };
      if (!blocked.has(key(p))) return p;
    }
    return null;
  }

  function spawnFood() { food = emptyCell(); }

  function spawnBonus() {
    bonus = emptyCell();
    bonusTTL = 6.5;
    if (bonus) announce('BONUS ORB!');
  }

  function spawnShield() {
    shieldOrb = emptyCell();
    shieldTTL = 7.5;
    if (shieldOrb) announce('SHIELD DISPONIBILE');
  }

  function addObstacles() {
    const target = Math.min(16, Math.max(0, (level - 2) * 2));
    while (obstacles.length < target) {
      const p = emptyCell();
      if (!p) break;
      const head = snake[0];
      if (Math.abs(p.x - head.x) + Math.abs(p.y - head.y) < 5) continue;
      obstacles.push(p);
    }
  }

  function resetGame() {
    const cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);
    snake = [
      { x: cx + 1, y: cy }, { x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }
    ];
    dir = queuedDir = 'right';
    obstacles = []; food = bonus = shieldOrb = null;
    score = 0; level = 1; foods = 0; combo = 1; shield = false;
    accumulator = 0; lastEatAt = 0; bonusTTL = shieldTTL = 0; particles = [];
    spawnFood(); updateHud();
  }

  function updateHud() {
    scoreEl.textContent = score.toLocaleString('it-IT');
    levelEl.textContent = level;
    comboEl.textContent = `×${combo}`;
    bestEl.textContent = best.toLocaleString('it-IT');
    shieldBadge.hidden = !shield;
  }

  function speedMs() {
    return Math.max(68, 154 - (level - 1) * 9);
  }

  function setDir(name) {
    if (!DIR[name] || OPP[dir] === name) return;
    queuedDir = name;
  }

  function announce(text, seconds = 1.05) {
    bannerEl.textContent = text;
    bannerEl.classList.add('show');
    bannerTimer = seconds;
  }

  function burst(p, color, count = 10) {
    const cx = ox + (p.x + .5) * cell, cy = oy + (p.y + .5) * cell;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = 25 + Math.random() * 90;
      particles.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .45 + Math.random() * .35, color, size: 1 + Math.random() * 2.4 });
    }
  }

  function eatFood(now) {
    foods++;
    const quick = lastEatAt && now - lastEatAt <= 2900;
    combo = quick ? Math.min(5, combo + 1) : 1;
    lastEatAt = now;
    score += 100 * combo;
    burst(food, '#7cffb2', 12);
    tone(430 + combo * 70, .055, 'triangle', .025, 680 + combo * 70);
    food = null;

    const newLevel = Math.floor(foods / 5) + 1;
    if (newLevel > level) {
      level = newLevel;
      addObstacles();
      announce(`LEVEL ${level}`);
      tone(480, .16, 'triangle', .035, 920);
    }
    if (foods % 5 === 0 && !bonus) spawnBonus();
    if (foods % 8 === 0 && !shieldOrb && !shield) spawnShield();
    spawnFood();
    updateHud();
  }

  function eatBonus() {
    score += 450 * Math.max(1, combo);
    combo = Math.min(5, combo + 1);
    burst(bonus, '#ffe66d', 20);
    bonus = null; bonusTTL = 0;
    announce('BONUS!');
    tone(660, .14, 'sine', .04, 1120);
    if (navigator.vibrate) navigator.vibrate([12, 18, 18]);
    updateHud();
  }

  function eatShield() {
    shield = true;
    burst(shieldOrb, '#65e7ff', 20);
    shieldOrb = null; shieldTTL = 0;
    announce('SHIELD ATTIVO');
    tone(520, .18, 'sine', .04, 1040);
    updateHud();
  }

  function collisionAt(p) {
    if (p.x < 0 || p.x >= COLS || p.y < 0 || p.y >= ROWS) return true;
    if (obstacles.some(o => same(o, p))) return true;
    return snake.slice(1, -1).some(s => same(s, p));
  }

  function safeResetAfterShield() {
    shield = false;
    combo = 1;
    const cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);
    snake = [{ x: cx + 1, y: cy }, { x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
    dir = queuedDir = 'right';
    obstacles = obstacles.filter(o => Math.abs(o.x - cx) + Math.abs(o.y - cy) > 5);
    addObstacles();
    announce('SHIELD SALVA!');
    tone(160, .18, 'sawtooth', .035, 520);
    if (navigator.vibrate) navigator.vibrate([30, 25, 20]);
    updateHud();
  }

  function step(now) {
    if (!running || paused) return;
    if (OPP[dir] !== queuedDir) dir = queuedDir;
    const d = DIR[dir];
    const next = { x: snake[0].x + d.x, y: snake[0].y + d.y };

    if (collisionAt(next)) {
      if (shield) safeResetAfterShield();
      else endGame();
      return;
    }

    snake.unshift(next);
    let grow = false;
    if (same(next, food)) { grow = true; eatFood(now); }
    if (same(next, bonus)) { grow = true; eatBonus(); }
    if (same(next, shieldOrb)) { grow = true; eatShield(); }
    if (!grow) snake.pop();
  }

  function endGame() {
    running = false; paused = false;
    best = Math.max(best, score);
    localStorage.setItem('rwgNeonSnakeBest', String(best));
    updateHud();
    overlayText.innerHTML = `Corsa terminata.<br>Punteggio <strong>${score.toLocaleString('it-IT')}</strong> • livello ${level} • lunghezza ${snake.length}.`;
    startBtn.textContent = 'RIGIOCA';
    pauseBtn.textContent = 'Ⅱ';
    overlay.classList.add('visible');
    tone(120, .28, 'sawtooth', .045, 55);
    if (navigator.vibrate) navigator.vibrate([45, 40, 70]);
    const detail = { game: 'Neon Snake', score, level, best, maxCombo: combo, length: snake.length };
    window.dispatchEvent(new CustomEvent('rwg:game-ended', { detail }));
    requestAnimationFrame(() => window.RWGGameOver?.open?.(detail));
  }

  function update(dt, now) {
    if (!running || paused) return;
    accumulator += dt * 1000;
    const interval = speedMs();
    while (accumulator >= interval && running && !paused) {
      accumulator -= interval;
      step(now);
    }

    if (lastEatAt && now - lastEatAt > 3200 && combo !== 1) { combo = 1; updateHud(); }
    if (bonus) { bonusTTL -= dt; if (bonusTTL <= 0) { bonus = null; announce('BONUS PERSO', .65); } }
    if (shieldOrb) { shieldTTL -= dt; if (shieldTTL <= 0) shieldOrb = null; }
    if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) bannerEl.classList.remove('show'); }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(.06, dt); p.vy *= Math.pow(.06, dt); p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function rounded(x, y, w, h, r, fill) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  }

  function drawCell(p, fill, glow = null, scale = .72) {
    const size = cell * scale;
    const x = ox + (p.x + .5) * cell - size / 2, y = oy + (p.y + .5) * cell - size / 2;
    ctx.save();
    if (glow) { ctx.shadowBlur = cell * .65; ctx.shadowColor = glow; }
    rounded(x, y, size, size, Math.max(2, size * .22), fill);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#06152a'); g.addColorStop(.55, '#020915'); g.addColorStop(1, '#01040a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(101,231,255,.055)'; ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) { const px = ox + x * cell; ctx.beginPath(); ctx.moveTo(px, oy); ctx.lineTo(px, oy + ROWS * cell); ctx.stroke(); }
    for (let y = 0; y <= ROWS; y++) { const py = oy + y * cell; ctx.beginPath(); ctx.moveTo(ox, py); ctx.lineTo(ox + COLS * cell, py); ctx.stroke(); }

    obstacles.forEach(o => {
      drawCell(o, '#27364d', '#526b8d', .78);
      const cx = ox + (o.x + .5) * cell, cy = oy + (o.y + .5) * cell;
      ctx.strokeStyle = 'rgba(101,231,255,.26)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - cell*.18, cy - cell*.18); ctx.lineTo(cx + cell*.18, cy + cell*.18); ctx.stroke();
    });

    if (food) drawCell(food, '#7cffb2', '#7cffb2', .58);
    if (bonus) {
      const pulse = .62 + Math.sin(performance.now() / 110) * .1;
      drawCell(bonus, '#ffe66d', '#ffe66d', pulse);
    }
    if (shieldOrb) {
      const cx = ox + (shieldOrb.x + .5) * cell, cy = oy + (shieldOrb.y + .5) * cell;
      ctx.save(); ctx.shadowBlur = 16; ctx.shadowColor = '#65e7ff'; ctx.strokeStyle = '#65e7ff'; ctx.lineWidth = Math.max(2, cell*.12);
      ctx.beginPath(); ctx.arc(cx, cy, cell*.29, 0, Math.PI*2); ctx.stroke(); ctx.restore();
    }

    for (let i = snake.length - 1; i >= 0; i--) {
      const p = snake[i];
      const t = i / Math.max(1, snake.length - 1);
      const color = i === 0 ? '#eafff2' : `hsl(${150 + t*35} 95% ${62 - t*18}%)`;
      drawCell(p, color, i === 0 ? '#7cffb2' : null, i === 0 ? .84 : .72);
    }

    if (snake[0]) {
      const h = snake[0], cx = ox + (h.x + .5) * cell, cy = oy + (h.y + .5) * cell;
      const d = DIR[dir], side = { x: -d.y, y: d.x };
      ctx.fillStyle = '#04110a';
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.arc(cx + d.x*cell*.16 + side.x*s*cell*.15, cy + d.y*cell*.16 + side.y*s*cell*.15, Math.max(1.2, cell*.055), 0, Math.PI*2); ctx.fill();
      }
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / .8); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function loop(ts) {
    const dt = Math.min(.04, (ts - last) / 1000 || 0);
    last = ts;
    update(dt, ts);
    draw();
    requestAnimationFrame(loop);
  }

  function startGame() {
    ensureAudio();
    resetGame();
    running = true; paused = false; last = performance.now();
    pauseBtn.textContent = 'Ⅱ'; startBtn.textContent = 'RIGIOCA';
    overlay.classList.remove('visible');
    announce('VIA!');
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    pauseBtn.textContent = paused ? '▶' : 'Ⅱ';
    if (paused) {
      overlayText.textContent = 'Partita in pausa.';
      startBtn.textContent = 'RIPRENDI';
      overlay.classList.add('visible');
    } else {
      last = performance.now(); accumulator = 0;
      startBtn.textContent = 'RIGIOCA';
      overlay.classList.remove('visible');
      announce('VIA!', .55);
    }
  }

  startBtn.addEventListener('click', () => {
    if (running && paused) { togglePause(); return; }
    startGame();
  });
  pauseBtn.addEventListener('click', togglePause);
  muteBtn.addEventListener('click', () => { muted = !muted; muteBtn.textContent = muted ? '🔇' : '🔊'; });

  document.querySelectorAll('#controls button').forEach(btn => btn.addEventListener('pointerdown', e => { e.preventDefault(); setDir(btn.dataset.dir); }));

  canvas.addEventListener('pointerdown', e => { swipe = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener('pointerup', e => {
    if (!swipe) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y; swipe = null;
    if (Math.hypot(dx, dy) < 18) return;
    setDir(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));
  });
  canvas.addEventListener('pointercancel', () => { swipe = null; });

  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    const name = k === 'arrowup' || k === 'w' ? 'up' : k === 'arrowdown' || k === 's' ? 'down' : k === 'arrowleft' || k === 'a' ? 'left' : k === 'arrowright' || k === 'd' ? 'right' : null;
    if (name) { e.preventDefault(); setDir(name); }
    else if ((k === 'p' || k === ' ') && running) { e.preventDefault(); togglePause(); }
  });

  window.addEventListener('rwg:continue-game', e => {
    score = Math.max(0, Math.floor(e.detail?.score ?? score));
    combo = 1; shield = false; bonus = null; shieldOrb = null; bonusTTL = shieldTTL = 0; accumulator = 0; lastEatAt = 0;
    const cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);
    snake = [{ x: cx + 1, y: cy }, { x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
    dir = queuedDir = 'right';
    obstacles = obstacles.filter(o => Math.abs(o.x - cx) + Math.abs(o.y - cy) > 5);
    addObstacles();
    if (!food || snake.some(s => same(s, food)) || obstacles.some(o => same(o, food))) spawnFood();
    running = true; paused = false; overlay.classList.remove('visible'); startBtn.textContent = 'RIGIOCA'; pauseBtn.textContent = 'Ⅱ'; last = performance.now(); updateHud(); ensureAudio(); announce('CONTINUA!', 1.1); tone(520, .16, 'triangle', .035, 900);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running && !paused) togglePause();
  });
  window.addEventListener('resize', resize);

  bestEl.textContent = best.toLocaleString('it-IT');
  resize();
  requestAnimationFrame(loop);
})();