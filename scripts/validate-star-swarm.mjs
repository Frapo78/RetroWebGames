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
const bosses = read('games/star-swarm/bosses.js');
const docs = read('docs/STAR-SWARM.md');

must(engine.includes('const RESUME_SCHEMA=3;'), 'Star Swarm: resume schema must be v3 for Shield boss drops and 1UP state');
must(engine.includes("version:3,compatibility:'star-swarm-state-v3-campaign100-boss10-weapon8-power20-shield3-bossdrops-1up'"), 'Star Swarm: resume adapter must expose the v3 gameplay-state contract');
must(engine.includes('player.shield=Math.min(3,player.shield+1)'), 'Star Swarm: Shield pickup must add one layer capped at three');
must(engine.includes('player.shield--;'), 'Star Swarm: a shielded hit must consume exactly one layer');
must(engine.includes('s.player.shield>3'), 'Star Swarm: resume validation must reject Shield values above three');
must(engine.includes('!Number.isInteger(s.player.shield)'), 'Star Swarm: persisted Shield count must be an integer');
must(engine.includes("status.push(`SHIELD ${player.shield}/3`)"), 'Star Swarm: HUD must expose Shield layer count');
must(engine.includes("{r:25,color:'rgba(101,231,255,.85)',shadow:'#65e7ff'}"), 'Star Swarm: innermost Shield layer must preserve the original cyan appearance/radius');
must(engine.includes("{r:31,color:'rgba(180,233,182,.88)',shadow:'#b4e9b6'}"), 'Star Swarm: middle Shield layer must use the intermediate cyan/yellow treatment');
must(engine.includes("{r:37,color:'rgba(255,230,109,.92)',shadow:'#ffe66d'}"), 'Star Swarm: outer Shield layer must be yellow');
must(engine.includes('drops.shield<1'), 'Star Swarm: normal random Shield drops must remain capped at one per level');
must(engine.includes("createPowerup('shield'") && engine.includes('false);tone(860'), 'Star Swarm: boss Shield threshold drops must bypass the normal random Shield cap');
must(engine.includes('shieldDropIndex:0'), 'Star Swarm: boss Shield threshold progress must initialize explicitly');
must(engine.includes('boss.shieldDropIndex<crossed'), 'Star Swarm: boss Shield thresholds must emit each crossed 10% milestone once');
must(engine.includes("probs.push(['oneup',.0045*elite])"), 'Star Swarm: 1UP random drop probability must remain at the intended 0.45% baseline');
must(engine.includes('level-lastOneUpLevel>=5'), 'Star Swarm: 1UP drops must be separated by at least five levels');
must(engine.includes('drops.oneup<1'), 'Star Swarm: at most one 1UP may drop in a single level');
must(engine.includes("p.type==='oneup'"), 'Star Swarm: 1UP pickup behavior and rendering must be implemented');
must(engine.includes('if(lives<9){lives++;'), 'Star Swarm: 1UP must add one life while respecting the 9-life cap');
must(engine.includes('lastOneUpLevel') && engine.includes("'oneup'].some"), 'Star Swarm: 1UP cooldown/drop state must participate in persistence validation');
must(docs.includes('Shield protection stacks from `0` to `3` layers'), 'Star Swarm docs: stacked Shield contract missing');
must(docs.includes('resume schema is version `3`'), 'Star Swarm docs: resume v3 contract missing');
must(docs.includes('1UP'), 'Star Swarm docs: 1UP contract missing');
must(bosses.includes("name:'IRON MANTA'") && bosses.includes('attackCadence:.78'), 'Star Swarm: Iron Manta cadence balance must remain active');
must(bosses.includes('shieldDropEvery:ordinal>=4?.10:0'), 'Star Swarm: boss Shield threshold contract must be declared from boss 4 onward');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(bosses, sandbox, { filename: 'bosses.js' });
const getBoss = sandbox.window.StarSwarmBosses?.getBoss;
must(Boolean(getBoss), 'Star Swarm: boss module must expose getBoss');
if (getBoss) {
  must(getBoss(10).shieldDropEvery === 0, 'Star Swarm: boss 1 must not grant threshold Shield drops');
  must(getBoss(20).shieldDropEvery === 0, 'Star Swarm: boss 2 must not grant threshold Shield drops');
  must(getBoss(30).shieldDropEvery === 0, 'Star Swarm: boss 3 must not grant threshold Shield drops');
  must(getBoss(40).shieldDropEvery === .10, 'Star Swarm: boss 4 must grant a Shield every 10% HP lost');
  must(getBoss(100).shieldDropEvery === .10, 'Star Swarm: boss 10 must retain 10% Shield thresholds');
  must(getBoss(110).shieldDropEvery === .10, 'Star Swarm: Overdrive bosses must retain 10% Shield thresholds');
}

if (failures.length) {
  console.error(`\nStar Swarm validation FAILED (${failures.length})\n`);
  failures.forEach(failure => console.error(`  ✗ ${failure}`));
  console.error('');
  process.exit(1);
}

console.log('Star Swarm validation OK');
console.log('  ✓ Shield stacks 0..3 and loses one layer per damaging hit');
console.log('  ✓ boss 4+ emit guaranteed Shield drops at each 10% HP threshold');
console.log('  ✓ 1UP is random, adds one life and cannot drop more often than every five levels');
console.log('  ✓ resume v3 persists Shield/boss-threshold/1UP state');
console.log('  ✓ normal Shield drop cap and Iron Manta cadence balance remain intact');
