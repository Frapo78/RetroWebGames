#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const must = (condition, message) => { if (!condition) failures.push(message); };

const service = read('ops/rwg-leaderboard.service');
const installer = read('ops/install-rwg-leaderboards.sh');
const api = read('server/leaderboards/server.js');
// GitHub keeps browser assets at the repository root; the VPS deployment
// adaptation moves them under public/. Validate either authoritative layout.
const leaderboardClient = read(fs.existsSync(path.join(root, 'public/rwg-leaderboard.js')) ? 'public/rwg-leaderboard.js' : 'rwg-leaderboard.js');

must(service.includes('WorkingDirectory=/var/lib/rwg-leaderboard/app'), 'Leaderboard service must run from its private runtime copy');
must(service.includes('ExecStart=/usr/bin/node /var/lib/rwg-leaderboard/app/server.js'), 'Leaderboard service must not execute JavaScript from /projects');
must(!service.includes('MemoryDenyWriteExecute=true'), 'Leaderboard must retain V8-compatible MemoryDenyWriteExecute setting');
for (const directive of ['NoNewPrivileges=true', 'PrivateTmp=true', 'ProtectSystem=full', 'ProtectHome=true', 'ProtectKernelTunables=true', 'ProtectControlGroups=true', 'RestrictSUIDSGID=true', 'LockPersonality=true']) {
  must(service.includes(directive), `Leaderboard service hardening missing: ${directive}`);
}
must(installer.includes('RUNTIME_DIR=/var/lib/rwg-leaderboard'), 'Installer must declare a private leaderboard runtime directory');
must(installer.includes('chown -R root:site_rwg "$RUNTIME_STAGE"'), 'Installer must make the staged leaderboard runtime root-owned');
must(installer.includes('RUNTIME_PREVIOUS'), 'Installer must retain a rollback runtime until local health succeeds');
must(installer.includes('wait_for_health http://127.0.0.1:3112/health'), 'Installer must validate loopback health before completing');
must(api.includes("trustProxy: '127.0.0.1'"), 'Leaderboard API must trust proxy headers only from loopback');
must(api.includes('keyGenerator: request => request.ip'), 'Leaderboard rate limit must key on resolved client IP');
must(api.includes("request.headers.origin !== productionOrigin"), 'Leaderboard POST must require the canonical Origin');
must(api.includes('HttpOnly; Secure; SameSite=Lax'), 'Leaderboard player cookie must remain HttpOnly, Secure and SameSite=Lax');
must(!leaderboardClient.includes('.innerHTML = row.nickname'), 'Leaderboard client must not inject nicknames via innerHTML');

if (failures.length) {
  console.error(`Security validation FAILED (${failures.length})`);
  failures.forEach(failure => console.error(`  ✗ ${failure}`));
  process.exit(1);
}
console.log('Security validation OK');
console.log('  ✓ private root-owned leaderboard runtime with rollback staging');
console.log('  ✓ loopback-only proxy trust, IP rate limit and strict POST Origin');
console.log('  ✓ service hardening and safe nickname rendering contracts retained');
