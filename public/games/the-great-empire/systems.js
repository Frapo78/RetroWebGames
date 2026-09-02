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

  const { KIND, TYPE, BUILD, ACT } = window.GreatEmpireState;

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
      if (unit.hurt > 0) unit.hurt = Math.max(0, unit.hurt - dt);
      if (unit.cooldown > 0) unit.cooldown -= dt;

      switch (unit.act) {
        case ACT.MOVE:
          unit.face = unit.tx < unit.x ? -1 : 1;
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
          unit.carryKind = node.kind === 'gold' ? 1 : node.kind === 'wood' ? 2 : 0;
          if (unit.carry >= rules.carryCapacity - 0.001 || node.amount <= 0) unit.act = ACT.RETURN;
          break;
        }

        case ACT.RETURN:
          if (stepToward(unit, tc.x, tc.y, dt, tc.r + 1)) {
            const amount = Math.round(unit.carry);
            if (unit.carryKind === 1) state.gold += amount;
            else if (unit.carryKind === 2) state.wood += amount;
            else state.food += amount;
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
          const reachOf = unit.range || rules.attackRange;
          if (unit.targetBuilding === 1) { tx = camp.x; ty = camp.y; reach = camp.r + reachOf; }
          else if (unit.targetBuilding === 2) { tx = tc.x; ty = tc.y; reach = tc.r + reachOf; }
          else if (unit.targetBuilding === 3) {
            const struct = unit.targetStruct >= 0 ? state.buildings[unit.targetStruct] : null;
            if (!struct || !struct.alive) { unit.act = ACT.IDLE; unit.targetBuilding = 0; unit.targetStruct = -1; break; }
            tx = struct.x; ty = struct.y; reach = 4 + reachOf;
          }
          else {
            const target = unit.targetUnit >= 0 ? units[unit.targetUnit] : null;
            if (!target || !target.alive) { unit.act = ACT.IDLE; unit.targetUnit = -1; break; }
            tx = target.x; ty = target.y; reach = reachOf;
          }
          unit.face = tx < unit.x ? -1 : 1;
          if (!stepToward(unit, tx, ty, dt, reach)) break;
          if (unit.cooldown > 0) break;
          unit.cooldown = rules.attackInterval;
          // Ranged units send a projectile: damage lands when it arrives, so a
          // target that dies first simply survives the shot as a miss.
          if (reachOf > 6) {
            const shot = state.fireShot(unit.x, unit.y, tx, ty, unit.damage, unit.targetBuilding === 0 ? unit.targetUnit : -1, unit.targetBuilding, unit.kind === KIND.RAIDER);
            if (shot >= 0 && unit.targetBuilding === 3) state.shots[shot].target = unit.targetStruct;
            break;
          }
          if (unit.targetBuilding === 1) {
            state.camp.hp -= Math.max(1, unit.damage - state.camp.armor);
            state.score += 1;
            if (state.camp.hp <= 0) { state.camp.hp = 0; events.cleared = true; }
          } else if (unit.targetBuilding === 2) {
            state.town.hp -= unit.damage;
            if (state.town.hp <= 0) { state.town.hp = 0; events.defeated = true; }
          } else if (unit.targetBuilding === 3) {
            const struct = state.buildings[unit.targetStruct];
            struct.hp -= unit.damage;
            struct.hurt = 0.18;
            if (struct.hp <= 0) { struct.alive = false; unit.act = ACT.IDLE; unit.targetBuilding = 0; unit.targetStruct = -1; events.lostBuilding = true; }
          } else {
            const target = units[unit.targetUnit];
            target.hp -= unit.damage;
            target.hurt = 0.18;
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
        if (prey >= 0) { unit.act = ACT.ATTACK; unit.targetUnit = prey; unit.targetBuilding = 0; unit.targetStruct = -1; continue; }
        // A tower on the way is a real obstacle, so raiders knock it down
        // instead of walking past it forever.
        let struct = -1;
        let structD = 18 * 18;
        for (let b = 0; b < state.buildings.length; b++) {
          const building = state.buildings[b];
          if (!building.alive) continue;
          const dx = building.x - unit.x;
          const dy = building.y - unit.y;
          const d = dx * dx + dy * dy;
          if (d < structD) { structD = d; struct = b; }
        }
        if (struct >= 0) { unit.act = ACT.ATTACK; unit.targetUnit = -1; unit.targetBuilding = 3; unit.targetStruct = struct; continue; }
        unit.act = ACT.ATTACK; unit.targetUnit = -1; unit.targetBuilding = 2; unit.targetStruct = -1; unit.tx = tc.x; unit.ty = tc.y;
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
      // From the archer level on, every third raider shoots instead of charging.
      const ranged = t.step >= t.raiderArcherFrom && i % 3 === 2;
      state.spawn(
        KIND.RAIDER,
        camp.x + Math.cos(angle) * (camp.r + 2),
        camp.y + Math.sin(angle) * (camp.r + 2) + 2,
        null,
        ranged
          ? { hp: Math.round(t.raiderHp * 0.75), speed: t.raiderSpeed * 0.92, damage: t.raiderDamage * 0.85, range: 20, type: TYPE.RAIDER_ARCHER }
          : { hp: t.raiderHp, speed: t.raiderSpeed, damage: t.raiderDamage, range: 3.2, type: TYPE.RAIDER }
      );
    }
    events.wave = true;
  }

  /** Buildings finish themselves, then towers defend the area around them. */
  function structures(state, rules, dt, events) {
    const buildings = state.buildings;
    const tower = rules.buildings.tower;
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (!b.alive) continue;
      if (b.hurt > 0) b.hurt = Math.max(0, b.hurt - dt);
      if (b.build > 0) {
        b.build -= dt;
        if (b.build <= 0) { b.build = 0; events.built = true; }
        continue;
      }
      if (b.hp <= 0) { b.alive = false; events.lostBuilding = true; continue; }
      if (b.kind !== BUILD.TOWER) continue;
      b.cooldown -= dt;
      if (b.cooldown > 0) continue;
      const prey = nearest(state, b.x, b.y, KIND.RAIDER, tower.range);
      if (prey < 0) continue;
      b.cooldown = tower.interval;
      const target = state.units[prey];
      state.fireShot(b.x, b.y - 2, target.x, target.y, tower.damage, prey, 0, false);
    }
  }

  /** Projectiles in flight. Damage is applied on arrival, never on release. */
  function projectiles(state, dt, events) {
    const shots = state.shots;
    const tc = state.tuning.townCenter;
    const camp = state.tuning.enemyCamp;
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i];
      if (!s.alive) continue;
      s.t += dt;
      if (s.t < s.dur) continue;
      s.alive = false;
      if (s.building === 1) {
        state.camp.hp -= Math.max(1, s.damage - state.camp.armor);
        state.score += 1;
        if (state.camp.hp <= 0) { state.camp.hp = 0; events.cleared = true; }
        continue;
      }
      if (s.building === 2) {
        state.town.hp -= s.damage;
        if (state.town.hp <= 0) { state.town.hp = 0; events.defeated = true; }
        continue;
      }
      if (s.building === 3) {
        const struct = s.target >= 0 ? state.buildings[s.target] : null;
        if (struct && struct.alive) {
          struct.hp -= s.damage;
          struct.hurt = 0.18;
          if (struct.hp <= 0) { struct.alive = false; events.lostBuilding = true; }
        }
        continue;
      }
      const target = s.target >= 0 ? state.units[s.target] : null;
      if (!target || !target.alive) continue;
      target.hp -= s.damage;
      target.hurt = 0.18;
      if (target.hp <= 0) {
        const wasRaider = target.kind === KIND.RAIDER;
        state.kill(s.target);
        if (wasRaider) { state.kills++; state.score += 30; events.killed = true; }
        else events.lostUnit = true;
      }
    }
  }

  /** Age advancement is researched at the town center, like the original. */
  function research(state, rules, dt, events) {
    if (state.ageResearch <= 0) return;
    state.ageResearch -= dt;
    if (state.ageResearch > 0) return;
    state.ageResearch = 0;
    state.age++;
    state.score += 150;
    // Everything already trained gets the new age's bonus, so advancing is
    // felt immediately instead of only applying to future units.
    const previous = rules.ages[state.age - 1].bonus;
    const factor = rules.ages[state.age].bonus / previous;
    for (let i = 0; i < state.units.length; i++) {
      const unit = state.units[i];
      if (!unit.alive || unit.kind !== KIND.SOLDIER) continue;
      unit.maxHp *= factor;
      unit.hp = Math.min(unit.maxHp, unit.hp * factor);
      unit.damage *= factor;
    }
    events.aged = true;
  }

  function training(state, rules, dt, events) {
    if (state.trainKind < 0) return;
    state.trainLeft -= dt;
    if (state.trainLeft > 0) return;
    const tc = state.tuning.townCenter;
    const angle = Math.random() * Math.PI * 2;
    const x = tc.x + Math.cos(angle) * (tc.r + 3);
    const y = tc.y + Math.sin(angle) * (tc.r + 3);
    const index = state.trainKind === KIND.VILLAGER
      ? state.spawn(KIND.VILLAGER, x, y, rules)
      : state.spawn(KIND.SOLDIER, x, y, rules, unitTemplate(rules, state.age, state.trainType));
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
      research(state, rules, STEP, events);
      training(state, rules, STEP, events);
      waves(state, STEP, events);
      autoEngage(state, rules);
      movementAndWork(state, rules, STEP, events);
      structures(state, rules, STEP, events);
      projectiles(state, STEP, events);
      if (events.cleared || events.defeated) break;
    }
    if (state.acc > STEP * MAX_STEPS) state.acc = 0;
    return steps;
  }

  const UNIT_KEYS = ['clubman', 'archer', 'cavalry'];

  /** Stats of a military unit, already scaled by the current age bonus. */
  function unitTemplate(rules, age, type) {
    const spec = rules.units[UNIT_KEYS[type]] || rules.units.clubman;
    const bonus = rules.ages[Math.min(age, rules.ages.length - 1)].bonus;
    return {
      type,
      hp: spec.hp * bonus,
      damage: spec.damage * bonus,
      speed: spec.speed,
      range: spec.range
    };
  }

  const affordable = (state, cost) => state.food >= (cost.food || 0) && state.wood >= (cost.wood || 0) && state.gold >= (cost.gold || 0);
  const pay = (state, cost) => { state.food -= (cost.food || 0); state.wood -= (cost.wood || 0); state.gold -= (cost.gold || 0); };

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
    /**
     * Train a unit. `type` is ignored for villagers; for military units it is
     * refused when the current age has not unlocked it yet.
     */
    train(state, rules, kind, type) {
      if (state.trainKind >= 0) return 'busy';
      if (state.population() >= state.populationCap(rules)) return 'pop';
      if (kind === KIND.VILLAGER) {
        if (!affordable(state, rules.villagerCost)) return 'cost';
        pay(state, rules.villagerCost);
        state.trainKind = KIND.VILLAGER;
        state.trainType = 0;
        state.trainLeft = rules.villagerTrainTime;
        return 'ok';
      }
      const key = UNIT_KEYS[type];
      const spec = rules.units[key];
      if (!spec) return 'cost';
      if (state.age < spec.age) return 'age';
      if (!affordable(state, spec.cost)) return 'cost';
      pay(state, spec.cost);
      state.trainKind = KIND.SOLDIER;
      state.trainType = type;
      state.trainLeft = spec.train;
      return 'ok';
    },

    /** Place a building. Villagers do not walk to it: on a phone that extra
     *  step costs more attention than it adds depth. */
    build(state, rules, kind, x, y) {
      const spec = kind === BUILD.TOWER ? rules.buildings.tower : rules.buildings.house;
      let count = 0;
      for (let i = 0; i < state.buildings.length; i++) if (state.buildings[i].alive) count++;
      if (count >= rules.maxBuildings) return 'full';
      if (!affordable(state, spec.cost)) return 'cost';

      const world = state.tuning.world;
      const tc = state.tuning.townCenter;
      const camp = state.tuning.enemyCamp;

      const fits = (cx, cy) => {
        if (cx < 5 || cy < 5 || cx > world.w - 5 || cy > world.h - 5) return false;
        if (dist2(cx, cy, camp.x, camp.y) < (camp.r + 12) ** 2) return false;
        if (dist2(cx, cy, tc.x, tc.y) < (tc.r + spec.r + 2) ** 2) return false;
        for (let i = 0; i < state.nodes.length; i++) {
          const node = state.nodes[i];
          if (node.amount > 0 && dist2(cx, cy, node.x, node.y) < (spec.r + 3) ** 2) return false;
        }
        for (let i = 0; i < state.buildings.length; i++) {
          const b = state.buildings[i];
          if (b.alive && dist2(cx, cy, b.x, b.y) < (spec.r * 2 + 1) ** 2) return false;
        }
        return true;
      };

      // A fingertip is far wider than a building, and the map is dense with
      // trees near home. Rather than refusing a tap that is nearly right, slide
      // the site to the closest free ground within a short radius; only give up
      // when the whole neighbourhood is occupied.
      let px = x;
      let py = y;
      if (!fits(px, py)) {
        let found = false;
        for (let radius = 3; radius <= 12 && !found; radius += 3) {
          for (let step = 0; step < 12 && !found; step++) {
            const a = (Math.PI * 2 * step) / 12;
            const cx = x + Math.cos(a) * radius;
            const cy = y + Math.sin(a) * radius;
            if (fits(cx, cy)) { px = cx; py = cy; found = true; }
          }
        }
        if (!found) return 'space';
      }

      if (state.spawnBuilding(kind, px, py, rules) < 0) return 'full';
      pay(state, spec.cost);
      return 'ok';
    },

    /** Advance to the next age: pay, then wait out the research time. */
    advanceAge(state, rules) {
      if (state.ageResearch > 0) return 'busy';
      const next = state.age + 1;
      if (next >= rules.ages.length) return 'max';
      const spec = rules.ages[next];
      if (!affordable(state, spec.cost)) return 'cost';
      pay(state, spec.cost);
      state.ageResearch = spec.research;
      return 'ok';
    }
  });

  window.GreatEmpireSystems = Object.freeze({ STEP, advance, orders, nearest, unitTemplate, UNIT_KEYS, affordable });
})();
