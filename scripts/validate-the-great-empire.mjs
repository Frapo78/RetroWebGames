#!/usr/bin/env node
/**
 * The Great Empire — specialized validator.
 *
 * The game's rules, state and simulation are DOM-free modules, so this runs
 * real matches headlessly instead of only grepping source. It checks the three
 * things a static scan cannot: that the campaign is deterministic, that a match
 * can actually be won and actually be lost, and that the resume contract
 * refuses snapshots it must refuse.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const GAME = 'games/the-great-empire';

const sandbox = { window: {}, performance: { now: () => 0 }, Math, Number, Array, Object, JSON };
vm.createContext(sandbox);
for (const file of ['levels.js', 'state.js', 'systems.js', 'snapshot.js']) {
  vm.runInContext(read(`${GAME}/${file}`), sandbox, { filename: file });
}
const Levels = sandbox.window.GreatEmpireLevels;
const States = sandbox.window.GreatEmpireState;
const Systems = sandbox.window.GreatEmpireSystems;
const Snapshot = sandbox.window.GreatEmpireSnapshot;

must(Boolean(Levels?.getLevel), 'levels module did not initialize');
must(Boolean(States?.GameState), 'state module did not initialize');
must(Boolean(Systems?.advance), 'systems module did not initialize');
must(Boolean(Snapshot?.serialize), 'snapshot module did not initialize');

if (!Levels?.getLevel || !States?.GameState || !Systems?.advance || !Snapshot?.serialize) {
  console.error('The Great Empire validation FAILED: modules unavailable');
  failures.forEach(f => console.error('  ✗ ' + f));
  process.exit(1);
}

const RULES = Levels.RULES;
const { KIND } = States;

// ── Deterministic campaign ──────────────────────────────────────────────────
{
  const a = Levels.getLevel(7);
  const b = Levels.getLevel(7);
  must(a.signature === b.signature, 'level layout must be reproducible for the same level number');
  must(JSON.stringify(a.nodes) === JSON.stringify(b.nodes), 'level nodes must be identical across calls');
  must(a.signature !== Levels.getLevel(8).signature, 'different levels must not share a layout signature');

  let previousCamp = 0;
  let previousInterval = Infinity;
  for (let level = 1; level <= 20; level++) {
    const descriptor = Levels.getLevel(level);
    must(descriptor.nodes.length >= 4, `level ${level}: needs at least four resource nodes`);
    must(descriptor.campHp > previousCamp, `level ${level}: enemy camp must be tougher than the previous one`);
    must(descriptor.waveInterval <= previousInterval, `level ${level}: waves must not become slower inside a cycle`);
    must(descriptor.waveInterval >= 6, `level ${level}: wave interval must stay above the playable floor`);
    for (const node of descriptor.nodes) {
      must(node.x >= 0 && node.x <= descriptor.world.w, `level ${level}: node outside the world horizontally`);
      must(node.y > descriptor.enemyCamp.y + 8 && node.y < descriptor.townCenter.y - 8, `level ${level}: node must sit between the two bases`);
    }
    previousCamp = descriptor.campHp;
    previousInterval = descriptor.waveInterval;
  }
  // A later cycle must be strictly harder than the same step of the first one.
  must(Levels.getLevel(21).campHp > Levels.getLevel(1).campHp, 'a new cycle must escalate camp strength');
  must(Levels.getLevel(21).raidersPerWave >= Levels.getLevel(1).raidersPerWave, 'a new cycle must not send fewer raiders');
}

const events = { cleared: false, defeated: false, killed: false, lostUnit: false, wave: false, trained: false };
const clearEvents = () => {
  events.cleared = events.defeated = events.killed = false;
  events.lostUnit = events.wave = events.trained = false;
};

function newMatch(level) {
  const state = new States.GameState();
  state.loadLevel(Levels.getLevel(level), RULES, false);
  return state;
}

/** Advance `seconds` of simulated time in realistic frame slices. */
function run(state, seconds, onTick) {
  const slice = 1 / 60;
  for (let t = 0; t < seconds; t += slice) {
    clearEvents();
    Systems.advance(state, RULES, slice, events);
    if (onTick) onTick(state, events, t);
    if (events.cleared || events.defeated) return events;
  }
  return events;
}

