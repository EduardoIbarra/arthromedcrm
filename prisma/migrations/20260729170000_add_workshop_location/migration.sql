-- Add location to congress_workshops
ALTER TABLE congress_workshops ADD COLUMN IF NOT EXISTS location TEXT;
