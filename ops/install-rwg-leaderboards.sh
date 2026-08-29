#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT=/projects/RWG
APP="$PROJECT/server/leaderboards"
ENV_DIR=/etc/rwg
ENV_FILE="$ENV_DIR/leaderboard.env"
UNIT=/etc/systemd/system/rwg-leaderboard.service
SNIPPET=/etc/nginx/snippets/rwg-leaderboards.conf
VHOST=/etc/nginx/sites-available/retrowebgames.it.conf
STAMP="$(date +%Y%m%d%H%M%S)"
BACKUP="/var/backups/frapovps/rwg-leaderboard-${STAMP}"

[[ "$EUID" -eq 0 ]] || { echo "Eseguire come root" >&2; exit 1; }
wait_for_health() {
  local url="$1" label="$2"
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS -o /dev/null --max-time 5 "$url"; then
      echo "$label: ok"
      return 0
    fi
    sleep 1
  done
  echo "$label: nessuna risposta valida da $url" >&2
  return 1
}

for path in "$APP/package-lock.json" "$APP/schema.sql" "$PROJECT/ops/rwg-leaderboard.service" "$PROJECT/ops/rwg-leaderboards.nginx.conf" "$VHOST"; do
  [[ -f "$path" ]] || { echo "Manca $path" >&2; exit 1; }
done
install -d -o root -g root -m 0700 "$BACKUP"
cp -a "$VHOST" "$BACKUP/retrowebgames.it.conf"
[[ ! -f "$ENV_FILE" ]] || cp -a "$ENV_FILE" "$BACKUP/leaderboard.env"

install -d -o root -g site_rwg -m 0750 "$ENV_DIR"
if [[ ! -s "$ENV_FILE" ]]; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  umask 0077
  printf '%s\n' \
    'RWG_LEADERBOARD_HOST=127.0.0.1' \
    'RWG_LEADERBOARD_PORT=3112' \
    'RWG_ORIGIN=https://www.retrowebgames.it' \
    'RWG_DB_HOST=127.0.0.1' \
    'RWG_DB_PORT=3306' \
    'RWG_DB_NAME=rwg_leaderboards' \
    'RWG_DB_USER=rwg_leaderboard' \
    "RWG_DB_PASSWORD=${DB_PASSWORD}" > "${ENV_FILE}.new"
  chown root:site_rwg "${ENV_FILE}.new"
  chmod 0640 "${ENV_FILE}.new"
  mv -f "${ENV_FILE}.new" "$ENV_FILE"
fi
set -a
source "$ENV_FILE"
set +a
[[ "$RWG_DB_PASSWORD" =~ ^[0-9a-f]{48}$ ]] || { echo "Password DB RWG non valida" >&2; exit 1; }

mysql --protocol=socket --execute="CREATE DATABASE IF NOT EXISTS rwg_leaderboards CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'rwg_leaderboard'@'127.0.0.1' IDENTIFIED BY '${RWG_DB_PASSWORD}'; ALTER USER 'rwg_leaderboard'@'127.0.0.1' IDENTIFIED BY '${RWG_DB_PASSWORD}'; GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES ON rwg_leaderboards.* TO 'rwg_leaderboard'@'127.0.0.1'; FLUSH PRIVILEGES;"
mysql --protocol=tcp -h 127.0.0.1 -u "$RWG_DB_USER" -p"$RWG_DB_PASSWORD" "$RWG_DB_NAME" < "$APP/schema.sql"

runuser -u fra -- npm --prefix "$APP" ci --omit=dev --ignore-scripts
install -o root -g root -m 0644 "$PROJECT/ops/rwg-leaderboard.service" "$UNIT"
install -o root -g root -m 0644 "$PROJECT/ops/rwg-leaderboards.nginx.conf" "$SNIPPET"
if ! grep -qF 'include /etc/nginx/snippets/rwg-leaderboards.conf;' "$VHOST"; then
  sed -i '/^[[:space:]]*location \/ {/i\    include /etc/nginx/snippets/rwg-leaderboards.conf;' "$VHOST"
fi
systemctl daemon-reload
systemctl enable rwg-leaderboard.service
systemctl restart rwg-leaderboard.service
wait_for_health http://127.0.0.1:3112/health "Health locale leaderboard"
nginx -t
systemctl reload nginx
wait_for_health https://www.retrowebgames.it/api/leaderboards/v1/health "Health pubblica leaderboard"
echo "RWG leaderboard operativo. Backup: $BACKUP"
