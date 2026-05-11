-- ============================================================
-- Arthromed ERP — Congresos Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

create table if not exists public.congresos (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  start_date      date not null,
  end_date        date not null,
  location        text not null,
  description     text not null,
  flyer           text,
  specialty_id    uuid references public.catalog_specialties(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Auto-update updated_at
create trigger set_congresos_updated_at
  before update on public.congresos
  for each row execute function public.set_updated_at();

-- Indexes for common queries
create index if not exists congresos_name_idx on public.congresos using gin(to_tsvector('spanish', name));
create index if not exists congresos_start_date_idx on public.congresos(start_date);

-- Enable RLS (Row Level Security) — permissive for now
alter table public.congresos enable row level security;

-- Allow all access with anon key (no auth required)
create policy "Allow all congresos" on public.congresos for all using (true) with check (true);
