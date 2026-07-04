ALTER TABLE "public"."importaciones_recepcion"
  ADD COLUMN IF NOT EXISTS "comentarios" TEXT,
  ADD COLUMN IF NOT EXISTS "comentarios_facturas" JSONB,
  ADD COLUMN IF NOT EXISTS "asignaciones_manuales" JSONB;

ALTER TABLE "public"."importacion_asignaciones"
  ADD COLUMN IF NOT EXISTS "comentario" TEXT;