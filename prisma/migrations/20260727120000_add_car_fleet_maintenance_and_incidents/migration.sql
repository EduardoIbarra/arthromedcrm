-- Car fleet maintenance logs
CREATE TABLE IF NOT EXISTS "public"."car_fleet_maintenance" (
    "deleted_at" TIMESTAMPTZ(6),
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "car_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'preventive',
    "description" TEXT,
    "cost" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "date" DATE NOT NULL,
    "next_due_date" DATE,
    "performed_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "car_fleet_maintenance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "car_fleet_maintenance_car_id_idx"
  ON "public"."car_fleet_maintenance"("car_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'car_fleet_maintenance_car_id_fkey'
  ) THEN
    ALTER TABLE "public"."car_fleet_maintenance"
      ADD CONSTRAINT "car_fleet_maintenance_car_id_fkey"
      FOREIGN KEY ("car_id") REFERENCES "public"."car_fleet"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Car fleet incident reports
CREATE TABLE IF NOT EXISTS "public"."car_fleet_incidents" (
    "deleted_at" TIMESTAMPTZ(6),
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "car_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'minor',
    "description" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "cost" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'open',
    "reported_by_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "car_fleet_incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "car_fleet_incidents_car_id_idx"
  ON "public"."car_fleet_incidents"("car_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'car_fleet_incidents_car_id_fkey'
  ) THEN
    ALTER TABLE "public"."car_fleet_incidents"
      ADD CONSTRAINT "car_fleet_incidents_car_id_fkey"
      FOREIGN KEY ("car_id") REFERENCES "public"."car_fleet"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'car_fleet_incidents_reported_by_id_fkey'
  ) THEN
    ALTER TABLE "public"."car_fleet_incidents"
      ADD CONSTRAINT "car_fleet_incidents_reported_by_id_fkey"
      FOREIGN KEY ("reported_by_id") REFERENCES "public"."user_profiles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
