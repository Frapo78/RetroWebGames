from pathlib import Path

engine_path = Path('games/star-swarm/engine.js')
docs_path = Path('docs/STAR-SWARM.md')
validator_path = Path('scripts/validate-contracts.mjs')

engine = engine_path.read_text()

replacements = [
    (
        "function startWave(targetLevel=level,awardIntro=true){level=targetLevel;levelClock=0;stagePhase='wave';boss=null;hideBossHud();bullets.length=enemyBullets.length=powerups.length=bossHazards.length=enemies.length=0;",
        "function startWave(targetLevel=level,awardIntro=true){level=targetLevel;levelClock=0;stagePhase='wave';boss=null;hideBossHud();bossHazards.length=enemies.length=0;"
    ),
    (
        "function finishWave(){if(stagePhase!=='wave')return;stagePhase='transition';running=false;score+=stage.stageBonus;",
        "function finishWave(){if(stagePhase!=='wave')return;stagePhase='transition';running=true;score+=stage.stageBonus;"
    ),
    (
        "function spawnBoss(){stagePhase='boss';enemies.length=bullets.length=enemyBullets.length=powerups.length=bossHazards.length=0;",
        "function spawnBoss(){stagePhase='boss';enemies.length=bossHazards.length=0;"
    ),
    (
        "bullets.length=enemyBullets.length=powerups.length=bossHazards.length=0;hideBossHud();updateHud();burst(defeated.x,defeated.y,defeated.color,70,330);",
        "bossHazards.length=0;hideBossHud();updateHud();burst(defeated.x,defeated.y,defeated.color,70,330);"
    ),
    (
        "updateWingmen(dt);if(stagePhase==='wave')acquireCaptureTarget();fireClock-=dt;if(fireClock<=0){shoot();const base=WEAPONS[player.weapon].interval;fireClock=player.rapid>0?Math.max(.075,base*.47):base;}updateProjectiles(dt);",
        "updateWingmen(dt);if(stagePhase==='wave')acquireCaptureTarget();if(stagePhase==='wave'||stagePhase==='boss'){fireClock-=dt;if(fireClock<=0){shoot();const base=WEAPONS[player.weapon].interval;fireClock=player.rapid>0?Math.max(.075,base*.47):base;}}updateProjectiles(dt);"
    ),
    (
        "else if(stagePhase==='transition'){running=false;transitionTimer=setTimeout(()=>{if(level%10===0)spawnBoss();else{startWave(level+1);running=true;last=performance.now();markSessionDirty('transition-resume');}},500);}",
        "else if(stagePhase==='transition'){running=true;transitionTimer=setTimeout(()=>{if(level%10===0)spawnBoss();else{startWave(level+1);running=true;last=performance.now();markSessionDirty('transition-resume');}},500);}"
    ),
]

for old, new in replacements:
    count = engine.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one engine match, found {count}: {old[:100]}')
    engine = engine.replace(old, new, 1)

engine_path.write_text(engine)

docs = docs_path.read_text()
section = """
## Inter-wave continuity — CRITICAL

Ordinary wave completion must be visually and mechanically continuous. The short `wave → transition → next wave/boss` interval is **not a pause** and must not freeze the simulation.

During that transition:

- stars/player/wingmen keep animating;
- already-fired player projectiles keep travelling until they naturally leave the playfield or collide;
- already-fired enemy projectiles keep travelling under their normal rules;
- power-ups already falling keep descending and remain collectable;
- existing particles may finish naturally;
- no new automatic player volley is emitted until the next `wave` or `boss` phase starts.

`startWave()` and `spawnBoss()` must therefore clear only stage-specific actors/hazards that cannot belong to the next stage. They must **not** wipe `bullets`, `enemyBullets` or `powerups` merely because the level number changes.

Boss defeat may pause for the explicit boss-clear intermission, but bullets/power-ups must remain in memory and resume after the intermission rather than being discarded. Terminal Game Over is the separate boundary where the run ends.

This is a regression-critical gameplay rule: a drop earned by killing the final enemy must never vanish because that kill also completed the wave.

"""
anchor = "## Bosses\n"
if section.strip() not in docs:
    if anchor not in docs:
        raise SystemExit('STAR-SWARM docs anchor missing')
    docs = docs.replace(anchor, section + anchor, 1)
docs_path.write_text(docs)

validator = validator_path.read_text()
checks = """
// Inter-wave continuity: completing a wave must never freeze the simulation or wipe transients.
must(/function finishWave\(\)\{[\s\S]{0,120}stagePhase='transition';running=true;/.test(star), 'Star Swarm: ordinary wave transition must keep the simulation running');
must(!/function finishWave\(\)\{[\s\S]{0,120}stagePhase='transition';running=false;/.test(star), 'Star Swarm regression: wave completion must not freeze running=false');
must(/function startWave\([\s\S]{0,220}bossHazards\.length=enemies\.length=0;/.test(star), 'Star Swarm: startWave must reset stage actors without wiping transient shots/drops');
must(!/function startWave\([\s\S]{0,260}(?:bullets|enemyBullets|powerups)\.length/.test(star), 'Star Swarm regression: startWave must preserve bullets, enemy bullets and falling power-ups');
must(/function spawnBoss\(\)\{[\s\S]{0,120}enemies\.length=bossHazards\.length=0;/.test(star), 'Star Swarm: boss entry must reset only stage-specific enemies/hazards');
must(!/function spawnBoss\(\)\{[\s\S]{0,220}(?:bullets|enemyBullets|powerups)\.length/.test(star), 'Star Swarm regression: boss entry must preserve in-flight projectiles and falling power-ups');
must(star.includes("if(stagePhase==='wave'||stagePhase==='boss'){fireClock-=dt;"), 'Star Swarm: transition must advance existing transients without spawning fresh automatic volleys');
must(star.includes("else if(stagePhase==='transition'){running=true;"), 'Star Swarm: restored transition snapshots must resume as a live simulation');
must(!/defeatBoss\(\)[\s\S]{0,420}(?:bullets|enemyBullets|powerups)\.length=0/.test(star), 'Star Swarm regression: boss clear must not discard surviving projectiles or drops');
"""
anchor2 = "const gameOver = read('game-over.js');"
if checks.strip() not in validator:
    if anchor2 not in validator:
        raise SystemExit('validate-contracts anchor missing')
    validator = validator.replace(anchor2, checks + "\n" + anchor2, 1)
validator_path.write_text(validator)

print('Star Swarm transition continuity patch applied')
