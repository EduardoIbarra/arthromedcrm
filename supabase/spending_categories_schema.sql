-- ============================================================
-- Arthromed ERP — Spending Categories Migration
-- ============================================================

create table if not exists public.catalog_spending_categories (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  created_at      timestamptz not null default now()
);

-- Initial categories
insert into public.catalog_spending_categories (name) values
  ('Vuelos'),
  ('Hospedajes'),
  ('Stand'),
  ('Consumibles'),
  ('Comida'),
  ('Casetas'),
  ('Gasolina'),
  ('Insumos'),
  ('Cerdos'),
  ('Contratación de personal temporal'),
  ('Otros')
on conflict (name) do nothing;

-- Add category_id to gastos table
alter table public.gastos add column if not exists category_id uuid references public.catalog_spending_categories(id);

-- Enable RLS
alter table public.catalog_spending_categories enable row level security;
create policy "Allow all spending categories" on public.catalog_spending_categories for all using (true) with check (true);
