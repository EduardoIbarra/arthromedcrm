const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const invoices = await prisma.facturas_cliente.findMany({
    where: {
      estado: { notIn: ['anulado', 'cancelada'] }
    },
    select: {
      cliente_nombre: true,
      fecha_expedicion: true,
      total: true
    }
  });

  const clientsMap = new Map();

  for (const inv of invoices) {
    const name = inv.cliente_nombre.toUpperCase().trim();
    const date = new Date(inv.fecha_expedicion);
    const amount = Number(inv.total) || 0;

    if (!clientsMap.has(name)) {
      clientsMap.set(name, {
        name,
        sales_2025_full: 0,
        sales_2025_ytd: 0,
        sales_2026_ytd: 0
      });
    }

    const client = clientsMap.get(name);
    const year = date.getFullYear();

    // 2025 Range
    if (year === 2025) {
      client.sales_2025_full += amount;
      
      // Jan 1 to June 8
      const month = date.getMonth();
      const day = date.getDate();
      // Month is 0-indexed (0=Jan, 5=June)
      if (month < 5 || (month === 5 && day <= 8)) {
        client.sales_2025_ytd += amount;
      }
    }

    // 2026 Range
    if (year === 2026) {
      const month = date.getMonth();
      const day = date.getDate();
      if (month < 5 || (month === 5 && day <= 8)) {
        client.sales_2026_ytd += amount;
      }
    }
  }

  const result = Array.from(clientsMap.values())
    .filter(c => c.sales_2025_full > 0 || c.sales_2026_ytd > 0)
    .sort((a, b) => b.sales_2026_ytd - a.sales_2026_ytd);

  console.log("Client counts:", result.length);
  console.log(JSON.stringify(result.slice(0, 15), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect().then(() => pool.end()));
