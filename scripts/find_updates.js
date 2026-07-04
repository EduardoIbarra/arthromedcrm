const XLSX = require('xlsx');
const { Client } = require('pg');

const devDbUrl = "postgresql://postgres:Rapido221196.@db.ibcevxzxfzszrmejekqd.supabase.co:5432/postgres";
const prodDbUrl = "postgresql://postgres:B9124853d8.90@db.lmiymbdnqkvppaalgayr.supabase.co:5432/postgres";

const workbook = XLSX.readFile('/Users/macbook/Downloads/punto cero.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const excelRows = XLSX.utils.sheet_to_json(worksheet);

function normalizeInvoiceNumber(num) {
  if (!num) return '';
  return String(num).trim().toUpperCase().replace(/^F-?/i, '');
}

async function findMismatches(dbName, dbUrl) {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  
  // Load invoices and fp
  const invoicesRes = await client.query('SELECT id, numero_factura FROM public.facturas_cliente');
  const invoiceMap = new Map();
  for (const inv of invoicesRes.rows) {
    const norm = normalizeInvoiceNumber(inv.numero_factura);
    if (!invoiceMap.has(norm)) invoiceMap.set(norm, []);
    invoiceMap.get(norm).push(inv);
  }
  
  const fpRes = await client.query('SELECT * FROM public.factura_productos');
  const fpByInvoice = new Map();
  for (const fp of fpRes.rows) {
    if (!fpByInvoice.has(fp.factura_id)) fpByInvoice.set(fp.factura_id, []);
    fpByInvoice.get(fp.factura_id).push(fp);
  }
  
  let updatesCount = 0;
  let noChangeCount = 0;
  
  for (const row of excelRows) {
    const folioNorm = normalizeInvoiceNumber(row.FOLIO);
    if (!folioNorm) continue;
    
    const dbInvoices = invoiceMap.get(folioNorm) || [];
    let fpMatch = null;
    
    for (const inv of dbInvoices) {
      const fps = fpByInvoice.get(inv.id) || [];
      for (const fp of fps) {
        let isMatch = false;
        
        if (fp.producto_id && row.GUID && fp.producto_id.toLowerCase() === String(row.GUID).toLowerCase()) {
          isMatch = true;
        }
        
        if (!isMatch && fp.alegra_id && row.ALEGRAID && String(fp.alegra_id) === String(row.ALEGRAID)) {
          isMatch = true;
        }
        
        if (!isMatch) {
          const dbNameClean = String(fp.producto_nombre).toLowerCase().replace(/º/g, '°');
          const excelNameClean = String(row.PRODUCTO).toLowerCase();
          if (dbNameClean.includes(excelNameClean) || excelNameClean.includes(dbNameClean)) {
            isMatch = true;
          }
        }
        
        if (isMatch) {
          fpMatch = fp;
          break;
        }
      }
      if (fpMatch) break;
    }
    
    if (fpMatch) {
      const excelCant = parseInt(row.CANTIDAD) || 0;
      const excelEntr = parseInt(row.ENTREGADO) || 0;
      const excelPend = parseInt(row.PENDIENTE) || 0;
      
      const dbCant = fpMatch.cantidad_facturada;
      const dbEntr = fpMatch.cantidad_entregada;
      const dbPend = fpMatch.cantidad_pendiente;
      
      if (dbCant !== excelCant || dbEntr !== excelEntr || dbPend !== excelPend) {
        updatesCount++;
        if (updatesCount <= 5) {
          console.log(`Update needed for ${dbName} - Folio ${row.FOLIO}, Product "${fpMatch.producto_nombre}":`);
          console.log(`  Current DB: Facturada=${dbCant}, Entregada=${dbEntr}, Pendiente=${dbPend}`);
          console.log(`  Excel:      Facturada=${excelCant}, Entregada=${excelEntr}, Pendiente=${excelPend}`);
        }
      } else {
        noChangeCount++;
      }
    }
  }
  
  console.log(`\n${dbName} summary:`);
  console.log(`  - Matched and needs update: ${updatesCount}`);
  console.log(`  - Matched and already correct: ${noChangeCount}`);
  
  await client.end();
}

async function run() {
  await findMismatches('Development', devDbUrl);
  await findMismatches('Production', prodDbUrl);
}

run().catch(console.error);
