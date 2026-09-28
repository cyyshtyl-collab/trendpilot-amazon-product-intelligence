#!/usr/bin/env sh
set -eu

db_container=${TREND_PILOT_DB_CONTAINER:-trendpilot-db}
backup_file=${1:-}
drill_db=trendpilot_restore_drill

if [ -z "$backup_file" ] || [ ! -r "$backup_file" ]; then
  echo "Usage: $0 /opt/trendpilot/backups/trendpilot-YYYYMMDD-HHMMSS.sql.gz" >&2
  exit 2
fi

cleanup() {
  docker exec "$db_container" dropdb --if-exists -U trendpilot "$drill_db" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

cleanup
docker exec "$db_container" createdb -U trendpilot "$drill_db"
gunzip -c "$backup_file" | docker exec -i "$db_container" \
  psql -v ON_ERROR_STOP=1 -U trendpilot -d "$drill_db" >/dev/null

candidate_count=$(docker exec "$db_container" psql -At -U trendpilot -d "$drill_db" \
  -c 'SELECT count(*) FROM candidates;')
table_count=$(docker exec "$db_container" psql -At -U trendpilot -d "$drill_db" \
  -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")

if [ "$table_count" -lt 8 ]; then
  echo "Restore drill failed: only $table_count public tables were restored." >&2
  exit 1
fi

echo "Restore drill passed: $table_count tables, $candidate_count candidates."
