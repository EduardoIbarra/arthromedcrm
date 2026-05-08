'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Search, ShieldCheck, MapPin, Building2, CheckCircle2, Info, Loader2, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDebounce } from '@/hooks/useDebounce'

interface Distributor {
  id: string
  name: string
  rfc: string | null
  states: string[] | null
  status: string
  distributor_id: string | null
}

export default function DistributorsPage() {
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const fetchDistributors = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/public/distributors?search=${encodeURIComponent(debouncedSearch)}`)
      const json = await res.json()
      setDistributors(json.data || [])
    } catch (error) {
      console.error('Error fetching distributors:', error)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    fetchDistributors()
  }, [fetchDistributors])

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#37383a] selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-blue-100/80 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-white/90">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="https://arthromed.mx/wp-content/uploads/2024/01/logoOrigPag.png"
              alt="Arthromed"
              width={140}
              height={40}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex items-center gap-2 text-[#0763a9] bg-blue-50 px-3 py-1.5 rounded-full text-sm font-semibold border border-blue-100">
            <ShieldCheck size={18} />
            <span>Portal de Verificación</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-white border-b border-blue-50 py-12 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1e293b]"
          >
            Distribuidores Autorizados
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-[#64748b] leading-relaxed"
          >
            Verifique la validez de los socios comerciales autorizados para distribuir productos Arthromed.
          </motion.p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Search Bar */}
        <div className="relative max-w-2xl mx-auto">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8]">
            <Search size={20} />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o RFC..."
            className="w-full pl-12 pr-12 py-4 bg-white border border-blue-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-50 focus:border-blue-400 transition-all outline-none text-lg"
          />
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569] transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#94a3b8]">
              {loading ? 'Buscando...' : `${distributors.length} Resultados`}
            </h2>
            <div className="flex items-center gap-2 text-xs text-[#64748b]">
              <Info size={14} />
              <span>Solo se muestran distribuidores con registro vigente</span>
            </div>
          </div>

          {loading && distributors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="w-10 h-10 text-[#0763a9] animate-spin" />
              <p className="text-[#64748b]">Cargando información...</p>
            </div>
          ) : distributors.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white border border-blue-100 rounded-3xl p-12 text-center space-y-4 shadow-sm"
            >
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-[#0763a9]">
                <Search size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-[#1e293b]">No se encontraron resultados</h3>
                <p className="text-[#64748b]">Asegúrese de que el nombre o RFC esté escrito correctamente.</p>
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {distributors.map((dist, index) => (
                  <motion.div
                    key={dist.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className="group bg-white border border-blue-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-[#0763a9] font-bold group-hover:bg-[#0763a9] group-hover:text-white transition-colors">
                            <Building2 size={20} />
                          </div>
                          <div>
                            <h3 className="font-bold text-[#1e293b] leading-tight">{dist.name}</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {dist.distributor_id && (
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569] bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                                  {dist.distributor_id}
                                </span>
                              )}
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#0763a9] bg-blue-50 px-2 py-0.5 rounded-md">
                                Autorizado
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 pt-2">
                          <div className="flex items-center gap-2 text-sm text-[#64748b]">
                            <ShieldCheck size={16} className="text-[#0763a9]" />
                            <span className="font-mono">{dist.rfc || 'Sin RFC registrado'}</span>
                          </div>
                          {dist.states && dist.states.length > 0 && (
                            <div className="flex items-start gap-2 text-sm text-[#64748b]">
                              <MapPin size={16} className="text-red-400 mt-0.5" />
                              <span className="leading-snug">{dist.states.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-600 shadow-inner">
                          <CheckCircle2 size={24} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="h-px bg-gradient-to-r from-transparent via-blue-100 to-transparent w-full" />
        <div className="space-y-2">
          <p className="text-sm text-[#94a3b8]">
            &copy; {new Date().getFullYear()} Arthromed. Todos los derechos reservados.
          </p>
          <p className="text-xs text-[#cbd5e1] max-w-xl mx-auto leading-relaxed">
            Esta información es de carácter público y tiene como único fin la verificación de distribuidores autorizados.
            Cualquier uso indebido de esta información será responsabilidad de quien la utilice.
          </p>
        </div>
      </footer>
    </div>
  )
}
