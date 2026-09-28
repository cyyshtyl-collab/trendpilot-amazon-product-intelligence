BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS data_origin TEXT NOT NULL DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS data_verifications (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  verified_fields TEXT NOT NULL,
  source TEXT NOT NULL,
  verified_date TEXT NOT NULL,
  owner TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_data_verifications_candidate
  ON data_verifications(candidate_id, created_at DESC);

CREATE TABLE IF NOT EXISTS completion_tasks (
  id SERIAL PRIMARY KEY,
  candidate_id INTEGER NOT NULL UNIQUE REFERENCES candidates(id) ON DELETE CASCADE,
  assignee TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_completion_tasks_status_due
  ON completion_tasks(status, due_date);

INSERT INTO schema_migrations(version, applied_at)
VALUES ('20260928_p0_schema', CURRENT_TIMESTAMP::TEXT)
ON CONFLICT(version) DO NOTHING;

COMMIT;
