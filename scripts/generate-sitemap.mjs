#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const gitRoot = path.resolve(option('--git-root', process.cwd()));
const scanRoot = path.resolve(gitRoot, option('--scan-root', '.'));
const output = path.resolve(gitRoot, option('--output', 'sitemap.xml'));
const today = new Date().toISOString().slice(0, 10);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (entry.name === 'index.html') out.push(abs);
  }
  return out;
}

function meta(html, pattern) { return html.match(pattern)?.[1]?.trim() || ''; }
function git(args) { return spawnSync('git', args, { cwd: gitRoot, encoding: 'utf8' }).stdout.trim(); }
function sourceCandidates(abs) {
  const relative = path.relative(gitRoot, abs).split(path.sep).join('/');
  const candidates = [relative];
  if (relative.startsWith('public/')) candidates.push(relative.slice('public/'.length));
  return candidates;
}
function lastModified(abs) {
  for (const candidate of sourceCandidates(abs)) {
    if (git(['status', '--porcelain', '--', candidate])) return today;
    const date = git(['log', '-1', '--format=%cs', '--all', '--', candidate]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  }
  return today;
}
function xml(value) { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;'); }

const entries = [];
for (const file of walk(scanRoot).sort()) {
  const html = fs.readFileSync(file, 'utf8');
  const robots = meta(html, /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  if (/(?:^|,)\s*noindex\b/i.test(robots)) continue;
  const canonical = meta(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  if (!/^https:\/\/www\.retrowebgames\.it\/(?:[^?#]*)$/.test(canonical)) throw new Error('Invalid or missing canonical: ' + path.relative(gitRoot, file));
  entries.push({ loc: canonical, lastmod: lastModified(file) });
}

entries.sort((a, b) => a.loc.localeCompare(b.loc));
if (!entries.some(entry => entry.loc === 'https://www.retrowebgames.it/')) throw new Error('Home URL missing');
if (new Set(entries.map(entry => entry.loc)).size !== entries.length) throw new Error('Duplicate canonical URL');

const body = entries.map(entry => '  <url>\n    <loc>' + xml(entry.loc) + '</loc>\n    <lastmod>' + entry.lastmod + '</lastmod>\n  </url>').join('\n');
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + '\n</urlset>\n';
fs.writeFileSync(output, sitemap);
console.log('Sitemap generated: ' + path.relative(gitRoot, output) + ' (' + entries.length + ' indexable URLs)');
