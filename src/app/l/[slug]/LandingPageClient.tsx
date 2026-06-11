'use client'

import { useState } from 'react'
import { translations, Locale } from '@/lib/i18n'
import { BookOpen, Phone, Mail, MessageCircle, FileText, Globe, Tag, Heart } from 'lucide-react'
import Image from 'next/image'

interface ContactField {
  name: string
  phone: string
  email: string
  role_es: string
  role_en: string
  role_zh: string
}

interface Specialty {
  id: string
  name: string
}

interface Product {
  id: string
  nombre: string
  nombre_lista: string | null
  precio_unitario: number | null
  categoria: string | null
  tipo: string | null
  model: string | null
  order_code: string | null
  generic_description: string | null
  specialty_ids: string[]
  image_urls: string[]
}

interface Catalogue {
  id: string
  name: string
  pdf_url: string
  description: string | null
}

interface CongressContact {
  id: string
  name: string
  number: string | null
  email: string | null
}

interface LandingPageClientProps {
  landingPage: {
    slug: string
    title_es: string
    title_en: string
    title_zh: string
    description_es: string | null
    description_en: string | null
    description_zh: string | null
    greeting_es: string | null
    greeting_en: string | null
    greeting_zh: string | null
    contacts: any // ContactField[]
    congresos?: {
      name: string
      location: string
    } | null
  }
  specialties: Specialty[]
  products: Product[]
  catalogues: Catalogue[]
  congressContacts: CongressContact[]
  urlGreeting: string
  urlLang: string
}

