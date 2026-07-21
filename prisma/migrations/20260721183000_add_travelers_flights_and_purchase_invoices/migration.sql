-- AlterTable congreso_viajeros
ALTER TABLE "public"."congreso_viajeros" ADD COLUMN IF NOT EXISTS "travel_by_plane" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."congreso_viajeros" ADD COLUMN IF NOT EXISTS "flight_airline" TEXT;
ALTER TABLE "public"."congreso_viajeros" ADD COLUMN IF NOT EXISTS "flight_number" TEXT;
ALTER TABLE "public"."congreso_viajeros" ADD COLUMN IF NOT EXISTS "flight_departure" TIMESTAMPTZ(6);
ALTER TABLE "public"."congreso_viajeros" ADD COLUMN IF NOT EXISTS "flight_arrival" TIMESTAMPTZ(6);
ALTER TABLE "public"."congreso_viajeros" ADD COLUMN IF NOT EXISTS "flight_locator" TEXT;
ALTER TABLE "public"."congreso_viajeros" ADD COLUMN IF NOT EXISTS "ticket_file_url" TEXT;
ALTER TABLE "public"."congreso_viajeros" ADD COLUMN IF NOT EXISTS "ticket_file_name" TEXT;

-- AlterTable ordenes_compra
ALTER TABLE "public"."ordenes_compra" ADD COLUMN IF NOT EXISTS "es_pre_orden" BOOLEAN DEFAULT false;
ALTER TABLE "public"."ordenes_compra" ADD COLUMN IF NOT EXISTS "factura_compra_id" UUID;

-- CreateTable facturas_compra
CREATE TABLE IF NOT EXISTS "public"."facturas_compra" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero_factura" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(255),
    "observaciones" TEXT,
    "fecha_factura" DATE DEFAULT CURRENT_DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "facturas_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable factura_compra_items
CREATE TABLE IF NOT EXISTS "public"."factura_compra_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "factura_compra_id" UUID NOT NULL,
    "producto_id" UUID,
    "producto_nombre" VARCHAR(255),
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factura_compra_items_pkey" PRIMARY KEY ("id")
);

-- Foreign Keys
DO $$ BEGIN
  ALTER TABLE "public"."ordenes_compra"
    ADD CONSTRAINT "ordenes_compra_factura_compra_id_fkey"
    FOREIGN KEY ("factura_compra_id") REFERENCES "public"."facturas_compra"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."factura_compra_items"
    ADD CONSTRAINT "factura_compra_items_factura_compra_id_fkey"
    FOREIGN KEY ("factura_compra_id") REFERENCES "public"."facturas_compra"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."factura_compra_items"
    ADD CONSTRAINT "factura_compra_items_producto_id_fkey"
    FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
