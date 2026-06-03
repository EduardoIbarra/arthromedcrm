import prisma from './src/lib/prisma'

async function main() {
  try {
    console.log("Creating ticket_updates table...")
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.tickets (
        id              uuid primary key default gen_random_uuid(),
        created_at      timestamptz not null default now(),
        updated_at      timestamptz not null default now(),
        title           text not null,
        description     text,
        reporter_id     uuid not null references auth.users(id) on delete cascade,
        assignee        text default 'Unassigned',
        status          text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed'))
      );

      CREATE TABLE IF NOT EXISTS public.ticket_updates (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        content text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `)
    console.log("Table created successfully.")
  } catch (err: any) {
    console.error("Error creating table:", err.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
