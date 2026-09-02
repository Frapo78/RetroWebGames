/**
 * The Great Empire — composition root.
 *
 * This file owns wiring and the platform contract, not rules: level data lives
 * in levels.js, authoritative state in state.js, simulation in systems.js,
 * presentation in renderer.js and interaction in input.js.
 *
 * Platform integration is deliberately thin — lifecycle events, the resume
 * adapter and the shared Game Over — because every one of those services
 * belongs to RetroWebGames, not to this game.
 */
(() => {
  'use strict';

  const Levels = window.GreatEmpireLevels;
  const { GameState, KIND, TYPE, BUILD } = window.GreatEmpireState;
  const Systems = window.GreatEmpireSystems;
  const { Renderer } = window.GreatEmpireRenderer;
  const { InputController } = window.GreatEmpireInput;
  const Snapshot = window.GreatEmpireSnapshot;

  const RULES = Levels.RULES;
  const BEST_KEY = 'theGreatEmpireBest';

  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const overlay = $('overlay');
  const overlayText = $('overlayText');
  const startBtn = $('startBtn');
  const pauseBtn = $('pauseBtn');
  const muteBtn = $('muteBtn');
  const statusEl = $('status');
  const actionBar = $('actions');
  const els = {
    food: $('food'), wood: $('wood'), gold: $('gold'),
    pop: $('pop'), level: $('level'), age: $('age'), score: $('score'),
    best: $('best'), train: $('trainState')
  };
  const buttons = {
    villager: $('trainVillager'),
    clubman: $('trainClubman'),
    archer: $('trainArcher'),
    cavalry: $('trainCavalry'),
    house: $('buildHouse'),
    tower: $('buildTower'),
    age: $('advanceAge')
  };

  const state = new GameState();
  const renderer = new Renderer(canvas);
  let muted = false;
  let audio = null;
  let last = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let interstitial = 0;
  let terminal = false;

  /** Preallocated event sink: a simulation tick must not allocate. */
  const events = { cleared: false, defeated: false, killed: false, lostUnit: false, wave: false, trained: false, built: false, aged: false, lostBuilding: false };
  const resetEvents = () => {
    events.cleared = events.defeated = events.killed = false;
    events.lostUnit = events.wave = events.trained = false;
    events.built = events.aged = events.lostBuilding = false;
  };

  const markDirty = reason => window.RWGSession?.markDirty?.(reason);

  // ── Audio ────────────────────────────────────────────────────────────────
  function ensureAudio() {
    if (audio) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audio = new AC();
  }
  function tone(freq, dur = 0.06, type = 'triangle', vol = 0.03, end = freq) {
    if (muted) return;
    ensureAudio();
    if (!audio) return;
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, end), audio.currentTime + dur);
    g.gain.setValueAtTime(vol, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + dur);
  }
  const FEEDBACK = {
    select: () => tone(520, 0.04, 'square', 0.02, 640),
    move: () => tone(320, 0.05, 'triangle', 0.02, 420),
    gather: () => tone(430, 0.06, 'triangle', 0.022, 620),
    attack: () => tone(180, 0.08, 'sawtooth', 0.028, 120),
    empty: () => tone(150, 0.03, 'square', 0.012, 120)
  };

  const input = new InputController(canvas, renderer, state, {
    feedback: name => FEEDBACK[name]?.(),
    place: (kind, x, y) => {
      const outcome = Systems.orders.build(state, RULES, kind, x, y);
      if (outcome === 'ok') { announce('CANTIERE APERTO'); tone(300, 0.1, 'square', 0.03, 220); markDirty('build'); }
      else announce(OUTCOME_TEXT[outcome] || 'NON DISPONIBILE');
      updateHud();
    }
  });

  // ── Shell ────────────────────────────────────────────────────────────────
  function announce(text) {
    statusEl.textContent = text;
    statusEl.classList.add('show');
    clearTimeout(announce.timer);
    announce.timer = setTimeout(() => statusEl.classList.remove('show'), 1400);
  }

  const canPay = cost => state.food >= (cost.food || 0) && state.wood >= (cost.wood || 0) && state.gold >= (cost.gold || 0);

  function updateHud() {
    els.food.textContent = Math.floor(state.food);
    els.wood.textContent = Math.floor(state.wood);
    els.gold.textContent = Math.floor(state.gold);
    els.pop.textContent = `${state.population()}/${state.populationCap(RULES)}`;
    els.level.textContent = state.level;
    els.age.textContent = RULES.ages[state.age].short;
    els.score.textContent = Math.floor(state.score);
    els.best.textContent = Math.floor(best);

    if (state.ageResearch > 0) {
      els.train.textContent = `AVANZAMENTO ${Math.ceil(state.ageResearch)}s`;
      els.train.hidden = false;
    } else if (state.trainKind >= 0) {
      const label = state.trainKind === KIND.VILLAGER ? 'CONTADINO' : RULES.units[Systems.UNIT_KEYS[state.trainType]].label;
      els.train.textContent = `${label} ${Math.ceil(state.trainLeft)}s`;
      els.train.hidden = false;
    } else {
      els.train.hidden = true;
    }

    buttons.villager.disabled = !canPay(RULES.villagerCost);
    for (const [key, button] of [['clubman', buttons.clubman], ['archer', buttons.archer], ['cavalry', buttons.cavalry]]) {
      const spec = RULES.units[key];
      const locked = state.age < spec.age;
      button.disabled = locked || !canPay(spec.cost);
      button.classList.toggle('is-locked', locked);
    }
    buttons.house.disabled = !canPay(RULES.buildings.house.cost);
    buttons.tower.disabled = !canPay(RULES.buildings.tower.cost);

    const nextAge = RULES.ages[state.age + 1];
    buttons.age.disabled = !nextAge || state.ageResearch > 0 || !canPay(nextAge.cost);
    buttons.age.querySelector('b').textContent = nextAge ? `→ ${nextAge.short}` : 'ETÀ MAX';
    buttons.age.querySelector('i').textContent = nextAge
      ? `${nextAge.cost.food}🌾 ${nextAge.cost.wood}🪵${nextAge.cost.gold ? ' ' + nextAge.cost.gold + '🪙' : ''}`
      : 'ferro';
  }

  /**
   * The command bar is an occupied region of the viewport, like the shared
   * dock. Its height depends on wrapped labels and font metrics, so it is
   * measured instead of guessed: the CSS value is only a pre-measurement
   * fallback, and a wrong guess would let the bar cover the playfield.
   */
  function syncActionsHeight() {
    if (actionBar.hidden) return;
    const height = Math.round(actionBar.getBoundingClientRect().height);
    if (height > 0) document.body.style.setProperty('--tge-actions', (height + 8) + 'px');
  }

  function setPlaying(playing) {
    input.setEnabled(playing);
    actionBar.hidden = !playing;
    document.body.classList.toggle('is-playing', playing);
    if (playing) {
      syncActionsHeight();
      renderer.resize(state.tuning ? state.tuning.world : null);
    }
  }

  // ── Level flow ───────────────────────────────────────────────────────────
  function loadLevel(level, carryScore) {
    state.loadLevel(Levels.getLevel(level), RULES, carryScore);
    state.running = true;
    state.paused = false;
    state.acc = 0;
    renderer.resize(state.tuning.world);
    interstitial = 0;
    updateHud();
  }

  function start() {
    window.RWGSession?.clear?.();
    terminal = false;
    loadLevel(1, false);
    overlay.classList.remove('visible');
    startBtn.textContent = 'RIGIOCA';
    pauseBtn.textContent = 'Ⅱ';
    setPlaying(true);
    ensureAudio();
    announce('DIFENDI IL CENTRO CITTÀ');
    last = performance.now();
    markDirty('new-game');
  }

  function nextLevel() {
    const bonus = 300 + Math.max(0, Math.round(240 - state.elapsed * 2));
    state.score += bonus;
    state.levelsCleared++;
    loadLevel(state.level + 1, true);
    announce(`LIVELLO ${state.level}`);
    tone(560, 0.18, 'triangle', 0.04, 880);
    markDirty('level-cleared');
  }

  function finish() {
    if (terminal) return;
    terminal = true;
    state.running = false;
    state.paused = false;
    setPlaying(false);
    const score = Math.floor(state.score);
    best = Math.max(best, score);
    localStorage.setItem(BEST_KEY, String(best));
    updateHud();
    overlayText.textContent = '';
    startBtn.textContent = 'RIGIOCA';
    tone(140, 0.35, 'sawtooth', 0.05, 60);
    const detail = {
      game: 'The Great Empire',
      score,
      level: state.level,
      maxLevel: state.level,
      levelsCleared: state.levelsCleared,
      kills: state.kills,
      age: RULES.ages[state.age].short,
      result: 'loss'
    };
    window.dispatchEvent(new CustomEvent('rwg:game-ended', { detail }));
    requestAnimationFrame(() => window.RWGGameOver?.open?.(detail));
  }

  function applyEvents() {
    if (events.killed) tone(240, 0.05, 'square', 0.02, 150);
    if (events.wave) { announce('ONDATA NEMICA!'); tone(120, 0.16, 'sawtooth', 0.03, 90); }
    if (events.trained) { updateHud(); markDirty('trained'); }
    if (events.built) { announce('COSTRUZIONE COMPLETATA'); tone(560, 0.12, 'triangle', 0.03, 760); markDirty('built'); }
    if (events.lostBuilding) { announce('EDIFICIO DISTRUTTO!'); tone(110, 0.2, 'sawtooth', 0.035, 60); markDirty('lost-building'); }
    if (events.aged) { announce(RULES.ages[state.age].name); tone(620, 0.3, 'triangle', 0.05, 940); markDirty('aged'); }
    if (events.defeated) { finish(); return; }
    if (events.cleared && interstitial <= 0) {
      interstitial = 1.8;
      announce('ACCAMPAMENTO DISTRUTTO!');
      state.running = false;
    }
  }

  /** A run with no units, no training and no way to pay for one is over. */
  function stalled() {
    return state.population() === 0 && state.trainKind < 0 && state.ageResearch <= 0 && state.food < RULES.villagerCost.food;
  }

  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;

    if (interstitial > 0) {
      interstitial -= dt;
      if (interstitial <= 0) nextLevel();
    } else if (state.running && !state.paused) {
      resetEvents();
      Systems.advance(state, RULES, dt, events);
      applyEvents();
      if (!terminal && stalled()) { state.setNotice('', 0); finish(); }
      updateHud();
    }

    const alpha = state.running && !state.paused ? Math.min(1, (state.acc || 0) / Systems.STEP) : 1;
    renderer.draw(state, alpha, RULES);
    requestAnimationFrame(loop);
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  const OUTCOME_TEXT = {
    cost: 'RISORSE INSUFFICIENTI',
    pop: 'SERVONO PIÙ CASE',
    busy: 'CENTRO CITTÀ OCCUPATO',
    age: 'ETÀ NON ANCORA RAGGIUNTA',
    space: 'SPAZIO OCCUPATO',
    full: 'TROPPI EDIFICI',
    max: 'SEI GIÀ NELL\'ETÀ DEL FERRO'
  };

  function train(kind, type) {
    const outcome = Systems.orders.train(state, RULES, kind, type);
    if (outcome === 'ok') { tone(480, 0.08, 'triangle', 0.03, 620); markDirty('train'); }
    else announce(OUTCOME_TEXT[outcome] || 'NON DISPONIBILE');
    updateHud();
  }

  function requestBuild(kind) {
    const spec = kind === BUILD.TOWER ? RULES.buildings.tower : RULES.buildings.house;
    if (!canPay(spec.cost)) { announce(OUTCOME_TEXT.cost); return; }
    input.setBuild(kind);
    announce(kind === BUILD.TOWER ? 'TOCCA DOVE COSTRUIRE LA TORRE' : 'TOCCA DOVE COSTRUIRE LA CASA');
    FEEDBACK.select();
  }

  buttons.villager.addEventListener('click', () => train(KIND.VILLAGER, 0));
  buttons.clubman.addEventListener('click', () => train(KIND.SOLDIER, TYPE.CLUBMAN));
  buttons.archer.addEventListener('click', () => train(KIND.SOLDIER, TYPE.ARCHER));
  buttons.cavalry.addEventListener('click', () => train(KIND.SOLDIER, TYPE.CAVALRY));
  buttons.house.addEventListener('click', () => requestBuild(BUILD.HOUSE));
  buttons.tower.addEventListener('click', () => requestBuild(BUILD.TOWER));
  buttons.age.addEventListener('click', () => {
    const outcome = Systems.orders.advanceAge(state, RULES);
    if (outcome === 'ok') { announce('AVANZAMENTO IN CORSO'); tone(420, 0.2, 'triangle', 0.04, 700); markDirty('age'); }
    else announce(OUTCOME_TEXT[outcome] || 'NON DISPONIBILE');
    updateHud();
  });

  $('selectVillagers').addEventListener('click', () => {
    input.setBuild(-1);
    if (!input.selectAllOfKind(KIND.VILLAGER)) announce('NESSUN CONTADINO');
  });
  $('selectSoldiers').addEventListener('click', () => {
    input.setBuild(-1);
    if (!input.selectAllOfKind(KIND.SOLDIER)) announce('NESSUN SOLDATO');
  });
  $('attackAll').addEventListener('click', () => {
    input.setBuild(-1);
    let sent = 0;
    for (let i = 0; i < state.units.length; i++) {
      if (state.units[i].alive && state.units[i].kind === KIND.SOLDIER) { Systems.orders.attackCamp(state, i); sent++; }
    }
    if (sent) { announce(`ASSALTO: ${sent}`); FEEDBACK.attack(); }
    else announce('SERVONO SOLDATI');
  });

  startBtn.addEventListener('click', start);
  pauseBtn.addEventListener('click', () => {
    if (!state.running) return;
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? '▶' : 'Ⅱ';
    if (state.paused) window.RWGSession?.saveNow?.('pause');
    else last = performance.now();
  });
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    muteBtn.textContent = muted ? '🔇' : '🔊';
  });

  // ── Platform lifecycle ───────────────────────────────────────────────────
  window.addEventListener('rwg:continue-game', event => {
    terminal = false;
    const score = Number(event.detail?.score);
    if (Number.isFinite(score)) state.score = score;
    state.town.hp = state.town.maxHp;
    for (let i = 0; i < state.units.length; i++) {
      if (state.units[i].alive && state.units[i].kind === KIND.RAIDER) state.kill(i);
    }
    state.waveTimer = Math.max(state.waveTimer, state.tuning ? state.tuning.firstWaveDelay * 0.6 : 12);
    state.running = true;
    state.paused = false;
    state.acc = 0;
    overlay.classList.remove('visible');
    pauseBtn.textContent = 'Ⅱ';
    startBtn.textContent = 'RIGIOCA';
    setPlaying(true);
    last = performance.now();
    updateHud();
    announce('CONTINUA!');
    tone(520, 0.16, 'triangle', 0.035, 900);
    markDirty('credit-continue');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.running && !state.paused) {
      state.paused = true;
      pauseBtn.textContent = '▶';
    }
  });

  window.addEventListener('resize', () => { syncActionsHeight(); renderer.resize(state.tuning ? state.tuning.world : null); });

  // ── Resume adapter ───────────────────────────────────────────────────────
  // Serialization lives in snapshot.js as pure functions; this root only adds
  // the side effects a restore needs (level load, shell state, first paint).
  const serialize = () => Snapshot.serialize(state);
  const validate = snapshot => Snapshot.validate(snapshot, Levels, RULES);

  function restore(snapshot) {
    if (!validate(snapshot)) return false;
    loadLevel(snapshot.level, false);
    Snapshot.applyTo(state, snapshot);
    terminal = false;
    state.running = true;
    state.paused = false;
    overlay.classList.remove('visible');
    startBtn.textContent = 'RIGIOCA';
    pauseBtn.textContent = 'Ⅱ';
    setPlaying(true);
    last = performance.now();
    updateHud();
    renderer.draw(state, 1, RULES);
    return true;
  }

  const resumeAdapter = Object.freeze({
    id: 'the-great-empire',
    version: 1,
    compatibility: 'the-great-empire-state-v2-ages-wood-buildings',
    isInProgress: () => state.running || interstitial > 0,
    serialize,
    validate,
    restore,
    startFresh: start,
    describe: snapshot => `Livello ${snapshot.level} • ${RULES.ages[snapshot.age]?.short || ''} • ${snapshot.score} punti`
  });
  window.RWGResumeAdapter = resumeAdapter;
  window.RWGSession?.register?.(resumeAdapter);

  // ── Boot ─────────────────────────────────────────────────────────────────
  state.loadLevel(Levels.getLevel(1), RULES, false);
  state.running = false;
  input.attach();
  setPlaying(false);
  renderer.resize(state.tuning.world);
  updateHud();
  requestAnimationFrame(loop);
})();
