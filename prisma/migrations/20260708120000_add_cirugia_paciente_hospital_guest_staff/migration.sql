-- Add patient, hospital, and city fields to cirugias
ALTER TABLE "public"."cirugias" ADD COLUMN IF NOT EXISTS "paciente" TEXT;
ALTER TABLE "public"."cirugias" ADD COLUMN IF NOT EXISTS "hospital" TEXT;
ALTER TABLE "public"."cirugias" ADD COLUMN IF NOT EXISTS "ciudad" TEXT;
ALTER TABLE "public"."cirugias" ADD COLUMN IF NOT EXISTS "hospital_id" UUID;

-- Allow external (non-system) staff members on cirugia_equipo
ALTER TABLE "public"."cirugia_equipo" ADD COLUMN IF NOT EXISTS "guest_name" TEXT;
ALTER TABLE "public"."cirugia_equipo" ALTER COLUMN "user_id" DROP NOT NULL;

-- Replace unique constraint to allow multiple external members
ALTER TABLE "public"."cirugia_equipo" DROP CONSTRAINT IF EXISTS "cirugia_equipo_cirugia_id_user_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "cirugia_equipo_cirugia_id_user_id_key"
  ON "public"."cirugia_equipo" ("cirugia_id", "user_id")
  WHERE "user_id" IS NOT NULL;