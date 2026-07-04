const { Client } = require('pg');
const prodDbUrl = "postgresql://postgres:B9124853d8.90@db.lmiymbdnqkvppaalgayr.supabase.co:5432/postgres";

async function run() {
  const client = new Client({ connectionString: prodDbUrl });
  await client.connect();
  
  const res = await client.query(`
    SELECT fp.id, fp.producto_nombre, fp.producto_id, fp.cantidad_facturada, fp.cantidad_entregada, fp.alegra_id
    FROM public.factura_productos fp
    JOIN public.facturas_cliente fc ON fp.factura_id = fc.id
    WHERE fc.numero_factura = '46' OR fc.numero_factura = 'F-46'
  `);
  
  console.log("In DB for Folio 46:");
  console.log(res.rows);
  
  await client.end();
}

run().catch(console.error);
