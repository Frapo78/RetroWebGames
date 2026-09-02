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
const { KIND, TYPE, BUILD } = States;

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
    for (const kind of ['food', 'wood', 'gold']) {
      must(descriptor.nodes.some(node => node.kind === kind), `level ${level}: must offer ${kind}`);
    }
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

const events = { cleared: false, defeated: false, killed: false, lostUnit: false, wave: false, trained: false, built: false, aged: false, lostBuilding: false };
const clearEvents = () => {
  events.cleared = events.defeated = events.killed = false;
  events.lostUnit = events.wave = events.trained = false;
  events.built = events.aged = events.lostBuilding = false;
};

function newMatch(level) {
  const state = new States.GameState();
  state.loadLevel(Levels.getLevel(level), RULES, false);
  return state;
}

/**
 * Place a building on genuinely free ground near the town center.
 * The map is generated, so a hardcoded offset would be testing this level's
 * layout rather than the placement rule.
 */
function placeNear(state, kind) {
  const tc = state.tuning.townCenter;
  for (let radius = 12; radius <= 34; radius += 4) {
    for (let step = 0; step < 12; step++) {
      const a = (Math.PI * 2 * step) / 12;
      const outcome = Systems.orders.build(state, RULES, kind, tc.x + Math.cos(a) * radius, tc.y + Math.sin(a) * radius);
      if (outcome === 'ok') return 'ok';
      if (outcome === 'cost' || outcome === 'full') return outcome;
    }
  }
  return 'space';
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
  const wood = state.nodes.filter(node => node.kind === 'wood');
  must(food.length > 0 && gold.length > 0 && wood.length > 0, 'level 1 must offer all three resources');
  // Rotate across the three resources: every unit costs a different mix, so a
  // player who gathers only one stalls. That is intended tension, not an
  // unwinnable level.
  const pools = [food, gold, wood];
  let assigned = 0;
  for (let i = 0; i < state.units.length; i++) {
    if (!state.units[i].alive || state.units[i].kind !== KIND.VILLAGER) continue;
    const pool = pools[assigned % pools.length];
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
    if (state.trainKind < 0 && Systems.orders.train(state, RULES, KIND.SOLDIER, TYPE.CLUBMAN) === 'ok') trained++;
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
    if (s.trainKind < 0 && s.population() >= s.populationCap(RULES) - 1) {
      Systems.orders.build(s, RULES, BUILD.HOUSE, s.tuning.townCenter.x + 14, s.tuning.townCenter.y - 6);
    }
    if (s.trainKind < 0) Systems.orders.train(s, RULES, KIND.SOLDIER, TYPE.CLUBMAN);
    for (let i = 0; i < s.units.length; i++) {
      const unit = s.units[i];
      if (!unit.alive || unit.act !== 0) continue;
      if (unit.kind === KIND.SOLDIER) Systems.orders.attackCamp(s, i);
      else if (unit.kind === KIND.VILLAGER) {
        const lowest = s.gold <= s.food && s.gold <= s.wood ? gold : s.wood <= s.food ? wood : food;
        const target = lowest.find(node => node.amount > 0) || s.nodes.find(node => node.amount > 0);
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
  state.wood = 0;
  must(Systems.orders.train(state, RULES, KIND.SOLDIER, TYPE.CLUBMAN) === 'cost', 'training must be refused without resources');
  state.food = 99999;
  state.gold = 99999;
  state.wood = 99999;
  // Age gating: the archer belongs to the Bronze Age and must be refused in
  // the Stone Age even when every resource is available.
  must(state.age === 0, 'a match must start in the first age');
  must(Systems.orders.train(state, RULES, KIND.SOLDIER, TYPE.ARCHER) === 'age', 'an unreached age must gate its unit');
  must(Systems.orders.train(state, RULES, KIND.SOLDIER, TYPE.CAVALRY) === 'age', 'the last age must gate cavalry');
  must(Systems.orders.train(state, RULES, KIND.VILLAGER) === 'ok', 'training must start when affordable');
  must(Systems.orders.train(state, RULES, KIND.VILLAGER) === 'busy', 'only one unit may train at a time');

  const baseCap = state.populationCap(RULES);
  must(baseCap === RULES.basePopulation, 'the town center alone must provide the base population');
  let guard = 0;
  while (state.population() < baseCap && guard++ < 5000) {
    if (state.trainKind < 0) Systems.orders.train(state, RULES, KIND.VILLAGER);
    run(state, 1);
  }
  // Drain the training slot first: with one in flight the honest answer is
  // 'busy', and asserting 'pop' there would be testing the wrong branch.
  let drain = 0;
  while (state.trainKind >= 0 && drain++ < 1000) run(state, 1);
  must(Systems.orders.train(state, RULES, KIND.VILLAGER) === 'pop', 'population cap must block further training');
  must(state.population() <= state.populationCap(RULES), 'population must never exceed the cap');

  // A house lifts the ceiling, exactly as in the original.
  const tc = state.tuning.townCenter;
  // Find real free ground instead of assuming a spot: the map is generated,
  // so a hardcoded offset would be testing the layout, not the rule.
  const placed = placeNear(state, BUILD.HOUSE);
  must(placed === 'ok', `a house must be placeable on free ground (got ${placed})`);
  run(state, RULES.buildings.house.build + 1);
  must(state.populationCap(RULES) === baseCap + RULES.buildings.house.pop, 'a finished house must raise the population cap');
  must(Systems.orders.train(state, RULES, KIND.VILLAGER) === 'ok', 'training must resume once a house is standing');
  must(Systems.orders.build(state, RULES, BUILD.HOUSE, tc.x, tc.y) === 'space', 'a building must not be placed on the town center');
  must(Systems.orders.build(state, RULES, BUILD.HOUSE, state.tuning.enemyCamp.x, state.tuning.enemyCamp.y) === 'space', 'a building must not be placed on the enemy camp');

  // Touch tolerance: tapping a tree should build beside it, not refuse. A
  // fingertip is wider than a building, and the map is dense near home.
  const tree = state.nodes.find(node => node.kind === 'wood' && node.amount > 0);
  must(Boolean(tree), 'level 1 must still have standing woodland for this check');
  const beforeCount = state.buildings.filter(b => b.alive).length;
  const onTree = Systems.orders.build(state, RULES, BUILD.HOUSE, tree.x, tree.y);
  must(onTree === 'ok', `tapping next to a tree must slide the site to free ground (got ${onTree})`);
  const placedOnTree = state.buildings.filter(b => b.alive).length;
  must(placedOnTree === beforeCount + 1, 'the slid building must actually exist');
  const slid = state.buildings.filter(b => b.alive)[placedOnTree - 1];
  must(Math.hypot(slid.x - tree.x, slid.y - tree.y) <= 12.001, 'the site must slide only a short distance from the tap');
  must(Math.hypot(slid.x - tree.x, slid.y - tree.y) >= RULES.buildings.house.r + 3 - 0.001, 'the slid building must clear the resource it slid off');
}

// ── Ages ────────────────────────────────────────────────────────────────────
{
  const state = newMatch(2);
  must(RULES.ages.length === 3, 'the campaign must expose three ages');
  state.food = state.wood = state.gold = 99999;
  must(Systems.orders.advanceAge(state, RULES) === 'ok', 'advancing must start when affordable');
  must(Systems.orders.advanceAge(state, RULES) === 'busy', 'only one advancement may run at a time');
  must(state.age === 0, 'the age must not change before its research completes');

  const before = { food: state.food, wood: state.wood };
  must(before.food < 99999 && before.wood < 99999, 'advancing must cost resources up front');

  // Train a unit now, so the age bonus can be observed on an existing soldier.
  Systems.orders.train(state, RULES, KIND.SOLDIER, TYPE.CLUBMAN);
  run(state, RULES.units.clubman.train + 1);
  let sample = -1;
  for (let i = 0; i < state.units.length; i++) if (state.units[i].alive && state.units[i].kind === KIND.SOLDIER) sample = i;
  must(sample >= 0, 'a soldier must exist before the age advances');
  const damageBefore = state.units[sample].damage;

  run(state, RULES.ages[1].research + 2);
  must(state.age === 1, 'research must complete into the next age');
  must(state.units[sample].damage > damageBefore, 'advancing must strengthen units already trained');
  // Make population headroom first: otherwise the honest refusal is 'pop' and
  // the assertion would be testing the cap, not the age unlock.
  const room = placeNear(state, BUILD.HOUSE);
  must(room === 'ok', `a house must be placeable before testing the age unlock (got ${room})`);
  run(state, RULES.buildings.house.build + 1);
  must(Systems.orders.train(state, RULES, KIND.SOLDIER, TYPE.ARCHER) === 'ok', 'the new age must unlock its unit');

  state.food = state.wood = state.gold = 99999;
  state.trainKind = -1;
  Systems.orders.advanceAge(state, RULES);
  run(state, RULES.ages[2].research + 2);
  must(state.age === 2, 'the campaign must reach the last age');
  must(Systems.orders.advanceAge(state, RULES) === 'max', 'there must be nothing past the last age');
}

// ── Towers defend, and can be destroyed ─────────────────────────────────────
{
  const state = newMatch(6);
  state.wood = state.gold = 99999;
  const towerPlaced = placeNear(state, BUILD.TOWER);
  must(towerPlaced === 'ok', `a tower must be placeable (got ${towerPlaced})`);
  run(state, RULES.buildings.tower.build + 1);
  let tower = -1;
  for (let i = 0; i < state.buildings.length; i++) if (state.buildings[i].alive && state.buildings[i].kind === BUILD.TOWER) tower = i;
  must(tower >= 0, 'the tower must exist once built');
  if (tower >= 0) must(state.buildings[tower].build === 0, 'the tower must finish construction');

  // Left alone with raiders arriving, the tower must actually shoot: kills
  // must appear without a single soldier on the map.
  must(state.countKind(KIND.SOLDIER) === 0, 'this check must run without any soldier');
  const killsBefore = state.kills;
  run(state, 260);
  must(state.kills > killsBefore, 'an undefended base with a tower must still kill raiders');
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
  must(Math.abs(restored.wood - state.wood) < 0.2, 'restored wood must match the saved run');
  must(restored.age === state.age, 'restored age must match the saved run');
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
    ['unit outside the world', { ...snapshot, units: [[...snapshot.units[0].slice(0, 4), 9999, ...snapshot.units[0].slice(5)]] }],
    ['hp above maximum', { ...snapshot, units: [[...snapshot.units[0].slice(0, 5), 99999, ...snapshot.units[0].slice(6)]] }],
    ['node id out of range', { ...snapshot, units: [[...snapshot.units[0].slice(0, 12), 999, ...snapshot.units[0].slice(13)]] }],
    ['unknown unit type', { ...snapshot, units: [[snapshot.units[0][0], 9, ...snapshot.units[0].slice(2)]] }],
    ['struct index out of range', { ...snapshot, units: [[...snapshot.units[0].slice(0, 17), 999, snapshot.units[0][18]]] }],
    ['unknown age', { ...snapshot, age: 99 }],
    ['negative wood', { ...snapshot, wood: -1 }],
    ['too many buildings', { ...snapshot, buildings: new Array(40).fill([0, 10, 10, 10, 10, 0]) }],
    ['malformed building row', { ...snapshot, buildings: [[0, 10, 10]] }],
    ['building outside the world', { ...snapshot, buildings: [[0, 9999, 10, 10, 10, 0]] }],
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
  must(game.includes('the-great-empire-state-v2'), 'schema 2 must be reflected in the adapter compatibility token');
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
console.log('  ✓ three ages gate their units, cost up front and buff existing troops');
console.log('  ✓ houses raise the population cap and towers kill raiders unaided');
console.log('  ✓ snapshots round-trip and 18 tampered variants are refused');
