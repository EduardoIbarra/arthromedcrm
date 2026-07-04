const XLSX = require('xlsx');
const { Client } = require('pg');

const devDbUrl = "postgresql://postgres:Rapido221196.@db.ibcevxzxfzszrmejekqd.supabase.co:5432/postgres";
const prodDbUrl = "postgresql://postgres:B9124853d8.90@db.lmiymbdnqkvppaalgayr.supabase.co:5432/postgres";

// Load excel
const workbook = XLSX.readFile('/Users/macbook/Downloads/punto cero.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const excelRows = XLSX.utils.sheet_to_json(worksheet);

function normalizeInvoiceNumber(num) {
  if (!num) return '';
  return String(num).trim().toUpperCase().replace(/^F-?/i, '');
}

async function testMatch(dbName, dbUrl) {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  
  // Load all invoices
  const invoicesRes = await client.query('SELECT id, numero_factura FROM public.facturas_cliente');
  const invoiceMap = new Map(); // normalized -> array of DB invoices
  for (const inv of invoicesRes.rows) {
    const norm = normalizeInvoiceNumber(inv.numero_factura);
    if (!invoiceMap.has(norm)) {
      invoiceMap.set(norm, []);
    }
    invoiceMap.get(norm).push(inv);
  }
  
  // Load all factura_productos
  const fpRes = await client.query('SELECT * FROM public.factura_productos');
  const fpByInvoice = new Map(); // invoice_id -> array of fp
  for (const fp of fpRes.rows) {
    if (!fpByInvoice.has(fp.factura_id)) {
      fpByInvoice.set(fp.factura_id, []);
    }
    fpByInvoice.get(fp.factura_id).push(fp);
  }
  
  let totalMatched = 0;
  let totalAmbiguous = 0;
  let totalNotFound = 0;
  let totalInvoiceNotFound = 0;
  
  for (const row of excelRows) {
    const folioNorm = normalizeInvoiceNumber(row.FOLIO);
    if (!folioNorm) continue;
    
    const dbInvoices = invoiceMap.get(folioNorm);
    if (!dbInvoices || dbInvoices.length === 0) {
      totalInvoiceNotFound++;
      continue;
    }
    
    // Search product in all matching invoices
    let candidateFps = [];
    
    for (const inv of dbInvoices) {
      const fps = fpByInvoice.get(inv.id) || [];
      for (const fp of fps) {
        let isMatch = false;
        
        // Match by GUID (producto_id)
        if (fp.producto_id && row.GUID && fp.producto_id.toLowerCase() === String(row.GUID).toLowerCase()) {
          isMatch = true;
        }
        
        // Match by Alegra ID
        if (!isMatch && fp.alegra_id && row.ALEGRAID && String(fp.alegra_id) === String(row.ALEGRAID)) {
          isMatch = true;
        }
        
        // Fallback: match by product name similarity or product_id matching GUID
        if (!isMatch) {
          // If we can match product_id to GUID, or names are very similar
          const dbNameClean = String(fp.producto_nombre).toLowerCase();
          const excelNameClean = String(row.PRODUCTO).toLowerCase();
          if (dbNameClean.includes(excelNameClean) || excelNameClean.includes(dbNameClean)) {
            isMatch = true;
          }
        }
        
        if (isMatch) {
          candidateFps.push({ fp, inv });
        }
      }
    }
    
    if (candidateFps.length === 1) {
      totalMatched++;
    } else if (candidateFps.length > 1) {
      totalAmbiguous++;
      if (totalAmbiguous <= 5) {
        console.log(`Ambiguous match for Folio=${row.FOLIO}, Product=${row.PRODUCTO}:`);
        candidateFps.forEach(c => {
          console.log(`  - Inv=${c.inv.numero_factura}, Product=${c.fp.producto_nombre}, Facturada=${c.fp.cantidad_facturada}, Entregada=${c.fp.cantidad_entregada}`);
        });
      }
    } else {
      totalNotFound++;
      if (totalNotFound <= 5) {
        console.log(`No product found for Folio=${row.FOLIO}, Product=${row.PRODUCTO}, AlegraID=${row.ALEGRAID}, GUID=${row.GUID}`);
        // Let's log available products for this invoice to debug
        const fps = [];
        dbInvoices.forEach(inv => {
          (fpByInvoice.get(inv.id) || []).forEach(fp => {
            fps.push(fp.producto_nombre + ` (alegra=${fp.alegra_id}, prod_id=${fp.producto_id})`);
          });
        });
        console.log(`  Available products:`, fps);
      }
    }
  }
  
  console.log(`\nResults for ${dbName}:`);
  console.log(`  - Total Excel Rows: ${excelRows.length}`);
  console.log(`  - Invoice Not Found: ${totalInvoiceNotFound}`);
  console.log(`  - Matched: ${totalMatched}`);
  console.log(`  - Ambiguous: ${totalAmbiguous}`);
  console.log(`  - Product Not Found: ${totalNotFound}`);
  
  await client.end();
}

async function run() {
  await testMatch('Development', devDbUrl);
  await testMatch('Production', prodDbUrl);
}

run().catch(console.error);
