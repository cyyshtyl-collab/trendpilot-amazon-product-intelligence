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
