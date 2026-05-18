-- AlterTable
ALTER TABLE "public"."congresos" ADD COLUMN "terms_doctor" TEXT;
ALTER TABLE "public"."congresos" ADD COLUMN "terms_distributor" TEXT;
ALTER TABLE "public"."congresos" ADD COLUMN "enable_workshops" BOOLEAN NOT NULL DEFAULT true;
