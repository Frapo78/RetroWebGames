/**
 * The Great Empire — input controller.
 *
 * Translates pointer taps into orders. It reads the state only to hit-test and
 * never changes gameplay values directly: every mutation goes through
 * `GreatEmpireSystems.orders`, which keeps one sanctioned entry point into the
 * simulation.
 *
 * Interaction model, deliberately the classic one so it needs no tutorial:
 * tap a unit to select it, then tap what it should do. Tapping empty ground
 * with a selection is a move order; tapping it without a selection clears.
 */
(() => {
  'use strict';

  const { KIND } = window.GreatEmpireState;
  const { orders } = window.GreatEmpireSystems;

  /** Tap tolerance in world units — a fingertip is far bigger than a villager. */
  const HIT_UNIT = 4.2;
  const HIT_NODE = 6;
  const DOUBLE_TAP_MS = 320;

  class InputController {
    constructor(canvas, renderer, state, callbacks) {
      this.canvas = canvas;
      this.renderer = renderer;
      this.state = state;
      this.on = callbacks || {};
      this.lastTapAt = 0;
      this.lastTapIndex = -1;
      this.enabled = false;
      this.onPointerDown = this.onPointerDown.bind(this);
    }

    attach() {
      this.canvas.addEventListener('pointerdown', this.onPointerDown);
    }

    setEnabled(value) {
      this.enabled = Boolean(value);
      if (!this.enabled) this.clearSelection();
    }

    clearSelection() {
      const units = this.state.units;
      for (let i = 0; i < units.length; i++) units[i].selected = false;
    }

    selectedIndices(out) {
      out.length = 0;
      const units = this.state.units;
      for (let i = 0; i < units.length; i++) {
        if (units[i].alive && units[i].selected) out.push(i);
      }
      return out;
    }

    selectAllOfKind(kind) {
      const units = this.state.units;
      let found = 0;
      for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        const match = unit.alive && unit.kind === kind;
        unit.selected = match;
        if (match) found++;
      }
      if (found) this.on.feedback?.('select');
      return found;
    }

    pick(wx, wy) {
      const units = this.state.units;
      let bestIndex = -1;
      let bestD = HIT_UNIT * HIT_UNIT;
      for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        if (!unit.alive) continue;
        const dx = unit.x - wx;
        const dy = unit.y - wy;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; bestIndex = i; }
      }
      return bestIndex;
    }

    pickNode(wx, wy) {
      const nodes = this.state.nodes;
      let best = null;
      let bestD = HIT_NODE * HIT_NODE;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.amount <= 0) continue;
        const dx = node.x - wx;
        const dy = node.y - wy;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = node; }
      }
      return best;
    }

    hitsCamp(wx, wy) {
      const t = this.state.tuning;
      if (!t || this.state.camp.hp <= 0) return false;
      const dx = t.enemyCamp.x - wx;
      const dy = t.enemyCamp.y - wy;
      const r = t.enemyCamp.r + 3;
      return dx * dx + dy * dy <= r * r;
    }

    onPointerDown(event) {
      if (!this.enabled) return;
      const rect = this.canvas.getBoundingClientRect();
      const wx = this.renderer.wx(event.clientX - rect.left);
      const wy = this.renderer.wy(event.clientY - rect.top);
      const state = this.state;

      const hit = this.pick(wx, wy);
      const own = hit >= 0 && state.units[hit].kind !== KIND.RAIDER;

      if (own) {
        const now = event.timeStamp || performance.now();
        const isDouble = hit === this.lastTapIndex && now - this.lastTapAt < DOUBLE_TAP_MS;
        this.lastTapAt = now;
        this.lastTapIndex = hit;
        if (isDouble) { this.selectAllOfKind(state.units[hit].kind); return; }
        this.clearSelection();
        state.units[hit].selected = true;
        this.on.feedback?.('select');
        return;
      }

      const selection = this.selectedIndices(this._buffer || (this._buffer = []));
      if (!selection.length) { this.on.feedback?.('empty'); return; }

      if (hit >= 0) {
        for (const index of selection) orders.attackUnit(state, index, hit);
        this.on.feedback?.('attack');
        return;
      }
      if (this.hitsCamp(wx, wy)) {
        for (const index of selection) orders.attackCamp(state, index);
        this.on.feedback?.('attack');
        return;
      }
      const node = this.pickNode(wx, wy);
      if (node) {
        let gatherers = 0;
        for (const index of selection) {
          if (state.units[index].kind === KIND.VILLAGER) { orders.gather(state, index, node.id); gatherers++; }
          else orders.moveTo(state, index, node.x, node.y);
        }
        this.on.feedback?.(gatherers ? 'gather' : 'move');
        return;
      }

      const world = state.tuning ? state.tuning.world : { w: 100, h: 160 };
      const cx = Math.max(2, Math.min(world.w - 2, wx));
      const cy = Math.max(2, Math.min(world.h - 2, wy));
      // Spread a group so units do not stack on one pixel.
      selection.forEach((index, i) => {
        const angle = (Math.PI * 2 * i) / Math.max(1, selection.length);
        const spread = selection.length > 1 ? 2.6 : 0;
        orders.moveTo(state, index, cx + Math.cos(angle) * spread, cy + Math.sin(angle) * spread);
      });
      this.on.feedback?.('move');
    }
  }

  window.GreatEmpireInput = Object.freeze({ InputController });
})();
