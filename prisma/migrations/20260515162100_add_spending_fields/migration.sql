-- AlterTable
ALTER TABLE "gastos" ADD COLUMN     "card" TEXT,
ADD COLUMN     "expense_date" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "folio_fiscal" TEXT,
ADD COLUMN     "invoice_url" TEXT,
ADD COLUMN     "is_billable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_billed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "gasto_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gasto_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gasto_attachments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "gasto_attachments" ADD CONSTRAINT "gasto_attachments_gasto_id_fkey" FOREIGN KEY ("gasto_id") REFERENCES "gastos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AlterTable (identities default email)
ALTER TABLE "auth"."identities" ALTER COLUMN "email" SET DEFAULT lower((identity_data ->> 'email'::text));

-- AlterTable (users confirmed_at)
ALTER TABLE "auth"."users" ALTER COLUMN "confirmed_at" SET DEFAULT LEAST(email_confirmed_at, phone_confirmed_at);
