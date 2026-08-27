(() => {
  'use strict';
  const M = window.MM;
  if (!M) throw new Error('Maze Munch state missing for session adapter');
  const RESUME_SCHEMA = 1;
  const allowedPellets = new Set(), allowedPower = new Set();
  for (let y = 0; y < M.ROWS; y++) for (let x = 0; x < M.COLS; x++) {
    const ch = M.MAP[y][x], k = M.key(x, y);
    if (ch === '.') allowedPellets.add(k);
    if (ch === 'o') allowedPower.add(k);
  }
  const TOTAL = allowedPellets.size + allowedPower.size;
  const validDir = value => M.names.includes(value);
  const finite = (...values) => values.every(Number.isFinite);
  const validActor = actor => actor && finite(actor.x, actor.y, actor.speed) && validDir(actor.dir) && actor.x > -1 && actor.x < M.COLS + 1 && actor.y > -1 && actor.y < M.ROWS + 1;
  const validKeyList = (list, allowed) => Array.isArray(list) && list.every(k => typeof k === 'string' && allowed.has(k)) && new Set(list).size === list.length;

  function serialize() {
    return {
      schema: RESUME_SCHEMA,
      score: M.score, level: M.level, lives: M.lives,
      pellets: [...M.pellets], power: [...M.power], eaten: M.eaten, total: M.total,
      frightened: M.frightened, combo: M.combo, bonusStage: M.bonusStage,
      bonus: M.bonus ? { ...M.bonus } : null, ready: M.ready,
      player: { x:M.player.x, y:M.player.y, dir:M.player.dir, wanted:M.player.wanted, speed:M.player.speed, inv:M.player.inv },
      hunters: M.hunters.map(h => ({ i:h.i, x:h.x, y:h.y, dir:h.dir, speed:h.speed, eyes:h.eyes, release:h.release }))
    };
  }

  function validate(s) {
    if (!s || s.schema !== RESUME_SCHEMA || !Number.isInteger(s.level) || s.level < 1 || !Number.isInteger(s.lives) || s.lives < 1 || s.lives > 3) return false;
    if (!finite(s.score, s.eaten, s.total, s.frightened, s.combo, s.bonusStage, s.ready) || s.score < 0 || s.frightened < 0 || s.combo < 0 || s.ready < 0) return false;
    if (s.total !== TOTAL || !validKeyList(s.pellets, allowedPellets) || !validKeyList(s.power, allowedPower)) return false;
    if (s.eaten !== TOTAL - s.pellets.length - s.power.length) return false;
    if (!validActor(s.player) || !validDir(s.player.wanted) || !Number.isFinite(s.player.inv) || s.player.inv < 0) return false;
    if (!Array.isArray(s.hunters) || s.hunters.length !== M.hunters.length) return false;
    for (let i = 0; i < s.hunters.length; i++) {
      const h = s.hunters[i]; if (!validActor(h) || h.i !== i || !finite(h.eyes, h.release)) return false;
    }
    if (s.bonus !== null && (!s.bonus || !finite(s.bonus.x, s.bonus.y, s.bonus.life, s.bonus.value) || s.bonus.life <= 0 || s.bonus.value <= 0)) return false;
    return true;
  }

  function restore(s) {
    if (!validate(s)) return false;
    M.map = M.MAP.map(r => r.replace('P',' ').split(''));
    M.pellets = new Set(s.pellets); M.power = new Set(s.power); M.total = s.total; M.eaten = s.eaten;
    M.score = Math.floor(s.score); M.level = s.level; M.lives = s.lives; M.frightened = s.frightened; M.combo = Math.floor(s.combo);
    M.bonusStage = Math.floor(s.bonusStage); M.bonus = s.bonus ? { ...s.bonus } : null; M.ready = s.ready;
    Object.assign(M.player, s.player);
    s.hunters.forEach((saved, i) => Object.assign(M.hunters[i], saved));
    M.running = true; M.paused = false; M.swipe = null; M.last = performance.now();
    M.dom.overlay.classList.remove('visible'); M.dom.start.textContent = 'RIGIOCA'; M.dom.pause.textContent = 'Ⅱ';
    M.hud(); M.resize(); M.status('PARTITA RIPRESA');
    return true;
  }

  function startFresh() {
    M.ensureAudio(); M.resetGame(); M.running = true; M.paused = false; M.last = performance.now();
    M.dom.pause.textContent = 'Ⅱ'; M.dom.start.textContent = 'RIGIOCA'; M.dom.overlay.classList.remove('visible');
    M.hud();
  }

  const adapter = Object.freeze({
    id: 'maze-munch', version: 1, compatibility: 'maze-munch-state-v1-map23x19',
    isInProgress: () => M.running,
    serialize, validate, restore, startFresh,
    describe: s => `livello ${s.level} • ${s.lives} vite • ${Math.floor(s.score || 0).toLocaleString('it-IT')} punti`
  });
  window.RWGResumeAdapter = adapter;
  window.RWGSession?.register?.(adapter);

  const oldHud = M.hud;
  M.hud = (...args) => { const result = oldHud(...args); if (M.running) window.RWGSession?.markDirty?.('maze-state'); return result; };
  M.dom.pause.addEventListener('click', () => { if (M.running && M.paused) window.RWGSession?.saveNow?.('pause'); });
  window.addEventListener('rwg:continue-game', () => window.RWGSession?.markDirty?.('credit-continue'));
})();