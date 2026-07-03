import { NextRequest, NextResponse } from 'next/server'
import { querySegundaDB } from '@/lib/segundaDB'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const scratchDir = '/tmp'
  let configPath = ''
  let outputPath = ''
  
  try {
    const { id } = await params

    // 1. Fetch order details
    const orderRows = await querySegundaDB(`
      SELECT id, numero_orden, created_at, fecha_orden
      FROM ordenes_compra
      WHERE id = $1
    `, [id])

    if (orderRows.length === 0) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 })
    }

    const order = orderRows[0]
    const orderDate = order.fecha_orden || order.created_at || new Date().toISOString()

    // 2. Fetch order products, resolved with model and order_code from second DB productos
    const items = await querySegundaDB(`
      SELECT op.cantidad_ordenada as quantity, p.model, p.order_code as code
      FROM orden_productos op
      LEFT JOIN productos p ON p.id = op.producto_id
      WHERE op.orden_id = $1
    `, [id])

    // Ensure output directories exist
    await fs.mkdir(scratchDir, { recursive: true })

    // 3. Write temp config json
    const configData = {
      date: orderDate,
      numero_orden: order.numero_orden,
      items: items.map(item => ({
        model: item.model || '',
        code: item.code || '',
        quantity: item.quantity || 0
      })),
      output_path: path.join(scratchDir, `PO_${order.numero_orden}.xlsx`)
    }

    configPath = path.join(scratchDir, `po_${id}_config.json`)
    outputPath = configData.output_path

    await fs.writeFile(configPath, JSON.stringify(configData, null, 2), 'utf8')

    // 4. Run python script
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate_po_excel.py')
    await execAsync(`python3 ${scriptPath} ${configPath}`)

    // 5. Read generated Excel file
    const fileBuffer = await fs.readFile(outputPath)

    // Clean up files
    await fs.unlink(configPath).catch(() => {})
    await fs.unlink(outputPath).catch(() => {})

    // 6. Return response
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="PO_${order.numero_orden}.xlsx"`,
        'Cache-Control': 'no-store, max-age=0'
      }
    })

  } catch (error: any) {
    console.error('Error generating Excel download:', error)
    if (configPath) await fs.unlink(configPath).catch(() => {})
    if (outputPath) await fs.unlink(outputPath).catch(() => {})
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
