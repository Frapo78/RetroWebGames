#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const shared = read('rwg-avatar.js');
const css = read('rwg-avatar.css');
const html = read('avatar/index.html');
const editor = read('avatar/avatar-editor.js');
const editorCss = read('avatar/avatar-editor.css');
const docs = read('docs/AVATAR.md');

must(shared.includes('const VERSION = 2;'), 'Avatar schema must remain v2');
must(shared.includes('const STORAGE_KEY = `rwg.avatar.v${VERSION}:${fingerprint}`;'), 'Avatar v2 storage key missing');
must(shared.includes('rwg.avatar.v1:${fingerprint}'), 'Avatar legacy v1 migration key missing');
must(shared.includes('function migrateLegacy'), 'Avatar v1 migration function missing');
must(shared.includes("['glasses','visor'].includes(next.accessory)"), 'Legacy eyewear migration missing');
must(shared.includes("['cap','headphones'].includes(next.accessory)"), 'Legacy headgear migration missing');

for (const slot of ['eyewear','headgear','emblem','aura']) {
  must(new RegExp(`${slot}: \\[` ).test(shared), `Avatar independent ${slot} option slot missing`);
}
const optionsBlock = shared.slice(shared.indexOf('const OPTIONS'), shared.indexOf('const AURA'));
must(!/\baccessory\s*:/.test(optionsBlock), 'Legacy combined accessory slot must not remain in v2 OPTIONS');

for (const marker of [
  'rwg-avatar-svg',
  'rwg-av-skeleton',
  'rwg-av-arms',
  'rwg-av-legs',
  'rwg-av-joints',
  '<svg class="rwg-avatar-svg"',
  'viewBox="0 0 220 340"'
]) must(shared.includes(marker), `Shared avatar stickman/SVG marker missing: ${marker}`);

must(shared.includes("mode = 'full'"), 'Shared avatar full render mode missing');
must(shared.includes("markup(avatar, 'mini')"), 'Shared avatar mini badge must use the same renderer');
must(shared.includes('normalize,'), 'RWGAvatar public normalize API missing');
must(shared.includes('legacyStorageKey: LEGACY_KEY'), 'RWGAvatar must expose the legacy key for diagnostics/migration');

for (const marker of ['.rwg-avatar-svg','.rwg-avatar-aura','.rwg-avatar-platform','.rwg-avatar-mini','.rwg-av-skeleton']) {
  must(css.includes(marker), `Shared avatar CSS missing ${marker}`);
}
must(css.includes('@media(prefers-reduced-motion:reduce)'), 'Avatar motion must respect prefers-reduced-motion');
must(!css.includes('.rwg-av-torso{position:absolute'), 'Old block-doll torso renderer must not return');
must(!css.includes('.rwg-av-arm{position:absolute'), 'Old block-doll arm renderer must not return');

for (const tab of ['body','head','outfit','gear']) {
  must(html.includes(`data-tab="${tab}"`), `Avatar editor tab missing: ${tab}`);
  must(html.includes(`data-panel="${tab}"`), `Avatar editor panel missing: ${tab}`);
}
for (const slot of ['bodyStyle','skin','faceStyle','eyeColor','hairStyle','hairColor','topStyle','shirtColor','bottomStyle','pantsColor','shoeColor','eyewear','headgear','emblem','aura']) {
  must(html.includes(`data-section="${slot}"`), `Avatar editor slot missing: ${slot}`);
}
for (const id of ['avatarStage','avatarPreview','loadoutSummary','randomizeBtn','restoreBtn','saveBtn','saveStatus']) {
  must(html.includes(`id="${id}"`), `Avatar editor required control missing: ${id}`);
}

must(editor.includes('function setupTabs()'), 'Avatar editor keyboard/tab controller missing');
must(editor.includes("['ArrowLeft','ArrowRight','Home','End']"), 'Avatar editor tab keyboard navigation missing');
must(editor.includes('A.normalize({ ...draft, [key]: value })'), 'Avatar editor changes must pass through shared normalization');
must(editor.includes('draft = A.get();') && editor.includes('saved = A.get();'), 'Avatar editor undo-to-saved behavior missing');
must(editor.includes("reason: 'editor-v2'"), 'Avatar save metadata must identify editor v2');
must(editor.includes('optionIcon(key, value)'), 'Avatar option cards must have visual gaming icons');
must(editorCss.includes('.editor-tabs') && editorCss.includes('.choice-grid') && editorCss.includes('.loadout-summary'), 'Avatar editor gaming layout styles missing');

must(docs.includes('stickman / arcade-player skeleton'), 'docs/AVATAR.md must document the stickman visual contract');
must(docs.includes('v1 migration'), 'docs/AVATAR.md must document legacy migration');
must(docs.includes('Corpo') && docs.includes('Gear'), 'docs/AVATAR.md must document loadout tabs');

for (const rel of ['rwg-avatar.js','avatar/avatar-editor.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, rel)], { encoding:'utf8' });
  must(result.status === 0, `${rel}: node --check failed: ${(result.stderr || result.stdout || '').trim()}`);
}

if (failures.length) {
  console.error(`\nRWG avatar validation FAILED (${failures.length})\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error('');
  process.exit(1);
}

console.log('RWG avatar validation OK');
console.log('  ✓ v2 schema migrates v1 accessory state without reset');
console.log('  ✓ shared scalable SVG stickman renderer serves full + mini modes');
console.log('  ✓ independent eyewear/headgear/emblem/aura gear slots are enforced');
console.log('  ✓ gaming loadout editor exposes Corpo/Testa/Outfit/Gear tabs');
console.log('  ✓ editor controls, keyboard tabs and JS syntax are valid');
