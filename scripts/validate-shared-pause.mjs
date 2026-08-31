#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const must = (condition, message) => { if (!condition) failures.push(message); };

for (const rel of ['rwg-pause-menu.js','rwg-session.js','orientation.js','games/solitaire/pause-overlay.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, rel)], { encoding: 'utf8' });
  must(result.status === 0, `${rel}: syntax check failed: ${(result.stderr || result.stdout || '').trim()}`);
}

const pause = read('rwg-pause-menu.js');
const session = read('rwg-session.js');
const css = read('rwg-pause-menu.css');
const orientation = read('orientation.js');
const solitaire = read('games/solitaire/pause-overlay.js');
const docs = read('docs/PAUSE-MENU.md');

must(pause.includes('const MIN_ACTIVE_MS = 45_000;'), 'Shared pause: active-play minimum must remain 45 seconds');
must(pause.includes("'solitaire': { minScoreExclusive: 10 }"), 'Shared pause: Solitario minimum must remain >10');
must(pause.includes("'neon-rally': { minScoreExclusive: 0 }"), 'Shared pause: Neon Rally requires at least one player point');
must(pause.includes("'star-swarm': { minScoreExclusive: 500 }"), 'Shared pause: Star Swarm interrupted-run floor missing');
must(pause.includes('score > policy.minScoreExclusive && duration >= MIN_ACTIVE_MS'), 'Shared pause: score and duration must both gate leaderboard eligibility');
must(pause.includes('showConfirmation(2)'), 'Shared pause: first termination confirmation must lead to a second stage');
must(pause.includes('CONFERMA DEFINITIVA'), 'Shared pause: second irreversible confirmation missing');
must(pause.includes('rwg:leaderboard-result'), 'Shared pause: eligible interruption must use shared leaderboard result contract');
must(pause.includes('rwg:leaderboard-registered'), 'Shared pause: termination must wait for shared leaderboard registration');
must(pause.includes("terminalReason: 'pause-terminate'"), 'Shared pause: interruption terminal reason missing');
must(pause.includes('rwg:game-ended'), 'Shared pause: final termination must emit terminal lifecycle');
must(pause.includes('rwg.pause.active.v1:'), 'Shared pause: active time must persist by run');

must(session.includes('let terminalSuppressed = false;'), 'RWGSession must track terminal autosave suppression');
must(session.includes('function terminate('), 'RWGSession must expose an explicit terminal suppression path');
must(session.includes('terminalSuppressed || !adapter || !isInProgress()'), 'RWGSession save path must reject terminal runs');
must(session.includes('if (terminalSuppressed || promptOpen) return;'), 'RWGSession lifecycle save must not recreate a terminated snapshot');
must(session.includes("window.addEventListener('rwg:game-ended'"), 'RWGSession must suppress saves on terminal game-ended lifecycle');
must(session.includes("window.addEventListener('rwg:game-session-start', beginRun)"), 'RWGSession must re-enable saving only for a new run');
must(session.includes('isTerminalSuppressed'), 'RWGSession must expose terminal suppression state for debugging/validation');

must(css.includes('.rwg-pause-menu') && css.includes('.rwg-pause-confirm-actions'), 'Shared pause stylesheet incomplete');
must(orientation.includes('rwg-pause-menu.css') && orientation.includes('rwg-pause-menu.js'), 'Shared pause assets must bootstrap for every game');
must(orientation.indexOf('rwg-pause-menu.js') < orientation.indexOf('const touchCapable'), 'Shared pause bootstrap must run before handheld-only orientation return');
must(solitaire.includes('Legacy compatibility shim') && !solitaire.includes('solitaire-pause-panel'), 'Solitario must not retain a local pause UI implementation');
must(docs.includes('45 seconds') && docs.includes('CONFERMA DEFINITIVA'), 'Pause source of truth must document eligibility and double confirmation');
must(docs.includes('late lifecycle') || docs.includes('beforeunload') || docs.includes('terminal suppression'), 'Pause docs must explain why confirmed termination cannot be autosaved again');

if (failures.length) {
  console.error(`\nShared pause validation FAILED (${failures.length})\n`);
  failures.forEach(failure => console.error(`  ✗ ${failure}`));
  console.error('');
  process.exit(1);
}

console.log('Shared pause validation OK');
console.log('  ✓ one centralized pause UI for all games');
console.log('  ✓ 45-second active-play gate and game-specific score floors');
console.log('  ✓ double-confirmed termination and leaderboard lifecycle');
console.log('  ✓ terminal runs cannot be resurrected by late unload autosaves');
