-- ============================================================
-- Arthromed ERP — Congresos Files Migration
-- ============================================================

create table if not exists public.congreso_files (
  id              uuid primary key default gen_random_uuid(),
  congreso_id     uuid not null references public.congresos(id) on delete cascade,
  name            text not null,
  url             text not null,
  file_type       text,
  size_bytes      bigint,
  created_at      timestamptz not null default now()
);

-- Enable RLS
alter table public.congreso_files enable row level security;
create policy "Allow all congreso files" on public.congreso_files for all using (true) with check (true);

-- Indexes
create index if not exists congreso_files_congreso_id_idx on public.congreso_files(congreso_id);
