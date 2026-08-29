# Global leaderboards

RetroWebGames exposes one server-backed global leaderboard per game. The gameplay runtimes remain client-side; ranking persistence is a best-effort competitive feature, not server-authoritative anti-cheat.

## Shared browser contract

`game-hud.js` loads `rwg-leaderboard.js` and `rwg-leaderboard.css` on every game page. The module injects the global top 10 into the initial overlay and listens to:

- `rwg:game-session-start` — starts a new leaderboard run id;
- `rwg:game-over-summary` — terminal result from the shared Game Over;
- `rwg:leaderboard-result` — successful completion without Game Over, currently Solitario;
- `online` — retries idempotently queued submissions.

A credit Continue remains part of the same run. A later Game Over updates that run and its `continueCount`; the UI displays `CONTINUE ×N` only for positive values. A deliberate new game creates a new run and therefore a new leaderboard entry.

The nickname is 3–12 Unicode letters/numbers plus spaces, `_` or `-`. It is stored locally for prefill and server-side as the player's latest name. Historical runs keep their nickname snapshot.

Registration is required before the Game Over actions. A network failure queues the complete result locally and unlocks the actions, so an API outage cannot trap gameplay. The server's unique run id makes retries safe.

## API

Nginx proxies `/api/leaderboards/v1/` to the loopback-only `rwg-leaderboard.service`.

- `GET /games/:slug` returns `top`, the current browser's best run when present, and `lastName`.
- `POST /runs` creates or updates an idempotent run.
- `GET /health` verifies the process and MariaDB connection.

The service issues a Secure, HttpOnly, SameSite=Lax pseudonymous player cookie. Clearing both cookies and local browser storage loses this anonymous identity. No account, email or hardware fingerprint is collected.

## Ranking

Every completed new run is eligible, including multiple runs from the same player.

- Arcade games: score, level/progression, game-specific tertiary metric, then earliest server timestamp.
- Neon Rally: win, score differential, maximum rally, then timestamp.
- Solitario: score, lower elapsed time, lower move count, then timestamp.

The top 10 is run-based. If none of the current player's runs is in it, the intro appends `…` and that player's best overall position.

## Stored data and privacy

The database stores player/run ids, nickname snapshot, server/client timestamps, score, level, duration, Continue count, outcome, achievements, validated per-game metrics, locale, timezone and coarse input/device class. Raw IP addresses are not stored in leaderboard tables. Existing Nginx operational logs remain governed by VPS retention policy.

Client values are validated, bounded and rate-limited. This blocks malformed/common abuse but cannot prove an unmodified JavaScript client; never describe these rankings as cheat-proof.

## Operations

Authoritative files live under `server/leaderboards/` and `ops/`. On the VPS:

```bash
sudo bash /projects/RWG/ops/install-rwg-leaderboards.sh
systemctl status rwg-leaderboard.service
curl -fsS http://127.0.0.1:3112/health
curl -fsS https://www.retrowebgames.it/api/leaderboards/v1/health
```

Credentials live only in `/etc/rwg/leaderboard.env`. The installer is idempotent, applies `schema.sql`, installs locked production dependencies, installs the Nginx proxy snippet and restarts the service. Back up the `rwg_leaderboards` database with the normal MariaDB backup regime.

## Validation

```bash
node scripts/validate-leaderboards.mjs
node scripts/validate-contracts.mjs
```

Browser smoke tests must cover every intro, successful submission, invalid nickname, API-offline queue/retry, personal position outside the top 10, Continue update and Solitario victory at 320×568 and larger viewports.

Operational guardrail: do not add `MemoryDenyWriteExecute=true` to `rwg-leaderboard.service`. It is incompatible with the Node/V8 JIT on this VPS and causes an immediate `SIGTRAP`; the service remains protected by the other systemd sandbox directives and its loopback-only listener.

Installer guardrail: configuration must come from real versioned files. Do not use `install /dev/stdin ...` for the environment or Nginx snippet; `/dev/stdin` is not a reliable filesystem source in every privileged execution context on this VPS. The Nginx location source is `ops/rwg-leaderboards.nginx.conf`, while a new private environment is written atomically to `${ENV_FILE}.new` and renamed.
