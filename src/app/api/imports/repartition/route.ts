import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { querySegundaDB } from '@/lib/segundaDB';
import { computeDeliveryLimit, toIsoDate } from '@/lib/delivery-limit';

type OrderLine = {
  id: string;
  folio: string;
  customerName: string;
  product: string;
  requestedQty: number;
  paymentDate: string | null;
  /** ISO date of delivery deadline (first payment + 5 weeks policy) */
  shippingLimit: string | null;
};

/** Facturas whose numero starts with F or N are excluded from repartition. */
function isExcludedPrefixedFolio(folio: string | null | undefined): boolean {
  return /^[FN]/i.test(String(folio || '').trim());
}

function getPaymentSortTime(order: OrderLine): number {
  if (!order.paymentDate) return Number.MAX_SAFE_INTEGER;
  const t = new Date(order.paymentDate).getTime();
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

function getDeadlineSortTime(order: OrderLine): number {
  if (!order.shippingLimit) return Number.MAX_SAFE_INTEGER;
  const t = new Date(order.shippingLimit).getTime();
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

/**
 * Inventory keyed by a canonical product name, with aliases (nombre, nombre_lista)
 * and product_id so stock físico and órdenes de compra merge correctly.
 */
class InventoryPool {
  /** canonical name -> qty */
  qty: Record<string, number> = {};
  /** lower(alias) -> canonical name */
  private aliasToCanonical = new Map<string, string>();
  /** product uuid -> canonical name */
  private idToCanonical = new Map<string, string>();

  private normalize(s: string) {
    return s.trim().toLowerCase();
  }

  add(
    qty: number,
    opts: {
      canonical?: string | null
      names?: Array<string | null | undefined>
      productId?: string | null
    }
  ) {
    if (!qty || qty <= 0) return;

    const names = (opts.names || [])
      .map(n => (n || '').trim())
      .filter(Boolean);

    let canonical =
      (opts.canonical || '').trim() ||
      (opts.productId && this.idToCanonical.get(opts.productId)) ||
      '';

    if (!canonical && opts.productId) {
      // reuse existing alias if product already seen under another name
      for (const n of names) {
        const hit = this.aliasToCanonical.get(this.normalize(n));
        if (hit) {
          canonical = hit;
          break;
        }
      }
    }

    if (!canonical) {
      for (const n of names) {
        const hit = this.aliasToCanonical.get(this.normalize(n));
        if (hit) {
          canonical = hit;
          break;
        }
      }
    }

    if (!canonical) {
      canonical = names[0] || '';
    }
    if (!canonical) return;

    this.qty[canonical] = (this.qty[canonical] || 0) + qty;

    for (const n of names) {
      this.aliasToCanonical.set(this.normalize(n), canonical);
    }
    this.aliasToCanonical.set(this.normalize(canonical), canonical);
    if (opts.productId) this.idToCanonical.set(opts.productId, canonical);
  }

  /** Resolve demand product name/id to a key present in qty (or null). */
  resolve(productName: string | null | undefined, productId?: string | null): string | null {
    if (productId && this.idToCanonical.has(productId)) {
      return this.idToCanonical.get(productId)!;
    }
    const name = (productName || '').trim();
    if (!name) return null;
    const lower = this.normalize(name);

    const exact = this.aliasToCanonical.get(lower);
    if (exact && (this.qty[exact] || 0) >= 0) return exact;

    // Fuzzy: demand contains alias or alias contains demand
    let best: string | null = null;
    let bestLen = 0;
    for (const [alias, canonical] of this.aliasToCanonical) {
      if (!alias) continue;
      if (lower.includes(alias) || alias.includes(lower)) {
        // Prefer longer alias matches (more specific)
        if (alias.length > bestLen) {
          best = canonical;
          bestLen = alias.length;
        }
      }
    }
    return best;
  }

  asMap(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.qty)) {
      if (v > 0) out[k] = v;
    }
    return out;
  }

  isEmpty(): boolean {
    return Object.keys(this.asMap()).length === 0;
  }
}

