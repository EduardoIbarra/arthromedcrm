'use client'

import { useEffect, useState, use } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import { ChevronLeft, Save, Loader2, Globe, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'

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

interface Catalogue {
  id: string
  name: string
  pdf_url: string
}

interface Congress {
  id: string
  name: string
}

interface EditLandingPageProps {
  params: Promise<{ id: string }>
}

export default function EditLandingPage({ params }: EditLandingPageProps) {
  const { id } = use(params)
  const { t } = useI18n()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'es' | 'en' | 'zh'>('es')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingPage, setIsLoadingPage] = useState(true)

  // Form states
  const [slug, setSlug] = useState('')
  const [titleEs, setTitleEs] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [titleZh, setTitleZh] = useState('')
  const [descriptionEs, setDescriptionEs] = useState('')
  const [descriptionEn, setDescriptionEn] = useState('')
  const [descriptionZh, setDescriptionZh] = useState('')
  const [greetingEs, setGreetingEs] = useState('')
  const [greetingEn, setGreetingEn] = useState('')
  const [greetingZh, setGreetingZh] = useState('')
  
  const [congressId, setCongressId] = useState<string>('')
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])
  const [selectedCatalogues, setSelectedCatalogues] = useState<string[]>([])
  const [contacts, setContacts] = useState<ContactField[]>([])

  // Selection options
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [catalogues, setCatalogues] = useState<Catalogue[]>([])
  const [congresses, setCongresses] = useState<Congress[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        const [specRes, catRes, congRes, pageRes] = await Promise.all([
          fetch('/api/catalog/specialties'),
          fetch('/api/catalogos'),
          fetch('/api/congresos'),
          fetch(`/api/landing-pages/${id}`)
        ])
        const [specJson, catJson, congJson, pageJson] = await Promise.all([
          specRes.json(),
          catRes.json(),
          congRes.json(),
          pageRes.json()
        ])
        setSpecialties(specJson.data || [])
        setCatalogues(catJson.data || [])
        setCongresses(congJson.data || [])
        
        const pageData = pageJson.data
        if (pageData) {
          setSlug(pageData.slug || '')
          setTitleEs(pageData.title_es || '')
          setTitleEn(pageData.title_en || '')
          setTitleZh(pageData.title_zh || '')
          setDescriptionEs(pageData.description_es || '')
          setDescriptionEn(pageData.description_en || '')
          setDescriptionZh(pageData.description_zh || '')
          setGreetingEs(pageData.greeting_es || '')
          setGreetingEn(pageData.greeting_en || '')
          setGreetingZh(pageData.greeting_zh || '')
          setCongressId(pageData.congress_id || '')
          setSelectedSpecialties(pageData.specialty_ids || [])
          setSelectedCatalogues(pageData.catalogo_ids || [])
          setContacts(pageData.contacts || [])
        }
      } catch (err) {
        console.error('Error loading page details:', err)
      } finally {
        setIsLoadingPage(false)
      }
    }
    loadData()
  }, [id])

  const addContact = () => {
    setContacts(prev => [
      ...prev,
      { name: '', phone: '', email: '', role_es: '', role_en: '', role_zh: '' }
    ])
  }

  const removeContact = (index: number) => {
    setContacts(prev => prev.filter((_, i) => i !== index))
  }

  const updateContact = (index: number, field: keyof ContactField, val: string) => {
    setContacts(prev => prev.map((c, i) => i === index ? { ...c, [field]: val } : c))
  }

  const handleSpecialtyToggle = (id: string) => {
    setSelectedSpecialties(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const handleCatalogueToggle = (id: string) => {
    setSelectedCatalogues(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const save = async () => {
    if (!slug) {
      alert('Slug es requerido')
      return
    }
    if (!titleEs) {
      alert('El título en Español es requerido')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`/api/landing-pages/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          slug,
          title_es: titleEs,
          title_en: titleEn || titleEs,
          title_zh: titleZh || titleEs,
          description_es: descriptionEs,
          description_en: descriptionEn || descriptionEs,
          description_zh: descriptionZh || descriptionEs,
          greeting_es: greetingEs,
          greeting_en: greetingEn || greetingEs,
          greeting_zh: greetingZh || greetingEs,
          specialty_ids: selectedSpecialties,
          catalogo_ids: selectedCatalogues,
          contacts,
          congress_id: congressId || null
        })
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to save')
      }

      router.push('/landing-pages')
    } catch (err: any) {
      console.error(err)
      alert(t('error') + ': ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoadingPage) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-64">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-[#0763a9] rounded-full animate-spin"></div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
        
        {/* Back + Action Header */}
        <div className="flex items-center justify-between gap-3">
          <Link href="/landing-pages" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ChevronLeft size={16} /> {t('back')}
          </Link>
          
          <button 
            onClick={save} 
            disabled={isSaving} 
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0763a9] text-white rounded-xl shadow-sm hover:bg-[#054d85] transition-all text-sm font-semibold disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
            {t('saveChanges')}
          </button>
        </div>

        {/* Hero Title */}
        <div className="bg-white rounded-2xl p-6 border border-gray-150 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0763a9]">
            <Globe size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t('editLandingPage' as any) || 'Editar Landing Page'}</h1>
            <p className="text-xs text-gray-500 mt-1">Modifica el contenido, los catálogos y los contactos de esta landing page.</p>
          </div>
        </div>

        {/* Config / Slug Card */}
        <div className="bg-white rounded-2xl p-6 border border-gray-150 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">Configuración del Enlace</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Enlace Personalizado (Slug)</label>
              <div className="flex rounded-xl overflow-hidden border border-gray-200">
                <span className="bg-gray-50 px-3 py-2 text-sm text-gray-500 border-r border-gray-200 flex items-center select-none font-mono">/l/</span>
                <input 
                  className="flex-1 px-3 py-2 text-sm focus:outline-none font-mono bg-white text-gray-850" 
                  value={slug} 
                  onChange={e => setSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase())} 
                  placeholder="ej. congreso-trauma-2026"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Solo se permiten letras minúsculas, números y guiones.</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Vincular a Congreso (Opcional)</label>
              <select 
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none"
                value={congressId}
                onChange={e => setCongressId(e.target.value)}
              >
                <option value="">-- No vincular a congreso --</option>
                {congresses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">Si se vincula, se mostrarán los detalles y contactos de dicho congreso.</p>
            </div>
          </div>
        </div>

        {/* Localized Content Card (Tabs) */}
        <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-100 px-6 py-3 flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-bold text-gray-800">Contenido de la Página</h2>
            
            {/* Language Switcher Tabs */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white p-0.5">
              {(['es', 'en', 'zh'] as const).map(lang => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setActiveTab(lang)}
                  className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                    activeTab === lang ? 'bg-[#0763a9] text-white' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {lang === 'es' ? 'ES' : lang === 'en' ? 'EN' : 'ZH'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 space-y-4 bg-white">
            {activeTab === 'es' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Título de la Página (Español)</label>
                  <input 
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white" 
                    value={titleEs} 
                    onChange={e => setTitleEs(e.target.value)} 
                    placeholder="ej. Bienvenidos al Congreso de Traumatología"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Descripción / Mensaje de Introducción</label>
                  <textarea 
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white" 
                    value={descriptionEs} 
                    onChange={e => setDescriptionEs(e.target.value)} 
                    placeholder="Escribe el contenido principal de tu landing page aquí..."
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Saludo Personalizado en URL (Español)</label>
                  <input 
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white font-mono" 
                    value={greetingEs} 
                    onChange={e => setGreetingEs(e.target.value)} 
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Usa <code className="bg-gray-100 px-1 rounded">{'{name}'}</code> para inyectar el nombre del doctor parametrizado en la URL (ej: ?greeting=Hola+Dr+Gomez).</p>
                </div>
              </div>
            )}

            {activeTab === 'en' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Título de la Página (Inglés)</label>
                  <input 
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white" 
                    value={titleEn} 
                    onChange={e => setTitleEn(e.target.value)} 
                    placeholder="ej. Welcome to the Traumatology Congress"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Descripción (Inglés)</label>
                  <textarea 
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white" 
                    value={descriptionEn} 
                    onChange={e => setDescriptionEn(e.target.value)} 
                    placeholder="Write the English landing page content..."
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Saludo Personalizado (Inglés)</label>
                  <input 
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white font-mono" 
                    value={greetingEn} 
                    onChange={e => setGreetingEn(e.target.value)} 
                  />
                </div>
              </div>
            )}

            {activeTab === 'zh' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Título de la Página (Chino)</label>
                  <input 
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white" 
                    value={titleZh} 
                    onChange={e => setTitleZh(e.target.value)} 
                    placeholder="ej. 欢迎参加创伤学大会"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Descripción (Chino)</label>
                  <textarea 
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white" 
                    value={descriptionZh} 
                    onChange={e => setDescriptionZh(e.target.value)} 
                    placeholder="输入中文落地页主内容..."
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Saludo Personalizado (Chino)</label>
                  <input 
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 bg-white font-mono" 
                    value={greetingZh} 
                    onChange={e => setGreetingZh(e.target.value)} 
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Specialties and Catalogues */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Specialties Card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-150 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">Especialidades Médicas</h2>
            <div className="max-h-60 overflow-y-auto pr-1 space-y-2">
              {specialties.map(spec => {
                const checked = selectedSpecialties.includes(spec.id)
                return (
                  <label key={spec.id} className="flex items-center gap-3 p-2 bg-[#f8fafd] hover:bg-[#e8f1f9] rounded-xl border border-transparent hover:border-[#b4d2ed] transition-colors cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={checked}
                      onChange={() => handleSpecialtyToggle(spec.id)}
                      className="w-4 h-4 text-[#0763a9] rounded focus:ring-[#0763a9] border-gray-300"
                    />
                    <span className="text-xs font-semibold text-gray-700">{spec.name}</span>
                  </label>
                )
              })}
              {specialties.length === 0 && (
                <p className="text-xs italic text-gray-400">No se encontraron especialidades.</p>
              )}
            </div>
            <p className="text-[10px] text-gray-400">Se mostrarán los productos asociados a las especialidades seleccionadas.</p>
          </div>

          {/* Catalogues Card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-150 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">Catálogos Disponibles</h2>
            <div className="max-h-60 overflow-y-auto pr-1 space-y-2">
              {catalogues.map(cat => {
                const checked = selectedCatalogues.includes(cat.id)
                return (
                  <label key={cat.id} className="flex items-center gap-3 p-2 bg-[#f8fafd] hover:bg-[#e8f1f9] rounded-xl border border-transparent hover:border-[#b4d2ed] transition-colors cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={checked}
                      onChange={() => handleCatalogueToggle(cat.id)}
                      className="w-4 h-4 text-[#0763a9] rounded focus:ring-[#0763a9] border-gray-300"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{cat.name}</p>
                      <p className="text-[9px] text-gray-400 truncate">{cat.pdf_url}</p>
                    </div>
                  </label>
                )
              })}
              {catalogues.length === 0 && (
                <p className="text-xs italic text-gray-400">No se encontraron catálogos.</p>
              )}
            </div>
            <p className="text-[10px] text-gray-400">Selecciona los catálogos que el visitante podrá descargar.</p>
          </div>
        </div>

        {/* Contacts Section */}
        <div className="bg-white rounded-2xl p-6 border border-gray-150 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h2 className="text-sm font-bold text-gray-800">Contactos en Landing Page</h2>
            <button 
              type="button" 
              onClick={addContact}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-[#0763a9] border border-blue-100 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              <Plus size={14} /> Agregar Contacto
            </button>
          </div>

          <div className="space-y-4">
            {contacts.map((contact, index) => (
              <div key={index} className="p-4 bg-gray-50 border border-gray-250 rounded-xl relative space-y-3">
                <button
                  type="button"
                  onClick={() => removeContact(index)}
                  className="absolute top-3 right-3 text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                  title="Eliminar Contacto"
                >
                  <Trash2 size={14} />
                </button>

                <p className="text-xs font-bold text-gray-500 uppercase">Contacto #{index + 1}</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Nombre</label>
                    <input 
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none bg-white" 
                      value={contact.name}
                      onChange={e => updateContact(index, 'name', e.target.value)}
                      placeholder="ej. Dr. Rogelio Paz"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">WhatsApp / Teléfono</label>
                    <input 
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none bg-white" 
                      value={contact.phone}
                      onChange={e => updateContact(index, 'phone', e.target.value)}
                      placeholder="ej. 8110223344"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Correo Electrónico</label>
                    <input 
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none bg-white" 
                      value={contact.email}
                      onChange={e => updateContact(index, 'email', e.target.value)}
                      placeholder="ej. rogelio@arthromed.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Rol / Cargo (ES)</label>
                    <input 
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none bg-white" 
                      value={contact.role_es}
                      onChange={e => updateContact(index, 'role_es', e.target.value)}
                      placeholder="ej. Especialista de Producto"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Rol / Cargo (EN)</label>
                    <input 
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none bg-white" 
                      value={contact.role_en}
                      onChange={e => updateContact(index, 'role_en', e.target.value)}
                      placeholder="ej. Product Specialist"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Rol / Cargo (ZH)</label>
                    <input 
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none bg-white" 
                      value={contact.role_zh}
                      onChange={e => updateContact(index, 'role_zh', e.target.value)}
                      placeholder="ej. 产品专家"
                    />
                  </div>
                </div>
              </div>
            ))}

            {contacts.length === 0 && (
              <p className="text-xs italic text-gray-400 text-center py-4">No se han agregado contactos para esta página. Se mostrarán contactos globales si es un congreso.</p>
            )}
          </div>
        </div>

      </div>
    </AppShell>
  )
}
