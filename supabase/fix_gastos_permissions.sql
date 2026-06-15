-- Fix table permissions for gastos and gasto_attachments
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/lmiymbdnqkvppaalgayr/sql/new

-- 1. Grant table-level privileges (allows anon and authenticated roles to perform operations)
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER 
ON TABLE public.gastos 
TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER 
ON TABLE public.gasto_attachments 
TO anon, authenticated, service_role;

-- 2. Enable Row Level Security (RLS) on gasto_attachments
ALTER TABLE public.gasto_attachments ENABLE ROW LEVEL SECURITY;

-- 3. Create permissive policy for gasto_attachments (aligning with gastos table)
DROP POLICY IF EXISTS "Allow all gasto_attachments" ON public.gasto_attachments;
CREATE POLICY "Allow all gasto_attachments" ON public.gasto_attachments FOR ALL USING (true) WITH CHECK (true);
