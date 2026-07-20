-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."price_list_publications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hospital_id" UUID,
    "hospital_name" TEXT NOT NULL,
    "document_date" DATE NOT NULL,
    "vigencia" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" TEXT,
    "include_iva" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "min_purchase" DECIMAL(12,2) NOT NULL DEFAULT 72500,
    "delivery_time" TEXT NOT NULL DEFAULT '15 días hábiles',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_list_publications_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "public"."price_list_publications"
    ADD CONSTRAINT "price_list_publications_hospital_id_fkey"
    FOREIGN KEY ("hospital_id") REFERENCES "public"."hospitals"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "price_list_publications_hospital_id_idx"
  ON "public"."price_list_publications"("hospital_id");
CREATE INDEX IF NOT EXISTS "price_list_publications_status_idx"
  ON "public"."price_list_publications"("status");
