'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import { Globe, Plus, Edit, Trash2, QrCode, ExternalLink, Link as LinkIcon, BookOpen, User, Calendar } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import PermissionGuard from '@/components/PermissionGuard'
import { QRCodeSVG } from 'qrcode.react'

interface LandingPage {
  id: string
  slug: string
  title_es: string
  title_en: string
  title_zh: string
  description_es: string | null
  specialty_ids: string[]
  catalogo_ids: string[]
  contacts: any[]
  congress_id: string | null
  congresos?: {
    id: string
    name: string
  } | null
}

export default function LandingPagesPage() {
  const { t, locale } = useI18n()
  const router = useRouter()
  const [pages, setPages] = useState<LandingPage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [selectedPage, setSelectedPage] = useState<LandingPage | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchPages = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/landing-pages')
      if (!res.ok) {
        throw new Error('Failed to fetch landing pages')
      }
      const json = await res.json()
      setPages(json.data || [])
    } catch (err: any) {
      console.error('Error fetching landing pages:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPages()
  }, [])

  const handleDelete = async () => {
    if (!selectedPage) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/landing-pages/${selectedPage.id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete')
      
      setIsDeleteModalOpen(false)
      fetchPages()
    } catch (err: any) {
      console.error('Error deleting landing page:', err)
      alert(t('error') + ': ' + err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const getPageTitle = (page: LandingPage) => {
    if (locale === 'en') return page.title_en || page.title_es
    if (locale === 'zh') return page.title_zh || page.title_es
    return page.title_es
  }

  const getPublicUrl = (slug: string) => {
    if (typeof window === 'undefined') return `/l/${slug}`
    return `${window.location.origin}/l/${slug}`
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Globe className="text-[#0763a9]" size={28} />
              {t('landingPages' as any) || 'Landing Pages'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('appName')} / {t('landingPages' as any) || 'Landing Pages'}
            </p>
          </div>
          <PermissionGuard section="landing_pages" action="create">
            <Link 
              href="/landing-pages/new" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0763a9] text-white rounded-xl shadow-sm hover:bg-[#054d85] transition-all text-sm font-semibold"
            >
              <Plus size={18} /> {t('newLandingPage' as any) || 'Nueva Landing Page'}
            </Link>
          </PermissionGuard>
        </header>

        {isLoading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 flex justify-center shadow-sm">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-[#0763a9] rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-8 text-center text-red-500 font-medium">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pages.map(page => (
              <div key={page.id} className="bg-white rounded-2xl border border-gray-150 p-6 flex flex-col items-start gap-4 hover:border-[#b4d2ed] hover:shadow-md transition-all group relative overflow-hidden h-full">
                
                {/* Action Hover Buttons */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <PermissionGuard section="landing_pages" action="edit">
                    <button 
                      onClick={() => router.push(`/landing-pages/${page.id}/edit`)}
                      className="p-1.5 text-gray-400 hover:text-[#0763a9] hover:bg-blue-50 rounded-md transition-colors"
                      title={t('edit') || 'Editar'}
                    >
                      <Edit size={16} />
                    </button>
                  </PermissionGuard>
                  <PermissionGuard section="landing_pages" action="delete">
                    <button 
                      onClick={() => { setSelectedPage(page); setIsDeleteModalOpen(true) }}
                      className="p-1.5 text-gray-400 hover:text-red-650 hover:bg-red-50 rounded-md transition-colors"
                      title={t('delete') || 'Eliminar'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </PermissionGuard>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0763a9] group-hover:scale-110 group-hover:bg-blue-100 transition-all duration-300">
                  <Globe size={24} />
                </div>
                
                <div className="flex-1 w-full">
                  <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">{getPageTitle(page)}</h3>
                  <p className="text-xs font-mono text-[#0763a9] flex items-center gap-1 mb-3 bg-blue-50 px-2 py-0.5 rounded-lg w-fit">
                    <LinkIcon size={12} />
                    /l/{page.slug}
                  </p>
                  
                  <div className="space-y-2 mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
                    {page.congresos && (
                      <p className="flex items-center gap-2">
                        <Calendar size={14} className="text-[#0763a9] flex-shrink-0" />
                        <span className="truncate"><strong>Congreso:</strong> {page.congresos.name}</span>
                      </p>
                    )}
                    <p className="flex items-center gap-2">
                      <BookOpen size={14} className="text-[#0763a9]" />
                      <span><strong>{t('catalogos')}:</strong> {page.catalogo_ids?.length || 0}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <User size={14} className="text-[#0763a9]" />
                      <span><strong>Contactos:</strong> {page.contacts?.length || 0}</span>
                    </p>
                  </div>
                </div>

                <div className="w-full pt-4 mt-auto border-t border-gray-100 flex justify-between items-center">
                  <a 
                    href={getPublicUrl(page.slug)} 
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-[#0763a9] hover:text-[#054d85] transition-colors inline-flex items-center gap-1"
                  >
                    Ver Publica <ExternalLink size={14} />
                  </a>
                  <button 
                    onClick={() => { setSelectedPage(page); setIsQrModalOpen(true) }}
                    className="text-sm font-medium text-gray-400 hover:text-gray-650 transition-colors inline-flex items-center gap-1"
                  >
                    <QrCode size={14} /> QR
                  </button>
                </div>
              </div>
            ))}
            
            {pages.length === 0 && (
              <div className="col-span-full bg-white border border-gray-150 rounded-2xl p-12 text-center text-gray-500 italic">
                {t('noLandingPages' as any) || 'No se encontraron Landing Pages'}
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <Modal 
          open={isDeleteModalOpen} 
          onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
          title={t('delete') || 'Eliminar'}
        >
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">
              {t('deleteLandingPageDesc' as any) || '¿Estás seguro de que deseas eliminar esta Landing Page?'}
              <br/><br/>
              <strong>{selectedPage && getPageTitle(selectedPage)}</strong>
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setIsDeleteModalOpen(false)} 
                className="btn-secondary"
                disabled={isDeleting}
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleDelete} 
                className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold text-sm transition-all"
                disabled={isDeleting}
              >
                {isDeleting ? t('loading') : t('delete')}
              </button>
            </div>
          </div>
        </Modal>

        {/* QR Code Modal */}
        <Modal 
          open={isQrModalOpen} 
          onClose={() => setIsQrModalOpen(false)}
          title="Generar Código QR"
        >
          <div className="flex flex-col items-center justify-center p-4 space-y-6 text-center">
            <p className="text-sm text-gray-600">
              Escanea este código QR para abrir directamente la Landing Page:<br/>
              <strong className="text-[#0763a9]">{selectedPage && getPublicUrl(selectedPage.slug)}</strong>
            </p>
            
            {selectedPage && (
              <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm">
                <QRCodeSVG 
                  value={getPublicUrl(selectedPage.slug)} 
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
            )}
            
            <div className="flex gap-2 w-full pt-4">
              <button 
                onClick={() => setIsQrModalOpen(false)} 
                className="btn-secondary w-full justify-center"
              >
                {t('close') || 'Cerrar'}
              </button>
            </div>
          </div>
        </Modal>

      </div>
    </AppShell>
  )
}
