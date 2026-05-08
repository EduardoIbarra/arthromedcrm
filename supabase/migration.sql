-- ============================================================
-- Arthromed ERP — Supabase Migration
-- Run this once in your Supabase SQL Editor
-- ============================================================

-- Clients / Distributors
create table if not exists public.clients (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  registered_at   timestamptz,
  name            text not null,
  rfc             text,
  zip_code        text,
  fiscal_address  text,
  email_primary   text,
  email_billing   text,
  email_contact   text,
  phone           text,
  whatsapp_phone  text,
  states          text[],
  hospitals       text[],
  specialties     text[],
  tax_regime      text,
  status          text not null default 'Nuevo Prospecto' check (status in ('Nuevo Prospecto', 'Contactado', 'Calificado', 'Negociación', 'Activo', 'Inactivo', 'Perdido')),
  source          text,
  notes           text,
  tags            text[],
  assigned_to     text,
  last_contact_at timestamptz,
  updated_at      timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- Activity / interaction log
create table if not exists public.client_activities (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  type        text not null check (type in ('whatsapp','llamada','email','nota','visita','sistema')),
  content     text,
  created_at  timestamptz not null default now(),
  created_by  text
);

-- Custom fields (key-value per client)
create table if not exists public.client_custom_fields (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  field_name  text not null,
  field_value text,
  created_at  timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists clients_status_idx on public.clients(status);
create index if not exists clients_name_idx on public.clients using gin(to_tsvector('spanish', name));
create index if not exists client_activities_client_id_idx on public.client_activities(client_id);

-- Enable RLS (Row Level Security) — permissive for now
alter table public.clients enable row level security;
alter table public.client_activities enable row level security;
alter table public.client_custom_fields enable row level security;

-- Allow all access with anon key (no auth required)
create policy "Allow all clients" on public.clients for all using (true) with check (true);
create policy "Allow all activities" on public.client_activities for all using (true) with check (true);
create policy "Allow all custom fields" on public.client_custom_fields for all using (true) with check (true);

-- ============================================================
-- Incremental Update: Add Lifecycle Stages and Source Tracking
-- ============================================================

-- 1. Update status check constraint
alter table public.clients 
drop constraint if exists clients_status_check;

alter table public.clients
add constraint clients_status_check 
check (status in (
  'Nuevo Prospecto',
  'Contactado',
  'Calificado',
  'Negociación',
  'Activo',
  'Inactivo',
  'Perdido'
));

-- 2. Add source column
alter table public.clients
add column if not exists source text;

-- 3. Update default status for future inserts
alter table public.clients
alter column status set default 'Nuevo Prospecto';

-- ============================================================
-- Catalogue: Medical Specialties
-- ============================================================

create table if not exists public.catalog_specialties (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- Enable RLS
alter table public.catalog_specialties enable row level security;
create policy "Allow all specialties" on public.catalog_specialties for all using (true) with check (true);

-- Initial population
insert into public.catalog_specialties (name) values
  ('Ortopedia y Traumatología'),
  ('Cirugía de Columna'),
  ('Artroscopia y Cirugía Deportiva'),
  ('Cirugía de Rodilla'),
  ('Cirugía de Cadera'),
  ('Cirugía de Hombro'),
  ('Cirugía de Pie y Tobillo'),
  ('Cirugía de Mano'),
  ('Reumatología'),
  ('Medicina del Deporte'),
  ('Neurocirugía'),
  ('Otorrinolaringología'),
  ('Cardiología'),
  ('Urología'),
  ('Cirugía General')
on conflict (name) do nothing;
