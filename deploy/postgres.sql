CREATE TABLE IF NOT EXISTS candidates (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, asin TEXT, category TEXT NOT NULL,
  data_origin TEXT NOT NULL DEFAULT 'manual',
  market TEXT NOT NULL, score INTEGER NOT NULL, verdict TEXT NOT NULL,
  trend INTEGER NOT NULL DEFAULT 0, revenue TEXT NOT NULL DEFAULT '$0',
  reviews INTEGER NOT NULL DEFAULT 0, margin INTEGER NOT NULL DEFAULT 0,
  price TEXT NOT NULL DEFAULT '$0', bsr INTEGER NOT NULL DEFAULT 0,
  rating DOUBLE PRECISION NOT NULL DEFAULT 0, search_volume INTEGER NOT NULL DEFAULT 0,
  review_growth INTEGER NOT NULL DEFAULT 0, review_text TEXT NOT NULL DEFAULT '',
  scores_json TEXT NOT NULL, signals_json TEXT NOT NULL, pains_json TEXT NOT NULL,
  selling_point TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_candidates_score ON candidates(score);
CREATE INDEX IF NOT EXISTS idx_candidates_verdict ON candidates(verdict);
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_asin_market ON candidates(asin, market);
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS data_origin TEXT NOT NULL DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS analysis_runs (
  id SERIAL PRIMARY KEY, provider TEXT NOT NULL, model TEXT NOT NULL,
  requested INTEGER NOT NULL, succeeded INTEGER NOT NULL, fallback INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL, status TEXT NOT NULL, error_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_created_at ON analysis_runs(created_at);

CREATE TABLE IF NOT EXISTS candidate_snapshots (
  id SERIAL PRIMARY KEY, candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  captured_date TEXT NOT NULL, price TEXT NOT NULL DEFAULT '$0', bsr INTEGER NOT NULL DEFAULT 0,
  rating DOUBLE PRECISION NOT NULL DEFAULT 0, reviews INTEGER NOT NULL DEFAULT 0,
  review_growth INTEGER NOT NULL DEFAULT 0, search_volume INTEGER NOT NULL DEFAULT 0,
  trend INTEGER NOT NULL DEFAULT 0, revenue TEXT NOT NULL DEFAULT '$0',
  margin INTEGER NOT NULL DEFAULT 0, captured_at TEXT NOT NULL,
  UNIQUE(candidate_id, captured_date)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_captured_date ON candidate_snapshots(captured_date);

CREATE TABLE IF NOT EXISTS alert_actions (
  alert_key TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'pending',
  note TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alert_actions_status ON alert_actions(status);

CREATE TABLE IF NOT EXISTS source_runs (
  id SERIAL PRIMARY KEY, source TEXT NOT NULL, market TEXT NOT NULL, status TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0, error_message TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL, finished_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_source_runs_started_at ON source_runs(started_at);

CREATE TABLE IF NOT EXISTS trend_signals (
  id SERIAL PRIMARY KEY, keyword TEXT NOT NULL, source TEXT NOT NULL, market TEXT NOT NULL,
  traffic_text TEXT NOT NULL DEFAULT '', traffic_value INTEGER NOT NULL DEFAULT 0,
  published_at TEXT NOT NULL DEFAULT '', captured_date TEXT NOT NULL,
  candidate_id INTEGER REFERENCES candidates(id) ON DELETE SET NULL, promoted_at TEXT,
  ai_verdict TEXT, ai_score INTEGER, ai_reason TEXT, screened_at TEXT, created_at TEXT NOT NULL,
  UNIQUE(keyword, source, market, captured_date)
);
CREATE INDEX IF NOT EXISTS idx_trend_signals_created_at ON trend_signals(created_at);

CREATE TABLE IF NOT EXISTS weekly_reports (
  id SERIAL PRIMARY KEY, week_start TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
  markdown TEXT NOT NULL, tracked_count INTEGER NOT NULL DEFAULT 0,
  high_potential_count INTEGER NOT NULL DEFAULT 0, watch_count INTEGER NOT NULL DEFAULT 0,
  alert_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'ready',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_created_at ON weekly_reports(created_at);

CREATE TABLE IF NOT EXISTS app_users (
  id SERIAL PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
