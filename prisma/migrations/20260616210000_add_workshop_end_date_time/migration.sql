-- Add end_date_time to congress_workshops
ALTER TABLE congress_workshops ADD COLUMN IF NOT EXISTS end_date_time TIMESTAMPTZ(6);
