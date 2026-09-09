export const LEADERBOARD_VARIANTS = Object.freeze({
  'star-swarm': Object.freeze({ defaultVariant: 'default', variants: Object.freeze(['default']) }),
  'bubble-burst': Object.freeze({ defaultVariant: 'default', variants: Object.freeze(['default']) }),
  'block-drop': Object.freeze({ defaultVariant: 'default', variants: Object.freeze(['default']) }),
  'maze-munch': Object.freeze({ defaultVariant: 'default', variants: Object.freeze(['default']) }),
  'neon-rally': Object.freeze({ defaultVariant: 'default', variants: Object.freeze(['default']) }),
  'neon-snake': Object.freeze({ defaultVariant: 'default', variants: Object.freeze(['default']) }),
  'neon-tilt': Object.freeze({ defaultVariant: 'default', variants: Object.freeze(['default']) }),
  'prism-breaker': Object.freeze({ defaultVariant: 'default', variants: Object.freeze(['default']) }),
  solitaire: Object.freeze({ defaultVariant: 'klondike', variants: Object.freeze(['klondike', 'freecell']) }),
  'the-great-empire': Object.freeze({ defaultVariant: 'default', variants: Object.freeze(['default']) })
});

export const GAMES = new Set(Object.keys(LEADERBOARD_VARIANTS));

export const LEADERBOARD_SCOPES = Object.freeze(
  Object.entries(LEADERBOARD_VARIANTS).flatMap(([gameSlug, config]) =>
    config.variants.map((variantSlug) => Object.freeze({ gameSlug, variantSlug }))
  )
);

const legacySeason = () => Object.freeze({ scoreVersion: 1, seasonSlug: 'legacy-v1' });
const solitaireV2Season = () => Object.freeze({ scoreVersion: 2, seasonSlug: 'scoring-v2' });

export const SCORING_SCOPES = Object.freeze(Object.fromEntries(
  LEADERBOARD_SCOPES.map(({ gameSlug, variantSlug }) => {
    const legacy = legacySeason();
    const seasons = gameSlug === 'solitaire'
      ? Object.freeze([legacy, solitaireV2Season()])
      : Object.freeze([legacy]);
    return [gameSlug + ':' + variantSlug, Object.freeze({
      gameSlug, variantSlug, current: seasons[seasons.length - 1], seasons
    })];
  })
));

export function scoringCatalog() {
  return Object.freeze({
    schemaVersion: 1,
    scopes: Object.freeze(Object.values(SCORING_SCOPES).map(scope => Object.freeze({
      gameSlug: scope.gameSlug,
      variantSlug: scope.variantSlug,
      scoreVersion: scope.current.scoreVersion,
      seasonSlug: scope.current.seasonSlug,
      seasons: scope.seasons
    })))
  });
}

export function normalizeVariantSlug(gameSlug, value, metrics = {}) {
  const config = LEADERBOARD_VARIANTS[gameSlug];
  if (!config) throw new Error('Gioco non valido.');
  const candidate = value || (config.variants.length > 1 ? metrics?.variant : '') || config.defaultVariant;
  const variantSlug = String(candidate).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(variantSlug) || !config.variants.includes(variantSlug)) {
    throw new Error('Variante non valida.');
  }
  return variantSlug;
}

export function normalizeScoringScope(gameSlug, variantSlug, scoreVersion, seasonSlug) {
  const scope = SCORING_SCOPES[gameSlug + ':' + variantSlug];
  if (!scope) throw new Error('Ambito punteggio non valido.');
  const hasVersion = scoreVersion !== undefined && scoreVersion !== null && scoreVersion !== '';
  const hasSeason = seasonSlug !== undefined && seasonSlug !== null && seasonSlug !== '';
  if (!hasVersion && !hasSeason) return scope.current;
  const version = hasVersion ? Number(scoreVersion) : null;
  const season = hasSeason ? String(seasonSlug).trim().toLowerCase() : '';
  if ((hasVersion && (!Number.isInteger(version) || version < 1 || version > 100))
    || (hasSeason && !/^[a-z0-9][a-z0-9-]{0,39}$/.test(season))) {
    throw new Error('Versione punteggio o stagione non valida.');
  }
  const match = scope.seasons.find(candidate =>
    (!hasVersion || candidate.scoreVersion === version)
    && (!hasSeason || candidate.seasonSlug === season)
  );
  if (!match) throw new Error('Versione punteggio o stagione non registrata.');
  return match;
}

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
  const variantSlug = normalizeVariantSlug(body.gameSlug, body.variantSlug, metrics);
  const submittedScoreVersion = body.scoreVersion ?? metrics.scoringVersion;
  const scoring = normalizeScoringScope(
    body.gameSlug,
    variantSlug,
    submittedScoreVersion ?? (body.gameSlug === 'solitaire' ? 1 : undefined),
    body.seasonSlug
  );
  const score = integer(body.score);
  if (body.gameSlug === 'solitaire' && (score < 1 || score > 10_000)) {
    throw new Error('Il punteggio del Solitario deve essere compreso tra 1 e 10.000.');
  }
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
    runId: String(body.runId), gameSlug: body.gameSlug, variantSlug,
    scoreVersion: scoring.scoreVersion, seasonSlug: scoring.seasonSlug, nickname: normalizeNickname(body.nickname),
    outcome: String(body.outcome || 'game-over').slice(0, 32), score, level, activeMs, continueCount,
    achievements, metrics, primary, secondary, tertiary, resultLabel,
    clientEndedAt: /^\d{4}-\d\d-\d\dT/.test(String(body.clientEndedAt || '')) ? new Date(body.clientEndedAt) : null,
    locale: String(body.locale || '').slice(0, 32), timezone: String(body.timezone || '').slice(0, 64),
    deviceClass: String(body.deviceClass || '').slice(0, 24)
  };
}

export const ORDER_SQL = 'rank_primary DESC, rank_secondary DESC, rank_tertiary DESC, server_created_at ASC, id ASC';
