/**
 * The Great Empire — renderer.
 *
 * Reads the state, never writes it. The world is a fixed logical box mapped to
 * the canvas with a uniform scale, so the same match looks identical on any
 * device and world coordinates in a snapshot stay meaningful.
 *
 * Cost control: terrain, including its scattered detail, is painted once into
 * an offscreen canvas and repainted only on resize. The per-frame pass draws
 * flat shapes and never uses shadow blur, which is the single most expensive
 * thing a Canvas 2D game can do per entity.
 *
 * Everything animated here derives from simulation time, never from a private
 * counter, so pausing the game freezes the picture with it.
 */
(() => {
  'use strict';

  const { KIND, TYPE, BUILD, ACT } = window.GreatEmpireState;

  const PALETTE = {
    grass: '#22412c',
    grassAlt: '#1c3624',
    grassLight: '#2a4d33',
    road: '#4a4130',
    player: '#5ab4ff',
    playerDark: '#1b4d75',
    playerRoof: '#2f7fbe',
    enemy: '#ff5f4f',
    enemyDark: '#7a2018',
    wood: '#8b5a2b',
    leaf: '#3f8a45',
    leafDark: '#2f6a35',
    berry: '#d94f6a',
    food: '#a8de5c',
    gold: '#ffd23f',
    rock: '#7d8a86',
    stone: '#cdd8d2',
    ink: '#050f09',
    hp: '#6ee87f'
  };

  /** Deterministic scatter, so terrain detail is stable across repaints. */
  function noise(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x9e3779b9) >>> 0;
      let t = Math.imul(a ^ (a >>> 16), 0x21f0aaad);
      t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
      return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
    };
  }

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.terrain = document.createElement('canvas');
      this.tctx = this.terrain.getContext('2d');
      this.w = 0;
      this.h = 0;
      this.dpr = 1;
      this.scale = 1;
      this.ox = 0;
      this.oy = 0;
      this.world = { w: 100, h: 140 };
      /** Set by the shell while a build order is pending. */
      this.ghost = null;
    }

    resize(world) {
      if (world) this.world = world;
      const rect = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = Math.max(1, rect.width);
      this.h = Math.max(1, rect.height);
      this.canvas.width = Math.floor(this.w * this.dpr);
      this.canvas.height = Math.floor(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.scale = Math.min(this.w / this.world.w, this.h / this.world.h);
      this.ox = (this.w - this.world.w * this.scale) / 2;
      this.oy = (this.h - this.world.h * this.scale) / 2;
      this.paintTerrain();
    }

    sx(x) { return this.ox + x * this.scale; }
    sy(y) { return this.oy + y * this.scale; }
    wx(px) { return (px - this.ox) / this.scale; }
    wy(py) { return (py - this.oy) / this.scale; }

    paintTerrain() {
      const t = this.terrain;
      t.width = Math.floor(this.w * this.dpr);
      t.height = Math.floor(this.h * this.dpr);
      const c = this.tctx;
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const s = this.scale;
      const rnd = noise(0x51ede);

      c.fillStyle = PALETTE.grass;
      c.fillRect(0, 0, this.w, this.h);

      // Irregular meadow patches rather than hard stripes: bands read as a
      // rendering artifact, patches read as ground.
      c.globalAlpha = 0.5;
      for (let i = 0; i < 120; i++) {
        const x = rnd() * this.w;
        const y = rnd() * this.h;
        const r = (1.2 + rnd() * 3.4) * s;
        c.fillStyle = rnd() > 0.5 ? PALETTE.grassAlt : PALETTE.grassLight;
        c.beginPath();
        c.ellipse(x, y, r, r * 0.6, rnd() * Math.PI, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;

      // The worn road between the two bases names the lane the fight uses.
      const mid = this.sx(this.world.w / 2);
      c.strokeStyle = PALETTE.road;
      c.lineWidth = Math.max(3, 9 * s);
      c.globalAlpha = 0.55;
      c.beginPath();
      c.moveTo(mid, this.sy(16));
      for (let y = 16; y <= this.world.h - 14; y += 8) {
        c.lineTo(mid + Math.sin(y * 0.35) * 2.2 * s, this.sy(y));
      }
      c.stroke();
      c.globalAlpha = 1;

      for (let i = 0; i < 130; i++) {
        const x = rnd() * this.w;
        const y = rnd() * this.h;
        if (rnd() > 0.72) {
          c.globalAlpha = 0.25;
          c.fillStyle = PALETTE.rock;
          c.beginPath();
          c.ellipse(x, y, 0.7 * s, 0.45 * s, 0, 0, Math.PI * 2);
          c.fill();
          c.globalAlpha = 1;
        } else {
          c.strokeStyle = 'rgba(150,200,120,.16)';
          c.lineWidth = Math.max(1, 0.28 * s);
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + (rnd() - 0.5) * 1.6 * s, y - (0.8 + rnd()) * s);
          c.stroke();
        }
      }

      // Darken outside the playable box so its border reads without a drawn line.
      const w = this.world.w * s;
      const h = this.world.h * s;
      c.fillStyle = 'rgba(2,9,5,.34)';
      if (this.ox > 0) { c.fillRect(0, 0, this.ox, this.h); c.fillRect(this.ox + w, 0, this.w, this.h); }
      if (this.oy > 0) { c.fillRect(0, 0, this.w, this.oy); c.fillRect(0, this.oy + h, this.w, this.h); }
    }

    shadow(px, py, rx) {
      const c = this.ctx;
      c.fillStyle = 'rgba(0,0,0,.34)';
      c.beginPath();
      c.ellipse(px, py, rx, rx * 0.42, 0, 0, Math.PI * 2);
      c.fill();
    }

    bar(x, y, width, ratio, color) {
      const c = this.ctx;
      const h = Math.max(2.5, 1.1 * this.scale);
      c.fillStyle = 'rgba(0,0,0,.6)';
      c.fillRect(x - width / 2 - 1, y - 1, width + 2, h + 2);
      c.fillStyle = color;
      c.fillRect(x - width / 2, y, width * Math.max(0, Math.min(1, ratio)), h);
    }

    label(text, px, py, color) {
      const c = this.ctx;
      c.font = `700 ${Math.max(7, Math.round(2.7 * this.scale))}px ui-monospace,Menlo,monospace`;
      c.textAlign = 'center';
      c.lineWidth = Math.max(2, 0.8 * this.scale);
      c.strokeStyle = 'rgba(3,12,7,.85)';
      c.strokeText(text, px, py);
      c.fillStyle = color;
      c.fillText(text, px, py);
    }

    // ── Resource nodes ─────────────────────────────────────────────────────
    node(node) {
      const c = this.ctx;
      const px = this.sx(node.x);
      const py = this.sy(node.y);
      const s = this.scale;
      const ratio = node.amount / node.max;

      if (node.kind === 'wood') {
        // A grove that visibly thins as it is felled: in Age of Empires wood
        // never grows back, and the map should say so.
        const trees = Math.max(1, Math.round(1 + ratio * 3));
        this.shadow(px, py + 1.4 * s, 4.2 * s);
        for (let i = 0; i < trees; i++) {
          const a = (Math.PI * 2 * i) / trees + 0.6;
          const tx = px + (i ? Math.cos(a) * 2.3 * s : 0);
          const ty = py + (i ? Math.sin(a) * 1.5 * s : 0);
          c.fillStyle = PALETTE.wood;
          c.fillRect(tx - 0.35 * s, ty - 0.2 * s, 0.7 * s, 2.2 * s);
          c.fillStyle = i % 2 ? PALETTE.leafDark : PALETTE.leaf;
          c.beginPath();
          c.arc(tx, ty - 1.5 * s, 2.1 * s, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = 'rgba(255,255,255,.10)';
          c.beginPath();
          c.arc(tx - 0.6 * s, ty - 2.1 * s, 0.9 * s, 0, Math.PI * 2);
          c.fill();
        }
      } else if (node.kind === 'gold') {
        this.shadow(px, py + 1.2 * s, 3.6 * s);
        c.fillStyle = PALETTE.rock;
        c.beginPath();
        c.moveTo(px - 3.4 * s, py + 1.4 * s);
        c.lineTo(px - 1.6 * s, py - 2.4 * s);
        c.lineTo(px + 1.8 * s, py - 2.6 * s);
        c.lineTo(px + 3.4 * s, py + 1.4 * s);
        c.closePath();
        c.fill();
        c.fillStyle = PALETTE.gold;
        c.globalAlpha = 0.4 + ratio * 0.6;
        for (let i = 0; i < 3; i++) {
          const a = (Math.PI * 2 * i) / 3 - 0.5;
          c.beginPath();
          c.arc(px + Math.cos(a) * 1.3 * s, py + Math.sin(a) * 0.9 * s, 0.72 * s, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
      } else {
        // Berry bushes: the forage food of the early game.
        this.shadow(px, py + 1.2 * s, 3.4 * s);
        c.fillStyle = PALETTE.leafDark;
        c.beginPath();
        c.arc(px, py, 2.9 * s, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = PALETTE.leaf;
        c.beginPath();
        c.arc(px - 0.8 * s, py - 0.7 * s, 2 * s, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = PALETTE.berry;
        c.globalAlpha = 0.35 + ratio * 0.65;
        for (let i = 0; i < 5; i++) {
          const a = (Math.PI * 2 * i) / 5 + 0.3;
          c.beginPath();
          c.arc(px + Math.cos(a) * 1.5 * s, py + Math.sin(a) * 1.2 * s, 0.52 * s, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;
      }

      if (ratio < 0.999) {
        const tint = node.kind === 'gold' ? PALETTE.gold : node.kind === 'wood' ? PALETTE.wood : PALETTE.food;
        this.bar(px, py + 4.4 * s, 6 * s, ratio, tint);
      }
    }

    // ── Bases ──────────────────────────────────────────────────────────────
    townCenter(x, y, r, hp, maxHp) {
      const c = this.ctx;
      const px = this.sx(x);
      const py = this.sy(y);
      const rr = r * this.scale;
      this.shadow(px, py + rr * 0.8, rr * 1.05);

      c.fillStyle = PALETTE.stone;
      c.beginPath();
      c.roundRect(px - rr * 0.92, py - rr * 0.35, rr * 1.84, rr * 1.2, rr * 0.14);
      c.fill();
      c.fillStyle = 'rgba(0,0,0,.18)';
      for (let i = 0; i < 3; i++) c.fillRect(px - rr * 0.92, py - rr * 0.1 + i * rr * 0.4, rr * 1.84, rr * 0.06);

      c.fillStyle = PALETTE.playerRoof;
      c.beginPath();
      c.moveTo(px - rr * 1.05, py - rr * 0.32);
      c.lineTo(px, py - rr * 1.12);
      c.lineTo(px + rr * 1.05, py - rr * 0.32);
      c.closePath();
      c.fill();
      c.fillStyle = PALETTE.playerDark;
      c.beginPath();
      c.moveTo(px, py - rr * 1.12);
      c.lineTo(px + rr * 1.05, py - rr * 0.32);
      c.lineTo(px, py - rr * 0.32);
      c.closePath();
      c.fill();

      c.fillStyle = PALETTE.ink;
      c.beginPath();
      c.roundRect(px - rr * 0.22, py + rr * 0.28, rr * 0.44, rr * 0.57, rr * 0.2);
      c.fill();

      c.fillStyle = PALETTE.stone;
      c.fillRect(px - rr * 0.05, py - rr * 1.85, rr * 0.1, rr * 0.8);
      c.fillStyle = PALETTE.player;
      c.beginPath();
      c.moveTo(px + rr * 0.05, py - rr * 1.85);
      c.lineTo(px + rr * 0.78, py - rr * 1.62);
      c.lineTo(px + rr * 0.05, py - rr * 1.4);
      c.closePath();
      c.fill();

      this.bar(px, py + rr * 1.02, rr * 1.9, hp / maxHp, PALETTE.hp);
      this.label('CENTRO CITTÀ', px, py + rr * 1.85, 'rgba(233,247,236,.85)');
    }

    enemyCamp(x, y, r, hp, maxHp) {
      const c = this.ctx;
      const px = this.sx(x);
      const py = this.sy(y);
      const rr = r * this.scale;
      this.shadow(px, py + rr * 0.75, rr * 1.05);

      // Palisade stakes: a camp, not a castle.
      c.fillStyle = PALETTE.wood;
      for (let i = -3; i <= 3; i++) {
        c.fillRect(px + i * rr * 0.3 - rr * 0.06, py + rr * 0.1, rr * 0.12, rr * 0.62);
      }
      for (const [dx, scale] of [[-0.55, 0.82], [0.55, 0.82], [0, 1]]) {
        const tx = px + dx * rr * 1.1;
        c.fillStyle = PALETTE.enemyDark;
        c.beginPath();
        c.moveTo(tx - rr * 0.6 * scale, py + rr * 0.2);
        c.lineTo(tx, py - rr * 0.95 * scale);
        c.lineTo(tx + rr * 0.6 * scale, py + rr * 0.2);
        c.closePath();
        c.fill();
        c.fillStyle = PALETTE.enemy;
        c.beginPath();
        c.moveTo(tx - rr * 0.6 * scale, py + rr * 0.2);
        c.lineTo(tx, py - rr * 0.95 * scale);
        c.lineTo(tx - rr * 0.1 * scale, py + rr * 0.2);
        c.closePath();
        c.fill();
      }

      c.fillStyle = PALETTE.stone;
      c.fillRect(px - rr * 0.05, py - rr * 1.75, rr * 0.1, rr * 0.8);
      c.fillStyle = PALETTE.enemy;
      c.beginPath();
      c.moveTo(px + rr * 0.05, py - rr * 1.75);
      c.lineTo(px + rr * 0.75, py - rr * 1.52);
      c.lineTo(px + rr * 0.05, py - rr * 1.3);
      c.closePath();
      c.fill();

      this.bar(px, py + rr * 0.95, rr * 1.9, hp / maxHp, PALETTE.enemy);
      this.label('ACCAMPAMENTO', px, py + rr * 1.75, 'rgba(255,214,208,.9)');
    }

    // ── Player buildings ───────────────────────────────────────────────────
    building(b, rules) {
      const c = this.ctx;
      const px = this.sx(b.x);
      const py = this.sy(b.y);
      const s = this.scale;
      const spec = b.kind === BUILD.TOWER ? rules.buildings.tower : rules.buildings.house;
      const rr = spec.r * s;
      this.shadow(px, py + rr * 0.75, rr * 0.95);

      if (b.build > 0) {
        // Scaffolding: an unfinished building must not look like a working one.
        c.strokeStyle = PALETTE.wood;
        c.lineWidth = Math.max(1.5, 0.4 * s);
        c.strokeRect(px - rr * 0.8, py - rr * 0.7, rr * 1.6, rr * 1.4);
        c.beginPath();
        c.moveTo(px - rr * 0.8, py + rr * 0.7);
        c.lineTo(px + rr * 0.8, py - rr * 0.7);
        c.stroke();
        this.bar(px, py + rr * 1.05, rr * 1.6, 1 - b.build / spec.build, PALETTE.gold);
        return;
      }

      if (b.kind === BUILD.TOWER) {
        c.fillStyle = PALETTE.stone;
        c.beginPath();
        c.roundRect(px - rr * 0.5, py - rr * 1.1, rr, rr * 1.9, rr * 0.12);
        c.fill();
        c.fillStyle = 'rgba(0,0,0,.2)';
        c.fillRect(px - rr * 0.5, py - rr * 0.4, rr, rr * 0.12);
        c.fillStyle = PALETTE.ink;
        c.fillRect(px - rr * 0.14, py - rr * 0.85, rr * 0.28, rr * 0.4);
        c.fillStyle = PALETTE.playerRoof;
        c.beginPath();
        c.moveTo(px - rr * 0.66, py - rr * 1.08);
        c.lineTo(px, py - rr * 1.72);
        c.lineTo(px + rr * 0.66, py - rr * 1.08);
        c.closePath();
        c.fill();
      } else {
        c.fillStyle = '#d8cdb4';
        c.beginPath();
        c.roundRect(px - rr * 0.78, py - rr * 0.28, rr * 1.56, rr * 1.02, rr * 0.1);
        c.fill();
        c.fillStyle = PALETTE.wood;
        c.beginPath();
        c.moveTo(px - rr * 0.92, py - rr * 0.26);
        c.lineTo(px, py - rr * 1.0);
        c.lineTo(px + rr * 0.92, py - rr * 0.26);
        c.closePath();
        c.fill();
        c.fillStyle = PALETTE.ink;
        c.fillRect(px - rr * 0.16, py + rr * 0.2, rr * 0.32, rr * 0.54);
      }

      if (b.hurt > 0) {
        c.fillStyle = `rgba(255,110,90,${Math.min(0.5, b.hurt * 2.4)})`;
        c.fillRect(px - rr, py - rr * 1.8, rr * 2, rr * 2.8);
      }
      if (b.hp < b.maxHp) this.bar(px, py + rr * 1.0, rr * 1.5, b.hp / b.maxHp, PALETTE.hp);
    }

    // ── Units ──────────────────────────────────────────────────────────────
    unit(unit, alpha, clock) {
      const c = this.ctx;
      const x = unit.px + (unit.x - unit.px) * alpha;
      const y = unit.py + (unit.y - unit.py) * alpha;
      const px = this.sx(x);
      const py = this.sy(y);
      const s = this.scale;
      const grow = unit.birth > 0 ? 1 - unit.birth / 0.45 : 1;
      const moving = unit.act === ACT.MOVE || unit.act === ACT.TO_NODE || unit.act === ACT.RETURN;
      const bob = moving ? Math.sin(clock * 11 + x) * 0.32 * s : 0;

      const hostile = unit.kind === KIND.RAIDER;
      const big = unit.type === TYPE.CAVALRY;
      const base = unit.kind === KIND.VILLAGER ? 2.6 : big ? 3.5 : 3.0;
      const r = base * s * (0.45 + grow * 0.55);
      const face = unit.face || 1;

      if (unit.selected) {
        c.strokeStyle = '#ffe066';
        c.lineWidth = Math.max(2, 0.55 * s);
        c.beginPath();
        c.ellipse(px, py + r * 0.72, r * 1.55, r * 0.72, 0, 0, Math.PI * 2);
        c.stroke();
      }

      this.shadow(px, py + r * 0.74, r * 0.9);

      let body = '#7fd4ff';
      if (unit.kind === KIND.VILLAGER) body = '#e0c48a';
      else if (unit.type === TYPE.ARCHER) body = '#9be8c9';
      else if (unit.type === TYPE.CAVALRY) body = '#c9a6ff';
      if (hostile) body = unit.type === TYPE.RAIDER_ARCHER ? '#ff9a7a' : PALETTE.enemy;

      if (big) {
        // Cavalry reads as a mount plus a rider, not just a bigger dot.
        c.fillStyle = hostile ? PALETTE.enemyDark : '#6b4f9c';
        c.beginPath();
        c.ellipse(px, py + bob + r * 0.05, r * 0.95, r * 0.5, 0, 0, Math.PI * 2);
        c.fill();
        c.fillRect(px + face * r * 0.7, py + bob - r * 0.35, r * 0.34, r * 0.5);
      }

      c.fillStyle = body;
      c.beginPath();
      c.arc(px, py + bob - r * (big ? 0.75 : 0.4), r * 0.55, 0, Math.PI * 2);
      c.fill();
      c.fillRect(px - r * 0.42, py + bob - r * (big ? 0.5 : 0.15), r * 0.84, r * (big ? 0.7 : 0.95));

      // Weapon silhouette: the fastest way to tell unit types apart at thumb
      // scale, and it doubles as the facing cue.
      if (unit.kind === KIND.VILLAGER) {
        c.fillStyle = PALETTE.wood;
        c.fillRect(px + face * r * 0.5, py + bob - r * 0.55, r * 0.16, r * 0.95);
      } else if (unit.type === TYPE.ARCHER || unit.type === TYPE.RAIDER_ARCHER) {
        c.strokeStyle = PALETTE.wood;
        c.lineWidth = Math.max(1.2, 0.24 * s);
        c.beginPath();
        c.arc(px + face * r * 0.62, py + bob - r * 0.1, r * 0.6, -1.1, 1.1);
        c.stroke();
      } else if (big) {
        c.fillStyle = PALETTE.stone;
        c.fillRect(px + face * r * 0.55, py + bob - r * 1.25, r * 0.14, r * 1.3);
      } else {
        c.fillStyle = PALETTE.stone;
        c.fillRect(px + face * r * 0.52, py + bob - r * 0.7, r * 0.22, r * 0.8);
      }

      if (unit.kind === KIND.VILLAGER && unit.carry > 0) {
        c.fillStyle = unit.carryKind === 1 ? PALETTE.gold : unit.carryKind === 2 ? PALETTE.wood : PALETTE.food;
        c.fillRect(px - r * 0.3, py + bob - r * 1.35, r * 0.6, r * 0.42);
      }

      if (unit.hurt > 0) {
        c.fillStyle = `rgba(255,255,255,${Math.min(0.55, unit.hurt * 3)})`;
        c.beginPath();
        c.arc(px, py + bob - r * 0.3, r * 0.85, 0, Math.PI * 2);
        c.fill();
      }

      if (unit.hp < unit.maxHp) {
        this.bar(px, py - r * (big ? 1.9 : 1.7), r * 1.5, unit.hp / unit.maxHp, hostile ? PALETTE.enemy : PALETTE.hp);
      }
    }

    shots(state, alpha) {
      const c = this.ctx;
      const s = this.scale;
      c.lineWidth = Math.max(1.4, 0.32 * s);
      for (let i = 0; i < state.shots.length; i++) {
        const shot = state.shots[i];
        if (!shot.alive) continue;
        const t = Math.min(1, (shot.t + alpha * (1 / 30)) / shot.dur);
        const x = shot.x + (shot.tx - shot.x) * t;
        const y = shot.y + (shot.ty - shot.y) * t;
        // A shallow arc sells the throw without any physics behind it.
        const px = this.sx(x);
        const py = this.sy(y - Math.sin(t * Math.PI) * 3.2);
        const angle = Math.atan2(shot.ty - shot.y, shot.tx - shot.x);
        c.strokeStyle = shot.hostile ? '#ffb0a0' : '#ffe9a8';
        c.beginPath();
        c.moveTo(px - Math.cos(angle) * 1.6 * s, py - Math.sin(angle) * 1.6 * s);
        c.lineTo(px, py);
        c.stroke();
      }
    }

    /** Preview of a pending build order, so a tap never places blindly. */
    buildGhost(rules) {
      if (!this.ghost) return;
      const c = this.ctx;
      const spec = this.ghost.kind === BUILD.TOWER ? rules.buildings.tower : rules.buildings.house;
      const px = this.sx(this.ghost.x);
      const py = this.sy(this.ghost.y);
      const rr = spec.r * this.scale;
      c.strokeStyle = this.ghost.ok ? 'rgba(168,222,92,.85)' : 'rgba(255,95,79,.85)';
      c.lineWidth = Math.max(2, 0.5 * this.scale);
      c.setLineDash([4, 4]);
      c.strokeRect(px - rr, py - rr, rr * 2, rr * 2);
      c.setLineDash([]);
      if (this.ghost.kind === BUILD.TOWER) {
        c.strokeStyle = 'rgba(255,255,255,.22)';
        c.beginPath();
        c.arc(px, py, spec.range * this.scale, 0, Math.PI * 2);
        c.stroke();
      }
    }

    draw(state, alpha, rules) {
      const c = this.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(this.terrain, 0, 0);
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const clock = state.elapsed;

      for (let i = 0; i < state.nodes.length; i++) {
        if (state.nodes[i].amount > 0) this.node(state.nodes[i]);
      }

      const t = state.tuning;
      if (t) {
        if (state.camp.hp > 0) this.enemyCamp(t.enemyCamp.x, t.enemyCamp.y, t.enemyCamp.r, state.camp.hp, state.camp.maxHp);
        if (rules) {
          for (let i = 0; i < state.buildings.length; i++) {
            if (state.buildings[i].alive) this.building(state.buildings[i], rules);
          }
        }
        this.townCenter(t.townCenter.x, t.townCenter.y, t.townCenter.r, state.town.hp, state.town.maxHp);
      }

      // Own units first, hostiles on top: what is about to hurt you should
      // never be hidden behind what you own.
      const units = state.units;
      for (let i = 0; i < units.length; i++) {
        if (units[i].alive && units[i].kind !== KIND.RAIDER) this.unit(units[i], alpha, clock);
      }
      for (let i = 0; i < units.length; i++) {
        if (units[i].alive && units[i].kind === KIND.RAIDER) this.unit(units[i], alpha, clock);
      }

      this.shots(state, alpha);
      if (rules) this.buildGhost(rules);

      // Order feedback: a thin line from each selected unit to what it is doing.
      c.strokeStyle = 'rgba(255,224,102,.32)';
      c.lineWidth = 1;
      for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (!unit.alive || !unit.selected) continue;
        let tx = null;
        let ty = null;
        if (unit.act === ACT.MOVE) { tx = unit.tx; ty = unit.ty; }
        else if (unit.act === ACT.TO_NODE || unit.act === ACT.GATHER) {
          const node = state.node(unit.nodeId);
          if (node) { tx = node.x; ty = node.y; }
        } else if (unit.act === ACT.ATTACK && unit.targetBuilding === 1 && t) { tx = t.enemyCamp.x; ty = t.enemyCamp.y; }
        if (tx === null) continue;
        c.beginPath();
        c.moveTo(this.sx(unit.x), this.sy(unit.y));
        c.lineTo(this.sx(tx), this.sy(ty));
        c.stroke();
      }
    }
  }

  window.GreatEmpireRenderer = Object.freeze({ Renderer, PALETTE });
})();
