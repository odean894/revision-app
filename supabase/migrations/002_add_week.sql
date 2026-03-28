-- Add week and note_type columns
-- Run this in Supabase SQL Editor if you have an existing database (Dashboard > SQL Editor)

ALTER TABLE files ADD COLUMN IF NOT EXISTS week int DEFAULT 1;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS week int DEFAULT 1;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS note_type text;
