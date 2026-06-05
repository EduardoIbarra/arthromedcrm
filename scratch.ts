import prisma from './src/lib/prisma'

async function main() {
  const p = await prisma.productos.findMany({
    where: { NOT: { image_urls: { equals: [] } } },
    take: 1
  })
  console.log("With image_urls:", p)

  const p2 = await prisma.productos.findMany({
    where: { base_hospital_price: { not: null } },
    take: 1
  })
  console.log("With base_hospital_price:", p2)
}
main()
