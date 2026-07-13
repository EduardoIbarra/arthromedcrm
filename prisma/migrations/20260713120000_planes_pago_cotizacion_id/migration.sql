-- Link payment plans to quotes (cotizaciones); used when plans are created
-- before invoicing and later transferred on Alegra invoice sync.
ALTER TABLE "planes_pago"
  ADD COLUMN IF NOT EXISTS "cotizacion_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'planes_pago_cotizacion_id_fkey'
  ) THEN
    ALTER TABLE "planes_pago"
      ADD CONSTRAINT "planes_pago_cotizacion_id_fkey"
      FOREIGN KEY ("cotizacion_id") REFERENCES "cotizaciones"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_planes_pago_cotizacion_id"
  ON "planes_pago"("cotizacion_id");
