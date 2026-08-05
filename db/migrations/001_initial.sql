CREATE TABLE thoughts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  tags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags_json)),
  created_at TEXT NOT NULL
);

CREATE INDEX thoughts_created_at ON thoughts(created_at DESC);

CREATE TRIGGER thoughts_no_update
BEFORE UPDATE ON thoughts
BEGIN
  SELECT RAISE(ABORT, 'thoughts are immutable');
END;

CREATE TRIGGER thoughts_no_delete
BEFORE DELETE ON thoughts
BEGIN
  SELECT RAISE(ABORT, 'thoughts are immutable');
END;

CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX goals_status_updated_at ON goals(status, updated_at DESC);

CREATE TABLE goal_progress (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE RESTRICT,
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  created_at TEXT NOT NULL
);

CREATE INDEX goal_progress_goal_id_created_at
ON goal_progress(goal_id, created_at DESC);

CREATE TRIGGER goal_progress_no_update
BEFORE UPDATE ON goal_progress
BEGIN
  SELECT RAISE(ABORT, 'goal progress is immutable');
END;

CREATE TRIGGER goal_progress_no_delete
BEFORE DELETE ON goal_progress
BEGIN
  SELECT RAISE(ABORT, 'goal progress is immutable');
END;

CREATE TABLE todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  is_important INTEGER NOT NULL DEFAULT 0 CHECK (is_important IN (0, 1)),
  is_urgent INTEGER NOT NULL DEFAULT 0 CHECK (is_urgent IN (0, 1)),
  tags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags_json)),
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX todos_status_important_urgent_created_at
ON todos(status, is_important, is_urgent, created_at DESC);
