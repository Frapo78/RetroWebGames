(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const missesEl = document.getElementById('misses');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const overlayText = document.getElementById('overlayText');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const muteBtn = document.getElementById('muteBtn');
  const nextDot = document.querySelector('#nextBubble i');

  const PALETTE = ['#ff5f73', '#65e7ff', '#ffe66d', '#8d7cff', '#7cffb2', '#ff934f'];

  let W = 390, H = 844, DPR = 1;
  let R = 16, CELL = 32, ROW_H = 28, TOP = 82, COLS = 11;
  let launcherX = W / 2, launcherY = H - 92;
  let running = false, paused = false, muted = false;
  let aiming = false, aimX = W / 2, aimY = H * .42;
  let last = 0, score = 0, level = 1, misses = 0, missLimit = 5, colorCount = 4;
  let currentColor = PALETTE[0], nextColor = PALETTE[1];
  let moving = null, banner = '', bannerTime = 0;
  let best = Number(localStorage.getItem('bubbleBurstBest') || 0);
  let audio = null;

  const grid = new Map();
  const particles = [];
  const falling = [];

  const key = (r, c) => `${r},${c}`;

  function ensureAudio() {
    if (!audio) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audio = new AudioCtx();
    }
    if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
  }

  function tone(freq, duration = .06, type = 'sine', volume = .025, slide = 0) {
    if (muted) return;
    ensureAudio();
    if (!audio || audio.state !== 'running') return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audio.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(25, freq + slide), audio.currentTime + duration);
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    R = Math.max(14, Math.min(18, W / 24));
    CELL = R * 2;
    ROW_H = R * 1.73;
    TOP = Math.max(76, H * .105);
    COLS = Math.max(8, Math.floor((W - R * 3) / CELL) + 1);
    launcherX = W / 2;
    launcherY = H - Math.max(88, H * .11);
    aimX = Math.max(R, Math.min(W - R, aimX));
    aimY = Math.min(launcherY - 45, aimY);
  }

  function cellPos(r, c) {
    const offset = r % 2 ? R : 0;
    return { x: R + c * CELL + offset, y: TOP + R + r * ROW_H };
  }

  function validCell(r, c) {
    if (r < 0 || c < 0 || c >= COLS) return false;
    const p = cellPos(r, c);
    return p.x >= R - .1 && p.x <= W - R + .1;
  }

  function neighbors(r, c) {
    const out = [[r, c - 1], [r, c + 1]];
    if (r % 2 === 0) {
      out.push([r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]);
    } else {
      out.push([r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]);
    }
    return out.filter(([rr, cc]) => validCell(rr, cc));
  }

  function activeColors() {
    if (!grid.size) return PALETTE.slice(0, colorCount);
    const present = new Set();
    for (const b of grid.values()) present.add(b.color);
    return [...present];
  }

  function pickColor() {
    const colors = activeColors();
    return colors[Math.floor(Math.random() * colors.length)] || PALETTE[0];
  }

  function spawnBoard() {
    grid.clear();
    const rows = Math.min(8, 5 + Math.floor((level - 1) / 2));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!validCell(r, c)) continue;
        const color = PALETTE[Math.floor(Math.random() * colorCount)];
        grid.set(key(r, c), { r, c, color });
      }
    }
  }

  function resetGame() {
    score = 0;
    level = 1;
    misses = 0;
    missLimit = 5;
    colorCount = 4;
    moving = null;
    particles.length = 0;
    falling.length = 0;
    spawnBoard();
    currentColor = pickColor();
    nextColor = pickColor();
    banner = 'LIVELLO 1';
    bannerTime = 1.4;
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = score.toLocaleString('it-IT');
    levelEl.textContent = level;
    missesEl.textContent = `${misses}/${missLimit}`;
    bestEl.textContent = best.toLocaleString('it-IT');
    nextDot.style.background = nextColor;
    nextDot.style.color = nextColor;
  }

  function burst(x, y, color, count = 10, speed = 140) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 30 + Math.random() * speed;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: .35 + Math.random() * .45, max: .8, size: 1.5 + Math.random() * 3 });
    }
  }

  function aimVector() {
    const dx = aimX - launcherX;
    const dy = Math.min(-40, aimY - launcherY);
    let angle = Math.atan2(dy, dx);
    angle = Math.max(-Math.PI + .24, Math.min(-.24, angle));
    return { x: Math.cos(angle), y: Math.sin(angle), angle };
  }

  function shoot() {
    if (!running || paused || moving) return;
    const v = aimVector();
    const speed = Math.min(680, Math.max(520, H * .72));
    moving = { x: launcherX + v.x * (R + 16), y: launcherY + v.y * (R + 16), vx: v.x * speed, vy: v.y * speed, color: currentColor };
    currentColor = nextColor;
    nextColor = pickColor();
    updateHud();
    tone(520, .05, 'triangle', .028, 180);
  }

  function findNearestEmpty(x, y) {
    const baseR = Math.max(0, Math.round((y - TOP - R) / ROW_H));
    let bestCell = null;
    let bestDist = Infinity;
    for (let rr = Math.max(0, baseR - 2); rr <= baseR + 2; rr++) {
      const offset = rr % 2 ? R : 0;
      const baseC = Math.round((x - R - offset) / CELL);
      for (let cc = baseC - 2; cc <= baseC + 2; cc++) {
        if (!validCell(rr, cc) || grid.has(key(rr, cc))) continue;
        const p = cellPos(rr, cc);
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bestDist) { bestDist = d; bestCell = { r: rr, c: cc }; }
      }
    }
    return bestCell;
  }

  function component(startR, startC, color = null) {
    const startKey = key(startR, startC);
    if (!grid.has(startKey)) return [];
    const target = color || grid.get(startKey).color;
    const queue = [[startR, startC]];
    const seen = new Set([startKey]);
    const out = [];
    while (queue.length) {
      const [r, c] = queue.shift();
      const b = grid.get(key(r, c));
      if (!b || b.color !== target) continue;
      out.push([r, c]);
      for (const [nr, nc] of neighbors(r, c)) {
        const nk = key(nr, nc), nb = grid.get(nk);
        if (!seen.has(nk) && nb && nb.color === target) { seen.add(nk); queue.push([nr, nc]); }
      }
    }
    return out;
  }

  function removeCells(cells, pointsPer = 30) {
    for (const [r, c] of cells) {
      const k = key(r, c), b = grid.get(k);
      if (!b) continue;
      const p = cellPos(r, c); burst(p.x, p.y, b.color, 10, 145); grid.delete(k); score += pointsPer;
    }
  }

  function dropDisconnected() {
    const anchored = new Set(), queue = [];
    for (let c = 0; c < COLS; c++) { if (!validCell(0, c)) continue; const k = key(0, c); if (grid.has(k)) { anchored.add(k); queue.push([0, c]); } }
    while (queue.length) {
      const [r, c] = queue.shift();
      for (const [nr, nc] of neighbors(r, c)) { const nk = key(nr, nc); if (grid.has(nk) && !anchored.has(nk)) { anchored.add(nk); queue.push([nr, nc]); } }
    }
    let dropped = 0;
    for (const [k, b] of [...grid.entries()]) {
      if (anchored.has(k)) continue;
      const p = cellPos(b.r, b.c); falling.push({ x: p.x, y: p.y, color: b.color, vx: (Math.random() - .5) * 90, vy: 35 + Math.random() * 60 }); grid.delete(k); score += 50; dropped++;
    }
    return dropped;
  }

  function addPenaltyRow() {
    const shifted = new Map();
    for (const b of grid.values()) { const nr = b.r + 1; if (validCell(nr, b.c)) shifted.set(key(nr, b.c), { r: nr, c: b.c, color: b.color }); }
    grid.clear(); for (const [k, b] of shifted) grid.set(k, b);
    for (let c = 0; c < COLS; c++) { if (!validCell(0, c)) continue; const color = PALETTE[Math.floor(Math.random() * colorCount)]; grid.set(key(0, c), { r: 0, c, color }); }
    misses = 0; banner = 'NUOVA RIGA!'; bannerTime = 1.1; tone(135, .16, 'sawtooth', .035, -55); if (navigator.vibrate) navigator.vibrate(35);
  }

  function reconcileQueue() { const colors = activeColors(); if (!colors.includes(currentColor)) currentColor = pickColor(); if (!colors.includes(nextColor)) nextColor = pickColor(); }

  function resolveShot(cell) {
    const matches = component(cell.r, cell.c);
    if (matches.length >= 3) { removeCells(matches, 35); const dropped = dropDisconnected(); score += Math.max(0, matches.length - 3) * 15; tone(640, .09, 'triangle', .04, 280); if (dropped) tone(330, .14, 'sine', .035, -110); misses = 0; }
    else { misses++; tone(210, .04, 'square', .018, -35); if (misses >= missLimit) addPenaltyRow(); }
    if (grid.size === 0) { nextLevel(); return; }
    reconcileQueue(); updateHud(); checkDanger();
  }

  function attachMoving() {
    if (!moving) return;
    const cell = findNearestEmpty(moving.x, moving.y);
    if (!cell) { endGame(); return; }
    const p = cellPos(cell.r, cell.c), color = moving.color; moving = null; grid.set(key(cell.r, cell.c), { r: cell.r, c: cell.c, color }); burst(p.x, p.y, color, 5, 65); tone(360, .035, 'sine', .018, 60); resolveShot(cell);
  }

  function nextLevel() {
    level++; misses = 0; missLimit = Math.max(3, 5 - Math.floor((level - 1) / 3)); colorCount = Math.min(PALETTE.length, 4 + Math.floor(level / 2)); score += 750; spawnBoard(); currentColor = pickColor(); nextColor = pickColor(); banner = `LIVELLO ${level}`; bannerTime = 1.5; tone(480, .18, 'triangle', .045, 480); updateHud();
  }

  function checkDanger() {
    const dangerY = launcherY - R * 3.25;
    for (const b of grid.values()) if (cellPos(b.r, b.c).y + R >= dangerY) { endGame(); return true; }
    return false;
  }

  function endGame() {
    if (!running) return;
    running = false; paused = false; aiming = false; moving = null; best = Math.max(best, score); localStorage.setItem('bubbleBurstBest', String(best)); updateHud(); overlayText.innerHTML = `Le bolle hanno raggiunto la linea di pericolo.<br>Punteggio <strong>${score.toLocaleString('it-IT')}</strong> • livello ${level}.`; startBtn.textContent = 'RIGIOCA'; overlay.classList.add('visible'); pauseBtn.textContent = 'Ⅱ'; tone(95, .25, 'sawtooth', .05, -55);
    const detail = { game: 'Bubble Burst', score, level, best };
    window.dispatchEvent(new CustomEvent('rwg:game-ended', { detail }));
    requestAnimationFrame(() => window.RWGGameOver?.open?.(detail));
  }

  function updateMoving(dt) {
    if (!moving) return;
    moving.x += moving.vx * dt; moving.y += moving.vy * dt;
    if (moving.x <= R) { moving.x = R; moving.vx = Math.abs(moving.vx); tone(290, .025, 'square', .012, 30); }
    else if (moving.x >= W - R) { moving.x = W - R; moving.vx = -Math.abs(moving.vx); tone(290, .025, 'square', .012, 30); }
    if (moving.y - R <= TOP) { moving.y = TOP + R; attachMoving(); return; }
    for (const b of grid.values()) { const p = cellPos(b.r, b.c); if ((p.x - moving.x) ** 2 + (p.y - moving.y) ** 2 <= (R * 1.88) ** 2) { attachMoving(); return; } }
  }

  function update(dt) {
    if (!running || paused) return;
    updateMoving(dt); bannerTime = Math.max(0, bannerTime - dt);
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(.08, dt); p.vy *= Math.pow(.08, dt); p.life -= dt; if (p.life <= 0) particles.splice(i, 1); }
    for (let i = falling.length - 1; i >= 0; i--) { const b = falling[i]; b.vy += 720 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.y > H + R * 3) falling.splice(i, 1); }
  }

  function drawBubble(x, y, color, radius = R) {
    ctx.save(); ctx.translate(x, y); ctx.shadowBlur = Math.max(5, radius * .65); ctx.shadowColor = color; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    const shade = ctx.createRadialGradient(-radius * .35, -radius * .4, 1, 0, 0, radius); shade.addColorStop(0, 'rgba(255,255,255,.72)'); shade.addColorStop(.22, 'rgba(255,255,255,.12)'); shade.addColorStop(.75, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,.28)'); ctx.fillStyle = shade; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.24)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  }

  function traceAim() {
    if (!running || paused || moving) return;
    const v = aimVector(); let x = launcherX + v.x * (R + 20), y = launcherY + v.y * (R + 20), vx = v.x, vy = v.y; const step = 13; ctx.save();
    for (let i = 0; i < 42; i++) { x += vx * step; y += vy * step; if (x <= R) { x = R; vx = Math.abs(vx); } if (x >= W - R) { x = W - R; vx = -Math.abs(vx); } let stop = y <= TOP + R; if (!stop) for (const b of grid.values()) { const p = cellPos(b.r, b.c); if ((p.x - x) ** 2 + (p.y - y) ** 2 < (R * 1.55) ** 2) { stop = true; break; } } if (i % 2 === 0) { ctx.globalAlpha = .7 * (1 - i / 52); ctx.fillStyle = currentColor; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); } if (stop) break; }
    ctx.restore();
  }

  function drawLauncher() {
    const v = aimVector(); ctx.save(); ctx.translate(launcherX, launcherY); ctx.rotate(v.angle + Math.PI / 2); const g = ctx.createLinearGradient(-8, 0, 8, 0); g.addColorStop(0, '#4a5873'); g.addColorStop(.5, '#e7f2ff'); g.addColorStop(1, '#53617c'); ctx.fillStyle = g; ctx.fillRect(-7, -41, 14, 43); ctx.strokeStyle = 'rgba(101,231,255,.35)'; ctx.strokeRect(-7, -41, 14, 43); ctx.restore(); ctx.fillStyle = '#18233b'; ctx.beginPath(); ctx.arc(launcherX, launcherY + 3, R + 9, Math.PI, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.stroke(); if (!moving) drawBubble(launcherX, launcherY - 5, currentColor, R);
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#10284a'); g.addColorStop(.48, '#081128'); g.addColorStop(1, '#03050c'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = .12; ctx.fillStyle = '#65e7ff'; const spacing = 34; for (let y = TOP; y < launcherY; y += spacing) for (let x = (Math.floor(y / spacing) % 2) * spacing / 2; x < W; x += spacing) ctx.fillRect(x, y, 1, 1); ctx.globalAlpha = 1; const dangerY = launcherY - R * 3.25; ctx.save(); ctx.setLineDash([5, 8]); ctx.strokeStyle = 'rgba(255,95,115,.38)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, dangerY); ctx.lineTo(W, dangerY); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,95,115,.55)'; ctx.font = '8px ui-monospace, monospace'; ctx.fillText('DANGER', 10, dangerY - 6); ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H); drawBackground(); traceAim(); for (const b of grid.values()) { const p = cellPos(b.r, b.c); drawBubble(p.x, p.y, b.color); } for (const b of falling) drawBubble(b.x, b.y, b.color, R * .92); if (moving) drawBubble(moving.x, moving.y, moving.color); drawLauncher(); for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); } ctx.globalAlpha = 1;
    if (bannerTime > 0 && running) { ctx.save(); ctx.globalAlpha = Math.min(1, bannerTime * 2); ctx.textAlign = 'center'; ctx.font = '900 20px ui-monospace, monospace'; ctx.fillStyle = '#f7fbff'; ctx.shadowBlur = 16; ctx.shadowColor = '#65e7ff'; ctx.fillText(banner, W / 2, H * .56); ctx.restore(); }
    if (paused && running) { ctx.fillStyle = 'rgba(2,5,14,.58)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.font = '900 22px ui-monospace, monospace'; ctx.fillStyle = '#fff'; ctx.fillText('PAUSA', W / 2, H / 2); }
  }

  function frame(ts) { const dt = Math.min(.033, Math.max(0, (ts - last) / 1000 || 0)); last = ts; update(dt); draw(); requestAnimationFrame(frame); }
  function pointerPos(e) { const rect = canvas.getBoundingClientRect(); return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) }; }
  function setAim(e) { const p = pointerPos(e); aimX = Math.max(R, Math.min(W - R, p.x)); aimY = Math.min(launcherY - 40, p.y); }

  canvas.addEventListener('pointerdown', e => { if (!running || paused || moving) return; e.preventDefault(); aiming = true; canvas.setPointerCapture?.(e.pointerId); setAim(e); ensureAudio(); });
  canvas.addEventListener('pointermove', e => { if (!aiming) return; e.preventDefault(); setAim(e); });
  canvas.addEventListener('pointerup', e => { if (!aiming) return; e.preventDefault(); setAim(e); aiming = false; shoot(); });
  canvas.addEventListener('pointercancel', () => { aiming = false; });

  startBtn.addEventListener('click', () => { ensureAudio(); resetGame(); running = true; paused = false; startBtn.textContent = 'GIOCA'; overlay.classList.remove('visible'); pauseBtn.textContent = 'Ⅱ'; });
  pauseBtn.addEventListener('click', () => { if (!running) return; paused = !paused; aiming = false; pauseBtn.textContent = paused ? '▶' : 'Ⅱ'; if (!paused) last = performance.now(); });
  muteBtn.addEventListener('click', () => { muted = !muted; muteBtn.textContent = muted ? '🔇' : '🔊'; if (!muted) ensureAudio(); });
  window.addEventListener('rwg:continue-game', e => {
    score = Math.max(0, Math.floor(e.detail?.score ?? score)); misses = 0; moving = null; aiming = false;
    const dangerY = launcherY - R * 3.25;
    while ([...grid.values()].some(b => cellPos(b.r, b.c).y + R >= dangerY - R * 1.2)) {
      const maxRow = Math.max(...[...grid.values()].map(b => b.r));
      for (const [k, b] of [...grid.entries()]) if (b.r === maxRow) grid.delete(k);
      if (!grid.size) { spawnBoard(); break; }
    }
    reconcileQueue(); currentColor = pickColor(); nextColor = pickColor(); running = true; paused = false; overlay.classList.remove('visible'); startBtn.textContent = 'RIGIOCA'; pauseBtn.textContent = 'Ⅱ'; banner = 'CONTINUA!'; bannerTime = 1.2; last = performance.now(); updateHud(); ensureAudio(); tone(520, .16, 'triangle', .035, 900);
  });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) { paused = true; pauseBtn.textContent = '▶'; } });

  resize(); updateHud(); draw(); requestAnimationFrame(frame);
})();
