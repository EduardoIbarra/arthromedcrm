ALTER TABLE public.congresos
ADD COLUMN video_urls text[] DEFAULT '{}'::text[];
