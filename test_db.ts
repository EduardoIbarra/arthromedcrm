import prisma from './src/lib/prisma';

async function run() {
  const facturas = ["F-240","F-238","F-247","F-239","F-243","F-254","F-257","F-256","F-258"];
  const expandedFacturas = Array.from(new Set(
    facturas.flatMap(f => [f, f.replace(/^F-?/i, '')])
  ));
  
  console.log("Expanded:", expandedFacturas);

  const pendingFacturas = await prisma.facturas_cliente.findMany({
    where: { 
      numero_factura: { in: expandedFacturas } 
    },
    include: {
      factura_productos: true
    }
  });

  console.log(`Found ${pendingFacturas.length} facturas`);
  pendingFacturas.forEach(f => {
    console.log(`- Factura: ${f.numero_factura}, Client: ${f.cliente_nombre}, Products: ${f.factura_productos.length}`);
    f.factura_productos.forEach(fp => {
       console.log(`  * ${fp.producto_nombre} (Pending: ${fp.cantidad_pendiente}, Entregada: ${fp.cantidad_entregada}, Facturada: ${fp.cantidad_facturada})`);
    });
  });
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
