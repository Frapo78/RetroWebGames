/**
 * The Great Empire — authoritative logical state.
 *
 * This module owns what the game *is*, never how it looks or how it is driven.
 * The renderer reads it, systems mutate it, the resume adapter serializes it.
 * Nothing here touches the DOM.
 *
 * Allocation policy: every unit slot is created once, at construction, and then
 * reused through a free list. A match never allocates a unit, so the hot path
 * produces no garbage. There are at most a few dozen units, so proximity
 * queries stay a plain linear scan: a spatial index here would be complexity
 * without a measurement behind it, which the migration plan explicitly forbids.
 */
(() => {
  'use strict';

  const MAX_UNITS = 48;

  /** Unit kinds. Numeric so snapshots stay compact and comparisons stay cheap. */
  const KIND = Object.freeze({ VILLAGER: 0, SOLDIER: 1, RAIDER: 2 });

  /** Unit behaviours. A unit is always in exactly one. */
  const ACT = Object.freeze({
    IDLE: 0,
    MOVE: 1,
    TO_NODE: 2,
    GATHER: 3,
    RETURN: 4,
    ATTACK: 5
  });

  function makeUnit() {
    return {
      alive: false,
      kind: KIND.VILLAGER,
      act: ACT.IDLE,
      x: 0, y: 0,
      px: 0, py: 0,
      hp: 1, maxHp: 1,
      speed: 0,
      damage: 0,
      cooldown: 0,
      /** Move order destination, in world units. */
      tx: 0, ty: 0,
      /** Resource node currently worked, -1 when none. */
      nodeId: -1,
      /** Carried amount and its kind (0 food, 1 gold). */
      carry: 0,
      carryKind: 0,
      /** Combat target: unit slot index, or -1 for a building target. */
      targetUnit: -1,
      /** 0 = none, 1 = enemy camp, 2 = player town center. */
      targetBuilding: 0,
      gatherTimer: 0,
      selected: false,
      /** Spawn animation only — never gameplay authority. */
      birth: 0
    };
  }

  class GameState {
    constructor() {
      this.units = new Array(MAX_UNITS);
      for (let i = 0; i < MAX_UNITS; i++) this.units[i] = makeUnit();
      this.free = new Array(MAX_UNITS);
      this.reset();
    }

    reset() {
      for (let i = 0; i < MAX_UNITS; i++) this.units[i].alive = false;
      this.free.length = 0;
      for (let i = MAX_UNITS - 1; i >= 0; i--) this.free.push(i);

      this.level = 1;
      this.signature = 0;
      this.running = false;
      this.paused = false;
      this.outcome = '';

      this.food = 0;
      this.gold = 0;
      this.score = 0;
      this.gathered = 0;
      this.kills = 0;
      this.levelsCleared = 0;
      this.elapsed = 0;

      this.town = { hp: 1, maxHp: 1 };
      this.camp = { hp: 1, maxHp: 1, armor: 0 };
      this.nodes = [];

      this.waveTimer = 0;
      this.waveNumber = 0;

      /** Training queue: one slot, kind + remaining seconds. */
      this.trainKind = -1;
      this.trainLeft = 0;

      this.tuning = null;
      /** Transient UI signal consumed by the shell; not gameplay authority. */
      this.notice = '';
      this.noticeTimer = 0;
    }

    /** Load a level descriptor and build the starting position. */
    loadLevel(descriptor, rules, carry) {
      const keptScore = carry ? this.score : 0;
      const keptCleared = carry ? this.levelsCleared : 0;
      const keptKills = carry ? this.kills : 0;
      const keptGathered = carry ? this.gathered : 0;
      this.reset();
      this.score = keptScore;
      this.levelsCleared = keptCleared;
      this.kills = keptKills;
      this.gathered = keptGathered;

      this.level = descriptor.level;
      this.signature = descriptor.signature;
      this.food = descriptor.startFood;
      this.gold = descriptor.startGold;
      this.town.hp = this.town.maxHp = rules.townCenterHp;
      this.camp.hp = this.camp.maxHp = descriptor.campHp;
      this.camp.armor = descriptor.campArmor;
      this.nodes = descriptor.nodes.map(node => ({
        id: node.id,
        kind: node.kind,
        x: node.x,
        y: node.y,
        amount: node.amount,
        max: node.amount
      }));
      this.waveTimer = descriptor.firstWaveDelay;
      this.waveNumber = 0;
      this.tuning = descriptor;

      const tc = descriptor.townCenter;
      for (let i = 0; i < descriptor.startVillagers; i++) {
        const angle = (Math.PI * 2 * i) / descriptor.startVillagers - Math.PI / 2;
        this.spawn(KIND.VILLAGER, tc.x + Math.cos(angle) * 11, tc.y + Math.sin(angle) * 9, rules);
      }
      return this;
    }

    spawn(kind, x, y, rules, override) {
      const index = this.free.pop();
      if (index === undefined) return -1;
      const unit = this.units[index];
      unit.alive = true;
      unit.kind = kind;
      unit.act = ACT.IDLE;
      unit.x = unit.px = x;
      unit.y = unit.py = y;
      unit.nodeId = -1;
      unit.carry = 0;
      unit.carryKind = 0;
      unit.targetUnit = -1;
      unit.targetBuilding = 0;
      unit.cooldown = 0;
      unit.gatherTimer = 0;
      unit.selected = false;
      unit.birth = 0.45;
      if (kind === KIND.VILLAGER) {
        unit.maxHp = rules.villagerHp;
        unit.speed = rules.villagerSpeed;
        unit.damage = 2.5;
      } else if (kind === KIND.SOLDIER) {
        unit.maxHp = rules.soldierHp;
        unit.speed = rules.soldierSpeed;
        unit.damage = rules.soldierDamage;
      } else {
        unit.maxHp = override?.hp || 30;
        unit.speed = override?.speed || 6.5;
        unit.damage = override?.damage || 5;
      }
      unit.hp = unit.maxHp;
      return index;
    }

    kill(index) {
      const unit = this.units[index];
      if (!unit.alive) return;
      unit.alive = false;
      unit.selected = false;
      this.free.push(index);
      // Anyone chasing this slot must forget it, or it would attack a corpse
      // that a later spawn silently reuses.
      for (let i = 0; i < this.units.length; i++) {
        const other = this.units[i];
        if (other.alive && other.targetUnit === index) {
          other.targetUnit = -1;
          if (other.act === ACT.ATTACK && other.targetBuilding === 0) other.act = ACT.IDLE;
        }
      }
    }

    population() {
      let n = 0;
      for (let i = 0; i < this.units.length; i++) {
        const unit = this.units[i];
        if (unit.alive && unit.kind !== KIND.RAIDER) n++;
      }
      if (this.trainKind >= 0) n++;
      return n;
    }

    countKind(kind) {
      let n = 0;
      for (let i = 0; i < this.units.length; i++) {
        if (this.units[i].alive && this.units[i].kind === kind) n++;
      }
      return n;
    }

    node(id) {
      for (let i = 0; i < this.nodes.length; i++) {
        if (this.nodes[i].id === id) return this.nodes[i];
      }
      return null;
    }

    setNotice(text, seconds) {
      this.notice = text;
      this.noticeTimer = seconds || 1.6;
    }
  }

  window.GreatEmpireState = Object.freeze({ GameState, KIND, ACT, MAX_UNITS });
})();
