#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
db_container=${TREND_PILOT_DB_CONTAINER:-trendpilot-db}

docker exec -i "$db_container" psql -v ON_ERROR_STOP=1 -U trendpilot -d trendpilot <<'SQL' >/dev/null
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
SQL

for migration in "$script_dir"/migrations/*.sql; do
  [ -f "$migration" ] || continue
  version=$(basename "$migration" .sql)
  case "$version" in
    *[!A-Za-z0-9_-]*)
      echo "Unsafe migration filename: $version" >&2
      exit 1
      ;;
  esac
  applied=$(docker exec "$db_container" psql -At -U trendpilot -d trendpilot \
    -c "SELECT count(*) FROM schema_migrations WHERE version='$version';")
  if [ "$applied" = "1" ]; then
    echo "Already applied: $version"
    continue
  fi
  docker exec -i "$db_container" psql -v ON_ERROR_STOP=1 -U trendpilot -d trendpilot \
    < "$migration" >/dev/null
  echo "Applied: $version"
done
