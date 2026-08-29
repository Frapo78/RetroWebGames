import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { GAMES, normalizeLeaderboardPage, normalizeRun, ORDER_SQL } from './ranking.js';

const port = Number(process.env.RWG_LEADERBOARD_PORT || 3112);
const host = process.env.RWG_LEADERBOARD_HOST || '127.0.0.1';
const productionOrigin = process.env.RWG_ORIGIN || 'https://www.retrowebgames.it';
const pool = mysql.createPool({
  host: process.env.RWG_DB_HOST || '127.0.0.1', port: Number(process.env.RWG_DB_PORT || 3306),
  user: process.env.RWG_DB_USER, password: process.env.RWG_DB_PASSWORD, database: process.env.RWG_DB_NAME || 'rwg_leaderboards',
  connectionLimit: 8, charset: 'utf8mb4', timezone: 'Z', decimalNumbers: true
});
const app = Fastify({ logger: true, trustProxy: '127.0.0.1', bodyLimit: 64 * 1024 });
await app.register(rateLimit, { max: 90, timeWindow: '1 minute', keyGenerator: request => `${request.ip}:${request.cookies?.rwg_player || ''}` });

function cookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => part.trim().split('=').map(decodeURIComponent)).filter(pair => pair.length === 2));
}
function playerFor(request, reply) {
  const parsed = cookies(request.headers.cookie);
  const current = /^[0-9a-f-]{36}$/i.test(parsed.rwg_player || '') ? parsed.rwg_player : randomUUID();
  if (current !== parsed.rwg_player) reply.header('Set-Cookie', `rwg_player=${current}; Path=/; Max-Age=63072000; HttpOnly; Secure; SameSite=Lax`);
  return current;
}
function checkOrigin(request, reply, done) {
  if (request.method === 'POST' && request.headers.origin && request.headers.origin !== productionOrigin) {
    reply.code(403).send({ message: 'Origine non autorizzata.' }); return;
  }
  done();
}
app.addHook('preHandler', checkOrigin);

async function ensurePlayer(id) {
  await pool.execute('INSERT IGNORE INTO rwg_players (id) VALUES (?)', [id]);
}
function publicRow(row, playerId) {
  return {
    position: Number(row.position), runId: row.id, nickname: row.nickname, score: Number(row.score),
    level: Number(row.level_no), continueCount: Number(row.continue_count), resultLabel: row.result_label || '',
    achievementsCount: Number(row.achievements_count || 0), playedAt: row.server_updated_at,
    isCurrent: row.player_id === playerId
  };
}
async function leaderboard(gameSlug, playerId, page = {}) {
  const { limit, offset } = normalizeLeaderboardPage(page, { limit: 10 });
  const end = offset + limit;
  const [rows] = await pool.query(`WITH ranked AS (
    SELECT id,player_id,nickname,score,level_no,continue_count,result_label,server_updated_at,
      JSON_LENGTH(achievements) achievements_count,
      ROW_NUMBER() OVER (ORDER BY ${ORDER_SQL}) position,
      COUNT(*) OVER () total_count
    FROM rwg_runs WHERE game_slug=? AND accepted=1
  ) SELECT * FROM ranked WHERE (position>? AND position<=?) OR player_id=? ORDER BY position`, [gameSlug, offset, end, playerId]);
  const top = rows.filter(row => Number(row.position) > offset && Number(row.position) <= end).map(row => publicRow(row, playerId));
  const own = rows.filter(row => row.player_id === playerId).sort((a, b) => Number(a.position) - Number(b.position))[0];
  const total = Number(rows[0]?.total_count || 0);
  const [[player]] = await pool.query('SELECT last_name FROM rwg_players WHERE id=?', [playerId]);
  return {
    gameSlug,
    generatedAt: new Date().toISOString(),
    top,
    current: own ? publicRow(own, playerId) : null,
    lastName: player?.last_name || '',
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + top.length < total,
      nextOffset: offset + top.length
    }
  };
}

app.get('/health', async () => { await pool.query('SELECT 1'); return { ok: true, service: 'rwg-leaderboards' }; });
app.get('/games/:slug', async (request, reply) => {
  const { slug } = request.params;
  if (!GAMES.has(slug)) return reply.code(404).send({ message: 'Gioco non trovato.' });
  const playerId = playerFor(request, reply); await ensurePlayer(playerId);
  return leaderboard(slug, playerId, normalizeLeaderboardPage(request.query || {}, { limit: 10 }));
});
app.post('/runs', { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }, async (request, reply) => {
  let run;
  try { run = normalizeRun(request.body); } catch (error) { return reply.code(400).send({ message: error.message }); }
  const playerId = playerFor(request, reply); await ensurePlayer(playerId);
  const [[existing]] = await pool.query('SELECT player_id FROM rwg_runs WHERE id=?', [run.runId]);
  if (existing && existing.player_id !== playerId) return reply.code(409).send({ message: 'Identificativo partita già utilizzato.' });
  await pool.execute('UPDATE rwg_players SET last_name=? WHERE id=?', [run.nickname, playerId]);
  const values = [run.runId,playerId,run.gameSlug,run.nickname,run.outcome,run.score,run.level,run.activeMs,run.continueCount,run.primary,run.secondary,run.tertiary,run.resultLabel,JSON.stringify(run.achievements),JSON.stringify(run.metrics),run.locale,run.timezone,run.deviceClass,run.clientEndedAt];
  await pool.execute(`INSERT INTO rwg_runs
    (id,player_id,game_slug,nickname,outcome,score,level_no,active_ms,continue_count,rank_primary,rank_secondary,rank_tertiary,result_label,achievements,metrics,locale,timezone,device_class,client_ended_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE nickname=VALUES(nickname),outcome=VALUES(outcome),score=VALUES(score),level_no=VALUES(level_no),active_ms=VALUES(active_ms),continue_count=VALUES(continue_count),rank_primary=VALUES(rank_primary),rank_secondary=VALUES(rank_secondary),rank_tertiary=VALUES(rank_tertiary),result_label=VALUES(result_label),achievements=VALUES(achievements),metrics=VALUES(metrics),locale=VALUES(locale),timezone=VALUES(timezone),device_class=VALUES(device_class),client_ended_at=VALUES(client_ended_at)`, values);
  const board = await leaderboard(run.gameSlug, playerId, { limit: 20, offset: 0 });
  return { accepted: true, duplicate: Boolean(existing), current: board.current, leaderboard: board };
});

app.setErrorHandler((error, _request, reply) => { app.log.error(error); reply.code(error.statusCode || 500).send({ message: error.statusCode && error.statusCode < 500 ? error.message : 'Servizio classifica temporaneamente non disponibile.' }); });
await app.listen({ host, port });
