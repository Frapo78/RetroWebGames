#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const must = (condition, message) => { if (!condition) failures.push(message); };

const engine = read('games/star-swarm/engine.js');
const bossesSource = read('games/star-swarm/bosses.js');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(bossesSource, sandbox, { filename: 'bosses.js' });
const bosses = sandbox.window.StarSwarmBosses?.BOSSES || [];
const ironManta = bosses[3];

must(ironManta?.name === 'IRON MANTA', 'Star Swarm: fourth boss must remain Iron Manta');
must(ironManta?.attack === 'mines', 'Star Swarm: Iron Manta must retain mine attack identity');
must(ironManta?.mineCount === 2, 'Star Swarm: Iron Manta must launch exactly two mines per mine volley');
must(ironManta?.mineBurstCount === 5, 'Star Swarm: each Iron Manta mine must explode into five projectiles');
must(ironManta?.mineAimEvery === 3, 'Star Swarm: Iron Manta aimed support must fire every third mine volley');
must(ironManta?.attackDelayScale === 1.18, 'Star Swarm: Iron Manta attack delay balance multiplier must remain 1.18');
must(engine.includes('burstCount=clamp(Math.round(boss.mineBurstCount||8),3,12)'), 'Star Swarm: mine runtime must consume configured burst count');
must(engine.includes('(boss.attackDelayScale||1)'), 'Star Swarm: boss runtime must honor configured attack delay multiplier');

must(engine.includes('const MAX_SHIELDS=3'), 'Star Swarm: Shield stack must cap at three layers');
must(engine.includes("{radius:25,stroke:'rgba(101,231,255,.85)',shadow:'#65e7ff'}"), 'Star Swarm: inner Shield must preserve original cyan ring');
must(engine.includes("{radius:32,stroke:'rgba(178,230,182,.88)',shadow:'#b2e6b6'}"), 'Star Swarm: middle Shield must use cyan/yellow intermediate color');
must(engine.includes("{radius:39,stroke:'rgba(255,230,109,.90)',shadow:'#ffe66d'}"), 'Star Swarm: outer Shield must be yellow');
must(engine.includes('player.shield=Math.min(MAX_SHIELDS,player.shield+1)'), 'Star Swarm: Shield pickup must add one layer up to three');
must(engine.includes('player.shield--;'), 'Star Swarm: a shielded hit must consume exactly one layer');
must(engine.includes('s.player.shield>MAX_SHIELDS'), 'Star Swarm: resume validator must bound Shield stack');

must(engine.includes('function dropBossShieldMilestones(previousHp)'), 'Star Swarm: boss Shield milestone drop helper missing');
must(engine.includes('boss.ordinal<4'), 'Star Swarm: guaranteed boss Shield milestones must start at boss four');
must(engine.includes("createPowerup('shield'"), 'Star Swarm: boss damage milestones must release Shield pickups');
must(engine.includes('*10+1e-9'), 'Star Swarm: boss Shield rewards must use ten-percent max-HP thresholds');

must(engine.includes('ONE_UP_LEVEL_GAP=5'), 'Star Swarm: 1UP cooldown must be five level numbers');
must(engine.includes('ONE_UP_DROP_CHANCE=.0045'), 'Star Swarm: 1UP base random drop chance changed unexpectedly');
must(engine.includes("drops.oneup<1&&level-drops.lastOneUpLevel>=ONE_UP_LEVEL_GAP"), 'Star Swarm: 1UP must be capped to one per eligible level and five-level release gap');
must(engine.includes("if(type==='oneup')drops.lastOneUpLevel=level"), 'Star Swarm: 1UP cooldown must start when the pickup is released');
must(engine.includes("else if(p.type==='oneup')"), 'Star Swarm: 1UP collection handler missing');
must(engine.includes('lives=Math.min(MAX_LIVES,lives+1)'), 'Star Swarm: 1UP must add exactly one life');
must(engine.includes('MAX_LIVES=9'), 'Star Swarm: life cap must remain nine');
must(engine.includes("'shield','oneup'"), 'Star Swarm: resume validator must accept pending 1UP pickups');
must(engine.includes("version:2,compatibility:'star-swarm-state-v2-campaign100-boss10-weapon8-power20-shield3-1up5'"), 'Star Swarm: gameplay semantic changes must remain on resume adapter v2 compatibility token');

if (failures.length) {
  console.error(`\nStar Swarm balance validation FAILED (${failures.length})\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error('');
  process.exit(1);
}

console.log('Star Swarm balance validation OK');
console.log('  ✓ Iron Manta projectile density guardrails');
console.log('  ✓ three-layer Shield stack and visuals');
console.log('  ✓ boss-4+ ten-percent Shield rewards');
console.log('  ✓ random 1UP five-level release cooldown and life cap');
console.log('  ✓ resume schema/compatibility guards for new state semantics');
