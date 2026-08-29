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
  INDEX idx_rwg_game_rank (game_slug, accepted, rank_primary, rank_secondary, rank_tertiary),
  INDEX idx_rwg_player_game (player_id, game_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
