import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.productos
    ADD COLUMN IF NOT EXISTS model text,
    ADD COLUMN IF NOT EXISTS order_code text,
    ADD COLUMN IF NOT EXISTS invoice_concept text,
    ADD COLUMN IF NOT EXISTS generic_description text,
    ADD COLUMN IF NOT EXISTS new_alg_description text,
    ADD COLUMN IF NOT EXISTS measurements text,
    ADD COLUMN IF NOT EXISTS alg_description text,
    ADD COLUMN IF NOT EXISTS base_hospital_price numeric(10,2),
    ADD COLUMN IF NOT EXISTS line text,
    ADD COLUMN IF NOT EXISTS specialty_ids text[],
    ADD COLUMN IF NOT EXISTS image_urls text[];
  `)
  console.log("Columns added successfully")
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