// ── A match can be won ──────────────────────────────────────────────────────
{
  const state = newMatch(1);
  const startingVillagers = state.countKind(KIND.VILLAGER);
  must(startingVillagers >= 2, 'a match must start with villagers to work with');

  // Send every villager to the nearest food node, as a player would.
  const food = state.nodes.filter(node => node.kind === 'food');
  const gold = state.nodes.filter(node => node.kind === 'gold');
  must(food.length > 0, 'level 1 must offer a food node');
  must(gold.length > 0, 'level 1 must offer a gold node');
  // Alternate food and gold: soldiers cost both, so a player who gathers only
  // food stalls. That is intended economy tension, not an unwinnable level.
  let assigned = 0;
  for (let i = 0; i < state.units.length; i++) {
    if (!state.units[i].alive || state.units[i].kind !== KIND.VILLAGER) continue;
    const pool = assigned % 2 === 0 ? food : gold;
    Systems.orders.gather(state, i, pool[assigned % pool.length].id);
    assigned++;
  }

  const before = state.food;
  run(state, 20);
  must(state.food > before, 'villagers ordered to a food node must actually deliver food');
  must(state.gathered > 0, 'delivered resources must be counted');
  must(state.score > 0, 'delivering resources must score');

  // Now build an army and take the camp down.
  let trained = 0;
  let guard = 0;
  while (trained < 4 && guard++ < 4000) {
    if (state.trainKind < 0 && Systems.orders.train(state, RULES, KIND.SOLDIER) === 'ok') trained++;
    run(state, 1);
    if (state.town.hp <= 0) break;
  }
  must(trained >= 1, 'a reachable economy must be able to pay for at least one soldier');

  for (let i = 0; i < state.units.length; i++) {
    if (state.units[i].alive && state.units[i].kind === KIND.SOLDIER) Systems.orders.attackCamp(state, i);
  }
  const outcome = run(state, 600, (s) => {
    // Stands in for a competent player, not a perfect one: keep the economy
    // running, keep training, and send idle soldiers back to the assault.
    if (s.trainKind < 0 && s.food >= RULES.soldierCost.food && s.gold >= RULES.soldierCost.gold) {
      Systems.orders.train(s, RULES, KIND.SOLDIER);
    }
    for (let i = 0; i < s.units.length; i++) {
      const unit = s.units[i];
      if (!unit.alive || unit.act !== 0) continue;
      if (unit.kind === KIND.SOLDIER) Systems.orders.attackCamp(s, i);
      else if (unit.kind === KIND.VILLAGER) {
        const pool = s.gold < s.food ? gold : food;
        const target = pool.find(node => node.amount > 0) || s.nodes.find(node => node.amount > 0);
        if (target) Systems.orders.gather(s, i, target.id);
      }
    }
  });
  must(outcome.cleared === true, 'level 1 must be winnable by gathering and attacking the camp');
  must(state.camp.hp === 0, 'a cleared level must leave the enemy camp destroyed');
}

// ── A match can be lost ─────────────────────────────────────────────────────
{
  const state = newMatch(12);
  // Nobody defends: raiders must eventually bring the town center down.
  const outcome = run(state, 900);
  must(outcome.defeated === true, 'an undefended town center must eventually fall');
  must(state.town.hp === 0, 'defeat must leave the town center at zero');
}

// ── Population and cost rules ───────────────────────────────────────────────
{
  const state = newMatch(1);
  state.food = 10;
  state.gold = 0;
  must(Systems.orders.train(state, RULES, KIND.SOLDIER) === 'cost', 'training must be refused without resources');
  state.food = 99999;
  state.gold = 99999;
  must(Systems.orders.train(state, RULES, KIND.VILLAGER) === 'ok', 'training must start when affordable');
  must(Systems.orders.train(state, RULES, KIND.VILLAGER) === 'busy', 'only one unit may train at a time');
  let guard = 0;
  while (state.population() < RULES.maxPopulation && guard++ < 5000) {
    if (state.trainKind < 0) Systems.orders.train(state, RULES, KIND.VILLAGER);
    run(state, 1);
  }
  // Drain the training slot first: with one in flight the honest answer is
  // 'busy', and asserting 'pop' there would be testing the wrong branch.
  let drain = 0;
  while (state.trainKind >= 0 && drain++ < 1000) run(state, 1);
  must(Systems.orders.train(state, RULES, KIND.VILLAGER) === 'pop', 'population cap must block further training');
  must(state.population() <= RULES.maxPopulation, 'population must never exceed the cap');
}

// ── Unit pool never grows ───────────────────────────────────────────────────
{
  const state = newMatch(9);
  const poolIdentity = state.units;
  const poolSize = state.units.length;
  run(state, 240);
  must(state.units === poolIdentity, 'the unit pool must be reused, never reallocated');
  must(state.units.length === poolSize, 'the unit pool must not grow during a match');
  let alive = 0;
  for (const unit of state.units) if (unit.alive) alive++;
  must(alive + state.free.length === poolSize, 'every pool slot must be either alive or free — no leaks');
}

