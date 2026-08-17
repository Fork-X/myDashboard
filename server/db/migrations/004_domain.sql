ALTER TABLE directions ADD COLUMN domain TEXT NOT NULL DEFAULT 'stock';
ALTER TABLE inbox_items ADD COLUMN domain TEXT;
