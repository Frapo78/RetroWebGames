#!/usr/bin/env node
import process from 'node:process';
import { GAMES } from '../server/leaderboards/ranking.js';

const base = String(process.argv[2] || 'https://www.retrowebgames.it/api/leaderboards/v1').replace(/\/$/, '');
const PAGE_SIZE = 10;
const fail = message => { throw new Error(message); };

async function page(game, offset) {
  const response = await fetch(`${base}/games/${encodeURIComponent(game)}?limit=${PAGE_SIZE}&offset=${offset}`, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) fail(`${game}: HTTP ${response.status} at offset ${offset}`);
  const data = await response.json();
  const rows = Array.isArray(data.top) ? data.top : fail(`${game}: top is not an array`);
  const pagination = data.pagination;
  if (!pagination || typeof pagination !== 'object') fail(`${game}: pagination metadata missing`);
  if (Number(pagination.limit) !== PAGE_SIZE) fail(`${game}: pagination.limit must be ${PAGE_SIZE}`);
  if (Number(pagination.offset) !== offset) fail(`${game}: requested offset ${offset}, received ${pagination.offset}`);
  if (rows.length > PAGE_SIZE) fail(`${game}: page contains ${rows.length} rows`);
  return { rows, pagination };
}

for (const game of [...GAMES].sort()) {
  const first = await page(game, 0);
  const total = Number(first.pagination.total);
  if (!Number.isSafeInteger(total) || total < 0) fail(`${game}: invalid pagination.total`);
  if (first.rows.length !== Math.min(PAGE_SIZE, total)) fail(`${game}: first-page row count does not match total`);
  if (Boolean(first.pagination.hasMore) !== (total > PAGE_SIZE)) fail(`${game}: invalid first-page hasMore`);

  if (total > PAGE_SIZE) {
    const second = await page(game, PAGE_SIZE);
    const firstIds = new Set(first.rows.map(row => row.runId));
    if (second.rows.some(row => firstIds.has(row.runId))) fail(`${game}: offset 10 repeated first-page runs`);
    if (second.rows.some(row => Number(row.position) <= PAGE_SIZE)) fail(`${game}: offset 10 returned a Top 10 position`);
  }

  if (total > 0) {
    const finalOffset = Math.floor((total - 1) / PAGE_SIZE) * PAGE_SIZE;
    const final = finalOffset ? await page(game, finalOffset) : first;
    if (final.pagination.hasMore) fail(`${game}: final page still reports hasMore=true`);
    if (Number(final.pagination.nextOffset) !== total) fail(`${game}: final nextOffset must equal total`);
    if (final.rows.length !== total - finalOffset) fail(`${game}: final-page row count is inconsistent`);
  }

  console.log(`${game}: pagination OK (${total} records)`);
}

console.log('Leaderboard production pagination smoke OK');
