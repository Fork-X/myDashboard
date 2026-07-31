CREATE TABLE records (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL CHECK (domain IN ('investment', 'thought', 'career', 'project')),
  type TEXT NOT NULL CHECK (type IN ('knowledge', 'idea', 'decision', 'experience', 'project')),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  occurred_at TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  payload_json TEXT NOT NULL DEFAULT '{}',
  source_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX records_domain_occurred_at
ON records(domain, occurred_at DESC);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('goal', 'todo')),
  period TEXT CHECK (period IN ('year', 'month') OR period IS NULL),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  target_at TEXT,
  completed_at TEXT,
  source_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX tasks_kind_status ON tasks(kind, status);
CREATE INDEX tasks_target_at ON tasks(target_at);
