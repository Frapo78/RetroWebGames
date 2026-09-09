CREATE TABLE IF NOT EXISTS rwg_players (
  id CHAR(36) NOT NULL PRIMARY KEY,
  last_name VARCHAR(32) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rwg_runs (
  id VARCHAR(80) NOT NULL PRIMARY KEY,
  player_id CHAR(36) NOT NULL,
  game_slug VARCHAR(40) NOT NULL,
  variant_slug VARCHAR(40) NOT NULL DEFAULT 'default',
  score_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  season_slug VARCHAR(40) NOT NULL DEFAULT 'legacy-v1',
  nickname VARCHAR(32) NOT NULL,
  outcome VARCHAR(32) NOT NULL,
  score BIGINT UNSIGNED NOT NULL DEFAULT 0,
  level_no INT UNSIGNED NOT NULL DEFAULT 0,
  active_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
  continue_count INT UNSIGNED NOT NULL DEFAULT 0,
  rank_primary BIGINT NOT NULL DEFAULT 0,
  rank_secondary BIGINT NOT NULL DEFAULT 0,
  rank_tertiary BIGINT NOT NULL DEFAULT 0,
  result_label VARCHAR(40) NOT NULL DEFAULT '',
  achievements JSON NOT NULL,
  metrics JSON NOT NULL,
  locale VARCHAR(32) NOT NULL DEFAULT '',
  timezone VARCHAR(64) NOT NULL DEFAULT '',
  device_class VARCHAR(24) NOT NULL DEFAULT '',
  client_ended_at DATETIME(3) NULL,
  server_created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  server_updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  accepted TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_rwg_runs_player FOREIGN KEY (player_id) REFERENCES rwg_players(id),
  INDEX idx_rwg_game_variant_rank (game_slug, variant_slug, accepted, rank_primary, rank_secondary, rank_tertiary),
  INDEX idx_rwg_game_variant_season_rank (game_slug, variant_slug, season_slug, accepted, rank_primary, rank_secondary, rank_tertiary),
  INDEX idx_rwg_player_game_variant (player_id, game_slug, variant_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE rwg_runs
  ADD COLUMN IF NOT EXISTS variant_slug VARCHAR(40) NOT NULL DEFAULT 'default' AFTER game_slug;

ALTER TABLE rwg_runs
  ADD COLUMN IF NOT EXISTS score_version SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER variant_slug,
  ADD COLUMN IF NOT EXISTS season_slug VARCHAR(40) NOT NULL DEFAULT 'legacy-v1' AFTER score_version;

UPDATE rwg_runs
SET variant_slug = CASE
  WHEN JSON_UNQUOTE(JSON_EXTRACT(metrics, '$.variant')) = 'freecell' THEN 'freecell'
  ELSE 'klondike'
END
WHERE game_slug = 'solitaire' AND variant_slug = 'default';

UPDATE rwg_runs
SET score_version = 2, season_slug = 'scoring-v2'
WHERE game_slug = 'solitaire'
  AND CAST(JSON_UNQUOTE(JSON_EXTRACT(metrics, '$.scoringVersion')) AS UNSIGNED) = 2;

UPDATE rwg_runs
SET score_version = 1, season_slug = 'legacy-v1'
WHERE score_version IS NULL OR score_version < 1 OR season_slug IS NULL OR season_slug = '';

ALTER TABLE rwg_runs
  ADD INDEX IF NOT EXISTS idx_rwg_game_variant_rank (game_slug, variant_slug, accepted, rank_primary, rank_secondary, rank_tertiary),
  ADD INDEX IF NOT EXISTS idx_rwg_game_variant_season_rank (game_slug, variant_slug, season_slug, accepted, rank_primary, rank_secondary, rank_tertiary),
  ADD INDEX IF NOT EXISTS idx_rwg_player_game_variant (player_id, game_slug, variant_slug);
