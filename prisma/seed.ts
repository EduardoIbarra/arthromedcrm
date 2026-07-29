import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Ensure G02 CFDI entry exists (used for credit notes)
  await prisma.cfdi.upsert({
    where: { id: 'G02' },
    update: {},
    create: {
      id: 'G02',
      descripcion: 'Devoluciones, descuentos o bonificaciones',
    },
  });

  console.log('✅ G02 CFDI entry ensured');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
