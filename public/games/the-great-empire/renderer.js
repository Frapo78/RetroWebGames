/**
 * The Great Empire — renderer.
 *
 * Reads the state, never writes it. The world is a fixed 100x160 logical box
 * mapped to the canvas with a uniform scale, so the same match looks identical
 * on any device and world coordinates in a snapshot stay meaningful.
 *
 * Cost control: the terrain is painted once into an offscreen canvas and only
 * repainted on resize; the per-frame pass draws flat shapes with no shadow
 * blur, no gradients and no per-entity allocation.
 */
(() => {
  'use strict';

  const { KIND, ACT } = window.GreatEmpireState;

  const PALETTE = {
    grassA: '#1d3324',
    grassB: '#20392a',
    path: '#2c4433',
    player: '#57c7ff',
    playerDark: '#1d5f86',
    soldier: '#7ee0ff',
    enemy: '#ff5f4f',
    enemyDark: '#7d2119',
    food: '#a8de5c',
    gold: '#ffd23f',
    stone: '#c9d6cf',
    ink: '#04120a'
  };

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
      this.world = { w: 100, h: 160 };
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

    /** World units -> CSS pixels. */
    sx(x) { return this.ox + x * this.scale; }
    sy(y) { return this.oy + y * this.scale; }
    /** CSS pixels -> world units. Used by input hit-testing. */
    wx(px) { return (px - this.ox) / this.scale; }
    wy(py) { return (py - this.oy) / this.scale; }

    paintTerrain() {
      const t = this.terrain;
      t.width = Math.floor(this.w * this.dpr);
      t.height = Math.floor(this.h * this.dpr);
      const c = this.tctx;
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      // Grass covers the whole canvas, not just the playable box: a uniform
      // scale always leaves some margin, and empty letterbox bars would read
      // as a rendering bug rather than as countryside.
      const s = this.scale;
      const w = this.world.w * s;
      const h = this.world.h * s;
      c.fillStyle = PALETTE.grassA;
      c.fillRect(0, 0, this.w, this.h);

      // Alternating field bands give the eye a sense of depth without a texture.
      c.fillStyle = PALETTE.grassB;
      for (let y = -20; y < this.world.h + 20; y += 10) {
        if ((Math.round(y / 10)) % 2) continue;
        c.fillRect(0, this.sy(y), this.w, 10 * s);
      }

      // Darken outside the playable box so the border is readable without a line.
      c.fillStyle = 'rgba(2,9,5,.42)';
      if (this.ox > 0) { c.fillRect(0, 0, this.ox, this.h); c.fillRect(this.ox + w, 0, this.ox + 2, this.h); }
      if (this.oy > 0) { c.fillRect(0, 0, this.w, this.oy); c.fillRect(0, this.oy + h, this.w, this.oy + 2); }

      // Worn road between the two bases: it reads as "this is the fight lane".
      c.strokeStyle = PALETTE.path;
      c.lineWidth = Math.max(2, 7 * s);
      c.beginPath();
      c.moveTo(this.sx(this.world.w / 2), this.sy(20));
      c.lineTo(this.sx(this.world.w / 2), this.sy(this.world.h - 18));
      c.stroke();

      c.strokeStyle = 'rgba(255,255,255,.05)';
      c.lineWidth = 1;
      for (let x = 10; x < this.world.w; x += 10) {
        c.beginPath();
        c.moveTo(this.sx(x), this.oy);
        c.lineTo(this.sx(x), this.oy + h);
        c.stroke();
      }
    }

    bar(x, y, width, ratio, color) {
      const c = this.ctx;
      const h = Math.max(2.5, 3 * this.scale * 0.5);
      c.fillStyle = 'rgba(0,0,0,.55)';
      c.fillRect(x - width / 2, y, width, h);
      c.fillStyle = color;
      c.fillRect(x - width / 2, y, width * Math.max(0, Math.min(1, ratio)), h);
    }

    building(x, y, r, hp, maxHp, hostile, label) {
      const c = this.ctx;
      const px = this.sx(x);
      const py = this.sy(y);
      const rr = r * this.scale;

      c.fillStyle = hostile ? PALETTE.enemyDark : PALETTE.playerDark;
      c.beginPath();
      c.roundRect(px - rr, py - rr * 0.82, rr * 2, rr * 1.64, rr * 0.28);
      c.fill();

      c.fillStyle = hostile ? PALETTE.enemy : PALETTE.player;
      c.beginPath();
      c.roundRect(px - rr * 0.74, py - rr * 0.58, rr * 1.48, rr * 1.16, rr * 0.2);
      c.fill();

      // Banner pole: the clearest non-textual faction cue at small sizes.
      c.fillStyle = PALETTE.stone;
      c.fillRect(px - rr * 0.06, py - rr * 1.5, rr * 0.12, rr * 0.95);
      c.fillStyle = hostile ? PALETTE.enemy : PALETTE.player;
      c.beginPath();
      c.moveTo(px + rr * 0.06, py - rr * 1.5);
      c.lineTo(px + rr * 0.72, py - rr * 1.3);
      c.lineTo(px + rr * 0.06, py - rr * 1.05);
      c.closePath();
      c.fill();

      this.bar(px, py + rr * 0.95, rr * 2, hp / maxHp, hostile ? PALETTE.enemy : '#6ee87f');

      c.fillStyle = 'rgba(255,255,255,.72)';
      c.font = `700 ${Math.max(8, Math.round(3.1 * this.scale))}px ui-monospace,Menlo,monospace`;
      c.textAlign = 'center';
      c.fillText(label, px, py + rr * 1.75);
    }

    node(node) {
      const c = this.ctx;
      const px = this.sx(node.x);
      const py = this.sy(node.y);
      const r = 4.2 * this.scale;
      const ratio = node.amount / node.max;
      const isGold = node.kind === 'gold';

      c.fillStyle = isGold ? 'rgba(90,88,70,.85)' : 'rgba(52,86,42,.85)';
      c.beginPath();
      c.arc(px, py, r, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = isGold ? PALETTE.gold : PALETTE.food;
      c.globalAlpha = 0.35 + ratio * 0.65;
      if (isGold) {
        for (let i = 0; i < 3; i++) {
          const a = (Math.PI * 2 * i) / 3 - 0.6;
          c.beginPath();
          c.arc(px + Math.cos(a) * r * 0.42, py + Math.sin(a) * r * 0.42, r * 0.3, 0, Math.PI * 2);
          c.fill();
        }
      } else {
        for (let i = 0; i < 4; i++) {
          const a = (Math.PI * 2 * i) / 4 + 0.4;
          c.fillRect(px + Math.cos(a) * r * 0.4 - r * 0.09, py + Math.sin(a) * r * 0.4 - r * 0.36, r * 0.18, r * 0.72);
        }
      }
      c.globalAlpha = 1;

      if (ratio < 0.999) this.bar(px, py + r + 2, r * 1.8, ratio, isGold ? PALETTE.gold : PALETTE.food);
    }

    unit(unit, alpha) {
      const c = this.ctx;
      const x = unit.px + (unit.x - unit.px) * alpha;
      const y = unit.py + (unit.y - unit.py) * alpha;
      const px = this.sx(x);
      const py = this.sy(y);
      const grow = unit.birth > 0 ? 1 - unit.birth / 0.45 : 1;
      const r = (unit.kind === KIND.VILLAGER ? 2.4 : 2.9) * this.scale * (0.4 + grow * 0.6);

      if (unit.selected) {
        c.strokeStyle = '#ffe66d';
        c.lineWidth = Math.max(2, 0.6 * this.scale);
        c.beginPath();
        c.ellipse(px, py + r * 0.7, r * 1.7, r * 0.8, 0, 0, Math.PI * 2);
        c.stroke();
      }

      c.fillStyle = 'rgba(0,0,0,.35)';
      c.beginPath();
      c.ellipse(px, py + r * 0.75, r * 0.95, r * 0.42, 0, 0, Math.PI * 2);
      c.fill();

      let body = PALETTE.player;
      if (unit.kind === KIND.SOLDIER) body = PALETTE.soldier;
      else if (unit.kind === KIND.RAIDER) body = PALETTE.enemy;

      c.fillStyle = body;
      c.beginPath();
      c.arc(px, py - r * 0.35, r * 0.62, 0, Math.PI * 2);
      c.fill();
      c.fillRect(px - r * 0.5, py - r * 0.1, r, r * 0.95);

      if (unit.kind === KIND.SOLDIER) {
        c.fillStyle = PALETTE.stone;
        c.fillRect(px + r * 0.45, py - r * 0.5, r * 0.22, r * 1.2);
      } else if (unit.kind === KIND.VILLAGER && unit.carry > 0) {
        c.fillStyle = unit.carryKind === 1 ? PALETTE.gold : PALETTE.food;
        c.fillRect(px - r * 0.3, py - r * 1.25, r * 0.6, r * 0.42);
      }

      if (unit.hp < unit.maxHp) this.bar(px, py - r * 1.7, r * 1.8, unit.hp / unit.maxHp, unit.kind === KIND.RAIDER ? PALETTE.enemy : '#6ee87f');
    }

    draw(state, alpha) {
      const c = this.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(this.terrain, 0, 0);
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      for (let i = 0; i < state.nodes.length; i++) {
        if (state.nodes[i].amount > 0) this.node(state.nodes[i]);
      }

      const t = state.tuning;
      if (t) {
        if (state.camp.hp > 0) this.building(t.enemyCamp.x, t.enemyCamp.y, t.enemyCamp.r, state.camp.hp, state.camp.maxHp, true, 'ACCAMPAMENTO');
        this.building(t.townCenter.x, t.townCenter.y, t.townCenter.r, state.town.hp, state.town.maxHp, false, 'CENTRO CITTÀ');
      }

      const units = state.units;
      for (let i = 0; i < units.length; i++) {
        if (units[i].alive && units[i].kind !== KIND.RAIDER) this.unit(units[i], alpha);
      }
      for (let i = 0; i < units.length; i++) {
        if (units[i].alive && units[i].kind === KIND.RAIDER) this.unit(units[i], alpha);
      }

      // Order feedback: a thin line from each selected unit to what it is doing.
      c.strokeStyle = 'rgba(255,230,109,.35)';
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
