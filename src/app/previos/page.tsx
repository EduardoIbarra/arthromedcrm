'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import AppShell from '@/components/AppShell'
import { Search, ChevronRight, X, ClipboardList, FileDown } from 'lucide-react'
import Link from 'next/link'
import { useDebounce } from '@/hooks/useDebounce'

const CARD = { background: '#ffffff', border: '1px solid #d4e0ec' }

function PreviosContent() {
  const { t } = useI18n()
  const [previos, setPrevios] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounce(search, 350)

  const fetchPrevios = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page), 
      pageSize: '20',
      ...(debouncedSearch && { search: debouncedSearch }),
    })
    try {
      const res = await fetch(`/api/previos?${params}`)
      const json = await res.json()
      setPrevios(json.data || [])
      setTotal(json.count || 0)
    } finally { 
      setLoading(false) 
    }
  }, [debouncedSearch, page])

  useEffect(() => { 
    fetchPrevios() 
  }, [fetchPrevios])

  useEffect(() => { 
    setPage(1) 
  }, [debouncedSearch])

  const totalPages = Math.ceil(total / 20)

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#37383a' }}>Previos</h1>
            <p className="text-sm" style={{ color: '#5a5b5d' }}>{total} registros</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8a8b8d' }} />
            <input 
              type="text" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Buscar por folio, cliente o total..." 
              className="erp-input pl-9 w-full" 
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8a8b8d' }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="rounded-2xl overflow-hidden bg-white" style={CARD}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0763a9', borderTopColor: 'transparent' }} />
            </div>
          ) : previos.length === 0 ? (
            <div className="text-center py-16" style={{ color: '#8a8b8d' }}>
              <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
              <p>{t('noResults' as any) || 'No se encontraron resultados.'}</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e8f1f9' }}>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#8a8b8d' }}>Folio</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#8a8b8d' }}>Fecha</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#8a8b8d' }}>Cliente</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#8a8b8d' }}>Total (Sin Desc)</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#8a8b8d' }}>Total (Con Desc)</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: '#8a8b8d' }}>PDF</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {previos.map((previo) => (
                      <tr key={previo.id} className="group hover:bg-blue-50/40 transition-colors" style={{ borderBottom: '1px solid #f0f5fa' }}>
                        <td className="px-4 py-3 text-sm font-mono font-bold" style={{ color: '#0763a9' }}>{previo.folio}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#5a5b5d' }}>{new Date(previo.fecha).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: '#37383a' }}>{previo.cliente_nombre || '—'}</td>
                        <td className="px-4 py-3 text-sm font-mono" style={{ color: '#5a5b5d' }}>
                          ${previo.total_sin_descuento ? previo.total_sin_descuento.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold" style={{ color: '#0763a9' }}>
                          ${previo.total_con_descuento ? previo.total_con_descuento.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </td>
                        <td className="px-4 py-3">
                          {previo.pdf_url ? (
                            <a href={previo.pdf_url} target="_blank" rel="noopener noreferrer" className="btn-ghost p-1.5 inline-flex" style={{ color: '#0763a9' }}>
                              <FileDown size={16} />
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/previos/${previo.id}`} className="btn-ghost p-1.5 opacity-0 group-hover:opacity-100">
                            <ChevronRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="lg:hidden divide-y" style={{ borderColor: '#f0f5fa' }}>
                {previos.map((previo) => (
                  <Link key={previo.id} href={`/previos/${previo.id}`} className="flex items-start gap-3 p-4 hover:bg-blue-50/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold truncate" style={{ color: '#37383a' }}>{previo.folio}</p>
                        <span className="text-xs font-mono font-semibold" style={{ color: '#0763a9' }}>
                          ${previo.total_con_descuento ? previo.total_con_descuento.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: '#5a5b5d' }}>{previo.cliente_nombre || '—'}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#8a8b8d' }}>{new Date(previo.fecha).toLocaleDateString()}</p>
                    </div>
                    <ChevronRight size={16} className="flex-shrink-0 mt-1" style={{ color: '#c4c5c7' }} />
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #e8f1f9' }}>
                  <p className="text-xs" style={{ color: '#8a8b8d' }}>
                    Mostrando {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} de {total}
                  </p>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">← Anterior</button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">Siguiente →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}

export default function PreviosPage() {
  return (
    <Suspense fallback={
      <AppShell>
        <div className="max-w-7xl mx-auto py-16 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0763a9', borderTopColor: 'transparent' }} />
        </div>
      </AppShell>
    }>
      <PreviosContent />
    </Suspense>
  )
}
