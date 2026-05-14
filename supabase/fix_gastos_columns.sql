-- Fix for missing columns in 'gastos' table
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/lmiymbdnqkvppaalgayr/sql/new

alter table public.gastos 
add column if not exists iva_percent numeric(5, 2) not null default 16,
add column if not exists iva numeric(10, 2) not null default 0,
add column if not exists total numeric(10, 2) not null default 0,
add column if not exists comments text,
add column if not exists congress_id uuid references public.congresos(id) on delete set null,
add column if not exists category_id uuid references public.catalog_spending_categories(id) on delete set null;

-- Refresh the schema cache (optional but recommended if the error persists)
notify pgrst, 'reload schema';
