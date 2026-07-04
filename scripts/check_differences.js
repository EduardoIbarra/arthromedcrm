const XLSX = require('xlsx');
const { Client } = require('pg');

const devDbUrl = "postgresql://postgres:Rapido221196.@db.ibcevxzxfzszrmejekqd.supabase.co:5432/postgres";
const prodDbUrl = "postgresql://postgres:B9124853d8.90@db.lmiymbdnqkvppaalgayr.supabase.co:5432/postgres";

// Load excel
const workbook = XLSX.readFile('/Users/macbook/Downloads/punto cero.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const excelRows = XLSX.utils.sheet_to_json(worksheet);

async function checkDiffs(name, dbUrl) {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  
  console.log(`\n=== Checking differences for ${name} ===`);
  
  // Load all DB rows
  const dbRes = await client.query('SELECT * FROM public.factura_productos');
  const dbMap = new Map();
  for (const row of dbRes.rows) {
    dbMap.set(row.id, row);
  }
  
  let matchCount = 0;
  let mismatchCount = 0;
  let notFoundCount = 0;
  
  for (const row of excelRows) {
    const guid = row.GUID;
    if (!guid) continue;
    
    const dbRow = dbMap.get(guid);
    if (!dbRow) {
      notFoundCount++;
      continue;
    }
    
    const excelCant = parseInt(row.CANTIDAD) || 0;
    const excelEntr = parseInt(row.ENTREGADO) || 0;
    const excelPend = parseInt(row.PENDIENTE) || 0;
    
    const dbCant = dbRow.cantidad_facturada;
    const dbEntr = dbRow.cantidad_entregada;
    const dbPend = dbRow.cantidad_pendiente;
    
    if (dbCant !== excelCant || dbEntr !== excelEntr || dbPend !== excelPend) {
      mismatchCount++;
      if (mismatchCount <= 10) {
        console.log(`Mismatch on FP ID ${guid}:`);
        console.log(`  Excel: Cantidad/Facturada=${excelCant}, Entregado=${excelEntr}, Pendiente=${excelPend}`);
        console.log(`  DB:    Cantidad/Facturada=${dbCant}, Entregado=${dbEntr}, Pendiente=${dbPend}`);
      }
    } else {
      matchCount++;
    }
  }
  
  console.log(`Summary for ${name}:`);
  console.log(`  - Match: ${matchCount}`);
  console.log(`  - Mismatch: ${mismatchCount}`);
  console.log(`  - Not Found: ${notFoundCount}`);
  
  await client.end();
}

async function run() {
  await checkDiffs('Development', devDbUrl);
  await checkDiffs('Production', prodDbUrl);
}

run().catch(console.error);
