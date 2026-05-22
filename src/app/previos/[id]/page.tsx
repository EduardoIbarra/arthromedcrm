'use client'

import { useEffect, useState, Suspense } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { ChevronLeft, FileText, Download, Calendar, User, FileDown } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

const CARD = { background: '#ffffff', border: '1px solid #d4e0ec' }

export default function PrevioDetailPage() {
  const { t } = useI18n()
  const params = useParams()
  const router = useRouter()
  const [previo, setPrevio] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPrevio() {
      if (!params.id) return
      try {
        const res = await fetch(`/api/previos/${params.id}`)
        if (res.ok) {
          const json = await res.json()
          setPrevio(json.data)
        } else {
          router.push('/previos')
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchPrevio()
  }, [params.id, router])

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-5xl mx-auto py-16 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0763a9', borderTopColor: 'transparent' }} />
        </div>
      </AppShell>
    )
  }

  if (!previo) return null

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link href="/previos" className="btn-ghost text-sm mb-4 inline-flex items-center gap-1">
            <ChevronLeft size={16} /> Volver a Previos
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold font-mono" style={{ color: '#37383a' }}>
                  {previo.folio}
                </h1>
                <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50" style={{ color: '#0763a9' }}>
                  Previo
                </span>
              </div>
              <p className="text-sm" style={{ color: '#8a8b8d' }}>
                ID: {previo.id}
              </p>
            </div>
            
            {previo.pdf_url && (
              <a 
                href={previo.pdf_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn-primary flex items-center gap-2"
              >
                <FileDown size={16} /> Ver PDF
              </a>
            )}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl" style={CARD}>
            <div className="flex items-center gap-2 mb-3" style={{ color: '#5a5b5d' }}>
              <User size={16} />
              <h3 className="text-sm font-semibold">Cliente</h3>
            </div>
            <p className="text-base font-medium" style={{ color: '#37383a' }}>
              {previo.cliente_nombre || 'No especificado'}
            </p>
          </div>

          <div className="p-4 rounded-xl" style={CARD}>
            <div className="flex items-center gap-2 mb-3" style={{ color: '#5a5b5d' }}>
              <Calendar size={16} />
              <h3 className="text-sm font-semibold">Fecha</h3>
            </div>
            <p className="text-base font-medium" style={{ color: '#37383a' }}>
              {new Date(previo.fecha).toLocaleString()}
            </p>
          </div>

          <div className="p-4 rounded-xl" style={CARD}>
            <div className="flex items-center gap-2 mb-3" style={{ color: '#5a5b5d' }}>
              <FileText size={16} />
              <h3 className="text-sm font-semibold">Totales</h3>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span style={{ color: '#8a8b8d' }}>Subtotal:</span>
                <span className="font-mono font-medium" style={{ color: '#37383a' }}>
                  ${previo.total_sin_descuento?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              {previo.descuento_total_monto > 0 && (
                <div className="flex justify-between text-sm">
                  <span style={{ color: '#8a8b8d' }}>Descuento:</span>
                  <span className="font-mono font-medium text-red-600">
                    -${previo.descuento_total_monto?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-1 mt-1 border-t border-gray-100">
                <span style={{ color: '#37383a' }}>Total:</span>
                <span className="font-mono" style={{ color: '#0763a9' }}>
                  ${previo.total_con_descuento?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Detalle Previo List */}
        <div className="rounded-xl overflow-hidden bg-white" style={CARD}>
          <div className="px-5 py-4 border-b" style={{ borderColor: '#e8f1f9' }}>
            <h2 className="text-lg font-semibold" style={{ color: '#37383a' }}>Detalle de Productos</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #e8f1f9', background: '#fafbfc' }}>
                  <th className="text-left text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#8a8b8d' }}>Descripción</th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#8a8b8d' }}>Cant.</th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#8a8b8d' }}>Precio Unit.</th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#8a8b8d' }}>Descuento</th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#8a8b8d' }}>IVA</th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wide px-5 py-3" style={{ color: '#8a8b8d' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {previo.detalle_previo?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: '#8a8b8d' }}>
                      No hay productos registrados en este previo.
                    </td>
                  </tr>
                ) : (
                  previo.detalle_previo?.map((item: any, i: number) => (
                    <tr key={item.id || i} style={{ borderBottom: '1px solid #f0f5fa' }}>
                      <td className="px-5 py-3 text-sm font-medium" style={{ color: '#37383a' }}>
                        {item.descripcion || 'Producto sin descripción'}
                      </td>
                      <td className="px-5 py-3 text-sm text-right" style={{ color: '#5a5b5d' }}>
                        {item.cantidad}
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-mono" style={{ color: '#5a5b5d' }}>
                        ${item.precio_unitario?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-mono text-red-600">
                        {item.descuento_monto > 0 ? `-$${item.descuento_monto.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-mono" style={{ color: '#5a5b5d' }}>
                        ${item.iva_monto?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        {item.iva_porcentaje ? <span className="text-xs text-gray-400 ml-1">({item.iva_porcentaje}%)</span> : null}
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-mono font-semibold" style={{ color: '#0763a9' }}>
                        ${item.subtotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