/**
 * Strict allocation per product:
 * 1) earliest delivery deadline
 * 2) oldest payment date
 * 3) folio tie-breaker
 */
function allocateByPaymentAndDeadline(
  orders: OrderLine[],
  inventoryMap: Record<string, number>
) {
  const byProduct = new Map<string, OrderLine[]>();
  for (const order of orders) {
    const list = byProduct.get(order.product) || [];
    list.push(order);
    byProduct.set(order.product, list);
  }

  const allocationMap = new Map<string, number>();
  const remaining = { ...inventoryMap };

  for (const [product, productOrders] of byProduct) {
    productOrders.sort((a, b) => {
      const deadlineDiff = getDeadlineSortTime(a) - getDeadlineSortTime(b);
      if (deadlineDiff !== 0) return deadlineDiff;
      const payDiff = getPaymentSortTime(a) - getPaymentSortTime(b);
      if (payDiff !== 0) return payDiff;
      return a.folio.localeCompare(b.folio);
    });

    let stock = remaining[product] || 0;
    for (const order of productOrders) {
      const allocated = Math.min(order.requestedQty, Math.max(0, stock));
      allocationMap.set(order.id, allocated);
      stock -= allocated;
    }
    remaining[product] = stock;
  }

  return { allocationMap, remaining };
}

function buildReasoning(
  orders: OrderLine[],
  allocationMap: Map<string, number>,
  locale: string | undefined,
  sourcesLabel: string
): string {
  const lines = orders
    .filter(o => (allocationMap.get(o.id) || 0) > 0)
    .sort((a, b) => {
      const d = getDeadlineSortTime(a) - getDeadlineSortTime(b);
      if (d !== 0) return d;
      return getPaymentSortTime(a) - getPaymentSortTime(b);
    })
    .slice(0, 8)
    .map(o => {
      const pay = o.paymentDate
        ? new Date(o.paymentDate).toLocaleDateString()
        : 'sin pago';
      const limit = o.shippingLimit
        ? new Date(o.shippingLimit).toLocaleDateString()
        : 'sin límite';
      return `${o.folio} (pago ${pay}, límite ${limit}): ${allocationMap.get(o.id)} uds. de ${o.product}`;
    });

  if (locale === 'en') {
    return [
      `Inventory sources: ${sourcesLabel}.`,
      'Strict priority by delivery deadline (from payment date), then oldest payment first.',
      'No minimum allocation — stock is assigned fully in that order.',
      lines.length ? `Priority served: ${lines.join('; ')}.` : 'No units could be assigned.',
    ].join(' ');
  }
  if (locale === 'zh') {
    return [
      `库存来源：${sourcesLabel}。`,
      '严格按交货期限（来自付款日期）优先，然后按最早付款优先。',
      '无最低分配限制——按该顺序分配库存。',
      lines.length ? `已优先分配：${lines.join('；')}。` : '未能分配任何数量。',
    ].join(' ');
  }
  return [
    `Fuentes de inventario: ${sourcesLabel}.`,
    'Prioridad estricta por fecha límite de entrega (derivada de la fecha de pago), luego pago más antiguo primero.',
    'Sin mínimo de repartición: el inventario se asigna completo en ese orden.',
    lines.length ? `Prioridad atendida: ${lines.join('; ')}.` : 'No se asignaron unidades.',
  ].join(' ');
}

/** Name-like columns we may use if present on public.productos (discovered at runtime). */
const PRODUCT_NAME_COLUMN_CANDIDATES = [
  'nombre',
  'nombre_lista',
  'descripcion_hospitales',
  'descripcion_angeles',
  'invoice_concept',
  'model',
  'order_code',
] as const

type ProductNameRow = { id: string; names: string[]; preferred: string | null }

/** Cached per request lifecycle via module-level promise for this process. */
let productNameColumnsPromise: Promise<string[]> | null = null

/**
 * Inspect primary DB for which product name columns actually exist.
 * Avoids assuming schema fields that may differ across environments.
 */
