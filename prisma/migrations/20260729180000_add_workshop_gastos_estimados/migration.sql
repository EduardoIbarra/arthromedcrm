-- Create workshop_gastos_estimados table
CREATE TABLE IF NOT EXISTS "public"."workshop_gastos_estimados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workshop_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workshop_gastos_estimados_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workshop_gastos_estimados_workshop_id_idx" ON "public"."workshop_gastos_estimados"("workshop_id");

ALTER TABLE "public"."workshop_gastos_estimados" ADD CONSTRAINT "workshop_gastos_estimados_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "public"."congress_workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."workshop_gastos_estimados" ADD CONSTRAINT "workshop_gastos_estimados_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."catalog_spending_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
