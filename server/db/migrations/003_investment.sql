CREATE TABLE tickers (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  event_start_date TEXT NOT NULL,
  event_end_date TEXT NOT NULL,
  date_confidence TEXT NOT NULL DEFAULT 'exact'
    CHECK (date_confidence IN ('exact', 'fuzzy')),
  ambush_days INTEGER NOT NULL DEFAULT 60,
  tags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags_json)),
  ticker_ids TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(ticker_ids)),
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX events_event_start_date ON events(event_start_date);
CREATE INDEX events_status ON events(status);

CREATE TABLE directions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  keywords TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  priority INTEGER NOT NULL DEFAULT 0,
  scan_interval_hours INTEGER NOT NULL DEFAULT 6,
  last_scanned_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE inbox_items (
  id TEXT PRIMARY KEY,
  direction_id TEXT REFERENCES directions(id) ON DELETE SET NULL,
  source_summary TEXT NOT NULL CHECK (length(trim(source_summary)) > 0),
  source_url TEXT NOT NULL DEFAULT '',
  ai_event_name TEXT NOT NULL DEFAULT '',
  ai_event_start_date TEXT NOT NULL DEFAULT '',
  ai_event_end_date TEXT NOT NULL DEFAULT '',
  date_confidence TEXT NOT NULL DEFAULT 'fuzzy'
    CHECK (date_confidence IN ('exact', 'fuzzy')),
  ai_tags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(ai_tags_json)),
  ai_tickers_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(ai_tickers_json)),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'converted', 'ignored')),
  converted_event_id TEXT,
  scanned_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX inbox_items_status ON inbox_items(status);
CREATE INDEX inbox_items_direction_id ON inbox_items(direction_id);