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
