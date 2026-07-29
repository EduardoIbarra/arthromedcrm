process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

// Determine connection URL (can be passed via process.env.DB_URL or process.env.DATABASE_URL or CLI argument)
let targetDbUrl = process.argv[2] || process.env.DB_URL || process.env.DATABASE_URL;

if (!targetDbUrl) {
  console.error('Error: Please specify DATABASE_URL in environment or pass DB connection string as argument.');
  process.exit(1);
}

try {
  const u = new URL(targetDbUrl);
  u.searchParams.delete('sslmode');
  targetDbUrl = u.toString();
} catch (e) {}

const pool = new Pool({
  connectionString: targetDbUrl,
  ssl: { rejectUnauthorized: false }
});

const excelData = [
  { code: 'MC311', name: 'UBE Needle', depth: 42.5, width: 14.0, height: 3.00 },
  { code: 'BC405', name: 'UXD 70', depth: 42.5, width: 14.0, height: 3.00 },
  { code: 'BC404A', name: 'Hip-Blator 50', depth: 60.5, width: 16.2, height: 3.7 },
  { code: 'AC301', name: 'Cerva FX', depth: 37.0, width: 10.0, height: 3.00 },
  { code: 'MC302', name: 'Spine-o-QFX', depth: 60.5, width: 16.5, height: 3.8 },
  { code: 'AC302A', name: 'Cannon', depth: 60.5, width: 16.5, height: 3.8 },
  { code: 'AC405B', name: 'UXD90L', depth: 60.5, width: 16.5, height: 3.8 },
  { code: 'AC3010', name: 'Cannon3', depth: 60.5, width: 16.5, height: 3.8, fallbackSearch: 'Cannon3' },
  { code: 'MC404C', name: 'Max-Blator50FS', depth: 44.5, width: 16.5, height: 3.3 },
  { code: 'DGB30WA110', name: 'Burs', depth: 27.0, width: 7.0, height: 2.5 },
  { code: 'DGB20UA115', name: 'Burs', depth: 27.0, width: 7.0, height: 2.5 },
  { code: 'DGB20WA115', name: 'Burs', depth: 27.0, width: 7.0, height: 2.5 },
  { code: 'DG-A40X411(R)', name: 'Burs', depth: 27.0, width: 7.0, height: 2.5, fallbackSearch: 'DG-A40UX411(R)' },
  { code: 'DG-A40WZ411(R)', name: 'Burs', depth: 27.0, width: 7.0, height: 2.5 },
  { code: 'BDJ37045B2', name: 'Shaver Blades', depth: 50.0, width: 7.0, height: 2.5 },
  { code: 'BDJ13045C', name: 'Shaver Blades', depth: 27.0, width: 7.0, height: 2.5 },
  { code: 'BDJ13045B', name: 'Shaver Blades', depth: 27.0, width: 7.0, height: 2.5 },
  { code: 'BDJ13045A', name: 'Shaver Blades', depth: 27.0, width: 7.0, height: 2.5 },
  { code: 'BDJ13040A', name: 'Shaver Blades', depth: 27.0, width: 7.0, height: 2.5 },
  { code: 'BDJ13040B', name: 'Shaver Blades', depth: 27.0, width: 7.0, height: 2.5 },
  { code: 'AC404', name: 'Max -Blator50', depth: 42.5, width: 14.0, height: 3.00 },
  { code: 'AC405A', name: 'Neo Blator90', depth: 43.0, width: 14.0, height: 3.00, fallbackSearch: 'Neo Blator' },
  { code: 'MC405C', name: 'EZ-Blator90FS', depth: 44.5, width: 16.5, height: 3.3 },
  { code: 'BC406', name: 'Thy -BlatorPro', depth: 43.0, width: 14.0, height: 3.00 },
  { code: 'BC303', name: 'TB-Forceps', depth: 43.0, width: 14.0, height: 3.00 },
  { code: 'BC402', name: 'Master Pillar', depth: 42.5, width: 14.0, height: 3.00 },
  { code: 'MC304B', name: 'TMJ-SZ', depth: 42.5, width: 14.0, height: 3.00 },
  { code: 'MC402C', name: 'Tonsil-BlatorMax', depth: 42.5, width: 14.0, height: 3.00 },
  { code: 'DGB30UA10510', name: 'Burs', depth: 27.0, width: 7.0, height: 2.5 },
  { code: 'DGB20UA10510', name: 'Burs', depth: 27.0, width: 7.0, height: 2.5 },
  { code: 'DGB10UA10510', name: 'Burs', depth: 27.0, width: 7.0, height: 2.5 },
  { code: 'BDA1104060A', name: 'Shaver Blades', depth: 27.0, width: 7.0, height: 2.5 },
  { code: 'BDA1104040A1', name: 'Shaver Blades', depth: 27.0, width: 7.0, height: 2.5 },
  { code: 'BDA1104040A', name: 'Shaver Blades', depth: 27.0, width: 7.0, height: 2.5 },
  { code: 'BDA1104012A', name: 'Shaver Blades', depth: 27.0, width: 7.0, height: 2.5 },
  { code: 'BDA11040A', name: 'Shaver Blades', depth: 27.0, width: 7.0, height: 2.5 },
  { code: 'AC304', name: 'Oto-Knife45', depth: 43.0, width: 14.0, height: 3.00 },
  { code: 'BC304C', name: 'Oto-Knife45', depth: 43.0, width: 14.0, height: 3.00 },
  { code: 'BC304A', name: 'Oto-Hook', depth: 43.0, width: 14.0, height: 3.00 }
];

async function updateProductMeasurements() {
  console.log('--- Updating Product Measurements ---');
  
  const allProds = (await pool.query('SELECT id, nombre, model, order_code FROM productos')).rows;
  let totalUpdatedProducts = 0;
  let updatedProductIds = new Set();

  for (const item of excelData) {
    const searchCode = (item.fallbackSearch || item.code).replace(/\(R\)/i, '').trim();
    
    // Find matching products
    const matches = allProds.filter(p => {
      if (p.model && p.model.toLowerCase().trim() === searchCode.toLowerCase()) return true;
      if (p.order_code && p.order_code.toLowerCase().trim() === searchCode.toLowerCase()) return true;
      if (p.nombre && p.nombre.toLowerCase().includes(searchCode.toLowerCase())) return true;
      return false;
    });

    const measurementsText = `LARGO: ${item.depth} ANCHO: ${item.width} ALTO: ${item.height} CM`;

    for (const m of matches) {
      if (updatedProductIds.has(m.id)) continue;

      await pool.query(
        `UPDATE productos 
         SET depth = $1, width = $2, height = $3, measurement_unit = 'cm', measurements = $4
         WHERE id = $5`,
        [item.depth, item.width, item.height, measurementsText, m.id]
      );

      updatedProductIds.add(m.id);
      totalUpdatedProducts++;
      console.log(`Updated [${m.id}] "${m.nombre}" -> Depth(Largo)=${item.depth}, Width(Ancho)=${item.width}, Height(Alto)=${item.height}`);
    }
  }

  console.log(`\nSuccess! Updated ${totalUpdatedProducts} products in the database.`);
  await pool.end();
}

updateProductMeasurements().catch(err => {
  console.error('Error updating products:', err);
  process.exit(1);
});
