-- ============================================================
-- Arthromed ERP — Gastos Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

create table if not exists public.gastos (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  amount          numeric(10, 2) not null default 0,
  iva_percent     numeric(5, 2) not null default 16,
  iva             numeric(10, 2) not null default 0,
  total           numeric(10, 2) not null default 0,
  comments        text,
  congress_id     uuid references public.congresos(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-update updated_at
create trigger set_gastos_updated_at
  before update on public.gastos
  for each row execute function public.set_updated_at();

-- Indexes for common queries
create index if not exists gastos_name_idx on public.gastos using gin(to_tsvector('spanish', name));
create index if not exists gastos_congress_id_idx on public.gastos(congress_id);

-- Enable RLS (Row Level Security) — permissive for now
alter table public.gastos enable row level security;

-- Allow all access with anon key (no auth required)
create policy "Allow all gastos" on public.gastos for all using (true) with check (true);
