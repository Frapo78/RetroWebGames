#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

const root=process.cwd(),failures=[];
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const must=(condition,message)=>{if(!condition)failures.push(message);};
for(const rel of ['games/prism-breaker/levels.js','games/prism-breaker/bosses.js','games/prism-breaker/engine.js']){
  const result=spawnSync(process.execPath,['--check',path.join(root,rel)],{encoding:'utf8'});must(result.status===0,`${rel}: node --check failed: ${(result.stderr||result.stdout||'').trim()}`);
}
const html=read('games/prism-breaker/index.html');
must(html.includes('data-rwg-game="true"'),'Prism Breaker must use shared game contract');
must(html.indexOf('levels.js')<html.indexOf('bosses.js')&&html.indexOf('bosses.js')<html.indexOf('engine.js')&&html.indexOf('engine.js')<html.indexOf('../../game-hud.js'),'Prism Breaker script load order invalid');
must(html.includes('class="primary-btn rwg-intro-secondary" href="/">TORNA AL MENU'),'Prism Breaker intro menu action missing');

const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(read('games/prism-breaker/levels.js'),sandbox,{filename:'levels.js'});vm.runInContext(read('games/prism-breaker/bosses.js'),sandbox,{filename:'bosses.js'});
const levels=sandbox.window.PrismBreakerLevels,bosses=sandbox.window.PrismBreakerBosses;
must(levels?.MAX_LEVEL===100,'Prism Breaker must define exactly 100 base levels');
const stages=Array.from({length:100},(_,i)=>levels.getLevel(i+1));
must(new Set(stages.map(s=>s.signature)).size===100,'Prism Breaker level signatures must all be unique');
must(stages.filter(s=>s.boss).map(s=>s.level).join(',')==='10,20,30,40,50,60,70,80,90,100','Boss cadence must be every 10 levels');
must(stages.filter(s=>!s.boss).every(s=>s.destructible>=24),'Normal levels must remain structured with substantial brick counts');
must(stages.some(s=>s.cells.some(b=>b.r>=12)),'Layouts must use the lower/middle playfield, not only top-stacked rows');
for(const type of ['normal','tough','armored','glass','explosive','prism','moving','steel']) must(stages.some(s=>s.cells.some(b=>b.type===type)),`Brick type missing from campaign: ${type}`);
must(bosses?.BOSSES?.length===10,'Prism Breaker must define 10 bosses');
for(const field of ['name','shape','move']) must(new Set(bosses.BOSSES.map(b=>b[field])).size===10,`Boss roster must have 10 distinct ${field} values`);
must(new Set(bosses.BOSSES.map(b=>b.attack)).size>=6,'Boss roster needs varied attack patterns');

const engine=read('games/prism-breaker/engine.js');
for(const marker of ['1/120','rwg:game-ended','rwg:continue-game','visibilitychange','RWGResumeAdapter','stageSignature','compatibility:','remainingDestructible','completeLevel()','level>=Levels.MAX_LEVEL','cycle++','powerups','laser','multi','catch']) must(engine.includes(marker),`Prism Breaker runtime missing ${marker}`);
must(engine.includes("id:'prism-breaker'")&&engine.includes("version:1")&&engine.includes("prism-breaker-state-v1-levels100-boss10-physics120hz"),'Resume adapter identity/version/compatibility missing');
must(engine.includes('s.stageSignature!==blueprint.signature'),'Resume validation must invalidate changed level layouts');
must(engine.includes("phase='game-over'")&&/RWGGameOver\?\.open/.test(engine),'Terminal Game Over contract missing');
must(!/(?:score)\s*\*\s*\.5/.test(engine),'Continue must never halve score');

if(failures.length){console.error(`\nPrism Breaker validation FAILED (${failures.length})\n`);for(const f of failures)console.error(`  ✗ ${f}`);process.exit(1);}
console.log('Prism Breaker validation OK');
console.log('  ✓ 100 unique deterministic levels');
console.log('  ✓ boss cadence 10/20/.../100 and 10-boss roster');
console.log('  ✓ varied brick types and non-top-only layouts');
console.log('  ✓ fixed-step physics, power-ups, shared Game Over/Continue');
console.log('  ✓ versioned resumable-session adapter with layout invalidation');
