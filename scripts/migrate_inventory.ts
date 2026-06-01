import prisma from '../src/lib/prisma'

async function main() {
  console.log('Creating default "Almacén Principal"...')
  const defaultInventario = await prisma.tipos_inventario.upsert({
    where: { nombre: 'Almacén Principal' },
    update: {},
    create: {
      nombre: 'Almacén Principal',
      descripcion: 'Inventario principal por defecto creado automáticamente',
      activo: true,
    },
  })
  
  console.log(`Created/Found Almacén Principal with ID: ${defaultInventario.id}`)
  
  console.log('Fetching all active products with stock > 0...')
  const products = await prisma.productos.findMany({
    where: { stock_actual: { gt: 0 } },
    select: { id: true, stock_actual: true }
  })
  
  console.log(`Found ${products.length} products to migrate.`)
  
  for (const product of products) {
    if (product.stock_actual && product.stock_actual > 0) {
      await prisma.inventario_productos.upsert({
        where: {
          tipo_inventario_id_producto_id: {
            tipo_inventario_id: defaultInventario.id,
            producto_id: product.id,
          }
        },
        update: {
          stock_actual: product.stock_actual,
          stock_updated_at: new Date()
        },
        create: {
          tipo_inventario_id: defaultInventario.id,
          producto_id: product.id,
          stock_actual: product.stock_actual,
          stock_updated_at: new Date()
        }
      })
    }
  }
  
  console.log('Migration complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
