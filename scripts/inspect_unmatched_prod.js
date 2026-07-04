const XLSX = require('xlsx');
const { Client } = require('pg');

const prodDbUrl = "postgresql://postgres:B9124853d8.90@db.lmiymbdnqkvppaalgayr.supabase.co:5432/postgres";

// Load excel
const workbook = XLSX.readFile('/Users/macbook/Downloads/punto cero.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const excelRows = XLSX.utils.sheet_to_json(worksheet);

function normalizeInvoiceNumber(num) {
  if (!num) return '';
  return String(num).trim().toUpperCase().replace(/^F-?/i, '');
}

async function run() {
  const client = new Client({ connectionString: prodDbUrl });
  await client.connect();
  
  // Load all invoices
  const invoicesRes = await client.query('SELECT id, numero_factura FROM public.facturas_cliente');
  const invoiceMap = new Map();
  for (const inv of invoicesRes.rows) {
    const norm = normalizeInvoiceNumber(inv.numero_factura);
    if (!invoiceMap.has(norm)) {
      invoiceMap.set(norm, []);
    }
    invoiceMap.get(norm).push(inv);
  }
  
  // Load all factura_productos
  const fpRes = await client.query('SELECT * FROM public.factura_productos');
  const fpByInvoice = new Map();
  for (const fp of fpRes.rows) {
    if (!fpByInvoice.has(fp.factura_id)) {
      fpByInvoice.set(fp.factura_id, []);
    }
    fpByInvoice.get(fp.factura_id).push(fp);
  }
  
  let notFound = [];
  
  for (const row of excelRows) {
    const folioNorm = normalizeInvoiceNumber(row.FOLIO);
    if (!folioNorm) continue;
    
    const dbInvoices = invoiceMap.get(folioNorm) || [];
    let found = false;
    
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
          found = true;
          break;
        }
      }
      if (found) break;
    }
    
    if (!found) {
      notFound.push(row);
    }
  }
  
  console.log(`Unmatched rows in Production (${notFound.length}):`);
  notFound.forEach(row => {
    console.log(`Folio: ${row.FOLIO}, Excel Product: "${row.PRODUCTO}", AlegraID: ${row.ALEGRAID}, GUID: ${row.GUID}`);
    // Print available DB products for this folio
    const dbInvoices = invoiceMap.get(normalizeInvoiceNumber(row.FOLIO)) || [];
    dbInvoices.forEach(inv => {
      console.log(`  DB Invoice: ${inv.numero_factura}`);
      const fps = fpByInvoice.get(inv.id) || [];
      fps.forEach(fp => {
        console.log(`    - DB Product: "${fp.producto_nombre}", AlegraID: ${fp.alegra_id}, prod_id: ${fp.producto_id}`);
      });
    });
  });
  
  await client.end();
}

run().catch(console.error);
