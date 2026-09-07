import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const webRoot = fs.existsSync(path.join(root, 'public', 'index.html')) ? 'public' : '.';
const roots = webRoot === 'public' ? ['public', 'server/leaderboards', 'scripts'] : ['.'];
const extensions = new Set(['.html', '.js', '.mjs', '.css', '.webmanifest']);
const skip = /(?:^|\/)(?:\.git|\.work|node_modules|assets|icons)(?:\/|$)/;

function walk(relative, output = []) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return output;
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(relative, entry.name).replaceAll('\\', '/');
    if (skip.test(child)) continue;
    if (entry.isDirectory()) walk(child, output);
    else if (extensions.has(path.extname(entry.name))) output.push(child);
  }
  return output;
}

function owner(file) {
  if (file.startsWith('server/')) return 'api';
  if (file === 'public/index.html' || file.includes('hub-') || file.includes('pwa-')) return 'home';
  if (file.includes('/games/') || file.startsWith('games/')) return 'gameplay';
  if (/leaderboard|game-over|pause|session|profile|avatar|orientation|share|game-hud/.test(file)) return 'shared';
  return 'core';
}

function concern(file, line, kind, text) {
  if (kind === 'html-attribute-or-meta' && /(?:aria-label|alt=|placeholder)/.test(line)) return 'accessibility';
  if (/analytics/i.test(file) || /(?:gtag|track\()/.test(line)) return 'analytics';
  if (file.startsWith('scripts/') || /(?:console\.|debug)/i.test(line)) return 'debug-only';
  if (/seo-|sitemap|og:|twitter:|canonical|application\/ld\+json/i.test(`${file} ${line}`)) return 'seo';
  if (/(?:RetroWebGames|Star Swarm|Bubble Burst|Block Drop|Maze Munch|Neon Rally|Neon Snake|Neon Tilt|Prism Breaker|The Great Empire)/.test(text)) return 'brand';
  return owner(file);
}

const occurrences = [];
function add(file, lineNumber, kind, sourceLine, text = sourceLine) {
  const excerpt = text.trim().replace(/\s+/g, ' ').slice(0, 240);
  occurrences.push({ file, line: lineNumber, owner: owner(file), concern: concern(file, sourceLine, kind, excerpt), kind, text: excerpt });
}

for (const file of [...new Set(roots.flatMap(item => walk(item)))].sort()) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  source.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    if (/\b(?:it-IT|it_IT|toLocaleString|Intl\.(?:NumberFormat|DateTimeFormat|PluralRules))\b/.test(line)) add(file, lineNumber, 'locale-or-formatter', line);
    if (path.extname(file) === '.css') {
      for (const match of line.matchAll(/content\s*:\s*(["'])(.*?)\1/g)) if (match[2]) add(file, lineNumber, 'css-generated-copy', line, match[2]);
    }
    if (path.extname(file) === '.html') {
      for (const match of line.matchAll(/\b(?:alt|aria-label|title|placeholder|content)=(['"])(.*?)\1/g)) {
        if (/[A-Za-zÀ-ÿ]/.test(match[2]) && !/^(?:width=device-width|image\/|website$|summary_|index,|https?:)/.test(match[2])) add(file, lineNumber, 'html-attribute-or-meta', line, match[2]);
      }
      const withoutTags = line.replace(/<script\b.*$/i, '').replace(/<style\b.*$/i, '').replace(/<[^>]+>/g, ' ').trim();
      if (/[A-Za-zÀ-ÿ]{2}/.test(withoutTags)) add(file, lineNumber, 'html-visible-copy', line, withoutTags);
    }
    if (/\.(?:js|mjs)$/.test(file) && /['"`]([^'"`]*[A-Za-zÀ-ÿ][^'"`]*)['"`]/.test(line)) {
      if (/(?:textContent|innerHTML|aria-label|placeholder|title|message|send\(|describe\s*:|\.label\b|\.copy\b|toast|announce|confirm)/.test(line)) add(file, lineNumber, 'js-ui-or-api-copy', line);
    }
  });
}

const counts = {};
for (const item of occurrences) {
  counts[item.kind] = (counts[item.kind] || 0) + 1;
  counts[`owner:${item.owner}`] = (counts[`owner:${item.owner}`] || 0) + 1;
  counts[`concern:${item.concern}`] = (counts[`concern:${item.concern}`] || 0) + 1;
}
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), scannedRoots: roots, filesScanned: new Set(occurrences.map(item => item.file)).size, occurrences: occurrences.length, counts, items: occurrences };
console.log(JSON.stringify(process.argv.includes('--summary') ? { ...report, items: undefined } : report, null, 2));
