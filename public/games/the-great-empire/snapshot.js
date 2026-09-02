/**
 * The Great Empire — snapshot serialization.
 *
 * Pure functions over the authoritative state: no DOM, no platform globals.
 * Keeping them here rather than inside the composition root means the resume
 * contract can be exercised headlessly, which is how the specialized validator
 * proves that a tampered or foreign snapshot is actually refused instead of
 * silently repaired.
 *
 * Units are stored as fixed-length numeric rows. That keeps a full army well
 * inside the platform's 384 KiB snapshot budget and makes validation a matter
 * of checking numbers, not walking objects.
 */
(() => {
  'use strict';

  const { KIND, MAX_UNITS, MAX_BUILDINGS } = window.GreatEmpireState;
  // Schema 2: ages, wood and player buildings. Schema 1 snapshots describe a
  // game that no longer exists, so they are refused rather than migrated.
  const SCHEMA = 2;
  const ROW = 19;
  const BUILDING_ROW = 6;

  const round = (value, digits) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  };

  function serialize(state) {
    const units = [];
    for (let i = 0; i < state.units.length; i++) {
      const u = state.units[i];
      if (!u.alive) continue;
      units.push([
        u.kind, u.type, u.act,
        round(u.x, 2), round(u.y, 2),
        round(u.hp, 1), round(u.maxHp, 1),
        round(u.speed, 2), round(u.damage, 2), round(u.range, 2),
        round(u.tx, 2), round(u.ty, 2),
        u.nodeId, round(u.carry, 2), u.carryKind,
        u.targetUnit, u.targetBuilding, u.targetStruct, round(u.cooldown, 2)
      ]);
    }
    const buildings = [];
    for (let i = 0; i < state.buildings.length; i++) {
      const b = state.buildings[i];
      if (!b.alive) continue;
      buildings.push([b.kind, round(b.x, 2), round(b.y, 2), round(b.hp, 1), round(b.maxHp, 1), round(b.build, 2)]);
    }
    // Arrows in flight are deliberately not persisted: they carry at most one
    // pending hit and rebuilding them would add schema for no player-visible
    // continuity.
    return {
      schema: SCHEMA,
      level: state.level,
      signature: state.signature,
      age: state.age,
      ageResearch: round(state.ageResearch, 2),
      food: round(state.food, 1),
      wood: round(state.wood, 1),
      gold: round(state.gold, 1),
      buildings,
      score: Math.floor(state.score),
      gathered: Math.floor(state.gathered),
      kills: state.kills,
      levelsCleared: state.levelsCleared,
      elapsed: round(state.elapsed, 1),
      townHp: round(state.town.hp, 1),
      campHp: round(state.camp.hp, 1),
      waveTimer: round(state.waveTimer, 2),
      waveNumber: state.waveNumber,
      trainKind: state.trainKind,
      trainType: state.trainType,
      trainLeft: round(state.trainLeft, 2),
      nodes: state.nodes.map(node => round(node.amount, 1)),
      units
    };
  }

  const finite = value => Number.isFinite(value);
  const wholeAtLeast = (value, min) => Number.isInteger(value) && value >= min;

  /**
   * Reject anything that could not have been produced by a legitimate run of
   * this exact level. The layout signature is the important one: node ids in a
   * snapshot address coordinates that only that generated map has.
   */
  function validate(snapshot, Levels, RULES) {
    if (!RULES || !Array.isArray(RULES.ages)) return false;
    if (!snapshot || snapshot.schema !== SCHEMA) return false;
    if (!wholeAtLeast(snapshot.level, 1) || snapshot.level > 5000) return false;

    const descriptor = Levels.getLevel(snapshot.level);
    if (snapshot.signature !== descriptor.signature) return false;
    if (!Array.isArray(snapshot.nodes) || snapshot.nodes.length !== descriptor.nodes.length) return false;
    if (!Array.isArray(snapshot.units) || snapshot.units.length > MAX_UNITS) return false;

    for (const value of [snapshot.food, snapshot.wood, snapshot.gold, snapshot.waveTimer, snapshot.elapsed, snapshot.trainLeft, snapshot.ageResearch]) {
      if (!finite(value) || value < 0) return false;
    }
    if (!Number.isInteger(snapshot.age) || snapshot.age < 0 || snapshot.age >= RULES.ages.length) return false;
    if (!Array.isArray(snapshot.buildings) || snapshot.buildings.length > MAX_BUILDINGS) return false;
    for (const row of snapshot.buildings) {
      if (!Array.isArray(row) || row.length !== BUILDING_ROW) return false;
      for (const value of row) if (!finite(value)) return false;
      if (row[0] < 0 || row[0] > 1) return false;
      if (row[1] < 0 || row[1] > descriptor.world.w) return false;
      if (row[2] < 0 || row[2] > descriptor.world.h) return false;
      if (row[3] <= 0 || row[3] > row[4]) return false;
    }
    if (!wholeAtLeast(snapshot.score, 0) || !wholeAtLeast(snapshot.gathered, 0)) return false;
    if (!wholeAtLeast(snapshot.kills, 0) || !wholeAtLeast(snapshot.levelsCleared, 0)) return false;
    if (!wholeAtLeast(snapshot.waveNumber, 0)) return false;

    // A finished run is not resumable: both bases must still be standing.
    if (!finite(snapshot.townHp) || snapshot.townHp <= 0 || snapshot.townHp > RULES.townCenterHp) return false;
    if (!finite(snapshot.campHp) || snapshot.campHp <= 0 || snapshot.campHp > descriptor.campHp) return false;

    if (snapshot.trainKind !== -1 && snapshot.trainKind !== KIND.VILLAGER && snapshot.trainKind !== KIND.SOLDIER) return false;
    if (!Number.isInteger(snapshot.trainType) || snapshot.trainType < 0 || snapshot.trainType > 2) return false;

    for (let i = 0; i < snapshot.nodes.length; i++) {
      const amount = snapshot.nodes[i];
      if (!finite(amount) || amount < 0 || amount > descriptor.nodes[i].amount) return false;
    }

    for (const unit of snapshot.units) {
      if (!Array.isArray(unit) || unit.length !== ROW) return false;
      for (const value of unit) if (!finite(value)) return false;
      if (unit[0] < 0 || unit[0] > 2) return false;
      if (unit[1] < 0 || unit[1] > 4) return false;
      if (unit[2] < 0 || unit[2] > 5) return false;
      if (unit[3] < -10 || unit[3] > descriptor.world.w + 10) return false;
      if (unit[4] < -10 || unit[4] > descriptor.world.h + 10) return false;
      if (unit[5] <= 0 || unit[5] > unit[6]) return false;
      if (unit[12] < -1 || unit[12] >= descriptor.nodes.length) return false;
      if (unit[15] < -1 || unit[15] >= MAX_UNITS) return false;
      if (unit[16] < 0 || unit[16] > 3) return false;
      if (unit[17] < -1 || unit[17] >= MAX_BUILDINGS) return false;
    }
    return true;
  }

  /**
   * Rebuild `state` from a snapshot already loaded with the matching level.
   * Returns false without touching gameplay when the snapshot is not valid.
   */
  function applyTo(state, snapshot) {
    state.food = snapshot.food;
    state.wood = snapshot.wood;
    state.gold = snapshot.gold;
    state.age = snapshot.age;
    state.ageResearch = snapshot.ageResearch;
    state.score = snapshot.score;
    state.gathered = snapshot.gathered;
    state.kills = snapshot.kills;
    state.levelsCleared = snapshot.levelsCleared;
    state.elapsed = snapshot.elapsed;
    state.town.hp = snapshot.townHp;
    state.camp.hp = snapshot.campHp;
    state.waveTimer = snapshot.waveTimer;
    state.waveNumber = snapshot.waveNumber;
    state.trainKind = snapshot.trainKind;
    state.trainType = snapshot.trainType;
    state.trainLeft = snapshot.trainLeft;
    for (let i = 0; i < state.nodes.length; i++) state.nodes[i].amount = snapshot.nodes[i];

    for (let i = 0; i < state.units.length; i++) state.units[i].alive = false;
    state.free.length = 0;
    for (let i = MAX_UNITS - 1; i >= 0; i--) state.free.push(i);

    for (let i = 0; i < state.buildings.length; i++) state.buildings[i].alive = false;
    for (let i = 0; i < state.shots.length; i++) state.shots[i].alive = false;
    for (let i = 0; i < snapshot.buildings.length && i < state.buildings.length; i++) {
      const row = snapshot.buildings[i];
      const b = state.buildings[i];
      b.alive = true;
      b.kind = row[0]; b.x = row[1]; b.y = row[2];
      b.hp = row[3]; b.maxHp = row[4]; b.build = row[5];
      b.cooldown = 0; b.hurt = 0;
    }

    for (const row of snapshot.units) {
      const index = state.free.pop();
      if (index === undefined) break;
      const unit = state.units[index];
      unit.alive = true;
      unit.kind = row[0]; unit.type = row[1]; unit.act = row[2];
      unit.x = unit.px = row[3]; unit.y = unit.py = row[4];
      unit.hp = row[5]; unit.maxHp = row[6];
      unit.speed = row[7]; unit.damage = row[8]; unit.range = row[9];
      unit.tx = row[10]; unit.ty = row[11];
      unit.nodeId = row[12]; unit.carry = row[13]; unit.carryKind = row[14];
      unit.targetUnit = row[15]; unit.targetBuilding = row[16]; unit.targetStruct = row[17];
      unit.cooldown = row[18];
      unit.selected = false;
      unit.birth = 0;
      unit.hurt = 0;
      unit.gatherTimer = 0;
    }
    state.acc = 0;
    return true;
  }

  window.GreatEmpireSnapshot = Object.freeze({ SCHEMA, ROW, serialize, validate, applyTo });
})();
