#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const must = (condition, message) => { if (!condition) failures.push(message); };

const engine = read('games/star-swarm/engine.js');
const bosses = read('games/star-swarm/bosses.js');
const docs = read('docs/STAR-SWARM.md');

must(engine.includes('const RESUME_SCHEMA=2;'), 'Star Swarm: resume schema must be v2 for stacked Shield state');
must(engine.includes("version:2,compatibility:'star-swarm-state-v2-campaign100-boss10-weapon8-power20-shield3'"), 'Star Swarm: resume adapter must expose the v2 Shield-3 compatibility contract');
must(engine.includes('player.shield=Math.min(3,player.shield+1)'), 'Star Swarm: Shield pickup must add one layer capped at three');
must(engine.includes('player.shield--;'), 'Star Swarm: a shielded hit must consume exactly one layer');
must(engine.includes('s.player.shield>3'), 'Star Swarm: resume validation must reject Shield values above three');
must(engine.includes('!Number.isInteger(s.player.shield)'), 'Star Swarm: persisted Shield count must be an integer');
must(engine.includes("status.push(`SHIELD ${player.shield}/3`)"), 'Star Swarm: HUD must expose Shield layer count');
must(engine.includes("{r:25,color:'rgba(101,231,255,.85)',shadow:'#65e7ff'}"), 'Star Swarm: innermost Shield layer must preserve the original cyan appearance/radius');
must(engine.includes("{r:31,color:'rgba(180,233,182,.88)',shadow:'#b4e9b6'}"), 'Star Swarm: middle Shield layer must use the intermediate cyan/yellow treatment');
must(engine.includes("{r:37,color:'rgba(255,230,109,.92)',shadow:'#ffe66d'}"), 'Star Swarm: outer Shield layer must be yellow');
must(engine.includes('drops.shield<1'), 'Star Swarm: normal random Shield drops must remain capped at one per level');
must(docs.includes('Shield protection stacks from `0` to `3` layers'), 'Star Swarm docs: stacked Shield contract missing');
must(docs.includes('resume schema is version `2`'), 'Star Swarm docs: resume v2 contract missing');
must(bosses.includes("name:'IRON MANTA'") && bosses.includes('attackCadence:.78'), 'Star Swarm: Iron Manta cadence balance must remain active');

if (failures.length) {
  console.error(`\nStar Swarm validation FAILED (${failures.length})\n`);
  failures.forEach(failure => console.error(`  ✗ ${failure}`));
  console.error('');
  process.exit(1);
}

console.log('Star Swarm validation OK');
console.log('  ✓ Shield stacks 0..3 and loses one layer per damaging hit');
console.log('  ✓ three Shield visuals and HUD counter are guarded');
console.log('  ✓ resume v2 rejects incompatible Shield state');
console.log('  ✓ normal Shield drop cap and Iron Manta cadence balance remain intact');
