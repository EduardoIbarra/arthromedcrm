ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS letter_created_at DATE;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS letter_expires_at DATE;
