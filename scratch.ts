import prisma from './src/lib/prisma'

async function main() {
  const count = await prisma.facturas_cliente.count({
    where: { observaciones: 'Importación histórica de ventas 2025' }
  })
  console.log('Invoices to delete:', count)
}
main()
