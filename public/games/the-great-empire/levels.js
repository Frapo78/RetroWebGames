/**
 * The Great Empire — deterministic level definitions.
 *
 * Pure module: no DOM, no canvas, no platform globals. Given a level number it
 * always returns the same map and the same difficulty parameters, so replaying
 * level N reproduces an identical match and a saved run can be validated
 * against the layout signature it claims to belong to.
 *
 * The world is a fixed logical box (WORLD_W x WORLD_H units). Rendering scales
 * it to whatever viewport the device has; simulation never sees pixels. That is
 * what keeps a snapshot portable between a phone and a tablet.
 */
(() => {
  'use strict';

  const WORLD_W = 100;
  // 100x140 is close to the aspect of a phone play area once the HUD and the
  // command bar are subtracted, so the fixed camera wastes little space on the
  // sides. Bands below are expressed as fractions of it, never as pixels.
  const WORLD_H = 140;

  /** Levels per cycle. After the last one the campaign restarts harder. */
  const CYCLE = 20;

  /**
   * Small deterministic PRNG (mulberry32). Seeded per level, never per run:
   * layout randomness must be reproducible, not surprising.
   */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  /**
   * Resource nodes are placed on a jittered ring band around the middle of the
   * map, never on top of either base and never on top of each other. Villagers
   * must walk a real distance: that walk is the whole economic tension.
   */
  function placeNodes(random, count, kind, band, taken) {
    const out = [];
    let guard = 0;
    while (out.length < count && guard++ < 400) {
      const x = 12 + random() * (WORLD_W - 24);
      const y = band.top + random() * (band.bottom - band.top);
      let ok = true;
      for (const other of taken) {
        const dx = other.x - x;
        const dy = other.y - y;
        if (dx * dx + dy * dy < other.pad * other.pad) { ok = false; break; }
      }
      if (!ok) continue;
      const node = { kind, x, y };
      out.push(node);
      taken.push({ x, y, pad: 13 });
    }
    return out;
  }

  /**
   * Difficulty ramps inside a cycle and then again across cycles. Every curve is
   * bounded: a level 400 must still be playable, only brutal.
   */
  function tuning(level) {
    const cycle = Math.floor((level - 1) / CYCLE);
    const step = ((level - 1) % CYCLE) + 1;
    const c = 1 + cycle * 0.55;

    return {
      cycle,
      step,
      startFood: Math.round(clamp(150 - step * 3, 70, 150)),
      startGold: Math.round(clamp(95 - step * 2.5, 40, 95)),
      startVillagers: step <= 4 ? 3 : 2,
      campHp: Math.round((260 + step * 70) * c),
      campArmor: cycle * 0.6,
      waveInterval: clamp(20 - step * 0.5, 7, 20) / c,
      firstWaveDelay: clamp(26 - step * 0.7, 12, 26),
      raidersPerWave: Math.min(7, 1 + Math.floor(step / 4) + cycle),
      raiderHp: Math.round((30 + step * 4) * c),
      raiderDamage: +((4 + step * 0.45) * c).toFixed(2),
      raiderSpeed: +clamp(6.2 + step * 0.1, 6.2, 9.4).toFixed(2),
      foodNodes: 3 + (step % 3),
      goldNodes: 2 + (step % 2),
      nodeAmount: Math.round(320 + step * 26)
    };
  }

  /**
   * Build the complete, immutable descriptor of a level.
   * `signature` identifies the layout: a snapshot restored against a different
   * signature is refused rather than repaired.
   */
  function getLevel(level) {
    const n = Math.max(1, Math.floor(level) || 1);
    const t = tuning(n);
    const random = rng(n * 2654435761);

    const townCenter = { x: WORLD_W / 2, y: WORLD_H - 18, r: 7.5 };
    const enemyCamp = { x: WORLD_W / 2, y: 20, r: 8.5 };
    const taken = [
      { x: townCenter.x, y: townCenter.y, pad: 20 },
      { x: enemyCamp.x, y: enemyCamp.y, pad: 22 }
    ];

    const food = placeNodes(random, t.foodNodes, 'food', { top: WORLD_H * 0.38, bottom: WORLD_H * 0.80 }, taken);
    const gold = placeNodes(random, t.goldNodes, 'gold', { top: WORLD_H * 0.26, bottom: WORLD_H * 0.70 }, taken);
    const nodes = food.concat(gold).map((node, index) => ({
      id: index,
      kind: node.kind,
      x: +node.x.toFixed(3),
      y: +node.y.toFixed(3),
      amount: t.nodeAmount + (node.kind === 'gold' ? -60 : 0)
    }));

    let signature = n * 31;
    for (const node of nodes) {
      signature = (signature * 33 + Math.round(node.x * 7) + Math.round(node.y * 13) + (node.kind === 'gold' ? 5 : 2)) % 1000003;
    }

    return Object.freeze({
      level: n,
      cycle: t.cycle,
      signature,
      world: { w: WORLD_W, h: WORLD_H },
      townCenter,
      enemyCamp,
      nodes,
      startFood: t.startFood,
      startGold: t.startGold,
      startVillagers: t.startVillagers,
      campHp: t.campHp,
      campArmor: t.campArmor,
      waveInterval: +t.waveInterval.toFixed(3),
      firstWaveDelay: t.firstWaveDelay,
      raidersPerWave: t.raidersPerWave,
      raiderHp: t.raiderHp,
      raiderDamage: t.raiderDamage,
      raiderSpeed: t.raiderSpeed
    });
  }

  window.GreatEmpireLevels = Object.freeze({
    WORLD_W,
    WORLD_H,
    CYCLE,
    getLevel,
    /** Unit and building costs/stats live here so balance stays in one file. */
    RULES: Object.freeze({
      villagerCost: { food: 50, gold: 0 },
      soldierCost: { food: 60, gold: 35 },
      villagerTrainTime: 5.5,
      soldierTrainTime: 7.5,
      villagerHp: 34,
      soldierHp: 78,
      soldierDamage: 9.5,
      soldierSpeed: 8.4,
      villagerSpeed: 7.6,
      carryCapacity: 12,
      gatherRate: 5.2,
      attackRange: 3.2,
      attackInterval: 0.85,
      townCenterHp: 900,
      maxPopulation: 14
    })
  });
})();
