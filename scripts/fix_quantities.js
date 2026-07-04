/**
 * fix_quantities.js
 * 
 * Fixes cantidad_facturada, cantidad_entregada, cantidad_pendiente in factura_productos
 * for both dev and production databases, using /Users/macbook/Downloads/punto cero.xlsx
 * as the source of truth.
 * 
 * Usage:
 *   node scripts/fix_quantities.js --dry-run    # preview only
 *   node scripts/fix_quantities.js --dev        # apply to dev only
 *   node scripts/fix_quantities.js --prod       # apply to prod only
 *   node scripts/fix_quantities.js --all        # apply to both
 */

const XLSX = require('xlsx');
const { Client } = require('pg');

const DEV_DB_URL  = "postgresql://postgres:Rapido221196.@db.ibcevxzxfzszrmejekqd.supabase.co:5432/postgres";
const PROD_DB_URL = "postgresql://postgres:B9124853d8.90@db.lmiymbdnqkvppaalgayr.supabase.co:5432/postgres";

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const RUN_DEV  = args.includes('--dev')  || args.includes('--all');
const RUN_PROD = args.includes('--prod') || args.includes('--all');

if (!DRY_RUN && !RUN_DEV && !RUN_PROD) {
  console.log('Usage:');
  console.log('  node scripts/fix_quantities.js --dry-run   # preview both DBs');
  console.log('  node scripts/fix_quantities.js --dev       # apply to dev only');
  console.log('  node scripts/fix_quantities.js --prod      # apply to prod only');
  console.log('  node scripts/fix_quantities.js --all       # apply to both');
  process.exit(0);
}

// ── Load Excel ────────────────────────────────────────────────
const workbook = XLSX.readFile('/Users/macbook/Downloads/punto cero.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const excelRows = XLSX.utils.sheet_to_json(worksheet);
console.log(`Loaded ${excelRows.length} rows from Excel.\n`);

function normalizeInvoiceNumber(num) {
  if (!num) return '';
  return String(num).trim().toUpperCase().replace(/^F-?/i, '');
}

// ── Core logic for one DB ─────────────────────────────────────
async function processDb(dbName, dbUrl, dryRun) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${dryRun ? '[DRY RUN] ' : ''}Processing ${dbName}...`);
  console.log('='.repeat(60));

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  // Load all invoices
  const invoicesRes = await client.query(
    'SELECT id, numero_factura FROM public.facturas_cliente'
  );
  const invoiceMap = new Map(); // normalizedFolio -> [invoice]
  for (const inv of invoicesRes.rows) {
    const norm = normalizeInvoiceNumber(inv.numero_factura);
    if (!invoiceMap.has(norm)) invoiceMap.set(norm, []);
    invoiceMap.get(norm).push(inv);
  }

  // Load all factura_productos
  const fpRes = await client.query('SELECT * FROM public.factura_productos');
  const fpByInvoice = new Map(); // invoice_id -> [fp]
  for (const fp of fpRes.rows) {
    if (!fpByInvoice.has(fp.factura_id)) fpByInvoice.set(fp.factura_id, []);
    fpByInvoice.get(fp.factura_id).push(fp);
  }

  let updatesApplied   = 0;
  let alreadyCorrect   = 0;
  let unmatched        = 0;
  let invoiceNotFound  = 0;
  const unmatchedRows  = [];

  for (const row of excelRows) {
    const folioNorm = normalizeInvoiceNumber(row.FOLIO);
    if (!folioNorm) continue;

    const dbInvoices = invoiceMap.get(folioNorm);
    if (!dbInvoices || dbInvoices.length === 0) {
      invoiceNotFound++;
      continue;
    }

    // Find matching factura_producto
    let fpMatch = null;
    for (const inv of dbInvoices) {
      const fps = fpByInvoice.get(inv.id) || [];
      for (const fp of fps) {
        let isMatch = false;

        // Priority 1: Match by AlegraID
        if (fp.alegra_id && row.ALEGRAID && String(fp.alegra_id) === String(row.ALEGRAID)) {
          isMatch = true;
        }

        // Priority 2: Match by producto_id (GUID)
        if (!isMatch && fp.producto_id && row.GUID && row.GUID !== '0' &&
            fp.producto_id.toLowerCase() === String(row.GUID).toLowerCase()) {
          isMatch = true;
        }

        // Priority 3: Name similarity
        if (!isMatch) {
          const dbName = String(fp.producto_nombre).toLowerCase().replace(/º/g, '°');
          const excelName = String(row.PRODUCTO).toLowerCase();
          if (dbName.length > 5 && excelName.length > 5 &&
              (dbName.includes(excelName) || excelName.includes(dbName))) {
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

    if (!fpMatch) {
      unmatched++;
      unmatchedRows.push({ folio: row.FOLIO, product: row.PRODUCTO, alegraId: row.ALEGRAID });
      continue;
    }

    // Compare values
    const excelCant = parseInt(row.CANTIDAD)   || 0;
    const excelEntr = parseInt(row.ENTREGADO)  || 0;
    const excelPend = parseInt(row.PENDIENTE)  || 0;

    const dbCant = fpMatch.cantidad_facturada;
    const dbEntr = fpMatch.cantidad_entregada;
    const dbPend = fpMatch.cantidad_pendiente;

    const cantDiffers = dbCant !== excelCant;
    const entrDiffers = dbEntr !== excelEntr;

    if (!cantDiffers && !entrDiffers) {
      alreadyCorrect++;
      continue;
    }

    if (updatesApplied < 5 || dryRun) {
      console.log(`${dryRun ? '[WOULD UPDATE]' : '[UPDATING]'} FP ID=${fpMatch.id}`);
      console.log(`  Factura=${row.FOLIO}, Product="${fpMatch.producto_nombre}"`);
      if (cantDiffers) console.log(`  cantidad_facturada: ${dbCant} → ${excelCant}`);
      if (entrDiffers) console.log(`  cantidad_entregada: ${dbEntr} → ${excelEntr}`);
      // cantidad_pendiente is a generated column (facturada - entregada), auto-updated by DB
    }

    if (!dryRun) {
      // Note: cantidad_pendiente is a generated column, Postgres updates it automatically
      await client.query(
        `UPDATE public.factura_productos
         SET cantidad_facturada = $1,
             cantidad_entregada = $2
         WHERE id = $3`,
        [excelCant, excelEntr, fpMatch.id]
      );
    }
    updatesApplied++;
  }

  console.log(`\nSummary for ${dbName}:`);
  console.log(`  - ${dryRun ? 'Would update' : 'Updated'}: ${updatesApplied}`);
  console.log(`  - Already correct:       ${alreadyCorrect}`);
  console.log(`  - Invoice not found:     ${invoiceNotFound}`);
  console.log(`  - Product unmatched:     ${unmatched}`);

  if (unmatchedRows.length > 0) {
    console.log(`\n  Unmatched product rows (first 20):`);
    unmatchedRows.slice(0, 20).forEach(r =>
      console.log(`    Folio=${r.folio}, AlegraID=${r.alegraId}, Product="${r.product}"`)
    );
  }

  await client.end();
}

// ── Run ───────────────────────────────────────────────────────
async function run() {
  if (DRY_RUN) {
    await processDb('Development', DEV_DB_URL, true);
    await processDb('Production',  PROD_DB_URL, true);
  } else {
    if (RUN_DEV)  await processDb('Development', DEV_DB_URL,  false);
    if (RUN_PROD) await processDb('Production',  PROD_DB_URL, false);
  }
  console.log('\nDone.');
}

run().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
