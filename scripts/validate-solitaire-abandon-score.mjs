#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const rel = 'games/solitaire/session-adapter.js';
const source = fs.readFileSync(path.join(root, rel), 'utf8');
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

const syntax = spawnSync(process.execPath, ['--check', path.join(root, rel)], { encoding: 'utf8' });
must(syntax.status === 0, `${rel}: node --check failed: ${(syntax.stderr || syntax.stdout || '').trim()}`);

must(source.includes("document.getElementById('newDealConfirmBtn')"), 'Solitaire: new-deal confirmation must be intercepted at the existing confirm control');
must(source.includes('const state = base.serialize?.();'), 'Solitaire: abandoned score must come from the authoritative resume snapshot');
must(source.includes('currentScore <= 10'), 'Solitaire: only incomplete deals scoring more than 10 points must be submitted');
must(source.includes("outcome: 'game-over'"), 'Solitaire: deliberate new deal must close the current scored run as Game Over');
must(source.includes("terminalReason: 'new-deal'"), 'Solitaire: abandoned terminal result must identify the deliberate new-deal reason');
must(source.includes('window.RWGLeaderboard.getRunId()'), 'Solitaire: abandoned submission must bind to the current leaderboard run id');
must(source.includes("window.addEventListener('rwg:leaderboard-registered', onRegistered)"), 'Solitaire: restart must wait for shared leaderboard registration');
must(source.includes("registeredEvent.detail?.gameSlug !== 'solitaire' || registeredEvent.detail?.runId !== runId"), 'Solitaire: unrelated leaderboard registration events must not unlock the restart');
must(source.includes("window.dispatchEvent(new CustomEvent('rwg:leaderboard-result', { detail: abandonedResult(state) }))"), 'Solitaire: abandoned result must use the shared leaderboard result contract');
must(source.includes("window.removeEventListener('rwg:leaderboard-registered', onRegistered);\n      finishRestart();"), 'Solitaire: fresh-hand restart must happen only after the matching registration callback');
must(source.includes('event.stopImmediatePropagation();'), 'Solitaire: original confirmation handler must be held until score registration completes');

if (failures.length) {
  console.error(`\nSolitaire abandoned-score validation FAILED (${failures.length})\n`);
  failures.forEach(failure => console.error(`  ✗ ${failure}`));
  console.error('');
  process.exit(1);
}

console.log('Solitaire abandoned-score validation OK');
console.log('  ✓ score > 10 closes the current run through the shared leaderboard');
console.log('  ✓ fresh deal waits for matching leaderboard registration');
console.log('  ✓ score <= 10 keeps the existing immediate confirmed restart');
