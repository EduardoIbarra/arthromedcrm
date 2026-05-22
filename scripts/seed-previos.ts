import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function seed() {
  const { default: prisma } = await import('../src/lib/prisma')
  console.log('Seeding previos...')

  // Parse previos
  const previosCsvPath = '/Users/ed/Downloads/previos_rows.csv'
  const previosContent = fs.readFileSync(previosCsvPath, 'utf-8')
  const { data: previosData, errors: previosErrors } = Papa.parse(previosContent, { header: true, skipEmptyLines: true })
  
  if (previosErrors.length) {
    console.error('Errors parsing previos_rows.csv:', previosErrors)
  }

  // Parse detalle_previo
  const detalleCsvPath = '/Users/ed/Downloads/detalle_previo_rows.csv'
  const detalleContent = fs.readFileSync(detalleCsvPath, 'utf-8')
  const { data: detalleData, errors: detalleErrors } = Papa.parse(detalleContent, { header: true, skipEmptyLines: true })

  if (detalleErrors.length) {
    console.error('Errors parsing detalle_previo_rows.csv:', detalleErrors)
  }

  console.log(`Found ${previosData.length} previos and ${detalleData.length} detalle_previo.`)

  // Import previos
  try {
    const previosToInsert = previosData.map((row: any) => ({
      id: row.id,
      folio: row.folio,
      fecha: new Date(row.fecha),
      cliente_id: null,
      usuario_id: null,
      cfdi_id: null,
      metodo_pago_id: null,
      descuento_total_porcentaje: row.descuento_total_porcentaje ? parseFloat(row.descuento_total_porcentaje) : null,
      descuento_total_monto: row.descuento_total_monto ? parseFloat(row.descuento_total_monto) : null,
      total_sin_descuento: parseFloat(row.total_sin_descuento),
      total_con_descuento: parseFloat(row.total_con_descuento),
      pdf_url: row.pdf_url || null,
      cliente_nombre: row.cliente_nombre || null,
      forma_pago_id: null
    }))
    
    await prisma.previos.createMany({
      data: previosToInsert,
      skipDuplicates: true
    })
    console.log(`Successfully imported previos.`)
  } catch (e) {
    console.error('Error importing previos:', e)
  }

  // Import detalle_previo
  try {
    const validPrevioIds = new Set(previosData.map((p: any) => p.id))
    const detalleToInsert = detalleData
      .filter((row: any) => validPrevioIds.has(row.previo_id))
      .map((row: any) => ({
        id: row.id,
        previo_id: row.previo_id || null,
        producto_id: null,
        cantidad: parseFloat(row.cantidad),
        precio_unitario: parseFloat(row.precio_unitario),
        importe: parseFloat(row.importe),
        iva_porcentaje: parseFloat(row.iva_porcentaje),
        iva_monto: parseFloat(row.iva_monto),
        subtotal: parseFloat(row.subtotal),
        descuento_porcentaje: row.descuento_porcentaje ? parseFloat(row.descuento_porcentaje) : null,
        descuento_monto: row.descuento_monto ? parseFloat(row.descuento_monto) : null,
        descripcion: row.descripcion || null
      }))

    await prisma.detalle_previo.createMany({
      data: detalleToInsert,
      skipDuplicates: true
    })
    console.log(`Successfully imported detalle_previo.`)
  } catch (e) {
    console.error('Error importing detalle_previo:', e)
  }


  await prisma.$disconnect()
}

seed()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
