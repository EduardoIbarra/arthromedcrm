'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  Plus, 
  Search, 
  Receipt, 
  Package, 
  X, 
  Check, 
  Tag, 
  FileText,
  AlertCircle,
  Printer,
  FileSpreadsheet,
  Download
} from 'lucide-react'

interface ProductOption {
  id: string
  nombre: string
  nombre_lista?: string | null
  model?: string | null
  order_code?: string | null
  line?: string | null
  categoria?: string | null
  alegra_id?: string | null
}

interface InvoiceItem {
  id?: string
  product_id: string
  product_nombre?: string
  quantity: number
  productos?: ProductOption | null
}

interface PurchaseInvoice {
  id: string
  numero_factura: string
  nombre: string | null
  status?: string | null
  observaciones: string | null
  fecha_factura: string | null
  created_at: string | null
  pre_orders?: { id: string; numero_orden: string; observaciones: string | null; created_at: string | null }[]
  items: InvoiceItem[]
}

interface CatalogLine {
  id: string
  name: string
  color: string
}

export default function EditPurchaseInvoicePage() {
  const params = useParams()
  const router = useRouter()
  const invoiceId = params.id as string

  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null)
  const [nombre, setNombre] = useState('')
  const [status, setStatus] = useState('Creado')
  const [observaciones, setObservaciones] = useState('')
  const [items, setItems] = useState<{ product_id: string; quantity: number; product_nombre?: string; productObj?: ProductOption | null }[]>([])

  const [allProducts, setAllProducts] = useState<ProductOption[]>([])
  const [catalogLines, setCatalogLines] = useState<CatalogLine[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Live filter search for table items
  const [tableSearchTerm, setTableSearchTerm] = useState('')

  // Product picker modal for adding/replacing products
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false)
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null) // null = new product
  const [productSearchTerm, setProductSearchTerm] = useState('')

  // 1. Fetch invoice, products, and catalog lines
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [invRes, prodRes, linesRes] = await Promise.all([
          fetch(`/api/purchase-invoices/${invoiceId}`),
          fetch('/api/products?pageSize=1000'),
          fetch('/api/catalogos/lineas')
        ])

        if (!invRes.ok) throw new Error('Factura de compra no encontrada')

        const invData = await invRes.json()
        const prodData = await prodRes.json()
        const linesData = await linesRes.json()

        const inv: PurchaseInvoice = invData.data
        setInvoice(inv)
        setNombre(inv.nombre || '')
        setStatus(inv.status || 'Creado')
        setObservaciones(inv.observaciones || '')

        const prods: ProductOption[] = prodData.data || prodData || []
        setAllProducts(prods)

        const lines: CatalogLine[] = linesData.data || []
        setCatalogLines(lines)

        const prodMap = new Map<string, ProductOption>(prods.map(p => [p.id, p]))

        setItems((inv.items || []).map(it => ({
          product_id: it.product_id,
          quantity: it.quantity || 1,
          productObj: prodMap.get(it.product_id) || (it.productos as ProductOption) || {
            id: it.product_id,
            nombre: it.product_nombre || 'Producto'
          }
        })))

      } catch (err: any) {
        console.error(err)
        setError(err.message || 'Error al cargar factura de compra')
      } finally {
        setIsLoading(false)
      }
    }

    if (invoiceId) fetchData()
  }, [invoiceId])

  // Build product line color map
  const lineColorsMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const l of catalogLines) {
      if (l.name && l.color) {
        map.set(l.name.trim().toUpperCase(), l.color)
      }
    }
    return map
  }, [catalogLines])

  const getProductLine = (p?: ProductOption | null): string => {
    if (!p) return 'OTRO'
    return (p.line || p.categoria || 'OTRO').toUpperCase().trim()
  }

  const getLineColor = (lineName: string): string => {
    const clean = lineName.toUpperCase().trim()
    return lineColorsMap.get(clean) || '#0763a9'
  }

  // Filter table rows by search term
  const filteredItems = useMemo(() => {
    if (!tableSearchTerm.trim()) return items.map((item, idx) => ({ ...item, originalIndex: idx }))
    const q = tableSearchTerm.toLowerCase().trim()
    return items
      .map((item, idx) => ({ ...item, originalIndex: idx }))
      .filter(({ productObj }) => {
        if (!productObj) return false
        const name = (productObj.nombre_lista || productObj.nombre || '').toLowerCase()
        const model = (productObj.model || '').toLowerCase()
        const code = (productObj.order_code || '').toLowerCase()
        const line = getProductLine(productObj).toLowerCase()
        return name.includes(q) || model.includes(q) || code.includes(q) || line.includes(q)
      })
  }, [items, tableSearchTerm])

  // Filter searchable products for modal picker
  const filteredProductsForPicker = useMemo(() => {
    if (!productSearchTerm.trim()) return allProducts.slice(0, 50)
    const q = productSearchTerm.toLowerCase().trim()
    return allProducts.filter(p => {
      const name = (p.nombre_lista || p.nombre || '').toLowerCase()
      const model = (p.model || '').toLowerCase()
      const code = (p.order_code || '').toLowerCase()
      const line = getProductLine(p).toLowerCase()
      return name.includes(q) || model.includes(q) || code.includes(q) || line.includes(q)
    }).slice(0, 50)
  }, [allProducts, productSearchTerm])

  // Item modifications
  const handleQuantityChange = (originalIndex: number, newQty: number) => {
    const val = Math.max(1, isNaN(newQty) ? 1 : newQty)
    setItems(prev => {
      const next = [...prev]
      next[originalIndex] = { ...next[originalIndex], quantity: val }
      return next
    })
  }

  const handleRemoveItem = (originalIndex: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== originalIndex))
  }

  const handleSelectProductForPicker = (prod: ProductOption) => {
    if (editingItemIndex !== null) {
      // Replace existing row
      setItems(prev => {
        const next = [...prev]
        next[editingItemIndex] = {
          ...next[editingItemIndex],
          product_id: prod.id,
          productObj: prod
        }
        return next
      })
    } else {
      // Add new row
      setItems(prev => [
        ...prev,
        {
          product_id: prod.id,
          quantity: 1,
          productObj: prod
        }
      ])
    }
    setIsProductPickerOpen(false)
    setProductSearchTerm('')
    setEditingItemIndex(null)
  }

  const openAddProductModal = () => {
    setEditingItemIndex(null)
    setProductSearchTerm('')
    setIsProductPickerOpen(true)
  }

  const openReplaceProductModal = (originalIndex: number) => {
    setEditingItemIndex(originalIndex)
    setProductSearchTerm('')
    setIsProductPickerOpen(true)
  }

  // Save invoice updates
  const handleSaveInvoice = async () => {
    if (items.length === 0) {
      alert('La factura de compra debe contener al menos un producto.')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`/api/purchase-invoices/${invoiceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim() || null,
          status,
          observaciones: observaciones.trim() || null,
          items: items.map(it => ({
            product_id: it.product_id,
            quantity: it.quantity
          }))
        })
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || 'Error al guardar factura de compra')
      }

      alert('Factura de compra guardada con éxito')
      router.push('/purchase-orders')
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Error al guardar factura')
    } finally {
      setIsSaving(false)
    }
  }

  // Delete invoice
  const handleDeleteInvoice = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/purchase-invoices/${invoiceId}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Error al eliminar factura de compra')

      alert('Factura de compra eliminada')
      router.push('/purchase-orders')
    } catch (err: any) {
      console.error(err)
      alert(err.message)
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const totalUnits = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.quantity || 0), 0)
  }, [items])

  // Helper to get soft ARGB hex for Excel row fills matching line colors
  const getSoftExcelArgb = (hex: string): string => {
    const clean = hex.replace('#', '').trim()
    if (clean.length !== 6) return 'FFF8FAFC'
    const r = parseInt(clean.substring(0, 2), 16)
    const g = parseInt(clean.substring(2, 4), 16)
    const b = parseInt(clean.substring(4, 6), 16)
    const tr = Math.round(r * 0.14 + 255 * 0.86)
    const tg = Math.round(g * 0.14 + 255 * 0.86)
    const tb = Math.round(b * 0.14 + 255 * 0.86)
    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase()
    return `FF${toHex(tr)}${toHex(tg)}${toHex(tb)}`
  }

  // Export to Excel (.xlsx) with background colors & styling (without separate Línea column)
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Productos Factura')

    worksheet.columns = [
      { header: '#', key: 'idx', width: 6 },
      { header: 'Producto', key: 'product', width: 50 },
      { header: 'Modelo', key: 'model', width: 24 },
      { header: 'Código de Orden', key: 'code', width: 24 },
      { header: 'Cantidad', key: 'qty', width: 14 },
    ]

    // Style Header Row
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.height = 26
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0763A9' }
      }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })

    // Data Rows
    items.forEach((item, idx) => {
      const lineName = getProductLine(item.productObj) || '—'
      const hexColor = getLineColor(lineName)
      const softArgb = getSoftExcelArgb(hexColor)

      const row = worksheet.addRow({
        idx: idx + 1,
        product: item.productObj?.nombre_lista || item.productObj?.nombre || item.product_nombre || 'Producto',
        model: item.productObj?.model || '—',
        code: item.productObj?.order_code || '—',
        qty: item.quantity
      })

      row.height = 24

      // Quantity cell highlight
      const qtyCell = row.getCell('qty')
      qtyCell.font = { bold: true, color: { argb: 'FF15803D' } }
      qtyCell.alignment = { vertical: 'middle', horizontal: 'center' }

      // Apply row line background color to all cells in the row
      row.eachCell((cell, colNumber) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: softArgb }
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        }
        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
          cell.font = { bold: true, color: { argb: 'FF475569' } }
        }
        if (colNumber === 2) {
          cell.font = { bold: true }
        }
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Factura_Compra_${invoice?.numero_factura || 'detalles'}.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  // Print / Save as PDF with line background colors (without separate Línea column)
  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    let rowsHtml = ''
    items.forEach((item, idx) => {
      const lineName = getProductLine(item.productObj) || '—'
      const lineColor = getLineColor(lineName)

      rowsHtml += `
        <tr style="background-color: ${lineColor}22; border-left: 5px solid ${lineColor};">
          <td style="padding: 10px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #475569;">${idx + 1}</td>
          <td style="padding: 10px 8px; border: 1px solid #e2e8f0; font-weight: 600; color: #0f172a;">${item.productObj?.nombre_lista || item.productObj?.nombre || item.product_nombre || 'Producto'}</td>
          <td style="padding: 10px 8px; border: 1px solid #e2e8f0; color: #334155;">${item.productObj?.model || '—'}</td>
          <td style="padding: 10px 8px; border: 1px solid #e2e8f0; color: #334155;">${item.productObj?.order_code || '—'}</td>
          <td style="padding: 10px 8px; border: 1px solid #e2e8f0; text-align: center;">
            <span style="display: inline-block; padding: 3px 10px; border-radius: 6px; font-weight: bold; color: #15803d; background-color: #dcfce7;">
              ${item.quantity}
            </span>
          </td>
        </tr>
      `
    })

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Factura de Compra ${invoice?.numero_factura || ''}</title>
          <style>
            @media print {
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body { font-family: system-ui, -apple-system, sans-serif; color: #111827; padding: 24px; }
            .header-banner { background-color: #0763a9; color: white; padding: 16px 20px; border-radius: 12px; margin-bottom: 20px; }
            .header-title { font-size: 22px; font-weight: bold; margin: 0; }
            .header-sub { font-size: 13px; opacity: 0.9; margin-top: 4px; }
            .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
            .meta-card { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 8px; }
            .meta-label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; }
            .meta-val { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
            th { background-color: #0763a9; color: white; padding: 10px; border: 1px solid #0284c7; text-align: left; font-weight: bold; }
            td { padding: 9px; border: 1px solid #e2e8f0; }
            .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          </style>
        </head>
        <body>
          <div class="header-banner">
            <div class="header-title">Factura de Compra: ${invoice?.numero_factura || ''}</div>
            <div class="header-sub">Arthromed ERP · Resumen de Productos</div>
          </div>

          <div class="meta-grid">
            <div class="meta-card">
              <div class="meta-label">Referencia</div>
              <div class="meta-val">${nombre || '—'}</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Observaciones</div>
              <div class="meta-val">${observaciones || '—'}</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Total Unidades</div>
              <div class="meta-val">${totalUnits} (${items.length} productos distintos)</div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="text-align: center; width: 35px;">#</th>
                <th>Producto</th>
                <th style="width: 150px;">Modelo</th>
                <th style="width: 150px;">Código de Orden</th>
                <th style="text-align: center; width: 90px;">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="footer">Arthromed ERP — Documento generado el ${new Date().toLocaleDateString()}</div>
          <script>
            window.addEventListener('DOMContentLoaded', () => {
              setTimeout(() => { window.print(); }, 400);
            });
          </script>
        </body>
      </html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8 max-w-7xl mx-auto flex justify-center items-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-[#0763a9] rounded-full animate-spin" />
            <p className="text-sm font-semibold text-gray-500">Cargando Factura de Compra...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  if (error || !invoice) {
    return (
      <AppShell>
        <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
          <div className="p-6 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 font-semibold">
            {error || 'Factura no encontrada'}
          </div>
          <button onClick={() => router.push('/purchase-orders')} className="btn-secondary">
            ← Volver a Compras
          </button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-4">
        
        {/* Top Sticky Header */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-2 z-20">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/purchase-orders')}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
              title="Volver a Facturas de Compra"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="text-[#0763a9]" size={22} />
                <h1 className="text-xl font-bold text-gray-900">
                  Factura {invoice.numero_factura}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-[#0763a9] border border-blue-200">
                  {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'} ({items.length} {items.length === 1 ? 'linea' : 'lineas'})
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Creada el {invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : '-'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={16} />
              Eliminar Factura
            </button>
            <button
              onClick={handleSaveInvoice}
              disabled={isSaving}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm shadow-sm"
            >
              <Save size={16} />
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4 bg-white border border-gray-150 rounded-2xl space-y-3">
            <label className="block text-xs font-bold uppercase text-gray-500">
              Nombre / Referencia de la Factura
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Importación BONSS Julio 2026..."
              className="erp-input w-full text-sm font-semibold text-gray-900"
            />
          </div>

          <div className="card p-4 bg-white border border-gray-150 rounded-2xl space-y-3">
            <label className="block text-xs font-bold uppercase text-gray-500">
              Estado de la Factura
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={`erp-input w-full text-sm font-bold transition-all ${
                status === 'Revisado'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : status === 'Listo para revisión'
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-blue-50 text-[#0763a9] border-blue-300'
              }`}
            >
              <option value="Creado">Creado</option>
              <option value="Listo para revisión">Listo para revisión</option>
              <option value="Revisado">Revisado</option>
            </select>
          </div>

          <div className="card p-4 bg-white border border-gray-150 rounded-2xl space-y-3">
            <label className="block text-xs font-bold uppercase text-gray-500">
              Observaciones / Notas
            </label>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas sobre el proveedor, embarque o facturación..."
              className="erp-input w-full text-sm text-gray-700"
            />
          </div>

          <div className="card p-4 bg-white border border-gray-150 rounded-2xl space-y-2">
            <label className="block text-xs font-bold uppercase text-gray-500">
              Pre-Órdenes Consolidadas
            </label>
            {invoice.pre_orders && invoice.pre_orders.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto pt-1">
                {invoice.pre_orders.map(po => (
                  <span key={po.id} className="px-2.5 py-1 bg-blue-50 text-blue-800 rounded-lg text-xs font-mono font-bold border border-blue-200">
                    {po.numero_orden}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic pt-1">Sin pre-órdenes vinculadas</p>
            )}
          </div>
        </div>

        {/* High Density Table & Product Filters */}
        <div className="card bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {/* Table Header Controls */}
          <div className="p-3 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Filtrar productos por nombre, código, modelo o línea..."
                  value={tableSearchTerm}
                  onChange={(e) => setTableSearchTerm(e.target.value)}
                  className="erp-input w-full pl-8 pr-8 py-1.5 text-xs bg-white"
                />
                {tableSearchTerm && (
                  <button 
                    onClick={() => setTableSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <span className="text-xs text-gray-500 font-semibold whitespace-nowrap">
                {filteredItems.length} de {items.length} filas
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center gap-1.5 shadow-sm"
                title="Imprimir o guardar como PDF"
              >
                <Printer size={14} className="text-gray-500" />
                Imprimir / PDF
              </button>
              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1.5 shadow-sm"
                title="Descargar lista de productos en Excel"
              >
                <FileSpreadsheet size={14} className="text-emerald-600" />
                Descargar Excel
              </button>
              <button
                onClick={openAddProductModal}
                className="btn-primary flex items-center gap-1.5 py-1.5 px-3 text-xs bg-[#0763a9] hover:bg-[#054b80]"
              >
                <Plus size={14} />
                Agregar Producto
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto max-h-[calc(100vh-340px)] min-h-[350px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-gray-100 border-b border-gray-200 z-10">
                <tr>
                  <th className="py-2 px-3 font-bold text-gray-600 uppercase w-10 text-center">#</th>
                  <th className="py-2 px-3 font-bold text-gray-600 uppercase">Producto</th>
                  <th className="py-2 px-3 font-bold text-gray-600 uppercase w-32">Modelo / Código</th>
                  <th className="py-2 px-3 font-bold text-gray-600 uppercase text-center w-28">Cantidad</th>
                  <th className="py-2 px-3 font-bold text-gray-600 uppercase text-right w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400 italic">
                      {tableSearchTerm ? 'No se encontraron productos coincidentes.' : 'No hay productos en esta factura.'}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(({ product_id, quantity, productObj, originalIndex }, displayIdx) => {
                    const lineName = getProductLine(productObj)
                    const hexColor = getLineColor(lineName)
                    
                    // Generate soft background tint with matching crisp left border
                    const rowStyle = {
                      backgroundColor: `${hexColor}18`, // 10% - 12% opacity
                      borderLeft: `5px solid ${hexColor}`
                    }

                    return (
                      <tr 
                        key={originalIndex} 
                        style={rowStyle}
                        className="hover:brightness-95 transition-all"
                      >
                        <td className="py-1.5 px-3 text-center text-gray-500 font-mono font-semibold">
                          {displayIdx + 1}
                        </td>
                        <td className="py-1.5 px-3">
                          <div className="font-medium text-gray-900 text-xs">
                            {productObj?.nombre_lista || productObj?.nombre || 'Producto'}
                          </div>
                        </td>
                        <td className="py-1.5 px-3 font-mono text-[11px] text-gray-600">
                          {productObj?.model || productObj?.order_code ? (
                            <span>{productObj.model || ''} {productObj.order_code ? `(${productObj.order_code})` : ''}</span>
                          ) : (
                            <span className="text-gray-400 italic">-</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => handleQuantityChange(originalIndex, parseInt(e.target.value, 10))}
                            className="w-20 text-center py-1 px-2 font-bold text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-[#0763a9] outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openReplaceProductModal(originalIndex)}
                              className="p-1 text-gray-500 hover:text-[#0763a9] hover:bg-white rounded transition-colors"
                              title="Cambiar producto"
                            >
                              <Tag size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(originalIndex)}
                              className="p-1 text-gray-400 hover:text-rose-600 hover:bg-white rounded transition-colors"
                              title="Quitar fila"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle size={28} />
              <h3 className="text-lg font-bold text-gray-900">¿Eliminar Factura de Compra?</h3>
            </div>
            <p className="text-sm text-gray-600">
              Esta acción eliminará permanentemente la factura <strong className="text-gray-900">{invoice.numero_factura}</strong>. Las pre-órdenes asociadas no se borrarán y volverán a estar disponibles para consolidar.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
                className="btn-secondary"
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeleteInvoice} 
                className="btn-primary bg-rose-600 hover:bg-rose-700 border-rose-600"
                disabled={isDeleting}
              >
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Searchable Product Picker Modal */}
      {isProductPickerOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-gray-100 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Package className="text-[#0763a9]" size={20} />
                {editingItemIndex !== null ? 'Cambiar Producto' : 'Agregar Producto a la Factura'}
              </h3>
              <button 
                onClick={() => setIsProductPickerOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Live Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                autoFocus
                placeholder="Buscar por nombre, modelo, código o línea de producto..."
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                className="erp-input w-full pl-9 text-sm"
              />
            </div>

            {/* Products List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl max-h-[450px]">
              {filteredProductsForPicker.length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-xs italic">
                  No se encontraron productos con ese criterio.
                </div>
              ) : (
                filteredProductsForPicker.map(p => {
                  const lineName = getProductLine(p)
                  const hexColor = getLineColor(lineName)

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProductForPicker(p)}
                      className="p-3 hover:bg-blue-50/50 cursor-pointer transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span 
                            style={{ backgroundColor: `${hexColor}33`, color: '#1e293b', borderColor: hexColor }}
                            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border"
                          >
                            {lineName}
                          </span>
                          <h4 className="font-semibold text-xs text-gray-900 truncate">
                            {p.nombre_lista || p.nombre}
                          </h4>
                        </div>
                        <p className="text-xs text-gray-500 font-mono">
                          {p.model ? `Modelo: ${p.model}` : ''} {p.order_code ? `| Código: ${p.order_code}` : ''}
                        </p>
                      </div>

                      <button type="button" className="btn-secondary py-1 px-3 text-xs shrink-0">
                        Seleccionar
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

    </AppShell>
  )
}
