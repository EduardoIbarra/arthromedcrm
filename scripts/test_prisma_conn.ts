import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function main() {
  const prisma = (await import('../src/lib/prisma')).default;
  const count = await prisma.congresos.count();
  console.log('Congress count:', count);
}

main().catch(console.error);
