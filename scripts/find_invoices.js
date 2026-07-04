const XLSX = require('xlsx');
const { Client } = require('pg');

const prodDbUrl = "postgresql://postgres:B9124853d8.90@db.lmiymbdnqkvppaalgayr.supabase.co:5432/postgres";

// Load excel
const workbook = XLSX.readFile('/Users/macbook/Downloads/punto cero.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const excelRows = XLSX.utils.sheet_to_json(worksheet);

async function run() {
  const client = new Client({ connectionString: prodDbUrl });
  await client.connect();
  
  console.log("=== Matching Excel Folios against DB ===");
  
  // Let's sample first 10 rows
  for (let i = 0; i < Math.min(10, excelRows.length); i++) {
    const row = excelRows[i];
    const folio = row.FOLIO;
    const prodName = row.PRODUCTO;
    const guid = row.GUID;
    
    console.log(`Excel Row: Folio=${folio}, Product=${prodName}, Guid=${guid}`);
    
    // Look for facturas containing folio
    const query = `
      SELECT id, numero_factura, cliente_nombre 
      FROM public.facturas_cliente 
      WHERE numero_factura = $1 OR numero_factura = $2 OR numero_factura LIKE $3
    `;
    const format1 = String(folio);
    const format2 = `F-${folio}`;
    const format3 = `%-${folio}`;
    const res = await client.query(query, [format1, format2, format3]);
    
    console.log(`  Found ${res.rows.length} matching invoices in DB:`);
    for (const dbRow of res.rows) {
      console.log(`    - Invoice ID=${dbRow.id}, Number=${dbRow.numero_factura}, Client=${dbRow.cliente_nombre}`);
      
      // Let's see if this invoice has the product
      const fpRes = await client.query(`
        SELECT id, producto_nombre, cantidad_facturada, cantidad_entregada, cantidad_pendiente
        FROM public.factura_productos
        WHERE factura_id = $1 AND producto_id = $2
      `, [dbRow.id, guid]);
      
      if (fpRes.rows.length > 0) {
        console.log(`      * MATCHING PRODUCT FOUND in factura_productos!`);
        console.log(`        FP Row: ID=${fpRes.rows[0].id}, Name=${fpRes.rows[0].producto_nombre}, Facturada=${fpRes.rows[0].cantidad_facturada}, Entregada=${fpRes.rows[0].cantidad_entregada}`);
      } else {
        // Try matching by name or alegra_id
        const fpRes2 = await client.query(`
          SELECT id, producto_nombre, cantidad_facturada, cantidad_entregada
          FROM public.factura_productos
          WHERE factura_id = $1 AND (producto_nombre ILIKE $2 OR alegra_id = $3)
        `, [dbRow.id, `%${prodName.split(' ')[0]}%`, String(row.ALEGRAID)]);
        if (fpRes2.rows.length > 0) {
          console.log(`      * Partial match by name/alegra_id:`);
          for (const p of fpRes2.rows) {
            console.log(`        - FP Row: ID=${p.id}, Name=${p.producto_nombre}, Facturada=${p.cantidad_facturada}, Entregada=${p.cantidad_entregada}`);
          }
        }
      }
    }
  }
  
  await client.end();
}

run().catch(console.error);
