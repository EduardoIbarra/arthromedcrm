'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import { Send, Filter, Eye, AlertTriangle, CheckCircle, XCircle, Loader2, MessageCircle, FileText, Smartphone } from 'lucide-react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'

interface Contact {
  id: string
  name: string
  phone: string | null
  whatsapp_phone: string | null
  specialties: string[]
  tags: string[]
  status: string
}

interface LandingPage {
  id: string
  slug: string
  title_es: string
}

interface WhatsAppTemplate {
  id: number
  name: string
  components: {
    type: string
    format?: string
    text?: string
    buttons?: {
      type: string
      text: string
      url?: string
    }[]
  }[]
  languageCode: string
}

interface Congress {
  id: string
  name: string
}

interface Specialty {
  id: string
  name: string
}

export default function CommunicationPage() {
  const { t } = useI18n()

  // Dropdown options
  const [congresses, setCongresses] = useState<Congress[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [landingPages, setLandingPages] = useState<LandingPage[]>([])
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])

  // Filters
  const [selectedCongress, setSelectedCongress] = useState('')
  const [selectedSpecialty, setSelectedSpecialty] = useState('')
  
  // Loaded contacts
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([])
  const [isLoadingContacts, setIsLoadingContacts] = useState(false)
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true)

  // Template settings
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null)
  const [bodyVar2, setBodyVar2] = useState('') // For sender name/role
  const [selectedLandingPage, setSelectedLandingPage] = useState<LandingPage | null>(null)

  // Sending progress states
  const [isSending, setIsSending] = useState(false)
  const [sendingResults, setSendingResults] = useState<{ name: string; status: 'pending' | 'success' | 'error'; error?: string }[]>([])
  const [currentSendingIndex, setCurrentSendingIndex] = useState(-1)
  const [showProgressModal, setShowProgressModal] = useState(false)

  // Load initial configurations
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [congRes, specRes, lpRes, tempRes] = await Promise.all([
          fetch('/api/congresos'),
          fetch('/api/catalog/specialties'),
          fetch('/api/landing-pages'),
          fetch('/api/whatsapp/templates')
        ])

        const [congJson, specJson, lpJson, tempJson] = await Promise.all([
          congRes.json(),
          specRes.json(),
          lpRes.json(),
          tempRes.json()
        ])

        setCongresses(congJson.data || [])
        setSpecialties(specJson.data || [])
        setLandingPages(lpJson.data || [])
        setTemplates(tempJson.data || [])

        if (tempJson.data && tempJson.data.length > 0) {
          setSelectedTemplate(tempJson.data[0])
        }
      } catch (err) {
        console.error('Error loading communications metadata:', err)
      } finally {
        setIsLoadingMetadata(false)
      }
    }
    loadMetadata()
  }, [])

  // Load contacts based on filters
  useEffect(() => {
    async function loadContacts() {
      setIsLoadingContacts(true)
      try {
        const params = new URLSearchParams()
        params.set('pageSize', '1000') // Fetch all potential matching clients
        if (selectedCongress) {
          params.set('congreso', selectedCongress)
        }
        if (selectedSpecialty) {
          params.set('specialty', selectedSpecialty)
        }

        const res = await fetch(`/api/clients?${params.toString()}`)
        const json = await res.json()
        const loaded: Contact[] = json.data || []
        setContacts(loaded)
        // Auto-select all by default
        setSelectedContactIds(loaded.map(c => c.id))
      } catch (err) {
        console.error('Error loading contacts:', err)
      } finally {
        setIsLoadingContacts(false)
      }
    }
    loadContacts()
  }, [selectedCongress, selectedSpecialty])

  const handleToggleSelectAll = () => {
    if (selectedContactIds.length === contacts.length) {
      setSelectedContactIds([])
    } else {
      setSelectedContactIds(contacts.map(c => c.id))
    }
  }

  const handleToggleContact = (id: string) => {
    setSelectedContactIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  // Parse template variables for UI presentation
  const getBodyComponent = () => {
    return selectedTemplate?.components.find(c => c.type === 'body')
  }

  const getButtonComponent = () => {
    return selectedTemplate?.components.find(c => c.type === 'buttons')
  }

  const compilePreview = (contactName: string) => {
    const bodyComp = getBodyComponent()
    if (!bodyComp || !bodyComp.text) return ''

    let text = bodyComp.text
    // Replace {{1}} with contact name
    text = text.replace('{{1}}', contactName || 'Doctor(a)')
    // Replace {{2}} with custom sender variable
    text = text.replace('{{2}}', bodyVar2 || '[Nombre del Remitente]')

    return text
  }

  const startSending = async () => {
    if (selectedContactIds.length === 0) {
      alert('Por favor selecciona al menos un contacto.')
      return
    }
    if (!selectedTemplate) {
      alert('Por favor selecciona una plantilla.')
      return
    }

    const selectedContacts = contacts.filter(c => selectedContactIds.includes(c.id))
    
    // Initialize results array
    const results = selectedContacts.map(c => ({
      name: c.name,
      status: 'pending' as const
    }))
    
    setSendingResults(results)
    setCurrentSendingIndex(0)
    setIsSending(true)
    setShowProgressModal(true)

    // Sequential sending with delay
    for (let i = 0; i < selectedContacts.length; i++) {
      const contact = selectedContacts[i]
      setCurrentSendingIndex(i)

      const targetPhone = contact.whatsapp_phone || contact.phone
      if (!targetPhone) {
        setSendingResults(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error', error: 'Sin número de teléfono' } : item))
        continue
      }

      // Compile Meta components structure for respond.io
      const components: any[] = []
      
      // 1. Body components
      const bodyComp = getBodyComponent()
      if (bodyComp) {
        const parameters: any[] = [
          { type: 'text', text: contact.name }
        ]
        
        // If template has a second body variable (like sender name)
        if (bodyComp.text?.includes('{{2}}')) {
          parameters.push({ type: 'text', text: bodyVar2 || 'Equipo Arthromed' })
        }

        components.push({
          type: 'body',
          parameters
        })
      }

      // 2. Button components
      const btnComp = getButtonComponent()
      if (btnComp && btnComp.buttons) {
        const lpSlug = selectedLandingPage?.slug || ''
        // Generate dynamic link parameter: e.g. "l/bonss?greeting=Hola+Dr.+Rogelio+Paz"
        const greeting = `Hola ${contact.name}`
        const urlParam = lpSlug 
          ? `l/${lpSlug}?greeting=${encodeURIComponent(greeting)}` 
          : ''

        if (urlParam) {
          components.push({
            type: 'buttons',
            buttons: [
              {
                type: 'url',
                text: btnComp.buttons[0].text,
                url: 'https://erp.arthromed.com.mx/{{1}}',
                parameters: [
                  { type: 'text', text: urlParam }
                ]
              }
            ]
          })
        }
      }

      try {
        const response = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: targetPhone,
            template: selectedTemplate.name,
            language: selectedTemplate.languageCode || 'es_MX',
            components
          })
        })

        const data = await response.json()
        if (response.ok) {
          // Update status in list
          setSendingResults(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'success' } : item))

          // Register activity in CRM
          const contentMessage = `Plantilla [${selectedTemplate.name}] enviada en lote. Landing page asociada: ${selectedLandingPage?.title_es || 'Ninguna'}`
          await fetch(`/api/clients/${contact.id}/activities`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              type: 'whatsapp',
              content: contentMessage
            })
          })
        } else {
          setSendingResults(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error', error: data.error || 'Failed' } : item))
        }
      } catch (err: any) {
        console.error('Error sending:', err)
        setSendingResults(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error', error: err.message } : item))
      }

      // Wait 1.5 seconds between sends
      if (i < selectedContacts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
    }

    setIsSending(false)
  }

  return (
    <AppShell>
      <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in space-y-6">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Send className="text-[#0763a9]" size={28} />
              {t('communication') || 'Comunicaciones Massivas'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Envío de mensajes WhatsApp con plantillas y Landing Pages personalizadas.
            </p>
          </div>
        </header>

        {isLoadingMetadata ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 flex justify-center shadow-sm">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-[#0763a9] rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left: Filters & Target Contacts List (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Filters Box */}
              <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Filter size={16} className="text-[#0763a9]" />
                  {t('filterContacts') || 'Filtrar Destinatarios'}
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Por Congreso</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none"
                      value={selectedCongress}
                      onChange={e => setSelectedCongress(e.target.value)}
                    >
                      <option value="">Todos los congresos</option>
                      {congresses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Por Especialidad</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none"
                      value={selectedSpecialty}
                      onChange={e => setSelectedSpecialty(e.target.value)}
                    >
                      <option value="">Todas las especialidades</option>
                      {specialties.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Contacts Table List */}
              <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700">
                    Contactos Encontrados: {contacts.length} | Seleccionados: {selectedContactIds.length}
                  </span>
                  
                  {contacts.length > 0 && (
                    <button
                      onClick={handleToggleSelectAll}
                      className="text-xs font-semibold text-[#0763a9] hover:underline"
                    >
                      {selectedContactIds.length === contacts.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                    </button>
                  )}
                </div>

                <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-100 bg-white">
                  {isLoadingContacts ? (
                    <div className="p-12 flex justify-center">
                      <Loader2 className="w-6 h-6 text-[#0763a9] animate-spin" />
                    </div>
                  ) : contacts.map(contact => {
                    const isSelected = selectedContactIds.includes(contact.id)
                    const hasPhone = contact.whatsapp_phone || contact.phone
                    return (
                      <div 
                        key={contact.id} 
                        className={`flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors ${
                          !hasPhone ? 'opacity-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!hasPhone}
                          checked={isSelected}
                          onChange={() => handleToggleContact(contact.id)}
                          className="w-4 h-4 text-[#0763a9] border-gray-300 rounded focus:ring-[#0763a9]"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800 truncate">{contact.name}</p>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">
                            {hasPhone ? targetPhoneFormatter(hasPhone) : '⚠️ Sin Teléfono'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1 max-w-[200px] justify-end">
                          {contact.specialties?.slice(0, 1).map(spec => (
                            <span key={spec} className="px-1.5 py-0.5 rounded bg-blue-50 text-[10px] font-semibold text-[#0763a9] border border-blue-150">
                              {spec}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  {contacts.length === 0 && !isLoadingContacts && (
                    <div className="p-8 text-center text-xs italic text-gray-400">
                      No se encontraron contactos con los filtros seleccionados.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Message Customizer & Preview (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Variables setup */}
              <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">Configurar Plantilla</h2>
                
                {/* Select Template dropdown */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Plantilla de WhatsApp</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none"
                    value={selectedTemplate?.name || ''}
                    onChange={e => {
                      const found = templates.find(t => t.name === e.target.value)
                      if (found) setSelectedTemplate(found)
                    }}
                  >
                    {templates.map(temp => (
                      <option key={temp.id} value={temp.name}>{temp.name} ({temp.languageCode})</option>
                    ))}
                  </select>
                </div>

                {/* Variable Body fields */}
                {selectedTemplate && (
                  <div className="space-y-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-xs font-bold text-gray-600 uppercase">Variables de la Plantilla</p>
                    
                    <div className="space-y-2.5">
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase">Variable 1 ({"{{1}}"})</p>
                        <p className="text-xs font-medium text-gray-700 bg-white p-2 rounded-lg border border-gray-200">
                          Auto-mapeado al <strong>Nombre del Contacto</strong> (ej: Rogelio Cantú)
                        </p>
                      </div>

                      {/* Check if template has {{2}} variable */}
                      {getBodyComponent()?.text?.includes('{{2}}') && (
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Variable 2 ({"{{2}}"}): Remitente / Cargo</label>
                          <input
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none bg-white"
                            value={bodyVar2}
                            onChange={e => setBodyVar2(e.target.value)}
                            placeholder="ej. Lic. Roberto Garza"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Link Landing page */}
                {selectedTemplate && getButtonComponent() && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                      Asignar Landing Page al Botón
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none"
                      value={selectedLandingPage?.id || ''}
                      onChange={e => {
                        const found = landingPages.find(lp => lp.id === e.target.value)
                        setSelectedLandingPage(found || null)
                      }}
                    >
                      <option value="">-- No incluir link (botón estático o sin link) --</option>
                      {landingPages.map(lp => (
                        <option key={lp.id} value={lp.id}>{lp.title_es} (/l/{lp.slug})</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-gray-400">
                      Inyecta un enlace parametrizado con saludo dinámico para cada doctor.
                    </p>
                  </div>
                )}
              </div>

              {/* Message preview simulator */}
              {selectedTemplate && (
                <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-sm space-y-4">
                  <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                    <Eye size={16} className="text-[#0763a9]" />
                    {t('messagePreview')}
                  </h2>

                  {/* Simulator container */}
                  <div className="p-4 bg-[#e5ddd5] rounded-2xl border border-gray-200 flex flex-col justify-start relative overflow-hidden font-sans">
                    {/* Header bar simulator */}
                    <div className="flex items-center gap-2 mb-3 border-b border-[#dad3cc] pb-2 text-[#4f5d64]">
                      <Smartphone size={16} />
                      <span className="text-xs font-bold font-sans">Simulador WhatsApp</span>
                    </div>

                    {/* WhatsApp Speech Bubble */}
                    <div className="self-start bg-white text-gray-900 rounded-xl p-3 shadow-sm max-w-[85%] text-xs relative leading-relaxed">
                      
                      {/* Gray bold header */}
                      <p className="font-bold text-gray-400 mb-1 select-none text-[10px] uppercase">
                        {selectedTemplate.components.find(c => c.type === 'header')?.text || 'BIENVENIDO'}
                      </p>
                      
                      {/* Body Content */}
                      <p className="whitespace-pre-wrap font-sans text-gray-800 text-xs">
                        {compilePreview(contacts[0]?.name || 'Dr. Rogelio Cantú')}
                      </p>
                      
                      {/* Footer text */}
                      {selectedTemplate.components.find(c => c.type === 'footer') && (
                        <p className="text-[10px] text-gray-450 mt-1 select-none border-t border-gray-100 pt-1">
                          {selectedTemplate.components.find(c => c.type === 'footer')?.text}
                        </p>
                      )}
                    </div>

                    {/* Button simulation */}
                    {getButtonComponent() && (
                      <div className="mt-2 self-start w-[85%] bg-white rounded-lg overflow-hidden shadow-sm border border-gray-100 text-center py-2 flex items-center justify-center gap-1 text-[#0763a9] font-bold text-[11px] hover:bg-gray-50 transition-colors">
                        <span>🔗</span>
                        {getButtonComponent()?.buttons?.[0]?.text || 'Ver Información'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Big Button */}
              <button
                type="button"
                onClick={startSending}
                disabled={isSending || selectedContactIds.length === 0}
                className="w-full py-3 bg-[#0763a9] text-white hover:bg-[#054d85] transition-all font-semibold rounded-2xl shadow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MessageCircle size={18} />
                {t('sendBulkMessage') || 'Enviar Mensajes en Lote'} ({selectedContactIds.length})
              </button>

            </div>

          </div>
        )}

        {/* Bulk Sending Progress Modal */}
        <Modal
          open={showProgressModal}
          onClose={() => !isSending && setShowProgressModal(false)}
          title="Progreso de Envío en Lote"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-sm font-semibold text-gray-700">
                Enviando {currentSendingIndex + 1} de {selectedContactIds.length}...
              </span>
              {isSending ? (
                <div className="flex items-center gap-1.5 text-xs text-[#0763a9] font-semibold">
                  <Loader2 size={14} className="animate-spin" /> Procesando
                </div>
              ) : (
                <span className="text-xs text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded border border-green-200">
                  Completado
                </span>
              )}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-[#0763a9] h-2.5 transition-all duration-300"
                style={{ width: `${((currentSendingIndex + 1) / selectedContactIds.length) * 100}%` }}
              />
            </div>

            {/* Results Logs list */}
            <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white p-2 space-y-1">
              {sendingResults.map((res, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5 px-3 text-xs">
                  <span className="font-semibold text-gray-800">{res.name}</span>
                  <div className="flex items-center gap-1">
                    {res.status === 'pending' && (
                      <span className="text-gray-400 italic flex items-center gap-1">
                        <Loader2 size={12} className="animate-spin" /> Pendiente
                      </span>
                    )}
                    {res.status === 'success' && (
                      <span className="text-green-700 font-semibold flex items-center gap-1">
                        <CheckCircle size={12} className="text-green-600" /> Enviado
                      </span>
                    )}
                    {res.status === 'error' && (
                      <span className="text-red-700 font-semibold flex items-center gap-1" title={res.error}>
                        <XCircle size={12} className="text-red-600" /> Error
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Warning notice */}
            {isSending && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex gap-2">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
                <p>Por favor no cierres esta ventana ni navegues fuera hasta que se complete el envío de todos los mensajes.</p>
              </div>
            )}

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => setShowProgressModal(false)}
                disabled={isSending}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
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

// Format telephone for display (e.g. 5212345678 -> +52 12 3456 78)
function targetPhoneFormatter(phone: string) {
  const clean = phone.replace(/\D/g, '')
  if (clean.length === 10) {
    return `+52 ${clean.slice(0, 2)} ${clean.slice(2, 6)} ${clean.slice(6)}`
  }
  if (clean.length === 12 && clean.startsWith('52')) {
    return `+52 (${clean.slice(2, 4)}) ${clean.slice(4, 8)} ${clean.slice(8)}`
  }
  return `+${clean}`
}
