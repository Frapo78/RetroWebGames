export const GAMES = new Set(['star-swarm','bubble-burst','block-drop','maze-munch','neon-rally','neon-snake','neon-tilt','prism-breaker','solitaire']);

const integer = (value, min = 0, max = 2_000_000_000) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.trunc(number)));
};

export function normalizeLeaderboardPage(query = {}, defaults = {}) {
  const defaultLimit = integer(defaults.limit ?? 10, 1, 50);
  const rawLimit = Number(query.limit);
  const rawOffset = Number(query.offset);
  const limit = Number.isFinite(rawLimit) ? integer(rawLimit, 1, 50) : defaultLimit;
  const offset = Number.isFinite(rawOffset) ? integer(rawOffset, 0, 2_000_000_000) : 0;
  return { limit, offset };
}

export function normalizeNickname(value) {
  const nickname = String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!/^[\p{L}\p{N}_ -]{3,12}$/u.test(nickname)) throw new Error('Il nome deve contenere 3–12 lettere, numeri, spazi, - o _.');
  return nickname;
}

export function normalizeRun(body) {
  if (!body || !GAMES.has(body.gameSlug)) throw new Error('Gioco non valido.');
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(String(body.runId || ''))) throw new Error('Partita non valida.');
  const metrics = body.metrics && typeof body.metrics === 'object' && !Array.isArray(body.metrics) ? body.metrics : {};
  const score = integer(body.score);
  const level = integer(body.level, 0, 100_000);
  const activeMs = integer(body.activeMs, 0, 604_800_000);
  const continueCount = integer(body.continueCount, 0, 10_000);
  const achievements = Array.isArray(body.achievements) ? body.achievements.slice(0, 100).map(item => ({
    id: String(item?.id || '').slice(0, 64), label: String(item?.label || '').slice(0, 120), isNew: Boolean(item?.isNew)
  })).filter(item => item.id) : [];
  let primary = score, secondary = level, tertiary = integer(metrics.maxCombo || metrics.lines || metrics.cycle || 0);
  let resultLabel = '';
  if (body.gameSlug === 'neon-rally') {
    const player = integer(metrics.playerScore ?? body.score, 0, 99);
    const cpu = integer(metrics.cpuScore, 0, 99);
    const won = metrics.result === 'win' || player > cpu;
    primary = won ? 1 : 0; secondary = player - cpu; tertiary = integer(metrics.maxRally || 0);
    resultLabel = `${player}–${cpu}`;
  } else if (body.gameSlug === 'solitaire') {
    const elapsed = integer(metrics.elapsed ?? activeMs / 1000, 0, 604_800);
    const moves = integer(metrics.moves, 0, 1_000_000);
    secondary = -elapsed; tertiary = -moves;
  }
  return {
    runId: String(body.runId), gameSlug: body.gameSlug, nickname: normalizeNickname(body.nickname),
    outcome: String(body.outcome || 'game-over').slice(0, 32), score, level, activeMs, continueCount,
    achievements, metrics, primary, secondary, tertiary, resultLabel,
    clientEndedAt: /^\d{4}-\d\d-\d\dT/.test(String(body.clientEndedAt || '')) ? new Date(body.clientEndedAt) : null,
    locale: String(body.locale || '').slice(0, 32), timezone: String(body.timezone || '').slice(0, 64),
    deviceClass: String(body.deviceClass || '').slice(0, 24)
  };
}

export const ORDER_SQL = 'rank_primary DESC, rank_secondary DESC, rank_tertiary DESC, server_created_at ASC, id ASC';
