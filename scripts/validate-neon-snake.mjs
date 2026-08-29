#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const failures=[];
const read=rel=>fs.readFileSync(rel,'utf8');
const must=(value,message)=>{if(!value)failures.push(message);};
const game=read('games/neon-snake/game.js');
const html=read('games/neon-snake/index.html');
const css=read('games/neon-snake/style.css');
const analytics=read('rwg-analytics.js');
const syntax=spawnSync(process.execPath,['--check','games/neon-snake/game.js'],{encoding:'utf8'});
must(syntax.status===0,`game.js syntax failed: ${(syntax.stderr||syntax.stdout||'').trim()}`);

const number=name=>Number(game.match(new RegExp(`${name}=([.\\d]+)`))?.[1]);
const base=number('BASE_STEP_MS'),factor=number('LEVEL_SPEED_FACTOR'),minimum=number('MIN_STEP_MS'),turbo=number('TURBO_MULTIPLIER');
must(base>=900&&base<=1200,`initial step must remain deliberately accessible; found ${base}ms`);
must(factor>=.95&&factor<=.98,`level speed factor must remain gradual; found ${factor}`);
must(minimum>=150&&minimum<=200,`late-game interval guard changed unexpectedly; found ${minimum}ms`);
must(turbo===2,`press-and-hold turbo must be exactly 2x; found ${turbo}`);
if([base,factor,minimum].every(Number.isFinite)){
  const intervals=Array.from({length:40},(_,index)=>Math.max(minimum,base*Math.pow(factor,index)));
  must(intervals.every((value,index)=>index===0||value<intervals[index-1]),'base speed must increase monotonically by level');
  must(intervals.slice(1).every((value,index)=>value/intervals[index]>=.95),'level steps must not accelerate abruptly');
}

for(const marker of ['id="boostBtn"','TURBO','aria-pressed="false"','Tieni premuto TURBO'])must(html.includes(marker),`turbo UI missing: ${marker}`);
for(const marker of ['movementIntervalMs()','baseStepMs()/(turboActive?TURBO_MULTIPLIER:1)','pointerdown',"'pointerup'","'pointercancel'","'lostpointercapture'","window.addEventListener('blur'","window.addEventListener('keyup'","setTurbo(false)"])must(game.includes(marker),`turbo lifecycle guard missing: ${marker}`);
must(game.includes("querySelectorAll('#controls [data-dir]')"),'direction delegation must not treat TURBO as a direction');
must(game.includes('comboWindowMs()')&&game.includes('pickupLifetimeSeconds(42,6.5)')&&game.includes('pickupLifetimeSeconds(49,7.5)'),'combo and pickup windows must scale with the accessible pace');
for(const marker of ['#boostBtn','.is-active','.dpad','touch-action: none'])must(css.includes(marker),`turbo mobile styling missing: ${marker}`);
must(analytics.includes("boostBtn: 'turbo'"),'centralized game_control analytics must include the Turbo control');

if(failures.length){console.error(`\nNeon Snake validation FAILED (${failures.length})\n`);for(const failure of failures)console.error(`  ✗ ${failure}`);process.exit(1);}
console.log('Neon Snake validation OK');
console.log('  ✓ accessible exponential speed curve with guarded late-game floor');
console.log('  ✓ exact 2x press-and-hold turbo across pointer and keyboard lifecycle');
console.log('  ✓ pace-aware combo and special-orb timing');
