-- Migration: 20260722153000_add_soft_delete_deleted_at
-- Add deleted_at column to all public tables for logical soft deletes

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE "public".%I ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);', r.table_name);
  END LOOP;
END $$;