// ── Resume contract ─────────────────────────────────────────────────────────
{
  const state = newMatch(4);
  const food = state.nodes.find(node => node.kind === 'food');
  for (let i = 0; i < state.units.length; i++) {
    if (state.units[i].alive && state.units[i].kind === KIND.VILLAGER) Systems.orders.gather(state, i, food.id);
  }
  run(state, 45);

  const snapshot = Snapshot.serialize(state);
  must(Snapshot.validate(snapshot, Levels, RULES), 'a snapshot of a live run must validate');
  must(JSON.stringify(snapshot).length < 384 * 1024, 'a snapshot must stay inside the shared 384 KiB budget');

  const restored = new States.GameState();
  restored.loadLevel(Levels.getLevel(snapshot.level), RULES, false);
  Snapshot.applyTo(restored, snapshot);
  must(Math.abs(restored.food - state.food) < 0.2, 'restored food must match the saved run');
  must(restored.countKind(KIND.VILLAGER) === state.countKind(KIND.VILLAGER), 'restored villager count must match');
  must(JSON.stringify(Snapshot.serialize(restored)) === JSON.stringify(snapshot), 'serialize → restore → serialize must be stable');

  const tampered = [
    ['foreign layout', { ...snapshot, signature: snapshot.signature + 1 }],
    ['impossible level', { ...snapshot, level: 0 }],
    ['wrong schema', { ...snapshot, schema: 99 }],
    ['negative resources', { ...snapshot, food: -5 }],
    ['finished run', { ...snapshot, townHp: 0 }],
    ['destroyed camp', { ...snapshot, campHp: 0 }],
    ['inflated town', { ...snapshot, townHp: RULES.townCenterHp * 3 }],
    ['refilled node', { ...snapshot, nodes: snapshot.nodes.map(value => value + 10000) }],
    ['truncated unit row', { ...snapshot, units: [snapshot.units[0].slice(0, 8)] }],
    ['unit outside the world', { ...snapshot, units: [[...snapshot.units[0].slice(0, 3), 9999, ...snapshot.units[0].slice(4)]] }],
    ['hp above maximum', { ...snapshot, units: [[...snapshot.units[0].slice(0, 4), 99999, ...snapshot.units[0].slice(5)]] }],
    ['node id out of range', { ...snapshot, units: [[...snapshot.units[0].slice(0, 10), 999, ...snapshot.units[0].slice(11)]] }],
    ['not an object', null]
  ];
  for (const [label, candidate] of tampered) {
    must(Snapshot.validate(candidate, Levels, RULES) === false, `snapshot validation must refuse: ${label}`);
  }
}

// ── Platform wiring that only source can show ───────────────────────────────
{
  const game = read(`${GAME}/game.js`);
  const html = read(`${GAME}/index.html`);
  for (const marker of ['rwg:game-ended', 'rwg:continue-game', 'RWGGameOver?.open', 'RWGResumeAdapter', 'RWGSession?.register', 'visibilitychange']) {
    must(game.includes(marker), `composition root missing platform contract: ${marker}`);
  }
  must(!game.includes('localStorage.setItem(\'rwg.session'), 'the game must not write the shared session namespace');
  must(html.indexOf('snapshot.js') < html.indexOf('game.js'), 'snapshot module must load before the composition root');
  must(html.indexOf('game.js') < html.indexOf('../../game-hud.js'), 'the resume adapter must exist before shared HUD bootstrap');
  // The pilot's whole point: the runtime is split, not a monolith.
  for (const file of ['levels.js', 'state.js', 'systems.js', 'snapshot.js', 'renderer.js', 'input.js', 'game.js']) {
    must(fs.existsSync(path.join(root, GAME, file)), `object-oriented runtime module missing: ${file}`);
  }
  const renderer = read(`${GAME}/renderer.js`);
  must(!/state\.(food|gold|score)\s*(\+\+|--|\s*=[^=])/.test(renderer), 'the renderer must never mutate gameplay state');
}

if (failures.length) {
  console.error(`\nThe Great Empire validation FAILED (${failures.length})\n`);
  failures.forEach(failure => console.error('  ✗ ' + failure));
  console.error('');
  process.exit(1);
}

console.log('The Great Empire validation OK');
console.log('  ✓ campaign layouts are deterministic and escalate across levels and cycles');
console.log('  ✓ a simulated match can be won by gathering and assaulting the camp');
console.log('  ✓ an undefended town center actually falls');
console.log('  ✓ population, cost and single-training-slot rules hold');
console.log('  ✓ the unit pool is reused with no leaked slots');
console.log('  ✓ snapshots round-trip and 13 tampered variants are refused');