export default function LandingPageClient({
  landingPage,
  specialties,
  products,
  catalogues,
  congressContacts,
  urlGreeting,
  urlLang
}: LandingPageClientProps) {
  // Determine initial language: URL query param, or fallback to default 'es'
  const initialLang: Locale = ['es', 'en', 'zh'].includes(urlLang) ? (urlLang as Locale) : 'es'
  const [locale, setLocale] = useState<Locale>(initialLang)
  const [activeSpecialtyId, setActiveSpecialtyId] = useState<string>('all')

  const t = (key: string): string => {
    return (translations[locale] as any)[key] ?? (translations.es as any)[key] ?? key
  }

  // Get dynamic translated content of the landing page
  const getPageTitle = () => {
    if (urlGreeting) return urlGreeting

    // Fallback template greeting if name is missing but template exists
    const greetingTemplate = locale === 'en' ? landingPage.greeting_en : locale === 'zh' ? landingPage.greeting_zh : landingPage.greeting_es
    if (greetingTemplate) {
      return greetingTemplate.replace('{name}', '')
    }

    if (locale === 'en') return landingPage.title_en || landingPage.title_es
    if (locale === 'zh') return landingPage.title_zh || landingPage.title_es
    return landingPage.title_es
  }

  const getPageDescription = () => {
    if (locale === 'en') return landingPage.description_en || landingPage.description_es || ''
    if (locale === 'zh') return landingPage.description_zh || landingPage.description_es || ''
    return landingPage.description_es || ''
  }

  // Filter products based on selected specialty tab
  const filteredProducts = activeSpecialtyId === 'all'
    ? products
    : products.filter(p => p.specialty_ids?.includes(activeSpecialtyId))

  const cleanPhone = (phone: string) => {
    const numeric = phone.replace(/\D/g, '')
    return numeric.startsWith('52') ? numeric : `52${numeric}`
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-800" style={{ background: '#f4f6fa' }}>
      
      {/* Dynamic Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-150 py-3.5 px-6 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Image
              src="https://arthromed.mx/wp-content/uploads/2024/01/logoOrigPag.png"
              alt="Arthromed"
              width={110}
              height={32}
              className="object-contain"
              priority
            />
          </div>

          {/* Languages Selector */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl p-0.5">
            {(['es', 'en', 'zh'] as const).map(lang => (
              <button
                key={lang}
                onClick={() => setLocale(lang)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  locale === lang ? 'bg-[#0763a9] text-white shadow' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {lang === 'es' ? 'Español' : lang === 'en' ? 'English' : '中文'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0763a9] to-[#043d6a] text-white py-16 px-6 shadow-md">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full blur-2xl -ml-20 -mb-20"></div>
        
        <div className="max-w-4xl mx-auto text-center space-y-4 relative z-10">
          {landingPage.congresos && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full text-xs font-semibold tracking-wider uppercase backdrop-blur-sm">
              <Heart size={12} className="text-teal-300" />
              {landingPage.congresos.name}
            </span>
          )}
          
          <h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight text-white drop-shadow-sm">
            {getPageTitle()}
          </h1>
          
          {getPageDescription() && (
            <p className="text-base text-blue-100 max-w-2xl mx-auto leading-relaxed whitespace-pre-wrap">
              {getPageDescription()}
            </p>
          )}
        </div>
      </section>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto py-12 px-6 flex-1 w-full space-y-12">

        {/* Catalogues Section */}
        {catalogues.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="text-[#0763a9]" size={22} />
              {t('catalogos')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {catalogues.map(cat => (
                <div key={cat.id} className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm hover:border-[#b4d2ed] transition-all flex flex-col justify-between items-start gap-4">
                  <div className="space-y-1 w-full">
                    <div className="w-10 h-10 bg-blue-50 text-[#0763a9] rounded-xl flex items-center justify-center mb-2">
                      <FileText size={20} />
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm truncate">{cat.name}</h3>
                    {cat.description && (
                      <p className="text-xs text-gray-500 line-clamp-2">{cat.description}</p>
                    )}
                  </div>
                  <a
                    href={cat.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full text-center py-2 bg-[#0763a9] text-white hover:bg-[#054d85] transition-colors rounded-xl text-xs font-semibold inline-flex justify-center items-center gap-1.5"
                  >
                    <span>📥</span> {locale === 'en' ? 'Download PDF' : locale === 'zh' ? '下载 PDF' : 'Descargar PDF'}
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Specialties / Products Section */}
        {specialties.length > 0 && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-3">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Tag className="text-[#0763a9]" size={22} />
                {t('products') || 'Productos'}
              </h2>

              {/* Specialty Filtering Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                <button
                  onClick={() => setActiveSpecialtyId('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex-shrink-0 ${
                    activeSpecialtyId === 'all'
                      ? 'bg-[#0763a9] border-[#0763a9] text-white'
                      : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {t('all')}
                </button>
                {specialties.map(spec => (
                  <button
                    key={spec.id}
                    onClick={() => setActiveSpecialtyId(spec.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex-shrink-0 ${
                      activeSpecialtyId === spec.id
                        ? 'bg-[#0763a9] border-[#0763a9] text-white'
                        : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {spec.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Products grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map(product => (
                <div key={product.id} className="bg-white rounded-2xl border border-gray-150 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col h-full group">
                  {/* Product Image */}
                  <div className="relative h-44 bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
                    {product.image_urls && product.image_urls.length > 0 ? (
                      <img
                        src={product.image_urls[0]}
                        alt={product.nombre}
                        className="object-cover w-full h-full group-hover:scale-105 transition-all duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-blue-50 to-teal-50 flex flex-col items-center justify-center text-[#0763a9] p-4 text-center">
                        <Globe size={40} className="stroke-[1.5] mb-2" />
                        <span className="text-xs font-bold uppercase tracking-wider text-[#0763a9]/60">{product.model || 'ARTHROMED'}</span>
                      </div>
                    )}
                  </div>

                  {/* Product Metadata */}
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        {product.model && (
                          <span className="text-[10px] bg-blue-50 border border-blue-150 font-bold px-2 py-0.5 rounded text-[#0763a9] font-mono">
                            {t('model')}: {product.model}
                          </span>
                        )}
                        {product.order_code && (
                          <span className="text-[10px] bg-gray-100 text-gray-600 font-mono px-2 py-0.5 rounded">
                            Ref: {product.order_code}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-950 text-sm pt-1">{product.nombre_lista || product.nombre}</h3>
                      {product.generic_description && (
                        <p className="text-xs text-gray-500 pt-1 line-clamp-3 leading-relaxed">
                          {product.generic_description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full py-10 text-center text-xs italic text-gray-400">
                  No se encontraron productos disponibles.
                </div>
              )}
            </div>
          </section>
        )}

        {/* Contacts Section */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Phone className="text-[#0763a9]" size={22} />
            {t('contactInfo')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Custom page contacts */}
            {((landingPage.contacts || []) as ContactField[]).map((contact, idx) => {
              const role = locale === 'en' ? contact.role_en : locale === 'zh' ? contact.role_zh : contact.role_es
              return (
                <div key={idx} className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm hover:border-[#b4d2ed] transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-gray-800 text-sm">{contact.name}</h3>
                    {role && <p className="text-xs text-[#0763a9] font-medium">{role}</p>}
                    <div className="space-y-0.5 pt-2 text-xs text-gray-500 font-medium">
                      {contact.phone && <p className="flex items-center gap-1.5">📞 {contact.phone}</p>}
                      {contact.email && <p className="flex items-center gap-1.5">✉️ {contact.email}</p>}
                    </div>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    {contact.phone && (
                      <a
                        href={`https://wa.me/${cleanPhone(contact.phone)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 sm:flex-initial p-2.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl border border-green-200 transition-colors flex justify-center items-center gap-1.5 text-xs font-bold"
                        title="Contactar vía WhatsApp"
                      >
                        <MessageCircle size={16} />
                        WhatsApp
                      </a>
                    )}
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="flex-1 sm:flex-initial p-2.5 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors flex justify-center items-center gap-1.5 text-xs font-bold"
                        title="Enviar correo electrónico"
                      >
                        <Mail size={16} />
                        Email
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Congress contacts */}
            {congressContacts.map(contact => (
              <div key={contact.id} className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm hover:border-[#b4d2ed] transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-gray-800 text-sm">{contact.name}</h3>
                  <p className="text-xs text-teal-650 font-medium">
                    {locale === 'en' ? 'Congress Representative' : locale === 'zh' ? '大会代表' : 'Representante de Congreso'}
                  </p>
                  <div className="space-y-0.5 pt-2 text-xs text-gray-500 font-medium">
                    {contact.number && <p className="flex items-center gap-1.5">📞 {contact.number}</p>}
                    {contact.email && <p className="flex items-center gap-1.5">✉️ {contact.email}</p>}
                  </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  {contact.number && (
                    <a
                      href={`https://wa.me/${cleanPhone(contact.number)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 sm:flex-initial p-2.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl border border-green-200 transition-colors flex justify-center items-center gap-1.5 text-xs font-bold"
                    >
                      <MessageCircle size={16} />
                      WhatsApp
                    </a>
                  )}
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex-1 sm:flex-initial p-2.5 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors flex justify-center items-center gap-1.5 text-xs font-bold"
                    >
                      <Mail size={16} />
                      Email
                    </a>
                  )}
                </div>
              </div>
            ))}

            {landingPage.contacts?.length === 0 && congressContacts.length === 0 && (
              <div className="col-span-full bg-white border border-gray-150 rounded-2xl p-6 text-center text-xs italic text-gray-400">
                No hay representantes de contacto registrados en esta página.
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 px-6 mt-12 border-t border-gray-800 text-center text-xs">
        <div className="max-w-6xl mx-auto space-y-3">
          <p>© {new Date().getFullYear()} Arthromed. {locale === 'en' ? 'All rights reserved.' : locale === 'zh' ? '版权所有。' : 'Todos los derechos reservados.'}</p>
          <div className="flex justify-center gap-4 text-gray-500">
            <a href="https://arthromed.mx" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Website</a>
            <span>•</span>
            <a href="/aviso-de-privacidad" className="hover:text-white transition-colors">{locale === 'en' ? 'Privacy Policy' : locale === 'zh' ? '隐私政策' : 'Aviso de Privacidad'}</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
