const { Client } = require('pg')

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:B9124853d8.90@db.zdvkatyzqgbeewtbuyfu.supabase.co:5432/postgres?sslmode=require'

function cleanUrl(urlStr) {
  try {
    const parsed = new URL(urlStr)
    parsed.searchParams.delete('sslmode')
    parsed.searchParams.delete('sslaccept')
    parsed.searchParams.delete('sslcert')
    parsed.searchParams.delete('sslkey')
    parsed.searchParams.delete('sslrootcert')
    return parsed.toString()
  } catch (e) {
    return urlStr
  }
}

function getItemTipo(item) {
  const name = (item.producto_nombre || '').toLowerCase()
  const prodTipo = (item.prod_tipo || '').toLowerCase()
  const prodCat = (item.prod_cat || '').toLowerCase()

  if (
    name.includes('renta') ||
    name.includes('alquiler') ||
    name.includes('arrendamiento') ||
    prodTipo.includes('renta') ||
    prodCat.includes('renta')
  ) {
    return 'renta'
  }

  if (
    name.includes('servicio') ||
    name.includes('mantenimiento') ||
    name.includes('reparacion') ||
    name.includes('capacitacion') ||
    name.includes('soporte') ||
    name.includes('poliza') ||
    prodTipo.includes('servicio') ||
    prodCat.includes('servicio')
  ) {
    return 'servicio'
  }

  return 'venta'
}

function determineInvoiceType(items) {
  if (!items || items.length === 0) return 'venta'
  const types = new Set(items.map(getItemTipo))
  if (types.has('renta')) return 'renta'
  if (types.has('servicio')) return 'servicio'
  return 'venta'
}

async function main() {
  console.log('=== Backfilling tipo_factura in facturas_cliente ===')
  const client = new Client({
    connectionString: cleanUrl(connectionString),
    ssl: { rejectUnauthorized: false }
  })
  await client.connect()

  // Ensure column exists
  await client.query("ALTER TABLE facturas_cliente ADD COLUMN IF NOT EXISTS tipo_factura VARCHAR(50) DEFAULT 'venta';")

  // Query all invoices with their line items
  const res = await client.query(`
    SELECT fc.id, fc.numero_factura, 
           json_agg(json_build_object('producto_nombre', fp.producto_nombre, 'prod_tipo', p.tipo, 'prod_cat', p.categoria)) FILTER (WHERE fp.id IS NOT NULL) as items
    FROM facturas_cliente fc
    LEFT JOIN factura_productos fp ON fp.factura_id = fc.id
    LEFT JOIN productos p ON fp.producto_id = p.id
    GROUP BY fc.id, fc.numero_factura;
  `)

  console.log(`Found ${res.rows.length} invoices to evaluate.`)

  let updatedCount = 0
  const counts = { venta: 0, renta: 0, servicio: 0 }

  for (const row of res.rows) {
    const computedType = determineInvoiceType(row.items || [])
    counts[computedType] = (counts[computedType] || 0) + 1

    await client.query(
      'UPDATE facturas_cliente SET tipo_factura = $1 WHERE id = $2',
      [computedType, row.id]
    )
    updatedCount++
  }

  console.log(`Successfully backfilled ${updatedCount} invoices.`)
  console.log('Distribution:', counts)

  await client.end()
}

main().catch(console.error)
