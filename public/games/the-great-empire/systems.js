/**
 * The Great Empire — simulation systems.
 *
 * Each system is a small function over the authoritative state. They run in a
 * fixed order inside a fixed timestep, so the match is deterministic for a
 * given sequence of orders and never depends on frame rate.
 *
 * Nothing here reads input or draws: orders arrive as plain mutations through
 * the `orders` API, and outcomes leave through a preallocated `events` object
 * so a tick allocates nothing.
 */
(() => {
  'use strict';

  const { KIND, ACT } = window.GreatEmpireState;

  /** Fixed simulation step. 30 Hz is plenty for an RTS and halves the work. */
  const STEP = 1 / 30;
  /** Never simulate more than this many steps after a stall (tab wake-up). */
  const MAX_STEPS = 6;

  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  };

  /** Move `unit` toward a point. Returns true when it has arrived. */
  function stepToward(unit, tx, ty, dt, stopAt) {
    const dx = tx - unit.x;
    const dy = ty - unit.y;
    const d = Math.hypot(dx, dy);
    if (d <= stopAt) return true;
    const move = unit.speed * dt;
    if (move >= d - stopAt) {
      unit.x = tx - (dx / d) * stopAt;
      unit.y = ty - (dy / d) * stopAt;
      return true;
    }
    unit.x += (dx / d) * move;
    unit.y += (dy / d) * move;
    return false;
  }

  /** Nearest living unit of `kind` within `range`, or -1. Linear by design. */
  function nearest(state, fromX, fromY, kind, range) {
    let best = -1;
    let bestD = range * range;
    const units = state.units;
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      if (!unit.alive || unit.kind !== kind) continue;
      const d = dist2(fromX, fromY, unit.x, unit.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function movementAndWork(state, rules, dt, events) {
    const units = state.units;
    const tc = state.tuning.townCenter;
    const camp = state.tuning.enemyCamp;

    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      if (!unit.alive) continue;
      unit.px = unit.x;
      unit.py = unit.y;
      if (unit.birth > 0) unit.birth = Math.max(0, unit.birth - dt);
      if (unit.cooldown > 0) unit.cooldown -= dt;

      switch (unit.act) {
        case ACT.MOVE:
          if (stepToward(unit, unit.tx, unit.ty, dt, 0.4)) unit.act = ACT.IDLE;
          break;

        case ACT.TO_NODE: {
          const node = state.node(unit.nodeId);
          if (!node || node.amount <= 0) { unit.act = ACT.IDLE; unit.nodeId = -1; break; }
          if (stepToward(unit, node.x, node.y, dt, 3)) {
            unit.act = ACT.GATHER;
            unit.gatherTimer = 0;
          }
          break;
        }

        case ACT.GATHER: {
          const node = state.node(unit.nodeId);
          if (!node || node.amount <= 0) {
            unit.act = unit.carry > 0 ? ACT.RETURN : ACT.IDLE;
            break;
          }
          const take = Math.min(rules.gatherRate * dt, node.amount, rules.carryCapacity - unit.carry);
          node.amount -= take;
          unit.carry += take;
          unit.carryKind = node.kind === 'gold' ? 1 : 0;
          if (unit.carry >= rules.carryCapacity - 0.001 || node.amount <= 0) unit.act = ACT.RETURN;
          break;
        }

        case ACT.RETURN:
          if (stepToward(unit, tc.x, tc.y, dt, tc.r + 1)) {
            const amount = Math.round(unit.carry);
            if (unit.carryKind === 1) state.gold += amount; else state.food += amount;
            state.gathered += amount;
            state.score += amount;
            unit.carry = 0;
            const node = state.node(unit.nodeId);
            unit.act = node && node.amount > 0 ? ACT.TO_NODE : ACT.IDLE;
            if (unit.act === ACT.IDLE) unit.nodeId = -1;
          }
          break;

        case ACT.ATTACK: {
          let tx;
          let ty;
          let reach;
          if (unit.targetBuilding === 1) { tx = camp.x; ty = camp.y; reach = camp.r + rules.attackRange; }
          else if (unit.targetBuilding === 2) { tx = tc.x; ty = tc.y; reach = tc.r + rules.attackRange; }
          else {
            const target = unit.targetUnit >= 0 ? units[unit.targetUnit] : null;
            if (!target || !target.alive) { unit.act = ACT.IDLE; unit.targetUnit = -1; break; }
            tx = target.x; ty = target.y; reach = rules.attackRange;
          }
          if (!stepToward(unit, tx, ty, dt, reach)) break;
          if (unit.cooldown > 0) break;
          unit.cooldown = rules.attackInterval;
          if (unit.targetBuilding === 1) {
            state.camp.hp -= Math.max(1, unit.damage - state.camp.armor);
            state.score += 1;
            if (state.camp.hp <= 0) { state.camp.hp = 0; events.cleared = true; }
          } else if (unit.targetBuilding === 2) {
            state.town.hp -= unit.damage;
            if (state.town.hp <= 0) { state.town.hp = 0; events.defeated = true; }
          } else {
            const target = units[unit.targetUnit];
            target.hp -= unit.damage;
            if (target.hp <= 0) {
              const wasRaider = target.kind === KIND.RAIDER;
              state.kill(unit.targetUnit);
              unit.targetUnit = -1;
              unit.act = ACT.IDLE;
              if (wasRaider) { state.kills++; state.score += 30; events.killed = true; }
              else events.lostUnit = true;
            }
          }
          break;
        }

        default:
          break;
      }
    }
  }

  /** Idle soldiers defend themselves; raiders always look for something to hit. */
  function autoEngage(state, rules) {
    const units = state.units;
    const tc = state.tuning.townCenter;
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      if (!unit.alive) continue;

      if (unit.kind === KIND.SOLDIER && unit.act === ACT.IDLE) {
        const enemy = nearest(state, unit.x, unit.y, KIND.RAIDER, 22);
        if (enemy >= 0) { unit.act = ACT.ATTACK; unit.targetUnit = enemy; unit.targetBuilding = 0; }
        continue;
      }

      if (unit.kind === KIND.RAIDER && (unit.act === ACT.IDLE || (unit.act === ACT.ATTACK && unit.targetUnit < 0 && unit.targetBuilding === 0))) {
        let prey = nearest(state, unit.x, unit.y, KIND.SOLDIER, 20);
        if (prey < 0) prey = nearest(state, unit.x, unit.y, KIND.VILLAGER, 16);
        if (prey >= 0) { unit.act = ACT.ATTACK; unit.targetUnit = prey; unit.targetBuilding = 0; }
        else { unit.act = ACT.ATTACK; unit.targetUnit = -1; unit.targetBuilding = 2; unit.tx = tc.x; unit.ty = tc.y; }
      }
    }
  }

  /** Enemy camp pressure. Waves keep coming until the camp falls. */
  function waves(state, dt, events) {
    if (state.camp.hp <= 0) return;
    state.waveTimer -= dt;
    if (state.waveTimer > 0) return;
    const t = state.tuning;
    state.waveTimer = t.waveInterval;
    state.waveNumber++;
    const camp = t.enemyCamp;
    for (let i = 0; i < t.raidersPerWave; i++) {
      const angle = (Math.PI * 2 * i) / t.raidersPerWave;
      state.spawn(
        KIND.RAIDER,
        camp.x + Math.cos(angle) * (camp.r + 2),
        camp.y + Math.sin(angle) * (camp.r + 2) + 2,
        null,
        { hp: t.raiderHp, speed: t.raiderSpeed, damage: t.raiderDamage }
      );
    }
    events.wave = true;
  }

  function training(state, rules, dt, events) {
    if (state.trainKind < 0) return;
    state.trainLeft -= dt;
    if (state.trainLeft > 0) return;
    const tc = state.tuning.townCenter;
    const angle = Math.random() * Math.PI * 2;
    const index = state.spawn(state.trainKind, tc.x + Math.cos(angle) * (tc.r + 3), tc.y + Math.sin(angle) * (tc.r + 3), rules);
    state.trainKind = -1;
    state.trainLeft = 0;
    if (index >= 0) events.trained = true;
  }

  /**
   * Advance the simulation by real elapsed time using a fixed accumulator.
   * Returns the number of steps actually simulated.
   */
  function advance(state, rules, elapsed, events) {
    let steps = 0;
    state.acc = (state.acc || 0) + elapsed;
    while (state.acc >= STEP && steps < MAX_STEPS) {
      state.acc -= STEP;
      steps++;
      state.elapsed += STEP;
      if (state.noticeTimer > 0) {
        state.noticeTimer -= STEP;
        if (state.noticeTimer <= 0) state.notice = '';
      }
      training(state, rules, STEP, events);
      waves(state, STEP, events);
      autoEngage(state, rules);
      movementAndWork(state, rules, STEP, events);
      if (events.cleared || events.defeated) break;
    }
    if (state.acc > STEP * MAX_STEPS) state.acc = 0;
    return steps;
  }

  /** Player orders. The only sanctioned way for input to touch the state. */
  const orders = Object.freeze({
    moveTo(state, index, x, y) {
      const unit = state.units[index];
      if (!unit.alive || unit.kind === KIND.RAIDER) return;
      unit.act = ACT.MOVE;
      unit.tx = x;
      unit.ty = y;
      unit.nodeId = -1;
      unit.targetUnit = -1;
      unit.targetBuilding = 0;
    },
    gather(state, index, nodeId) {
      const unit = state.units[index];
      if (!unit.alive || unit.kind !== KIND.VILLAGER) return;
      const node = state.node(nodeId);
      if (!node || node.amount <= 0) return;
      unit.nodeId = nodeId;
      unit.targetUnit = -1;
      unit.targetBuilding = 0;
      unit.act = unit.carry >= 1 ? ACT.RETURN : ACT.TO_NODE;
    },
    attackUnit(state, index, targetIndex) {
      const unit = state.units[index];
      const target = state.units[targetIndex];
      if (!unit.alive || !target || !target.alive || unit.kind === KIND.RAIDER) return;
      unit.act = ACT.ATTACK;
      unit.targetUnit = targetIndex;
      unit.targetBuilding = 0;
      unit.nodeId = -1;
    },
    attackCamp(state, index) {
      const unit = state.units[index];
      if (!unit.alive || unit.kind === KIND.RAIDER) return;
      unit.act = ACT.ATTACK;
      unit.targetUnit = -1;
      unit.targetBuilding = 1;
      unit.nodeId = -1;
    },
    train(state, rules, kind) {
      if (state.trainKind >= 0) return 'busy';
      if (state.population() >= rules.maxPopulation) return 'pop';
      const cost = kind === KIND.SOLDIER ? rules.soldierCost : rules.villagerCost;
      if (state.food < cost.food || state.gold < cost.gold) return 'cost';
      state.food -= cost.food;
      state.gold -= cost.gold;
      state.trainKind = kind;
      state.trainLeft = kind === KIND.SOLDIER ? rules.soldierTrainTime : rules.villagerTrainTime;
      return 'ok';
    }
  });

  window.GreatEmpireSystems = Object.freeze({ STEP, advance, orders, nearest });
})();
