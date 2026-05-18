-- AlterTable
ALTER TABLE "public"."congresos" ADD COLUMN "terms_doctor" TEXT;
ALTER TABLE "public"."congresos" ADD COLUMN "terms_distributor" TEXT;
ALTER TABLE "public"."congresos" ADD COLUMN "enable_workshops" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."orders" ADD COLUMN "congress_id" UUID;

-- CreateTable
CREATE TABLE "public"."congress_workshops" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "congress_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "date_time" TIMESTAMPTZ(6) NOT NULL,
    "max_people" INTEGER NOT NULL,
    "cost" DECIMAL(10,2),
    "professor" TEXT NOT NULL,

    CONSTRAINT "congress_workshops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."congress_workshop_enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workshop_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "congress_workshop_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."congress_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "congress_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT,
    "email" TEXT,

    CONSTRAINT "congress_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "congress_workshop_enrollments_workshop_id_client_id_key" ON "public"."congress_workshop_enrollments"("workshop_id", "client_id");

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_congress_id_fkey" FOREIGN KEY ("congress_id") REFERENCES "public"."congresos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."congress_workshops" ADD CONSTRAINT "congress_workshops_congress_id_fkey" FOREIGN KEY ("congress_id") REFERENCES "public"."congresos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."congress_workshop_enrollments" ADD CONSTRAINT "congress_workshop_enrollments_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "public"."congress_workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."congress_workshop_enrollments" ADD CONSTRAINT "congress_workshop_enrollments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."congress_contacts" ADD CONSTRAINT "congress_contacts_congress_id_fkey" FOREIGN KEY ("congress_id") REFERENCES "public"."congresos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
