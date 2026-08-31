# Global leaderboards

RetroWebGames exposes one server-backed global leaderboard per game. The gameplay runtimes remain client-side; ranking persistence is a best-effort competitive feature, not server-authoritative anti-cheat.

## Shared browser contract

`game-hud.js` loads the shared leaderboard stack on every game page:

- `rwg-leaderboard.js` — submission, nickname, home/pause boards and compatibility rendering;
- `rwg-leaderboard-infinite.js` — authoritative paged endless-scroll behavior and viewport fitting for the game intro High Scores;
- `rwg-leaderboard.css` — all shared ranking presentation.

Games MUST NOT create local leaderboard implementations.

The shared client listens to:

- `rwg:game-session-start` — starts a new leaderboard run id;
- `rwg:game-over-summary` — terminal result from the shared Game Over;
- `rwg:leaderboard-result` — successful completion without Game Over, currently Solitario;
- `online` — retries idempotently queued submissions and refreshes ranking state.

The home loads the same base client and stylesheet directly. It attaches a live Top 3 below each game card, using the same endpoint and per-game cache as game pages. On game pages a compact Top 3 appears above the playfield whenever `RWGSession` asks whether to restore a run or `#pauseBtn` exposes the shared paused state `▶`; it disappears on resume and is suppressed by Game Over.

## Intro High Scores — dynamic viewport-fitted endless scroll — CRITICAL

The ranking inside every game start screen is named **HIGH SCORES**. It is not a fixed Top 10: the first ten positions are only the first page of an endless ranking.

The High Scores component replaces the former descriptive caption in every game intro. Each page exposes one `.rwg-intro-leaderboard-slot`; the shared client replaces it in place with the live ranking, so the board appears immediately below the cover instead of being appended after the action buttons. Game runtimes that historically write to `#overlayText` retain an empty `.rwg-intro-runtime-copy` as an accessible off-layout status node, avoiding null-reference regressions without restoring visible caption copy.

The High Scores component must use as much useful vertical space as the current intro can safely provide. It must therefore grow on tall phones/tablets instead of remaining an artificially narrow strip, while still guaranteeing that the cover, `GIOCA`, `TORNA AL MENU`, game-specific compact controls, hints and the social sharing actions remain visible inside the current visual viewport.

`rwg-leaderboard-infinite.js` owns this calculation centrally. It measures the intro overlay and panel at runtime and assigns `--rwg-lb-fit-height` to the shared board. The calculation:

- uses the real visible viewport (`visualViewport.height` when available) and never assumes that browser chrome leaves the full layout viewport visible;
- subtracts overlay padding and all non-leaderboard intro content; removing the old caption therefore gives its entire former budget to the ranking;
- reserves **54 px** for the social row until `.rwg-intro-share` has actually mounted;
- keeps a **12 px** vertical safety budget;
- clamps the board to a compact minimum of **64 px** and a generous maximum of **420 px**;
- recalculates after initial mount, font readiness, share-row insertion, resize, Visual Viewport resize and orientation change;
- on narrow/short phones the CSS fallback minimum becomes 60 px and the informational status line is hidden, but the component may still grow if real space exists;
- only `.rwg-lb-list` scrolls vertically; the intro page itself does not become a leaderboard scroller;
- touch scrolling uses `touch-action: pan-y`, contained overscroll and iOS momentum scrolling.

The CSS fallback, used before the JS measurement settles or if measurement is unavailable, is `clamp(88px, 15dvh, 156px)`. It is not the authoritative final height: the fitted runtime value is.

This means that on a screen such as 390×844, High Scores should generally expose several more rows than the old 64–96 px implementation and naturally push the social icons downward into otherwise unused space. On a shorter viewport it must contract first, never hide the Share controls merely to show more leaderboard rows.

The first ranking request contains exactly **10 positions**. When the internal list reaches the final ~24 px of its own scroll range, `rwg-leaderboard-infinite.js` requests the next ten. Offsets therefore advance `0, 10, 20, 30…` until the ranking is exhausted.

End-of-ranking handling is defensive rather than relying on one API flag alone. Infinite loading stops when any of these indicates completion:

- the API returns `pagination.hasMore=false`;
- the returned page contains fewer than 10 rows;
- `nextOffset` does not advance;
- `nextOffset` reaches the known total.

When completed, the component removes its `scroll`, `wheel` and `touchend` endless-load listeners and marks the board with `data-rwg-infinite-complete="true"`. Normal internal scrolling of already loaded records still works, but no further API requests can be triggered. A manual retry/reset re-enables the listeners and restarts at offset 0.

This behavior is centralized through mandatory `game-hud.js`, so Solitario and every other current/future game inherit the same component automatically. Do not add a game-local ranking table or override it with a page-growing list.

The status line reports loaded/total records and whether scrolling can continue. The endless component emits only low-cardinality/numeric GA4 pagination information through `leaderboard_infinite_page`; nicknames and run IDs are never sent to Analytics.

## Run and nickname behavior

A credit Continue remains part of the same run. A later Game Over updates that run and its `continueCount`; the UI displays `CONTINUE ×N` only for positive values. A deliberate new game creates a new run and therefore a new leaderboard entry.

