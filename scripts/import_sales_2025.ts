import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Configure dotenv
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import * as XLSX from 'xlsx';

let prisma: any;

// Helper to convert Excel numeric serial date to JS Date
function excelToDate(serial: number): Date {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);

  const fractional_day = serial - Math.floor(serial) + 0.0000001;
  let total_seconds = Math.floor(86400 * fractional_day);
  const hours = Math.floor(total_seconds / 3600);
  total_seconds %= 3600;
  const minutes = Math.floor(total_seconds / 60);
  const seconds = total_seconds % 60;

  return new Date(
    date_info.getFullYear(),
    date_info.getMonth(),
    date_info.getDate(),
    hours,
    minutes,
    seconds
  );
}

interface ExcelRow {
  [key: string]: any;
}

async function main() {
  prisma = (await import('../src/lib/prisma')).default;
  const args = process.argv.slice(2);
  const isCommit = args.includes('--commit');
  const excelPath = '/Users/ed/Downloads/ventas2025 (2).xlsx';

  console.log('--- 2025 SALES EXCEL INGESTION SCRIPT ---');
  console.log(`Mode: ${isCommit ? 'COMMIT (Writes to Database)' : 'DRY-RUN (No writes)'}`);
  console.log(`Database URL: ${process.env.DATABASE_URL ? 'Configured' : 'Missing!'}`);
  console.log(`Direct URL: ${process.env.DIRECT_URL ? 'Configured' : 'Missing!'}`);

  if (!fs.existsSync(excelPath)) {
    console.error(`Error: Excel file not found at ${excelPath}`);
    process.exit(1);
  }

  console.log(`Reading Excel file: ${excelPath}...`);
  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const rawRows = XLSX.utils.sheet_to_json<any>(workbook.Sheets[sheetName]);
  console.log(`Read ${rawRows.length} rows from sheet "${sheetName}".`);

  const rows = rawRows.filter(r => {
    const app = String(r.APLICACION || '').toLowerCase().trim();
    return app.includes('acumulabl');
  });
  console.log(`Filtered to ${rows.length} rows with APLICACION containing 'acumulabl'.`);

  // Load database lookup maps
  console.log('Loading lookups from Database...');
  const dbClientes = await prisma.clientes.findMany();
  const dbClients = await prisma.clients.findMany();
  const dbProducts = await prisma.productos.findMany();
  const dbExistingInvoices = await prisma.facturas_cliente.findMany({
    where: {
      observaciones: {
        not: 'Importación histórica de ventas 2025'
      }
    },
    select: { numero_factura: true, id: true }
  });

  console.log(`Loaded from DB:`);
  console.log(`- Clientes (Spanish table): ${dbClientes.length}`);
  console.log(`- Clients (CRM table): ${dbClients.length}`);
  console.log(`- Productos: ${dbProducts.length}`);
  console.log(`- Existing Invoices: ${dbExistingInvoices.length}`);

  // Maps for client lookups (RFC -> Item, Name -> Item)
  const clientesByRfc = new Map<string, typeof dbClientes[0]>();
  const clientesByName = new Map<string, typeof dbClientes[0]>();
  for (const c of dbClientes) {
    if (c.rfc) clientesByRfc.set(c.rfc.toLowerCase().trim(), c);
    if (c.nombre) clientesByName.set(c.nombre.toLowerCase().trim(), c);
  }

  const crmClientsByRfc = new Map<string, typeof dbClients[0]>();
  const crmClientsByName = new Map<string, typeof dbClients[0]>();
  for (const c of dbClients) {
    if (c.rfc) crmClientsByRfc.set(c.rfc.toLowerCase().trim(), c);
    if (c.name) crmClientsByName.set(c.name.toLowerCase().trim(), c);
  }

  // Maps for products lookup (Model -> Item, OrderCode -> Item, Name -> Item)
  const productsByModel = new Map<string, typeof dbProducts[0]>();
  const productsByOrderCode = new Map<string, typeof dbProducts[0]>();
  const productsByName = new Map<string, typeof dbProducts[0]>();
  for (const p of dbProducts) {
    if (p.model) productsByModel.set(p.model.toLowerCase().trim(), p);
    if (p.order_code) productsByOrderCode.set(p.order_code.toLowerCase().trim(), p);
    if (p.nombre) productsByName.set(p.nombre.toLowerCase().trim(), p);
  }

  // Set of existing invoice folios in DB (case-insensitive)
  const existingFolios = new Set<string>(
    dbExistingInvoices.map((inv: any) => inv.numero_factura.toLowerCase().trim())
  );

  // Group Excel rows by FOLIO
  const invoiceGroups = new Map<string, ExcelRow[]>();
  for (const row of rows) {
    const folio = String(row.FOLIO || '').trim();
    if (!folio) continue;
    if (!invoiceGroups.has(folio)) {
      invoiceGroups.set(folio, []);
    }
    invoiceGroups.get(folio)!.push(row);
  }

  console.log(`Grouped into ${invoiceGroups.size} unique invoices (folios).`);

  // Trackers
  let skippedDuplicatesCount = 0;
  let totalRevenueImported = 0;
  let clientMatchedCount = 0;
  let clientAutoCreatedCount = 0;
  let productMatchedCount = 0;
  let productAutoCreatedCount = 0;

  // Queued operations if committing
  const invoicesToCreate: any[] = [];
  
  // Cache to avoid creating same client/product twice within the loop
  const newlyCreatedClientesMap = new Map<string, any>(); // clientKey -> DB ID
  const newlyCreatedClientsMap = new Map<string, any>(); // clientKey -> DB ID
  const newlyCreatedProductsMap = new Map<string, any>(); // productKey -> DB ID

  console.log('\nProcessing invoices...');

  for (const [folio, groupRows] of invoiceGroups.entries()) {
    // 1. Check for duplicates
    if (existingFolios.has(folio.toLowerCase().trim())) {
      skippedDuplicatesCount++;
      continue;
    }

    const firstRow = groupRows[0];
    const fechaExpedicion = firstRow.FECHA ? excelToDate(firstRow.FECHA) : new Date();
    
    // Client details
    const rfc = firstRow.RFC ? String(firstRow.RFC).trim() : null;
    const razonSocial = firstRow['RAZON SOCIAL'] ? String(firstRow['RAZON SOCIAL']).trim() : null;
    const clienteName = firstRow['CLIENTE.1'] ? String(firstRow['CLIENTE.1']).trim() : (firstRow.CLIENTE ? String(firstRow.CLIENTE).trim() : null);
    const estadoCliente = firstRow.ESTADO ? String(firstRow.ESTADO).trim() : 'Activo';

    // Best client identifier
    const clientNameForMatching = clienteName || razonSocial || 'Cliente sin nombre';

    // 2. Client matching & resolution
    let targetClienteId: string | null = null;

    // Check newly created cache first
    const clientCacheKey = rfc ? rfc.toLowerCase() : clientNameForMatching.toLowerCase();
    if (newlyCreatedClientesMap.has(clientCacheKey)) {
      targetClienteId = newlyCreatedClientesMap.get(clientCacheKey);
      clientMatchedCount++;
    } else {
      // Lookup in Spanish clientes table
      let matchedCliente = rfc ? clientesByRfc.get(rfc.toLowerCase()) : null;
      if (!matchedCliente) matchedCliente = clientesByName.get(clientNameForMatching.toLowerCase());
      if (!matchedCliente && clienteName) matchedCliente = clientesByName.get(clienteName.toLowerCase());

      if (matchedCliente) {
        targetClienteId = matchedCliente.id;
        clientMatchedCount++;
      } else {
        // Look up in CRM clients table
        let matchedCrmClient = rfc ? crmClientsByRfc.get(rfc.toLowerCase()) : null;
        if (!matchedCrmClient) matchedCrmClient = crmClientsByName.get(clientNameForMatching.toLowerCase());
        if (!matchedCrmClient && clienteName) matchedCrmClient = crmClientsByName.get(clienteName.toLowerCase());

        if (matchedCrmClient) {
          // Exists in CRM clients, but missing in transactional clientes table.
          // Auto-create in clientes table.
          if (isCommit) {
            const created = await prisma.clientes.create({
              data: {
                nombre: matchedCrmClient.name,
                rfc: matchedCrmClient.rfc,
                direccion: matchedCrmClient.fiscal_address || null,
                correo: matchedCrmClient.email_primary || matchedCrmClient.email_billing || null,
                telefono: matchedCrmClient.phone || null,
                codigo_postal: matchedCrmClient.zip_code || null,
                regimen_fiscal: matchedCrmClient.tax_regime || null
              }
            });
            targetClienteId = created.id;
            // Add to database lookup maps for subsequent iterations
            clientesByName.set(created.nombre.toLowerCase().trim(), created);
            if (created.rfc) clientesByRfc.set(created.rfc.toLowerCase().trim(), created);
          } else {
            targetClienteId = 'AUTO_GEN_ID';
          }
          newlyCreatedClientesMap.set(clientCacheKey, targetClienteId);
          clientAutoCreatedCount++;
        } else {
          // Missing in BOTH tables. Create in BOTH.
          if (isCommit) {
            // Create in CRM clients
            const newCrm = await prisma.clients.create({
              data: {
                name: clientNameForMatching,
                rfc: rfc || null,
                status: estadoCliente === 'Activo' ? 'Activo' : 'Nuevo Prospecto',
                notes: `Auto-created during 2025 sales Excel import. Origin client: ${clienteName || ''}`
              }
            });
            // Create in transactional clientes
            const newCli = await prisma.clientes.create({
              data: {
                nombre: clientNameForMatching,
                rfc: rfc || null
              }
            });
            targetClienteId = newCli.id;
            
            // Add to lookups
            clientesByName.set(newCli.nombre.toLowerCase().trim(), newCli);
            if (newCli.rfc) clientesByRfc.set(newCli.rfc.toLowerCase().trim(), newCli);
            crmClientsByName.set(newCrm.name.toLowerCase().trim(), newCrm);
            if (newCrm.rfc) crmClientsByRfc.set(newCrm.rfc.toLowerCase().trim(), newCrm);
          } else {
            targetClienteId = 'AUTO_GEN_ID';
          }
          newlyCreatedClientesMap.set(clientCacheKey, targetClienteId);
          clientAutoCreatedCount++;
        }
      }
    }

    // 3. Group calculations
    const totalAmount = groupRows.reduce((sum, r) => sum + (Number(r['AMOUNT (MXN)'] || r.TOTAL) || 0), 0);
    const subtotal = Number((totalAmount / 1.16).toFixed(2));
    const iva = Number((totalAmount - subtotal).toFixed(2));
    totalRevenueImported += totalAmount;

    // 4. Resolve products and prepare line items
    const lineItems: any[] = [];
    for (const r of groupRows) {
      const prodId = String(r.ProductoID || r.PRODUCTOID || '').trim();
      const prodName = String(r.PRODUCTO || '').trim();
      const model = r.Modelo || r.MODELO ? String(r.Modelo || r.MODELO).trim() : null;
      const orderCode = r['Ordering Code'] || r['CODIGO ORDEN'] ? String(r['Ordering Code'] || r['CODIGO ORDEN']).trim() : null;
      const line = r.Linea || r.LINEA ? String(r.Linea || r.LINEA).trim() : 'Otros';
      const tipo = r.Tipo || r['TIPO PRODUCTO'] ? String(r.Tipo || r['TIPO PRODUCTO']).trim() : 'Producto';
      const cantidad = Number(r.CANTIDAD) || 1;
      const precioUnitario = Number(r['PRECIO UNI']) || 0;
      const totalItem = Number(r['AMOUNT (MXN)'] || r.TOTAL) || 0;

      let targetProductId: string | null = null;
      const productKey = prodId.toLowerCase();

      if (newlyCreatedProductsMap.has(productKey)) {
        targetProductId = newlyCreatedProductsMap.get(productKey);
        productMatchedCount++;
      } else {
        // Match by Model, Order Code, or Name
        let matchedProduct = model ? productsByModel.get(model.toLowerCase()) : null;
        if (!matchedProduct && orderCode) matchedProduct = productsByOrderCode.get(orderCode.toLowerCase());
        if (!matchedProduct && prodName) matchedProduct = productsByName.get(prodName.toLowerCase());

        if (matchedProduct) {
          targetProductId = matchedProduct.id;
          productMatchedCount++;
        } else {
          // Missing product. Auto-create in Catalog.
          if (isCommit) {
            const newProd = await prisma.productos.create({
              data: {
                nombre: prodName || `Producto ${prodId}`,
                precio_unitario: precioUnitario,
                consecutivo_alg: prodId || null,
                model: model,
                order_code: orderCode,
                categoria: line,
                tipo: tipo,
                activo: true
              }
            });
            targetProductId = newProd.id;
            
            // Add to database lookup maps
            productsByName.set(newProd.nombre.toLowerCase().trim(), newProd);
            if (newProd.model) productsByModel.set(newProd.model.toLowerCase().trim(), newProd);
            if (newProd.order_code) productsByOrderCode.set(newProd.order_code.toLowerCase().trim(), newProd);
          } else {
            targetProductId = 'AUTO_GEN_PRODUCT_ID';
          }
          newlyCreatedProductsMap.set(productKey, targetProductId);
          productAutoCreatedCount++;
        }
      }

      lineItems.push({
        producto_id: targetProductId === 'AUTO_GEN_PRODUCT_ID' ? null : targetProductId,
        producto_nombre: prodName,
        producto_codigo: prodId || orderCode || null,
        cantidad_facturada: cantidad,
        cantidad_entregada: cantidad, // default fully delivered for historical records
        precio_unitario: precioUnitario,
        importe: totalItem,
        linea: line
      });
    }

    // 5. Invoices structure
    invoicesToCreate.push({
      numero_factura: folio,
      cliente_id: targetClienteId === 'AUTO_GEN_ID' ? null : targetClienteId,
      cliente_nombre: clientNameForMatching,
      cliente_rfc: rfc,
      fecha_expedicion: fechaExpedicion,
      fecha_vencimiento: fechaExpedicion, // same day for simplicity
      prioridad: 'normal',
      estado: 'pagada', // historical 2025 records are closed/paid
      subtotal,
      iva,
      total: totalAmount,
      xml_original: null,
      observaciones: 'Importación histórica de ventas 2025',
      fecha_pago: fechaExpedicion,
      metodo_pago: 'Transferencia SPEI',
      estado_surtido: 'surtida',
      lineItems
    });
  }

  // 6. DB Execution
  if (isCommit) {
    console.log('\nClearing previous historical imports...');
    // Only delete if there are any remaining (though they should be cleared already if we run it again)
    const deleted = await prisma.facturas_cliente.deleteMany({
      where: { observaciones: 'Importación histórica de ventas 2025' }
    });
    console.log(`Deleted ${deleted.count} existing historical invoices.`);

    console.log(`\nInserting ${invoicesToCreate.length} invoices into database...`);
    
    // We execute inside a transaction
    await prisma.$transaction(async (tx: any) => {
      for (const inv of invoicesToCreate) {
        const { lineItems, ...invoiceData } = inv;
        
        // Create invoice header with nested line items
        await tx.facturas_cliente.create({
          data: {
            ...invoiceData,
            factura_productos: {
              createMany: {
                data: lineItems
              }
            }
          }
        });
      }
    }, {
      maxWait: 30000,
      timeout: 300000
    });
    console.log('Database transaction completed successfully!');
  }

  // Output stats
  console.log('\n--- INGESTION REPORT ---');
  console.log(`Total Excel rows parsed:      ${rows.length}`);
  console.log(`Total Excel unique folios:    ${invoiceGroups.size}`);
  console.log(`Skipped duplicate folios:     ${skippedDuplicatesCount}`);
  console.log(`Invoices processed for import: ${invoicesToCreate.length}`);
  console.log(`Total sales revenue:          $${totalRevenueImported.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);
  console.log('\nEntity matching metrics:');
  console.log(`- Clients matched:            ${clientMatchedCount}`);
  console.log(`- Clients auto-created:       ${clientAutoCreatedCount}`);
  console.log(`- Products matched:           ${productMatchedCount}`);
  console.log(`- Products auto-created:      ${productAutoCreatedCount}`);
  console.log('------------------------');
  console.log(isCommit ? '✅ Import completed successfully!' : 'ℹ️ Dry-run completed. No changes made. Run with --commit to apply changes.');
}

main()
  .catch((e) => {
    console.error('Migration failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