async function getProductNameColumns(): Promise<string[]> {
  if (!productNameColumnsPromise) {
    productNameColumnsPromise = (async () => {
      try {
        const inList = PRODUCT_NAME_COLUMN_CANDIDATES.map(c => `'${c}'`).join(',')
        const rows = (await prisma.$queryRawUnsafe(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'productos'
            AND column_name IN (${inList})
        `)) as Array<{ column_name: string }>

        const available = new Set(rows.map(r => String(r.column_name)))
        const found = PRODUCT_NAME_COLUMN_CANDIDATES.filter(c => available.has(c))
        return found.length > 0 ? [...found] : ['nombre']
      } catch (err) {
        console.warn('[repartition] could not inspect productos columns:', err)
        return ['nombre']
      }
    })()
  }
  return productNameColumnsPromise
}

function extractNamesFromProductRow(
  row: Record<string, unknown>,
  nameColumns: string[]
): { names: string[]; preferred: string | null } {
  const names: string[] = []
  for (const col of nameColumns) {
    const v = row[col]
    if (v != null && String(v).trim()) names.push(String(v).trim())
  }
  // Prefer nombre_lista when present, else first non-empty name column
  const preferred =
    (nameColumns.includes('nombre_lista') && row.nombre_lista != null && String(row.nombre_lista).trim())
      ? String(row.nombre_lista).trim()
      : names[0] || null
  return { names: Array.from(new Set(names)), preferred }
}

async function loadProductsByIds(productIds: string[]): Promise<Map<string, ProductNameRow>> {
  const map = new Map<string, ProductNameRow>()
  if (productIds.length === 0) return map

  const nameColumns = await getProductNameColumns()
  // Always need id
  const selectCols = ['id', ...nameColumns.filter(c => c !== 'id')]
  const uniqueCols = Array.from(new Set(selectCols))
  // Quote identifiers safely (only allow known candidate names / id)
  const safeCols = uniqueCols.filter(
    c => c === 'id' || (PRODUCT_NAME_COLUMN_CANDIDATES as readonly string[]).includes(c)
  )
  if (!safeCols.includes('id')) safeCols.unshift('id')

  const placeholders = productIds.map((_, i) => `$${i + 1}`).join(', ')
  const sql = `
    SELECT ${safeCols.map(c => `"${c}"`).join(', ')}
    FROM productos
    WHERE id IN (${placeholders})
  `
  const rows = (await prisma.$queryRawUnsafe(sql, ...productIds)) as Array<Record<string, unknown>>

  for (const row of rows) {
    const id = String(row.id || '')
    if (!id) continue
    const { names, preferred } = extractNamesFromProductRow(row, nameColumns)
    map.set(id, { id, names, preferred })
  }
  return map
}

/** Latest physical count per product from primary conteo_diario + product name aliases. */
async function loadStockFisicoFromPrimary(): Promise<
  Array<{ producto_id: string; cantidad: number; names: string[]; preferred: string | null }>
> {
  const nameColumns = await getProductNameColumns()
  const productSelect =
    nameColumns.length > 0
      ? nameColumns
          .filter(c => (PRODUCT_NAME_COLUMN_CANDIDATES as readonly string[]).includes(c))
          .map(c => `p."${c}"`)
          .join(', ')
      : 'p.nombre'

  const rows = (await prisma.$queryRawUnsafe(`
    SELECT
      l.producto_id,
      CAST(l.contado AS bigint) AS cantidad
      ${productSelect ? `, ${productSelect}` : ''}
    FROM (
      SELECT DISTINCT ON (producto_id)
        producto_id,
        contado
      FROM conteo_diario
      ORDER BY producto_id, fecha DESC, updated_at DESC NULLS LAST
    ) l
    LEFT JOIN productos p ON p.id = l.producto_id
    WHERE CAST(l.contado AS bigint) > 0
  `)) as Array<Record<string, unknown>>

  return rows.map(r => {
    const { names, preferred } = extractNamesFromProductRow(r, nameColumns)
    return {
      producto_id: String(r.producto_id || ''),
      cantidad: parseInt(String(r.cantidad ?? '0'), 10) || 0,
      names,
      preferred,
    }
  }).filter(r => r.producto_id && r.cantidad > 0)
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      facturas,
      cotizacionIds,
      locale,
      selectedOrderIds,
      selectedStockFisico,
      useStockFisico,
      csvContent,
    } = body;

    const facturasClean = Array.isArray(facturas)
      ? facturas
          .map((f: string) => String(f).trim())
          .filter((f: string) => f && !isExcludedPrefixedFolio(f))
      : []

    const hasFacturas = facturasClean.length > 0
    const hasCotizaciones = Array.isArray(cotizacionIds) && cotizacionIds.length > 0
    if (!hasFacturas && !hasCotizaciones) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos (facturas o cotizaciones). Las facturas con folio F* o N* se ignoran.' },
        { status: 400 }
      );
    }

    const pool = new InventoryPool();
    let invoiceIdFromChina = '';
    const sourceLabels: string[] = [];

    // Source 1: Legacy CSV
    if (csvContent) {
      const Papa = (await import('papaparse')).default;
      const parsed = Papa.parse(csvContent, { header: false, skipEmptyLines: true });
      let csvItems = 0;
      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i] as string[];
        if (i === 0 && row[0]) invoiceIdFromChina = row[0].trim();
        const producto = row[1]?.trim();
        const cantidad = parseInt(row[2]?.trim() || '0', 10);
        if (producto && !isNaN(cantidad) && cantidad > 0) {
          pool.add(cantidad, { names: [producto], canonical: producto });
          csvItems++;
        }
      }
      if (csvItems > 0) sourceLabels.push('CSV');
    }

    // Source 2: Órdenes de compra (segunda DB), names resolved via primary productos
    if (selectedOrderIds && Array.isArray(selectedOrderIds) && selectedOrderIds.length > 0) {
      const placeholders = selectedOrderIds.map((_: any, i: number) => `$${i + 1}`).join(', ');
      const productos = await querySegundaDB<{
        producto_id: string | null;
        producto_nombre: string;
        cantidad_ordenada: number;
        cantidad_recibida: number | null;
      }>(`
        SELECT producto_id, producto_nombre, cantidad_ordenada, COALESCE(cantidad_recibida, 0) AS cantidad_recibida
        FROM orden_productos
        WHERE orden_id IN (${placeholders})
          AND COALESCE(cantidad_recibida, 0) > 0
      `, selectedOrderIds);

      const productIds = productos.map((p) => p.producto_id).filter(Boolean) as string[];
      const productMeta = await loadProductsByIds(productIds);

      let ocQty = 0;
      for (const p of productos) {
        const recibida = Number(p.cantidad_recibida) || 0;
        if (recibida <= 0) continue;
        const meta = p.producto_id ? productMeta.get(p.producto_id) : undefined;
        const canonical =
          meta?.preferred || p.producto_nombre || null;
        pool.add(recibida, {
          canonical,
          productId: p.producto_id,
          names: [
            ...(meta?.names || []),
            p.producto_nombre,
            canonical,
          ],
        });
        ocQty += recibida;
      }
      if (ocQty > 0) sourceLabels.push('Órdenes de compra');
    }

    // Source 3: Stock físico — always load from primary DB when enabled
    // (do not rely solely on client payload; names often mismatch without server resolve)
    const wantStockFisico =
      useStockFisico === true ||
      (Array.isArray(selectedStockFisico) && selectedStockFisico.length > 0);

    if (wantStockFisico) {
      let loadedFromDb = false;
      try {
        const stockRows = await loadStockFisicoFromPrimary();
        let stockUnits = 0;
        for (const row of stockRows) {
          if (row.cantidad <= 0) continue;
          const canonical = row.preferred || row.names[0] || row.producto_id;
          pool.add(row.cantidad, {
            canonical,
            productId: row.producto_id,
            names: [...row.names, canonical],
          });
          stockUnits += row.cantidad;
        }
        if (stockUnits > 0) {
          sourceLabels.push('Stock físico');
          loadedFromDb = true;
        }
      } catch (err) {
        console.error('[repartition] stock físico load failed:', err);
      }

      // Client payload only as fallback when DB load failed / empty
      if (!loadedFromDb && Array.isArray(selectedStockFisico)) {
        let clientUnits = 0;
        for (const item of selectedStockFisico as {
          nombre?: string
          cantidad?: number
          producto_id?: string
        }[]) {
          const qty = Number(item.cantidad) || 0;
          if (qty <= 0) continue;
          pool.add(qty, {
            productId: item.producto_id || null,
            names: [item.nombre],
            canonical: item.nombre,
          });
          clientUnits += qty;
        }
        if (clientUnits > 0) sourceLabels.push('Stock físico');
      }
    }

    const inventoryMap = pool.asMap();

    if (Object.keys(inventoryMap).length === 0) {
      return NextResponse.json({
        allocations: [],
        remainingInventory: {},
        aiReasoning: 'No hay productos recibidos en las fuentes seleccionadas.',
        invoiceIdFromChina,
      });
    }

    const pendingFacturas = hasFacturas
      ? (
          await prisma.facturas_cliente.findMany({
            where: { numero_factura: { in: facturasClean } },
            include: {
              factura_productos: {
                where: { cantidad_pendiente: { gt: 0 } },
              },
              planes_pago: {
                include: {
                  parcialidades: { orderBy: { numero: 'asc' } }
                }
              }
            }
          })
        ).filter((f: any) => !isExcludedPrefixedFolio(f.numero_factura))
      : []

    const pendingCotizaciones = hasCotizaciones
      ? await prisma.cotizaciones.findMany({
          where: { id: { in: cotizacionIds } },
          include: {
            productos: true,
            planes_pago: {
              include: {
                parcialidades: { orderBy: { numero: 'asc' } }
              }
            }
          }
        })
      : []

    if (pendingFacturas.length === 0 && pendingCotizaciones.length === 0) {
      return NextResponse.json({
        allocations: [],
        remainingInventory: inventoryMap,
        aiReasoning: 'No hay facturas ni cotizaciones pendientes o válidas seleccionadas (folios F* y N* se ignoran).',
        invoiceIdFromChina
      });
    }

    // Resolve product names for demand lines from primary DB columns that exist
    const demandProductIds = Array.from(new Set([
      ...pendingFacturas.flatMap((f: any) =>
        (f.factura_productos || []).map((fp: any) => fp.producto_id).filter(Boolean)
      ),
      ...pendingCotizaciones.flatMap((c: any) =>
        (c.productos || []).map((p: any) => p.producto_id).filter(Boolean)
      ),
    ])) as string[]
    const demandProductMeta = await loadProductsByIds(demandProductIds)

    const ordersFromFacturas = pendingFacturas.flatMap((f: any) => {
      const delivery = computeDeliveryLimit(f)
      const shippingLimit = delivery.limitDate
        ? toIsoDate(delivery.limitDate)
        : null
      const paymentDate = delivery.firstPaymentDate
        ? toIsoDate(delivery.firstPaymentDate)
        : f.fecha_pago
          ? toIsoDate(new Date(f.fecha_pago))
          : null

      return f.factura_productos.map((fp: any) => {
        const meta = fp.producto_id ? demandProductMeta.get(fp.producto_id) : undefined
        const displayName =
          meta?.preferred || fp.producto_nombre || 'Producto'
        return {
          id: fp.id,
          folio: f.numero_factura,
          customerName: f.cliente_nombre,
          paymentDate,
          shippingLimit,
          deliveryIsReference: delivery.isReferenceOnly,
          product: displayName,
          productId: fp.producto_id || null,
          productAliases: [
            ...(meta?.names || []),
            fp.producto_nombre,
            displayName,
          ].filter(Boolean),
          facturadaQty: fp.cantidad_facturada || 0,
          requestedQty: fp.cantidad_pendiente || 0,
          sourceType: 'factura' as const,
        }
      })
    })

    const ordersFromCotizaciones = pendingCotizaciones.flatMap((c: any) => {
      const firstPartial = c.planes_pago?.[0]?.parcialidades?.[0]
      const paymentDate = firstPartial?.fecha_pago
        ? toIsoDate(new Date(firstPartial.fecha_pago))
        : firstPartial?.fecha_vencimiento
          ? toIsoDate(new Date(firstPartial.fecha_vencimiento))
          : null
      const shippingLimit = paymentDate
        ? toIsoDate(new Date(new Date(paymentDate).getTime() + 35 * 24 * 60 * 60 * 1000))
        : null

      return (c.productos || [])
        .filter((p: any) => (Number(p.cantidad) || 0) > 0)
        .map((p: any) => {
          const meta = p.producto_id ? demandProductMeta.get(p.producto_id) : undefined
          const displayName =
            meta?.preferred || p.producto_nombre || 'Producto'
          return {
            id: p.id,
            folio: c.numero_cotizacion,
            customerName: c.cliente_nombre,
            paymentDate,
            shippingLimit,
            deliveryIsReference: true,
            product: displayName,
            productId: p.producto_id || null,
            productAliases: [
              ...(meta?.names || []),
              p.producto_nombre,
              displayName,
            ].filter(Boolean),
            facturadaQty: Number(p.cantidad) || 0,
            requestedQty: Number(p.cantidad) || 0,
            sourceType: 'cotizacion' as const,
          }
        })
    })

    const ordersForAi = [...ordersFromFacturas, ...ordersFromCotizaciones]

    if (ordersForAi.length === 0) {
      return NextResponse.json({
        allocations: [],
        remainingInventory: inventoryMap,
        aiReasoning: 'No hay líneas pendientes válidas en las facturas/cotizaciones seleccionadas.',
        invoiceIdFromChina,
      })
    }

    // Match demand lines to inventory (by product_id, then name aliases / fuzzy)
    const relevantOrders = ordersForAi.filter((o: any) => {
      let matchKey = pool.resolve(o.product, o.productId)
      if (!matchKey && Array.isArray(o.productAliases)) {
        for (const alias of o.productAliases) {
          matchKey = pool.resolve(alias, o.productId)
          if (matchKey) break
        }
      }
      if (matchKey) {
        o.product = matchKey
        return true
      }
      return false
    })

    const sourcesLabel = sourceLabels.length > 0 ? sourceLabels.join(' + ') : 'ninguna'

    if (relevantOrders.length === 0) {
      return NextResponse.json({
        allocations: ordersForAi.map((order: any) => ({ ...order, allocatedQty: 0 })),
        remainingInventory: inventoryMap,
        aiReasoning: `Fuentes: ${sourcesLabel}. Ninguno de los productos en el inventario concuerda con los productos pendientes en las facturas seleccionadas.`,
        invoiceIdFromChina,
      });
    }

    const priorityOrders: OrderLine[] = relevantOrders.map((o: any) => ({
      id: o.id,
      folio: o.folio,
      customerName: o.customerName,
      product: o.product,
      requestedQty: o.requestedQty,
      paymentDate: o.paymentDate,
      shippingLimit: o.shippingLimit,
    }));

    const { allocationMap, remaining: remainingInventory } =
      allocateByPaymentAndDeadline(priorityOrders, inventoryMap);
    const aiReasoning = buildReasoning(priorityOrders, allocationMap, locale, sourcesLabel);

    const finalAllocations = ordersForAi.map((order: any) => ({
      ...order,
      allocatedQty: allocationMap.get(order.id) || 0,
    }));

    return NextResponse.json({
      allocations: finalAllocations,
      remainingInventory,
      aiReasoning,
      invoiceIdFromChina,
      inventorySources: sourceLabels,
    });

  } catch (error: any) {
    console.error('Error in repartition:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