The nickname is 3–12 Unicode letters/numbers plus spaces, `_` or `-`. The first completed result without a valid saved name opens a dedicated coin-op modal above the shared Game Over; the form is no longer embedded in the summary card. The accepted name is stored locally and server-side as the player's latest name. Every later result from that browser is registered automatically with the saved name, without showing the modal again. Historical runs keep their nickname snapshot.

Only the first-name choice blocks the Game Over actions. Automatic later submissions run without interrupting the player. A network failure queues the complete result locally and unlocks the first-use modal, so an API outage cannot trap gameplay. The server's unique run id makes retries safe.

After server acceptance, Game Over inserts a compact position card before sharing controls. Rank 1–10 is highlighted in gold with `SEI NELLA TOP TEN!`; lower ranks use the standard cyan treatment. Offline queueing displays `POSIZIONE IN AGGIORNAMENTO` until a server rank exists and never fabricates a placement.

Analytics measures this funnel through the shared RWG layer. A successful live or queued delivery emits GA4 recommended `post_score`; views, retry, first-use prompt, automatic submission, validation, offline queue, infinite-page loading and aggregate flush outcomes use dedicated low-cardinality events. Nickname, player/device identifiers, run id and free-form messages never enter Analytics. See `docs/ANALYTICS.md`.

## API

Nginx proxies `/api/leaderboards/v1/` to the loopback-only `rwg-leaderboard.service`.

### `GET /games/:slug`

Query parameters:

- `limit` — number of ranked rows, bounded to **1..50**;
- `offset` — zero-based ranking offset, bounded to a non-negative integer.

The compatibility default remains 10 rows when no query is supplied. Game intro High Scores explicitly request `limit=10` for every page.

The response contains:

- `top` — only the requested page;
- `current` — the current browser's best run when present, even when outside that page;
- `lastName` — latest stored nickname for the anonymous browser;
- `pagination.limit`;
- `pagination.offset`;
- `pagination.total`;
- `pagination.hasMore`;
- `pagination.nextOffset`.

The server computes rank and total with SQL window functions and does not download the complete ranking merely to paginate it.

### Other endpoints

- `POST /runs` creates or updates an idempotent run and returns the authoritative current placement plus a leaderboard snapshot used by the result flow;
- `GET /health` verifies the process and MariaDB connection.

The service issues a Secure, HttpOnly, SameSite=Lax pseudonymous player cookie. Clearing both cookies and local browser storage loses this anonymous identity. No account, email or hardware fingerprint is collected.

## Ranking

Every completed new run is eligible, including multiple runs from the same player.

- Arcade games: score, level/progression, game-specific tertiary metric, then earliest server timestamp.
- Neon Rally: win, score differential, maximum rally, then timestamp.
- Solitario: score, lower elapsed time, lower move count, then timestamp.

The ranking is run-based. The paged intro can traverse all accepted runs in ranking order. The server also returns the current browser's best position independently from the requested page.

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

The GET endpoint already supports `limit=10&offset=N`; this UI change does not require a database migration. Restart the leaderboard service only when server code itself changes.

Credentials live only in `/etc/rwg/leaderboard.env`. The installer is idempotent, applies `schema.sql`, installs locked production dependencies, installs the Nginx proxy snippet and restarts the service. Back up the `rwg_leaderboards` database with the normal MariaDB backup regime.

## Validation

```bash
node scripts/validate-leaderboards.mjs
node scripts/validate-contracts.mjs
```

Browser smoke tests must cover every intro, all home Top 3 panels, actual Solitario resume prompt, explicit pause visibility, first-use overlay, invalid nickname, automatic later submission without a prompt, gold Top Ten and standard lower-rank Game Over cards, API-offline queue/retry, personal position outside the first page, Continue update and Solitario victory.

For intro High Scores specifically test at 320×568, 375×667, 390×844 and larger mobile/tablet viewports:

1. title/description, `GIOCA`, `TORNA AL MENU`, hints and intro social actions remain visible/reachable;
2. High Scores expands into genuinely free vertical space and contracts when space is scarce;
3. the social row remains visible after the leaderboard has reached its fitted height, including with Safari browser chrome visible;
4. the ranking list scrolls independently with touch;
5. initial request loads exactly 10 rows;
6. reaching its lower edge requests offsets 10, 20, 30…;
7. a short final page or `hasMore=false` disables further endless-load listeners and requests;
8. retry resets to offset 0 and re-enables endless loading;
9. rotating/resizing or showing/hiding browser chrome recalculates the leaderboard height without clipping Share;
10. home Top 3 and pause/resume Top 3 remain compact and unchanged.

Game Over headings must show only each short game name.

Operational guardrail: do not add `MemoryDenyWriteExecute=true` to `rwg-leaderboard.service`. It is incompatible with the Node/V8 JIT on this VPS and causes an immediate `SIGTRAP`; the service remains protected by the other systemd sandbox directives and its loopback-only listener.

Installer guardrail: configuration must come from real versioned files. Do not use `install /dev/stdin ...` for the environment or Nginx snippet; `/dev/stdin` is not a reliable filesystem source in every privileged execution context on this VPS. The Nginx location source is `ops/rwg-leaderboards.nginx.conf`, while a new private environment is written atomically to `${ENV_FILE}.new` and renamed.

Reload guardrail: `systemctl reload nginx` can return before every worker serves the new configuration. Both local and public leaderboard health gates use bounded retries; an immediate transient 404 must not fail a healthy rollout, while exhaustion of the retry budget remains fatal.
