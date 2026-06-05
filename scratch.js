const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const lines = await prisma.productos.findMany({
    select: { line: true },
    distinct: ['line']
  })
  console.log("Lines in DB:", lines.map(l => l.line).filter(Boolean))
}
main()
