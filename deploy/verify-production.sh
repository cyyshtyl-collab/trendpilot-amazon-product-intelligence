#!/usr/bin/env sh
set -eu

app_container=${TREND_PILOT_APP_CONTAINER:-trendpilot-app}
db_container=${TREND_PILOT_DB_CONTAINER:-trendpilot-db}

docker inspect "$app_container" >/dev/null
docker inspect "$db_container" >/dev/null
docker exec "$db_container" pg_isready -U trendpilot -d trendpilot >/dev/null
curl --fail --silent --show-error http://127.0.0.1/ >/dev/null

missing=$(docker exec "$db_container" psql -At -U trendpilot -d trendpilot <<'SQL'
WITH required(kind, name) AS (
  VALUES
    ('table', 'candidates'),
    ('table', 'candidate_snapshots'),
    ('table', 'data_verifications'),
    ('table', 'completion_tasks'),
    ('table', 'schema_migrations'),
    ('table', 'analysis_runs'),
    ('table', 'weekly_reports'),
    ('column', 'candidates.data_origin')
), present(kind, name) AS (
  SELECT 'table', table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  UNION ALL
  SELECT 'column', table_name || '.' || column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
)
SELECT string_agg(r.kind || ':' || r.name, ',')
FROM required AS r
LEFT JOIN present AS p ON p.kind = r.kind AND p.name = r.name
WHERE p.name IS NULL;
SQL
)

if [ -n "$missing" ]; then
  echo "Production schema verification failed; missing: $missing" >&2
  exit 1
fi

echo "TrendPilot production verification passed."
